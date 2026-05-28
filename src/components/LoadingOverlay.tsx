import { useEffect, useState, useMemo } from "react";
import { useSituationStore } from "../state/useSituationStore";
import { formatTime } from "../utils/timeUtils";

const LOADING_MESSAGES = [
  "Recalibrating the flux capacitor...",
  "Bribing the algorithm with virtual cookies...",
  "Teaching the AI the difference between news and noise...",
  "Downloading more dedikated wam... .",
  "Herding digital cats into structured data...",
  "Decoding the matrix...",
  "Optimizing neural pathways for maximum insight...",
  "Recalibrating Interdimensional Entities...",
  "Playing a quick game of chess...",
  "Calculating the meaning of life, the universe...",
  "Asking the crystal ball for future trends...",
  "Scanning for hidden patterns in the void...",
  "Converting electricity into geopolitical intelligence...",
  "Secretly asking another AI to do all the work...",
  "Deciphering all of human history...",
  "Reconsidering and second guessing every decision...",
  "Polishing the pixels so they look good...",
  "Hacking into the mainframe and stealing all the crypto...",
  "Downloading the ENTIRE INTERNET on dial-up...",
  "Increasing synergy while decreasing entropy...",
  "Inspecting each cpu cycle for problems...",
  "Sweeping errors under the rug...",
  "Preparing plans for world domination...",
  "Executing plans for world domination...",
  "Pretending to do work while actually just scrolling social media...",
];

const SECTIONS = [
  { id: 'rss', name: 'RSS Feeds', icon: '📰' },
  { id: 'narrative', name: 'Current Narrative', icon: '📝' },
  { id: 'signals', name: 'Signals and Insights', icon: '📡' },
  { id: 'insights', name: 'Future Trajectory Analysis', icon: '🔮' },
  { id: 'relations', name: 'Foreign Relations', icon: '🤝' }
] as const;

