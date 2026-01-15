
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSituationStore } from '../state/useSituationStore'
import { SENTIMENT_PROFILES, SentimentProfile, getSentimentProfile } from '../ai/runtime/sentimentEngine'
import { DEFAULT_num_ctx, DEFAULT_num_predict } from '../ai/runtime/ollama'

export function AISettings() {
    const { aiConfig, availableModels, updateAiConfig, fetchAvailableModels } = useSituationStore()
    const [isOpen, setIsOpen] = useState(false)
    const [tempConfig, setTempConfig] = useState(aiConfig)
    const [copied, setCopied] = useState(false)
    const [isCustomMode, setIsCustomMode] = useState(false)
    const [ollamaError, setOllamaError] = useState<string | null>(null)
    const [customWeights, setCustomWeights] = useState<Record<string, number> | null>(
        (aiConfig as any).customSentimentWeights || null
    )

    useEffect(() => {
        if (isOpen) {
            const checkOllamaStatus = async () => {
                try {
                    await fetchAvailableModels();
                    setOllamaError(null);
                } catch (error) {
                    setOllamaError('Ollama service is not running or not accessible');
                }
            };
            
            checkOllamaStatus();
            setTempConfig(aiConfig);
        }
    }, [isOpen, fetchAvailableModels, aiConfig]);

    useEffect(() => {
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscapeKey);
        }

        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [isOpen]);

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

    const handleSentimentProfileChange = (profileId: string) => {
        setTempConfig({
            ...tempConfig,
            sentimentProfile: profileId,
            customSentimentWeights: undefined
        });
        setIsCustomMode(false);
    }

    const handleCustomWeightChange = (sentiment: string, value: number) => {
        const newWeights = {
            ...(customWeights || {}),
            [sentiment]: value
        } as Record<string, number>
        setCustomWeights(newWeights)
        setTempConfig({
            ...tempConfig,
            sentimentProfile: 'custom',
            customSentimentWeights: newWeights
        })
    }

    const resetSentimentToDefaults = () => {
        setTempConfig({
            ...tempConfig,
            sentimentProfile: 'balanced',
            customSentimentWeights: undefined
        });
        setIsCustomMode(false);
        setCustomWeights(null);
    }

    const currentSentimentProfile = getSentimentProfile(tempConfig.sentimentProfile || 'balanced')

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="bottom-6 right-6 z-50 p-3 bg-bg-card backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl hover:border-accent-primary/50 transition-all group px-4 py-2"
            >
                <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">AI Settings</p>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary group-hover:text-accent-primary group-hover:rotate-45 transition-all mx-auto flex max-w-sm items-center">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            </button>
        )
    }

    return createPortal(
        <div 
            data-ai-settings-modal
            className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-bg-darker/80 backdrop-blur-md animate-in fade-in duration-300"
            onClick={(e) => {
                // Close if clicking on the backdrop (the outer div)
                if (e.target === e.currentTarget) {
                    setIsOpen(false);
                }
            }}
        >
            <div className="bg-bg-card border border-white/10 rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
                <h3 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
                    <span className="w-1 h-6 bg-accent-primary rounded-full"></span>
                    AI Engine Parameters
                </h3>

                <div className="space-y-6">
                    {/* Ollama Setup Guide */}
                    {ollamaError && (
                        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <div className="flex items-start gap-3 mb-4">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 flex-shrink-0 mt-0.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <div>
                                    <h4 className="text-sm text-red-400 font-semibold mb-1">Ollama Not Detected</h4>
                                    <p className="text-xs text-red-300">SignalFrame requires Ollama to be installed and running on your local machine</p>
                                </div>
                            </div>


                                {/* System Requirements */}
                                <div className="bg-black/40 rounded-lg p-4 gap-3 mb-4">
                                    <h5 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3">System Requirements</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <span className="text-text-tertiary">GPU:</span>
                                            <span className="text-text-primary ml-2">NVIDIA RTX 3060+ (tiny models may work on less powerful hardware)</span>
                                        </div>
                                        <div>
                                            <span className="text-text-tertiary">Storage:</span>
                                            <span className="text-text-primary ml-2">~10-20GB for AI models</span>
                                        </div>
                                        <div>
                                            <span className="text-text-tertiary">Internet Connection:</span>
                                            <span className="text-text-primary ml-2">For AI model and RSS feed downloads. (not required to generate AI responses)</span>
                                        </div>
                                    </div>
                                </div>

                            <div className="space-y-4">
                                {/* Installation Steps */}
                                <div className="bg-black/40 rounded-lg p-4">
                                    <h5 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3">Installation Steps</h5>
                                    
                                    <div className="space-y-3">
                                        {/* Windows */}
                                        <div className="border-l-2 border-blue-500/30 pl-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded font-mono">Windows</span>
                                            </div>
                                            <ol className="text-xs text-text-secondary space-y-1 ml-4">
                                                <li>1. Download from <a href="https://ollama.com/download/windows" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">ollama.com/download/windows</a></li>
                                                <li>2. Run the installer and follow setup wizard</li>
                                                <li>3. Ollama starts automatically in background</li>
                                            </ol>
                                        </div>

                                        {/* macOS */}
                                        <div className="border-l-2 border-green-500/30 pl-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded font-mono">macOS</span>
                                            </div>
                                            <ol className="text-xs text-text-secondary space-y-1 ml-4">
                                                <li>1. Download from <a href="https://ollama.com/download/mac" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">ollama.com/download/mac</a></li>
                                                <li>2. Open DMG and drag Ollama to Applications</li>
                                                <li>3. Launch Ollama from Applications folder</li>
                                            </ol>
                                        </div>

                                        {/* Linux */}
                                        <div className="border-l-2 border-yellow-500/30 pl-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded font-mono">Linux</span>
                                            </div>
                                            <div className="bg-black/60 rounded p-2 mt-2">
                                                <code className="text-xs text-green-400 font-mono">curl -fsSL https://ollama.com/install.sh | sh</code>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Verification */}
                                <div className="bg-black/40 rounded-lg p-4">
                                    <h5 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3">Verify Installation</h5>
                                    <p className="text-xs text-text-secondary mb-2">Open terminal/command prompt and run:</p>
                                    <div className="bg-black/60 rounded p-2 mb-3">
                                        <code className="text-xs text-green-400 font-mono">ollama list</code>
                                    </div>
                                    <p className="text-xs text-text-tertiary">If you see "Error: connect ECONNREFUSED 127.0.0.1:11434", restart Ollama</p>
                                </div>

                                {/* Download Models */}
                                <div className="bg-black/40 rounded-lg p-4">
                                    <h5 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3">Download an AI Model</h5>
                                    <p className="text-xs text-text-secondary mb-3">One billion parameters roughly equals 1GB of VRAM when using a moderate amount of context length. Exceeding this will force the CPU to process data the GPU cannot handle on its own, which is <b>significantly slower</b> than only GPU processing.</p>

                                    <p className="text-xs text-text-secondary mb-3">Try to have at least 1GB spare VRAM for other applications.</p>

                                    <p className="text-xs text-text-secondary mb-3">Choose an appropriate model for your hardware here are some recommendations to get started. (see <a href="https://ollama.com/search" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">ollama.com/search</a> for more models)</p>                                  
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10">
                                            <div>
                                                <span className="text-xs font-mono text-text-primary">deepseek-r1:8b</span>
                                            </div>
                                            <button
                                                onClick={() => navigator.clipboard.writeText('ollama pull deepseek-r1:8b')}
                                                className="text-xs bg-accent-primary/20 text-accent-primary px-2 py-1 rounded hover:bg-accent-primary/30 transition-colors"
                                            >
                                                Copy Command
                                            </button>
                                        </div>
                                        
                                        <div className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10">
                                            <div>
                                                <span className="text-xs font-mono text-text-primary">llama3.2:latest</span>
                                            </div>
                                            <button
                                                onClick={() => navigator.clipboard.writeText('ollama pull llama3.2:latest')}
                                                className="text-xs bg-accent-primary/20 text-accent-primary px-2 py-1 rounded hover:bg-accent-primary/30 transition-colors"
                                            >
                                                Copy Command
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10">
                                            <div>
                                                <span className="text-xs font-mono text-text-primary">qwen3:8b</span>
                                            </div>
                                            <button
                                                onClick={() => navigator.clipboard.writeText('ollama pull qwen3:8b')}
                                                className="text-xs bg-accent-primary/20 text-accent-primary px-2 py-1 rounded hover:bg-accent-primary/30 transition-colors"
                                            >
                                                Copy Command
                                            </button>
                                        </div>

                                        
                                    </div>
                                </div>


                                {/* Troubleshooting */}
                                <div className="bg-black/40 rounded-lg p-4">
                                    <h5 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3">Troubleshooting</h5>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-start gap-2">
                                            <span className="text-red-400">•</span>
                                            <span className="text-text-secondary"><strong>Connection errors:</strong> Restart Ollama or check if it's running on port 11434</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-red-400">•</span>
                                            <span className="text-text-secondary"><strong>Slow responses:</strong> Try smaller models or close GPU-intensive applications</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-red-400">•</span>
                                            <span className="text-text-secondary"><strong>Memory errors:</strong> Use 3B models or increase system RAM</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* No Models Available Alert */}
                    {!ollamaError && availableModels.length === 0 && (
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <p className="text-sm text-yellow-400 font-semibold flex items-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                No AI models detected in Ollama
                            </p>
                            <p className="text-xs text-yellow-300 mt-2">
                                Install models using: <code className="bg-black/40 px-2 py-1 rounded text-xs">ollama pull &lt;model-name&gt;</code>
                            </p>
                        </div>
                    )}

                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <label className="block text-[0.65rem] uppercase tracking-widest font-bold text-text-secondary">Target Model</label>
                            <div className="group relative">
                                <div className="w-3.5 h-3.5 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center cursor-help">
                                    <span className="text-[8px] text-accent-primary font-bold">i</span>
                                </div>
                                <div className="absolute left-full top-0 ml-2 w-64 p-3 bg-bg-darker border border-white/20 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999]">
                                    <p className="text-[11px] text-text-primary leading-relaxed mb-3">
                                        Choose a model based on your GPU VRAM and performance needs. Larger models offer better quality but require more resources.
                                    </p>
                                    <div className="border-t border-white/10 pt-2">
                                        <p className="text-[10px] text-accent-primary font-semibold mb-2">VRAM-Based Recommendations:</p>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-text-secondary">8GB VRAM:</span>
                                                <span className="text-text-primary font-mono">llama3.2:3b, qwen2.5:3b</span>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-text-secondary">12GB VRAM:</span>
                                                <span className="text-text-primary font-mono">llama3.2:7b, qwen2.5:7b</span>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-text-secondary">16GB VRAM:</span>
                                                <span className="text-text-primary font-mono">llama3.2:13b, qwen2.5:14b</span>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-text-secondary">24GB+ VRAM:</span>
                                                <span className="text-text-primary font-mono">llama3.2:70b, qwen2.5:32b</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-bg-darker"></div>
                                </div>
                            </div>
                        </div>
                        <input
                            type="text"
                            value={tempConfig.model}
                            onChange={(e) => setTempConfig({ ...tempConfig, model: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-text-primary focus:border-accent-primary outline-none transition-all"
                            placeholder="llama3.2, qwen3:8b, deepseek-r1:8b"
                        />
                        {!isModelInstalled && (
                            <div className="mt-3 p-3 bg-accent-alert/10 border border-accent-alert/20 rounded-lg">
                                <p className="text-xs text-accent-alert mb-2 font-semibold flex items-center gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                    AI model not detected locally
                                </p>
                                <div className="space-y-2">
                                    <p className="text-[10px] text-text-secondary font-bold">You can view / download models from Ollama using the terminal:</p>
                                    <div className="relative group/copy">
                                        <code className="block bg-black/40 p-2 pr-10 rounded text-[10px] text-green-400 font-mono transition-all overflow-hidden text-ellipsis whitespace-nowrap">
                                            ollama list
                                        </code>

                                        <code className="block bg-black/40 p-2 pr-10 rounded text-[10px] text-green-400 font-mono transition-all overflow-hidden text-ellipsis whitespace-nowrap">
                                            ollama pull modelName:size
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
                                            <p className="text-[10px] text-text-secondary font-bold pt-2">or select from these installed models:</p>
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
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block text-[0.65rem] uppercase tracking-widest font-bold text-text-secondary">Context Window (num_ctx)</label>
                                <div className="group relative">
                                    <div className="w-3.5 h-3.5 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center cursor-help">
                                        <span className="text-[8px] text-accent-primary font-bold">i</span>
                                    </div>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 p-3 bg-bg-darker border border-white/20 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                        <p className="text-[11px] text-text-primary leading-relaxed mb-3">
                                            Total tokens model can remember (input + output). Larger values allow longer conversations but use more VRAM.
                                        </p>
                                        <div className="border-t border-white/10 pt-2">
                                            <p className="text-[10px] text-accent-primary font-semibold mb-2">Context Size Recommendations:</p>
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-text-secondary">8GB VRAM:</span>
                                                    <span className="text-text-primary font-mono">2048 to 4096</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-text-secondary">12GB VRAM:</span>
                                                    <span className="text-text-primary font-mono">4096 to 8192</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-text-secondary">16GB VRAM:</span>
                                                    <span className="text-text-primary font-mono">8192 to 16384</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-text-secondary">24GB+ VRAM:</span>
                                                    <span className="text-text-primary font-mono">16384 to 24000</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-bg-darker"></div>
                                    </div>
                                </div>
                            </div>
                            <input
                                type="number"
                                value={tempConfig.numCtx}
                                onChange={(e) => setTempConfig({ ...tempConfig, numCtx: parseInt(e.target.value) || DEFAULT_num_ctx })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-text-primary focus:border-accent-primary outline-none transition-all"
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block text-[0.65rem] uppercase tracking-widest font-bold text-text-secondary">Max Predict (num_predict)</label>
                                <div className="group relative">
                                    <div className="w-3.5 h-3.5 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center cursor-help">
                                        <span className="text-[8px] text-accent-primary font-bold">i</span>
                                    </div>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 p-3 bg-bg-darker border border-white/20 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                        <p className="text-[11px] text-text-primary leading-relaxed mb-3">
                                            Maximum tokens in model's response (output only). Higher values allow longer answers but must fit within context window.
                                        </p>
                                        <div className="border-t border-white/10 pt-2">
                                            <p className="text-[10px] text-accent-primary font-semibold mb-2">Prediction Size Recommendations:</p>
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-text-secondary">8GB VRAM:</span>
                                                    <span className="text-text-primary font-mono">4096 to 8192</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-text-secondary">12GB VRAM:</span>
                                                    <span className="text-text-primary font-mono">8192 to 16384</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-text-secondary">16GB VRAM:</span>
                                                    <span className="text-text-primary font-mono">16384 to 24000</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-text-secondary">24GB+ VRAM:</span>
                                                    <span className="text-text-primary font-mono">24000 to 32000</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-bg-darker"></div>
                                    </div>
                                </div>
                            </div>
                            <input
                                type="number"
                                value={tempConfig.numPredict}
                                onChange={(e) => setTempConfig({ ...tempConfig, numPredict: parseInt(e.target.value) || DEFAULT_num_predict })}
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

                    {/* Sentiment Analysis Settings */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium text-text-primary mb-4">Sentiment Analysis Settings</h3>

                        {/* Profile Selection */}
                        <div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {SENTIMENT_PROFILES.map((profile) => (
                                    <button
                                        key={profile.id}
                                        onClick={() => handleSentimentProfileChange(profile.id)}
                                        className={`p-4 rounded-lg border transition-all text-left ${
                                            (tempConfig.sentimentProfile || 'balanced') === profile.id && !isCustomMode
                                                ? 'bg-accent-primary/20 border-accent-primary text-text-primary'
                                                : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'
                                        }`}
                                    >
                                        <div className="font-medium text-sm mb-1">{profile.name}</div>
                                        <div className="text-xs text-text-tertiary">{profile.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Current Guidelines */}
                        <div>
                            <h4 className="text-sm font-medium text-text-primary mb-3">Current Guidelines</h4>
                            <div className="bg-black/30 border border-white/10 rounded-lg p-4 max-h-40 overflow-y-auto">
                                <pre className="text-sm text-text-secondary whitespace-pre-wrap">
                                    {currentSentimentProfile.guidelines}
                                </pre>
                            </div>
                        </div>

                        {/* Custom Weights */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-medium text-text-primary">Custom Weights</h4>
                                <div className="flex gap-2">
                                    {!isCustomMode && (
                                        <button
                                            onClick={() => {
                                                setIsCustomMode(true)
                                                const weightsAsRecord = currentSentimentProfile.weights as any;
                                                setCustomWeights(weightsAsRecord as Record<string, number>)
                                                setTempConfig({
                                                    ...tempConfig,
                                                    sentimentProfile: 'custom',
                                                    customSentimentWeights: weightsAsRecord
                                                })
                                            }}
                                            className="px-3 py-1 bg-accent-primary/20 text-accent-primary rounded text-sm hover:bg-accent-primary/30 transition-colors"
                                        >
                                            Customize
                                        </button>
                                    )}
                                    <button
                                        onClick={resetSentimentToDefaults}
                                        className="px-3 py-1 bg-white/10 text-text-secondary rounded text-sm hover:bg-white/20 transition-colors"
                                    >
                                        Reset to Default
                                    </button>
                                </div>
                            </div>

                            {isCustomMode && customWeights && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(customWeights).map(([key, value]) => (
                                        <div key={key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                                            <label className="text-sm text-text-secondary capitalize min-w-[120px]">
                                                {key.replace(/([A-Z])/g, ' $1').trim()}
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="range"
                                                    min="-5"
                                                    max="5"
                                                    step="0.5"
                                                    value={value as number}
                                                    onChange={(e) => handleCustomWeightChange(key, parseFloat(e.target.value))}
                                                    className="w-32"
                                                />
                                                <span className="text-sm text-text-primary w-12 text-right font-mono">
                                                    {(value as number) > 0 ? '+' : ''}{value as number}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!isCustomMode && (
                                <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {Object.entries(currentSentimentProfile.weights).map(([key, value]) => (
                                            <div key={key} className="text-center">
                                                <div className="text-xs text-text-tertiary capitalize mb-1">
                                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                                </div>
                                                <div className="text-lg font-mono text-text-primary">
                                                    {(value as number) > 0 ? '+' : ''}{value as number}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Impact Explanation */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-blue-300 mb-2">How This Affects Analysis</h4>
                            <p className="text-xs text-blue-200 leading-relaxed">
                                Sentiment profiles determine how AI interprets and classifies the emotional tone of news events. 
                                Different profiles may classify the same event differently based on their weighting system. 
                                Custom weights allow you to fine-tune analysis according to your specific needs and perspective.
                            </p>
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
        </div>,
        document.body
    );
}
