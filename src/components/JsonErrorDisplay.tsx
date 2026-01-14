import { useState, useEffect, useRef } from 'react'

interface JsonErrorProps {
  error: string
  onRetry: () => void
  onCancel: () => void
  countdown?: number
  isRetrying?: boolean
}

export function JsonErrorDisplay({ error, onRetry, onCancel, countdown = 5, isRetrying = false }: JsonErrorProps) {
  const [timeLeft, setTimeLeft] = useState(countdown)
  const [isCountingDown, setIsCountingDown] = useState(true)
  const onRetryRef = useRef(onRetry)
  
  // Update ref when onRetry changes
  useEffect(() => {
    onRetryRef.current = onRetry
  }, [onRetry])

  // Reset countdown when error changes (new error) or when component is no longer retrying
  useEffect(() => {
    if (!isRetrying) {
      setTimeLeft(countdown)
      setIsCountingDown(true)
    }
  }, [error, countdown, isRetrying])

  // Stop countdown when retrying starts
  useEffect(() => {
    if (isRetrying) {
      setIsCountingDown(false)
    }
  }, [isRetrying])

  useEffect(() => {
    if (!isCountingDown || timeLeft <= 0 || isRetrying) {
      // Auto-retry when countdown reaches 0
      if (timeLeft === 0 && isCountingDown && !isRetrying) {
        console.log('JsonErrorDisplay: Auto-retry triggered');
        setIsCountingDown(false)
        onRetryRef.current()
      }
      return
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsCountingDown(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, isCountingDown, isRetrying]) // No function dependencies

  const handleRetry = () => {
    if (isCountingDown && timeLeft > 0) {
      // Cancel countdown and retry immediately
      setIsCountingDown(false)
      setTimeLeft(0)
    }
    onRetry()
  }

  const handleCancel = () => {
    setIsCountingDown(false)
    onCancel()
  }

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg className="w-5 h-5 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-400 mb-2">AI Response Error</h3>
          <p className="text-xs text-red-300 mb-3">{error}</p>
          
          <div className="flex gap-2">
            {isCountingDown && timeLeft > 0 && !isRetrying && (
              <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded border border-yellow-500/30">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Auto-retry in {timeLeft}s...</span>
              </div>
            )}
            
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="text-xs px-3 py-2 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isRetrying ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retrying...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {isCountingDown && timeLeft > 0 ? 'Retry Now' : 'Regenerate'}
                </>
              )}
            </button>
            
            {isCountingDown && timeLeft > 0 && (
              <button
                onClick={handleCancel}
                className="text-xs px-3 py-2 bg-gray-500/20 text-gray-400 rounded border border-gray-500/30 hover:bg-gray-500/30 transition-colors flex items-center gap-2"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
