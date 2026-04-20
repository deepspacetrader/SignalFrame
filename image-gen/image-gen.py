import uuid
import requests
import re
import os
import sys
import torch
import gc
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
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "..", "public", "generated_images")
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

app = Flask(__name__)
CORS(app)

# Global model instance
pipe = None
auto_unload_enabled = True

def load_model():
    """Lazy load the SDXL Turbo model"""
    global pipe
    if pipe is None:
        print("Loading SDXL Turbo (High Quality + Ultra Fast)...")
        print(f"CUDA Available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"CUDA Device Count: {torch.cuda.device_count()}")
            print(f"CUDA Current Device: {torch.cuda.current_device()}")
            print(f"CUDA Device Name: {torch.cuda.get_device_name(0)}")
            print(f"CUDA Memory Allocated: {torch.cuda.memory_allocated(0) / 1024**3:.2f} GB")
            print(f"CUDA Memory Reserved: {torch.cuda.memory_reserved(0) / 1024**3:.2f} GB")
        try:
            # SDXL Turbo is high quality and works best at 1-4 steps.
            # It will use ~6-8GB VRAM, fitting perfectly in 12GB.
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"Target device: {device}")

            dtype = torch.float16 if device == "cuda" else torch.float32
            pipe = AutoPipelineForText2Image.from_pretrained(
                "stabilityai/sdxl-turbo",
                dtype=dtype
            )
            pipe = pipe.to(device)

            # Disable progress bar IO overhead
            pipe.set_progress_bar_config(disable=True)

            print(f"Model loaded on {device.upper()}")
            if device == "cuda":
                print(f"CUDA Memory After Load: {torch.cuda.memory_allocated(0) / 1024**3:.2f} GB")
                print(f"CUDA Memory Reserved After Load: {torch.cuda.memory_reserved(0) / 1024**3:.2f} GB")
        except Exception as e:
            print(f"Error loading model: {e}")
            import traceback
            traceback.print_exc()
            pipe = None
    return pipe

def unload_model():
    """Unload the SDXL Turbo model to free VRAM"""
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
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            print("Model unloaded successfully")
        except Exception as e:
            print(f"Error unloading model: {e}")

@app.route("/generate", methods=["POST"])
def generate():
    global auto_unload_enabled

    try:
        # Lazy load the model
        current_pipe = load_model()
        if current_pipe is None:
            return jsonify({"error": "Failed to load model"}), 500

        data = request.json
        prompt = data.get("prompt", "a mysterious icon")
        size = data.get("size", 16)
        steps = data.get("steps", 5)
        guidance_scale = data.get("guidance_scale", 1.0)
        auto_unload = data.get("auto_unload", auto_unload_enabled)

        seed = data.get("seed", -1)
        generator = None
        if seed != -1:
            generator = torch.Generator(device=current_pipe.device).manual_seed(seed)

        # SDXL Turbo is trained for 512x512. Generating at this resolution
        # provides the best shape definition, and it's still hyper-fast.
        gen_size = 512

        print(f"[SDXL TURBO] Generating icon {gen_size}x{gen_size} (target {size}x{size}): {prompt} (steps: {steps}, seed: {seed}, auto_unload: {auto_unload})")

        with torch.inference_mode():
            # SDXL Turbo does not use guidance_scale (always 0.0)
            image = current_pipe(
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

        # Auto-unload if enabled
        if auto_unload:
            print("Auto-unloading model after generation...")
            unload_model()

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
    unload_model()
    return jsonify({"success": True})

if __name__ == "__main__":
    print("Starting SDXL Image Generation Server on port 7860...")
    print("Model will load on first generation request (lazy loading enabled)")
    print(f"Output directory: {OUTPUT_DIR}")
    app.run(host="0.0.0.0", port=7860, debug=False)
