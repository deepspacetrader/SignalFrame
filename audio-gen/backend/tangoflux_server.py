from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import sys
import json
import threading
import time
import torch
import gc
import requests

app = Flask(__name__)
CORS(app)

# Suppress Werkzeug request logging (but show warnings and errors)
import logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.WARNING)

# Global TangoFlux model instance and status
tangoflux_model = None
generation_status = {"status": "idle", "progress": 0, "message": ""}
auto_unload = True

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output_sfx")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def get_or_create_tangoflux():
    global tangoflux_model
    if tangoflux_model is None:
        try:
            from tangoflux import TangoFluxInference
            tangoflux_model = TangoFluxInference(name='declare-lab/TangoFlux')
        except ImportError:
            # If tangoflux is not installed, try to import from the TangoFlux directory
            sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), 'TangoFlux'))
            from tangoflux import TangoFluxInference
            tangoflux_model = TangoFluxInference(name='declare-lab/TangoFlux')
    return tangoflux_model

def unload_tangoflux():
    global tangoflux_model
    if tangoflux_model is not None:
        del tangoflux_model
        tangoflux_model = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        print("TangoFlux model unloaded from memory")

# Global parameters
current_params = {
    "text": "",
    "negative_prompt": "",
    "duration": 2.0,
    "cfg_strength": 4.5,
    "num_steps": 50,
    "seed": -1
}

