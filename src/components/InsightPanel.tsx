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

export function InsightPanel() {
  const { insights, isProcessing, isProcessingSection, refreshSection } = useSituationStore()
  const isLoading = isProcessingSection.insights && !isProcessing;

  return (
    <section className={`relative bg-bg-card backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:border-white/20 ${isLoading ? 'section-loading' : ''}`}>
      {isLoading && (
        <div className="section-loading-overlay">
          <div className="w-8 h-8 border-2 border-accent-secondary border-t-transparent rounded-full animate-spin mb-2"></div>
          <span className="text-[0.6rem] uppercase tracking-widest font-bold text-accent-secondary">Analyzing Trends...</span>
        </div>
      )}

      <div className="flex justify-between items-start mb-6">
        <h2 className="text-xl font-semibold m-0 flex items-center gap-3 text-text-primary font-display">
          <div className="w-1 h-5 bg-accent-secondary rounded-full"></div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          Hidden Insights
        </h2>

        {insights.length > 0 && !isProcessing && (
          <button
            onClick={() => refreshSection('insights')}
            className="text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-all opacity-60 hover:opacity-100"
          >
            Regenerate
          </button>
        )}
      </div>

      {isProcessing && insights.length === 0 ? (
        <ul className="space-y-4 opacity-50">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <li key={i} className="loading-skeleton h-20 bg-white/5 animate-pulse rounded-lg"></li>)}
        </ul>
      ) : (
        <ul className="space-y-4">
          {insights.map((insight, idx) => {
            const parts = insight.text.split('|').map(s => s.trim())
            const trend = parts[0]
            const implication = parts[1]
            const color = getSentimentColor(insight.sentiment)

            return (
              <li key={`${idx}-${insight.text.substring(0, 10)}`}
                className="bg-white/5 border-l-4 p-4 rounded-r-lg group transition-all hover:bg-white/10"
                style={{ borderLeftColor: color }}
              >
                {implication ? (
                  <>
                    <p className="text-[0.65rem] uppercase tracking-widest font-bold mb-1 opacity-80" style={{ color: color }}>
                      {trend.replace(/^Trend:\s*/i, '')}
                    </p>
                    <p className="text-sm text-text-primary leading-snug">
                      {implication.replace(/^Implication:\s*/i, '↳ ')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-text-primary leading-snug">{insight.text}</p>
                )}
              </li>
            )
          })}
          {!isProcessing && insights.length === 0 && <p className="text-text-secondary italic px-4">Waiting for analysis...</p>}
        </ul>
      )}
    </section>
  )
}
