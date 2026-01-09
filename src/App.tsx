
import { useEffect, useState } from 'react'
import { NarrativeSummary } from './components/NarrativeSummary'
import { SignalList } from './components/SignalList'
import { InsightPanel } from './components/InsightPanel'
import { SourceFeedList } from './components/SourceFeedList'
import { SituationMap } from './components/SituationMap'
import { ForeignRelationsPanel } from './components/ForeignRelationsPanel'
import { LoadingOverlay } from './components/LoadingOverlay'
import { AISettings } from './components/AISettings'
import { useSituationStore } from './state/useSituationStore'
import { DEFAULT_MODEL } from './ai/runtime/engine'

export default function App() {
  const { isProcessing, lastUpdated, refresh, currentDate, availableDates, loadDate, runningModels } = useSituationStore()

  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = currentDate === todayStr;

  const handlePrevDay = () => {
    const currentIndex = availableDates.indexOf(currentDate);
    if (currentIndex > 0) {
      loadDate(availableDates[currentIndex - 1]);
    } else {
      // Fallback: just go back one calendar day if no data index found or at start of index
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      loadDate(d.toISOString().split('T')[0]);
    }
  };

  const handleNextDay = () => {
    if (isToday) return;
    const currentIndex = availableDates.indexOf(currentDate);
    if (currentIndex !== -1 && currentIndex < availableDates.length - 1) {
      loadDate(availableDates[currentIndex + 1]);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      const nextStr = d.toISOString().split('T')[0];
      loadDate(nextStr > todayStr ? todayStr : nextStr);
    }
  };

  return (
    <div className="w-full mx-auto px-8 py-8 min-h-screen bg-bg-darker text-text-primary">
      <header className="mb-10 flex flex-col gap-6 bg-bg-card/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-2xl">

        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-8">
            <div>
              <div className="flex items-center mb-1">
                <span className="status-online w-2 h-2 bg-accent-secondary rounded-full mr-2 shadow-[0_0_10px_var(--accent-secondary)] animate-pulse"></span>
                <span className="text-[0.65rem] text-accent-secondary font-bold uppercase tracking-[0.2em]">
                  Deep Intelligence Node Active
                </span>
              </div>
              <h1 className="m-0 text-3xl font-bold bg-gradient-to-br from-white to-slate-500 bg-clip-text text-transparent font-display tracking-tight">SignalFrame <span className="text-sm font-mono text-slate-600 font-normal ml-2">v0.2.0</span></h1>
            </div>

            <div className="h-10 w-[1px] bg-white/10"></div>

            <div className="flex gap-4">
              <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">Status</p>
                <p className="text-xs font-mono text-accent-secondary">{isProcessing ? 'SCANNING...' : 'ANALYSIS STANDBY'}</p>
              </div>
              {lastUpdated && (
                <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                  <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">Last Sync</p>
                  <p className="text-xs font-mono">{lastUpdated.toLocaleTimeString()}</p>
                </div>
              )}

              {runningModels && runningModels.length > 0 && (
                <div className="flex gap-2">
                  {runningModels.map(m => (
                    <div key={m.name} className="bg-white/5 px-4 py-2 rounded-lg border border-white/5 group/model relative">
                      <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">Engine Load</p>
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
                  ))}
                </div>
              )}

              <AISettings />
            </div>
          </div>

          <button
            onClick={() => refresh()}
            disabled={isProcessing || !isToday}
            className={`group relative overflow-hidden font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(59,130,246,0.1)] 
              ${!isToday ? 'bg-white/5 text-text-secondary cursor-not-allowed border border-white/10' : 'bg-accent-primary text-white hover:bg-accent-primary/90 shadow-[0_0_20px_rgba(59,130,246,0.2)]'}`}
          >
            <span className="flex items-center gap-2">
              {!isToday ? 'LOCKED (HISTORICAL VIEW)' : (isProcessing ? 'SCANNING...' : 'SCAN WITH AI')}
              <svg className={`transition-transform duration-700 ${isProcessing ? 'animate-spin' : 'group-hover:rotate-12'}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </span>
          </button>
        </div>

        {/* Date Navigation Bar */}
        <div className="flex items-center justify-between border-t border-white/5 pt-4">
          <button
            onClick={handlePrevDay}
            className="flex items-center gap-2 text-[0.65rem] uppercase font-bold tracking-widest text-text-secondary hover:text-accent-primary transition-all group"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="transition-transform group-hover:-translate-x-1"><path d="m15 18-6-6 6-6" /></svg>
            Previous Day
          </button>

          <div className="bg-accent-primary/10 border border-accent-primary/20 px-6 py-1 rounded-full">
            <span className="text-xs font-mono font-bold text-accent-primary tracking-widest">
              {(currentDate || todayStr).replace(/-/g, ' / ')}
            </span>
          </div>

          {!isToday ? (
            <button
              onClick={handleNextDay}
              className="flex items-center gap-2 text-[0.65rem] uppercase font-bold tracking-widest text-text-secondary hover:text-accent-primary transition-all group"
            >
              Next Day
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="transition-transform group-hover:translate-x-1"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          ) : (
            <div className="flex items-center gap-2 text-[0.65rem] uppercase font-bold tracking-widest text-accent-secondary opacity-50 cursor-default">
              Today - {todayStr.replace(/-/g, ' / ')}
            </div>
          )}
        </div>
      </header>

      <main className="grid grid-cols-12 gap-8">
        <LoadingOverlay />


        {/* Center/Right Column: Map & Analysis */}
        <div className="col-span-12 lg:col-span-12 space-y-8">
          <SituationMap />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <NarrativeSummary />
            <div className="grid grid-cols-2 md:grid-cols-2 gap-8">
              <SignalList />
              <InsightPanel />
            </div>
          </div>
          <div className="col-span-12 lg:col-span-12">
            <div className="grid grid-cols-2 md:grid-cols-2 gap-8">
              <ForeignRelationsPanel />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-12">
            <SourceFeedList />
          </div>

        </div>
      </main >

      <footer className="mt-16 py-8 border-t border-white/10 text-center flex justify-between items-center text-text-secondary px-4">
        <p className="text-[0.65rem] uppercase tracking-widest font-bold">
          © {new Date().getFullYear()} <a href="https://github.com/deepspacetrader" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">DeepSpaceTrader</a> • SignalFrame • Experimental Intelligence Framework
        </p>
      </footer>
    </div >
  )
}
