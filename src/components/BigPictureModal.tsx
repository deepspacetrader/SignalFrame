
import { useEffect, useRef } from 'react';
import { useSituationStore } from '../state/useSituationStore';

interface BigPictureModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SENTIMENT_COLORS: Record<string, string> = {
    'extremely-negative': 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]',
    'very-negative': 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]',
    'negative': 'bg-orange-500',
    'somewhat-negative': 'bg-orange-400',
    'neutral': 'bg-slate-400',
    'interesting': 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]',
    'positive': 'bg-emerald-500',
    'very-positive': 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
};

// Basic Markdown Rendering helper
function renderInline(text: string) {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={i} className="italic text-gray-300">{part.slice(1, -1)}</em>;
        }
        return part;
    });
}

function MarkdownDisplay({ content }: { content: string }) {
    if (!content) return null;

    const lines = content.split('\n');
    const nodes: React.ReactNode[] = [];
    let currentList: React.ReactNode[] = [];

    // Process lines
    lines.forEach((line, i) => {
        const trimmed = line.trim();

        // Headers
        if (trimmed.startsWith('### ')) {
            if (currentList.length > 0) {
                nodes.push(<ul key={`list-${i}`} className="list-disc list-outside ml-5 mb-4 space-y-1 text-gray-300">{currentList}</ul>);
                currentList = [];
            }
            nodes.push(<h3 key={i} className="text-lg font-bold text-accent-primary mt-6 mb-3 font-display uppercase tracking-wide">{trimmed.replace('### ', '')}</h3>);
        } else if (trimmed.startsWith('## ')) {
            if (currentList.length > 0) {
                nodes.push(<ul key={`list-${i}`} className="list-disc list-outside ml-5 mb-4 space-y-1 text-gray-300">{currentList}</ul>);
                currentList = [];
            }
            nodes.push(<h2 key={i} className="text-xl font-bold text-white mt-8 mb-4 font-display">{trimmed.replace('## ', '')}</h2>);
        }
        // List items
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const text = trimmed.substring(2);
            currentList.push(<li key={`item-${i}`}>{renderInline(text)}</li>);
        }
        // Empty lines / Spacers
        else if (trimmed === '') {
            if (currentList.length > 0) {
                nodes.push(<ul key={`list-${i}`} className="list-disc list-outside ml-5 mb-4 space-y-1 text-gray-300">{currentList}</ul>);
                currentList = [];
            }
            // Ignore multiple empty lines or render spacer?
        }
        // Paragraphs
        else {
            if (currentList.length > 0) {
                nodes.push(<ul key={`list-${i}`} className="list-disc list-outside ml-5 mb-4 space-y-1 text-gray-300">{currentList}</ul>);
                currentList = [];
            }
            nodes.push(<p key={i} className="text-gray-300 leading-relaxed mb-4 text-[1.05rem]">{renderInline(trimmed)}</p>);
        }
    });

    // Flush remaining list
    if (currentList.length > 0) {
        nodes.push(<ul key="list-final" className="list-disc list-outside ml-5 mb-4 space-y-1 text-gray-300">{currentList}</ul>);
    }

    return <div>{nodes}</div>;
}

export function BigPictureModal({ isOpen, onClose }: BigPictureModalProps) {
    const { bigPicture, generateBigPicture, isProcessingSection } = useSituationStore();
    const isGenerating = isProcessingSection.bigPicture;
    const hasData = bigPicture && bigPicture.timeline.length > 0;

    // Auto-generate if empty and open? Maybe not, let user click.
    // Actually, user said "upon clicking it all of the data so far is ingested...". 
    // So we should probably trigger it if it's null.
    useEffect(() => {
        if (isOpen && !bigPicture && !isGenerating) {
            generateBigPicture();
        }
    }, [isOpen, bigPicture, isGenerating, generateBigPicture]);

    if (!isOpen) return null;

    return (
        <div className="fixed big-picture inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-7xl h-[90vh] bg-[#0a0f18] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative ">

                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-white/2">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-accent-primary/20 rounded-lg">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-primary">
                                <path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold font-display tracking-tight text-white">The Big Picture</h2>
                            <p className="text-xs text-text-secondary uppercase tracking-widest">Historical Intelligence Synthesis</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={generateBigPicture}
                            disabled={isGenerating}
                            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                            {isGenerating ? 'Synthesizing History...' : 'Regenerate Analysis'}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

                    {/* Timeline Sidebar */}
                    <div className="w-full lg:w-1/3 bg-white/2 border-r border-white/5 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <h3 className="text-sm font-bold uppercase text-text-secondary tracking-widest mb-6 sticky top-0 bg-[#0b1019]/90 backdrop-blur py-2 z-10">Temporal Timeline</h3>

                        <div className="relative border-l border-white/10 ml-3 space-y-8">
                            {hasData ? [...bigPicture.timeline].reverse().map((item, idx) => (
                                <div key={idx} className="pl-6 relative group">
                                    <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${SENTIMENT_COLORS[item.sentiment] || 'bg-gray-500'} ring-4 ring-[#0a0f18] transition-all group-hover:scale-125`}></div>
                                    <div className="mb-1 flex items-center gap-2">
                                        <span className="text-[10px] font-mono font-bold text-accent-secondary bg-accent-secondary/10 px-1.5 py-0.5 rounded">{item.date}</span>
                                    </div>
                                    <h4 className="text-sm font-bold text-gray-200 mb-1 leading-snug">{item.title}</h4>
                                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 hover:line-clamp-none transition-all">{item.summary}</p>
                                </div>
                            )) : (
                                <div className="pl-6 text-sm text-gray-500 italic">No historical data available...</div>
                            )}
                        </div>
                    </div>

                    {/* Main Narrative Area */}
                    <div className="flex-1 overflow-y-auto p-8 lg:p-12 relative">
                        {isGenerating ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0f18]/80 backdrop-blur-sm z-20">
                                <div className="w-16 h-16 border-4 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin mb-4"></div>
                                <p className="text-accent-primary font-mono text-sm animate-pulse">INGESTING TELESCOPIC DATA...</p>
                            </div>
                        ) : null}

                        <div className="max-w-3xl mx-auto">
                            <div className="mb-8 p-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/10 rounded-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-20">
                                    <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white">
                                        <circle cx="12" cy="12" r="10" />
                                        <circle cx="12" cy="12" r="6" />
                                        <circle cx="12" cy="12" r="2" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2 font-display">Grand Strategy Assessment</h3>
                                <p className="text-sm text-gray-400">
                                    Comprehensive analysis of {bigPicture?.timeline.length || 0} data points across the observed timeframe.
                                </p>
                            </div>

                            <article className="prose prose-invert prose-lg max-w-none">
                                {bigPicture?.summary ? (
                                    <MarkdownDisplay content={bigPicture.summary} />
                                ) : (
                                    <div className="text-gray-300 italic">Waiting for analysis...</div>
                                )}
                            </article>

                            {/* Footer Stats */}
                            {hasData && (
                                <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-white/10">
                                    <div className="bg-white/5 rounded-lg p-4 text-center">
                                        <div className="text-2xl font-bold text-white">{bigPicture.timeline.length}</div>
                                        <div className="text-[10px] uppercase tracking-widest text-gray-500">Days Analyzed</div>
                                    </div>
                                    <div className="bg-white/5 rounded-lg p-4 text-center">
                                        <div className="text-2xl font-bold text-accent-secondary">
                                            {bigPicture.timeline.filter(t => t.sentiment.includes('negative')).length}
                                        </div>
                                        <div className="text-[10px] uppercase tracking-widest text-gray-500">Crisis Points</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
