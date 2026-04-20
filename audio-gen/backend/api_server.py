from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import sys
import json
import threading
import time
import requests

# Add the parent directory to path to import the generators
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)
CORS(app)

# Suppress Werkzeug request logging (but show warnings and errors)
import logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.WARNING)

# Import generators
from music_gen import MusicGenerator
from sfx_gen2 import SFXGenerator, all_model_cfg

# Global generator instances and status
music_gen = None
sfx_gen = None
generation_status = {"type": None, "status": "idle", "progress": 0, "message": ""}

OUTPUT_MUSIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output_music")
OUTPUT_SFX_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output_sfx")

def get_or_create_music_gen():
    global music_gen
    if music_gen is None:
        music_gen = MusicGenerator()
    return music_gen

def get_or_create_sfx_gen():
    global sfx_gen
    if sfx_gen is None:
        sfx_gen = SFXGenerator()
    return sfx_gen

@app.route('/api/music/params', methods=['GET'])
def get_music_params():
    gen = get_or_create_music_gen()
    return jsonify({
        "duration": gen.duration,
        "sampling_rate": gen.sampling_rate,
        "text": gen.text
    })

@app.route('/api/music/params', methods=['POST'])
def set_music_params():
    gen = get_or_create_music_gen()
    data = request.json
    if 'duration' in data:
        gen.duration = float(data['duration'])
    if 'sampling_rate' in data:
        gen.sampling_rate = int(data['sampling_rate'])
    if 'text' in data:
        gen.text = data['text']
    return jsonify({"success": True})

@app.route('/api/music/generate', methods=['POST'])
def generate_music():
    global generation_status
    gen = get_or_create_music_gen()
    
    data = request.json or {}
    if 'text' in data:
        gen.text = data['text']
    if 'duration' in data:
        gen.duration = float(data['duration'])
    if 'sampling_rate' in data:
        gen.sampling_rate = int(data['sampling_rate'])
    
    generation_status = {"type": "music", "status": "generating", "progress": 0, "message": "Starting generation..."}
    
    result = {"filepath": None, "error": None}
    
    def do_generate():
        global generation_status
        try:
            generation_status["progress"] = 10
            generation_status["message"] = "Preparing inputs..."
            
            import torch
            inputs = gen.processor(text=[gen.text], return_tensors="pt")
            inputs = {k: v.to(gen.device) for k, v in inputs.items()}
            max_new_tokens = int(gen.duration * 50)
            
            generation_status["progress"] = 20
            generation_status["message"] = f"Generating {max_new_tokens} tokens..."
            
            with torch.no_grad():
                audio_values = gen.model.generate(**inputs, max_new_tokens=max_new_tokens)
            
            generation_status["progress"] = 80
            generation_status["message"] = "Saving audio..."
            
            output_path = gen.get_next_filename()
            import scipy.io.wavfile
            audio_data = audio_values[0, 0].cpu().numpy()
            scipy.io.wavfile.write(output_path, rate=gen.sampling_rate, data=audio_data)
            
            # Save metadata JSON
            metadata = {
                "prompt": gen.text,
                "duration": gen.duration,
                "sampling_rate": gen.sampling_rate,
                "created_at": time.time()
            }
            metadata_path = output_path.replace('.wav', '.json')
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            filename = os.path.basename(output_path)
            result["filepath"] = f"/music/{filename}"
            generation_status = {"type": "music", "status": "complete", "progress": 100, "message": "Done!", "filepath": result["filepath"]}
        except Exception as e:
            result["error"] = str(e)
            generation_status = {"type": "music", "status": "error", "progress": 0, "message": str(e)}
    
    thread = threading.Thread(target=do_generate)
    thread.start()
    thread.join()
    
    if result["error"]:
        return jsonify({"success": False, "error": result["error"]}), 500
    
    return jsonify({"success": True, "filepath": result["filepath"]})