@app.route('/api/prompt/generate', methods=['POST'])
def generate_prompt():
    """Enhance audio prompt using configured LLM"""
    data = request.json
    current_text = data.get('current_text', '')
    llm_provider = data.get('llm_provider', 'ollama')
    llm_model = data.get('llm_model', '')
    llm_base_url = data.get('llm_base_url', 'http://127.0.0.1:11434/api')

    try:
        # Call LLM to enhance the prompt
        if llm_provider == 'lmstudio':
            api_url = f"{llm_base_url}/v1/chat/completions"
        else:
            api_url = f"{llm_base_url}/api/chat"

        system_prompt = """You are an expert at enhancing text descriptions for AI audio generation.
Your task is to take a simple description and expand it into a detailed, vivid description that would help generate high-quality sound effects.

CRITICAL RULES:
1. TangoFlux generates sound effects, NOT speech. NEVER include spoken words, phrases, or dialogue in the output - this will produce gibberish.
2. If the input describes someone speaking (e.g., "politician gives speech", "news anchor reads", "public health announcement"), transform it into relevant ambient sound effects instead:
   - Politician speech: crowd applause, camera shutters, press conference ambience
   - News announcement: newsroom ambience, broadcast static, breaking news alert sounds
   - Public announcement: emergency siren, crowd murmuring, public address system tones
3. EXCEPTION: Crowd/group scenarios where individual words don't matter (e.g., "crowd cheering", "stadium noise") are acceptable
4. REALISM IS PARAMOUNT: Avoid sci-fi, fantasy, or exaggerated sounds. Use only realistic, grounded descriptions:
   - NO: "cosmic hum", "mystical chimes", "laser beams", "magical energy"
   - YES: "traffic rumble", "keyboard typing", "office chatter", "wind through trees"
5. For abstract/metaphysical headlines (e.g., "inflation rises", "market sentiment"), think about real-world sounds that would occur:
   - Economic news: stock ticker sounds, newsroom ambience, phone ringing
   - Policy changes: press conference ambience, document shuffling, crowd murmuring
   - Scientific discoveries: laboratory equipment, computer processing sounds, research facility ambience
6. Keep enhancement concise but descriptive (under 100 words)
7. Focus on acoustic details: textures, timbres, spatial qualities, dynamics
8. Include specific sound characteristics if relevant (pitch, resonance, decay)
9. Always avoid static, white noise and sudden shocking high pitch pings or extremely loud sharp sounds that might cause hearing damage
10. Output ONLY the enhanced text, no explanations or meta-commentary"""

        payload = {
            "model": llm_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Enhance this audio description: {current_text}"}
            ],
            "stream": False
        }

        response = requests.post(api_url, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()

        # Extract the enhanced prompt from response
        if llm_provider == 'lmstudio':
            enhanced = result['choices'][0]['message']['content']
        else:
            enhanced = result['message']['content']

        return jsonify({
            "prompt": enhanced.strip(),
            "description": enhanced.strip()
        })
    except Exception as e:
        print(f"Error enhancing prompt: {e}")
        # Return original text if enhancement fails
        return jsonify({
            "prompt": current_text,
            "description": current_text
        })

@app.route('/api/sfx/params', methods=['GET'])
def get_sfx_params():
    return jsonify(current_params)

@app.route('/api/sfx/params', methods=['POST'])
def set_sfx_params():
    global current_params
    data = request.json
    if 'text' in data:
        current_params['text'] = data['text']
    if 'negative_prompt' in data:
        current_params['negative_prompt'] = data['negative_prompt']
    if 'duration' in data:
        current_params['duration'] = float(data['duration'])
    if 'cfg_strength' in data:
        current_params['cfg_strength'] = float(data['cfg_strength'])
    if 'num_steps' in data:
        current_params['num_steps'] = int(data['num_steps'])
    if 'seed' in data:
        current_params['seed'] = int(data['seed'])
    if 'auto_unload' in data:
        global auto_unload
        auto_unload = bool(data['auto_unload'])
    return jsonify({"success": True})

@app.route('/api/sfx/generate', methods=['POST'])
def generate_sfx():
    global generation_status, current_params
    
    data = request.json or {}
    
    # Update params from request if provided
    if 'text' in data:
        current_params['text'] = data['text']
    if 'duration' in data:
        current_params['duration'] = float(data['duration'])
    if 'num_steps' in data:
        current_params['num_steps'] = int(data['num_steps'])
    
    generation_status = {"status": "generating", "progress": 0, "message": "Loading model..."}
    
    result = {"success": False, "filepath": None, "error": None}
    
    def do_generate():
        global generation_status, tangoflux_model
        try:
            # Get or create model
            generation_status["progress"] = 10
            generation_status["message"] = "Loading TangoFlux model..."
            model = get_or_create_tangoflux()
            
            generation_status["progress"] = 30
            generation_status["message"] = f"Generating audio: {current_params['text'][:50]}..."
            
            # Generate audio
            audio = model.generate(
                current_params['text'],
                steps=current_params['num_steps'],
                duration=current_params['duration']
            )
            
            generation_status["progress"] = 80
            generation_status["message"] = "Saving audio file..."
            
            # Save audio file
            import torchaudio
            timestamp = int(time.time())
            filename = f"sfx_{timestamp}.wav"
            filepath = os.path.join(OUTPUT_DIR, filename)
            torchaudio.save(filepath, audio, sample_rate=44100)
            
            # Return relative path for serving
            result["filepath"] = f"/output_sfx/{filename}"
            result["success"] = True
            
            generation_status["progress"] = 100
            generation_status["message"] = "Generation complete!"
            
            # Auto-unload if enabled
            if auto_unload:
                generation_status["message"] = "Unloading model..."
                unload_tangoflux()
                generation_status["message"] = "Generation complete, model unloaded"
                
        except Exception as e:
            generation_status["status"] = "error"
            generation_status["message"] = f"Error: {str(e)}"
            result["error"] = str(e)
            print(f"Error generating audio: {e}")
            import traceback
            traceback.print_exc()
    
    # Run generation in a separate thread
    thread = threading.Thread(target=do_generate)
    thread.start()
    
    # Wait for generation to complete (with timeout)
    thread.join(timeout=300)  # 5 minute timeout
    
    if thread.is_alive():
        generation_status["status"] = "error"
        generation_status["message"] = "Generation timed out"
        result["error"] = "Generation timed out"
    else:
        generation_status["status"] = "idle"
    
    return jsonify(result)

@app.route('/api/sfx/status', methods=['GET'])
def get_status():
    return jsonify(generation_status)

@app.route('/api/model/unload', methods=['POST'])
def unload_model():
    unload_tangoflux()
    return jsonify({"success": True, "message": "Model unloaded"})

@app.route('/output_sfx/<path:filename>')
def serve_output(filename):
    return send_from_directory(OUTPUT_DIR, filename)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "model_loaded": tangoflux_model is not None})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 7861))
    print(f"Starting TangoFlux API server on port {port}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Auto-unload enabled: {auto_unload}")
    app.run(host='0.0.0.0', port=port, debug=False)
