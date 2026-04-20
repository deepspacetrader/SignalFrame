import { useSituationStore } from '../state/useSituationStore'

export function BatchProgress() {
  const { batchQueue, isProcessingBatch, currentBatchType, clearBatchQueue } = useSituationStore()

  if (batchQueue.length === 0) {
    return null
  }

  const queuedCount = batchQueue.filter(t => t.status === 'queued').length
  const processingCount = batchQueue.filter(t => t.status === 'processing').length
  const completedCount = batchQueue.filter(t => t.status === 'completed').length
  const failedCount = batchQueue.filter(t => t.status === 'failed').length

  return (
    <div className="fixed bottom-4 left-4 bg-bg-card border border-white/10 rounded-lg shadow-2xl p-4 max-w-sm z-50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Batch Generation
        </h4>
        {batchQueue.length === completedCount + failedCount && (
          <button
            onClick={clearBatchQueue}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary">Total Tasks</span>
          <span className="text-text-primary font-semibold">{batchQueue.length}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary">Queued</span>
          <span className="text-yellow-400 font-semibold">{queuedCount}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary">Processing</span>
          <span className="text-blue-400 font-semibold">{processingCount}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary">Completed</span>
          <span className="text-green-400 font-semibold">{completedCount}</span>
        </div>
        {failedCount > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Failed</span>
            <span className="text-red-400 font-semibold">{failedCount}</span>
          </div>
        )}
      </div>

      {isProcessingBatch && (
        <div className="flex items-center gap-2 text-xs text-text-secondary mb-2">
          <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent animate-spin rounded-full" />
          <span>
            Processing {currentBatchType === 'image' ? 'images' : 'audio'}...
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
          style={{
            width: `${((completedCount + failedCount) / batchQueue.length) * 100}%`
          }}
        />
      </div>

      {/* Task list */}
      {batchQueue.length > 0 && (
        <div className="mt-3 max-h-32 overflow-y-auto space-y-1">
          {batchQueue.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 text-xs p-1.5 bg-black/30 rounded"
            >
              <div className="flex-shrink-0">
                {task.status === 'queued' && (
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                )}
                {task.status === 'processing' && (
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                )}
                {task.status === 'completed' && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-400">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {task.status === 'failed' && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-red-400">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
              </div>
              <span className="text-text-secondary truncate flex-1">
                {task.type === 'image' ? '🖼️' : '🔊'} {task.text.substring(0, 30)}
                {task.text.length > 30 && '...'}
              </span>
              {task.error && (
                <span className="text-red-400 text-[10px] truncate max-w-20" title={task.error}>
                  Error
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
