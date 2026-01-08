
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
  const { isProcessing, lastUpdated, refresh } = useSituationStore()

  return (
    <div className="w-full mx-auto px-8 py-8 min-h-screen bg-bg-darker text-text-primary">
      <header className="mb-10 flex justify-between items-center bg-bg-card/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-2xl">
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
          </div>
        </div>

        <button
          onClick={() => refresh()}
          disabled={isProcessing}
          className="group relative overflow-hidden bg-accent-primary hover:bg-accent-primary/90 text-white font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(59,130,246,0.2)]"
        >
          <span className="flex items-center gap-2">
            {isProcessing ? 'ORCHESTRATING SENSORS...' : 'INITIATE BROAD SPECTRUM SCAN'}
            <svg className={`transition-transform duration-700 ${isProcessing ? 'animate-spin' : 'group-hover:rotate-12'}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </span>
        </button>
      </header>

      <main className="grid grid-cols-12 gap-8">
        <LoadingOverlay />
        <AISettings />

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
        <p className="text-[0.65rem] uppercase tracking-widest font-bold">
          Local Logic Engine • Ollama Runtime
        </p>
      </footer>
    </div >
  )
}
