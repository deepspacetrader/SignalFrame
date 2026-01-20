
import { useState, useEffect } from 'react'
import { Modal } from './shared/Modal'
import { useSituationStore } from '../state/useSituationStore'
import { SENTIMENT_PROFILES, SentimentProfile, getSentimentProfile } from '../ai/runtime/sentimentEngine'
import { DEFAULT_num_ctx, DEFAULT_num_predict } from '../ai/runtime/ollama'

export function AISettings({ onAIRequired }: { onAIRequired?: () => void }) {
    const fullState = useSituationStore();
    const { aiConfig, availableModels, updateAiConfig, fetchAvailableModels } = fullState;
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
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!isLocalhost && onAIRequired) {
            onAIRequired();
            return;
        }

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

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            modalId="ai-settings-modal"
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
                                <div className="grid grid-cols-1 gap-3 text-xs">
                                    <div>
                                        <span className="text-text-tertiary font-bold">GPU:</span>
                                        <span className="text-text-primary ml-2">NVIDIA RTX 3060+ <span className="text-text-secondary italic">(A GPU with at least 12GB VRAM is recommended for most thinking models. Tiny or small models may work on less powerful hardware with mixed results.)</span></span>
                                    </div>
                                    <div>
                                        <span className="text-text-tertiary font-bold">Storage:</span>
                                        <span className="text-text-primary ml-2">~10-20GB for AI models</span>
                                    </div>
                                    <div>
                                        <span className="text-text-tertiary font-bold">Internet Connection:</span>
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
                                                <span className="text-xs font-mono text-text-primary">deepseek-r1:8b (recommended)</span>
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
                                                <span className="text-xs font-mono text-text-primary">gpt-oss:20b</span>
                                            </div>
                                            <button
                                                onClick={() => navigator.clipboard.writeText('ollama pull gpt-oss:20b')}
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
                                    <div className="space-y-4 text-xs">
                                        <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                                            <h6 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                                                "Connect to local network" Prompt
                                            </h6>
                                            <p className="text-text-secondary mb-3 leading-relaxed">
                                                Chrome may show a popup asking to <strong>"connect to any device on your local network"</strong>.
                                            </p>
                                            <p className="text-text-secondary mb-3 leading-relaxed text-[11px]">
                                                This is a standard security feature because this website (public) is trying to talk to your local computer (private).
                                                <strong> It is NOT scanning your home network.</strong> It is only trying to reach the Ollama AI engine running on your own machine.
                                            </p>
                                            <p className="font-bold text-text-primary mb-2">To proceed:</p>
                                            <p className="text-text-secondary">Click <strong>"Allow"</strong> to enable the connection between this interface and your local AI.</p>
                                        </div>

                                        <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-xl">
                                            <h6 className="text-red-400 font-bold mb-3 flex items-center gap-2">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                                Fix Connection (CORS / 403 Forbidden)
                                            </h6>

                                            <p className="text-[11px] text-text-secondary mb-4 leading-relaxed">
                                                Browsers block public websites from talking to your local AI for security. Follow these steps to "trust" this domain:
                                            </p>

                                            <div className="space-y-4">
                                                <div className="bg-black/40 p-4 rounded-lg border border-white/5">
                                                    <ol className="text-[11px] text-text-secondary space-y-3 ml-4 list-decimal">
                                                        <li><strong>Restart Ollama</strong> with permissions (Copy & Run in PowerShell):
                                                            <div className="bg-black/60 p-2 rounded mt-2 font-mono text-[10px] text-green-400 break-all select-all flex items-center justify-between group cursor-pointer">
                                                                <span>taskkill /F /IM "ollama.exe" /T; $env:OLLAMA_ORIGINS="https://deepspacetrader.github.io"; ollama serve</span>
                                                            </div>
                                                        </li>
                                                        <li><strong>Refresh this page</strong> and click "Retry Connection".</li>
                                                    </ol>
                                                </div>

                                                <div className="flex items-center gap-2 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                                                    <p className="text-[10px] text-text-tertiary">
                                                        <strong>Security Note:</strong> Origins are domain-level. Always use the base domain (e.g., https://deepspacetrader.github.io) without sub-paths like /signalframe/.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2">
                                            <span className="text-red-400">•</span>
                                            <span className="text-text-secondary"><strong>Connection errors:</strong> Restart Ollama or check if it's running on port 11434</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-red-400">•</span>
                                            <span className="text-text-secondary"><strong>Slow responses:</strong> Try smaller models or close GPU-intensive applications</span>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <label className="block text-[0.65rem] uppercase tracking-widest font-bold text-text-secondary">Ollama Base URL</label>
                                    <div className="group relative">
                                        <div className="w-3.5 h-3.5 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center cursor-help">
                                            <span className="text-[8px] text-accent-primary font-bold">i</span>
                                        </div>
                                        <div className="absolute left-full top-0 ml-2 w-64 p-3 bg-bg-darker border border-white/20 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999]">
                                            <p className="text-[11px] text-text-primary leading-relaxed">
                                                The API endpoint for your Ollama instance. Default is http://127.0.0.1:11434/api.
                                                If using a tunnel (like Cloudflare or Tailscale), enter your public URL here.
                                            </p>
                                            <div className="absolute right-full top-4 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-bg-darker"></div>
                                        </div>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={tempConfig.baseUrl || ''}
                                    onChange={(e) => setTempConfig({ ...tempConfig, baseUrl: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-text-primary focus:border-accent-primary outline-none transition-all font-mono text-sm"
                                    placeholder="http://127.0.0.1:11434/api"
                                />
                            </div>

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
                                            <div className="absolute right-full top-4 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-bg-darker"></div>
                                        </div>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={tempConfig.model}
                                    onChange={(e) => setTempConfig({ ...tempConfig, model: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-text-primary focus:border-accent-primary outline-none transition-all font-mono text-sm"
                                    placeholder="llama3.2, qwen3:8b, deepseek-r1:8b"
                                />
                            </div>
                        </div>
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
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mb-2 w-80 p-3 bg-bg-darker border border-white/20 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
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
                                onChange={(e) => setTempConfig({ ...tempConfig, numCtx: parseInt(e.target.value) })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-text-primary focus:border-accent-primary outline-none transition-all"
                                placeholder={DEFAULT_num_ctx.toString()}
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block text-[0.65rem] uppercase tracking-widest font-bold text-text-secondary">Max Predict (num_predict)</label>
                                <div className="group relative">
                                    <div className="w-3.5 h-3.5 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center cursor-help">
                                        <span className="text-[8px] text-accent-primary font-bold">i</span>
                                    </div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mb-2 w-80 p-3 bg-bg-darker border border-white/20 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
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
                                onChange={(e) => setTempConfig({ ...tempConfig, numPredict: parseInt(e.target.value) })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-text-primary focus:border-accent-primary outline-none transition-all"
                                placeholder={DEFAULT_num_predict.toString()}
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
                                        className={`p-4 rounded-lg border transition-all text-left ${(tempConfig.sentimentProfile || 'balanced') === profile.id && !isCustomMode
                                            ? 'bg-accent-primary/20 border-accent-primary text-text-primary'
                                            : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="font-medium text-sm mb-1">{profile.name}</div>
                                        <div className="text-xs text-text-tertiary">{profile.description}</div>
                                    </button>
                                ))}
                            </div>
                            {window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (
                                <div className="mt-4 p-4 bg-accent-primary/10 border border-accent-primary/20 rounded-xl">
                                    <p className="text-xs text-accent-primary leading-relaxed">
                                        <strong>Static Snapshot Mode:</strong> Sentiment Analysis is fixed on the <strong>"Balanced"</strong> setting for the static snapshot data.
                                        To customize sentiment profiles or use manual weights, you must run SignalFrame on <strong>localhost</strong> with a personal Ollama instance.
                                    </p>
                                </div>
                            )}
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

                            {/* Deployment / Static Build Section */}
                            {/* Deployment / Static Build Section - ONLY ON LOCALHOST */}
                            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                                <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl mt-6">
                                    <h6 className="text-purple-400 font-bold mb-3 flex items-center gap-2">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                        Deployment / Static Build
                                    </h6>
                                    <p className="text-[11px] text-text-secondary mb-4 leading-relaxed">
                                        Create a static snapshot of the current intelligence data. Use this to update the live <strong>GitHub Pages</strong> site without requiring users to have local AI.
                                    </p>
                                    <button
                                        onClick={() => {
                                            const snapshot = fullState;
                                            // Create a clean export object with just the data we need
                                            const exportData = {
                                                lastUpdated: new Date().toISOString(),
                                                narrative: snapshot.narrative,
                                                signals: snapshot.signals,
                                                insights: snapshot.insights,
                                                mapPoints: snapshot.mapPoints,
                                                availableDates: snapshot.availableDates,
                                                foreignRelations: snapshot.foreignRelations,
                                                bigPicture: snapshot.bigPicture,
                                                predictionHistory: snapshot.predictionHistory,
                                                globalState: snapshot.aiStatus // Optional metadata
                                            };

                                            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = 'snapshot.json';
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            URL.revokeObjectURL(url);
                                        }}
                                        className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                                    >
                                        Download snapshot.json
                                    </button>
                                    <p className="text-[9px] text-text-tertiary mt-2 text-center">
                                        Place this file in your project's <strong>public/data/</strong> folder and push to GitHub.
                                    </p>
                                </div>
                            )}
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
        </Modal>
    );
}