@app.route('/api/sfx/params', methods=['GET'])
def get_sfx_params():
    gen = get_or_create_sfx_gen()
    return jsonify({
        "duration": gen.duration,
        "cfg_strength": gen.cfg_strength,
        "num_steps": gen.num_steps,
        "seed": gen.seed,
        "text": gen.text,
        "negative_prompt": gen.negative_prompt,
        "variant": gen.variant
    })

@app.route('/api/sfx/params', methods=['POST'])
def set_sfx_params():
    gen = get_or_create_sfx_gen()
    data = request.json
    if 'duration' in data:
        gen.duration = float(data['duration'])
    if 'cfg_strength' in data:
        gen.cfg_strength = float(data['cfg_strength'])
    if 'num_steps' in data:
        gen.num_steps = int(data['num_steps'])
        gen.fm = gen.fm.__class__(min_sigma=0, inference_mode='euler', num_steps=gen.num_steps)
    if 'seed' in data:
        gen.seed = int(data['seed'])
    if 'text' in data:
        gen.text = data['text']
    if 'negative_prompt' in data:
        gen.negative_prompt = data['negative_prompt']
    if 'variant' in data:
        if data['variant'] in gen.all_model_cfg:
            gen.variant = data['variant']
            gen.load_model()
    return jsonify({"success": True})

@app.route('/api/sfx/generate', methods=['POST'])
def generate_sfx():
    global generation_status
    gen = get_or_create_sfx_gen()
    
    data = request.json or {}
    if 'text' in data:
        gen.text = data['text']
    if 'duration' in data:
        gen.duration = float(data['duration'])
    if 'seed' in data:
        gen.seed = int(data['seed'])
    if 'negative_prompt' in data:
        gen.negative_prompt = data['negative_prompt']
    
    generation_status = {"type": "sfx", "status": "generating", "progress": 0, "message": "Starting generation..."}
    
    result = {"filepath": None, "error": None}
    
    def do_generate():
        global generation_status
        try:
            import torch
            import torchaudio
            
            generation_status["progress"] = 10
            generation_status["message"] = "Updating sequence lengths..."
            gen.seq_cfg.duration = gen.duration
            gen.net.update_seq_lengths(
                gen.seq_cfg.latent_seq_len,
                gen.seq_cfg.clip_seq_len,
                gen.seq_cfg.sync_seq_len
            )
            gen.rng.manual_seed(gen.seed)
            
            generation_status["progress"] = 30
            generation_status["message"] = "Generating audio..."
            
            clip_frames = sync_frames = None
            from mmaudio.eval_utils import generate
            
            audios = generate(
                clip_frames,
                sync_frames,
                [gen.text],
                negative_text=[gen.negative_prompt] if gen.negative_prompt else [""],
                feature_utils=gen.feature_utils,
                net=gen.net,
                fm=gen.fm,
                rng=gen.rng,
                cfg_strength=gen.cfg_strength
            )
            
            generation_status["progress"] = 80
            generation_status["message"] = "Saving audio..."
            
            audio = audios.float().cpu()[0]
            output_path = gen.get_next_filename()
            torchaudio.save(output_path, audio, gen.sampling_rate, format="wav")
            
            # Save metadata JSON
            metadata = {
                "prompt": gen.text,
                "negative_prompt": gen.negative_prompt,
                "cfg": gen.cfg_strength,
                "iterations": gen.num_steps,
                "seed": gen.seed,
                "duration": gen.duration,
                "variant": gen.variant,
                "sampling_rate": gen.sampling_rate,
                "created_at": time.time()
            }
            metadata_path = output_path.replace('.wav', '.json')
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            filename = os.path.basename(output_path)
            result["filepath"] = f"/sfx/{filename}"
            generation_status = {"type": "sfx", "status": "complete", "progress": 100, "message": "Done!", "filepath": result["filepath"]}
        except Exception as e:
            result["error"] = str(e)
            generation_status = {"type": "sfx", "status": "error", "progress": 0, "message": str(e)}
    
    thread = threading.Thread(target=do_generate)
    thread.start()
    thread.join()
    
    if result["error"]:
        return jsonify({"success": False, "error": result["error"]}), 500
    
    return jsonify({"success": True, "filepath": result["filepath"]})

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify(generation_status)

