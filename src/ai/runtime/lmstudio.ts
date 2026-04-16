
export interface LMStudioOptions {
    max_tokens?: number;
    temperature?: number;
    signal?: AbortSignal;
}

export interface LMStudioMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LMStudioResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface LMStudioNativeResponse {
    result: string;
}

export interface LMStudioStreamResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: {
            role?: string;
            content?: string;
            reasoning_content?: string;
        };
        finish_reason: string | null;
    }>;
}

export interface LMStudioThinkingResponse {
    response: string;
    thinking?: string;
}

export const DEFAULT_max_tokens = 16384;

export class LMStudioService {
    private static baseUrl = 'http://127.0.0.1:1234';

    static setBaseUrl(url: string) {
        // Remove trailing /v1 if present since we'll add the correct paths
        this.baseUrl = url.replace(/\/v1\/?$/, '').replace(/\/$/, '');
    }

    static getBaseUrl(): string {
        return this.baseUrl;
    }

    /**
     * Standard non-streaming chat completion using LM Studio native API
     */
    static async chat(
        model: string,
        messages: LMStudioMessage[],
        options: LMStudioOptions = {}
    ): Promise<string> {
        // Convert messages array to system_prompt + input format
        let systemPrompt = '';
        let userInput = '';
        
        for (const msg of messages) {
            if (msg.role === 'system') {
                systemPrompt = msg.content;
            } else if (msg.role === 'user') {
                userInput = msg.content;
            }
        }
        
        // If no user input found, use the last message content
        if (!userInput && messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === 'user') {
                userInput = lastMsg.content;
            }
        }

        const url = `${this.baseUrl}/api/v1/chat`;
        
