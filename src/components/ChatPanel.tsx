import { useState, useRef, useEffect } from 'react';
import { chatWithProvider } from '../ai/runtime/engine';
import { useSituationStore } from '../state/useSituationStore';
import { StorageService } from '../services/db';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// Stop words to clean search queries for local RAG indexing
const stopWords = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'cant', 'cannot', 'could',
    'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down', 'during', 'each', 'few', 'for', 'from',
    'further', 'had', 'hadnt', 'has', 'hasnt', 'have', 'havent', 'having', 'he', 'hed', 'hell', 'hes', 'her', 'here',
    'heres', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'hows', 'i', 'id', 'ill', 'im', 'ive', 'if', 'in',
    'into', 'is', 'isnt', 'it', 'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor',
    'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
    'same', 'shant', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some', 'such', 'than', 'that',
    'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'theres', 'these', 'they', 'theyd',
    'theyll', 'theyre', 'theyve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was',
    'wasnt', 'we', 'wed', 'well', 'were', 'weve', 'werent', 'what', 'whats', 'when', 'whens', 'where', 'wheres',
    'which', 'while', 'who', 'whos', 'whom', 'why', 'whys', 'with', 'wont', 'would', 'wouldnt', 'you', 'youd',
    'youll', 'youre', 'youve', 'your', 'yours', 'yourself', 'yourselves'
]);

function extractKeywords(text: string): string[] {
    const words = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));
    return Array.from(new Set(words));
}

function scoreRecord(data: any, keywords: string[]): number {
    if (!data) return 0;
    let score = 0;
    const textToSearch: string[] = [];

    if (data.narrative) textToSearch.push(data.narrative.toLowerCase());
    
    if (data.signals && Array.isArray(data.signals)) {
        data.signals.forEach((s: any) => {
            if (s.text) textToSearch.push(s.text.toLowerCase());
        });
    }

    if (data.insights && Array.isArray(data.insights)) {
        data.insights.forEach((i: any) => {
            if (i.text) textToSearch.push(i.text.toLowerCase());
            else if (typeof i === 'string') textToSearch.push(i.toLowerCase());
        });
    }

    const combinedText = textToSearch.join(' ');
    
    keywords.forEach(keyword => {
        let count = 0;
        let pos = combinedText.indexOf(keyword);
        while (pos !== -1) {
            count++;
            pos = combinedText.indexOf(keyword, pos + keyword.length);
        }
        score += count;
    });

    return score;
}