@app.route('/api/music/files', methods=['GET'])
def list_music_files():
    files = []
    if os.path.exists(OUTPUT_MUSIC_DIR):
        for f in sorted(os.listdir(OUTPUT_MUSIC_DIR)):
            if f.endswith('.wav'):
                filepath = os.path.join(OUTPUT_MUSIC_DIR, f)
                metadata_path = filepath.replace('.wav', '.json')
                metadata = None
                if os.path.exists(metadata_path):
                    try:
                        with open(metadata_path, 'r') as mf:
                            metadata = json.load(mf)
                    except:
                        pass
                files.append({
                    "name": f,
                    "path": f"/music/{f}",
                    "size": os.path.getsize(filepath),
                    "created": os.path.getctime(filepath),
                    "metadata": metadata
                })
    return jsonify(files)

@app.route('/api/sfx/files', methods=['GET'])
def list_sfx_files():
    files = []
    if os.path.exists(OUTPUT_SFX_DIR):
        for f in sorted(os.listdir(OUTPUT_SFX_DIR)):
            if f.endswith('.wav'):
                filepath = os.path.join(OUTPUT_SFX_DIR, f)
                metadata_path = filepath.replace('.wav', '.json')
                metadata = None
                if os.path.exists(metadata_path):
                    try:
                        with open(metadata_path, 'r') as mf:
                            metadata = json.load(mf)
                    except:
                        pass
                files.append({
                    "name": f,
                    "path": f"/sfx/{f}",
                    "size": os.path.getsize(filepath),
                    "created": os.path.getctime(filepath),
                    "metadata": metadata
                })
    return jsonify(files)

@app.route('/music/<path:filename>')
def serve_music(filename):
    return send_from_directory(OUTPUT_MUSIC_DIR, filename)

@app.route('/sfx/<path:filename>')
def serve_sfx(filename):
    return send_from_directory(OUTPUT_SFX_DIR, filename)

