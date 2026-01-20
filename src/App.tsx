import { useEffect, useState } from 'react'
import { NarrativeSummary } from './components/NarrativeSummary'
import { Signals } from './components/Signals'
import { SourceFeedList } from './components/SourceFeedList'
import { SituationMap } from './components/SituationMap'
import { ForeignRelationsPanel } from './components/ForeignRelationsPanel'
import { LoadingOverlay } from './components/LoadingOverlay'
import { AISettings } from './components/AISettings'
import { RSSSettings } from './components/RSSSettings'
import { ChatPanel } from './components/ChatPanel'
import { PredictionsPanel } from './components/PredictionsPanel'
import { VolumeControl } from './components/VolumeControl'
import { useSituationStore } from './state/useSituationStore'
import { BigPictureModal } from './components/BigPictureModal'
import { formatTime } from './utils/timeUtils'
import { getSentimentProfile } from './ai/runtime/sentimentEngine'
import { LocalAIRequiredModal } from './components/LocalAIRequiredModal'
import { DisclaimerModal } from './components/DisclaimerModal'

export default function App() {
  const { isProcessing, lastUpdated, refresh, currentDate, availableDates, loadDate, runningModels, sectionGenerationTimes, aiConfig, aiStatus } = useSituationStore()
  const [showBigPicture, setShowBigPicture] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  const getLocalTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalTodayStr();
  const isToday = currentDate === todayStr;

  const handlePrevDay = () => {
    const currentIndex = availableDates.indexOf(currentDate);
    if (currentIndex > 0) {
      loadDate(availableDates[currentIndex - 1]);
    } else {
      const [y, m, d] = currentDate.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() - 1);
      const prevY = date.getFullYear();
      const prevM = String(date.getMonth() + 1).padStart(2, '0');
      const prevD = String(date.getDate()).padStart(2, '0');
      loadDate(`${prevY}-${prevM}-${prevD}`);
    }
  };

  const handleNextDay = () => {
    if (isToday) return;
    const currentIndex = availableDates.indexOf(currentDate);
    if (currentIndex !== -1 && currentIndex < availableDates.length - 1) {
      loadDate(availableDates[currentIndex + 1]);
    } else {
      const [y, m, d] = currentDate.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() + 1);
      const nextY = date.getFullYear();
      const nextM = String(date.getMonth() + 1).padStart(2, '0');
      const nextD = String(date.getDate()).padStart(2, '0');
      const nextStr = `${nextY}-${nextM}-${nextD}`;
      loadDate(nextStr > todayStr ? todayStr : nextStr);
    }
  };

  const handleRefresh = () => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) {
      setShowAIModal(true);
      return;
    }

    // On localhost - proceed with refresh
    refresh();
  };

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen bg-bg-darker text-text-primary">
      <header className="mb-10 flex flex-col gap-6 bg-bg-card/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-2xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center w-full gap-6 lg:gap-0">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 w-full lg:w-auto">
            <div>
              <div className="flex items-center mb-1">
                <span className="status-online w-2 h-2 bg-accent-secondary rounded-full mr-2 shadow-[0_0_10px_var(--accent-secondary)] animate-pulse"></span>
                <span className="text-[0.65rem] text-accent-secondary font-bold uppercase tracking-[0.2em]">
                  Deep Intelligence Node Active
                </span>
              </div>
              <h1 className="m-0 text-3xl font-bold bg-gradient-to-br from-white to-slate-500 bg-clip-text text-transparent font-display tracking-tight">SignalFrame <span className="text-sm font-mono text-slate-600 font-normal ml-2">v0.4.0</span></h1>
            </div>

            <div className="hidden md:block h-10 w-[1px] bg-white/10"></div>

            <div className="header-stats grid grid-cols-2 gap-4 w-full lg:w-auto lg:flex lg:flex-wrap">
              <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/5 flex-1 md:flex-none">
                <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">Status</p>
                <p className={`text-xs font-mono whitespace-nowrap ${isProcessing ? 'text-accent-secondary' :
                  (aiStatus?.isOnline ? 'text-green-500' : 'text-red-500')
                  }`}>
                  {isProcessing ? 'SCANNING...' : (aiStatus?.isOnline ? 'OLLAMA ONLINE' : 'AI OFFLINE')}
                </p>
              </div>
              {lastUpdated ? (
                <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                  <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">Last Sync</p>
                  <p className="text-xs font-mono">{lastUpdated.toLocaleTimeString()}</p>
                </div>
              ) : (
                <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                  <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">Last Sync</p>
                  <p className="text-xs font-mono text-red-500">never</p>
                </div>
              )}

              <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">Sentiment</p>
                <p className="text-xs font-mono text-accent-primary">
                  {getSentimentProfile(aiConfig.sentimentProfile || 'balanced').name}
                </p>
              </div>

              <div className="flex gap-2">
                {runningModels && runningModels.length > 0 ? (
                  runningModels.map(m => (
                    <div key={m.name} className="bg-white/5 px-4 py-2 rounded-lg border border-white/5 group/model relative">
                      <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">AI Model</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-white whitespace-nowrap">{m.name.split(':')[0]}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-accent-secondary rounded-full animate-pulse shadow-[0_0_5px_var(--accent-secondary)]"></span>
                          <span className="text-[9px] font-mono text-accent-secondary font-bold">
                            {Math.round(m.size_vram / 1024 / 1024 / 1024 * 10) / 10}GB
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/5 group/model relative">
                    <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">AI Model</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono whitespace-nowrap ${aiStatus?.isOnline ? (aiConfig?.model ? 'text-green-500' : 'text-red-500') : 'text-red-500'}`}>
                        {aiStatus?.isOnline ? (aiConfig?.model || 'No Model Selected') : 'No AI Model Loaded'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {sectionGenerationTimes['full-scan'] && (
                <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                  <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">Last Scan</p>
                  <p className="text-xs font-mono text-accent-secondary">{formatTime(sectionGenerationTimes['full-scan'])}</p>
                </div>
              )}

              <AISettings onAIRequired={() => setShowAIModal(true)} />
              <RSSSettings onAIRequired={() => setShowAIModal(true)} />
              <VolumeControl />
            </div>
          </div>

          <button
            onClick={() => setShowBigPicture(true)}
            className="bg-accent-primary/10 border border-accent-primary/20 text-accent-primary px-4 py-2 rounded-lg hover:bg-accent-primary/20 transition-all flex items-center gap-2 group flex-1 md:flex-none justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:scale-110 transition-transform">
              <path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
            </svg>
            <span className="text-xs font-bold uppercase tracking-widest whitespace-nowrap">The Big Picture</span>
          </button>

          <div className="flex flex-col items-center">
            <button
              onClick={handleRefresh}
              disabled={isProcessing}
              className={`w-full lg:w-auto mt-4 lg:mt-0 group relative overflow-hidden font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(59,130,246,0.1)] 
              ${!isToday ? 'bg-purple-600/80 text-white hover:bg-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'bg-accent-primary text-white hover:bg-accent-primary/90 shadow-[0_0_20px_rgba(59,130,246,0.2)]'}`}
            >
              <span className="flex items-center justify-center gap-2">
                {isProcessing ? 'SCANNING...' : (!isToday ? 'SCAN HISTORICAL DATA' : 'SCAN WITH AI')}
                <svg className={`transition-transform duration-700 ${isProcessing ? 'animate-spin' : 'group-hover:rotate-12'}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-4">
          <button
            onClick={handlePrevDay}
            className="flex items-center gap-2 text-[0.65rem] uppercase font-bold tracking-widest text-white hover:text-secondary transition-all group"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="transition-transform group-hover:-translate-x-1"><path d="m15 18-6-6 6-6" /></svg>
            <span className="hidden sm:inline">Previous Day</span>
            <span className="sm:hidden">Prev</span>
          </button>

          <div className="bg-accent-primary/10 border border-accent-primary/20 px-6 py-1 rounded-full">
            <span className="text-xs font-mono font-bold text-accent-primary tracking-widest">
              {(currentDate || todayStr).replace(/-/g, ' / ')}
            </span>
          </div>

          {!isToday ? (
            <button
              onClick={handleNextDay}
              className="flex items-center gap-2 text-[0.65rem] uppercase font-bold tracking-widest text-white hover:text-secondary transition-all group"
            >
              <span className="hidden sm:inline">Next Day</span>
              <span className="sm:hidden">Next</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="transition-transform group-hover:translate-x-1"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          ) : (
            <div className="flex items-center gap-2 text-[0.65rem] uppercase font-bold tracking-widest text-accent-secondary opacity-50 cursor-default">
              <span className="hidden sm:inline">Today - </span>
              {todayStr.replace(/-/g, ' / ')}
            </div>
          )}
        </div>
      </header>

      <main className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-12 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="lg:sticky lg:top-8 lg:h-fit">
              <NarrativeSummary onAIRequired={() => setShowAIModal(true)} />
            </div>
            <div className="grid grid-cols-1">
              <Signals onAIRequired={() => setShowAIModal(true)} />
            </div>
          </div>

          <div className="w-full">
            <h2 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4 flex items-center gap-2">
              <span className="w-8 h-[1px] bg-accent-primary"></span>
              Deep Intelligence Suite
              <span className="w-full h-[1px] bg-white/5"></span>
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ChatPanel onAIRequired={() => setShowAIModal(true)} />
              <PredictionsPanel onAIRequired={() => setShowAIModal(true)} />
            </div>
          </div>

          <div className="w-full">
            <div className="grid grid-cols-1">
              <ForeignRelationsPanel onAIRequired={() => setShowAIModal(true)} />
            </div>
          </div>

          <div className="w-full">
            <SourceFeedList onAIRequired={() => setShowAIModal(true)} />
          </div>

          <SituationMap onAIRequired={() => setShowAIModal(true)} />
        </div>
      </main>

      <footer className="mt-16 py-8 border-t border-white/10 text-center flex flex-col md:flex-row justify-between items-center text-text-secondary px-4 gap-4">
        <p className="text-[0.65rem] uppercase tracking-widest font-bold">
          © {new Date().getFullYear()} <a href="https://github.com/deepspacetrader" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">DeepSpaceTrader</a> • SignalFrame
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowDisclaimer(true)}
            className="text-[0.65rem] uppercase tracking-widest font-bold hover:text-white transition-colors underline decoration-dotted underline-offset-2"
          >
            Disclaimer
          </button>
          <p className="text-[0.65rem] uppercase tracking-widest font-bold opacity-50">
            Experimental Intelligence Framework
          </p>
        </div>
      </footer>

      <LoadingOverlay />
      <BigPictureModal isOpen={showBigPicture} onClose={() => setShowBigPicture(false)} onAIRequired={() => setShowAIModal(true)} />
      <LocalAIRequiredModal isOpen={showAIModal} onClose={() => setShowAIModal(false)} />
      <DisclaimerModal isOpen={showDisclaimer} onClose={() => setShowDisclaimer(false)} />
    </div>
  )
}
