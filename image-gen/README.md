# Local Infinity

Ultra-fast infinite scroll feed powered by local AI.

## Prerequisites
- [Bun](https://bun.sh) (recommended) or Node.js
- [LM Studio](https://lmstudio.ai/) running on localhost:1234

## Setup & Run
1. **Install Dependencies**:
   ```bash
   bun install
   ```

2. **Start Everything**:
   ```bash
   bun dev
   ```

3. **Navigate to**: `http://localhost:5173`

## Configuration
- **Backend**: Configure `server/index.ts` to point to your specific LM Studio model name if needed.
- **Speed**: The system is tuned for speed over length. Prompts are kept short and models should be small/quantized for best results.
