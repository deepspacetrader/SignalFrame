
export interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
}

export interface OllamaOptions {
    num_ctx?: number;
    num_predict?: number;
    temperature?: number;
    think?: boolean; // Enable thinking/reasoning trace for supported models (deepseek-r1, qwen3, etc.)
    signal?: AbortSignal; // AbortSignal for cancellation
}

export interface OllamaThinkingResponse {
    response: string;
    thinking?: string;
}

export const DEFAULT_num_ctx = 8192;
export const DEFAULT_num_predict = 16384;

export class OllamaService {
    private static baseUrl = 'http://127.0.0.1:11434/api';

    /**
     * Standard non-streaming generation
     */
    static async generate(
        model: string,
        prompt: string,
        format?: 'json',
        options: OllamaOptions = {}
    ): Promise<string> {
        const url = `${this.baseUrl}/generate`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: options.signal,
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: false,
                    format,
                    options: {
                        num_ctx: options.num_ctx || DEFAULT_num_ctx,
                        num_predict: options.num_predict || DEFAULT_num_predict,
                        num_gpu: -1,
                        num_thread: 0
                    }
                }),
            });

            if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
            const data: OllamaResponse = await response.json();
            return data.response;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Ollama generation cancelled');
                throw new Error('Generation cancelled');
            }
            console.error('Ollama Service Error:', error);
            throw error;
        }
    }

    /**
     * Generation with thinking trace support (for deepseek-r1, qwen3, etc.)
     * Uses the /api/chat endpoint with think: true
     */
    static async generateWithThinking(
        model: string,
        prompt: string,
        options: OllamaOptions = {}
    ): Promise<OllamaThinkingResponse> {
        const url = `${this.baseUrl}/chat`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: options.signal,
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    stream: false,
                    think: true,
                    options: {
                        num_ctx: options.num_ctx || DEFAULT_num_ctx,
                        num_predict: options.num_predict || DEFAULT_num_predict,
                        num_gpu: -1,
                        num_thread: 0
                    }
                }),
            });

            if (!response.ok) throw new Error(`Ollama thinking error: ${response.statusText}`);
            const data = await response.json();
            return {
                response: data.message?.content || '',
                thinking: data.message?.thinking || ''
            };
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Ollama thinking generation cancelled');
                throw new Error('Thinking generation cancelled');
            }
            console.error('Ollama Thinking Error:', error);
            throw error;
        }
    }

    /**
     * Streaming generation with thinking trace support
     * Streams both thinking and response content
     */
    static async streamGenerateWithThinking(
        model: string,
        prompt: string,
        onThinking: (text: string) => void,
        onContent: (text: string) => void,
        options: OllamaOptions = {}
    ): Promise<void> {
        const url = `${this.baseUrl}/chat`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: options.signal,
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    stream: true,
                    think: true,
                    options: {
                        num_ctx: options.num_ctx || DEFAULT_num_ctx,
                        num_predict: options.num_predict || DEFAULT_num_predict,
                        num_gpu: -1,
                        num_thread: 0
                    }
                }),
            });

            if (!response.ok) throw new Error(`Ollama thinking stream error: ${response.statusText}`);
            if (!response.body) throw new Error('Ollama thinking stream body is null');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const json = JSON.parse(line);
                        if (json.message?.thinking) {
                            onThinking(json.message.thinking);
                        }
                        if (json.message?.content) {
                            onContent(json.message.content);
                        }
                        if (json.done) break;
                    } catch (e) {
                        // Handle partial JSON lines
                    }
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Ollama thinking streaming cancelled');
                throw new Error('Thinking streaming cancelled');
            }
            console.error('Ollama Thinking Streaming Error:', error);
            throw error;
        }
    }


    /**
     * Streaming generation for real-time text updates
     */
    static async streamGenerate(
        model: string,
        prompt: string,
        onChunk: (text: string) => void,
        options: OllamaOptions = {}
    ): Promise<void> {
        const url = `${this.baseUrl}/generate`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: options.signal,
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: true,
                    options: {
                        num_ctx: options.num_ctx || DEFAULT_num_ctx,
                        num_predict: options.num_predict || DEFAULT_num_predict,
                        num_gpu: -1,
                        num_thread: 0
                    }
                }),
            });

            if (!response.ok) throw new Error(`Ollama stream error: ${response.statusText}`);
            if (!response.body) throw new Error('Ollama stream body is null');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const json = JSON.parse(line);
                        if (json.response) onChunk(json.response);
                        if (json.done) break;
                    } catch (e) {
                        // Handle partial JSON lines if necessary
                    }
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Ollama streaming cancelled');
                throw new Error('Streaming cancelled');
            }
            console.error('Ollama Streaming Error:', error);
            throw error;
        }
    }

    static async chat(
        model: string,
        messages: { role: string; content: string }[],
        onChunk: (text: string) => void,
        options: OllamaOptions = {}
    ): Promise<void> {
        const url = `${this.baseUrl}/chat`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: options.signal,
                body: JSON.stringify({
                    model,
                    messages,
                    stream: true,
                    options: {
                        num_ctx: options.num_ctx || DEFAULT_num_ctx,
                        num_predict: options.num_predict || DEFAULT_num_predict,
                        num_gpu: -1,
                        num_thread: 0
                    }
                }),
            });

            if (!response.ok) throw new Error(`Ollama chat stream error: ${response.statusText}`);
            if (!response.body) throw new Error('Ollama chat stream body is null');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const json = JSON.parse(line);
                        // Chat response format: { model, created_at, message: { role, content }, done }
                        if (json.message && json.message.content) {
                            onChunk(json.message.content);
                        }
                        if (json.done) break;
                    } catch (e) {
                        // Handle partial JSON lines if necessary
                    }
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Ollama chat cancelled');
                throw new Error('Chat cancelled');
            }
            console.error('Ollama Chat Error:', error);
            throw error;
        }
    }

    static async embeddings(
        model: string,
        prompt: string,
        options: OllamaOptions = {}
    ): Promise<number[]> {
        const url = `${this.baseUrl}/embeddings`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: options.signal,
                body: JSON.stringify({
                    model,
                    prompt,
                    options: {
                        num_ctx: options.num_ctx || DEFAULT_num_ctx,
                        num_predict: options.num_predict || DEFAULT_num_predict,
                        num_gpu: -1,
                        num_thread: 0
                    }
                }),
            });

            if (!response.ok) throw new Error(`Ollama embeddings error: ${response.statusText}`);
            const data = await response.json();
            return data.embedding;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Ollama embeddings cancelled');
                throw new Error('Embeddings cancelled');
            }
            console.error('Ollama Embeddings Error:', error);
            throw error;
        }
    }

    static async listModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.baseUrl}/tags`);
            const data = await response.json();
            return data.models.map((m: any) => m.name);
        } catch (error) {
            console.error('Failed to list Ollama models:', error);
            return [];
        }
    }

    static async getRunningModels(): Promise<any[]> {
        try {
            const response = await fetch(`${this.baseUrl}/ps`);
            const data = await response.json();
            return data.models || [];
        } catch (error) {
            console.error('Failed to get running models:', error);
            return [];
        }
    }
}
