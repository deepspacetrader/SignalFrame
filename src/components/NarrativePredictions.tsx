import { useMemo, useState, useEffect } from 'react'
import { useSituationStore } from '../state/useSituationStore'
import { SectionCard } from './shared/SectionCard'
import { SectionHeader } from './shared/SectionHeader'
import { SectionRegenerateButton } from './shared/SectionRegenerateButton'
import { SectionBadge } from './shared/SectionBadge'
import { formatTime } from '../utils/timeUtils'
import { StorageService } from '../services/db'

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

export function NarrativePredictions({ onAIRequired }: { onAIRequired: () => void }) {
  const {
    watchFor,
    isProcessingSection,
    generateNarrativePredictions,
    regenerateNarrativePredictions,
    aiConfig,
    sectionGenerationTimes
  } = useSituationStore()

  const [isNarrativePredictionsOpen, setIsNarrativePredictionsOpen] = useState(false)

  // Load and save collapsible state
  useEffect(() => {
    const loadState = async () => {
      try {
        const saved = await StorageService.getGlobal('watch_for_collapsed')
        setIsNarrativePredictionsOpen(saved !== true) // Default to open if not set
      } catch (error) {
        console.error('Failed to load NarrativePredictions collapsed state:', error)
        setIsNarrativePredictionsOpen(true) // Default to open on error
      }
    }
    loadState()
  }, [])

  const toggleNarrativePredictions = async () => {
    const newState = !isNarrativePredictionsOpen
    setIsNarrativePredictionsOpen(newState)
    try {
      await StorageService.saveGlobal('watch_for_collapsed', !newState)
    } catch (error) {
      console.error('Failed to save NarrativePredictions collapsed state:', error)
    }
  }

  const isLoading = isProcessingSection.watchFor
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const hasNoData = !watchFor && !isLoading

  const headerBadges = useMemo(() => {
    const badges: JSX.Element[] = []
    if (sectionGenerationTimes.watchFor) {
      badges.push(
        <SectionBadge key="duration" tone="info">
          {formatTime(sectionGenerationTimes.watchFor)}
        </SectionBadge>
      )
    }
    return badges
  }, [sectionGenerationTimes.watchFor])

  const headerActions = useMemo(() => {
    if (!watchFor || isLoading) return null

    return (
      <SectionRegenerateButton onClick={() => {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!isLocalhost) {
          onAIRequired();
          return;
        }

        regenerateNarrativePredictions();
      }} />
    )
  }, [isLoading, watchFor, regenerateNarrativePredictions, onAIRequired])

  return (
    <SectionCard
      isLoading={isLoading}
      loadingOverlayContent={
        <>
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent animate-spin mb-2"></div>
          <span className="text-[0.6rem] uppercase tracking-widest font-bold text-accent-primary">Generating Narrative Prediction Analysis...</span>
        </>
      }
    >
      <SectionHeader
        className="mb-6"
        title="Narrative Predictions"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        }
        badges={headerBadges}
        actions={headerActions}
      />

      {hasNoData ? (
        <div className="text-center py-8">
          <p className="text-text-secondary text-sm mb-4">No "Narrative Prediction" analysis generated yet.</p>
          <button
            onClick={() => {
              const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
              if (!isLocalhost) {
                onAIRequired();
                return;
              }

              generateNarrativePredictions();
            }}
            className="px-4 py-2 bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary border border-accent-primary/30 rounded-lg text-sm font-bold uppercase tracking-widest transition-all"
          >
            Generate Narrative Predictions
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Collapsible toggle button */}
          <button
            onClick={toggleNarrativePredictions}
            className="w-full flex items-center justify-between gap-3 text-left group bg-accent-primary/5"
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
                className={`text-accent-primary transition-transform duration-300 ${isNarrativePredictionsOpen ? 'rotate-90' : ''}`}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              <span className="text-[0.65rem] uppercase tracking-widest font-bold text-primary group-hover:opacity-100 opacity-70 transition-opacity">
                {isNarrativePredictionsOpen ? 'Hide' : 'Show'} Predictions
              </span>
              {watchFor && (
                <span className="text-[0.5rem] text-text-secondary bg-white/5 px-2 py-0.5">
                  {watchFor.sections.length} topics
                </span>
              )}
            </div>
          </button>

          {/* Collapsible content */}
          {isNarrativePredictionsOpen && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              {watchFor?.sections.map((section, idx) => (
                <section key={idx} className="bg-accent-primary/5 border border-accent-primary/20 p-5">
                  <h3
                    className="text-[0.65rem] uppercase tracking-widest font-bold mb-4 flex items-center gap-2"
                    style={{ color: getSentimentColor(section.sentiment || 'neutral') }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    {section.title}
                  </h3>
                  <ul className="space-y-2">
                    {section.predictions && section.predictions.map((prediction, predictionIdx) => (
                      <li key={predictionIdx} className="text-sm text-text-primary flex items-start gap-2">
                        <span className="text-accent-primary mt-0.5">•</span>
                        {prediction}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}
