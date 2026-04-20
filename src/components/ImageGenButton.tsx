import { useState, useEffect, useCallback, useRef } from 'react'
import { useSituationStore } from '../state/useSituationStore'

interface ImageGenButtonProps {
  text: string
  size: number
  onImageGenerated?: (imageUrl: string) => void
  className?: string
  cacheKey?: string
}

export function ImageGenButton({ text, size = 128, className = '', cacheKey, onImageGenerated }: ImageGenButtonProps) {
  const { aiConfig, mediaUrls, updateMediaUrls, addBatchTask, batchQueue } = useSituationStore()
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasCachedImage, setHasCachedImage] = useState(() => {
    // Check if there's a cached image in mediaUrls
    return cacheKey ? !!mediaUrls[cacheKey] : false
  })
  const [originalText, setOriginalText] = useState<string | null>(() => {
    if (cacheKey) {
      const saved = localStorage.getItem(`image-original-${cacheKey}`)
      return saved ? JSON.parse(saved) : null
    }
    return null
  })
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(() => {
    if (cacheKey) {
      const saved = localStorage.getItem(`image-enhanced-${cacheKey}`)
      return saved ? JSON.parse(saved) : null
    }
    return null
  })
  const [error, setError] = useState<string | null>(null)
  const [hoveredPrompt, setHoveredPrompt] = useState<'original' | 'enhanced' | null>(null)

  // Update hasCachedImage when mediaUrls changes
  useEffect(() => {
    setHasCachedImage(cacheKey ? !!mediaUrls[cacheKey] : false)
  }, [mediaUrls, cacheKey])

  // Use ref to avoid dependency cycle with onImageGenerated
  const onImageGeneratedRef = useRef(onImageGenerated)
  useEffect(() => {
    onImageGeneratedRef.current = onImageGenerated
  }, [onImageGenerated])

  // Track if we've already restored from cache to prevent infinite loop
  const hasRestoredRef = useRef(false)

  // Generate storage key based on cacheKey or text+size
  const storageKeyFinal = cacheKey ? `img_${cacheKey}_${size}` : `img_${text}_${size}`
  const promptsStorageKey = cacheKey ? `prompts_${cacheKey}_${size}` : `prompts_${text}_${size}`

  // Restore cached prompts from localStorage on mount (only once)
  useEffect(() => {
    if (hasRestoredRef.current) return
    if (cacheKey && typeof localStorage !== 'undefined') {
      const savedPrompts = localStorage.getItem(promptsStorageKey || '')
      if (savedPrompts) {
        try {
          const prompts = JSON.parse(savedPrompts)
          setOriginalText(prompts.original)
          setEnhancedPrompt(prompts.enhanced)
        } catch (e) {
          console.error('Failed to parse saved prompts:', e)
        }
      }
      hasRestoredRef.current = true
    }
  }, [cacheKey, promptsStorageKey])

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setError(null)

    try {
      // Add task to batch queue
      const taskId = addBatchTask({
        type: 'image',
        text: text,
        size: size,
        cacheKey: cacheKey
      })

      // Check if this task is in the queue and wait for completion
      const checkCompletion = setInterval(() => {
        const task = batchQueue.find(t => t.id === taskId)
        if (task) {
          if (task.status === 'completed' && task.result) {
            clearInterval(checkCompletion)
            setHasCachedImage(true)
            if (onImageGeneratedRef.current) {
              onImageGeneratedRef.current(task.result)
            }
            setIsGenerating(false)
          } else if (task.status === 'failed') {
            clearInterval(checkCompletion)
            setError(task.error || 'Generation failed')
            setIsGenerating(false)
          }
        }
      }, 500)

      // Also save prompts for display
      const promptResponse = await fetch('http://localhost:3322/api/enhance-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          provider: aiConfig.provider,
          baseUrl: aiConfig.baseUrl,
          model: aiConfig.model
        })
      })

      if (promptResponse.ok) {
        const promptData = await promptResponse.json()
        const enhancedPrompt = promptData.enhancedPrompt || text

        localStorage.setItem(promptsStorageKey, JSON.stringify({
          original: text,
          enhanced: enhancedPrompt
        }))

        setOriginalText(text)
        setEnhancedPrompt(enhancedPrompt)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setIsGenerating(false)
    }
  }, [text, size, cacheKey, addBatchTask, batchQueue, aiConfig])

  return (
    <div className={`bg-black/40 border border-white/10 p-2 ${className}`}>
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="flex items-center justify-center w-10 h-10 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title={hasCachedImage ? `Regenerate (${size}px)` : `Generate Image (${size}px)`}
      >
        {isGenerating ? (
          <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent animate-spin" />
        ) : hasCachedImage ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        )}
      </button>
      {error && (
        <span className="text-[0.6rem] text-red-400">{error}</span>
      )}
      
      {/* Prompt display buttons */}
      {(originalText || enhancedPrompt) && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {originalText && (
            <div className="relative group">
              <button
                onMouseEnter={() => setHoveredPrompt('original')}
                onMouseLeave={() => setHoveredPrompt(null)}
                className="flex items-center justify-center w-10 h-10 bg-slate-600/40 hover:bg-slate-500/50 border border-slate-500/30 rounded-lg transition-all"
                title="Original Text"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </button>
              {/* Floating tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800/90 border border-slate-600/50 text-[0.65rem] text-slate-300 max-w-[300px] break-words whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                {originalText}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800/90"></div>
              </div>
            </div>
          )}
          {enhancedPrompt && (
            <div className="relative group">
              <button
                onMouseEnter={() => setHoveredPrompt('enhanced')}
                onMouseLeave={() => setHoveredPrompt(null)}
                className="flex items-center justify-center w-10 h-10 bg-purple-600/40 hover:bg-purple-500/50 border border-purple-500/30 rounded-lg transition-all"
                title="Enhanced Prompt"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
              {/* Floating tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-purple-800/90 border border-purple-600/50 text-[0.65rem] text-purple-300 max-w-[300px] break-words whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                {enhancedPrompt}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-purple-800/90"></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
