import { useState, useEffect, useCallback, useRef } from 'react'
import { useSituationStore } from '../state/useSituationStore'

interface MediaGenerationButtonsProps {
  text: string
  imageSize?: number
  onImageGenerated?: (imageUrl: string) => void
  cacheKey?: string
  className?: string
}

export function MediaGenerationButtons({ 
  text, 
  imageSize = 128, 
  onImageGenerated, 
  cacheKey,
  className = '' 
}: MediaGenerationButtonsProps) {
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const { aiConfig, updateAiConfig, updateMediaUrls, mediaUrls } = useSituationStore()
  
  const [originalText, setOriginalText] = useState<string | null>(() => {
    // Load cached image prompt from mediaUrls on mount
    if (cacheKey) {
      return mediaUrls[`${cacheKey}_image_original`] || null
    }
    return null
  })
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(() => {
    // Load cached image enhanced prompt from mediaUrls on mount
    if (cacheKey) {
      return mediaUrls[`${cacheKey}_image_enhanced`] || null
    }
    return null
  })
  const [hoveredImagePrompt, setHoveredImagePrompt] = useState<'original' | 'enhanced' | null>(null)
  
  const [audioOriginalText, setAudioOriginalText] = useState<string | null>(() => {
    // Load cached audio original prompt from mediaUrls on mount
    if (cacheKey) {
      return mediaUrls[`${cacheKey}_audio_original`] || null
    }
    return null
  })
  const [audioEnhancedPrompt, setAudioEnhancedPrompt] = useState<string | null>(() => {
    // Load cached audio enhanced prompt from mediaUrls on mount
    if (cacheKey) {
      return mediaUrls[`${cacheKey}_audio_enhanced`] || null
    }
    return null
  })
  const [hoveredAudioPrompt, setHoveredAudioPrompt] = useState<'original' | 'enhanced' | null>(null)
  
  const [audioUrl, setAudioUrl] = useState<string | null>(() => {
    // Load cached audio from mediaUrls on mount
    if (cacheKey) {
      return mediaUrls[`${cacheKey}_audio`] || null
    }
    return null
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const { soundVolume } = useSituationStore()
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(() => {
    // Load cached image from mediaUrls on mount
    if (cacheKey) {
      return mediaUrls[`${cacheKey}_image`] || null
    }
    return null
  })

  // Update audioUrl when mediaUrls changes
  useEffect(() => {
    if (cacheKey) {
      setAudioUrl(mediaUrls[`${cacheKey}_audio`] || null)
    }
  }, [mediaUrls, cacheKey])

  // Update audio volume when soundVolume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = soundVolume
    }
  }, [soundVolume])

  // Update generatedImageUrl when mediaUrls changes
  useEffect(() => {
    if (cacheKey) {
      setGeneratedImageUrl(mediaUrls[`${cacheKey}_image`] || null)
    }
  }, [mediaUrls, cacheKey])

  // Use ref to avoid dependency cycle with onImageGenerated
  const onImageGeneratedRef = useRef(onImageGenerated)
  useEffect(() => {
    onImageGeneratedRef.current = onImageGenerated
  }, [onImageGenerated])

  // Update prompt states when mediaUrls changes
  useEffect(() => {
    if (cacheKey) {
      setOriginalText(mediaUrls[`${cacheKey}_image_original`] || null)
      setEnhancedPrompt(mediaUrls[`${cacheKey}_image_enhanced`] || null)
      setAudioOriginalText(mediaUrls[`${cacheKey}_audio_original`] || null)
      setAudioEnhancedPrompt(mediaUrls[`${cacheKey}_audio_enhanced`] || null)
    }
  }, [mediaUrls, cacheKey])

  const handleGenerateImage = useCallback(async () => {
    setIsGeneratingImage(true)
    setImageError(null)
    updateAiConfig({ isGeneratingImage: true })

    try {
      // First, enhance the prompt using the LLM for image generation
      console.log('[MediaGenerationButtons] Sending to image enhancement:', {
        model: aiConfig.model,
        provider: aiConfig.provider,
        baseUrl: aiConfig.baseUrl
      });
      const promptResponse = await fetch('http://localhost:3322/api/enhance-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: text,
          model: aiConfig.model,
          provider: aiConfig.provider,
          baseUrl: aiConfig.baseUrl
        })
      })

      if (!promptResponse.ok) {
        throw new Error('Failed to enhance prompt')
      }

      const promptData = await promptResponse.json()
      const enhancedPromptText = promptData.enhancedPrompt || text

      // Truncate prompt to fit within CLIP's 77 token limit (~300 characters)
      const truncatedPrompt = enhancedPromptText.length > 300 
        ? enhancedPromptText.substring(0, 300) + '...'
        : enhancedPromptText;

      // Store prompts for display and cache to IndexedDB
      setOriginalText(text)
      setEnhancedPrompt(truncatedPrompt)
      
      if (cacheKey) {
        updateMediaUrls({
          [`${cacheKey}_image_original`]: text,
          [`${cacheKey}_image_enhanced`]: truncatedPrompt
        })
      }

      // Generate the image using the enhanced prompt
      const imageResponse = await fetch('http://localhost:7860/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: truncatedPrompt,
          size: imageSize,
          steps: 5,
          guidance_scale: 1.0,
          auto_unload: (aiConfig as any).autoUnloadImageModel !== false
        })
      })

      if (!imageResponse.ok) {
        throw new Error('Failed to generate image')
      }

      const imageData = await imageResponse.json()
      const imageUrl = `/signalframe/generated_images/${imageData.filename}`

      // Cache to IndexedDB via updateMediaUrls
      if (cacheKey) {
        updateMediaUrls({ [`${cacheKey}_image`]: imageUrl })
      }

      // Call parent callback
      if (onImageGenerated) {
        onImageGenerated(imageUrl)
      }
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGeneratingImage(false)
      updateAiConfig({ isGeneratingImage: false })
    }
  }, [text, imageSize, aiConfig, updateAiConfig])

  const handleGenerateAudio = useCallback(async () => {
    setIsGeneratingAudio(true)
    setAudioError(null)
    updateAiConfig({ isGeneratingAudio: true })

    try {
      const audioProvider = aiConfig.audioProvider || 'tangoflux'
      const baseUrl = audioProvider === 'tangoflux' ? 'http://localhost:7861' : 'http://localhost:7862'

      // Store original text for audio
      setAudioOriginalText(text)

      // Generate prompt using LLM for both providers
      let enhancedPromptText = text
      let negativePrompt = ''

      // Use TangoFlux server for prompt enhancement (it now has LLM integration)
      const promptResponse = await fetch('http://localhost:7861/api/prompt/generate', {
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
      enhancedPromptText = promptData.prompt || promptData.description || text
      negativePrompt = promptData.negative_prompt || ''

      // Store the enhanced prompt and cache to IndexedDB
      setAudioEnhancedPrompt(enhancedPromptText)

      if (cacheKey) {
        updateMediaUrls({
          [`${cacheKey}_audio_original`]: text,
          [`${cacheKey}_audio_enhanced`]: enhancedPromptText
        })
      }

      // Generate random seed for variety
      const randomSeed = Math.floor(Math.random() * 1000000)

      // Use appropriate audio duration from aiConfig
      const audioDuration = cacheKey === 'narrative'
        ? (aiConfig as any).narrativeAudioDuration || 5
        : (aiConfig as any).signalsAudioDuration || 3

      // Set the SFX parameters
      const paramsBody: any = {
        text: enhancedPromptText,
        duration: audioDuration,
        num_steps: 50,
        auto_unload: aiConfig.autoUnloadAudioModel !== false
      }

      if (audioProvider === 'mmaudio') {
        paramsBody.negative_prompt = negativePrompt
        paramsBody.cfg_strength = 4.5
        paramsBody.seed = randomSeed
      }

      await fetch(`${baseUrl}/api/sfx/params`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paramsBody)
      })

      const sfxResponse = await fetch(`${baseUrl}/api/sfx/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (!sfxResponse.ok) {
        throw new Error('Failed to generate SFX')
      }

      const sfxData = await sfxResponse.json()
      const newAudioUrl = `${baseUrl}${sfxData.filepath}`

      // Cache to IndexedDB via updateMediaUrls
      if (cacheKey) {
        updateMediaUrls({ [`${cacheKey}_audio`]: newAudioUrl })
      }

      setAudioUrl(newAudioUrl)

      // Auto-play after generation
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = newAudioUrl
          audioRef.current.play()
          setIsPlaying(true)
        }
      }, 100)
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGeneratingAudio(false)
      updateAiConfig({ isGeneratingAudio: false })
    }
  }, [text, aiConfig, updateAiConfig])

  const handlePlayPause = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }, [isPlaying])

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* Top row: Image and Audio Gen buttons */}
      <div className="flex items-center gap-1">
        {/* Image Generation Button */}
        <div className="relative group">
          <button
            onClick={handleGenerateImage}
            disabled={isGeneratingImage}
            className="flex items-center justify-center w-7 h-7 bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/30 rounded text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Generate Image"
          >
            {isGeneratingImage ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <span className="text-sm">🖼️</span>
            )}
          </button>
          {/* Tooltip showing both prompts when image has been generated */}
          {(originalText || enhancedPrompt) && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-64 p-2 bg-slate-800/90 border border-slate-600/50 text-[0.6rem] text-slate-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="mb-1">
                <span className="text-slate-400 font-medium">Original:</span>
                <p className="text-slate-200 break-words">{originalText || 'N/A'}</p>
              </div>
              <div>
                <span className="text-purple-400 font-medium">Enhanced:</span>
                <p className="text-purple-200 break-words">{enhancedPrompt || 'N/A'}</p>
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800/90"></div>
            </div>
          )}
        </div>

        {/* Audio Generation Button */}
        <div className="relative group">
          <button
            onClick={handleGenerateAudio}
            disabled={isGeneratingAudio}
            className="flex items-center justify-center w-7 h-7 bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/30 rounded text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Generate SFX"
          >
            {isGeneratingAudio ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <span className="text-sm">🔊</span>
            )}
          </button>
          {/* Tooltip showing both audio prompts when audio has been generated */}
          {(audioOriginalText || audioEnhancedPrompt) && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-64 p-2 bg-slate-800/90 border border-slate-600/50 text-[0.6rem] text-slate-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="mb-1">
                <span className="text-slate-400 font-medium">Original:</span>
                <p className="text-slate-200 break-words">{audioOriginalText || 'N/A'}</p>
              </div>
              <div>
                <span className="text-purple-400 font-medium">Enhanced:</span>
                <p className="text-purple-200 break-words">{audioEnhancedPrompt || 'N/A'}</p>
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800/90"></div>
            </div>
          )}
        </div>

        {/* Audio Play Button */}
        {audioUrl && (
          <button
            onClick={handlePlayPause}
            className="flex items-center justify-center w-7 h-7 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded text-white transition-all"
            title={isPlaying ? "Pause" : "Play"}
          >
            <span className="text-sm">{isPlaying ? '⏸️' : '▶️'}</span>
          </button>
        )}
      </div>

      {/* Error displays */}
      {(imageError || audioError) && (
        <span className="text-[0.5rem] text-red-400">{imageError || audioError}</span>
      )}

      {/* Audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
        />
      )}
    </div>
  )
}
