import { ButtonHTMLAttributes } from 'react'
import { zzfx } from '../../utils/zzfx'

type SectionRegenerateButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string
}

export function SectionRegenerateButton({ label = 'Regenerate', className = '', onClick, ...props }: SectionRegenerateButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Play regeneration sound when button is clicked
    zzfx.playRegeneration();
    
    // Call original onClick if provided
    if (onClick) {
      onClick(e);
    }
  };

  const baseClasses = 'text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded border transition-all'
  const paletteClasses = 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
  const combined = [baseClasses, paletteClasses, className].filter(Boolean).join(' ')

  return (
    <button className={combined} onClick={handleClick} {...props}>
      {label}
    </button>
  )
}
