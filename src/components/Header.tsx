import { useState } from 'react'
import { AISettings } from './AISettings'
import { RSSSettings } from './RSSSettings'
import { VolumeControl } from './VolumeControl'
import { ModelUnloadControl } from './ModelUnloadControl'
import { useSituationStore } from '../state/useSituationStore'
import { formatTime } from '../utils/timeUtils'
import { getSentimentProfile } from '../ai/runtime/sentimentEngine'

interface HeaderProps {
  onAIRequired: () => void
  onBigPictureClick: () => void
  onRefresh: () => void
  isProcessing: boolean
  isToday: boolean
  currentDate: string
  todayStr: string
  onPrevDay: () => void
  onNextDay: () => void
}

export function Header({ onAIRequired, onBigPictureClick, onRefresh, isProcessing, isToday, currentDate, todayStr, onPrevDay, onNextDay }: HeaderProps) {
  const { lastUpdated, runningModels, sectionGenerationTimes, aiConfig, aiStatus } = useSituationStore()
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

  return (
    <header className="mb-10 flex flex-col gap-6 bg-bg-card/40 backdrop-blur-md p-6 border border-white/5 shadow-2xl">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center w-full gap-6 lg:gap-0">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 w-full lg:w-auto">
          <div>
            <div className="flex items-center mb-1">
              <span className="status-online w-2 h-2 bg-accent-secondary mr-2 shadow-[0_0_10px_var(--accent-secondary)] animate-pulse"></span>
              <span className="text-[0.65rem] text-accent-secondary font-bold uppercase tracking-[0.2em]">
                Deep Intelligence Node Active
              </span>
            </div>
            <h1 className="m-0 text-3xl font-bold bg-gradient-to-br from-white to-slate-500 bg-clip-text text-transparent font-display tracking-tight">SignalFrame <span className="text-sm font-mono text-slate-600 font-normal ml-2">v0.6.0</span></h1>
          </div>

          <div className="hidden md:block h-10 w-[1px] bg-white/10"></div>

          <div className="header-stats grid grid-cols-2 gap-4 w-full lg:w-auto lg:flex lg:flex-wrap">
            <div className="bg-white/5 px-4 py-2 border border-white/5 flex-1 md:flex-none">
              <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">Status</p>
              <p className={`text-xs font-mono whitespace-nowrap ${isProcessing ? 'text-accent-secondary' :
                (isLocalhost && (aiStatus?.isOnline || aiConfig?.model) ? 'text-green-500' : 'text-red-500')
                }`}>
                {isProcessing ? 'SCANNING...' : (isLocalhost && (aiStatus?.isOnline || aiConfig?.model) ? (aiConfig?.provider === 'lmstudio' ? 'LM STUDIO ONLINE' : 'OLLAMA ONLINE') : 'AI OFFLINE')}
              </p>
            </div>
            <div className="bg-white/5 px-4 py-2 border border-white/5">
            <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">Last Scan</p>
              {lastUpdated ? (
                  <p className="text-xs font-mono">{lastUpdated.toLocaleTimeString()}</p>
              ) : (
                  <p className="text-xs font-mono text-red-500">never</p>
                )}
            </div>

            <div className="bg-white/5 px-4 py-2 border border-white/5">
              <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">Sentiment</p>
              <p className="text-xs font-mono text-accent-primary">
                {getSentimentProfile(aiConfig.sentimentProfile || 'balanced').name}
              </p>
            </div>

            <div className="flex gap-2">
              {runningModels && runningModels.length > 0 ? (
                aiConfig?.provider === 'lmstudio' ? (
                  // For LM Studio, only show the currently selected model
                  <div className="bg-white/5 px-4 py-2 border border-white/5 group/model relative hover:min-w-fit hover:w-auto transition-all duration-200">
                    <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">AI Model</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white group-hover/model:whitespace-normal group-hover/model:truncate-none group-hover/model:max-w-none whitespace-nowrap truncate max-w-24 transition-all duration-200" title={aiConfig?.model || 'Unknown'}>{aiConfig?.model || 'Unknown'}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-accent-secondary animate-pulse shadow-[0_0_5px_var(--accent-secondary)]"></span>
                        <span className="text-[9px] font-mono text-accent-secondary font-bold">LM Studio</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  // For Ollama, show all running models
                  runningModels.map(m => (
                    <div key={m.name} className="bg-white/5 px-4 py-2 rounded-lg border border-white/5 group/model relative hover:min-w-fit hover:w-auto transition-all duration-200">
                      <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">AI Model</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-white group-hover/model:whitespace-normal group-hover/model:truncate-none group-hover/model:max-w-none whitespace-nowrap truncate max-w-24 transition-all duration-200" title={m.name.split(':')[0]}>{m.name.split(':')[0]}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-accent-secondary animate-pulse shadow-[0_0_5px_var(--accent-secondary)]"></span>
                          <span className="text-[9px] font-mono text-accent-secondary font-bold">
                            {Math.round(m.size_vram / 1024 / 1024 / 1024 * 10) / 10}GB
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : (
                <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/5 group/model relative hover:min-w-fit hover:w-auto transition-all duration-200">
                  <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">AI Model</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono group-hover/model:whitespace-normal group-hover/model:truncate-none group-hover/model:max-w-none whitespace-nowrap truncate max-w-24 transition-all duration-200 ${isLocalhost && (aiStatus?.isOnline || aiConfig?.model) ? (aiConfig?.model ? 'text-green-500' : 'text-red-500') : 'text-red-500'}`} title={isLocalhost && (aiStatus?.isOnline || aiConfig?.model) ? (aiConfig?.model || 'No Model Selected') : 'No AI Model Loaded'}>
                      {isLocalhost && (aiStatus?.isOnline || aiConfig?.model) ? (aiConfig?.model || 'No Model Selected') : 'No AI Model Loaded'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {sectionGenerationTimes['full-scan'] && (
              <div className="bg-white/5 px-4 py-2 border border-white/5">
                <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">Last Scan</p>
                <p className="text-xs font-mono text-accent-secondary">{formatTime(sectionGenerationTimes['full-scan'])}</p>
              </div>
            )}

            <AISettings onAIRequired={onAIRequired} />
            <RSSSettings onAIRequired={onAIRequired} />
            <VolumeControl />
            <ModelUnloadControl />
          </div>
        </div>

        <button
          onClick={onBigPictureClick}
          className="bg-accent-primary/10 border border-accent-primary/20 text-accent-primary px-4 py-2 rounded-lg hover:bg-accent-primary/20 transition-all flex items-center gap-2 group mr-3 flex-1 md:flex-none justify-center min-w-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:scale-110 transition-transform flex-shrink-0">
            <path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-widest whitespace-nowrap">The Big Picture</span>
        </button>

        <button
          onClick={onRefresh}
          disabled={isProcessing}
          className={`group relative overflow-hidden font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(59,130,246,0.1)] flex-1 md:flex-none justify-center items-center min-w-0
          ${!isToday ? 'bg-purple-600/80 text-white hover:bg-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'bg-accent-primary text-white hover:bg-accent-primary/90 shadow-[0_0_20px_rgba(59,130,246,0.2)]'}`}
        >
          <span className="flex items-center justify-center gap-2 whitespace-nowrap">
            {isProcessing ? 'SCANNING...' : (!isToday ? 'SCAN HISTORICAL DATA' : 'SCAN WITH AI')}
            <svg className={`transition-transform duration-700 ${isProcessing ? 'animate-spin' : 'group-hover:rotate-12'} flex-shrink-0`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-4">
        <button
          onClick={onPrevDay}
          className="flex items-center gap-2 text-[0.65rem] uppercase font-bold tracking-widest text-white hover:text-secondary transition-all group rounded px-2 py-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="transition-transform group-hover:-translate-x-1"><path d="m15 18-6-6 6-6" /></svg>
          <span className="hidden sm:inline">Previous Day</span>
          <span className="sm:hidden">Prev</span>
        </button>

        <div className="border border-accent-primary/20 px-6 py-1">
          <span className="text-xs font-mono font-bold text-accent-primary tracking-widest">
            {(currentDate || todayStr).replace(/-/g, ' / ')}
          </span>
        </div>

        {!isToday ? (
          <button
            onClick={onNextDay}
            className="flex items-center gap-2 text-[0.65rem] uppercase font-bold tracking-widest text-white hover:text-secondary transition-all group rounded px-2 py-1"
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
  )
}
