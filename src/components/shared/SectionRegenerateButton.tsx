import { ButtonHTMLAttributes } from 'react'

type SectionRegenerateButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string
}

export function SectionRegenerateButton({ label = 'Regenerate', className = '', ...props }: SectionRegenerateButtonProps) {
  const baseClasses = 'text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded border transition-all'
  const paletteClasses = 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
  const combined = [baseClasses, paletteClasses, className].filter(Boolean).join(' ')

  return (
    <button className={combined} {...props}>
      {label}
    </button>
  )
}
