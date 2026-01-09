import { useSituationStore } from '../state/useSituationStore'

const getSentimentColor = (sentiment: string) => {
  const s = sentiment.trim().toLowerCase()
  const mapping: Record<string, string> = {
    '1': 'extremely-negative', '2': 'very-negative', '3': 'negative', '4': 'somewhat-negative',
    '5': 'neutral', '6': 'interesting', '7': 'positive', '8': 'very-positive'
  }
  const resolved = mapping[s] || s

  if (resolved.includes('extremely-negative')) return 'var(--crit-bright-red)';
  if (resolved.includes('very-negative')) return 'var(--crit-red)';
  if (resolved.includes('negative')) return 'var(--crit-orange)';
  if (resolved.includes('somewhat-negative')) return 'var(--crit-yellow)';
  if (resolved.includes('neutral')) return 'var(--crit-gray)';
  if (resolved.includes('interesting')) return 'var(--crit-blue)';
  if (resolved.includes('positive')) return 'var(--crit-green)';
  if (resolved.includes('very-positive')) return 'var(--crit-bright-green)';
  return 'var(--crit-gray)';
}

export function InsightPanel() {
  const { insights, feeds, isProcessing, isProcessingSection, refreshSection } = useSituationStore()
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

        {feeds.length > 0 && !isProcessing && (
          <button
            onClick={() => refreshSection('insights')}
            className="text-[0.6rem] uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all opacity-60 hover:opacity-100 flex items-center gap-2"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6"></path>
              <path d="M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            {insights.length > 0 ? 'Regenerate' : 'Analyze'}
          </button>
        )}
      </div>

      {isProcessing && insights.length === 0 ? (
        <ul className="space-y-4 opacity-50">
          {[1, 2, 3, 4, 5].map(i => <li key={i} className="loading-skeleton h-20 bg-white/5 animate-pulse rounded-lg"></li>)}
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
                  <p className="text-sm text-text-primary leading-snug font-medium opacity-90">{insight.text}</p>
                )}
              </li>
            )
          })}
          {!isProcessing && insights.length === 0 && (
            <div className="text-center py-8 opacity-40">
              <p className="text-xs uppercase tracking-widest font-bold mb-2">No Insights Detected</p>
              <p className="text-[10px] italic">Scan feeds to identify hidden trends.</p>
            </div>
          )}
        </ul>
      )}
    </section>
  )
}
