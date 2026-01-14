import { useState } from 'react'
import { useSituationStore } from '../state/useSituationStore'
import { RawOutputModal } from './RawOutputModal'

export function NarrativeSummary() {
  const { 
    narrative, 
    thinkingTrace, 
    isProcessing, 
    isProcessingSection, 
    refreshSection, 
    aiConfig,
    rawOutputs,
    activeRawOutput,
    showRawOutput,
    hideRawOutput
  } = useSituationStore()
  const isLoading = isProcessingSection.narrative && !isProcessing;
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);

  const hasThinking = thinkingTrace && thinkingTrace.length > 0;

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
          {aiConfig.enableThinking && (
            <span className="text-[0.5rem] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/30">
              Thinking Mode
            </span>
          )}
        </h2>

        {narrative && !isProcessing && (
          <>
            <button
              onClick={() => refreshSection('narrative')}
              className="text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-all opacity-60 hover:opacity-100"
            >
              Regenerate
            </button>
            {rawOutputs.narrative && (
              <button
                onClick={() => showRawOutput('narrative')}
                className="text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:bg-orange-500/30 transition-all opacity-60 hover:opacity-100"
              >
                Raw Output
              </button>
            )}
          </>
        )}
      </div>

      {isProcessing && !narrative ? (
        <div className="loading-skeleton h-24 bg-white/5 animate-pulse rounded"></div>
      ) : (
        <>
          <p className="text-text-primary leading-relaxed whitespace-pre-wrap">
            {narrative || "No narrative generated yet. Start a scan to begin."}
          </p>

          {/* Thinking Trace - Collapsible Section */}
          {hasThinking && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <button
                onClick={() => setIsThinkingOpen(!isThinkingOpen)}
                className="w-full flex items-center justify-between gap-3 text-left group"
              >
                <div className="flex items-center gap-2">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-accent-secondary transition-transform duration-300 ${isThinkingOpen ? 'rotate-90' : ''}`}
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                  <span className="text-[0.65rem] uppercase tracking-widest font-bold text-accent-secondary group-hover:opacity-100 opacity-70 transition-opacity">
                    AI Reasoning Trace
                  </span>
                  <span className="text-[0.5rem] text-text-secondary bg-white/5 px-2 py-0.5 rounded-full">
                    {Math.round(thinkingTrace.length / 100) * 100}+ chars
                  </span>
                </div>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-text-secondary opacity-40"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </button>

              {isThinkingOpen && (
                <div className="mt-3 animate-in slide-in-from-top-2 duration-300">
                  <div className="relative bg-black/30 border border-accent-secondary/20 rounded-xl p-4 max-h-[400px] overflow-y-auto">
                    {/* Gradient fade at top for scroll indication */}
                    <div className="absolute top-0 left-0 right-4 h-6 bg-gradient-to-b from-black/30 to-transparent pointer-events-none rounded-t-xl z-10"></div>

                    <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap leading-relaxed pt-2">
                      {thinkingTrace}
                    </pre>

                    {/* Gradient fade at bottom */}
                    <div className="absolute bottom-0 left-0 right-4 h-6 bg-gradient-to-t from-black/30 to-transparent pointer-events-none rounded-b-xl"></div>
                  </div>
                  <p className="text-[0.5rem] text-text-secondary mt-2 italic opacity-60">
                    This is the model's internal reasoning process before generating the final narrative.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Show streaming thinking indicator during processing */}
          {isProcessing && aiConfig.enableThinking && thinkingTrace && (
            <div className="mt-4 p-3 bg-accent-secondary/10 border border-accent-secondary/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-accent-secondary rounded-full animate-pulse"></div>
                <span className="text-[0.6rem] uppercase tracking-widest font-bold text-accent-secondary">
                  Deep Reasoning in Progress...
                </span>
              </div>
              <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap max-h-32 overflow-hidden">
                {thinkingTrace.slice(-500)}...
              </pre>
            </div>
          )}
        </>
      )}
      
      {/* Raw Output Modal */}
      <RawOutputModal
        isOpen={activeRawOutput === 'narrative'}
        onClose={hideRawOutput}
        sectionId="narrative"
        title="Current Narrative"
      />
    </section>
  )
}
