import { useState, useRef, useEffect, useCallback } from 'react'
import { useSituationStore } from '../state/useSituationStore'

interface AudioGenButtonProps {
  text: string
  className?: string
  cacheKey?: string
  onAudioGenerated?: (audioUrl: string) => void
}

export function AudioGenButton({ text, onAudioGenerated, cacheKey, className = '' }: AudioGenButtonProps) {
  const { aiConfig, mediaUrls, updateMediaUrls, addBatchTask, batchQueue } = useSituationStore()
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
  const { soundVolume } = useSituationStore()

  // Update audioUrl when mediaUrls changes
  useEffect(() => {
    if (cacheKey) {
      setAudioUrl(mediaUrls[cacheKey] || null)
    }
  }, [mediaUrls, cacheKey])

  // Update audio volume when soundVolume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = soundVolume
    }
  }, [soundVolume])

  // Use ref to avoid dependency cycle with onAudioGenerated
  const onAudioGeneratedRef = useRef(onAudioGenerated)
  useEffect(() => {
    onAudioGeneratedRef.current = onAudioGenerated
  }, [onAudioGenerated])

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const audioProvider = aiConfig.audioProvider || 'tangoflux'
      const baseUrl = audioProvider === 'tangoflux' ? 'http://localhost:7861' : 'http://localhost:7862'
      // Add task to batch queue
      const taskId = addBatchTask({
        type: 'audio',
        text: text,
        cacheKey: cacheKey
      })

      // Check if this task is in the queue and wait for completion
      const checkCompletion = setInterval(() => {
        const task = batchQueue.find(t => t.id === taskId)
        if (task) {
          if (task.status === 'completed' && task.result) {
            clearInterval(checkCompletion)
            setAudioUrl(task.result)
            // Auto-play after generation
            if (audioRef.current) {
              audioRef.current.src = task.result
              audioRef.current.play()
              setIsPlaying(true)
            }
            if (onAudioGeneratedRef.current) {
              onAudioGeneratedRef.current(task.result)
            }
            setIsGenerating(false)
          } else if (task.status === 'failed') {
            clearInterval(checkCompletion)
            setError(task.error || 'Generation failed')
            setIsGenerating(false)
          }
        }
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setIsGenerating(false)
    }
  }, [text, cacheKey, addBatchTask, batchQueue])

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
