import { useState } from 'react'
import { useSituationStore } from '../state/useSituationStore'
import { JsonErrorDisplay } from './JsonErrorDisplay'
import { RawOutputModal } from './RawOutputModal'

const getSentimentColor = (sentiment: string) => {
  const s = sentiment.trim().toLowerCase()
  const mapping: Record<string, string> = {
    '1': 'extremely-negative', '2': 'very-negative', '3': 'negative', '4': 'somewhat-negative',
    '5': 'neutral', '6': 'interesting', '7': 'positive', '8': 'very-positive'
  }
  const resolved = mapping[s] || s

  if (resolved.includes('very-negative')) return 'var(--crit-red)';
  if (resolved.includes('negative')) return 'var(--crit-orange)';
  if (resolved.includes('somewhat-negative')) return 'var(--crit-yellow)';
  if (resolved.includes('neutral')) return 'var(--crit-gray)';
  if (resolved.includes('interesting')) return 'var(--crit-blue)';
  if (resolved.includes('very-positive')) return 'var(--crit-bright-green)';
  if (resolved.includes('positive')) return 'var(--crit-green)';
  return 'var(--crit-gray)';
}

const sentimentOrder = {
  'extremely-negative': 0,
  'very-negative': 1,
  'negative': 2,
  'somewhat-negative': 3,
  'neutral': 4,
  'interesting': 5,
  'positive': 6,
  'very-positive': 7
};

