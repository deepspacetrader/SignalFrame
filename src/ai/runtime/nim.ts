export interface NimOptions {
  max_tokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  timeout?: number; // Request timeout in milliseconds
}

export interface NimMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type NimModelCategory = 'reasoning' | 'chat' | 'code' | 'math';

export interface NimModelInfo {
  id: string;
  name: string;
  description: string;
  category: NimModelCategory;
  family: string;
  sizeB: number;
  released: string;
}

const NIM_MODELS: NimModelInfo[] = [
  { id: 'moonshotai/kimi-k2.6', name: 'Kimi K2.6', description: '1T multimodal MoE for agentic tool use and reasoning', category: 'reasoning', family: 'Kimi', sizeB: 1000, released: '2025-07' },
  { id: 'deepseek-ai/deepseek-v4-flash', name: 'DeepSeek V4 Flash', description: '284B MoE, 1M context, optimized for fast coding and agents', category: 'reasoning', family: 'DeepSeek', sizeB: 284, released: '2025-07' },
  { id: 'deepseek-ai/deepseek-v4-pro', name: 'DeepSeek V4 Pro', description: '1M context MoE for deep coding and reasoning tasks', category: 'reasoning', family: 'DeepSeek', sizeB: 1000, released: '2025-07' },
  { id: 'z-ai/glm-5.1', name: 'GLM-5.1', description: 'Flagship LLM for agentic workflows and long-horizon reasoning', category: 'reasoning', family: 'GLM', sizeB: 325, released: '2025-07' },
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', name: 'Nemotron 3 Nano Omni 30B', description: 'Omni-modal reasoning (image, video, speech, text)', category: 'reasoning', family: 'Nemotron', sizeB: 30, released: '2025-06' },
  { id: 'google/gemma-4-31b-it', name: 'Gemma 4 31B IT', description: 'Dense 31B frontier reasoning for coding and agentic workflows', category: 'reasoning', family: 'Gemma', sizeB: 31, released: '2025-06' },
  { id: 'minimaxai/minimax-m2.7', name: 'MiniMax M2.7', description: '230B model excelling in coding, reasoning, and office tasks', category: 'reasoning', family: 'MiniMax', sizeB: 230, released: '2025-06' },
  { id: 'nvidia/nemotron-3-super-120b-a12b', name: 'Nemotron 3 Super 120B', description: 'Hybrid Mamba-Transformer MoE, 1M context, agentic reasoning', category: 'reasoning', family: 'Nemotron', sizeB: 120, released: '2025-05' },
  { id: 'mistralai/mistral-medium-3.5-128b', name: 'Mistral Medium 3.5 128B', description: 'High performing model for generation, coding and agentic use', category: 'reasoning', family: 'Mistral', sizeB: 128, released: '2025-05' },
  { id: 'mistralai/mistral-small-4-119b-2603', name: 'Mistral Small 4 119B', description: 'Hybrid MoE, 256k context, unifying instruct, reasoning and coding', category: 'reasoning', family: 'Mistral', sizeB: 119, released: '2025-04' },
];

export const NIM_AVAILABLE_MODELS = NIM_MODELS;

export function getNimModelDefaults(): { model: string; baseUrl: string } {
  return {
    model: 'deepseek-ai/deepseek-v4-flash', // Use faster flash model by default to avoid timeouts
    baseUrl: 'https://integrate.api.nvidia.com/v1'
  };
}

const NIM_PROXY_PREFIX = '/api/nim';

function getEffectiveBaseUrl(): string {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `${window.location.origin}${NIM_PROXY_PREFIX}`;
  }
  return NimService.getBaseUrl();
}

export class NimService {
  private static baseUrl = 'https://integrate.api.nvidia.com/v1';
  private static apiKey: string = import.meta.env.VITE_NVIDIA_AI_MODEL_KEY || import.meta.env.VITE_NVIDIA_KEY || '';

