import { useState, useRef, useEffect } from 'react';
import { OllamaService } from '../ai/runtime/ollama';
import { useSituationStore } from '../state/useSituationStore';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export function ChatPanel() {
    const { narrative, signals, insights, aiConfig } = useSituationStore();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);



    const generateSystemContext = () => {
        return `You are an elite intelligence analyst assistant. 
    CURRENT SITUATION BREIFING:
    ${narrative}
    
    KEY SIGNALS:
    ${signals.map(s => `- ${s.text} (${s.sentiment})`).join('\n')}

    INSIGHTS:
    ${insights.map(i => `- ${i.text}`).join('\n')}
    
    Use this context to answer questions. Be concise, professional, and insightful.`;
    };

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;

        const userMsg: Message = { role: 'user', content: input };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInput('');
        setIsTyping(true);

        try {
            const contextMsg: Message = { role: 'system', content: generateSystemContext() };
            const apiMessages = [contextMsg, ...newHistory];

            let assistantContent = '';

            await OllamaService.chat(aiConfig.model, apiMessages, (chunk) => {
                assistantContent += chunk;
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last.role === 'assistant') {
                        return [...prev.slice(0, -1), { role: 'assistant', content: assistantContent }];
                    }
                    return [...prev, { role: 'assistant', content: assistantContent }];
                });
            });
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Use the Deep Intelligence Node to retrieve context first.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const formatMessage = (content: string) => {
        // Basic "Thinking" block parsing if <think> tags are present
        const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch) {
            const thought = thinkMatch[1];
            const rest = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
            return (
                <div>
                    <details className="mb-2 bg-black/20 rounded p-2 text-xs border border-white/10">
                        <summary className="cursor-pointer text-accent-secondary font-mono uppercase tracking-wider opacity-70 hover:opacity-100 select-none">
                            Analysis Process
                        </summary>
                        <div className="mt-2 text-slate-400 font-mono italic whitespace-pre-wrap">{thought}</div>
                    </details>
                    <div className="whitespace-pre-wrap">{rest}</div>
                </div>
            );
        }
        return <div className="whitespace-pre-wrap">{content}</div>;
    };

    return (
        <div className="h-[600px] flex flex-col bg-bg-card/40 backdrop-blur-md rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-widest text-accent-primary">Secure Comm Link</h3>
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isTyping ? 'bg-accent-secondary animate-pulse' : 'bg-green-500'}`}></span>
                    <span className="text-[10px] font-mono text-text-secondary">{isTyping ? 'UPLINK ACTIVE' : 'READY'}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-text-secondary/30 text-center p-8">
                        <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <p className="text-sm font-mono uppercase tracking-widest">Awaiting Input</p>
                        <p className="text-xs mt-2 max-w-xs">Ask questions about the current geopolitical situation, signals, or trends.</p>
                    </div>
                )}

                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-xl p-3 text-sm ${m.role === 'user'
                            ? 'bg-accent-primary/20 border border-accent-primary/20 text-white rounded-tr-none'
                            : 'bg-white/5 border border-white/5 text-slate-200 rounded-tl-none'
                            }`}>
                            {formatMessage(m.content)}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-white/5 bg-black/20">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type your query..."
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-accent-primary/50 transition-colors"
                        disabled={isTyping}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isTyping || !input.trim()}
                        className="px-4 py-2 bg-accent-primary/20 hover:bg-accent-primary/40 border border-accent-primary/30 text-accent-primary rounded-lg transition-colors disabled:opacity-50"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
