# 📡 SignalFrame v0.3.0
**The Local-First Situation Awareness Framework**

SignalFrame is an intelligence dashboard designed to transform raw feeds into situational awareness. It moves beyond traditional "dashboards" by using AI to generate narratives, identify critical key insights, and maintain a list of changes overtime all running locally for FREE on your own hardware.

---

## ⚡ Key Features

### 🧠 Triple-Layer AI Synthesis
SignalFrame reasons across three distinct layers:
- **Current Narrative**: A high-level briefing on the primary global shift occurring in the current feed.
- **Key Signals**: Precise identification of what has fundamentally changed or escalated in the last 24 hours.
- **Hidden Insights**: Discovery of second-order effects and trends that are often missed by traditional news cycles.

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

### 1. Requirements
- **Node.js** ≥ 18
- **[Ollama](https://ollama.com/)** running locally (Port 11434)
- **GPU (Recommended)**: NVIDIA RTX 3060/4060 or better for smooth 7B-14B model performance.

### 2. Prepare AI Models
We recommend **Qwen 2.5 (7B)** or **Llama 3.2 (3B)** for the best balance of speed and JSON accuracy.

```bash
# Recommended models
ollama pull qwen2.5:7b
ollama pull llama3.2
```

### 3. Launch SignalFrame
```bash
git clone https://github.com/your-repo/signalframe
cd signalframe
npm install
npm run dev
```

Visit `http://localhost:5173` to initiate your first **Broad Spectrum Scan**.

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

## 🤝 Roadmap
- [x] IndexedDB Daily Persistence
- [x] Streaming AI Responses
- [x] Historic Date Navigation
- [ ] Multi-Source PDF/Document Ingest
- [ ] Cross-Day Trend Charting
- [ ] "Deep Dive" specific signal investigation

---
© 2026 DeepSpaceTrader • Experimental Intelligence Framework. Built for those who need to know what's next.
