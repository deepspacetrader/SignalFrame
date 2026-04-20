import { useState, useEffect, useRef } from 'react'
import { useSituationStore } from '../state/useSituationStore'

export function ModelUnloadControl() {
  const [imageGenLoaded, setImageGenLoaded] = useState(false)
  const [audioGenLoaded, setAudioGenLoaded] = useState(false)
  const [isUnloading, setIsUnloading] = useState<'image' | 'audio' | null>(null)
  const [imageGenLoading, setImageGenLoading] = useState(false)
  const [audioGenLoading, setAudioGenLoading] = useState(false)
  const imageGenPrevLoadedRef = useRef(false)
  const audioGenPrevLoadedRef = useRef(false)
  const { aiConfig } = useSituationStore()

  // Only check status when generation flags change, not on mount
  // This avoids 404 errors when services aren't running

  // Trigger status check when generation flags change
  useEffect(() => {
    if (aiConfig.isGeneratingImage) {
      checkImageGenStatus()
    }
  }, [aiConfig.isGeneratingImage])

  useEffect(() => {
    if (aiConfig.isGeneratingAudio) {
      checkAudioGenStatus()
    }
  }, [aiConfig.isGeneratingAudio])

  const checkImageGenStatus = async () => {
    try {
      const response = await fetch('http://localhost:2233/status')
      if (response.ok) {
        const data = await response.json()
        const isLoaded = data.model_loaded || false
        
        // Show loading if generation is in progress and model is not loaded
        if (aiConfig.isGeneratingImage && !isLoaded && !isUnloading) {
          setImageGenLoading(true)
        } else if (isLoaded) {
          setImageGenLoading(false)
        }
        
        imageGenPrevLoadedRef.current = isLoaded
        setImageGenLoaded(isLoaded)
      } else {
        setImageGenLoaded(false)
        setImageGenLoading(false)
      }
    } catch (error) {
      // Silently handle connection errors - service might not be running
      setImageGenLoaded(false)
      setImageGenLoading(false)
    }
  }

  const checkAudioGenStatus = async () => {
    try {
      const response = await fetch('http://localhost:7860/status')
      if (response.ok) {
        const data = await response.json()
        const isLoaded = data.model_loaded || false
        
        // Show loading if generation is in progress and model is not loaded
        if (aiConfig.isGeneratingAudio && !isLoaded && !isUnloading) {
          setAudioGenLoading(true)
        } else if (isLoaded) {
          setAudioGenLoading(false)
        }
        
        audioGenPrevLoadedRef.current = isLoaded
        setAudioGenLoaded(isLoaded)
      } else {
        setAudioGenLoaded(false)
        setAudioGenLoading(false)
      }
    } catch (error) {
      setAudioGenLoaded(false)
      setAudioGenLoading(false)
    }
  }

  const unloadImageGen = async () => {
    if (!imageGenLoaded) return
    
    setIsUnloading('image')
    try {
      const response = await fetch('http://localhost:3322/unload', {
        method: 'POST'
      })
      if (response.ok) {
        setImageGenLoaded(false)
      }
    } catch (error) {
      console.error('Failed to unload image gen model:', error)
    } finally {
      setIsUnloading(null)
    }
  }

  const unloadAudioGen = async () => {
    if (!audioGenLoaded) return
    
    setIsUnloading('audio')
    try {
      const response = await fetch('http://localhost:7860/unload', {
        method: 'POST'
      })
      if (response.ok) {
        setAudioGenLoaded(false)
      }
    } catch (error) {
      console.error('Failed to unload audio gen model:', error)
    } finally {
      setIsUnloading(null)
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={unloadImageGen}
        disabled={!imageGenLoaded || isUnloading === 'image'}
        className={`px-3 py-2 text-[10px] uppercase font-bold tracking-widest border transition-all flex items-center gap-2
          ${imageGenLoaded 
            ? 'bg-green-500/20 border-green-500/30 text-green-400 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 hover:cursor-alias' 
            : imageGenLoading
            ? 'bg-blue-500/20 border-blue-500/30 text-blue-400 cursor-default'
            : 'bg-slate-500/20 border-slate-500/30 text-slate-400 cursor-default'
          }
          ${isUnloading === 'image' ? 'opacity-50' : ''}
        `}
        title={imageGenLoaded ? 'Unload model' : imageGenLoading ? 'Loading image generation model...' : 'Image generation model not loaded'}
      >
        {isUnloading === 'image' ? (
          'Unloading...'
        ) : imageGenLoading ? (
          <>
            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            Loading...
          </>
        ) : (
          'Image Model'
        )}
      </button>

      <button
        onClick={unloadAudioGen}
        disabled={!audioGenLoaded || isUnloading === 'audio'}
        className={`px-3 py-2 text-[10px] uppercase font-bold tracking-widest border transition-all flex items-center gap-2
          ${audioGenLoaded 
            ? 'bg-green-500/20 border-green-500/30 text-green-400 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 hover:cursor-alias' 
            : audioGenLoading
            ? 'bg-blue-500/20 border-blue-500/30 text-blue-400 cursor-default'
            : 'bg-slate-500/20 border-slate-500/30 text-slate-400 cursor-default'
          }
          ${isUnloading === 'audio' ? 'opacity-50' : ''}
        `}
        title={audioGenLoaded ? 'Unload model' : audioGenLoading ? 'Loading audio generation model...' : 'Audio generation model not loaded'}
      >
        {isUnloading === 'audio' ? (
          'Unloading...'
        ) : audioGenLoading ? (
          <>
            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            Loading...
          </>
        ) : (
          'Audio Model'
        )}
      </button>
    </div>
  )
}
