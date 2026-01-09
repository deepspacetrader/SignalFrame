
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
}

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
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: false,
                    format,
                    options: {
                        num_ctx: options.num_ctx || 25000,
                        num_predict: options.num_predict || 15000,
                    }
                }),
            });

            if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
            const data: OllamaResponse = await response.json();
            return data.response;
        } catch (error) {
            console.error('Ollama Service Error:', error);
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
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: true,
                    options: {
                        num_ctx: options.num_ctx || 25000,
                        num_predict: options.num_predict || 15000,
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
            console.error('Ollama Streaming Error:', error);
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