        // Build the request body in LM Studio native format
        const body: any = {};
        if (model) body.model = model;
        if (systemPrompt) body.system_prompt = systemPrompt;
        if (userInput) body.input = userInput;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: options.signal,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                // Check for context length error and provide helpful message
                if (errorText.includes('n_keep') && errorText.includes('n_ctx')) {
                    const match = errorText.match(/n_ctx:\s*(\d+)/);
                    const ctxSize = match ? match[1] : '4096';
                    throw new Error(
                        `LM Studio context window too small (${ctxSize}). ` +
                        `The prompt is too large for the model's context length. ` +
                        `In LM Studio, reload the model with a larger Context Length ` +
                        `(Settings > Models > Context Length > set to 8192 or higher).`
                    );
                }
                throw new Error(`LM Studio error: ${response.statusText} - ${errorText}`);
            }
            const data = await response.json();
            console.log('LM Studio raw response:', data);
            
            // Handle new LM Studio format with output array
            let result = '';
            if (data.output && Array.isArray(data.output)) {
                // Find the message type output
                const messageOutput = data.output.find((o: any) => o.type === 'message');
                if (messageOutput && messageOutput.content) {
                    result = messageOutput.content;
                }
            } else if (data.result) {
                // Fallback to old format
                result = data.result;
            }
            
            if (!result || result.trim() === '') {
                console.warn('LM Studio returned empty result. Prompt may be too small/context insufficient.');
            }
            return result;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('LM Studio chat cancelled');
                throw new Error('Chat cancelled');
            }
            console.error('LM Studio Chat Error:', error);
            throw error;
        }
    }

    /**
     * Standard non-streaming generation (convenience method for single prompt)
     */
    static async generate(
        model: string,
        prompt: string,
        systemPrompt?: string,
        options: LMStudioOptions = {}
    ): Promise<string> {
        const messages: LMStudioMessage[] = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });
        
        return this.chat(model, messages, options);
    }

    /**
     * Streaming chat completion using LM Studio native API
     */
    static async streamChat(
        model: string,
        messages: LMStudioMessage[],
        onChunk: (text: string) => void,
        options: LMStudioOptions = {}
    ): Promise<void> {
        // Convert messages array to system_prompt + input format
        let systemPrompt = '';
        let userInput = '';
        
        for (const msg of messages) {
            if (msg.role === 'system') {
                systemPrompt = msg.content;
            } else if (msg.role === 'user') {
                userInput = msg.content;
            }
        }
        
        if (!userInput && messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === 'user') {
                userInput = lastMsg.content;
            }
        }

        const url = `${this.baseUrl}/api/v1/chat`;
        
        const body: any = { stream: true };
        if (model) body.model = model;
        if (systemPrompt) body.system_prompt = systemPrompt;
        if (userInput) body.input = userInput;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: options.signal,
                body: JSON.stringify(body),
            });

            if (!response.ok) throw new Error(`LM Studio stream error: ${response.statusText}`);
            if (!response.body) throw new Error('LM Studio stream body is null');

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
                        // Native streaming format: each line is a JSON object
                        const json = JSON.parse(line);
                        
                        // Handle new format with output array in streaming
                        if (json.output && Array.isArray(json.output)) {
                            const messageOutput = json.output.find((o: any) => o.type === 'message');
                            if (messageOutput && messageOutput.content) {
                                onChunk(messageOutput.content);
                            }
                        } else if (json.result) {
                            // Fallback to old format
                            onChunk(json.result);
                        }
                    } catch (e) {
                        // Skip invalid JSON lines
                    }
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('LM Studio streaming cancelled');
                throw new Error('Streaming cancelled');
            }
            console.error('LM Studio Streaming Error:', error);
            throw error;
        }
    }

    /**
     * Streaming generation (convenience method for single prompt)
     */
    static async streamGenerate(
        model: string,
        prompt: string,
        onChunk: (text: string) => void,
        systemPrompt?: string,
        options: LMStudioOptions = {}
    ): Promise<void> {
        const messages: LMStudioMessage[] = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });
        
        return this.streamChat(model, messages, onChunk, options);
    }

    /**
     * Generation with thinking trace support using LM Studio native API
     */
    static async generateWithThinking(
        model: string,
        prompt: string,
        systemPrompt?: string,
        options: LMStudioOptions = {}
    ): Promise<LMStudioThinkingResponse> {
        const url = `${this.baseUrl}/api/v1/chat`;
        
        const body: any = {};
        if (model) body.model = model;
        if (systemPrompt) body.system_prompt = systemPrompt;
        if (prompt) body.input = prompt;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: options.signal,
                body: JSON.stringify(body),
            });

            if (!response.ok) throw new Error(`LM Studio thinking error: ${response.statusText}`);
            
            const data = await response.json();
            
            // Handle new LM Studio format with output array
            let result = '';
            let thinking = '';
            if (data.output && Array.isArray(data.output)) {
                // Extract reasoning and message content
                const reasoningOutput = data.output.find((o: any) => o.type === 'reasoning');
                const messageOutput = data.output.find((o: any) => o.type === 'message');
                
                if (reasoningOutput && reasoningOutput.content) {
                    thinking = reasoningOutput.content;
                }
                if (messageOutput && messageOutput.content) {
                    result = messageOutput.content;
                }
            } else if (data.result) {
                // Fallback to old format
                result = data.result;
            }
            
            return {
                response: result,
                thinking: thinking
            };
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('LM Studio thinking generation cancelled');
                throw new Error('Thinking generation cancelled');
            }
            console.error('LM Studio Thinking Error:', error);
            throw error;
        }
    }

    /**
     * Streaming generation with thinking trace support using LM Studio native API
     */
    static async streamGenerateWithThinking(
        model: string,
        prompt: string,
        onThinking: (text: string) => void,
        onContent: (text: string) => void,
        systemPrompt?: string,
        options: LMStudioOptions = {}
    ): Promise<void> {
        const url = `${this.baseUrl}/api/v1/chat`;
        
        const body: any = { stream: true };
        if (model) body.model = model;
        if (systemPrompt) body.system_prompt = systemPrompt;
        if (prompt) body.input = prompt;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: options.signal,
                body: JSON.stringify(body),
            });

            if (!response.ok) throw new Error(`LM Studio thinking stream error: ${response.statusText}`);
            if (!response.body) throw new Error('LM Studio thinking stream body is null');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    
                    try {
                        const json = JSON.parse(line);
                        
                        // Handle new format with output array
                        if (json.output && Array.isArray(json.output)) {
                            const reasoningOutput = json.output.find((o: any) => o.type === 'reasoning');
                            const messageOutput = json.output.find((o: any) => o.type === 'message');
                            
                            if (reasoningOutput && reasoningOutput.content) {
                                onThinking(reasoningOutput.content);
                            }
                            if (messageOutput && messageOutput.content) {
                                onContent(messageOutput.content);
                                fullContent += messageOutput.content;
                            }
                        } else if (json.result) {
                            // Fallback to old format
                            onContent(json.result);
                            fullContent += json.result;
                        }
                    } catch (e) {
                        // Skip invalid JSON lines
                    }
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('LM Studio thinking streaming cancelled');
                throw new Error('Thinking streaming cancelled');
            }
            console.error('LM Studio Thinking Streaming Error:', error);
            throw error;
        }
    }

    /**
     * Generation with structured JSON format
     * Uses system prompt to request JSON output
     */
    static async generateWithStructuredFormat(
        model: string,
        messages: LMStudioMessage[],
        format: object,
        options: LMStudioOptions = {}
    ): Promise<string> {
        // Add a system message requesting JSON format
        const jsonSystemMessage: LMStudioMessage = {
            role: 'system',
            content: `You must respond with valid JSON that matches this schema: ${JSON.stringify(format)}. Do not include any markdown formatting, explanations, or text outside the JSON object.`
        };
        
        const allMessages = messages[0]?.role === 'system' 
            ? [{ ...messages[0], content: `${messages[0].content}\n\n${jsonSystemMessage.content}` }, ...messages.slice(1)]
            : [jsonSystemMessage, ...messages];

        return this.chat(model, allMessages, options);
    }

    /**
     * Embeddings generation (if supported by the loaded model)
     */
    static async embeddings(
        model: string,
        input: string,
        options: LMStudioOptions = {}
    ): Promise<number[]> {
        const url = `${this.baseUrl}/v1/embeddings`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: options.signal,
                body: JSON.stringify({
                    model,
                    input
                }),
            });

            if (!response.ok) throw new Error(`LM Studio embeddings error: ${response.statusText}`);
            const data = await response.json();
            return data.data?.[0]?.embedding || [];
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('LM Studio embeddings cancelled');
                throw new Error('Embeddings cancelled');
            }
            console.error('LM Studio Embeddings Error:', error);
            throw error;
        }
    }

    /**
     * List available models using LM Studio native API
     */
    static async listModels(): Promise<string[]> {
        try {
            const url = `${this.baseUrl}/api/v1/models`;
            // console.log('[LMStudio] Fetching models from:', url);
            const response = await fetch(url);
            console.log('[LMStudio] Response status:', response.status, response.statusText);
            if (!response.ok) {
                console.log('[LMStudio] Response not OK, returning empty');
                return [];
            }
            const data = await response.json();
            // console.log('[LMStudio] Raw response data:', data);
            // LM Studio returns {models: [...]} not {data: [...]}
            if (Array.isArray(data.models)) {
                const models = data.models.map((m: any) => m.id || m.key || m.model || m.name || '').filter(Boolean);
                // console.log('[LMStudio] Parsed models from data.models:', models);
                return models;
            }
            // Fallback for other formats
            if (Array.isArray(data)) {
                const models = data.map((m: any) => m.id || m.model || m.name || '').filter(Boolean);
                // console.log('[LMStudio] Parsed models (array):', models);
                return models;
            }
            if (data.data && Array.isArray(data.data)) {
                const models = data.data.map((m: any) => m.id || m.model || m.name || '').filter(Boolean);
                // console.log('[LMStudio] Parsed models from data.data:', models);
                return models;
            }
            console.log('[LMStudio] No models found in response');
            return [];
        } catch (error) {
            console.error('[LMStudio] Error listing models:', error);
            // Only log errors that aren't connection refused (expected when LM Studio is not running)
            if (error instanceof Error && !error.message.includes('ERR_CONNECTION_REFUSED') && !error.message.includes('Failed to fetch')) {
                console.error('Unexpected error listing LM Studio models:', error);
            }
            return [];
        }
    }
}
