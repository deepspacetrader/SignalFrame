import { useState, useMemo } from 'react'
import { useSituationStore } from '../state/useSituationStore'
import { DeepDiveModal } from './DeepDiveModal'
import { JsonErrorDisplay } from './JsonErrorDisplay'
import { RawOutputModal } from './RawOutputModal'
import { formatTime } from '../utils/timeUtils'
import { SectionCard } from './shared/SectionCard'
import { SectionHeader } from './shared/SectionHeader'
import { SectionRegenerateButton } from './shared/SectionRegenerateButton'
import { SectionBadge } from './shared/SectionBadge'

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


export function Signals() {
  const {
    signals,
    insights,
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
    sectionGenerationTimes,
    sectionFailures,
    retryFailedSection,
    clearSectionFailure,
    generateDeepDive,
    closeDeepDive,
    deepDiveBySignalId,
    activeDeepDiveSignalId,
    isGeneratingDeepDive
  } = useSituationStore()
  const [sortBy, setSortBy] = useState<'none' | 'pos-neg' | 'neg-pos'>('none')
  const [hoveredSignalId, setHoveredSignalId] = useState<string | null>(null)
  const isLoading = isProcessingSection.signals && !isProcessing;
  const failure = sectionFailures.signals;
  const hasFailed = failure?.hasFailed;
  const isRetrying = failure?.isRetrying;

  const headerBadges = useMemo(() => {
    const badges: JSX.Element[] = []

    badges.push(
      <SectionBadge key="count" tone={signals.length > 0 ? 'neutral' : 'warning'}>
        {signals.length > 0 ? `${signals.length} signals` : 'No signals'}
      </SectionBadge>
    )

    if (sectionGenerationTimes.signals) {
      badges.push(
        <SectionBadge key="duration" tone="info">
          {formatTime(sectionGenerationTimes.signals)}
        </SectionBadge>
      )
    }

    if (hasFailed) {
      badges.push(
        <SectionBadge key="failed" tone="warning">
          Generation Failed
        </SectionBadge>
      )
    } else if (isRetrying) {
      badges.push(
        <SectionBadge key="retrying" tone="accent">
          Retrying...
        </SectionBadge>
      )
    }

    return badges
  }, [hasFailed, isRetrying, sectionGenerationTimes.signals, signals.length])

  const headerActions = useMemo(() => {
    const sortControls = signals.length > 0 && !hasFailed && (
      <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
        <button
          onClick={() => setSortBy('none')}
          className={`text-[0.55rem] px-2 py-1 mx-1 rounded font-medium transition-all ${sortBy === 'none'
            ? 'bg-gray-500 text-white'
            : 'text-text-secondary hover:text-text-primary'
            }`}
        >
          Default
        </button>
        <button
          onClick={() => setSortBy('pos-neg')}
          className={`text-[0.55rem] px-2 py-1 mx-1 rounded font-medium transition-all ${sortBy === 'pos-neg'
            ? 'bg-accent-secondary text-white'
            : 'text-text-secondary hover:text-text-primary'
            }`}
        >
          Positive → Negative
        </button>
        <button
          onClick={() => setSortBy('neg-pos')}
          className={`text-[0.55rem] px-2 py-1 mx-1 rounded font-medium transition-all ${sortBy === 'neg-pos'
            ? 'bg-red-500 text-white'
            : 'text-text-secondary hover:text-text-primary'
            }`}
        >
          Negative → Positive
        </button>
      </div>
    )

    const regenerateControls = !isProcessing && !hasFailed && (
      <div className="flex items-center gap-2">
        <SectionRegenerateButton
          onClick={() => refreshSection('signals', true)}
          className="opacity-80 hover:opacity-100"
        />
        {rawOutputs.signals && (
          <button
            onClick={() => showRawOutput('signals')}
            className="text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:bg-orange-500/30 transition-all"
          >
            Raw Output
          </button>
        )}
      </div>
    )

    if (!sortControls && !regenerateControls) return null

    return (
      <div className="flex flex-wrap items-center gap-3">
        {sortControls}
        {regenerateControls}
      </div>
    )
  }, [hasFailed, isProcessing, rawOutputs.signals, refreshSection, setSortBy, showRawOutput, signals.length, sortBy])


  const insightsForSignal = useMemo(() => {
    const bySignalId: Record<string, typeof insights> = {};
    for (const insight of insights) {
      if (insight.signalId) {
        if (!bySignalId[insight.signalId]) bySignalId[insight.signalId] = [];
        bySignalId[insight.signalId].push(insight);
      }
    }
    return bySignalId;
  }, [insights]);

  const tokenize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);

  const similarityScore = (aTokens: string[], bTokens: string[]) => {
    if (!aTokens.length || !bTokens.length) return 0;
    const aSet = new Set(aTokens);
    const bSet = new Set(bTokens);
    let intersection = 0;
    for (const token of aSet) {
      if (bSet.has(token)) intersection += 1;
    }
    const union = new Set([...aSet, ...bSet]).size;
    return union === 0 ? 0 : intersection / union;
  };

  const dedupedSignals = useMemo(() => {
    const unique: typeof signals = [];
    const tokenCache: string[][] = [];

    for (const sig of signals) {
      const baseText = sig.title || sig.text || '';
      const tokens = tokenize(baseText);

      let isDuplicate = false;
      for (let i = 0; i < unique.length; i++) {
        if (similarityScore(tokens, tokenCache[i]) >= 0.7) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        unique.push(sig);
        tokenCache.push(tokens);
      }
    }

    return unique;
  }, [signals]);

  // Memoize sorted signals to prevent recalculation on every render
  const sortedSignals = useMemo(() => {
    const base = dedupedSignals;
    if (sortBy === 'none') return base;

    return [...base].sort((a, b) => {
      const orderA = sentimentOrder[a.sentiment as keyof typeof sentimentOrder] ?? 4;
      const orderB = sentimentOrder[b.sentiment as keyof typeof sentimentOrder] ?? 4;

      return sortBy === 'pos-neg' ? orderB - orderA : orderA - orderB;
    });
  }, [dedupedSignals, sortBy]);

  return (
    <SectionCard
      isLoading={isLoading && !hasFailed}
      loadingOverlayContent={
        <>
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <span className="text-[0.6rem] uppercase tracking-widest font-bold text-accent-primary">Processing Deltas...</span>
        </>
      }
    >
      {hasFailed && !isLoading && (
        <div className="section-loading-overlay bg-red-500/10 border-red-500/30">
          <div className="flex flex-col items-center gap-2">
            {isRetrying ? (
              <>
                <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[0.6rem] uppercase tracking-widest font-bold text-yellow-400">Retrying...</span>
                <span className="text-[0.5rem] text-yellow-300/80">Attempt {failure.retryCount + 1}</span>
              </>
            ) : (
              <>
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[0.6rem] uppercase tracking-widest font-bold text-red-400">Generation Failed</span>
                <span className="text-[0.5rem] text-red-300/80 max-w-xs text-center">{failure.error}</span>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => retryFailedSection('signals')}
                    className="text-[0.55rem] px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                  >
                    Retry Now
                  </button>
                  <button
                    onClick={() => clearSectionFailure('signals')}
                    className="text-[0.55rem] px-2 py-1 bg-gray-500/20 text-gray-400 rounded border border-gray-500/30 hover:bg-gray-500/30 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <SectionHeader
        className="mb-6"
        title="Signals & Insights"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        }
        badges={headerBadges}
        actions={headerActions}
      />

      {/* JSON Error Display */}
      {jsonError.hasError && jsonError.sectionId === 'signals' && (
        <JsonErrorDisplay
          error={jsonError.error}
          onRetry={() => retryJsonSection('signals')}
          onCancel={clearJsonError}
          countdown={5}
          isRetrying={isProcessingSection.signals}
        />
      )}

      {isProcessing && signals.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <div key={i} className="loading-skeleton h-20 bg-white/5 animate-pulse rounded-lg"></div>)}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedSignals.map((signal, idx) => (
            <div
              key={signal.id || `signal-${idx}`}
              className="relative bg-white/5 border-l-4 p-4 rounded-r-lg transition-all hover:bg-white/10"
              style={{ borderColor: getSentimentColor(signal.sentiment) }}
              onMouseEnter={() => {
                setHoveredSignalId(signal.id || `signal-${idx}`);
              }}
              onMouseLeave={() => {
                setHoveredSignalId(null);
              }}
            >
              {/* Header with title and sentiment */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="signal-text font-semibold text-text-primary text-base leading-tight">
                  {signal.title || 'Error generating signal title'}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      generateDeepDive(signal.id || '');
                    }}
                    className="p-1.5 rounded bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 transition-all border border-accent-primary/20 group/btn shadow-lg"
                    title="Deep Intelligence Analyze"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover/btn:scale-110 transition-transform">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </button>
                  <span
                    className="text-[0.65rem] uppercase tracking-widest px-2 py-1 rounded text-white font-medium shadow-md"
                    style={{ backgroundColor: getSentimentColor(signal.sentiment) }}
                  >
                    {signal.sentiment.replace('-', ' ')}
                  </span>
                </div>
              </div>



              {/* Signal text - only show if different from title */}
              <p className="signal-text text-text-secondary text-sm leading-relaxed mb-3">
                {signal.text || 'Error generating signal text'}
              </p>

              {/* Category and delta type */}
              <div className="flex flex-wrap gap-2 mb-3">
                {signal.category && (
                  <span className="px-2 py-1 rounded bg-slate-500/20 text-slate-300 text-[0.65rem] uppercase tracking-widest">
                    {signal.category}
                  </span>
                )}
                {signal.deltaType && (
                  <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 text-[0.65rem] uppercase tracking-widest">
                    {signal.deltaType}
                  </span>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 mb-3"></div>

              {/* Insight Explanation */}
              <div className="space-y-2">
                {signal.explain && (
                  <div>
                    <p className="text-[0.6rem] uppercase tracking-widest text-text-tertiary mb-1">Insight:</p>
                    <p className="text-text-secondary text-sm leading-relaxed">
                      {signal.explain}
                    </p>
                  </div>
                )}

                {/* Related insights */}
                {insightsForSignal[signal.id || '']?.map((insight, iIdx) => {
                  const parts = insight.text.split('|').map(s => s.trim());
                  const observation = parts[0];
                  const implication = parts[1];
                  return (
                    <div key={iIdx} className="bg-accent-secondary/5 border-l-2 border-accent-secondary/40 p-3 rounded-r-lg mt-2">
                      <p className="text-[0.6rem] uppercase tracking-widest font-bold text-accent-secondary mb-2">Implication</p>
                      {implication ? (
                        <div className="space-y-2">
                          <p className="text-xs text-text-secondary/80">
                            <span className="font-medium text-text-tertiary">Observation:</span> {observation.replace(/^(Trend|Observation):\s*/i, '')}
                          </p>
                          <p className="text-xs text-text-primary leading-snug">
                            <span className="font-medium text-text-tertiary">Implication:</span> {implication.replace(/^(Implication|Analysis):\s*/i, '')}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-text-primary leading-snug">{insight.text}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Evidence on hover */}
              {hoveredSignalId === (signal.id || `signal-${idx}`) && (
                <div className="mt-2 w-full max-w-2xl bg-slate-900/100 border border-white/10 rounded-xl shadow-2xl p-4">
                  {signal.evidence && signal.evidence.length > 0 ? (
                    <>
                      <div className="flex justify-between items-start mb-3">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-accent-primary">
                          Source ({signal.evidence.length})
                        </p>
                      </div>
                      <ul className="space-y-2">
                        {signal.evidence.map((item, evidenceIdx) => (
                          <li key={evidenceIdx} className="text-xs text-text-secondary bg-white/5 rounded p-2 border border-white/10">
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-medium text-text-primary text-[0.65rem]">{item.source}</span>
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
                              <p className="mt-1 italic text-[0.6rem] text-text-secondary">
                                "{item.quote}"
                              </p>
                            )}
                            {item.link && (
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent-primary hover:underline text-[0.6rem] mt-1 inline-block"
                              >
                                Open article ↗
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <div className="text-xs text-text-tertiary">
                      No evidence available for this signal
                    </div>
                  )}

                  {/* Contradictions */}
                  {signal.contradictions && signal.contradictions.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/10">
                      <div className="flex justify-between items-start mb-3">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-orange-400">
                          Contradictions ({signal.contradictions.length})
                        </p>
                      </div>
                      <div className="space-y-3">
                        {signal.contradictions.map((contradiction, contradictionIdx) => (
                          <div key={contradictionIdx} className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                            <div className="space-y-2">
                              <div className="flex items-start gap-2">
                                <span className="text-[0.6rem] font-medium text-red-400">Claim A:</span>
                                <p className="text-xs text-text-primary flex-1">{contradiction.claimA}</p>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-[0.6rem] font-medium text-blue-400">Claim B:</span>
                                <p className="text-xs text-text-primary flex-1">{contradiction.claimB}</p>
                              </div>

                              {/* Evidence for Claim A */}
                              {contradiction.evidenceA && contradiction.evidenceA.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-[0.55rem] uppercase tracking-widest text-red-400/80 mb-1">Evidence A:</p>
                                  <div className="space-y-1">
                                    {contradiction.evidenceA.map((evidence, evidenceIdx) => (
                                      <div key={evidenceIdx} className="text-xs text-text-secondary bg-black/20 rounded p-2 border border-red-500/20">
                                        <div className="flex justify-between items-start gap-2">
                                          <span className="font-medium text-text-primary text-[0.6rem]">{evidence.source}</span>
                                          {evidence.timestamp && (
                                            <span className="text-[0.5rem] uppercase tracking-widest text-text-tertiary">
                                              {new Date(evidence.timestamp).toLocaleDateString()}
                                            </span>
                                          )}
                                        </div>
                                        {evidence.title && (
                                          <p className="mt-1 text-text-primary text-xs">{evidence.title}</p>
                                        )}
                                        {evidence.quote && (
                                          <p className="mt-1 italic text-[0.55rem] text-text-secondary">
                                            "{evidence.quote}"
                                          </p>
                                        )}
                                        {evidence.link && (
                                          <a
                                            href={evidence.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent-primary hover:underline text-[0.6rem] mt-1 inline-block"
                                          >
                                            Open article ↗
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Evidence for Claim B */}
                              {contradiction.evidenceB && contradiction.evidenceB.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-[0.55rem] uppercase tracking-widest text-blue-400/80 mb-1">Evidence B:</p>
                                  <div className="space-y-1">
                                    {contradiction.evidenceB.map((evidence, evidenceIdx) => (
                                      <div key={evidenceIdx} className="text-xs text-text-secondary bg-black/20 rounded p-2 border border-blue-500/20">
                                        <div className="flex justify-between items-start gap-2">
                                          <span className="font-medium text-text-primary text-[0.6rem]">{evidence.source}</span>
                                          {evidence.timestamp && (
                                            <span className="text-[0.5rem] uppercase tracking-widest text-text-tertiary">
                                              {new Date(evidence.timestamp).toLocaleDateString()}
                                            </span>
                                          )}
                                        </div>
                                        {evidence.title && (
                                          <p className="mt-1 text-text-primary text-xs">{evidence.title}</p>
                                        )}
                                        {evidence.quote && (
                                          <p className="mt-1 italic text-[0.55rem] text-text-secondary">
                                            "{evidence.quote}"
                                          </p>
                                        )}
                                        {evidence.link && (
                                          <a
                                            href={evidence.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent-primary hover:underline text-[0.6rem] mt-1 inline-block"
                                          >
                                            Open article ↗
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {!isProcessing && signals.length === 0 && !jsonError.hasError && (
            <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-xl">
              <p className="text-text-secondary italic">No critical signals identified in this period.</p>
            </div>
          )}
        </div>
      )}

      {/* Raw Output Modal */}
      <RawOutputModal
        isOpen={activeRawOutput === 'signals'}
        onClose={hideRawOutput}
        sectionId="signals"
        title="Signals"
      />

      <DeepDiveModal
        isOpen={!!activeDeepDiveSignalId}
        onClose={closeDeepDive}
        data={activeDeepDiveSignalId ? deepDiveBySignalId[activeDeepDiveSignalId] : null}
        isGenerating={isGeneratingDeepDive}
      />
    </SectionCard>
  )
}
