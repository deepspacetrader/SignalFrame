import { useSituationStore } from '../state/useSituationStore'

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

export function SignalList() {
  const { signals, isProcessing, isProcessingSection, refreshSection } = useSituationStore()
  const isLoading = isProcessingSection.signals && !isProcessing;

  return (
    <section className={`relative bg-bg-card backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:border-white/20 ${isLoading ? 'section-loading' : ''}`}>
      {isLoading && (
        <div className="section-loading-overlay">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <span className="text-[0.6rem] uppercase tracking-widest font-bold text-accent-primary">Processing Deltas...</span>
        </div>
      )}

      <div className="flex justify-between items-start mb-6">
        <h2 className="text-xl font-semibold m-0 flex items-center gap-3 text-text-primary font-display">
          <div className="w-1 h-5 bg-accent-primary rounded-full"></div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          Key Signals
        </h2>

        {signals.length > 0 && !isProcessing && (
          <button
            onClick={() => refreshSection('signals')}
            className="text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-all opacity-60 hover:opacity-100"
          >
            Regenerate
          </button>
        )}
      </div>

      {isProcessing && signals.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <div key={i} className="loading-skeleton h-12 bg-white/5 animate-pulse rounded-lg"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {signals.map((signal, idx) => (
            <div key={idx}
              className="bg-white/5 border-l-4 p-4 rounded-r-lg text-text-secondary transition-colors hover:text-text-primary"
              style={{ borderColor: getSentimentColor(signal.sentiment) }}
            >
              {signal.text}
            </div>
          ))}
          {!isProcessing && signals.length === 0 && (
            <div className="col-span-full py-8 text-center border2 border-dashed border-white/5 rounded-xl">
              <p className="text-text-secondary italic">No critical signals identified in this period.</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
