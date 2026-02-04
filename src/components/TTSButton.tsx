import { useState, useEffect, useRef } from 'react'
import { useSituationStore } from '../state/useSituationStore'

interface Voice {
  name: string
  id?: string | null
}

const AVAILABLE_VOICES: Voice[] = [
  { name: 'Zira (Default)', id: 'Microsoft Zira Desktop' },
  { name: 'David', id: 'Microsoft David Desktop' },
  { name: 'Mark', id: 'Microsoft Mark Desktop' },
  { name: 'Hazel', id: 'Microsoft Hazel Desktop' },
  { name: 'System Default', id: null },
]

interface TTSButtonProps {
  text: string
  className?: string
  voice?: string | null
  speed?: number
}

const TTS_SERVER_URL = 'http://localhost:3001'

export function TTSButton({ text, className = '', voice = 'Microsoft Zira Desktop', speed = 1.0 }: TTSButtonProps) {
  const { soundVolume } = useSituationStore()
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState(voice)
  const [useFallback, setUseFallback] = useState(false)
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fallbackSpeechRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current)
      }
    }
  }, [])

  const handleSpeak = async () => {
    if (!text.trim() || isSpeaking || isLoading) return

    // Immediately show stop button - don't wait for API response
    setIsSpeaking(true)
    setIsLoading(false)
    
    // Limit to first 10 words for testing
    
    try {
      const response = await fetch(`${TTS_SERVER_URL}/api/tts/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: text, 
          voice: selectedVoice,
          speed
        }),
      })

      if (!response.ok) {
        throw new Error('TTS generation failed')
      }

      const result = await response.json()
      console.log('[TTS] Speech started:', result.message)
      setUseFallback(false)
      
      // Auto-reset speaking state after estimated time (10 words ~ 5 seconds)
      const estimatedTime = Math.max(2000, text.length * 100)
      speechTimeoutRef.current = setTimeout(() => {
        setIsSpeaking(false)
        console.log('[TTS] Speech completed (timeout)')
      }, estimatedTime)
      
    } catch (error) {
      console.warn('[TTS] Server error, using fallback:', error)
      // Fallback to Web Speech API
      useWebSpeechFallback(text)
    }
  }

  const useWebSpeechFallback = (text: string) => {
    if ('speechSynthesis' in window) {
      setUseFallback(true)
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = speed
      utterance.volume = soundVolume
      
      utterance.onend = () => {
        console.log('[TTS] Fallback speech completed')
        setIsSpeaking(false)
      }
      
      utterance.onerror = (error) => {
        console.error('[TTS] Fallback speech error:', error)
        setIsSpeaking(false)
      }
      
      fallbackSpeechRef.current = utterance
      window.speechSynthesis.speak(utterance)
      console.log('[TTS] Using Web Speech API fallback')
    } else {
      console.warn('[TTS] Web Speech API not supported')
      setIsSpeaking(false)
    }
  }

  const handleStop = async () => {
    console.log('[TTS] Stop button clicked')
    
    // Clear any existing timeout
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current)
      speechTimeoutRef.current = null
    }
    
    // Stop fallback speech if active
    if (useFallback && 'speechSynthesis' in window) {
      console.log('[TTS] Stopping fallback speech')
      window.speechSynthesis.cancel()
      setUseFallback(false)
    }
    
    try {
      console.log('[TTS] Sending stop request to server...')
      const response = await fetch(`${TTS_SERVER_URL}/api/tts/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('[TTS] Stop response status:', response.status)
      
      if (response.ok) {
        const result = await response.json()
        console.log('[TTS] Speech stopped:', result.message)
      } else {
        console.warn('[TTS] Stop request failed with status:', response.status)
      }
    } catch (error) {
      console.warn('[TTS] Stop error (server may be offline):', error)
      console.warn('[TTS] Server URL:', TTS_SERVER_URL)
    }
    
    // Always reset state when stop is clicked
    setIsSpeaking(false)
    setIsLoading(false)
    console.log('[TTS] Stop state reset completed')
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Voice Selector Dropdown */}
      <select
        value={selectedVoice || ''}
        onChange={(e) => setSelectedVoice(e.target.value || null)}
        disabled={isSpeaking}
        className="text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded bg-bg-card/80 border border-white/20 text-text-primary hover:bg-bg-card transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-accent-primary"
        title="Select voice for text-to-speech"
      >
        {AVAILABLE_VOICES.map((voiceOption: Voice) => (
          <option key={voiceOption.id || 'default'} value={voiceOption.id || ''}>
            {voiceOption.name}
          </option>
        ))}
      </select>

      {/* TTS Button */}
      <button
        onClick={isSpeaking ? handleStop : handleSpeak}
        disabled={!text.trim() && !isSpeaking}
        className={`text-[0.6rem] uppercase tracking-widest font-bold px-3 py-1.5 rounded transition-all flex items-center gap-2 ${
          isSpeaking 
            ? 'bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30' 
            : 'bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30'
        } ${
          !text.trim() && !isSpeaking ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title={isSpeaking ? 'Stop speaking' : 'Speak first 10 words (for testing)'}
      >
        {isSpeaking ? (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
            <span>Stop</span>
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <span>Speak</span>
          </>
        )}
      </button>
    </div>
  )
}
