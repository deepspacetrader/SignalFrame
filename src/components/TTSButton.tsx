import { useState, useEffect, useRef } from 'react'
import { useSituationStore } from '../state/useSituationStore'

interface Voice {
  name: string
  id?: string | null
}

const NVIDIA_VOICES: Voice[] = [
  { name: 'Sofia', id: 'Magpie-Multilingual.EN-US.Sofia' },
  { name: 'Aria', id: 'Magpie-Multilingual.EN-US.Aria' },
  { name: 'Mia', id: 'Magpie-Multilingual.EN-US.Mia' },
  { name: 'Louise', id: 'Magpie-Multilingual.EN-US.Louise' },
  { name: 'Isabela', id: 'Magpie-Multilingual.EN-US.Isabela' },
]

const NVIDIA_EMOTIONS: Voice[] = [
  { name: 'Default', id: 'default' },
  { name: 'Happy', id: 'happy' },
  { name: 'Neutral', id: 'neutral' },
  { name: 'Calm', id: 'calm' },
  { name: 'Angry', id: 'angry' },
  { name: 'Fearful', id: 'fearful' },
]

// Voice-emotion compatibility mapping based on official NVIDIA NIM documentation
// Format: Magpie-Multilingual.{LOCALE}.{Speaker}[.{Emotion}]
// Only specific speakers have emotional variants in EN-US
const VOICE_EMOTION_COMPATIBILITY: Record<string, string[]> = {
  // Base voices (no emotion)
  'Magpie-Multilingual.EN-US.Aria': ['default'],
  'Magpie-Multilingual.EN-US.Sofia': ['default'],
  'Magpie-Multilingual.EN-US.Mia': ['default'],
  'Magpie-Multilingual.EN-US.Louise': ['default'], // No emotional variants
  'Magpie-Multilingual.EN-US.Isabela': ['default'], // No emotional variants in EN-US
  
  // Aria (EN-US) - 6 emotions: Angry, Calm, Fearful, Happy, Neutral, Sad
  'Magpie-Multilingual.EN-US.Aria.Angry': ['angry'],
  'Magpie-Multilingual.EN-US.Aria.Calm': ['calm'],
  'Magpie-Multilingual.EN-US.Aria.Fearful': ['fearful'],
  'Magpie-Multilingual.EN-US.Aria.Happy': ['happy'],
  'Magpie-Multilingual.EN-US.Aria.Neutral': ['neutral'],
  'Magpie-Multilingual.EN-US.Aria.Sad': ['sad'],
  
  // Sofia (EN-US) - 5 emotions (excluding Sad)
  'Magpie-Multilingual.EN-US.Sofia.Angry': ['angry'],
  'Magpie-Multilingual.EN-US.Sofia.Calm': ['calm'],
  'Magpie-Multilingual.EN-US.Sofia.Fearful': ['fearful'],
  'Magpie-Multilingual.EN-US.Sofia.Happy': ['happy'],
  'Magpie-Multilingual.EN-US.Sofia.Neutral': ['neutral'],
  
  // Mia (EN-US) - 5 emotions (excluding Sad)
  'Magpie-Multilingual.EN-US.Mia.Angry': ['angry'],
  'Magpie-Multilingual.EN-US.Mia.Calm': ['calm'],
  'Magpie-Multilingual.EN-US.Mia.Fearful': ['fearful'],
  'Magpie-Multilingual.EN-US.Mia.Happy': ['happy'],
  'Magpie-Multilingual.EN-US.Mia.Neutral': ['neutral'],
}

interface TTSButtonProps {
  text: string
  className?: string
  voice?: string | null
  speed?: number
}

const NVIDIA_TTS_SERVER_URL = '' // Use relative URL to work with base path

