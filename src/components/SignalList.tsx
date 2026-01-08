import { useSituationStore } from '../state/useSituationStore'

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
        <ul className="space-y-3 opacity-50">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <li key={i} className="loading-skeleton h-12 bg-white/5 animate-pulse rounded-lg"></li>)}
        </ul>
      ) : (
        <ul className="space-y-3">
          {signals.map((signal, idx) => (
            <li key={idx} className={`bg-white/5 border-l-4 p-4 rounded-r-lg text-text-secondary transition-colors hover:text-text-primary ${signal.level === 'high' ? 'border-accent-alert' :
              signal.level === 'medium' ? 'border-accent-primary' : 'border-accent-secondary'
              }`}>
              {signal.text}
            </li>
          ))}
          {!isProcessing && signals.length === 0 && <p className="text-text-secondary italic">No signals detected.</p>}
        </ul>
      )}
    </section>
  )
}
