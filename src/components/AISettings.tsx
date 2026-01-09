
import { useState, useEffect } from 'react'
import { useSituationStore } from '../state/useSituationStore'

export function AISettings() {
    const { aiConfig, availableModels, updateAiConfig, fetchAvailableModels } = useSituationStore()
    const [isOpen, setIsOpen] = useState(false)
    const [tempConfig, setTempConfig] = useState(aiConfig)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (isOpen) {
            fetchAvailableModels();
        }
    }, [isOpen, fetchAvailableModels]);

    const isModelInstalled = availableModels.length === 0 || availableModels.some(m => {
        const normalizedInput = tempConfig.model.toLowerCase().trim();
        const normalizedModel = m.toLowerCase();
        return normalizedModel === normalizedInput ||
            normalizedModel === `${normalizedInput}:latest` ||
            normalizedModel.split(':')[0] === normalizedInput;
    });

    const handleCopy = () => {
        navigator.clipboard.writeText(`ollama pull ${tempConfig.model}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    const handleSave = () => {
        updateAiConfig(tempConfig);
        setIsOpen(false);
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="bottom-6 right-6 z-50 p-3 bg-bg-card backdrop-blur-xl border border-white/10 rounded-full shadow-2xl hover:border-accent-primary/50 transition-all group"
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
            <div className="bg-bg-card border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl relative top-40">
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
                                <div className="space-y-2">
                                    <p className="text-[10px] text-text-secondary uppercase font-bold">Try pulling it:</p>
                                    <div className="relative group/copy">
                                        <code className="block bg-black/40 p-2 pr-10 rounded text-[10px] text-white font-mono transition-all overflow-hidden text-ellipsis whitespace-nowrap">
                                            ollama pull {tempConfig.model}
                                        </code>
                                        <button
                                            onClick={handleCopy}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent-primary transition-colors p-1.5 bg-bg-card/50 rounded-md"
                                            title="Copy to clipboard"
                                        >
                                            {copied ? (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="text-accent-secondary animate-in zoom-in duration-300"><polyline points="20 6 9 17 4 12" /></svg>
                                            ) : (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                            )}
                                        </button>
                                    </div>

                                    {availableModels.length > 0 && (
                                        <>
                                            <p className="text-[10px] text-text-secondary uppercase font-bold pt-2">Or select active model:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {availableModels.slice(0, 5).map(m => (
                                                    <button
                                                        key={m}
                                                        onClick={() => setTempConfig({ ...tempConfig, model: m })}
                                                        className="text-[9px] bg-white/5 hover:bg-accent-primary/20 border border-white/10 rounded px-2 py-1 text-text-primary transition-all"
                                                    >
                                                        {m}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
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

                    {/* Thinking Mode Toggle */}
                    <div className="p-4 bg-accent-secondary/10 border border-accent-secondary/20 rounded-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <label className="block text-[0.65rem] uppercase tracking-widest font-bold text-accent-secondary mb-1">
                                    Enable Thinking Mode
                                </label>
                                <p className="text-[10px] text-text-secondary leading-relaxed">
                                    Uses chain-of-thought reasoning for deeper analysis.
                                    Requires a thinking-capable model (deepseek-r1, qwen3, gpt-oss).
                                </p>
                            </div>
                            <button
                                onClick={() => setTempConfig({ ...tempConfig, enableThinking: !tempConfig.enableThinking })}
                                className={`relative w-14 h-7 rounded-full transition-all duration-300 ${tempConfig.enableThinking
                                    ? 'bg-accent-secondary'
                                    : 'bg-white/10 border border-white/20'
                                    }`}
                            >
                                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg transition-all duration-300 ${tempConfig.enableThinking ? 'left-8' : 'left-1'
                                    }`}></div>
                            </button>
                        </div>
                        {tempConfig.enableThinking && (
                            <div className="mt-3 pt-3 border-t border-accent-secondary/20">
                                <p className="text-[9px] text-accent-secondary/80 flex items-center gap-2">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="16" x2="12" y2="12" />
                                        <line x1="12" y1="8" x2="12.01" y2="8" />
                                    </svg>
                                    AI reasoning trace will appear in the Narrative section
                                </p>
                            </div>
                        )}
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
