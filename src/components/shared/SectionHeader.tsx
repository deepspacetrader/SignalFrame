import { ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  icon?: ReactNode
  accentClassName?: string
  className?: string
  badges?: ReactNode | ReactNode[]
  actions?: ReactNode
}

export function SectionHeader({
  title,
  icon,
  accentClassName = 'bg-accent-primary',
  className = '',
  badges,
  actions
}: SectionHeaderProps) {
  const normalizedBadges = Array.isArray(badges) ? badges.filter(Boolean) : badges ? [badges] : []

  return (
    <div className={`flex flex-col lg:flex-row justify-between items-start gap-3 lg:gap-6 min-w-0 ${className}`}>
      <div className="flex items-start gap-3 min-w-0">
        <div className={`w-1 h-5 mt-1 shrink-0 ${accentClassName}`}></div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-text-primary font-display text-lg sm:text-xl font-semibold">
            {icon && (
              <span className="text-text-secondary/80 shrink-0">
                {icon}
              </span>
            )}
            <span className="break-words">{title}</span>
            {normalizedBadges.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {normalizedBadges.map((badge, idx) => (
                  <span key={idx} className="shrink-0">
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
