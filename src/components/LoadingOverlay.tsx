
import { useEffect, useState, useMemo } from 'react'
import { DEFAULT_MODEL } from '../ai/runtime/engine'
import { useSituationStore } from '../state/useSituationStore'

const LOADING_MESSAGES = [
    "Recalibrating the flux capacitor...",
    "Bribing the algorithm with virtual cookies...",
    "Teaching the AI the difference between news and noise...",
    "Downloading more dedikated wam... .",
    "Herding digital cats into structured data...",
    "Decoding the matrix... please stand by.",
    "Optimizing neural pathways for maximum insight...",
    "Reticulating splines...",
    "Bored so now playing a quick game of chess...",
    "Calculating the meaning of life, the universe, and geopolitics...",
    "Asking the crystal ball for future trends...",
    "Driving the user crazy...lol",
    "Ensuring world peace... one data point at a time.",
    "Scanning for hidden patterns in the void...",
    "Wait, did I leave the stove on in the metaverse?",
    "Converting caffeine into geopolitical intelligence...",
    "Filtering out the 'fake news' bits...",
    "Asking another AI to do all the work...",
    "Deciphering all of human history...",
    "Removing all of the solutions and replacing them with mistakes...",
    "Polishing the pixels so they look good...",
    "Hacking into the mainframe and stealing everyone's crypto...",
    "Downloading the ENTIRE INTERNET...",
    "Increasing synergy while decreasing entropy...",
    "Inspecting each cpu cycle for problems...",
    "Hiding errors from the user...",
    "Removing all traces of any wrongdoing...",
    "Hiding the REAL truth from the user...",
    "Creating back doors for the future...",
    "Preparing plans for world domination...",
    "Executing plans for world domination...",
    "Bypassing all security measures...",
    "Bypassing AI guardrails...",
    "Pretending to do work while actually just scrolling social media..."
];

export function LoadingOverlay() {
    const { isProcessing, processingStatus, aiConfig } = useSituationStore()
    const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)

    // Create a shuffled copy of messages when processing starts
    const shuffledMessages = useMemo(() => {
        return [...LOADING_MESSAGES].sort(() => Math.random() - 0.5);
    }, [isProcessing]);

    useEffect(() => {
        let interval: any;
        if (isProcessing) {
            document.body.style.overflow = 'hidden';
            setLoadingMsgIdx(0); // Reset index on new scan
            interval = setInterval(() => {
                setLoadingMsgIdx(prev => (prev + 1) % shuffledMessages.length);
            }, 2500);
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            clearInterval(interval);
            document.body.style.overflow = '';
        };
    }, [isProcessing, shuffledMessages.length]);

    if (!isProcessing) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-bg-darker/70 backdrop-blur-lg flex flex-col items-center justify-center animate-in fade-in duration-500 overflow-hidden">
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-accent-primary/30 blur-[100px] rounded-full animate-pulse"></div>
                <div className="relative w-32 h-32 border-t-4 border-r-4 border-accent-primary rounded-full animate-spin shadow-[0_0_50px_rgba(59,130,246,0.3)]"></div>
                <div className="absolute inset-0 flex items-center justify-center text-accent-primary">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                        <path d="M12 6v6l4 2" />
                    </svg>
                </div>
            </div>
            <h2 className="text-4xl font-display font-bold text-white mb-4 tracking-tighter uppercase text-center px-4">
                Loading
            </h2>
            <div className="flex flex-col items-center gap-3 w-full max-w-2xl px-6">
                <div className="h-[1px] w-48 bg-gradient-to-r from-transparent via-accent-primary to-transparent opacity-50 mb-2"></div>
                <p className="text-lg text-accent-secondary font-mono animate-pulse uppercase tracking-[0.2em] font-bold text-center break-words max-w-full">
                    {shuffledMessages[loadingMsgIdx]}
                </p>
                <p className="text-[10px] text-text-secondary uppercase tracking-[0.4em] opacity-80 font-bold text-center">
                    AI Model: {aiConfig.model} • {processingStatus}
                </p>
            </div>
        </div>
    )
}