export function HiddenInsights() {
  const { 
    insights, 
    feeds, 
    isProcessing, 
    isProcessingSection, 
    refreshSection, 
    jsonError, 
    clearJsonError, 
    retryJsonSection,
    rawOutputs,
    activeRawOutput,
    showRawOutput,
    hideRawOutput,
    clearSection,
    sourceCredibility
  } = useSituationStore()
  const [sortBy, setSortBy] = useState<'none' | 'pos-neg' | 'neg-pos'>('none')
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null)
  const isLoading = isProcessingSection.insights && !isProcessing;

  const sortedInsights = [...insights].sort((a, b) => {
    if (sortBy === 'none') return 0;
    
    const orderA = sentimentOrder[a.sentiment as keyof typeof sentimentOrder] ?? 4;
    const orderB = sentimentOrder[b.sentiment as keyof typeof sentimentOrder] ?? 4;
    
    return sortBy === 'pos-neg' ? orderB - orderA : orderA - orderB;
  });

  const summarizeEvidence = (evidence: NonNullable<typeof insights[number]['evidence']>) => {
    if (!evidence || evidence.length === 0) {
      return { uniqueSources: [], credibilityScore: null };
    }

    const uniqueSources = Array.from(new Set(
      evidence.map(item => (item.source || '').trim()).filter(Boolean)
    ));

    if (uniqueSources.length === 0) {
      return { uniqueSources, credibilityScore: null };
    }

    const credibilityScore = uniqueSources.reduce((acc, source) => {
      const score = sourceCredibility[source] ?? 0.65;
      return acc + score;
    }, 0) / uniqueSources.length;

    return { uniqueSources, credibilityScore };
  };

  const formatCredibility = (score: number | null) => {
    if (score === null || Number.isNaN(score)) return '—';
    return `${Math.round(score * 100)}% avg source credibility`;
  };

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
          Second-Order Insights
        </h2>

        <div className="flex gap-2">
          {feeds.length > 0 && !isProcessing && (
            <>
              <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                <button
                  onClick={() => setSortBy('none')}
                  className={`text-[0.55rem] px-2 py-1 mx-1 rounded font-medium transition-all ${
                    sortBy === 'none' 
                      ? 'bg-gray-500 text-white' 
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Default
                </button>
                <button
                  onClick={() => setSortBy('pos-neg')}
                  className={`text-[0.55rem] px-2 py-1 mx-1 rounded font-medium transition-all ${
                    sortBy === 'pos-neg' 
                      ? 'bg-accent-secondary text-white' 
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Positive → Negative
                </button>
                <button
                  onClick={() => setSortBy('neg-pos')}
                  className={`text-[0.55rem] px-2 py-1 mx-1 rounded font-medium transition-all ${
                    sortBy === 'neg-pos' 
                      ? 'bg-red-500 text-white' 
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Negative → Positive
                </button>
              </div>
              <button
                onClick={() => {
                  console.log('Regenerating insights...');
                  refreshSection('insights', true);
                }}
                className="text-[0.65rem] uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all opacity-60 hover:opacity-100 flex items-center gap-2"
              >
                {insights.length > 0 ? 'Regenerate' : 'Analyze'}
              </button>
              {insights.length > 0 && (
                <button
                  onClick={() => clearSection('insights')}
                  className="text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all opacity-60 hover:opacity-100"
                >
                  Clear
                </button>
              )}
              {rawOutputs.insights && (
                <button
                  onClick={() => {
                    console.log('Raw output length:', rawOutputs.insights.length);
                    console.log('Raw output preview:', rawOutputs.insights.substring(0, 100));
                    showRawOutput('insights');
                  }}
                  className="text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:bg-orange-500/30 transition-all opacity-60 hover:opacity-100"
                >
                  Raw Output
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* JSON Error Display */}
      {jsonError.hasError && jsonError.sectionId === 'insights' && (
        <JsonErrorDisplay
          error={jsonError.error}
          onRetry={() => retryJsonSection('insights')}
          onCancel={clearJsonError}
          countdown={5}
          isRetrying={isProcessingSection.insights}
        />
      )}

      {isProcessing && insights.length === 0 ? (
        <ul className="space-y-4 opacity-50">
          {[1, 2, 3, 4, 5].map(i => <li key={i} className="loading-skeleton h-20 bg-white/5 animate-pulse rounded-lg"></li>)}
        </ul>
      ) : (
        <ul className="space-y-4">
          {sortedInsights.map((insight, idx) => {
            const parts = insight.text.split('|').map(s => s.trim())
            const trend = parts[0]
            const implication = parts[1]
            const color = getSentimentColor(insight.sentiment)
            const evidence = insight.evidence ?? []
            const { credibilityScore } = summarizeEvidence(evidence)

            // Check if this looks like a URL
            const isUrl = insight.text.startsWith('http') || insight.text.includes('://')

            return (
              <li key={`${idx}-${insight.text.substring(0, 10)}`}
                className="bg-white/5 border-l-4 p-4 rounded-r-lg group transition-all hover:bg-white/10"
                style={{ borderLeftColor: color }}
              >
                {isUrl ? (
                  <div className="space-y-2">
                    <p className="text-xs text-red-400 font-mono">⚠️ Detected URL instead of insight text:</p>
                    <p className="text-sm text-text-primary font-mono break-all">{insight.text}</p>
                    <p className="text-xs text-text-secondary">Expected format: "Observation | Strategic implication"</p>
                  </div>
                ) : implication ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-[0.55rem] uppercase tracking-widest font-bold opacity-70" style={{ color: color }}>
                        Observation
                      </p>
                      <p className="text-sm text-text-primary leading-snug">
                        {trend.replace(/^(Trend|Observation):\s*/i, '')}
                      </p>
                    </div>

                    <div className="mt-3 space-y-1">
                      <p className="text-[0.55rem] uppercase tracking-widest font-bold opacity-60" style={{ color: color }}>
                        Implication
                      </p>
                      <p className="text-sm text-text-primary leading-snug">
                        {implication.replace(/^(Implication|Analysis):\s*/i, '')}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-text-primary leading-snug font-medium opacity-90">{insight.text}</p>
                )}

                {(insight.confidence !== undefined || evidence.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-widest">
                    {insight.confidence !== undefined && (
                      <span
                        className="px-2 py-1 rounded bg-blue-500/20 text-blue-300"
                        title="Model confidence representing analytic certainty in this inference."
                      >
                        {(insight.confidence * 100).toFixed(0)}% Confidence
                      </span>
                    )}
                    {evidence.length > 0 && (
                      <span className="px-2 py-1 rounded bg-slate-500/20 text-slate-300">
                        {evidence.length} Evidence cites
                      </span>
                    )}
                    {evidence.length > 0 && (
                      <span className="px-2 py-1 rounded bg-slate-700/30 text-slate-300">
                        {formatCredibility(credibilityScore)}
                      </span>
                    )}
                  </div>
                )}

                {evidence.length > 0 && (
                  <div className="relative text-xs">
                    <button
                      onClick={() => setActiveEvidenceId(prev => prev === (insight.text || `${idx}`) ? null : (insight.text || `${idx}`))}
                      className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-text-primary hover:bg-white/15 transition"
                      aria-expanded={activeEvidenceId === (insight.text || `${idx}`)}
                    >
                      <span className="uppercase tracking-widest text-[0.6rem]">Review Evidence</span>
                      <span className="text-[0.6rem] bg-black/40 rounded-full px-2 py-0.5">{evidence.length}</span>
                    </button>

                    {activeEvidenceId === (insight.text || `${idx}`) && (
                      <div className="absolute z-20 mt-2 right-0 min-w-[18rem] max-w-[24rem] rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-4 space-y-3">
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-accent-secondary mb-1">Source Credibility</p>
                            <p className="text-xs text-text-secondary">
                              {formatCredibility(credibilityScore)}
                            </p>
                          </div>
                          <button
                            onClick={() => setActiveEvidenceId(null)}
                            className="text-[0.6rem] uppercase tracking-widest text-text-secondary hover:text-text-primary"
                            aria-label="Close evidence panel"
                          >
                            Close
                          </button>
                        </div>

                        <div>
                          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-text-secondary mb-2">
                            Supporting reporting
                          </p>
                          <ul className="space-y-3">
                            {evidence.map((item, evidenceIdx) => (
                              <li key={evidenceIdx} className="text-xs text-text-secondary bg-white/5 rounded-lg p-3 border border-white/10">
                                <div className="flex justify-between items-start gap-2">
                                  <span className="text-[0.7rem] font-medium text-text-primary">
                                    {item.source || 'Unknown source'}
                                  </span>
                                  {item.timestamp && (
                                    <span className="text-[0.55rem] uppercase tracking-widest text-text-tertiary">
                                      {new Date(item.timestamp).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                {item.title && (
                                  <p className="mt-1 text-text-primary text-xs font-medium">
                                    {item.title}
                                  </p>
                                )}
                                {item.quote && (
                                  <p className="mt-2 italic text-[0.7rem] text-text-secondary line-clamp-3">
                                    “{item.quote}”
                                  </p>
                                )}
                                <div className="mt-2 flex justify-between items-center text-[0.65rem]">
                                  {item.feedId && (
                                    <span className="text-text-tertiary font-mono">ID: {item.feedId}</span>
                                  )}
                                  {item.link && (
                                    <a
                                      href={item.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-accent-secondary hover:underline"
                                    >
                                      Open source ↗
                                    </a>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
          {!isProcessing && insights.length === 0 && !jsonError.hasError && (
            <div className="text-center py-8 opacity-40">
              <p className="text-xs uppercase tracking-widest font-bold mb-2">No Insights Detected</p>
              <p className="text-[10px] italic">Scan feeds to identify hidden trends.</p>
            </div>
          )}
        </ul>
      )}
      
      {/* Raw Output Modal */}
      <RawOutputModal
        isOpen={activeRawOutput === 'insights'}
        onClose={hideRawOutput}
        sectionId="insights"
        title="Second-Order Insights"
      />
    </section>
  )
}
