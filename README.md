# 📡 SignalFrame v0.7.0
**Experimental Personalized Intelligent News Analyzer**

SignalFrame is an intelligence dashboard designed to transform raw feeds into situational awareness. It uses AI to generate the current narrative, identify key signals, provides short term predictions and maintains a record of ongoing changes overtime based on your political beliefs all while running locally on your own hardware for FREE.

### SignalFrame is built for those who need to know what's next.

---

## ⚡ Key Features

### 🧠 Quad-Layer AI Synthesis
SignalFrame reasons across four distinct layers:
- **Current Narrative**: A high-level briefing on the primary global shift occurring in the current feed.
- **Signals**: Precise identification of what has fundamentally changed or escalated in the last 24 hours.
- **Insights**: Discovery of second-order effects and trends that are often missed by traditional news cycles.
- **Big Picture**: Consolidation of ongoing changes overtime summarized into a comprehensive report.

### ⏱️ Intelligence Timeline (IndexedDB)
SignalFrame maintains a persistent **Intelligence Timeline** stored directly inside the browser.
- **Daily Snapshots**: Every scan is recorded into a high-capacity local IndexedDB.
- **Historic Browsing**: Use the built-in navigation bar to view past events.
- **Trend Accumulation**: Build a library of historical states for future long-term trend identification.

### 🎯 Personalized Sentiment Analysis
AI-generated content is automatically tagged and scored based on **your political perspective**. Choose from five sentiment profiles—**Far Left**, **Progressive**, **Balanced**, **Conservative**, or **Far Right**—each with custom weightings and analytical guidelines that shape how events are interpreted and prioritized.
- **Weighted Scoring System**: Each profile applies different numerical weights to sentiment categories (extremely-negative through very-positive), fundamentally changing how events are ranked.
- **Ideological Guidelines**: Built-in analytical frameworks ensure the AI evaluates news through your chosen lens—from revolutionary anti-capitalist analysis to nationalist sovereignty prioritization.
- **Dynamic Re-tagging**: Switch profiles anytime to see how the same news events are reinterpreted through different political frameworks.

### 🤝 Foreign Relation Trackers
Define custom "trackers" for specific geopolitical or corporate rivalries. SignalFrame will automatically look for updates on these specific relations during every scan across time.

### 🗺️ Geospatial Intelligence
Automatically triangulates events and renders them onto an interactive map with sentiment analysis and categorical filtering.

### 🔌 Local AI Engine (Ollama or LM Studio)
Full integration with local Large Language Models for 100% data privacy and no API costs! The only limit is your own hardware.
- **Streaming Responses**: Watch the AI "think" in real-time as narratives stream into the UI.
- **Runtime Configuration**: Hot-swap models and adjust context parameters directly from the dashboard.
- **Structured JSON Outputs**: Robust parsing engine with auto-repair logic for reliable data representation.


---

## 🛠️ Architecture

```
src/
├─ ai/
│  └─ runtime/        # AI processing engines
│     ├─ engine.ts          # Core reasoning & synthesis engine
│     ├─ ollama.ts          # Streaming Ollama bridge & JSON repair
│     └─ sentimentEngine.ts # Sentiment analysis
├─ services/
│  ├─ db.ts           # IndexedDB high-capacity daily persistence
│  └─ feedIngest.ts   # Real-world signal & feed harvesting
├─ state/
│  └─ useSituationStore.ts # Global state management
├─ components/        # React UI components
├─ utils/
│  ├─ timeUtils.ts    # Time formatting and utilities
│  └─ zzfx.ts         # Audio effects engine
├─ data/              # Static data and configuration
├─ images/            # Static image assets
└─ App.tsx            # Core orchestration layer
```

---

## 🚀 Quick Start

### 1. Install Ollama or LM Studio (Required)

SignalFrame requires a local AI backend. Choose one of the following:

---

# Option A - [Ollama](http://ollama.com/) #
(*Recommended for Beginners*)

