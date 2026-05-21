export interface NimOptions {
  max_tokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface NimMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const NIM_MODELS = [
  { id: 'moonshotai/kimi-k2.6', name: 'Kimi K2.6', description: 'Kimi K2.6 reasoning model' },
  { id: 'deepseekai/deepseek-prover-v2.5', name: 'GLM-5.1', description: 'GLM-5.1 reasoning model' },
  { id: 'google/gemma-4-31b-it', name: 'Gemma 4 31B IT', description: 'Gemma 4 reasoning model' },
  { id: 'nvidia/deepseek-r1/nim', name: 'DeepSeek R1', description: 'Deep reasoning via NVIDIA NIM' },
  { id: 'nvidia/qwen3-235b-a22b/nim', name: 'Qwen3 235B MoE', description: 'Qwen3 thinking model' },
  { id: 'nvidia/qwen3-30b-a3b/nim', name: 'Qwen3 30B MoE', description: 'Lighter Qwen3 thinking model' },
  { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', name: 'Nemotron Super 49B', description: 'NVIDIA reasoning model' },
  { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', name: 'Nemotron Ultra 253B', description: 'Most capable Nemotron model' },
  { id: 'deepseek-ai/deepseek-r1/nim', name: 'DeepSeek R1 (Direct)', description: 'DeepSeek R1 via DeepSeek on NIM' },
] as const;

export const NIM_AVAILABLE_MODELS = NIM_MODELS;

export function getNimModelDefaults(): { model: string; baseUrl: string } {
  return {
    model: NIM_MODELS[0].id,
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

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: options.signal,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NVIDIA NIM error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('NIM chat cancelled');
        throw new Error('Chat cancelled');
      }
      throw error;
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

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: options.signal,
        body: JSON.stringify(body),
      });

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
        console.log('NVIDIA NIM streaming cancelled');
        throw new Error('Streaming cancelled');
      }
      throw error;
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
        try {
            const headers: Record<string, string> = {};
            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const baseUrl = getEffectiveBaseUrl();
            const url = `${baseUrl}/models`;
      const response = await fetch(url, { headers });
      if (!response.ok) {
        return NIM_MODELS.map(m => m.id);
      }
      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        return data.data.map((m: any) => m.id || m.model || m.name || '').filter(Boolean);
      }
      return NIM_MODELS.map(m => m.id);
    } catch (error) {
      return NIM_MODELS.map(m => m.id);
    }
  }
}
