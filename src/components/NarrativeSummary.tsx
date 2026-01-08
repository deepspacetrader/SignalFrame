import { useSituationStore } from '../state/useSituationStore'

export function NarrativeSummary() {
  const { narrative, isProcessing, isProcessingSection, refreshSection } = useSituationStore()
  const isLoading = isProcessingSection.narrative && !isProcessing;

  return (
    <section className={`relative bg-bg-card backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:border-white/20 ${isLoading ? 'section-loading' : ''}`}>
      {isLoading && (
        <div className="section-loading-overlay">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <span className="text-[0.6rem] uppercase tracking-widest font-bold text-accent-primary">Regenerating Briefing...</span>
        </div>
      )}

      <div className="flex justify-between items-start mb-6">
        <h2 className="text-xl font-semibold m-0 flex items-center gap-3 text-text-primary font-display">
          <div className="w-1 h-5 bg-accent-primary rounded-full"></div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          Current Narrative
        </h2>

        {narrative && !isProcessing && (
          <button
            onClick={() => refreshSection('narrative')}
            className="text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-all opacity-60 hover:opacity-100"
          >
            Regenerate
          </button>
        )}
      </div>

      {isProcessing && !narrative ? (
        <div className="loading-skeleton h-24 bg-white/5 animate-pulse rounded"></div>
      ) : (
        <p className="text-lg text-text-primary leading-relaxed whitespace-pre-wrap">
          {narrative || "No narrative generated yet. Start a scan to begin."}
        </p>
      )}
    </section>
  )
}
