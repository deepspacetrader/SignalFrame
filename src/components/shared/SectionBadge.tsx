import { ReactNode } from 'react'

type SectionBadgeTone = 'neutral' | 'accent' | 'warning' | 'info' | 'success'

interface SectionBadgeProps {
  children: ReactNode
  tone?: SectionBadgeTone
  className?: string
}

const toneStyles: Record<SectionBadgeTone, string> = {
  neutral: 'bg-white/5 border-white/10 text-text-secondary',
  accent: 'bg-accent-secondary/20 border-accent-secondary/30 text-accent-secondary',
  warning: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
  info: 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary',
  success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
}

export function SectionBadge({ children, tone = 'neutral', className = '' }: SectionBadgeProps) {
  return (
    <span
      className={`text-[0.55rem] uppercase tracking-widest font-bold px-2 py-0.5 rounded border whitespace-nowrap ${toneStyles[tone]} ${className}`.trim()}
    >
      {children}
    </span>
  )
}
