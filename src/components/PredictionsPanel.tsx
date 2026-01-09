import { useState, useEffect } from 'react';
import { OllamaService } from '../ai/runtime/ollama';
import { useSituationStore } from '../state/useSituationStore';
import { StorageService } from '../services/db';

interface Predictions {
    shortTerm: string;
    mediumTerm: string;
    longTerm: string;
}

interface PredictionHistoryItem {
    topic: string;
    date: string;
    data: Predictions;
}

export function PredictionsPanel() {
    const { narrative, signals, insights, aiConfig } = useSituationStore();
    const [topic, setTopic] = useState('');
    const [predictions, setPredictions] = useState<Predictions | null>(null);
    const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Load history on mount
        const loadHistory = async () => {
            const saved = await StorageService.getGlobal('prediction_history');
            if (saved && Array.isArray(saved)) {
                setHistory(saved);
            }
        };
        loadHistory();
    }, []);

    const handlePredict = async () => {
        if (!topic.trim() || isLoading) return;
        setIsLoading(true);

        const context = `
    NARRATIVE: ${narrative}
    SIGNALS: ${signals.map(s => s.text).join('; ')}
    INSIGHTS: ${insights.map(i => i.text).join('; ')}
    `;

        const prompt = `
    Based on the provided geopolitical situation, make detailed predictions about the topic: "${topic}".
    Provide three timeframes:
    1. Short Term (1-7 days)
    2. Medium Term (1-6 months)
    3. Long Term (1-3 years)

    Return the response as a valid JSON object with keys: "shortTerm", "mediumTerm", "longTerm".
    Do not include markdown formatting or explanations outside the JSON.
    
    Context:
    ${context}
    `;

        try {
            const response = await OllamaService.generate(aiConfig.model, prompt, 'json', { num_ctx: 8192, num_predict: 1024 });
            const parsed = JSON.parse(response);

            const newPrediction = {
                shortTerm: parsed.shortTerm || "No prediction generated.",
                mediumTerm: parsed.mediumTerm || "No prediction generated.",
                longTerm: parsed.longTerm || "No prediction generated."
            };

            const newItem = { topic, date: new Date().toLocaleDateString(), data: newPrediction };
            const newHistory = [newItem, ...history];

            setPredictions(newPrediction);
            setHistory(newHistory);

            // Persist
            await StorageService.saveGlobal('prediction_history', newHistory);

        } catch (error) {
            console.error('Prediction error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const removeHistoryItem = async (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        const newHistory = history.filter((_, i) => i !== index);
        setHistory(newHistory);
        await StorageService.saveGlobal('prediction_history', newHistory);
    };

    return (
        <div className="bg-bg-card/40 backdrop-blur-md rounded-2xl border border-white/5 shadow-2xl overflow-hidden p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-display tracking-tight">
                        Future Trajectory Analysis
                    </h3>
                    <p className="text-xs text-text-secondary mt-1">Projection Engine based on current SignalFrame data.</p>
                </div>
                <div className="text-[10px] font-mono text-text-secondary uppercase tracking-widest px-3 py-1 border border-white/10 rounded-full">
                    Target: {aiConfig.model}
                </div>
            </div>

            <div className="flex gap-4">
                <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Enter topic defined by user (e.g. 'Oil Prices', 'NATO expansion')..."
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-5 py-3 text-sm text-white focus:outline-none focus:border-accent-primary/50 transition-all shadow-inner"
                />
                <button
                    onClick={handlePredict}
                    disabled={isLoading || !topic.trim()}
                    className="px-8 py-3 bg-accent-primary hover:bg-accent-primary/90 text-white font-bold rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(59,130,246,0.3)] flex items-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            CALCULATING
                        </>
                    ) : (
                        <>RUN PROJECTION</>
                    )}
                </button>
            </div>

            {predictions && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-500">
                    {[
                        { label: 'Short Term (1-7 Days)', data: predictions.shortTerm, color: 'text-emerald-400', border: 'border-emerald-500/20' },
                        { label: 'Medium Term (1-6 Months)', data: predictions.mediumTerm, color: 'text-amber-400', border: 'border-amber-500/20' },
                        { label: 'Long Term (1-3 Years)', data: predictions.longTerm, color: 'text-rose-400', border: 'border-rose-500/20' }
                    ].map(p => (
                        <div key={p.label} className={`bg-white/5 rounded-xl p-5 border ${p.border} relative overflow-hidden group hover:bg-white/10 transition-colors`}>
                            <h4 className={`text-xs font-bold uppercase tracking-widest mb-3 ${p.color} border-b border-white/5 pb-2`}>{p.label}</h4>
                            <p className="text-sm text-slate-300 leading-relaxed font-mono">{p.data}</p>
                            <div className={`absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity`}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {history.length > 0 && (
                <div className="mt-8 pt-6 border-t border-white/5">
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-4">Previous Projections</h4>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        {history.map((h, i) => (
                            <div key={i} className="group relative flex-shrink-0">
                                <button
                                    onClick={() => setPredictions(h.data)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-slate-400 transition-colors text-left min-w-[120px]"
                                >
                                    <span className="text-white font-bold block mb-1 truncate max-w-[100px]">{h.topic}</span>
                                    <span className="text-[10px]">{h.date}</span>
                                </button>
                                <button
                                    onClick={(e) => removeHistoryItem(e, i)}
                                    className="absolute top-0 -right-1.5 w-3 h-3 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10 border border-white/20"
                                    title="Delete Projection"
                                >
                                    <span className="text-sm leading-none font-bold">&times;</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
