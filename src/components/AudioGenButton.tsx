import { useState, useRef, useEffect } from 'react'
import { useSituationStore } from '../state/useSituationStore'

interface AudioGenButtonProps {
  text: string
  className?: string
  cacheKey?: string
  onAudioGenerated?: (audioUrl: string) => void
}

export function AudioGenButton({ text, onAudioGenerated, cacheKey, className = '' }: AudioGenButtonProps) {
  const { aiConfig, mediaUrls, updateMediaUrls } = useSituationStore()
  const [isGenerating, setIsGenerating] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(() => {
    // Load cached audio from mediaUrls on mount
    if (cacheKey) {
      return mediaUrls[cacheKey] || null
    }
    return null
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Update audioUrl when mediaUrls changes
  useEffect(() => {
    if (cacheKey) {
      setAudioUrl(mediaUrls[cacheKey] || null)
    }
  }, [mediaUrls, cacheKey])

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      // First, enhance the prompt using the audio-gen API
      const promptResponse = await fetch('http://localhost:7860/api/prompt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          current_text: text,
          llm_provider: aiConfig.provider,
          llm_model: aiConfig.model,
          llm_base_url: aiConfig.baseUrl
        })
      })

      if (!promptResponse.ok) {
        throw new Error('Failed to generate prompt')
      }

      const promptData = await promptResponse.json()
      const enhancedPrompt = promptData.prompt || text
      const negativePrompt = promptData.negative_prompt || ''

      // Set the SFX parameters
      await fetch('http://localhost:7860/api/sfx/params', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: enhancedPrompt,
          negative_prompt: negativePrompt,
          duration: 2.0,
          cfg_strength: 4.5,
          num_steps: 25,
          seed: -1
        })
      })

      // Generate the sound effect
      const sfxResponse = await fetch('http://localhost:7860/api/sfx/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (!sfxResponse.ok) {
        throw new Error('Failed to generate sound effect')
      }

      const sfxData = await sfxResponse.json()
      
      if (!sfxData.success) {
        throw new Error(sfxData.error || 'Generation failed')
      }

      // The audio path is relative to the audio-gen directory
      const newAudioUrl = `http://localhost:7860${sfxData.filepath}`
      
      // Cache to IndexedDB via updateMediaUrls
      if (cacheKey) {
        updateMediaUrls({ [cacheKey]: newAudioUrl })
      }
      setAudioUrl(newAudioUrl)
      
      // Auto-play after generation
      if (audioRef.current) {
        audioRef.current.src = newAudioUrl
        audioRef.current.play()
        setIsPlaying(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePlayPause = () => {
    if (!audioUrl) return

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  return (
    <div className={`bg-black/40 border border-white/10 p-2 ${className}`}>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center justify-center w-10 h-10 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Generate SFX"
        >
          {isGenerating ? (
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent animate-spin" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {audioUrl && (
          <button
            onClick={handlePlayPause}
            className="flex items-center justify-center w-10 h-10 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-300 transition-all"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>
        )}
      </div>

      {error && (
        <span className="text-[0.6rem] text-red-400">{error}</span>
      )}

      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onError={() => setError('Audio playback failed')}
      />
    </div>
  )
}