  static setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  static getBaseUrl(): string {
    return this.baseUrl;
  }

  static setApiKey(key: string) {
    this.apiKey = key;
  }

  static getApiKey(): string {
    return this.apiKey;
  }

static async chat(
        model: string,
        messages: NimMessage[],
        format?: 'json',
        options: NimOptions = {}
    ): Promise<string> {
        const baseUrl = getEffectiveBaseUrl();
        const url = `${baseUrl}/chat/completions`;
    const body: any = {
      model: model,
      messages: messages,
      temperature: options.temperature ?? 0,
      max_tokens: options.max_tokens || 16384,
    };
    if (format === 'json') {
      body.response_format = { type: 'json_object' };
    }

    // Create timeout controller if timeout is specified
    const timeoutMs = options.timeout || 120000; // Default 120 seconds
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      // Combine with existing signal if provided
      const combinedSignal = options.signal
        ? (() => {
            const combinedController = new AbortController();
            options.signal!.addEventListener('abort', () => combinedController.abort());
            timeoutController.signal.addEventListener('abort', () => combinedController.abort());
            return combinedController.signal;
          })()
        : timeoutController.signal;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: combinedSignal,
        body: JSON.stringify(body),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NVIDIA NIM error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Check if it was a timeout or user cancellation
        if (timeoutController.signal.aborted && (!options.signal || !options.signal.aborted)) {
          console.log('NIM chat timed out after', timeoutMs, 'ms');
          throw new Error(`Request timed out after ${timeoutMs / 1000} seconds`);
        }
        console.log('NIM chat cancelled');
        throw new Error('Chat cancelled');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async generate(
    model: string,
    prompt: string,
    systemPrompt?: string,
    format?: 'json',
    options: NimOptions = {}
  ): Promise<string> {
    const messages: NimMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    return this.chat(model, messages, format, options);
  }

static async streamChat(
        model: string,
        messages: NimMessage[],
        onChunk: (text: string) => void,
        options: NimOptions = {}
    ): Promise<void> {
        const baseUrl = getEffectiveBaseUrl();
        const url = `${baseUrl}/chat/completions`;
    const body: any = {
      model: model,
      messages: messages,
      temperature: options.temperature ?? 0,
      max_tokens: options.max_tokens || 16384,
      stream: true,
    };

    // Create timeout controller if timeout is specified
    const timeoutMs = options.timeout || 300000; // Default 300 seconds for streaming
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      // Combine with existing signal if provided
      const combinedSignal = options.signal
        ? (() => {
            const combinedController = new AbortController();
            options.signal!.addEventListener('abort', () => combinedController.abort());
            timeoutController.signal.addEventListener('abort', () => combinedController.abort());
            return combinedController.signal;
          })()
        : timeoutController.signal;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: combinedSignal,
        body: JSON.stringify(body),
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`NVIDIA NIM stream error: ${response.statusText}`);
      if (!response.body) throw new Error('NVIDIA NIM stream body is null');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          let jsonLine = line;
          if (line.startsWith('data: ')) {
            jsonLine = line.slice(6);
          }
          if (jsonLine === '[DONE]') continue;

          try {
            const json = JSON.parse(jsonLine);
            if (json.choices && json.choices[0]?.delta?.content) {
              onChunk(json.choices[0].delta.content);
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Check if it was a timeout or user cancellation
        if (timeoutController.signal.aborted && (!options.signal || !options.signal.aborted)) {
          console.log('NIM streaming timed out after', timeoutMs, 'ms');
          throw new Error(`Streaming request timed out after ${timeoutMs / 1000} seconds`);
        }
        console.log('NVIDIA NIM streaming cancelled');
        throw new Error('Streaming cancelled');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async streamGenerate(
    model: string,
    prompt: string,
    onChunk: (text: string) => void,
    systemPrompt?: string,
    options: NimOptions = {}
  ): Promise<void> {
    const messages: NimMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    return this.streamChat(model, messages, onChunk, options);
  }

  static async generateWithThinking(
    model: string,
    prompt: string,
    systemPrompt?: string,
    options: NimOptions = {}
  ): Promise<{ response: string; thinking?: string }> {
    const response = await this.generate(model, prompt, systemPrompt, undefined, options);
    let thinking = '';
    let finalResponse = response;
    if (response.includes('<think>') && response.includes('</think>')) {
      const parts = response.split('</think>');
      thinking = parts[0].replace('<think>', '').trim();
      finalResponse = parts.slice(1).join('').trim();
    } else if (response.includes('<thinking>') && response.includes('</thinking>')) {
      const parts = response.split('</thinking>');
      thinking = parts[0].replace('<thinking>', '').trim();
      finalResponse = parts.slice(1).join('').trim();
    }
    return { response: finalResponse, thinking };
  }

  static async streamGenerateWithThinking(
    model: string,
    prompt: string,
    onThinking: (text: string) => void,
    onContent: (text: string) => void,
    systemPrompt?: string,
    options: NimOptions = {}
  ): Promise<void> {
    let isThinking = false;
    let buffer = '';

    await this.streamGenerate(model, prompt, (chunk) => {
      buffer += chunk;
      if (!isThinking && (buffer.includes('<think>') || buffer.includes('<thinking>'))) {
        isThinking = true;
        const thinkTag = buffer.includes('<think>') ? '<think>' : '<thinking>';
        const thinkIndex = buffer.indexOf(thinkTag);
        if (thinkIndex > 0) onContent(buffer.substring(0, thinkIndex));
        buffer = buffer.substring(thinkIndex + thinkTag.length);
      }

      if (isThinking) {
        const endTag = '</think>';
        const endTagAlt = '</thinking>';
        const endIdx = buffer.indexOf(endTag);
        const endIdxAlt = buffer.indexOf(endTagAlt);
        const endPosition = endIdx !== -1 ? endIdx : endIdxAlt;
        const endTagUsed = endIdx !== -1 ? endTag : endTagAlt;

        if (endPosition !== -1) {
          isThinking = false;
          onThinking(buffer.substring(0, endPosition));
          onContent(buffer.substring(endPosition + endTagUsed.length));
          buffer = '';
        } else {
          onThinking(chunk);
        }
      } else {
        onContent(chunk);
      }
    }, systemPrompt, options);
  }

  static async listModels(): Promise<string[]> {
    const details = await this.listModelDetails();
    return details.map(m => m.id);
  }

  static async listModelDetails(): Promise<NimModelInfo[]> {
    const sorted = [...NIM_MODELS].sort((a, b) => {
      const dateCompare = b.released.localeCompare(a.released);
      if (dateCompare !== 0) return dateCompare;
      return b.sizeB - a.sizeB;
    });

    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const baseUrl = getEffectiveBaseUrl();
      const url = `${baseUrl}/models`;

      // Add timeout for model listing
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 30000); // 30 second timeout

      const response = await fetch(url, {
        headers,
        signal: timeoutController.signal
      });

      clearTimeout(timeoutId);
      if (!response.ok) {
        return sorted;
      }
      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        const apiModelIds = new Set(data.data.map((m: any) => m.id || m.model || m.name || '').filter(Boolean));
        const known = sorted.filter(m => apiModelIds.has(m.id));
        const unknown: NimModelInfo[] = [...apiModelIds]
          .filter((id): id is string => typeof id === 'string')
          .filter(id => !sorted.some(m => m.id === id))
          .map(id => ({
            id,
            name: id.split('/').pop() || id,
            description: 'Model from API',
            category: 'chat' as NimModelCategory,
            family: id.split('/')[0] || 'Unknown',
            sizeB: 0,
            released: '1970-01',
          }));
        return [...known, ...unknown];
      }
      return sorted;
    } catch (error) {
      return sorted;
    }
  }
}