export function ChatPanel({ onAIRequired }: { onAIRequired: () => void }) {
    const { narrative, signals, insights, foreignRelations, bigPicture, aiConfig, aiStatus, currentDate } = useSituationStore();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [predictions, setPredictions] = useState<any[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Context Configuration
    const [includeNarrative, setIncludeNarrative] = useState(true);
    const [includeSignals, setIncludeSignals] = useState(true);
    const [includeInsights, setIncludeInsights] = useState(true);
    const [includeRelations, setIncludeRelations] = useState(false);
    const [includeBigPicture, setIncludeBigPicture] = useState(false);
    const [includePredictions, setIncludePredictions] = useState(false);

    // Historical Data
    const [includeYesterday, setIncludeYesterday] = useState(false);
    const [yesterdayData, setYesterdayData] = useState<any>(null);

    // Local RAG Context State
    const [isRagActive, setIsRagActive] = useState(true);
    const [isSearchingRag, setIsSearchingRag] = useState(false);
    const [ragMatches, setRagMatches] = useState<Array<{ date: string; score: number }>>([]);
    const [activeRagData, setActiveRagData] = useState<any[]>([]);

    // Auto-scroll to bottom when AI finishes typing or matches load
    useEffect(() => {
        if (!isTyping && messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [isTyping, messages]);

    // Auto-focus input after AI response
    useEffect(() => {
        if (!isTyping && messages.length > 0) {
            inputRef.current?.focus();
        }
    }, [isTyping, messages.length]);

    useEffect(() => {
        const loadPredictions = async () => {
            try {
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

    // Load Yesterday's data when toggled
    useEffect(() => {
        if (includeYesterday && !yesterdayData) {
            const loadYesterday = async () => {
                try {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const dateStr = `${y}-${m}-${day}`;

                    const data = await StorageService.getAnalysis(dateStr);
                    if (data) {
                        setYesterdayData(data);
                    }
                } catch (e) {
                    console.error("Failed to load yesterday's data", e);
                }
            };
            loadYesterday();
        }
    }, [includeYesterday, yesterdayData]);

    const generateSystemContextInternal = (ragDataToUse?: any[]) => {
        const parts = [];
        parts.push(`You are an elite intelligence analyst assistant.`);

        if (includeNarrative) {
            parts.push(`CURRENT SITUATION BRIEFING (TODAY):\n${narrative}`);
        }

        if (includeYesterday && yesterdayData) {
            parts.push(`YESTERDAY'S BRIEFING (${yesterdayData.date}):\n${yesterdayData.narrative}`);
            if (yesterdayData.signals) {
                parts.push(`YESTERDAY'S SIGNALS:\n${yesterdayData.signals.map((s: any) => `- ${s.text}`).slice(0, 5).join('\n')}`);
            }
        }

        if (includeSignals) {
            parts.push(`SIGNALS (TODAY):\n${signals.map(s => `- ${s.text} (${s.sentiment})`).join('\n')}`);
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
            const latest = predictions[0];
            parts.push(`LATEST PROJECTION (${latest.topic}):\nShort Term: ${latest.data.shortTerm}\nMedium Term: ${latest.data.mediumTerm}\nLong Term: ${latest.data.longTerm}`);
        }

        const actualRagData = ragDataToUse !== undefined ? ragDataToUse : activeRagData;
        if (isRagActive && actualRagData && actualRagData.length > 0) {
            parts.push(`HISTORICAL RAG CONTEXT (MATCHED ARCHIVE RECORDS):
The following relevant intelligence documents were retrieved from IndexedDB history based on the user's search query keywords:
${actualRagData.map(r => {
    const narrativeText = r.data.narrative ? r.data.narrative.slice(0, 500) + (r.data.narrative.length > 500 ? '...' : '') : 'N/A';
    const signalsText = r.data.signals ? r.data.signals.map((s: any) => `- ${s.text}`).slice(0, 3).join('\n') : '';
    const insightsText = r.data.insights ? r.data.insights.map((i: any) => `- ${i.text}`).slice(0, 2).join('\n') : '';
    return `[ARCHIVE SNAPSHOT: ${r.date} (Relevance Score: ${r.score})]
Summary:
${narrativeText}
${signalsText ? `\nSignals:\n${signalsText}` : ''}
${insightsText ? `\nInsights:\n${insightsText}` : ''}`;
}).join('\n\n')}`);
        }

        parts.push(`Use this context to answer questions. Be concise, professional, and insightful. If you reference historical RAG context, clearly cite the specific date (e.g., "[2026-05-18]").`);
        return parts.join('\n\n');
    };

    const generateSystemContext = () => generateSystemContextInternal();

    // Calculate Context Usage
    const currentContext = generateSystemContext();
    const historyText = messages.map(m => m.content).join(' ');
    const totalText = currentContext + historyText;
    const estTokens = Math.ceil(totalText.length / 4);
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
        if (enable === false) setIncludeYesterday(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSend = async () => {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!isLocalhost) {
            onAIRequired();
            return;
        }

        if (!input.trim() || isTyping) return;

        const rawInput = input;
        const userMsg: Message = { role: 'user', content: rawInput };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInput('');
        setIsTyping(true);
        setIsSearchingRag(true);

        try {
            let matchedData: any[] = [];
            if (isRagActive) {
                const keywords = extractKeywords(rawInput);
                if (keywords.length > 0) {
                    const dates = await StorageService.getAllDates();
                    const searchResults: Array<{ date: string; score: number; data: any }> = [];

                    await Promise.all(
                        dates
                            .filter(d => d !== currentDate)
                            .map(async date => {
                                try {
                                    const data = await StorageService.getAnalysis(date);
                                    if (data) {
                                        const score = scoreRecord(data, keywords);
                                        if (score > 0) {
                                            searchResults.push({ date, score, data });
                                        }
                                    }
                                } catch (e) {
                                    console.error(`Failed to load historical data for ${date}`, e);
                                }
                            })
                    );

                    searchResults.sort((a, b) => {
                        if (b.score !== a.score) return b.score - a.score;
                        return b.date.localeCompare(a.date);
                    });

                    matchedData = searchResults.slice(0, 2);
                    setRagMatches(matchedData.map(r => ({ date: r.date, score: r.score })));
                    setActiveRagData(matchedData);
                } else {
                    setRagMatches([]);
                    setActiveRagData([]);
                }
            } else {
                setRagMatches([]);
                setActiveRagData([]);
            }
            setIsSearchingRag(false);

            const contextMsg: Message = { role: 'system', content: generateSystemContextInternal(matchedData) };
            const apiMessages = [contextMsg, ...newHistory];

            let assistantContent = '';

            await chatWithProvider(aiConfig, apiMessages, (chunk: string) => {
                assistantContent += chunk;
                setMessages(prev => {
                    const newMessages = [...prev];
                    if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
                        newMessages[newMessages.length - 1] = { role: 'assistant', content: assistantContent };
                    } else {
                        newMessages.push({ role: 'assistant', content: assistantContent });
                    }
                    return newMessages;
                });
            });
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Use the Deep Intelligence Node to retrieve context first.' }]);
            setIsSearchingRag(false);
        } finally {
            setIsTyping(false);
        }
    };

    const formatMessage = (content: string) => {
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

    // Synthesize 4 dynamic conversation starters based on today's active signals/relations
    const getDynamicSuggestions = (): string[] => {
        const suggestions: string[] = [];

        if (foreignRelations && foreignRelations.length > 0) {
            const activeRelations = foreignRelations.slice(0, 2);
            activeRelations.forEach(r => {
                if (r.countryA && r.countryB) {
                    suggestions.push(`Analyze the strategic implications of ${r.countryA}-${r.countryB} relations.`);
                }
            });
        }

        const keywords = ['cyberattack', 'sanctions', 'escalation', 'military', 'alliance', 'intelligence', 'economic', 'energy'];
        const foundKeywords = new Set<string>();
        const foundCountries = new Set<string>();

        const countriesList = ['USA', 'China', 'Russia', 'Ukraine', 'Germany', 'Israel', 'Iran', 'Taiwan', 'UK', 'North Korea', 'South Korea', 'Japan', 'EU'];

        if (signals && signals.length > 0) {
            signals.forEach(s => {
                if (!s || !s.text) return;
                const txt = s.text.toLowerCase();
                keywords.forEach(k => {
                    if (txt.includes(k)) foundKeywords.add(k);
                });
                countriesList.forEach(c => {
                    if (s.text.includes(c)) foundCountries.add(c);
                });
            });
        }

        if (foundCountries.size > 0) {
            const countries = Array.from(foundCountries).slice(0, 2);
            if (countries.length === 1) {
                suggestions.push(`What is the primary intelligence narrative regarding ${countries[0]} today?`);
            } else {
                suggestions.push(`Compare the intelligence profiles of ${countries[0]} and ${countries[1]} in today's signals.`);
            }
        }

        if (foundKeywords.size > 0) {
            const kw = Array.from(foundKeywords)[0];
            suggestions.push(`Assess the potential escalation of the ${kw} threat vector.`);
        }

        const fallbacks = [
            "Synthesize today's primary strategic threat vectors and conflict deltas.",
            "Identify hidden connection pathways between today's active signals.",
            "What are the most critical emerging strategic projections for this week?",
            "Cross-reference today's intelligence findings with yesterday's narrative."
        ];

        while (suggestions.length < 4 && fallbacks.length > 0) {
            const fb = fallbacks.shift();
            if (fb && !suggestions.includes(fb)) {
                suggestions.push(fb);
            }
        }

        return suggestions.slice(0, 4);
    };

    const handleSelectSuggestion = (suggestion: string) => {
        setInput(suggestion);
        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    return (
        <div className="h-[750px] flex flex-col bg-bg-card/40 backdrop-blur-md rounded-none border border-white/5 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-white/5 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-accent-primary">Secure Comm Link</h3>
                    <div className="flex items-center gap-2">
                        {isTyping && (
                            <div className="flex items-center gap-1 mr-2">
                                <span className="w-1.5 h-1.5 bg-accent-primary animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-accent-primary animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-accent-primary animate-bounce"></span>
                            </div>
                        )}
                        <span className={`w-2 h-2 ${isTyping ? 'bg-accent-secondary animate-pulse' : 'bg-green-500'}`}></span>
                        <span className="text-[10px] font-mono text-text-secondary">
                            {isSearchingRag ? 'RAG SEARCHING...' : isTyping ? 'THINKING...' : 'READY'}
                        </span>
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
                        <ContextToggle label="Yesterday" active={includeYesterday} onClick={() => setIncludeYesterday(!includeYesterday)} />
                        <button className="px-3 py-1 rounded-full text-[10px] font-bold uppercase border bg-white/5 border-white/5 text-text-secondary/50 cursor-not-allowed" title="Premium Feature">All-Time</button>

                        <div className="w-[1px] h-6 bg-white/10 mx-1"></div>

                        <ContextToggle label="Narrative" active={includeNarrative} onClick={() => setIncludeNarrative(!includeNarrative)} />
                        <ContextToggle label="Signals" active={includeSignals} onClick={() => setIncludeSignals(!includeSignals)} />
                        <ContextToggle label="Insights" active={includeInsights} onClick={() => setIncludeInsights(!includeInsights)} />
                        <ContextToggle label="Relations" active={includeRelations} onClick={() => setIncludeRelations(!includeRelations)} />
                        <ContextToggle label="Big Picture" active={includeBigPicture} onClick={() => setIncludeBigPicture(!includeBigPicture)} />
                        <ContextToggle label="Trajectory" active={includePredictions} onClick={() => setIncludePredictions(!includePredictions)} />

                        <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                        <button
                            onClick={() => {
                                setIsRagActive(!isRagActive);
                                if (isRagActive) {
                                    setRagMatches([]);
                                    setActiveRagData([]);
                                }
                            }}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all border ${isRagActive
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'
                            }`}
                        >
                            🔍 Smart RAG
                        </button>
                    </div>

                    {/* Context Usage Bar */}
                    <div className="relative pt-1">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] text-text-secondary uppercase">Context Usage</span>
                            <span className="text-[9px] text-text-secondary font-mono">{estTokens} / {maxTokens} tokens ({Math.round(usagePercent)}%)</span>
                        </div>
                        <div className="w-full h-1 bg-white/10 overflow-hidden">
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
                        <div className={`max-w-[85%] p-3 text-sm ${m.role === 'user'
                            ? 'bg-accent-primary/20 border border-accent-primary/20 text-white'
                            : 'bg-white/5 border border-white/5 text-slate-200'
                            }`}>
                            {formatMessage(m.content)}
                        </div>
                    </div>
                ))}

                {/* RAG matched notifications in timeline */}
                {isSearchingRag && (
                    <div className="flex justify-start animate-pulse">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2.5 text-xs font-mono uppercase tracking-wider rounded">
                            🔍 Scanning historical briefings database...
                        </div>
                    </div>
                )}

                {/* Typing Indicator in chat flow */}
                {isTyping && !isSearchingRag && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                        <div className="bg-white/5 border border-white/5 text-slate-200 p-3 max-w-[85%]">
                            <div className="flex items-center gap-1.5 h-5">
                                <span className="w-1.5 h-1.5 bg-slate-400 animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 animate-bounce"></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Active matched RAG documents HUD */}
            {ragMatches.length > 0 && (
                <div className="mx-4 mb-2 p-2 bg-emerald-500/5 border border-emerald-500/10 rounded flex items-center justify-between text-[10px] tracking-wider uppercase text-emerald-400 animate-in fade-in duration-300">
                    <span className="flex items-center gap-1.5 font-bold font-mono">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                        🔍 RAG ARCHIVE MATCHES LOADED
                    </span>
                    <div className="flex gap-2">
                        {ragMatches.map((match, idx) => (
                            <span key={idx} className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono text-[9px]">
                                {match.date} (Hits: {match.score})
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Auto-Generated Suggestions panel */}
            {messages.length === 0 && (
                <div className="px-4 pb-4">
                    <div className="text-[10px] uppercase text-text-secondary/60 font-bold tracking-wider mb-2">Suggested Analyst Directives</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {getDynamicSuggestions().map((suggestion, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSelectSuggestion(suggestion)}
                                className="text-left p-2.5 bg-white/5 hover:bg-accent-primary/10 border border-white/5 hover:border-accent-primary/30 rounded text-xs text-slate-300 transition-all duration-200 hover:text-accent-primary animate-in fade-in slide-in-from-bottom-2 duration-300"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <span className="font-mono text-[10px] text-accent-primary mr-1.5 font-bold">🎯</span>
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="p-4 border-t border-white/5 bg-black/20">
                <div className="flex gap-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your query..."
                        className="flex-1 bg-black/40 border border-white/10 px-4 py-2 text-sm text-white focus:outline-none focus:border-accent-primary/50 transition-colors resize-none min-h-[40px] max-h-32 rounded-md"
                        disabled={isTyping}
                        rows={1}
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

