import { Modal } from './shared/Modal'
import { DeepDiveData, Sentiment } from '../state/useSituationStore'
import { SectionBadge } from './shared/SectionBadge'

interface DeepDiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: DeepDiveData | null;
    isGenerating?: boolean;
}

const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
        case 'extremely-negative': return 'var(--crit-bright-red)';
        case 'very-negative': return 'var(--crit-red)';
        case 'negative': return 'var(--crit-orange)';
        case 'somewhat-negative': return 'var(--crit-yellow)';
        case 'neutral': return 'var(--crit-gray)';
        case 'interesting': return 'var(--crit-blue)';
        case 'positive': return 'var(--crit-green)';
        case 'very-positive': return 'var(--crit-bright-green)';
        default: return 'var(--crit-gray)';
    }
}

export function DeepDiveModal({ isOpen, onClose, data, isGenerating }: DeepDiveModalProps) {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} modalId="deep-dive-modal">
            <div className="bg-bg-card border border-white/10 rounded-2xl p-0 max-w-4xl w-full max-h-[90vh] overflow-hidden relative shadow-2xl flex flex-col">
                {/* Header Section */}
                <div className="p-8 border-b border-white/5 bg-gradient-to-br from-white/5 to-transparent relative">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 text-text-tertiary hover:text-white transition-colors rounded-full hover:bg-white/5"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>

                    {isGenerating ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 border-4 border-accent-primary/20 border-t-accent-primary rounded-full animate-spin mb-6"></div>
                            <h2 className="text-xl font-bold text-text-primary mb-2 italic">Generating Deep Intelligence Analysis...</h2>
                            <p className="text-text-secondary text-sm max-w-md">AI is cross-referencing multiple sources to provide a comprehensive breakdown of this signal.</p>
                        </div>
                    ) : !data ? (
                        <div className="py-12 text-center">
                            <p className="text-text-secondary italic">No data available for this deep dive.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 mb-4">
                                <SectionBadge tone="accent">Deep Dive Analysis</SectionBadge>
                                {data.header.category && (
                                    <span className="px-2 py-1 rounded bg-slate-500/20 text-slate-300 text-[0.65rem] uppercase tracking-widest font-bold">
                                        {data.header.category}
                                    </span>
                                )}
                                <span className="text-[0.6rem] text-text-tertiary uppercase tracking-widest ml-auto">
                                    Generated: {new Date(data.generatedAt).toLocaleString()}
                                </span>
                            </div>

                            <h2 className="text-3xl font-bold text-text-primary mb-4 leading-tight tracking-tight">
                                {data.header.title}
                            </h2>

                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-[0.65rem] uppercase tracking-widest text-text-secondary font-bold">Status Assessment:</span>
                                    <span
                                        className="px-3 py-1 rounded-full text-white text-[0.65rem] font-bold uppercase tracking-wider"
                                        style={{ backgroundColor: getSentimentColor(data.header.sentiment) }}
                                    >
                                        {data.header.sentiment.replace('-', ' ')}
                                    </span>
                                </div>
                                {data.header.deltaType && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[0.65rem] uppercase tracking-widest text-text-secondary font-bold">Vector:</span>
                                        <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-[0.65rem] font-bold uppercase tracking-wider border border-purple-500/20">
                                            {data.header.deltaType}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Content Section - Scrollable */}
                {data && !isGenerating && (
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

                            {/* Left Column: Summary & 5Ws */}
                            <div className="space-y-8">
                                <section>
                                    <h3 className="text-[0.7rem] uppercase tracking-[0.2em] text-accent-secondary font-bold mb-4 flex items-center gap-2">
                                        <span className="w-4 h-[1px] bg-accent-secondary"></span>
                                        Briefing Summary
                                    </h3>
                                    <p className="text-text-secondary text-base leading-relaxed">
                                        {data.header.text}
                                    </p>
                                </section>

                                <section className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-inner">
                                    <h3 className="text-[0.7rem] uppercase tracking-[0.2em] text-accent-primary font-bold mb-6 flex items-center gap-2">
                                        <span className="w-4 h-[1px] bg-accent-primary"></span>
                                        Intelligence Breakdown (5Ws)
                                    </h3>
                                    <div className="space-y-5">
                                        {data.fiveWs.who && data.fiveWs.who.length > 0 && (
                                            <div className="flex gap-4">
                                                <div className="w-16 shrink-0 text-[0.6rem] uppercase font-black text-text-tertiary bg-white/5 rounded h-6 flex items-center justify-center border border-white/5">WHO</div>
                                                <div className="flex flex-wrap gap-2 text-text-primary text-sm font-medium">
                                                    {data.fiveWs.who.join(', ')}
                                                </div>
                                            </div>
                                        )}
                                        {data.fiveWs.what && (
                                            <div className="flex gap-4">
                                                <div className="w-16 shrink-0 text-[0.6rem] uppercase font-black text-text-tertiary bg-white/5 rounded h-6 flex items-center justify-center border border-white/5">WHAT</div>
                                                <div className="text-text-primary text-sm leading-snug">{data.fiveWs.what}</div>
                                            </div>
                                        )}
                                        {data.fiveWs.where && (
                                            <div className="flex gap-4">
                                                <div className="w-16 shrink-0 text-[0.6rem] uppercase font-black text-text-tertiary bg-white/5 rounded h-6 flex items-center justify-center border border-white/5">WHERE</div>
                                                <div className="text-text-primary text-sm font-medium">{data.fiveWs.where}</div>
                                            </div>
                                        )}
                                        {data.fiveWs.when && (
                                            <div className="flex gap-4">
                                                <div className="w-16 shrink-0 text-[0.6rem] uppercase font-black text-text-tertiary bg-white/5 rounded h-6 flex items-center justify-center border border-white/5">WHEN</div>
                                                <div className="text-text-primary text-sm">{data.fiveWs.when}</div>
                                            </div>
                                        )}
                                        {data.fiveWs.why && (
                                            <div className="flex gap-4">
                                                <div className="w-16 shrink-0 text-[0.6rem] uppercase font-black text-text-tertiary bg-white/5 rounded h-6 flex items-center justify-center border border-white/5">WHY</div>
                                                <div className="text-text-secondary text-sm italic leading-snug">{data.fiveWs.why}</div>
                                            </div>
                                        )}
                                        {data.fiveWs.soWhat && (
                                            <div className="mt-8 pt-6 border-t border-white/10">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-secondary">
                                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                                        <line x1="12" y1="9" x2="12" y2="13" />
                                                        <line x1="12" y1="17" x2="12.01" y2="17" />
                                                    </svg>
                                                    <span className="text-[0.65rem] uppercase tracking-widest text-accent-secondary font-black">Strategic Significance</span>
                                                </div>
                                                <p className="text-text-primary text-sm font-bold leading-relaxed border-l-2 border-accent-secondary pl-4 py-1">
                                                    {data.fiveWs.soWhat}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>

                            {/* Right Column: Evidence & Counterpoints */}
                            <div className="space-y-8">
                                <section>
                                    <h3 className="text-[0.7rem] uppercase tracking-[0.2em] text-accent-secondary font-bold mb-4 flex items-center gap-2">
                                        <span className="w-4 h-[1px] bg-accent-secondary"></span>
                                        Source References
                                    </h3>
                                    <div className="space-y-3">
                                        {data.evidence.map((item, idx) => (
                                            <div key={idx} className="bg-white/5 border border-white/5 rounded-lg p-4 transition-all hover:bg-white/10">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[0.65rem] font-bold text-accent-primary">{item.source}</span>
                                                    {item.timestamp && (
                                                        <span className="text-[0.55rem] text-text-tertiary uppercase">{new Date(item.timestamp).toLocaleDateString()}</span>
                                                    )}
                                                </div>
                                                <h4 className="text-xs font-semibold text-text-primary mb-2 leading-tight">{item.title}</h4>
                                                {item.quote && (
                                                    <p className="text-xs italic text-text-secondary border-l border-white/10 pl-3 mb-2">{item.quote}</p>
                                                )}
                                                {item.link && (
                                                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[0.6rem] text-accent-secondary hover:underline flex items-center gap-1">
                                                        Open Article ↗
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {data.counterpoints && data.counterpoints.length > 0 && (
                                    <section>
                                        <h3 className="text-[0.7rem] uppercase tracking-[0.2em] text-orange-400 font-bold mb-4 flex items-center gap-2">
                                            <span className="w-4 h-[1px] bg-orange-400"></span>
                                            Main Perspectives
                                        </h3>
                                        <div className="space-y-4">
                                            {data.counterpoints.map((cp, idx) => (
                                                <div key={idx} className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <p className="text-[0.6rem] uppercase tracking-widest text-red-400 font-bold mb-1">Perspective A</p>
                                                            <p className="text-xs text-text-primary font-medium leading-snug">{cp.claimA}</p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-[0.6rem] uppercase tracking-widest text-blue-400 font-bold mb-1">Perspective B</p>
                                                            <p className="text-xs text-text-primary font-medium leading-snug">{cp.claimB}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {data.watchNext && data.watchNext.length > 0 && (
                                    <section className="bg-accent-primary/5 border border-accent-primary/20 rounded-xl p-5 mt-auto">
                                        <h3 className="text-[0.65rem] uppercase tracking-widest text-accent-primary font-bold mb-4 flex items-center gap-2">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                            Watch For
                                        </h3>
                                        <ul className="space-y-2">
                                            {data.watchNext.map((item, idx) => (
                                                <li key={idx} className="text-xs text-text-primary flex items-start gap-2">
                                                    <span className="text-accent-primary mt-0.5">•</span>
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer info */}
                {data && !isGenerating && (
                    <div className="p-4 bg-white/2 border-t border-white/5 text-center">
                        <p className="text-[0.6rem] text-text-tertiary uppercase tracking-widest">
                            Framework Identity: SI-7764-B • SignalFrame Intelligence Node
                        </p>
                    </div>
                )}
            </div>
        </Modal>
    );
}
