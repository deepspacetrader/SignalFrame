
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
        switch (sentiment) {
            case 'extremely-negative': return { color: 'var(--crit-bright-red)', borderColor: 'rgba(255, 31, 31, 0.3)', backgroundColor: 'rgba(255, 31, 31, 0.1)' }
            case 'very-negative': return { color: 'var(--crit-red)', borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.1)' }
            case 'negative': return { color: 'var(--crit-orange)', borderColor: 'rgba(249, 115, 22, 0.3)', backgroundColor: 'rgba(249, 115, 22, 0.1)' }
            case 'somewhat-negative': return { color: 'var(--crit-yellow)', borderColor: 'rgba(250, 204, 21, 0.3)', backgroundColor: 'rgba(250, 204, 21, 0.1)' }
            case 'neutral': return { color: 'var(--crit-gray)', borderColor: 'rgba(148, 163, 184, 0.3)', backgroundColor: 'rgba(148, 163, 184, 0.1)' }
            case 'interesting': return { color: 'var(--crit-blue)', borderColor: 'rgba(59, 130, 246, 0.3)', backgroundColor: 'rgba(59, 130, 246, 0.1)' }
            case 'positive': return { color: 'var(--crit-green)', borderColor: 'rgba(34, 197, 94, 0.3)', backgroundColor: 'rgba(34, 197, 94, 0.1)' }
            case 'very-positive': return { color: 'var(--crit-bright-green)', borderColor: 'rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.1)' }
            default: return { color: 'var(--crit-gray)', borderColor: 'rgba(148, 163, 184, 0.2)', backgroundColor: 'rgba(148, 163, 184, 0.05)' }
        }
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
                            Sync
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

            <div className="space-y-4">
                {foreignRelations.map((rel) => (
                    <div key={rel.id} className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 p-4 rounded-lg transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">{rel.countryA}</span>
                                <span className="text-text-secondary text-xs">↔</span>
                                <span className="text-sm font-bold text-white">{rel.countryB}</span>
                            </div>
                            <span
                                className="text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wider"
                                style={getSentimentColor(String(rel.sentiment || 'neutral'))}
                            >
                                {String(rel.sentiment || 'neutral').replace('-', ' ')}
                            </span>
                        </div>

                        <p className="text-xs font-mono text-purple-400 mb-2 uppercase tracking-wide opacity-80">{rel.topic}</p>

                        <div className="relative">
                            {isProcessing ? (
                                <div className="h-10 w-full bg-white/5 animate-pulse rounded"></div>
                            ) : (
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    {rel.status}
                                </p>
                            )}
                        </div>

                        <button
                            onClick={() => removeRelation(rel.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-400 transition-all p-1"
                            title="Remove Tracker"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                ))}

                {foreignRelations.length === 0 && (
                    <div className="text-center py-8 text-text-secondary italic text-sm border border-dashed border-white/10 rounded-lg">
                        No active relation trackers. Add one above.
                    </div>
                )}
            </div>
        </section>
    )
}
