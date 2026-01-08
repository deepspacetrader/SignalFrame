
import { useState, useEffect } from 'react'
import { useSituationStore } from '../state/useSituationStore'

export function AISettings() {
    const { aiConfig, availableModels, updateAiConfig, fetchAvailableModels } = useSituationStore()
    const [isOpen, setIsOpen] = useState(false)
    const [tempConfig, setTempConfig] = useState(aiConfig)

    useEffect(() => {
        if (isOpen) {
            fetchAvailableModels();
        }
    }, [isOpen, fetchAvailableModels]);

    const isModelInstalled = availableModels.length === 0 || availableModels.includes(tempConfig.model);

    const handleSave = () => {
        updateAiConfig(tempConfig);
        setIsOpen(false);
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 p-3 bg-bg-card backdrop-blur-xl border border-white/10 rounded-full shadow-2xl hover:border-accent-primary/50 transition-all group"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary group-hover:text-accent-primary group-hover:rotate-45 transition-all">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            </button>
        )
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-bg-darker/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-bg-card border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
                <h3 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
                    <span className="w-1 h-6 bg-accent-primary rounded-full"></span>
                    AI Engine Parameters
                </h3>

                <div className="space-y-6">
                    <div>
                        <label className="block text-[0.65rem] uppercase tracking-widest font-bold text-text-secondary mb-2">Target Model</label>
                        <input
                            type="text"
                            value={tempConfig.model}
                            onChange={(e) => setTempConfig({ ...tempConfig, model: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-text-primary focus:border-accent-primary outline-none transition-all"
                            placeholder="e.g., llama3.2, mistral"
                        />
                        {!isModelInstalled && (
                            <div className="mt-3 p-3 bg-accent-alert/10 border border-accent-alert/20 rounded-lg">
                                <p className="text-xs text-accent-alert mb-2 font-semibold flex items-center gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                    Model not detected locally
                                </p>
                                <code className="block bg-black/40 p-2 rounded text-[10px] text-white font-mono select-all cursor-pointer hover:bg-black/60 transition-all">
                                    ollama pull {tempConfig.model}
                                </code>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[0.65rem] uppercase tracking-widest font-bold text-text-secondary mb-2">Context Window (num_ctx)</label>
                            <input
                                type="number"
                                value={tempConfig.numCtx}
                                onChange={(e) => setTempConfig({ ...tempConfig, numCtx: parseInt(e.target.value) || 4096 })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-text-primary focus:border-accent-primary outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[0.65rem] uppercase tracking-widest font-bold text-text-secondary mb-2">Max Predict (num_predict)</label>
                            <input
                                type="number"
                                value={tempConfig.numPredict}
                                onChange={(e) => setTempConfig({ ...tempConfig, numPredict: parseInt(e.target.value) || 2048 })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-text-primary focus:border-accent-primary outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            onClick={handleSave}
                            className="flex-1 py-3 bg-accent-primary text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:opacity-90 transition-all"
                        >
                            Apply & Save
                        </button>
                        <button
                            onClick={() => {
                                setTempConfig(aiConfig);
                                setIsOpen(false);
                            }}
                            className="py-3 px-6 bg-white/5 text-text-secondary border border-white/10 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
