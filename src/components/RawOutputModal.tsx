import { useEffect } from 'react'
import { useSituationStore } from '../state/useSituationStore'

interface RawOutputModalProps {
  isOpen: boolean
  onClose: () => void
  sectionId: string
  title: string
}

export function RawOutputModal({ isOpen, onClose, sectionId, title }: RawOutputModalProps) {
  const { rawOutputs, activeRawOutput } = useSituationStore()
  const rawOutput = rawOutputs[sectionId]

  // Format JSON for better readability
  const formatRawOutput = (output: string) => {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(output)
      return JSON.stringify(parsed, null, 2)
    } catch {
      // If not valid JSON, try to extract JSON from the string
      const jsonMatch = output.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          return JSON.stringify(parsed, null, 2)
        } catch {
          // If still fails, return original
          return output
        }
      }
      return output
    }
  }

  const formattedOutput = formatRawOutput(rawOutput || '')

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen || !rawOutput) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="relative w-full max-w-5xl max-h-[85vh] bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white font-display mb-2">
              Raw AI Output
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-300">{title}</span>
              <span className="text-slate-500">•</span>
              <span className="text-sm font-mono bg-slate-700/50 px-3 py-1 rounded-lg text-slate-300 border border-slate-600/50">
                {sectionId}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-xl bg-slate-700/50 hover:bg-slate-600/50 transition-all duration-200 text-slate-400 hover:text-white border border-slate-600/30 hover:border-slate-500/50"
            aria-label="Close modal"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-mono text-slate-400 uppercase tracking-wider">
                  Raw Response
                </span>
                <span className="text-xs text-slate-500">
                  ({rawOutput.length.toLocaleString()} characters)
                </span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(rawOutput)
                  // You could add a toast notification here
                }}
                className="text-sm px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all duration-200 flex items-center gap-2 border border-blue-500/30 hover:border-blue-400/50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy to Clipboard
              </button>
            </div>
            <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50">
              <pre className="text-sm text-slate-200 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {formattedOutput.split('\n').map((line, index) => (
                  <div key={index} className="flex">
                    <span className="text-slate-600 select-none mr-4 text-right" style={{ minWidth: '2.5ch' }}>
                      {index + 1}
                    </span>
                    <span className="flex-1">
                      {line.split(/(["{}\[\]:,])/).map((part, partIndex) => {
                        if (part === '"') return <span key={partIndex} className="text-green-400">{part}</span>
                        if (part === '{' || part === '}') return <span key={partIndex} className="text-orange-400 font-bold">{part}</span>
                        if (part === '[' || part === ']') return <span key={partIndex} className="text-blue-400 font-bold">{part}</span>
                        if (part === ':') return <span key={partIndex} className="text-purple-400 font-bold">{part}</span>
                        if (part === ',') return <span key={partIndex} className="text-slate-400">{part}</span>
                        // Highlight keys (before colon, not in quotes)
                        if (part.trim() && !line.includes('"' + part + '"') && line.includes(part + ':')) {
                          return <span key={partIndex} className="text-blue-300">{part}</span>
                        }
                        // Highlight string values
                        if (part.trim() && (line.includes('"' + part + '"') || line.match(/"[^"]*"/))) {
                          return <span key={partIndex} className="text-green-300">{part}</span>
                        }
                        // Highlight numbers
                        if (part.trim() && !isNaN(Number(part))) {
                          return <span key={partIndex} className="text-yellow-300">{part}</span>
                        }
                        // Highlight booleans and null
                        if (part === 'true' || part === 'false') {
                          return <span key={partIndex} className="text-cyan-400 font-semibold">{part}</span>
                        }
                        if (part === 'null') {
                          return <span key={partIndex} className="text-slate-500 font-semibold">{part}</span>
                        }
                        return <span key={partIndex}>{part}</span>
                      })}
                    </span>
                  </div>
                ))}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50 bg-gradient-to-r from-slate-800/30 to-slate-700/30 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <p className="text-xs text-slate-400">
              Unprocessed raw output from the AI model before any parsing or formatting
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
