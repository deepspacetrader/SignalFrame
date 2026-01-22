# 📡 SignalFrame v0.4.0
**The Local-First Situation Awareness Framework**

SignalFrame is an intelligence dashboard designed to transform raw feeds into situational awareness. It moves beyond traditional "dashboards" by using AI to generate narratives, identify critical key insights, and maintain a list of changes overtime all running locally for FREE on your own hardware.

---

## Demo Website

A demo website is available at https://deepspacetrader.github.io/signalframe/


## ⚡ Key Features

### 🧠 Triple-Layer AI Synthesis
SignalFrame reasons across three distinct layers:
- **Current Narrative**: A high-level briefing on the primary global shift occurring in the current feed.
- **Signals**: Precise identification of what has fundamentally changed or escalated in the last 24 hours.
- **Insights**: Discovery of second-order effects and trends that are often missed by traditional news cycles.

### ⏱️ Intelligence Timeline (IndexedDB)
SignalFrame maintains a persistent **Intelligence Timeline**:
- **Daily Snapshots**: Every scan is recorded into a high-capacity local IndexedDB.
- **Historic Browsing**: Use the built-in navigation bar to view past events.
- **Trend Accumulation**: Build a library of historical states for future long-term trend identification.

### 🔌 Local AI Engine (Ollama)
Full integration with local Large Language Models for 100% data privacy and no API costs! The only limit is your own hardware.
- **Streaming Responses**: Watch the AI "think" in real-time as narratives stream into the UI.
- **Runtime Configuration**: Hot-swap models (Llama 3.2, Mistral, Qwen 2.5) and adjust context parameters directly from the dashboard.
- **Structured JSON Outputs**: Robust parsing engine with auto-repair logic for reliable data representation.

### 🗺️ Geospatial Intelligence
Automatically triangulates events and renders them onto an interactive map with sentiment analysis and categorical filtering.

### 🤝 Foreign Relation Trackers
Define custom "trackers" for specific geopolitical or corporate rivalries. SignalFrame will automatically look for updates on these specific relations during every scan across time.

---

## 🛠️ Architecture

```
src/
├─ ai/
│  ├─ runtime/   # Streaming Ollama bridge & JSON repair logic
│  └─ engine.ts  # Multi-pass reasoning prompts & synthesis
├─ services/
│  ├─ db.ts      # IndexedDB high-capacity daily persistence
│  └─ ingest.ts  # Real-world signal & feed harvesting
├─ state/        # Zustand timeline & global config store
├─ components/   # High-performance React UI components
└─ App.tsx       # Core orchestration layer
```

---

## 🚀 Quick Start

### 1. Install Ollama (Required)

SignalFrame requires **Ollama** to be installed and running on your local machine. Ollama is the local AI engine that powers all intelligence synthesis.

#### Windows:
1. Download Ollama from [https://ollama.com/download/windows](https://ollama.com/download/windows)
2. Run the installer and follow the setup wizard
3. Ollama will automatically start and run in the background

#### macOS:
1. Download Ollama from [https://ollama.com/download/mac](https://ollama.com/download/mac)
2. Open the downloaded DMG file and drag Ollama to Applications
3. Launch Ollama from your Applications folder

#### Linux:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Verify Ollama is Running

Open your terminal or command prompt and run:
```bash
ollama list
```

If you see an error like "Error: connect ECONNREFUSED 127.0.0.1:11434", Ollama is not running. Restart it or check the installation.

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
- **RAM**: Minimum 8GB, recommended 16GB+
- **GPU (Recommended)**: NVIDIA RTX 3060/4060 or better for smooth 7B-14B model performance
- **Storage**: 2GB+ free space for models

### 5. Launch SignalFrame
```bash
git clone https://github.com/your-repo/signalframe
cd signalframe
npm install
npm run dev
```

Visit `http://localhost:5173` to initiate your first **Broad Spectrum Scan**.

### 🔧 Troubleshooting Ollama

**Problem**: "Ollama not found" or connection errors
**Solution**: 
- Ensure Ollama is installed and running
- Check that Ollama is accessible at `http://localhost:11434`
- Restart Ollama: `ollama serve` (Linux/macOS) or restart the Ollama application (Windows)

**Problem**: Model responses are very slow
**Solution**:
- Check if you have a compatible GPU for acceleration
- Try a smaller model like `llama3.2` instead of 7B models
- Close other applications using GPU/RAM resources

**Problem**: Out of memory errors
**Solution**:
- Use smaller models (`llama3.2` instead of `qwen2.5:7b`)
- Increase system RAM or close memory-intensive applications
- Adjust AI parameters in the app settings (reduce context window)

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

© 2026 DeepSpaceTrader • Experimental Intelligence Framework. Built for those who need to know what's next.
