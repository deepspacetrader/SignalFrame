import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSituationStore } from '../state/useSituationStore'
import { zzfx } from '../utils/zzfx'

export function VolumeControl() {
  const { soundVolume, setSoundVolume } = useSituationStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [localVolume, setLocalVolume] = useState(soundVolume)
  const [buttonPosition, setButtonPosition] = useState({ top: 0, right: 0 })

  // Sync local volume with store volume
  useEffect(() => {
    setLocalVolume(soundVolume)
  }, [soundVolume])

  // Update ZZFX volume when store volume changes
  useEffect(() => {
    zzfx.setMasterVolume(soundVolume)
  }, [soundVolume])

  // Update button position for fixed positioning
  useEffect(() => {
    const updatePosition = () => {
      const button = document.getElementById('volume-button')
      if (button) {
        const rect = button.getBoundingClientRect()
        const newPosition = {
          top: rect.bottom + window.scrollY,
          right: window.innerWidth - rect.right
        }
        setButtonPosition(newPosition)
        return newPosition
      }
      return null
    }

    // Calculate position immediately when expanded
    if (isExpanded) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const position = updatePosition()
        if (position) {
          // Set position immediately without waiting for state update
          const panel = document.querySelector('[data-volume-panel]') as HTMLElement
          if (panel) {
            panel.style.top = `${position.top + 8}px`
            panel.style.right = `${position.right}px`
          }
        }
      }, 10)
      
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition)
      }
    }
  }, [isExpanded])

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('#volume-button') && !target.closest('[data-volume-panel]')) {
        setIsExpanded(false)
      }
    }

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded])

  const handleVolumeChange = (newVolume: number) => {
    setLocalVolume(newVolume)
    setSoundVolume(newVolume)
  }

  const toggleMute = () => {
    const newVolume = soundVolume > 0 ? 0 : 0.5
    handleVolumeChange(newVolume)
  }

  const testSound = () => {
    zzfx.playCompletion()
  }

  const volumePercentage = Math.round(localVolume * 100)

  return (
    <div id="volume-settings">
      {/* Volume Button */}
      <button
        id="volume-button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="bottom-6 z-50 p-3 bg-bg-card backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl hover:border-accent-primary/50 transition-all group px-4 py-2"
        title={`Volume: ${volumePercentage}%`}
      >
        <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">Volume Settings</p>
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-secondary group-hover:text-accent-primary transition-all mx-auto flex max-w-sm items-center"
        >
          {soundVolume === 0 ? (
            // Muted icon
            <>
              <path d="M11 5L6 9H2v6h4l5 4V5z"/>
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </>
          ) : soundVolume < 0.5 ? (
            // Low volume icon
            <>
              <path d="M11 5L6 9H2v6h4l5 4V5z"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </>
          ) : (
            // High volume icon
            <>
              <path d="M11 5L6 9H2v6h4l5 4V5z"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </>
          )}
        </svg>
      </button>

      {/* Expanded Volume Control - Portal to body */}
      {isExpanded && createPortal(
        <div 
          data-volume-panel
          className="fixed w-64 bg-slate-900 border border-white/10 rounded-lg shadow-xl p-4 z-[9999]"
          style={{
            top: `${buttonPosition.top + 8}px`,
            right: `${buttonPosition.right}px`
          }}
        >
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Sound Effects</h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Volume Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>Master Volume</span>
                <span>{volumePercentage}%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title={soundVolume > 0 ? "Mute" : "Unmute"}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {soundVolume === 0 ? (
                      <>
                        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                        <line x1="23" y1="9" x2="17" y2="15" />
                        <line x1="17" y1="9" x2="23" y2="15" />
                      </>
                    ) : (
                      <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                    )}
                  </svg>
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={localVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${volumePercentage}%, rgba(255,255,255,0.1) ${volumePercentage}%, rgba(255,255,255,0.1) 100%)`
                  }}
                />
              </div>
            </div>

            {/* Test Button */}
            <button
              onClick={testSound}
              className="w-full py-2 px-3 bg-accent-primary/10 border border-accent-primary/20 text-accent-primary rounded-lg hover:bg-accent-primary/20 transition-all text-xs font-semibold uppercase tracking-widest"
            >
              Test Completion Sound
            </button>

            {/* Info */}
            <p className="text-xs text-text-secondary leading-relaxed">
              Sound effects play when sections complete processing. Adjust volume or mute as needed.
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
