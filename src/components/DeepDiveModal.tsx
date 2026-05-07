import { useEffect, useMemo } from 'react'
import { Modal } from './shared/Modal'
import { DeepDiveData, Sentiment } from '../state/useSituationStore'
import { SectionBadge } from './shared/SectionBadge'
import { SectionRegenerateButton } from './shared/SectionRegenerateButton'
import { TTSButton } from './TTSButton'

interface DeepDiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: DeepDiveData | null;
    isGenerating?: boolean;
    onAIRequired?: () => void;
    regenerateDeepDive?: (signalId: string) => void;
    activeSignalId?: string | null;
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

// Construct spoken text from deep dive data
const constructSpeechText = (data: DeepDiveData): string => {
    const parts: string[] = [];
    
    // Title and category
    parts.push(`Deep Dive Analysis: ${data.header.title}`);
    if (data.header.category) {
        parts.push(`Category: ${data.header.category}`);
    }
    parts.push(`Sentiment: ${data.header.sentiment.replace('-', ' ')}`);
    
    // Briefing summary
    if (data.header.text) {
        parts.push(`Briefing Summary: ${data.header.text}`);
    }
    
    // 5Ws Analysis
    const fiveWsParts: string[] = [];
    if (data.fiveWs.who?.length) {
        fiveWsParts.push(`Who: ${data.fiveWs.who.join(', ')}`);
    }
    if (data.fiveWs.what) {
        fiveWsParts.push(`What: ${data.fiveWs.what}`);
    }
    if (data.fiveWs.when) {
        fiveWsParts.push(`When: ${data.fiveWs.when}`);
    }
    if (data.fiveWs.where) {
        fiveWsParts.push(`Where: ${data.fiveWs.where}`);
    }
    if (data.fiveWs.why) {
        fiveWsParts.push(`Why: ${data.fiveWs.why}`);
    }
    if (data.fiveWs.soWhat) {
        fiveWsParts.push(`Strategic Significance: ${data.fiveWs.soWhat}`);
    }
    
    if (fiveWsParts.length > 0) {
        parts.push(`Intelligence Breakdown: ${fiveWsParts.join('. ')}`);
    }
    
    // Perspectives
    if (data.perspectives?.length) {
        const perspectiveTexts = data.perspectives.map((p, i) => 
            `Perspective ${String.fromCharCode(65 + i)} from ${p.entity}: ${p.claim}`
        );
        parts.push(`Main Perspectives: ${perspectiveTexts.join('. ')}`);
    }
    
    // Watch items
    if (data.watchNext?.length) {
        parts.push(`Watch For: ${data.watchNext.join('. ')}`);
    }
    
    return parts.join('.\n\n');
}

