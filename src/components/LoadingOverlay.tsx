import { useEffect, useState, useMemo } from "react";
import { useSituationStore } from "../state/useSituationStore";

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
  { id: 'relations', name: 'Foreign Relations', icon: '🤝' },
  { id: 'bigPicture', name: 'The Big Picture', icon: '🌍' },
  { id: 'map', name: 'Map', icon: '🗺️' }
] as const;

export function LoadingOverlay() {
  const { isProcessing, processingStatus, aiConfig, isProcessingSection, sectionFailures, completedSections } = useSituationStore();
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

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

  if (!isProcessing) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 pointer-events-none animate-in fade-in duration-500">
      <div className="bg-bg-darker/60 backdrop-blur-xl border border-white/10 p-20 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center max-w-3xl w-full pointer-events-auto">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-accent-primary/30 blur-[100px] rounded-full animate-pulse"></div>
          <div className="relative w-24 h-24 border-t-2 border-r-2 border-accent-primary rounded-full animate-spin shadow-[0_0_50px_rgba(59,130,246,0.3)]"></div>
          <div className="absolute inset-0 flex items-center justify-center text-accent-primary">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
        </div>

        <h2 className="text-3xl font-display font-bold text-white mb-4 tracking-tighter uppercase text-center px-4">
          Processing
        </h2>

        <div className="flex flex-col items-center gap-3 w-full">
          <div className="h-[1px] w-32 bg-gradient-to-r from-transparent via-accent-primary to-transparent opacity-50 mb-2"></div>
          <p className="text-base text-accent-secondary font-mono animate-pulse uppercase tracking-[0.2em] font-bold text-center break-words max-w-full">
            {shuffledMessages[loadingMsgIdx]}
          </p>
          
          {/* Progress Checklist */}
          <div className="mt-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-[0.1em]">
                Progress Overview
              </h3>
              <div className="text-xs text-accent-secondary font-mono">
                {completedSections.size}/{SECTIONS.length} Complete
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-black/30 rounded-full h-2 mb-4 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-accent-primary to-green-500 transition-all duration-500 ease-out"
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
                
                return (
                  <div
                    key={section.id}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg border transition-all duration-500
                      ${isCurrentlyProcessing 
                        ? 'bg-accent-primary/15 border-accent-primary/40 shadow-[0_0_25px_rgba(59,130,246,0.3)]' 
                        : isCompleted
                        ? 'bg-black/20 border-white/5 opacity-60'
                        : hasFailed
                        ? isRetrying
                          ? 'bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                          : 'bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                        : 'bg-black/20 border-white/5 opacity-60'
                      }
                    `}
                  >
                    <span className={`
                      text-lg transition-all duration-300
                      ${isCompleted ? 'filter brightness-125' : ''}
                      ${hasFailed ? (isRetrying ? '' : '') : ''}
                    `}>
                      {hasFailed ? (isRetrying ? '🔄' : '⚠️') : section.icon}
                    </span>
                    <span className={`
                      text-sm font-medium flex-1 transition-all duration-300
                      ${isCurrentlyProcessing 
                        ? 'text-accent-primary font-semibold' 
                        : isCompleted
                        ? 'text-text-secondary'
                        : hasFailed
                        ? isRetrying
                          ? 'text-yellow-400'
                          : 'text-red-400'
                        : 'text-text-secondary'
                      }
                    `}>
                      {section.name}
                    </span>
                    {isCurrentlyProcessing ? (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-accent-primary rounded-full"></div>
                      </div>
                    ) : isCompleted ? (
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      </div>
                    ) : hasFailed ? (
                      <div className="flex items-center gap-1">
                        {isRetrying ? (
                          <>
                            <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                            <span className="text-[0.55rem] text-yellow-400 font-mono">Retrying...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-[0.55rem] text-red-400 font-mono">Failed</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="w-2 h-2 bg-gray-500 rounded-full opacity-50"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 px-4 py-2 bg-black/20 rounded-lg border border-white/5">
            <p className="text-[10px] text-text-secondary uppercase tracking-[0.4em] opacity-80 font-bold text-center">
              {aiConfig.model}
            </p>

            <p className="text-[10px] text-text-secondary uppercase tracking-[0.4em] opacity-80 font-bold text-center">
              {processingStatus}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
