import uuid
import requests
import re
import os
import sys
import torch
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from diffusers import AutoPipelineForText2Image
from PIL import Image
import warnings
import requests
import re


# Configure UTF-8 encoding for Windows console
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

warnings.filterwarnings("ignore")

# Setup directories
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "..", "generated_images")
os.makedirs(OUTPUT_DIR, exist_ok=True)

app = Flask(__name__)
CORS(app)

@app.route("/generated_images/<path:filename>")
def serve_generated_image(filename):
    return send_from_directory(OUTPUT_DIR, filename)

print("Loading SDXL Turbo (High Quality + Ultra Fast)...")
try:
    # SDXL Turbo is high quality and works best at 1-4 steps.
    # It will use ~6-8GB VRAM, fitting perfectly in 12GB.
    pipe = AutoPipelineForText2Image.from_pretrained(
        "stabilityai/sdxl-turbo",
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        variant="fp16"
    )
    pipe = pipe.to("cuda" if torch.cuda.is_available() else "cpu")
    
    # Disable progress bar IO overhead
    pipe.set_progress_bar_config(disable=True)
    
    print(f"Model loaded on {'CUDA' if torch.cuda.is_available() else 'CPU'}")
except Exception as e:
    print(f"Error loading model: {e}")
    pipe = None

@app.route("/generate", methods=["POST"])
def generate():
    if pipe is None:
        return jsonify({"error": "Model not loaded"}), 500
    
    try:
        data = request.json
        prompt = data.get("prompt", "a mysterious icon")
        size = data.get("size", 16) 
        steps = data.get("steps", 5)
        guidance_scale = data.get("guidance_scale", 1.0)
        
        seed = data.get("seed", -1)
        generator = None
        if seed != -1:
            generator = torch.Generator(device=pipe.device).manual_seed(seed)
        
        # SDXL Turbo is trained for 512x512. Generating at this resolution
        # provides the best shape definition, and it's still hyper-fast.
        gen_size = 512
        
        print(f"[SDXL TURBO] Generating icon {gen_size}x{gen_size} (target {size}x{size}): {prompt} (steps: {steps}, seed: {seed})")

        with torch.inference_mode():
            # SDXL Turbo does not use guidance_scale (always 0.0)
            image = pipe(
                prompt,
                height=gen_size,
                width=gen_size,
                num_inference_steps=steps,
                guidance_scale=0.0,
                generator=generator
            ).images[0]

        # Resize to exactly the requested size
        if size != gen_size:
            image = image.resize((size, size), Image.NEAREST)

        filename = f"{uuid.uuid4()}.png"
        filepath = os.path.join(OUTPUT_DIR, filename)
        image.save(filepath)

        return jsonify({
            "path": filepath,
            "filename": filename
        })
    except Exception as e:
        print(f"Generation error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ready", "device": str(pipe.device) if pipe else "none"})

@app.route("/status", methods=["GET"])
def status():
    return jsonify({"model_loaded": pipe is not None})

@app.route("/unload", methods=["POST"])
def unload():
    global pipe
    if pipe is not None:
        try:
            # Move to CPU first to free CUDA memory
            if pipe.device.type == "cuda":
                pipe = pipe.to("cpu")
            # Delete the model
            del pipe
            pipe = None
            # Force garbage collection and clear CUDA cache
            import gc
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            print("Model unloaded successfully")
            return jsonify({"success": True})
        except Exception as e:
            print(f"Error unloading model: {e}")
            return jsonify({"success": False, "error": str(e)}), 500
    return jsonify({"success": True, "message": "Model already unloaded"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7860, debug=False)
