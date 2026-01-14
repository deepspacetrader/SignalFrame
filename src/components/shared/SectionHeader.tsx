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
    <div className={`flex flex-col lg:flex-row justify-between items-start gap-4 lg:gap-6 ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`w-1 h-5 rounded-full mt-1 ${accentClassName}`}></div>
        <div>
          <div className="flex items-center gap-3 text-text-primary font-display text-xl font-semibold">
            {icon && (
              <span className="text-text-secondary/80">
                {icon}
              </span>
            )}
            <span>{title}</span>
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
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {actions}
        </div>
      )}
    </div>
  )
}
