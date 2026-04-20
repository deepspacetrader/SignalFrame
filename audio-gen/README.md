# Audio Generator Backend

AI-powered audio generation API using MusicGen for music and MMAudio for sound effects.

## Features

- **Music Generation**: Facebook's MusicGen model for text-to-music
- **SFX Generation**: MMAudio model for text-to-sound effects
- **GPU Accelerated**: CUDA support for fast generation
- **REST API**: Flask-based API for frontend integration
- **Progress Tracking**: Real-time generation status

## Quick Start

### 1. Setup Environment

```bash
cd d:\htdocs\my-audio-generator\backend
source activate audio
unset SSL_CERT_FILE
python api_server.py
```

### 2. Start Frontend (separate terminal)

```bash
cd d:\htdocs\my-audio-generator\frontend
bun dev
```

## Dependencies

Install all requirements:

```bash
pip install -r requirements.txt
```

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `torch` | PyTorch for model inference |
| `torchaudio` | Audio processing |
| `torchvision` | Vision utilities for MMAudio |
| `torchdiffeq` | Flow matching for MMAudio |
| `transformers` | Hugging Face MusicGen model |
| `open_clip_torch` | CLIP for MMAudio text encoding |
| `scipy` | WAV file I/O |
| `flask` | Web server |
| `flask-cors` | CORS support |

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
HF_TOKEN=your_huggingface_token_here
HF_HUB_OFFLINE=1  # Optional: use only cached models
```

**Note**: First run requires internet to download CLIP and BigVGAN models. Subsequent runs can use `HF_HUB_OFFLINE=1`.

### GPU Requirements

- **Minimum**: NVIDIA GPU with 8GB VRAM
- **Recommended**: RTX 4070 SUPER or better with 12GB+ VRAM
- **Fallback**: CPU (very slow)

Verify CUDA:
```bash
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}')"
```

## API Endpoints

### Music Generation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/music/params` | GET | Get current parameters |
| `/api/music/params` | POST | Set parameters (duration, sampling_rate, text) |
| `/api/music/generate` | POST | Generate music from text prompt |

**Example:**
```bash
curl -X POST http://localhost:5000/api/music/generate \
  -H "Content-Type: application/json" \
  -d '{"text":"deep bassy techno beat","duration":5}'
```

### SFX Generation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sfx/params` | GET | Get current parameters |
| `/api/sfx/params` | POST | Set parameters (duration, cfg_strength, num_steps, seed, text, negative_prompt, variant) |
| `/api/sfx/generate` | POST | Generate sound effect from text prompt |

**Example:**
```bash
curl -X POST http://localhost:5000/api/sfx/generate \
  -H "Content-Type: application/json" \
  -d '{"text":"explosion with debris","duration":8,"seed":42}'
```

### File Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/music/files` | GET | List all generated music files |
| `/api/sfx/files` | GET | List all generated SFX files with metadata |
| `/api/status` | GET | Get current generation status |
| `/music/<filename>` | GET | Serve music file |
| `/sfx/<filename>` | GET | Serve SFX file |

## Models

### MusicGen (Music)
- **Model**: `facebook/musicgen-medium`
- **Purpose**: Text-to-music generation
- **Output**: 32kHz WAV files
- **VRAM**: ~4GB during inference

### MMAudio (SFX)
- **Model**: `hkchengrex/MMAudio` (large_44k_v2)
- **Purpose**: Text-to-sound effects
- **Components**:
  - CLIP: `apple/DFN5B-CLIP-ViT-H-14-384` (text encoder)
  - BigVGAN: `nvidia/bigvgan_v2_44khz_128band_512x` (vocoder)
- **Output**: 44.1kHz WAV files
- **VRAM**: ~8-10GB during inference

## Troubleshooting

### SSL Certificate Error
```bash
unset SSL_CERT_FILE  # Git Bash
# OR
set SSL_CERT_FILE=   # CMD
# OR
$env:SSL_CERT_FILE=""  # PowerShell
```

### CUDA Not Available
```bash
pip uninstall torch torchvision torchaudio
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### Conda Activation Loop
Use `source activate audio` instead of `conda activate audio` in Git Bash.

### Slow Generation
- Check GPU: `python -c "import torch; print(torch.cuda.is_available())"`
- Reduce SFX `num_steps` (default 25, try 15)
- Reduce duration for initial tests

## Project Structure

```
backend/
├── api_server.py      # Flask API server
├── music_gen.py       # MusicGen wrapper
├── sfx_gen2.py        # MMAudio wrapper
├── requirements.txt   # Python dependencies
├── MMAudio/          # MMAudio library (local)
└── README.md         # This file
```

## Credits

- [MMAudio](https://github.com/hkchengrex/MMAudio) - Sound effect generation
- [MusicGen](https://huggingface.co/facebook/musicgen-large) - Music generation
- [BigVGAN](https://huggingface.co/nvidia/bigvgan_v2_44khz_128band_512x) - Audio vocoder
- [DFN5B-CLIP](https://huggingface.co/apple/DFN5B-CLIP-ViT-H-14-384) - Text encoder