import { ReactNode } from 'react'

interface SectionCardProps {
  children: ReactNode
  className?: string
  isLoading?: boolean
  loadingLabel?: string
  loadingSpinnerClassName?: string
  loadingLabelClassName?: string
  loadingOverlayContent?: ReactNode
}

export function SectionCard({
  children,
  className = '',
  isLoading = false,
  loadingLabel = 'Processing...',
  loadingSpinnerClassName = 'border-accent-primary',
  loadingLabelClassName = 'text-accent-primary',
  loadingOverlayContent
}: SectionCardProps) {
  const sectionClasses = [
    'relative bg-bg-card backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:border-white/20',
    isLoading ? 'section-loading' : '',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={sectionClasses}>
      {isLoading && (
        <div className="section-loading-overlay">
          {loadingOverlayContent ? (
            loadingOverlayContent
          ) : (
            <>
              <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-2 ${loadingSpinnerClassName}`}></div>
              {loadingLabel && (
                <span className={`text-[0.6rem] uppercase tracking-widest font-bold ${loadingLabelClassName}`}>
                  {loadingLabel}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {children}
    </section>
  )
}