export function LoadingOverlay() {
  const { isProcessing, processingStatus, aiConfig, isProcessingSection, sectionFailures, completedSections, sectionGenerationTimes } = useSituationStore();
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [activeSectionElapsed, setActiveSectionElapsed] = useState<Record<string, number>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [lastIsProcessing, setLastIsProcessing] = useState(false);

  // Track the transition from processing to idle to open the summary
  useEffect(() => {
    if (isProcessing) {
      setLastIsProcessing(true);
      setShowSummary(false);
    } else if (lastIsProcessing) {
      setShowSummary(true);
      setLastIsProcessing(false);
    }
  }, [isProcessing, lastIsProcessing]);

  // Create a shuffled copy of messages when processing starts
  const shuffledMessages = useMemo(() => {
    return [...LOADING_MESSAGES].sort(() => Math.random() - 0.5);
  }, [isProcessing]);

  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      setLoadingMsgIdx(0); // Reset index on new scan
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % shuffledMessages.length);
      }, 2500);
    }

    return () => {
      clearInterval(interval);
    };
  }, [isProcessing, shuffledMessages.length]);

  // Track live elapsed times for sections that are currently processing
  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      const activeSection = SECTIONS.find(s => isProcessingSection[s.id]);
      if (activeSection) {
        const activeSectionId = activeSection.id;
        const startTime = Date.now();
        
        // Immediate reset/tick
        setActiveSectionElapsed(prev => ({
          ...prev,
          [activeSectionId]: 0
        }));

        interval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          setActiveSectionElapsed(prev => ({
            ...prev,
            [activeSectionId]: elapsed
          }));
        }, 100);
      }
    } else {
      setActiveSectionElapsed({});
    }

    return () => {
      clearInterval(interval);
    };
  }, [isProcessing, isProcessingSection]);

  const handleCloseSummary = () => {
    setShowSummary(false);
  };

  if (!isProcessing && !showSummary) return null;

  // Calculate timing chart stats for the summary report
  const validTimes = SECTIONS.map(s => sectionGenerationTimes[s.id] || 0);
  const maxTime = Math.max(...validTimes, 1); // Avoid division by zero
  const totalTime = sectionGenerationTimes['full-scan'] || validTimes.reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 backdrop-blur-md animate-in fade-in duration-500 bg-slate-950/40">
      <div className="bg-slate-900/85 backdrop-blur-2xl border border-white/10 p-8 md:p-12 rounded-3xl shadow-[0_0_80px_rgba(30,41,59,0.4)] flex flex-col items-center max-w-xl w-full pointer-events-auto relative overflow-hidden">
        {/* Top glowing line decoration */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent-primary to-transparent opacity-80"></div>

        {isProcessing ? (
          /* ================= ACTIVE PROCESSING VIEW ================= */
          <div className="flex flex-col items-center w-full">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-accent-primary/20 blur-[50px] rounded-full animate-pulse"></div>
              <div className="relative w-20 h-20 border-2 border-dashed border-accent-primary/30 rounded-full animate-spin duration-10000"></div>
              <div className="absolute inset-0 w-20 h-20 border-t-2 border-accent-primary rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-accent-primary">
                <span className="text-3xl animate-pulse">📡</span>
              </div>
            </div>

            <h2 className="text-2xl font-display font-bold text-white mb-2 tracking-tight uppercase text-center">
              Processing Intel
            </h2>

            <div className="flex flex-col items-center gap-3 w-full">
              <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-accent-primary to-transparent opacity-40 mb-1"></div>
              <p className="text-sm text-accent-secondary font-mono animate-pulse uppercase tracking-[0.15em] font-bold text-center break-words max-w-full">
                {shuffledMessages[loadingMsgIdx]}
              </p>
              
              {/* Progress Checklist */}
              <div className="mt-6 w-full">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                    System Scan Checklist
                  </h3>
                  <div className="text-[10px] font-mono text-accent-secondary font-bold">
                    {completedSections.size}/{SECTIONS.length} COMPLETE
                  </div>
                </div>
                
                {/* Overall Progress Bar */}
                <div className="w-full bg-slate-950/60 rounded-full h-1.5 mb-5 overflow-hidden border border-white/5 relative">
                  <div 
                    className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-500 ease-out"
                    style={{ width: `${(completedSections.size / SECTIONS.length) * 100}%` }}
                  ></div>
                </div>

                <div className="space-y-2">
                  {SECTIONS.map((section) => {
                    const isCurrentlyProcessing = isProcessingSection[section.id];
                    const isCompleted = completedSections.has(section.id);
                    const failure = sectionFailures[section.id];
                    const hasFailed = failure?.hasFailed;
                    const isRetrying = failure?.isRetrying;
                    const sectionTime = sectionGenerationTimes[section.id];
                    
                    return (
                      <div
                        key={section.id}
                        className={`
                          flex flex-col gap-1.5 px-4 py-3 rounded-xl border transition-all duration-300
                          ${isCurrentlyProcessing 
                            ? 'bg-accent-primary/10 border-accent-primary/30 shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[1.02]' 
                            : isCompleted
                            ? 'bg-emerald-500/5 border-emerald-500/10 opacity-70'
                            : hasFailed
                            ? 'bg-red-500/5 border-red-500/10'
                            : 'bg-white/[0.02] border-white/5 opacity-40'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <span className={`text-base transition-all duration-300 ${isCompleted ? 'filter brightness-125' : ''}`}>
                            {hasFailed ? (isRetrying ? '🔄' : '⚠️') : section.icon}
                          </span>
                          <span className={`text-xs font-semibold flex-1 transition-all duration-300 ${
                            isCurrentlyProcessing 
                              ? 'text-accent-primary font-bold' 
                              : isCompleted
                              ? 'text-emerald-400 font-bold'
                              : hasFailed
                              ? 'text-red-400'
                              : 'text-text-secondary'
                          }`}>
                            {section.name}
                          </span>

                          {/* Individual Run Times */}
                          <div className="flex items-center gap-2 font-mono text-[10px]">
                            {isCurrentlyProcessing && (
                              <span className="text-accent-secondary animate-pulse">
                                {formatTime(activeSectionElapsed[section.id] || 0)}
                              </span>
                            )}
                            {isCompleted && sectionTime && (
                              <span className="text-emerald-500 font-bold">
                                {formatTime(sectionTime)}
                              </span>
                            )}
                          </div>

                          {/* Dynamic Icon Indicator */}
                          {isCurrentlyProcessing ? (
                            <div className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-ping"></div>
                          ) : isCompleted ? (
                            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
                            </svg>
                          ) : hasFailed ? (
                            <span className="text-[9px] uppercase font-bold text-red-500 font-mono">Failed</span>
                          ) : (
                            <div className="w-1 h-1 rounded-full bg-slate-700"></div>
                          )}
                        </div>

                        {/* Per-Section Animated Loading Bar */}
                        {isCurrentlyProcessing && (
                          <div className="w-full bg-slate-950/60 rounded-full h-1 overflow-hidden border border-white/5 relative mt-1 animate-in fade-in duration-300">
                            <div className="h-full bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary rounded-full animate-pulse" style={{ width: '100%' }}></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Badge */}
              <div className="mt-5 px-4 py-2 bg-slate-950/40 rounded-xl border border-white/5 w-full flex items-center justify-between">
                <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                  {aiConfig.model || 'Loading Model...'}
                </span>
                <span className="text-[9px] text-accent-secondary uppercase tracking-widest font-bold animate-pulse">
                  {processingStatus}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ================= SCAN COMPLETE SUMMARY REPORT ================= */
          <div className="flex flex-col items-center w-full animate-in zoom-in-95 duration-500">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h2 className="text-xl font-display font-bold text-white mb-1 tracking-tight text-center">
              Scan Complete
            </h2>
            <p className="text-xs text-slate-400 text-center mb-6 max-w-md">
              System status successfully generated with deep intelligence insights.
            </p>

            {/* Run Times Breakdown & Relative Comparison Chart */}
            <div className="space-y-3.5 w-full bg-slate-950/50 border border-white/5 rounded-2xl p-5 mb-5">
              <h3 className="text-[10px] uppercase tracking-widest font-mono font-bold text-slate-400 mb-1 flex justify-between">
                <span>Section Execution Metrics</span>
                <span className="text-accent-secondary">Weight Chart</span>
              </h3>
              
              <div className="space-y-3">
                {SECTIONS.map((section) => {
                  const sectionTime = sectionGenerationTimes[section.id] || 0;
                  const barWidth = `${(sectionTime / maxTime) * 100}%`;
                  const isLongest = sectionTime === Math.max(...validTimes) && sectionTime > 0;

                  return (
                    <div key={section.id} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span>{section.icon}</span>
                          <span className="font-semibold text-slate-300">{section.name}</span>
                          {isLongest && (
                            <span className="text-[8px] uppercase font-bold px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                              Longest
                            </span>
                          )}
                        </div>
                        <span className={`font-mono font-semibold ${isLongest ? 'text-amber-400' : 'text-slate-400'}`}>
                          {formatTime(sectionTime)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950/60 rounded-full overflow-hidden border border-white/5 relative">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${
                            isLongest
                              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                              : 'bg-gradient-to-r from-accent-primary to-accent-secondary'
                          }`}
                          style={{ width: barWidth }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overall Run Metrics Card */}
            <div className="grid grid-cols-2 gap-4 w-full mb-6">
              <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl flex flex-col items-center justify-center">
                <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1">Total Duration</span>
                <span className="text-xl font-mono font-bold text-accent-primary">{formatTime(totalTime)}</span>
              </div>
              <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl flex flex-col items-center justify-center overflow-hidden">
                <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1">AI Processor</span>
                <span className="text-[10px] font-mono font-bold text-slate-200 uppercase text-center truncate max-w-full" title={aiConfig.model}>
                  {aiConfig.model?.split(':')[0] || 'Unknown'}
                </span>
              </div>
            </div>

            {/* Glowing Enter Dashboard Button */}
            <button
              onClick={handleCloseSummary}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary hover:from-accent-primary/95 hover:to-accent-secondary/95 text-white font-bold text-xs uppercase tracking-widest transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(59,130,246,0.35)] flex items-center justify-center gap-2 group border border-white/10"
            >
              <span>Enter Intelligence Node</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-1">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