**[Ollama](http://ollama.com/)** is an easy-to-use local AI model manager with a simple CLI and broad model support.

| Platform | Installation |
|----------|-------------|
| **Windows** | 1. Download installer from [ollama.com/download/windows](https://ollama.com/download/windows)<br>2. Run the installer and follow prompts<br>3. Ollama starts automatically (system tray icon) |
| **macOS** | 1. Download from [ollama.com/download/mac](https://ollama.com/download/mac)<br>2. Drag Ollama to Applications folder<br>3. Launch from Applications or Spotlight |
| **Linux** | 
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Verify Installation:**
```bash
ollama --version
```

---

# Option B - [LM Studio](https://lmstudio.ai/) #
(*Recommended for Power Users*)

**[LM Studio](https://lmstudio.ai/)** is a highly configurable GUI-based local AI model manager with advanced settings.

| Platform | Installation |
|----------|-------------|
| **Windows** | 1. Download from [lmstudio.ai/download](https://lmstudio.ai/download)<br>2. Run the `.exe` installer<br>3. Launch from Start menu |
| **macOS** | 1. Download from [lmstudio.ai/download](https://lmstudio.ai/download)<br>2. Drag to Applications folder<br>3. Launch from Applications (may require right-click → Open for first run) |
| **Linux** | 1. Download `.AppImage` from [lmstudio.ai/download](https://lmstudio.ai/download)<br>2. Make executable: `chmod +x LM_Studio-*.AppImage`<br>3. Run: `./LM_Studio-*.AppImage` |

**LM Studio Setup for SignalFrame:**
1. Open LM Studio
2. Download a model from the Model Search tab (e.g., `deepseek-r1` or `qwen3`)
3. Go to **Developer** tab → **Local Inference Server**
4. Click **Start Server** (ensure port 1234 is used)
5. Keep LM Studio running while using SignalFrame

### 2. Verify Your AI Backend is Running

#### For Ollama:
```bash
ollama list
```

If you see an error like "Error: connect ECONNREFUSED 127.0.0.1:11434", Ollama is not running. See troubleshooting below.

#### For LM Studio:
1. Open LM Studio
2. Go to **Developer** → **Local Inference Server**
3. Ensure the server shows **Running** on port 1234
4. Test the endpoint: `curl http://localhost:1234/v1/models` (should return model list)

### 3. Download an AI Model

SignalFrame needs at least one model to function. Thinking models provide better quality results but require more resources. Recommend picking from these ones:

```bash
# Thinking model with high quality results (Recommended)
ollama pull deepseek-r1:8b

# Thinking model with good results (Alternative)
ollama pull qwen3:8b
```

### 4. System Requirements

- **Node.js** ≥ 18
- **Ollama** running locally (Port 11434)
- **GPU (Recommended)**: NVIDIA RTX 3060/4060 or better for fastest 8B-14B model performance
- **Storage**: Min 10GB+ free space for models

### 5. Initialize Git Submodules

SignalFrame uses git submodules for audio generation and NVIDIA TTS functionality:

```bash
git submodule init
git submodule update --remote --recursive
```

This will set up:
- `audio-gen/backend/MMAudio` - Audio generation models
- `python-clients` - NVIDIA Riva Speech AI clients

### 6. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

For NVIDIA TTS functionality (optional), add your NVIDIA API key:
```
VITE_NVIDIA_KEY=your_nvidia_api_key_here
```

Get your **FREE** NVIDIA API key from [https://build.nvidia.com/](https://build.nvidia.com/)

### 7. Launch SignalFrame
```bash
git clone https://github.com/deepspacetrader/signalframe
cd signalframe
npm install
npm run dev
```

or if you prefer using bun

```bash
git clone https://github.com/deepspacetrader/signalframe
cd signalframe
bun i
bun dev
```



Visit `http://localhost:5173` click on AI Settings and set accordingly then click on Scan With AI.

### 🔧 Troubleshooting

#### Ollama Issues

**Connection Error: "Error: connect ECONNREFUSED 127.0.0.1:11434"**

| Platform | Solution |
|----------|----------|
| **Windows** | 1. Check system tray for Ollama icon<br>2. If missing, search "Ollama" in Start menu and launch<br>3. Check Windows Defender/Firewall isn't blocking port 11434 |
| **macOS** | 1. Launch from Applications or run: `ollama serve`<br>2. If "command not found", ensure `/usr/local/bin` is in PATH:<br>   `export PATH=$PATH:/usr/local/bin` |
| **Linux** | 1. Run: `ollama serve` (starts the server)<br>2. For systemd: `sudo systemctl start ollama`<br>3. Check service status: `sudo systemctl status ollama` |

---

**Ollama: Slow Model Responses (>30 seconds)**

Run diagnostics while SignalFrame is processing:
```bash
ollama ps
```

| Output | Meaning | Solution |
|--------|---------|----------|
| 100% GPU | Model running on GPU | Normal, check GPU utilization |
| GPU/CPU split | Model partially offloaded to CPU | Reduce context size in SignalFrame settings or use smaller model |
| 100% CPU | Model running entirely on CPU | GPU not detected; install CUDA drivers (NVIDIA) or ROCm (AMD) |

**Quick fixes:**
- Use smaller models
- Close GPU-intensive apps (games, video editors)
- Reduce `num_ctx` in SignalFrame settings (default 25000 → try 8000)

---

**Ollama: Out of Memory / CUDA Errors**

1. **Immediate fix**: Use a smaller model
2. **Adjust context window** in SignalFrame AI settings
3. **Kill zombie processes**: `ollama stop <model_name>` or `pkill ollama`
4. **Restart Ollama** to clear VRAM

---

#### LM Studio Issues

**LM Studio: "Connection refused" or Cannot Connect**

| Issue | Solution |
|-------|----------|
| Server not running | Open LM Studio → Developer → Click "Start Server" |
| Wrong port | Ensure server runs on port 1234 (default) |
| Firewall blocking | Allow LM Studio through Windows Defender/macOS Firewall |
| Linux AppImage | Ensure the AppImage has network permissions; try running with `--no-sandbox` |

---

**LM Studio: Model Loads but No Response**

1. Check model is loaded in LM Studio's **Chat** tab
2. Verify GPU offload settings:
   - Go to **Settings** → **GPU Offload**
   - Increase GPU layers (try max first, reduce if OOM)
3. Try CPU-only mode if GPU issues persist
4. Check LM Studio logs: **Help** → **Logs**

---

**LM Studio: Port Already in Use (Linux/macOS)**

```bash
# Find process using port 1234
lsof -i :1234
# Kill the process
kill -9 <PID>
# Or use a different port in LM Studio and update SignalFrame settings
```

---

#### General Issues

**SignalFrame Can't Connect to Either Backend**

1. Verify backend is actually running (see Step 2)
2. Check browser console (F12 → Console) for CORS errors
3. Ensure no VPN/proxy is blocking localhost connections
4. Try refreshing SignalFrame page after starting backend

---

**Models Download but Won't Load**

| Cause | Solution |
|-------|----------|
| Insufficient disk space | Free up disk space |
| Corrupted download | Re-pull: `ollama pull <model>` or re-download in LM Studio |
| Incompatible architecture | Ensure model matches your architecture (ARM vs x86) |

---

## ⚙️ Configuration
Access the **AI Engine Parameters** (gear icon) to:
- Change the target model name.
- Adjust `num_ctx` (default 25000) for larger document processing.
- Tune `num_predict` for longer narrative generations.

---

## 🛡️ Privacy & Security
SignalFrame is **Local-By-Design**.
- **No data** is ever sent to external APIs (OpenAI, Anthropic, etc.).
- **No telemetry** or tracking.
- Your Intelligence Timeline is stored in your browser's local sandbox, never synced to any cloud.

---

Made by [DeepSpaceTrader](https://github.com/deepspacetrader) • Experimental Intelligence Framework. Built for those who need to know what's next.