export function DeepDiveModal({ isOpen, onClose, data, isGenerating, onAIRequired, regenerateDeepDive, activeSignalId }: DeepDiveModalProps) {

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} modalId="deep-dive-modal">
            <div className="bg-bg-card border border-white/10 p-0 max-w-6xl w-full max-h-[90vh] overflow-hidden relative shadow-2xl flex flex-col">
                {/* Header Section */}
                <div className="p-4 sm:p-6 lg:p-8 border-b border-white/5 bg-gradient-to-br from-white/5 to-transparent relative pt-16 sm:pt-20 lg:pt-24">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 text-white hover:text-white hover:bg-accent-primary transition-colors rounded-full z-10"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>

                    {/* Regenerate button - only show when data exists and not generating */}
                    {data && !isGenerating && regenerateDeepDive && activeSignalId && (
                        <div className="absolute top-4 right-12 sm:top-6 sm:right-16 z-10 mr-5 mt-1">
                            <SectionRegenerateButton
                                onClick={() => {
                                    regenerateDeepDive(activeSignalId);
                                }}
                                disabled={isGenerating}
                            />
                        </div>
                    )}

                    {isGenerating ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 rounded-full border-4 border-accent-primary/20 border-t-accent-primary animate-spin mb-6"></div>
                            <h2 className="text-xl font-bold text-text-primary mb-2 italic">Generating Deep Intelligence Analysis...</h2>
                            <p className="text-text-secondary text-sm max-w-md">AI is cross-referencing multiple sources to provide a comprehensive breakdown of this signal.</p>
                        </div>
                    ) : !data ? (
                        <div className="py-12 text-center">
                            <p className="text-text-secondary italic">No data available for this deep dive.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                <SectionBadge tone="accent">Deep Dive Analysis</SectionBadge>
                                {data.header.category && (
                                    <span className="px-2 py-1 bg-slate-500/20 text-slate-300 text-[0.6rem] sm:text-[0.65rem] uppercase tracking-widest font-bold">
                                        {data.header.category}
                                    </span>
                                )}
                                <span className="text-[0.55rem] sm:text-[0.6rem] text-text-tertiary uppercase tracking-widest">
                                    Generated: {new Date(data.generatedAt).toLocaleString()}
                                </span>
                                <div className="ml-auto">
                                    <TTSButton text={constructSpeechText(data)} />
                                </div>
                            </div>

                            <h2 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-text-primary mb-4 leading-tight tracking-tight">
                                {data.header.title}
                            </h2>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-[0.65rem] uppercase tracking-widest text-text-secondary font-bold">Status Assessment:</span>
                                    <span
                                        className="px-3 py-1 text-white text-[0.65rem] font-bold uppercase tracking-wider"
                                        style={{ backgroundColor: getSentimentColor(data.header.sentiment) }}
                                    >
                                        {data.header.sentiment.replace('-', ' ')}
                                    </span>
                                </div>
                                {data.header.deltaType && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[0.65rem] uppercase tracking-widest text-text-secondary font-bold">Vector:</span>
                                        <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-[0.65rem] font-bold uppercase tracking-wider border border-purple-500/20">
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
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 xl:gap-10">

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

                                <section className="bg-white/5 border border-white/10 p-6 shadow-inner">
                                    <h3 className="text-[0.7rem] uppercase tracking-[0.2em] text-accent-primary font-bold mb-6 flex items-center gap-2">
                                        <span className="w-4 h-[1px] bg-accent-primary"></span>
                                        Intelligence Breakdown (5Ws)
                                    </h3>
                                    <div className="space-y-5">
                                        {data.fiveWs.who && data.fiveWs.who.length > 0 && (
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <div className="w-16 shrink-0 text-[0.6rem] uppercase font-black text-text-tertiary bg-white/5 h-6 flex items-center justify-center border border-white/5">WHO</div>
                                                <div className="text-text-primary text-sm font-medium leading-snug">
                                                    {data.fiveWs.who.join(', ')}
                                                </div>
                                            </div>
                                        )}
                                        {data.fiveWs.what && (
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <div className="w-16 shrink-0 text-[0.6rem] uppercase font-black text-text-tertiary bg-white/5 h-6 flex items-center justify-center border border-white/5">WHAT</div>
                                                <div className="text-text-primary text-sm font-medium leading-snug">{data.fiveWs.what}</div>
                                            </div>
                                        )}
                                        {data.fiveWs.when && (
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <div className="w-16 shrink-0 text-[0.6rem] uppercase font-black text-text-tertiary bg-white/5 h-6 flex items-center justify-center border border-white/5">WHEN</div>
                                                <div className="text-text-primary text-sm font-medium leading-snug">{data.fiveWs.when}</div>
                                            </div>
                                        )}
                                        {data.fiveWs.where && (
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <div className="w-16 shrink-0 text-[0.6rem] uppercase font-black text-text-tertiary bg-white/5 h-6 flex items-center justify-center border border-white/5">WHERE</div>
                                                <div className="text-text-primary text-sm font-medium leading-snug">{data.fiveWs.where}</div>
                                            </div>
                                        )}
                                        {data.fiveWs.why && (
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <div className="w-16 shrink-0 text-[0.6rem] uppercase font-black text-text-tertiary bg-white/5 h-6 flex items-center justify-center border border-white/5">WHY</div>
                                                <div className="text-text-secondary text-sm font-medium italic leading-snug">{data.fiveWs.why}</div>
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

                                {data.watchNext && data.watchNext.length > 0 && (
                                    <section className="bg-accent-primary/5 border border-accent-primary/20 p-5 mt-auto">
                                        <h3 className="text-[0.65rem] uppercase tracking-widest text-accent-primary font-bold mb-4 flex items-center gap-2">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                            Watch For
                                        </h3>
                                        <ul className="space-y-2">
                                            {(Array.isArray(data.watchNext) ? data.watchNext : []).map((item, idx) => (
                                                <li key={idx} className="text-xs text-text-primary flex items-start gap-2">
                                                    <span className="text-accent-primary mt-0.5">•</span>
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}

                            </div>

                            {/* Right Column: Source & Counterpoints */}
                            <div className="space-y-8">
                                <section>
                                    <h3 className="text-[0.7rem] uppercase tracking-[0.2em] text-accent-secondary font-bold mb-4 flex items-center gap-2">
                                        <span className="w-4 h-[1px] bg-accent-secondary"></span>
                                        Source References
                                    </h3>
                                    <div className="space-y-3">
                                        {data.source.map((item, idx) => (
                                            item.link ? (
                                                <a
                                                    key={idx}
                                                    href={item.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block bg-white/5 border border-white/5 p-4 transition-all hover:bg-white/10 hover:border-accent-secondary/30"
                                                >
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
                                                </a>
                                            ) : (
                                                <div key={idx} className="bg-white/5 border border-white/5 p-4 transition-all hover:bg-white/10">
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
                                                </div>
                                            )
                                        ))}
                                    </div>
                                </section>

                                {data.perspectives && data.perspectives.length > 0 && (
                                    <section>
                                        <h3 className="text-[0.7rem] uppercase tracking-[0.2em] text-orange-400 font-bold mb-4 flex items-center gap-2">
                                            <span className="w-4 h-[1px] bg-orange-400"></span>
                                            Main Perspectives
                                        </h3>
                                        <div className="space-y-4">
                                            {data.perspectives.map((perspective, idx) => {
                                                const letter = String.fromCharCode(65 + idx);
                                                // Fixed blue hue (210), varying lightness from light to dark
                                                const hue = 35; // Pure blue
                                                const lightness = 70 - (idx * 10) % 50; // From 75% (light) down to 30% (dark)
                                                const borderOpacity = 0.1;
                                                const badgeBgOpacity = 0.1;
                                                const bgColor = `hsla(${hue}, 70%, ${lightness}%, 0.05)`;
                                                const badgeBorderOpacity = 0.2;
                                                const textHue = hue;
                                                return (
                                                    <div key={idx} style={{ backgroundColor: bgColor, borderColor: `hsla(${hue}, 70%, ${lightness}%, ${borderOpacity})` }} className="border p-4">
                                                        <div className="flex items-start gap-2 mb-2">
                                                            <span className="text-xs text-text-tertiary  tracking-widest p-1 border" style={{ backgroundColor: bgColor, borderColor: `hsla(${hue}, 70%, ${lightness}%, ${borderOpacity})` }}>{perspective.entity}</span>
                                                        </div>
                                                        <p className="leading-snug font-bold" style={{ color: `hsl(${textHue}, 70%, ${Math.min(lightness + 10, 90)}%)` }}>{perspective.claim}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
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