export function TTSButton({ text, className = '', voice = 'Magpie-Multilingual.EN-US.Sofia', speed = 1.0 }: TTSButtonProps) {
  const { soundVolume } = useSituationStore()
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState(voice)
  const [selectedEmotion, setSelectedEmotion] = useState('default')
  const [useFallback, setUseFallback] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fallbackSpeechRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Check if there's selected text
  const hasSelection = () => {
    const selection = window.getSelection()
    return selection && selection.toString().trim().length > 0
  }

  const getButtonText = () => {
    if (isSpeaking) return 'Stop'
    if (hasSelection()) return 'Speak Selection'
    return 'Speak'
  }

  const getButtonTitle = () => {
    if (isSpeaking) return 'Stop speaking'
    if (hasSelection()) return 'Speak selected text with NVIDIA Magpie TTS'
    return 'Speak with NVIDIA Magpie TTS'
  }

  const getAvailableEmotions = () => {
    const voiceKey = (selectedVoice as string) || 'Magpie-Multilingual.EN-US.Sofia'
    
    // Check if the base voice supports emotions
    const supportedEmotions = VOICE_EMOTION_COMPATIBILITY[voiceKey] || ['default']
    
    // If base voice only supports default, check for emotion-specific voice names
    if (supportedEmotions.length === 1 && supportedEmotions[0] === 'default') {
      // Look for emotion-specific voice names for this base voice
      const emotionVoices = Object.keys(VOICE_EMOTION_COMPATIBILITY)
        .filter(voiceName => voiceName.startsWith(voiceKey + '.'))
        .map(voiceName => VOICE_EMOTION_COMPATIBILITY[voiceName][0])
        .filter(Boolean)
      
      if (emotionVoices.length > 0) {
        // This voice has emotion-specific variants
        return NVIDIA_EMOTIONS.filter(emotion => 
          emotion.id === 'default' || emotionVoices.includes(emotion.id || '')
        )
      }
    }
    
    // Use the supported emotions from the base voice mapping
    return NVIDIA_EMOTIONS.filter(emotion => 
      supportedEmotions.includes(emotion.id || '')
    )
  }

  // Cleanup timeout and audio on unmount
  useEffect(() => {
    return () => {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current)
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const getSelectedText = () => {
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      return selection.toString().trim()
    }
    return ''
  }

  const handleSpeak = async () => {
    const selectedText = getSelectedText()
    const textToSpeak = selectedText || text
    
    if (!textToSpeak.trim() || isSpeaking || isLoading) return

    setIsSpeaking(true)
    setIsLoading(true)
    setUseFallback(false)
    
    // Clear selection after using it
    if (selectedText) {
      window.getSelection()?.removeAllRanges()
    }
    
    try {
      // First check if NVIDIA TTS server is running
      console.log('[NVIDIA TTS] Checking server health...')
      const healthResponse = await fetch(`${NVIDIA_TTS_SERVER_URL}/api/nvidia-tts/health`)
      
      if (!healthResponse.ok) {
        console.warn('[NVIDIA TTS] Server not responding, will use fallback')
        throw new Error('NVIDIA TTS server not available')
      }
      
      console.log('[NVIDIA TTS] Server health OK, requesting audio...')
      console.log('[NVIDIA TTS] Request data:', {
        text: textToSpeak.substring(0, 50) + '...',
        voice: selectedVoice || 'Magpie-Multilingual.EN-US.Aria',
        languageCode: 'en-US',
        emotion: selectedEmotion,
        usingSelection: !!selectedText
      })

      const response = await fetch(`${NVIDIA_TTS_SERVER_URL}/api/nvidia-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToSpeak,
          voice: selectedVoice || 'Magpie-Multilingual.EN-US.Aria',
          languageCode: 'en-US',
          emotion: selectedEmotion
        })
      })

      console.log('[NVIDIA TTS] Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[NVIDIA TTS] Error response:', errorText)
        throw new Error(`NVIDIA TTS server error: ${response.status} - ${errorText}`)
      }

      console.log('[NVIDIA TTS] Audio received successfully')
      const audioBlob = await response.blob()
      console.log('[NVIDIA TTS] Audio blob size:', audioBlob.size, 'bytes')
      console.log('[NVIDIA TTS] Audio blob type:', audioBlob.type)
      
      if (audioBlob.size === 0) {
        console.error('[NVIDIA TTS] Audio blob is empty!')
        throw new Error('Empty audio blob received')
      }
      
      const audioUrl = URL.createObjectURL(audioBlob)
      
      // Create and play audio
      const audio = new Audio(audioUrl)
      audio.volume = soundVolume
      audioRef.current = audio
      
      console.log('[NVIDIA TTS] Audio created with volume:', soundVolume)
      console.log('[NVIDIA TTS] Audio URL:', audioUrl)
      
      // Add loadedmetadata event to check duration
      audio.addEventListener('loadedmetadata', () => {
        console.log('[NVIDIA TTS] Audio duration:', audio.duration, 'seconds')
        if (audio.duration < 1) {
          console.warn('[NVIDIA TTS] Audio duration seems too short!')
        }
      })
      
      // Add loadeddata event to confirm audio data is loaded
      audio.addEventListener('loadeddata', () => {
        console.log('[NVIDIA TTS] Audio data loaded successfully')
      })
      
      // Add timeupdate event to track playback progress
      audio.addEventListener('timeupdate', () => {
        if (audio.duration > 0) {
          const progress = (audio.currentTime / audio.duration) * 100
          console.log(`[NVIDIA TTS] Playback progress: ${progress.toFixed(1)}% (${audio.currentTime.toFixed(1)}s / ${audio.duration.toFixed(1)}s)`)
        }
      })
      
      // Add progress event to track loading
      audio.addEventListener('progress', () => {
        console.log('[NVIDIA TTS] Audio loading progress:', audio.buffered.length > 0 ? `${(audio.buffered.end(0) / audio.duration * 100).toFixed(1)}%` : '0%')
      })
      
      audio.onended = () => {
        console.log('[NVIDIA TTS] Audio playback completed')
        setIsSpeaking(false)
        setIsLoading(false)
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
      }
      
      audio.onerror = (error: any) => {
        console.error('[NVIDIA TTS] Audio playback error:', error)
        const audioElement = error.target as HTMLAudioElement
        console.error('[NVIDIA TTS] Audio error code:', audioElement.error?.code)
        console.error('[NVIDIA TTS] Audio error message:', audioElement.error?.message)
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
        // Fallback to Web Speech API
        useWebSpeechFallback(text)
      }
      
      try {
        await audio.play()
        console.log('[NVIDIA TTS] Audio playback started successfully')
        setIsLoading(false)
      } catch (playError) {
        console.error('[NVIDIA TTS] Failed to start audio playback:', playError)
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
        // Fallback to Web Speech API
        useWebSpeechFallback(textToSpeak)
      }
      
    } catch (error) {
      console.warn('[NVIDIA TTS] API error, using fallback:', error)
      // Fallback to Web Speech API
      useWebSpeechFallback(textToSpeak)
    }
  }

  const useWebSpeechFallback = (text: string) => {
    if ('speechSynthesis' in window) {
      setUseFallback(true)
      setIsLoading(false)
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
      setIsLoading(false)
    }
  }

  const handleStop = async () => {
    console.log('[TTS] Stop button clicked')
    
    // Clear any existing timeout
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current)
      speechTimeoutRef.current = null
    }
    
    // Stop NVIDIA audio if active
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    
    // Stop fallback speech if active
    if (useFallback && 'speechSynthesis' in window) {
      console.log('[TTS] Stopping fallback speech')
      window.speechSynthesis.cancel()
      setUseFallback(false)
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
        title="Select NVIDIA Magpie voice for text-to-speech"
      >
        {NVIDIA_VOICES.map((voiceOption: Voice) => (
          <option key={voiceOption.id || 'default'} value={voiceOption.id || ''}>
            {voiceOption.name}
          </option>
        ))}
      </select>

      {/* Emotion Selector Dropdown */}
      <select
        value={selectedEmotion || ''}
        onChange={(e) => setSelectedEmotion(e.target.value || 'default')}
        disabled={isSpeaking}
        className="text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded bg-bg-card/80 border border-white/20 text-text-primary hover:bg-bg-card transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-accent-primary"
        title="Select NVIDIA Magpie emotion for text-to-speech (uses SSML)"
      >
        {getAvailableEmotions().map((emotionOption: Voice) => (
          <option key={emotionOption.id || 'default'} value={emotionOption.id || ''}>
            {emotionOption.name}
          </option>
        ))}
      </select>

      {/* TTS Button */}
      <button
        onClick={isSpeaking ? handleStop : handleSpeak}
        disabled={(!text.trim() && !hasSelection()) && !isSpeaking}
        className={`text-[0.6rem] uppercase tracking-widest font-bold px-3 py-1.5 rounded transition-all flex items-center gap-2 ${
          isSpeaking 
            ? 'bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30' 
            : hasSelection()
            ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30'
            : 'bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30'
        } ${
          (!text.trim() && !hasSelection()) && !isSpeaking ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title={getButtonTitle()}
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
            <span>{getButtonText()}</span>
          </>
        )}
      </button>
    </div>
  )
}