@app.route('/api/music/delete/<path:filename>', methods=['DELETE'])
def delete_music(filename):
    try:
        # Security: prevent directory traversal
        filename = os.path.basename(filename)
        filepath = os.path.join(OUTPUT_MUSIC_DIR, filename)
        
        if not os.path.exists(filepath):
            return jsonify({"success": False, "error": "File not found"}), 404
        
        # Delete the WAV file
        os.remove(filepath)
        
        # Delete associated JSON metadata file if exists
        metadata_path = filepath.replace('.wav', '.json')
        if os.path.exists(metadata_path):
            os.remove(metadata_path)
        
        return jsonify({"success": True, "message": "File deleted"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/sfx/delete/<path:filename>', methods=['DELETE'])
def delete_sfx(filename):
    try:
        # Security: prevent directory traversal
        filename = os.path.basename(filename)
        filepath = os.path.join(OUTPUT_SFX_DIR, filename)
        
        if not os.path.exists(filepath):
            return jsonify({"success": False, "error": "File not found"}), 404
        
        # Delete the WAV file
        os.remove(filepath)
        
        # Delete associated JSON metadata file if exists
        metadata_path = filepath.replace('.wav', '.json')
        if os.path.exists(metadata_path):
            os.remove(metadata_path)
        
        return jsonify({"success": True, "message": "File deleted"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/music/rate/<path:filename>', methods=['POST'])
def rate_music(filename):
    try:
        filename = os.path.basename(filename)
        filepath = os.path.join(OUTPUT_MUSIC_DIR, filename)
        metadata_path = filepath.replace('.wav', '.json')
        
        if not os.path.exists(metadata_path):
            return jsonify({"success": False, "error": "Metadata file not found"}), 404
        
        data = request.json or {}
        rating = data.get('rating', 0)
        
        # Validate rating
        if not isinstance(rating, (int, float)) or rating < 0 or rating > 5:
            return jsonify({"success": False, "error": "Rating must be between 0 and 5"}), 400
        
        # Read existing metadata
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        # Update rating
        metadata['rating'] = rating
        
        # Write back
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return jsonify({"success": True, "rating": rating})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/sfx/rate/<path:filename>', methods=['POST'])
def rate_sfx(filename):
    try:
        filename = os.path.basename(filename)
        filepath = os.path.join(OUTPUT_SFX_DIR, filename)
        metadata_path = filepath.replace('.wav', '.json')
        
        if not os.path.exists(metadata_path):
            return jsonify({"success": False, "error": "Metadata file not found"}), 404
        
        data = request.json or {}
        rating = data.get('rating', 0)
        
        # Validate rating
        if not isinstance(rating, (int, float)) or rating < 0 or rating > 5:
            return jsonify({"success": False, "error": "Rating must be between 0 and 5"}), 400
        
        # Read existing metadata
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        # Update rating
        metadata['rating'] = rating
        
        # Write back
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return jsonify({"success": True, "rating": rating})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =============================================================================
# External AI Model Integration Endpoints
# =============================================================================

@app.route('/api/external/sfx/prompt', methods=['POST'])
def external_set_sfx_prompt():
    """
    External AI endpoint: Set SFX prompt and duration.
    Accepts: {"prompt": "sound description", "duration": 8}
    Returns: {"success": true, "params": {...}}
    """
    global generation_status
    try:
        gen = get_or_create_sfx_gen()
        data = request.json or {}
        
        if 'prompt' not in data:
            return jsonify({"success": False, "error": "Missing 'prompt' field"}), 400
        
        gen.text = data['prompt']
        
        if 'duration' in data:
            gen.duration = float(data['duration'])
        
        # Set a temporary status so frontend knows to fetch updated params
        generation_status = {"type": "sfx", "status": "idle", "progress": 0, "message": "Prompt set via API"}
        
        return jsonify({
            "success": True,
            "params": {
                "prompt": gen.text,
                "duration": gen.duration,
                "cfg_strength": gen.cfg_strength,
                "num_steps": gen.num_steps,
                "seed": gen.seed,
                "variant": gen.variant
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/external/sfx/generate', methods=['POST'])
def external_generate_sfx():
    """
    External AI endpoint: Generate SFX from prompt + duration.
    Accepts: {"prompt": "sound description", "duration": 8, "seed": 1337} (all optional except prompt)
    Returns: {"success": true, "filepath": "/sfx/filename.wav", "url": "http://...", "duration": 8}
    """
    global generation_status
    gen = get_or_create_sfx_gen()
    
    data = request.json or {}
    
    # Update params from request
    if 'prompt' in data:
        gen.text = data['prompt']
    if 'duration' in data:
        gen.duration = float(data['duration'])
    if 'seed' in data:
        gen.seed = int(data['seed'])
    if 'cfg_strength' in data:
        gen.cfg_strength = float(data['cfg_strength'])
    if 'num_steps' in data:
        gen.num_steps = int(data['num_steps'])
        gen.fm = gen.fm.__class__(min_sigma=0, inference_mode='euler', num_steps=gen.num_steps)
    
    if not gen.text:
        return jsonify({"success": False, "error": "No prompt set. Provide 'prompt' in request body."}), 400
    
    generation_status = {"type": "sfx", "status": "generating", "progress": 0, "message": "Starting generation..."}
    
    # Capture request host URL before starting thread (request context won't be available in thread)
    host_url = request.host_url.rstrip('/')
    
    result = {"filepath": None, "error": None, "full_url": None}
    
    def do_generate():
        global generation_status
        try:
            import torch
            import torchaudio
            
            generation_status["progress"] = 10
            generation_status["message"] = "Updating sequence lengths..."
            gen.seq_cfg.duration = gen.duration
            gen.net.update_seq_lengths(
                gen.seq_cfg.latent_seq_len,
                gen.seq_cfg.clip_seq_len,
                gen.seq_cfg.sync_seq_len
            )
            gen.rng.manual_seed(gen.seed)
            
            generation_status["progress"] = 30
            generation_status["message"] = "Generating audio..."
            
            clip_frames = sync_frames = None
            from mmaudio.eval_utils import generate
            
            audios = generate(
                clip_frames,
                sync_frames,
                [gen.text],
                negative_text=[gen.negative_prompt] if gen.negative_prompt else [""],
                feature_utils=gen.feature_utils,
                net=gen.net,
                fm=gen.fm,
                rng=gen.rng,
                cfg_strength=gen.cfg_strength
            )
            
            generation_status["progress"] = 80
            generation_status["message"] = "Saving audio..."
            
            audio = audios.float().cpu()[0]
            output_path = gen.get_next_filename()
            torchaudio.save(output_path, audio, gen.sampling_rate, format="wav")
            
            # Save metadata JSON
            metadata = {
                "prompt": gen.text,
                "negative_prompt": gen.negative_prompt,
                "cfg": gen.cfg_strength,
                "iterations": gen.num_steps,
                "seed": gen.seed,
                "duration": gen.duration,
                "variant": gen.variant,
                "sampling_rate": gen.sampling_rate,
                "created_at": time.time()
            }
            metadata_path = output_path.replace('.wav', '.json')
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            filename = os.path.basename(output_path)
            result["filepath"] = f"/sfx/{filename}"
            
            # Build full URL using captured host_url
            result["full_url"] = f"{host_url}/sfx/{filename}"
            
            generation_status = {"type": "sfx", "status": "complete", "progress": 100, "message": "Done!", "filepath": result["filepath"]}
        except Exception as e:
            result["error"] = str(e)
            generation_status = {"type": "sfx", "status": "error", "progress": 0, "message": str(e)}
    
    thread = threading.Thread(target=do_generate)
    thread.start()
    thread.join()
    
    if result["error"]:
        return jsonify({"success": False, "error": result["error"]}), 500
    
    return jsonify({
        "success": True,
        "filepath": result["filepath"],
        "url": result["full_url"],
        "prompt": gen.text,
        "duration": gen.duration,
        "seed": gen.seed
    })


@app.route('/api/external/sfx/latest', methods=['GET'])
def external_get_latest_sfx():
    """
    External AI endpoint: Get the most recently generated SFX file.
    Returns: {"success": true, "file": {...}} or {"success": false, "error": "No files found"}
    """
    try:
        if not os.path.exists(OUTPUT_SFX_DIR):
            return jsonify({"success": False, "error": "No SFX output directory"}), 404
        
        wav_files = [f for f in os.listdir(OUTPUT_SFX_DIR) if f.endswith('.wav')]
        if not wav_files:
            return jsonify({"success": False, "error": "No SFX files found"}), 404
        
        # Sort by creation time, newest first
        wav_files.sort(key=lambda f: os.path.getctime(os.path.join(OUTPUT_SFX_DIR, f)), reverse=True)
        latest = wav_files[0]
        
        filepath = os.path.join(OUTPUT_SFX_DIR, latest)
        metadata_path = filepath.replace('.wav', '.json')
        metadata = None
        
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, 'r') as mf:
                    metadata = json.load(mf)
            except:
                pass
        
        host = request.host_url.rstrip('/')
        
        return jsonify({
            "success": True,
            "file": {
                "name": latest,
                "path": f"/sfx/{latest}",
                "url": f"{host}/sfx/{latest}",
                "size": os.path.getsize(filepath),
                "created": os.path.getctime(filepath),
                "metadata": metadata
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =============================================================================
# Tiny LLM for Random Prompt Generation (Qwen2.5-1.5B-Instruct ~3GB VRAM)
# =============================================================================

llm_model = None
llm_tokenizer = None

def get_or_load_llm():
    """Lazy-load the tiny LLM only when needed"""
    global llm_model, llm_tokenizer
    if llm_model is None:
        from transformers import AutoModelForCausalLM, AutoTokenizer
        import torch
        
        model_name = "Qwen/Qwen2.5-0.5B-Instruct"
        print(f"Loading tiny LLM: {model_name}...")
        
        llm_tokenizer = AutoTokenizer.from_pretrained(model_name)
        llm_model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16,
            device_map="auto"
        )
        print("Tiny LLM loaded successfully!")
    return llm_model, llm_tokenizer

SFX_PROMPT_SYSTEM = """You are a simple sound effect label generator for audio AI models.

CRITICAL RULES:
- Output ONLY 3-10 words maximum
- Format: "[noun] [verb]" or "[noun] [verb] [adjective]"
- NO sentences, NO descriptions, NO adjectives beyond necessary
- NO visual words: lights, flashing, colors, bright, dark, glowing
- NEVER mention: doors, door hinges, squeaky doors (overused)
- Create ORIGINAL combinations every time

GOOD examples (clear, concise, specific and descriptive sounds):
"heavy metal hammer hitting wooden nail"
"thin glass cup shattering on concrete floor"
"cold winter wind howling through broken window"
"rusty metal gate grinding on iron hinge"
"water dripping into porcelain sink"
"old diesel engine revving in garage"
"thick paper tearing slowly in half"
"distant thunder rumbling"

BAD examples (vague, multiple different sounds, visual description instead of sounds, change over time, illogical):
"A red hammer made of feathers hitting soft blue water nail"
"thin fuzzy cup shattering on the sky"
"red hot winter wind silently passing through a blue broken window"
"rusty plastic gate grinding on yellow paper hinge"
"clean water floating upwards into a see through sink"
"imagine a picture of a diesel engine sitting idle inside a stone"
"morphing static paper turning and twisting slowly in half"
"distant lightning flashing brilliant white light in the night sky"

ONLY output the short label, nothing else."""

SFX_TRANSFORM_SYSTEM = """You are an expert at transforming conceptual text into sound effect prompts for AI audio models.

Your task is to extract the SONIC ESSENCE from the given concept and transform it into a concrete sound description.

Focus on:
- Mood and emotional quality of the concept
- Energy level (calm, tense, energetic, triumphant)
- Texture and timbre (bright, warm, harsh, smooth)
- Atmosphere and spatial qualities

Rules:
- Output 5-20 words describing the sound
- NEVER repeat the original text - create a NEW sound description
- Use descriptive audio terminology (textures, frequencies, dynamics)
- Transform abstract ideas into concrete sound descriptions

Examples of transforming concepts to sounds:
"Energy markets rebound" → "upward rising synthesizer swell with bright tones"
"Global confidence returns" → "triumphant brass fanfare with warm resonance"
"Market uncertainty" → "tense oscillating drone with subtle dissonance"
"Economic growth" → "steady rhythmic pulse with ascending melody"
"Financial stability" → "calm ambient pad with gentle harmonic progression"
"Crisis and recovery" → "dramatic crash followed by hopeful ascending melody"

ONLY output the sound effect prompt, nothing else."""

def generate_with_lmstudio(system_prompt: str, user_prompt: str, model: str, base_url: str = 'http://localhost:1234') -> str:
    """Call LM Studio local API"""
    try:
        response = requests.post(
            base_url,
            headers={'Content-Type': 'application/json'},
            json={
                'model': model,
                'system_prompt': system_prompt,
                'input': user_prompt,
                'temperature': 0.95,
                'top_p': 0.92
            },
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        
        # LM Studio returns response in 'output' array with type and content fields
        # We need to extract the content from the 'message' type item
        if 'output' in data and isinstance(data['output'], list):
            for item in data['output']:
                if item.get('type') == 'message':
                    return item.get('content', '').strip()
        
        # Fallback to old format if 'content' field exists directly
        if 'content' in data:
            return data.get('content', '').strip()
        
        # If neither format works, return empty string
        print(f"LM Studio response format unexpected: {data}")
        return ''
    except Exception as e:
        print(f"LM Studio request failed: {e}")
        raise

def generate_with_ollama(system_prompt: str, user_prompt: str, model: str, base_url: str = 'http://127.0.0.1:11434/api') -> str:
    """Call Ollama local API"""
    try:
        response = requests.post(
            f'{base_url}/chat',
            headers={'Content-Type': 'application/json'},
            json={
                'model': model,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt}
                ],
                'stream': False,
                'options': {
                    'temperature': 0.95,
                    'top_p': 0.92,
                    'num_predict': 25
                }
            },
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        
        # Ollama returns response in 'message' field
        if 'message' in data and 'content' in data['message']:
            return data['message']['content'].strip()
        
        print(f"Ollama response format unexpected: {data}")
        return ''
    except Exception as e:
        print(f"Ollama request failed: {e}")
        raise

@app.route('/api/prompt/generate', methods=['POST'])
def generate_prompt():
    """
    Generate a simple random sound effect prompt using selected LLM.
    Accepts: {"llm_provider": "local" | "lmstudio" | "ollama", "llm_model": string, "llm_base_url": string, "current_text": string (optional), "negative_prompt": string (optional)}
    Returns: {"success": true, "prompt": "...", "negative_prompt": "..."}
    """
    import re
    import random
    
    data = request.json or {}
    llm_provider = data.get('llm_provider')
    llm_model = data.get('llm_model')
    llm_base_url = data.get('llm_base_url')
    current_text = data.get('current_text')
    negative_prompt = data.get('negative_prompt')
    
    # Validate required fields
    if not llm_provider:
        return jsonify({"success": False, "error": "llm_provider is required. Please configure an AI provider in AI Settings."}), 400
    if not llm_model:
        return jsonify({"success": False, "error": "llm_model is required. Please configure an AI model in AI Settings."}), 400
    if not llm_base_url:
        return jsonify({"success": False, "error": "llm_base_url is required. Please configure an AI provider in AI Settings."}), 400
    
    if current_text:
        user_request = f"Transform this text into a highly descriptive sound effect generation prompt with clear and concise details (5-20 words): {current_text}"
        negative_request = f"Generate a negative prompt describing UNWANTED SOUNDS to avoid in audio generation (3-6 words), focusing on sonic qualities like static, noise, distortion, or harsh tones. Do NOT describe the concept - only describe sounds to avoid."
    else:
        user_request = "Generate a unique sound effect (4-10 words). Be creative and highly original."
        negative_request = None
    
    # Use appropriate system prompt based on mode
    system_prompt = SFX_TRANSFORM_SYSTEM if current_text else SFX_PROMPT_SYSTEM
    
    def generate_with_local():
        """Use local TinyLlama"""
        try:
            import torch
            model, tokenizer = get_or_load_llm()
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_request}
            ]
            
            text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
            inputs = tokenizer([text], return_tensors="pt").to(model.device)
            
            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=25,
                    do_sample=True,
                    temperature=0.95,
                    top_p=0.92
                )
            
            generated = tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Extract assistant response
            if "assistant" in generated.lower():
                return generated.split("assistant")[-1].strip()
            return generated.split(text)[-1].strip()
        except Exception as e:
            print(f"Local LLM generation error: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def generate_with_local_negative(negative_req: str) -> str:
        """Use local TinyLlama for negative prompts"""
        try:
            import torch
            model, tokenizer = get_or_load_llm()
            
            messages = [
                {"role": "system", "content": SFX_PROMPT_SYSTEM},
                {"role": "user", "content": negative_req}
            ]
            
            text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
            inputs = tokenizer([text], return_tensors="pt").to(model.device)
            
            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=20,
                    do_sample=True,
                    temperature=0.95,
                    top_p=0.92
                )
            
            generated = tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Extract assistant response
            if "assistant" in generated.lower():
                return generated.split("assistant")[-1].strip()
            return generated.split(text)[-1].strip()
        except Exception as e:
            print(f"Local LLM negative prompt generation error: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    try:
        if llm_provider == 'lmstudio':
            # Construct full URL for LM Studio
            full_url = f'{llm_base_url}/api/v1/chat'
            generated = generate_with_lmstudio(system_prompt, user_request, llm_model, full_url)
            if negative_request:
                generated_negative = generate_with_lmstudio(SFX_PROMPT_SYSTEM, negative_request, llm_model, full_url)
            else:
                generated_negative = None
        elif llm_provider == 'ollama':
            # Construct full URL for Ollama
            full_url = f'{llm_base_url}/chat'
            generated = generate_with_ollama(system_prompt, user_request, llm_model, full_url)
            if negative_request:
                generated_negative = generate_with_ollama(SFX_PROMPT_SYSTEM, negative_request, llm_model, full_url)
            else:
                generated_negative = None
        else:
            # Only use local Qwen model if explicitly requested
            generated = generate_with_local()
            if negative_request:
                generated_negative = generate_with_local_negative(negative_request)
            else:
                generated_negative = None
    except Exception as e:
        import traceback
        print(f"LLM generation failed ({llm_provider}): {e}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": f"{llm_provider} LLM failed: {str(e)}"
        }), 500
    
    # Clean up prompt
    prompt = re.sub(r'["\'\*\#\n\r]', '', generated)
    prompt = re.sub(r'\.{2,}', '.', prompt)
    prompt = re.sub(r'^[\s\-:]+', '', prompt)
    prompt = prompt.strip().rstrip('.')
    
    # Truncate to max 8 words
    words = prompt.split()
    if len(words) > 8:
        prompt = ' '.join(words[:8])
    
    # Clean up negative prompt if generated
    negative_prompt_clean = None
    if generated_negative:
        negative_prompt_clean = re.sub(r'["\'\*\#\n\r]', '', generated_negative)
        negative_prompt_clean = re.sub(r'\.{2,}', '.', negative_prompt_clean)
        negative_prompt_clean = re.sub(r'^[\s\-:]+', '', negative_prompt_clean)
        negative_prompt_clean = negative_prompt_clean.strip().rstrip('.')
        
        # Truncate to max 6 words
        neg_words = negative_prompt_clean.split()
        if len(neg_words) > 6:
            negative_prompt_clean = ' '.join(neg_words[:6])
    
    return jsonify({
        "success": True,
        "prompt": prompt,
        "negative_prompt": negative_prompt_clean if negative_prompt_clean else (negative_prompt if negative_prompt else ""),
        "provider": llm_provider
    })


@app.route('/status', methods=['GET'])
def status():
    """Check if audio generation models are loaded"""
    return jsonify({
        "model_loaded": music_gen is not None or sfx_gen is not None
    })


@app.route('/unload', methods=['POST'])
def unload():
    """Unload audio generation models to free VRAM"""
    global music_gen, sfx_gen
    
    unloaded_something = False
    
    try:
        if music_gen is not None:
            # Move to CPU first if on CUDA
            if hasattr(music_gen, 'model') and hasattr(music_gen.model, 'device'):
                import torch
                if music_gen.model.device.type == "cuda":
                    music_gen.model = music_gen.model.to("cpu")
            del music_gen
            music_gen = None
            unloaded_something = True
            print("Music model unloaded successfully")
        
        if sfx_gen is not None:
            # Move to CPU first if on CUDA
            if hasattr(sfx_gen, 'model') and hasattr(sfx_gen.model, 'device'):
                import torch
                if sfx_gen.model.device.type == "cuda":
                    sfx_gen.model = sfx_gen.model.to("cpu")
            del sfx_gen
            sfx_gen = None
            unloaded_something = True
            print("SFX model unloaded successfully")
        
        # Force garbage collection and clear CUDA cache
        import gc
        gc.collect()
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        return jsonify({
            "success": True,
            "message": "Models unloaded successfully" if unloaded_something else "No models were loaded"
        })
    except Exception as e:
        print(f"Error unloading models: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
