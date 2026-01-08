# SignalFrame

**SignalFrame** is a calm, local-first situational awareness system designed to help you understand *what matters* in breaking news and complex events—without overwhelming you.

Instead of raw feeds and constant alerts, SignalFrame uses AI-assisted reasoning to compress reality into:
- A clear **narrative summary**
- A small set of **meaningful signals** (what changed)
- A dedicated **“What You Might Be Missing”** insight layer

The goal is not more information—but better understanding.

---

## Core Principles

- **Signal over noise**  
  Only meaningful changes are surfaced.
- **Narrative first**  
  Users see *what’s going on* before any raw data.
- **Local-first AI**  
  Designed to integrate with locally hosted models running on your GPU.
- **Calm by default**  
  No dashboards, no firehoses, no panic UI.
- **Modular & extensible**  
  Feed ingest, AI reasoning, and UI are cleanly separated.

---

## Architecture Overview
```
src/
├─ ai/
│ ├─ prompts/ # AI prompts (narrative, signals, insights)
│ └─ runtime/ # AI execution layer (local model hooks)
├─ components/ # UI components
├─ state/ # Central situation state
├─ services/ # Future ingest & persistence
├─ App.tsx # Top-level composition
└─ main.tsx # React entry point
```

### AI Reasoning Layers

SignalFrame intentionally separates AI reasoning into three passes:

1. **Narrative**  
   > “What is happening right now?”

2. **Signals**  
   > “What changed or escalated?”

3. **Insights**  
   > “What might most people be missing?”

This separation makes the system more debuggable, trustworthy, and extensible.

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18  
- **npm** (comes with Node)
- (Optional) A locally hosted AI model for later integration

---

### Install Dependencies

From the project root:

```bash
npm install
npm run dev
```

http://localhost:5173

```bash
npm run build
npm run preview
```
