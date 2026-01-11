import { useState, useRef, useEffect } from 'react';
import { OllamaService } from '../ai/runtime/ollama';
import { useSituationStore } from '../state/useSituationStore';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export function ChatPanel() {
    const { narrative, signals, insights, foreignRelations, bigPicture, aiConfig } = useSituationStore();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [predictions, setPredictions] = useState<any[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Context Configuration
    const [includeNarrative, setIncludeNarrative] = useState(true);
    const [includeSignals, setIncludeSignals] = useState(true);
    const [includeInsights, setIncludeInsights] = useState(true);
    const [includeRelations, setIncludeRelations] = useState(false);
    const [includeBigPicture, setIncludeBigPicture] = useState(false);
    const [includePredictions, setIncludePredictions] = useState(false);

    // Load predictions history on mount for context
    useEffect(() => {
        const loadPredictions = async () => {
            try {
                const { StorageService } = await import('../services/db');
                const history = await StorageService.getGlobal('prediction_history');
                if (history && Array.isArray(history)) {
                    setPredictions(history);
                }
            } catch (e) {
                console.error("Failed to load predictions for chat context", e);
            }
        };
        loadPredictions();
    }, []);

    const generateSystemContext = () => {
        const parts = [];
        parts.push(`You are an elite intelligence analyst assistant.`);

        if (includeNarrative) {
            parts.push(`CURRENT SITUATION BRIEFING:\n${narrative}`);
        }

        if (includeSignals) {
            parts.push(`KEY SIGNALS:\n${signals.map(s => `- ${s.text} (${s.sentiment})`).join('\n')}`);
        }

        if (includeInsights) {
            parts.push(`INSIGHTS:\n${insights.map(i => `- ${i.text}`).join('\n')}`);
        }

        if (includeRelations) {
            parts.push(`FOREIGN RELATIONS:\n${foreignRelations.map(r =>
                `- ${r.countryA} <-> ${r.countryB}: ${r.status} (${r.sentiment}) [${r.topic}]`
            ).join('\n')}`);
        }

        if (includeBigPicture && bigPicture) {
            parts.push(`THE BIG PICTURE (HISTORICAL):\n${bigPicture.summary}\nTimeline Events: ${bigPicture.timeline.length}`);
        }

        if (includePredictions && predictions.length > 0) {
            // Use latest prediction
            const latest = predictions[0];
            parts.push(`LATEST PROJECTION (${latest.topic}):\nShort Term: ${latest.data.shortTerm}\nMedium Term: ${latest.data.mediumTerm}\nLong Term: ${latest.data.longTerm}`);
        }

        parts.push(`Use this context to answer questions. Be concise, professional, and insightful.`);
        return parts.join('\n\n');
    };

    // Calculate Context Usage
    const currentContext = generateSystemContext();
    const estTokens = Math.ceil(currentContext.length / 4);
    const maxTokens = aiConfig.numCtx;
    const usagePercent = Math.min((estTokens / maxTokens) * 100, 100);
    const usageColor = usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500';

    const toggleAll = (enable: boolean) => {
        setIncludeNarrative(enable);
        setIncludeSignals(enable);
        setIncludeInsights(enable);
        setIncludeRelations(enable);
        setIncludeBigPicture(enable);
        setIncludePredictions(enable);
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
        <div className="h-[750px] flex flex-col bg-bg-card/40 backdrop-blur-md rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-white/5 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-accent-primary">Secure Comm Link</h3>
                    <div className="flex items-center gap-2">
                        {isTyping && (
                            <div className="flex items-center gap-1 mr-2">
                                <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce"></span>
                            </div>
                        )}
                        <span className={`w-2 h-2 rounded-full ${isTyping ? 'bg-accent-secondary animate-pulse' : 'bg-green-500'}`}></span>
                        <span className="text-[10px] font-mono text-text-secondary">{isTyping ? 'THINKING...' : 'READY'}</span>
                    </div>
                </div>

                {/* Context Controls */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-text-secondary font-bold tracking-wider">Active Context Data</span>
                        <div className="flex gap-1">
                            <button onClick={() => toggleAll(true)} className="px-2 py-0.5 text-[10px] bg-white/5 hover:bg-white/10 rounded text-xs text-white">All</button>
                            <button onClick={() => toggleAll(false)} className="px-2 py-0.5 text-[10px] bg-white/5 hover:bg-white/10 rounded text-xs text-white">None</button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <ContextToggle label="Narrative" active={includeNarrative} onClick={() => setIncludeNarrative(!includeNarrative)} />
                        <ContextToggle label="Signals" active={includeSignals} onClick={() => setIncludeSignals(!includeSignals)} />
                        <ContextToggle label="Insights" active={includeInsights} onClick={() => setIncludeInsights(!includeInsights)} />
                        <ContextToggle label="Relations" active={includeRelations} onClick={() => setIncludeRelations(!includeRelations)} />
                        <ContextToggle label="Big Picture" active={includeBigPicture} onClick={() => setIncludeBigPicture(!includeBigPicture)} />
                        <ContextToggle label="Trajectory" active={includePredictions} onClick={() => setIncludePredictions(!includePredictions)} />
                    </div>

                    {/* Context Usage Bar */}
                    <div className="relative pt-1">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] text-text-secondary uppercase">Context Usage</span>
                            <span className="text-[9px] text-text-secondary font-mono">{estTokens} / {maxTokens} tokens ({Math.round(usagePercent)}%)</span>
                        </div>
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${usageColor} transition-all duration-500`}
                                style={{ width: `${usagePercent}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-text-secondary/30 text-center p-8">
                        <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <p className="text-sm font-mono uppercase tracking-widest">Awaiting Input</p>
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

                {/* Typing Indicator in chat flow */}
                {isTyping && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                        <div className="bg-white/5 border border-white/5 text-slate-200 rounded-xl rounded-tl-none p-3 max-w-[85%]">
                            <div className="flex items-center gap-1.5 h-5">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    </div>
                )}
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

function ContextToggle({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all border ${active
                    ? 'bg-accent-primary/20 border-accent-primary text-accent-primary shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                    : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'
                }`}
        >
            {label}
        </button>
    );
}
