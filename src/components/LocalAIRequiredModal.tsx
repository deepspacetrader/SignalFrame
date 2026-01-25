
import { useState } from 'react'
import { Modal } from './shared/Modal'
import { useSituationStore } from '../state/useSituationStore'

interface LocalAIRequiredModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LocalAIRequiredModal({ isOpen, onClose }: LocalAIRequiredModalProps) {
    const { aiConfig, updateAiConfig } = useSituationStore();
    const [showDetail, setShowDetail] = useState(false);
    const [customUrl, setCustomUrl] = useState(aiConfig?.baseUrl || ''); // Fallback
    const [showCustomUrl, setShowCustomUrl] = useState(false); // Local state for URL field visibility
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const handleSaveUrl = () => {
        if (customUrl) {
            updateAiConfig({ baseUrl: customUrl });
            // Optionally try to reconnect here
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0a0c10] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden relative" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-accent-primary/10 to-transparent">
                    <h2 className="text-xl font-display font-bold text-white flex items-center gap-3">
                        <span className="w-2 h-6 bg-accent-primary rounded-full"></span>
                        {isLocalhost ? 'AI Connection Required' : 'Demo Mode'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-text-secondary hover:text-white">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 max-h-[70vh] overflow-y-auto">
                    {!isLocalhost ? (
                        <div className="space-y-6">
                            <div className="bg-accent-primary/5 border border-accent-primary/20 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-accent-primary mb-2">Interactive Features Locked</h3>
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    You are currently viewing the <strong>Static Demo</strong>. To have AI processing (Generating Signals, Chat, Deep Dives, etc.) you are required to setup a localhost dev environment by following the instructions below:
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-base font-bold text-white">🚀 Run Feature-Complete Version Locally</h3>
                                <p className="text-sm text-text-secondary">
                                    To unlock all AI features (Scan, Chat, Deep Dive, Foreign Relations), simply clone the repository and run it locally with your own Ollama instance.
                                </p>

                                <div className="space-y-4 font-mono text-xs bg-black/50 p-4 rounded-xl border border-white/10">
                                    <div className="space-y-1">
                                        <div className="text-slate-500"># 1. Clone the repository</div>
                                        <div className="text-green-400">git clone https://github.com/deepspacetrader/SignalFrame.git</div>
                                        <div className="text-green-400">cd SignalFrame</div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="text-slate-500"># 2. Install dependencies</div>
                                        <div className="text-green-400">npm install</div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="text-slate-500"># 3. Start the dev server</div>
                                        <div className="text-green-400">npm run dev</div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="text-slate-500"># 4. Ensure Ollama is running</div>
                                        <div className="text-green-400">ollama serve</div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <a
                                        href="https://github.com/deepspacetrader/SignalFrame"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 py-3 bg-white text-black font-bold rounded-xl text-center hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                                        </svg>
                                        View on GitHub
                                    </a>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <p className="text-sm text-text-secondary leading-relaxed">
                                The requested feature requires an active connection to your local AI model, but we couldn't detect a running instance of <strong>Ollama</strong>.
                            </p>

                            <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-4">
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <span className="w-6 h-6 rounded bg-accent-primary/20 flex items-center justify-center text-accent-primary text-xs">1</span>
                                    Install & Run Ollama
                                </h3>
                                <p className="text-xs text-text-secondary pl-8">
                                    Ensure Ollama is installed and running on port 11434.
                                </p>
                                <div className="pl-8">
                                    <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-emerald-400 border border-white/5 flex justify-between items-center group">
                                        <span>ollama serve</span>
                                        <button
                                            onClick={() => navigator.clipboard.writeText('ollama serve')}
                                            className="text-text-tertiary hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-4">
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <span className="w-6 h-6 rounded bg-accent-primary/20 flex items-center justify-center text-accent-primary text-xs">2</span>
                                    Configure CORS (Mac/Linux/Windows)
                                </h3>
                                <p className="text-xs text-text-secondary pl-8">
                                    Ollama needs to allow browser requests. Set the environment variable:
                                </p>
                                <div className="pl-8 space-y-2">
                                    <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-blue-300 border border-white/5">
                                        OLLAMA_ORIGINS="*"<br/>
                                        {aiConfig?.ollamaFlashAttention && 'OLLAMA_FLASH_ATTENTION="1"'}<br/>
                                        {aiConfig?.ollamaKvCacheType && `OLLAMA_KV_CACHE_TYPE="${aiConfig.ollamaKvCacheType}"`}
                                    </div>
                                </div>
                            </div>

                            {/* Base URL Configuration */}
                            <div className="pt-4 border-t border-white/10">
                                <button
                                    onClick={() => setShowCustomUrl(!showCustomUrl)}
                                    className="text-xs text-text-tertiary hover:text-text-secondary flex items-center gap-2 transition-colors"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showCustomUrl ? 'rotate-90' : ''}`}>
                                        <path d="M9 18l6-6-6-6" />
                                    </svg>
                                    Advanced: Configure Custom Ollama URL
                                </button>

                                {showCustomUrl && (
                                    <div className="mt-4 pl-4 animate-in slide-in-from-top-2">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={customUrl}
                                                onChange={(e) => setCustomUrl(e.target.value)}
                                                placeholder="http://127.0.0.1:11434"
                                                className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white focus:border-accent-primary outline-none"
                                            />
                                            <button
                                                onClick={handleSaveUrl}
                                                className="bg-accent-primary/20 hover:bg-accent-primary/40 text-accent-primary text-xs font-bold px-4 py-2 rounded-lg transition-colors border border-accent-primary/30"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-black/20">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-sm transition-all"
                    >
                        Close
                    </button>
                    {isLocalhost && (
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-accent-primary/20"
                        >
                            Retry Connection
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
