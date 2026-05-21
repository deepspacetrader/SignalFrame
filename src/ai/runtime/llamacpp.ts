export interface LlamaCppOptions {
    max_tokens?: number;
    temperature?: number;
    signal?: AbortSignal;
}

export interface LlamaCppMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class LlamaCppService {
    private static baseUrl = 'http://localhost:8080/v1';

    static setBaseUrl(url: string) {
        this.baseUrl = url.replace(/\/$/, '');
    }

    static getBaseUrl(): string {
        return this.baseUrl;
    }

    static async chat(
        model: string,
        messages: LlamaCppMessage[],
        format?: 'json',
        options: LlamaCppOptions = {}
    ): Promise<string> {
        const url = `${this.baseUrl}/chat/completions`;
        const body: any = {
            model: model || 'default',
            messages: messages,
            temperature: options.temperature ?? 0,
        };
        if (options.max_tokens) {
            body.max_tokens = options.max_tokens;
        }
        if (format === 'json') {
            body.response_format = { type: 'json_object' };
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: options.signal,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Llama.cpp error: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Llama.cpp chat cancelled');
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
        options: LlamaCppOptions = {}
    ): Promise<string> {
        const messages: LlamaCppMessage[] = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });
        return this.chat(model, messages, format, options);
    }

    static async streamChat(
        model: string,
        messages: LlamaCppMessage[],
        onChunk: (text: string) => void,
        options: LlamaCppOptions = {}
    ): Promise<void> {
        const url = `${this.baseUrl}/chat/completions`;
        const body: any = {
            model: model || 'default',
            messages: messages,
            temperature: options.temperature ?? 0,
            stream: true,
        };
        if (options.max_tokens) {
            body.max_tokens = options.max_tokens;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: options.signal,
                body: JSON.stringify(body),
            });

            if (!response.ok) throw new Error(`Llama.cpp stream error: ${response.statusText}`);
            if (!response.body) throw new Error('Llama.cpp stream body is null');

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
                console.log('Llama.cpp streaming cancelled');
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
        options: LlamaCppOptions = {}
    ): Promise<void> {
        const messages: LlamaCppMessage[] = [];
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
        options: LlamaCppOptions = {}
    ): Promise<{ response: string; thinking?: string }> {
        const response = await this.generate(model, prompt, systemPrompt, undefined, options);
        // Extremely simple think tag parser
        let thinking = '';
        let finalResponse = response;
        if (response.includes('<think>') && response.includes('</think>')) {
            const parts = response.split('</think>');
            thinking = parts[0].replace('<think>', '').trim();
            finalResponse = parts[1].trim();
        }
        return { response: finalResponse, thinking };
    }

    static async streamGenerateWithThinking(
        model: string,
        prompt: string,
        onThinking: (text: string) => void,
        onContent: (text: string) => void,
        systemPrompt?: string,
        options: LlamaCppOptions = {}
    ): Promise<void> {
        let isThinking = false;
        let buffer = '';
        
        await this.streamGenerate(model, prompt, (chunk) => {
            buffer += chunk;
            if (!isThinking && buffer.includes('<think>')) {
                isThinking = true;
                const thinkIndex = buffer.indexOf('<think>');
                if (thinkIndex > 0) onContent(buffer.substring(0, thinkIndex));
                buffer = buffer.substring(thinkIndex + 7);
            }
            
            if (isThinking) {
                if (buffer.includes('</think>')) {
                    isThinking = false;
                    const parts = buffer.split('</think>');
                    onThinking(parts[0]);
                    onContent(parts[1]);
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
            const url = `${this.baseUrl}/models`;
            const response = await fetch(url);
            if (!response.ok) {
                return [];
            }
            const data = await response.json();
            if (data.data && Array.isArray(data.data)) {
                return data.data.map((m: any) => m.id || m.model || m.name || '').filter(Boolean);
            }
            return [];
        } catch (error) {
            return [];
        }
    }
}
