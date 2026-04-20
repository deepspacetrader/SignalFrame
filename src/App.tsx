import { useEffect, useState } from 'react'
import { NarrativeSummary } from './components/NarrativeSummary'
import { Signals } from './components/Signals'
import { SourceFeedList } from './components/SourceFeedList'
import { SituationMap } from './components/SituationMap'
import { ForeignRelationsPanel } from './components/ForeignRelationsPanel'
import { LoadingOverlay } from './components/LoadingOverlay'
import { ChatPanel } from './components/ChatPanel'
import { PredictionsPanel } from './components/PredictionsPanel'
import { Header } from './components/Header'
import { useSituationStore } from './state/useSituationStore'
import { findPreviousSnapshot } from './state/useSituationStore'
import { BigPictureModal } from './components/BigPictureModal'
import { LocalAIRequiredModal } from './components/LocalAIRequiredModal'
import { DisclaimerModal } from './components/DisclaimerModal'
// import { SoundTestPanel } from './components/SoundTestPanel'

export default function App() {
  const { isProcessing, lastUpdated, refresh, currentDate, availableDates, loadDate, runningModels, sectionGenerationTimes, aiConfig, aiStatus, exportSnapshot } = useSituationStore()
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

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const todayStr = getLocalTodayStr();
  const isToday = currentDate === todayStr;

  const handlePrevDay = () => {
    const currentIndex = availableDates.indexOf(currentDate);
    if (currentIndex > 0) {
      loadDate(availableDates[currentIndex - 1]);
    } else {
      // Calculate previous day and try to load it
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
      <Header
        onAIRequired={() => setShowAIModal(true)}
        onBigPictureClick={() => setShowBigPicture(true)}
        onRefresh={handleRefresh}
        isProcessing={isProcessing}
        isToday={isToday}
        currentDate={currentDate}
        todayStr={todayStr}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
      />

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
              Deep Intelligence
              <span className="w-12 h-[1px] bg-white/5"></span>
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
      {/* <SoundTestPanel /> */}
    </div>
  )
}