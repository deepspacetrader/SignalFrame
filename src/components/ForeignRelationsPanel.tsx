
import { useState } from 'react'
import { useSituationStore } from '../state/useSituationStore'

export function ForeignRelationsPanel() {
    const { foreignRelations, addRelation, removeRelation, isProcessing, isProcessingSection, refreshSection } = useSituationStore()
    const [isAdding, setIsAdding] = useState(false)
    const [newRel, setNewRel] = useState({ countryA: '', countryB: '', topic: '' })

    const isLoading = isProcessingSection.relations && !isProcessing;

    const handleAdd = () => {
        if (newRel.countryA && newRel.countryB && newRel.topic) {
            addRelation(newRel.countryA, newRel.countryB, newRel.topic)
            setNewRel({ countryA: '', countryB: '', topic: '' })
            setIsAdding(false)
        }
    }

    // Helper to get sentiment color
    const getSentimentColor = (sentiment: string) => {
        const s = sentiment.trim().toLowerCase()

        // Define mapping for numeric or legacy strings
        const sentimentMap: Record<string, string> = {
            '1': 'extremely-negative',
            '2': 'very-negative',
            '3': 'negative',
            '4': 'somewhat-negative',
            '5': 'neutral',
            '6': 'interesting',
            '7': 'positive',
            '8': 'very-positive',
            'tension': 'negative',
            'conflict': 'extremely-negative'
        };

        const resolved = sentimentMap[s] || s;

        if (resolved.includes('extremely-negative')) return { color: '#ff1f1f', borderColor: 'rgba(255, 31, 31, 0.4)', backgroundColor: 'rgba(255, 31, 31, 0.15)', text: 'EXTREMELY NEGATIVE' }
        if (resolved.includes('very-negative')) return { color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.15)', text: 'VERY NEGATIVE' }
        if (resolved.includes('negative')) return { color: '#f97316', borderColor: 'rgba(249, 115, 22, 0.4)', backgroundColor: 'rgba(249, 115, 22, 0.15)', text: 'NEGATIVE' }
        if (resolved.includes('somewhat-negative')) return { color: '#facc15', borderColor: 'rgba(250, 204, 21, 0.4)', backgroundColor: 'rgba(250, 204, 21, 0.15)', text: 'SOMEWHAT NEGATIVE' }
        if (resolved.includes('neutral')) return { color: '#94a3b8', borderColor: 'rgba(148, 163, 184, 0.4)', backgroundColor: 'rgba(148, 163, 184, 0.15)', text: 'NEUTRAL' }
        if (resolved.includes('interesting')) return { color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.4)', backgroundColor: 'rgba(59, 130, 246, 0.15)', text: 'INTERESTING' }
        if (resolved.includes('very-positive')) return { color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)', backgroundColor: 'rgba(16, 185, 129, 0.15)', text: 'VERY POSITIVE' }
        if (resolved.includes('positive')) return { color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.4)', backgroundColor: 'rgba(34, 197, 94, 0.15)', text: 'POSITIVE' }

        // Fallback for unexpected strings or numbers
        return { color: 'var(--crit-gray)', borderColor: 'rgba(148, 163, 184, 0.2)', backgroundColor: 'rgba(148, 163, 184, 0.05)', text: resolved.toUpperCase() }
    }



    return (
        <section className={`relative bg-bg-card backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:border-white/20 ${isLoading ? 'section-loading' : ''}`}>
            {isLoading && (
                <div className="section-loading-overlay">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <span className="text-[0.6rem] uppercase tracking-widest font-bold text-purple-400">Updating Relation Status...</span>
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-3 text-text-primary font-display">
                    <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M2 12h20"></path>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    Foreign Relations
                </h2>

                <div className="flex gap-2">
                    {foreignRelations.length > 0 && !isProcessing && (
                        <button
                            onClick={() => refreshSection('relations')}
                            className="text-[0.65rem] uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg border bg-white/5 border-white/10 text-white hover:bg-white/10 transition-all opacity-60 hover:opacity-100"
                        >
                            Update
                        </button>
                    )}
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className={`text-[0.65rem] uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg border transition-all duration-300 ${isAdding
                            ? 'bg-red-500/20 border-red-500/50 text-red-200 hover:bg-red-500/40'
                            : 'bg-white/5 border-white/10 text-white hover:bg-accent-primary hover:border-accent-primary'
                            }`}
                    >
                        {isAdding ? 'Close' : '+ Add'}
                    </button>
                </div>
            </div>

            {isAdding && (
                <div className="mb-6 bg-white/5 p-4 rounded-lg border border-white/10 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <input
                            placeholder="Country A (e.g. USA)"
                            className="bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-accent-primary outline-none"
                            value={newRel.countryA}
                            onChange={e => setNewRel({ ...newRel, countryA: e.target.value })}
                        />
                        <input
                            placeholder="Country B (e.g. China)"
                            className="bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-accent-primary outline-none"
                            value={newRel.countryB}
                            onChange={e => setNewRel({ ...newRel, countryB: e.target.value })}
                        />
                    </div>
                    <input
                        placeholder="Topic (e.g. Trade Tariffs)"
                        className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-accent-primary outline-none mb-3"
                        value={newRel.topic}
                        onChange={e => setNewRel({ ...newRel, topic: e.target.value })}
                    />
                    <button
                        onClick={handleAdd}
                        disabled={!newRel.countryA || !newRel.countryB}
                        className="w-full bg-accent-primary hover:bg-accent-primary/80 text-white font-bold py-2 rounded text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
                    >
                        Initialize Tracker
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {foreignRelations.map((rel) => (
                    <div key={rel.id} className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 p-4 rounded-xl transition-all flex flex-col justify-between h-full">
                        <div>
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-bold text-white tracking-tight">{rel.countryA}</span>
                                        <span className="text-text-secondary text-[10px] opacity-40">VS</span>
                                        <span className="text-sm font-bold text-white tracking-tight">{rel.countryB}</span>
                                    </div>
                                    <p className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider opacity-80">{rel.topic}</p>
                                </div>
                                {(() => {
                                    const style = getSentimentColor(String(rel.sentiment || 'neutral'));
                                    return (
                                        <span
                                            className="text-[8px] px-2 py-1 rounded-md border uppercase font-bold tracking-[0.05em] shrink-0 whitespace-nowrap"
                                            style={{ color: style.color, borderColor: style.borderColor, backgroundColor: style.backgroundColor }}
                                        >
                                            {style.text}
                                        </span>
                                    );
                                })()}

                            </div>

                            <div className="relative min-h-[3rem]">
                                {isProcessing ? (
                                    <div className="space-y-2">
                                        <div className="h-3 w-full bg-white/5 animate-pulse rounded"></div>
                                        <div className="h-3 w-[80%] bg-white/5 animate-pulse rounded"></div>
                                    </div>
                                ) : (
                                    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5 mt-1">
                                        <p className="text-[11px] text-text-secondary leading-normal line-clamp-4 group-hover:line-clamp-none transition-all duration-300">
                                            {rel.status}
                                        </p>
                                    </div>
                                )}

                            </div>
                        </div>

                        <button
                            onClick={() => removeRelation(rel.id)}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10 border border-white/20"
                            title="Remove Tracker"
                        >
                            <span className="text-sm leading-none font-bold">&times;</span>
                        </button>
                    </div>
                ))}

                {foreignRelations.length === 0 && (
                    <div className="col-span-full text-center py-12 text-text-secondary italic text-sm border border-dashed border-white/10 rounded-xl">
                        No active relation trackers. Add one above.
                    </div>
                )}
            </div>
        </section>
    )
}
