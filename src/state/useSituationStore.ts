
import { useState, useCallback, useEffect } from 'react'
import { processSituation, processSingleSection } from '../ai/runtime/engine'
import { fetchLatestFeeds, RawSignal } from '../services/feedIngest'

export interface Signal {
  text: string;
  level: 'low' | 'medium' | 'high';
}

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  category: 'Tech / AI' | 'Financial' | 'Conflicts' | 'Geopolitical';
}

export interface ForeignRelation {
  id: string;
  countryA: string;
  countryB: string;
  topic: string;
  status: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'tension';
  lastUpdate: string;
}

export interface AiConfig {
  model: string;
  numCtx: number;
  numPredict: number;
}

export interface SituationState {
  narrative: string;
  signals: Signal[];
  insights: string[];
  feeds: RawSignal[];
  mapPoints: MapPoint[];
  foreignRelations: ForeignRelation[];
  isProcessing: boolean;
  processingStatus: string;
  isProcessingSection: {
    narrative: boolean;
    signals: boolean;
    insights: boolean;
    map: boolean;
    relations: boolean;
  };
  aiConfig: AiConfig;
  availableModels: string[];
  lastUpdated: Date | null;
}

const CORE_KEY = 'signal_frame_analysis';
const FEED_KEY = 'signal_frame_feeds';
const RELATIONS_KEY = 'signal_frame_relations';
const LEGACY_KEY = 'signal_frame_state';

const defaultState: SituationState = {
  narrative: '',
  signals: [],
  insights: [],
  feeds: [],
  mapPoints: [],
  foreignRelations: [],
  isProcessing: false,
  processingStatus: 'Idle',
  isProcessingSection: {
    narrative: false,
    signals: false,
    insights: false,
    map: false,
    relations: false
  },
  aiConfig: {
    model: 'llama3.2',
    numCtx: 25000,
    numPredict: 15000
  },
  availableModels: [],
  lastUpdated: null
};

let globalState: SituationState = { ...defaultState };

// Re-hydrate starting immediately
const savedCore = localStorage.getItem(CORE_KEY);
const savedFeeds = localStorage.getItem(FEED_KEY);
const savedRelations = localStorage.getItem(RELATIONS_KEY);

if (savedCore) try { Object.assign(globalState, JSON.parse(savedCore)); } catch (e) { }
if (savedFeeds) try { globalState.feeds = JSON.parse(savedFeeds); } catch (e) { }
if (savedRelations) try { globalState.foreignRelations = JSON.parse(savedRelations); } catch (e) { }

// Reset volatiles
globalState.isProcessing = false;
globalState.processingStatus = 'Idle';
globalState.isProcessingSection = { ...defaultState.isProcessingSection };

// Fix date object after JSON.parse
if (globalState.lastUpdated) {
  globalState.lastUpdated = new Date(globalState.lastUpdated);
}

const listeners = new Set<(state: SituationState) => void>();

function emit() {
  const { feeds, foreignRelations, isProcessing, processingStatus, isProcessingSection, availableModels, ...core } = globalState;
  localStorage.setItem(CORE_KEY, JSON.stringify(core));
  localStorage.setItem(FEED_KEY, JSON.stringify(feeds));
  localStorage.setItem(RELATIONS_KEY, JSON.stringify(foreignRelations));
  listeners.forEach(l => l(globalState));
}

export function useSituationStore() {
  const [state, setState] = useState<SituationState>(globalState);

  useEffect(() => {
    listeners.add(setState);
    return () => { listeners.delete(setState); };
  }, []);

  const refresh = useCallback(async () => {
    if (globalState.isProcessing) return;

    globalState = {
      ...globalState,
      isProcessing: true,
      processingStatus: 'Initializing...',
      isProcessingSection: { narrative: true, signals: true, insights: true, map: true, relations: true }
    };
    emit();

    try {
      const newsFeeds = await fetchLatestFeeds()
      const result = await processSituation(
        newsFeeds,
        globalState.foreignRelations,
        globalState.aiConfig,
        (status) => {
          globalState = { ...globalState, processingStatus: status };
          emit();
        },
        (chunk) => {
          globalState = { ...globalState, narrative: chunk };
          emit();
        }
      );

      globalState = {
        ...globalState,
        ...result,
        feeds: newsFeeds,
        isProcessing: false,
        processingStatus: 'Scan Complete',
        isProcessingSection: { narrative: false, signals: false, insights: false, map: false, relations: false },
        lastUpdated: new Date()
      };
      emit();
    } catch (error) {
      globalState = { ...globalState, isProcessing: false, processingStatus: 'Error' };
      emit();
    }
  }, []);

  const refreshSection = useCallback(async (sectionId: keyof SituationState['isProcessingSection']) => {
    if (globalState.isProcessing || globalState.isProcessingSection[sectionId] || globalState.feeds.length === 0) return;

    globalState = {
      ...globalState,
      isProcessingSection: { ...globalState.isProcessingSection, [sectionId]: true }
    };
    emit();

    try {
      const result = await processSingleSection(
        sectionId,
        globalState.feeds,
        globalState.foreignRelations,
        globalState.aiConfig,
        sectionId === 'narrative' ? (chunk) => {
          globalState = { ...globalState, narrative: chunk };
          emit();
        } : undefined
      );

      globalState = {
        ...globalState,
        ...result,
        isProcessingSection: { ...globalState.isProcessingSection, [sectionId]: false }
      };
      emit();
    } catch (error) {
      globalState = { ...globalState, isProcessingSection: { ...globalState.isProcessingSection, [sectionId]: false } };
      emit();
    }
  }, []);

  const addRelation = useCallback((countryA: string, countryB: string, topic: string) => {
    const newRel: ForeignRelation = {
      id: Math.random().toString(36).substr(2, 9),
      countryA, countryB, topic,
      status: 'Added - waiting for scan...',
      sentiment: 'neutral',
      lastUpdate: new Date().toISOString()
    };
    globalState = { ...globalState, foreignRelations: [...globalState.foreignRelations, newRel] };
    emit();
  }, []);

  const removeRelation = useCallback((id: string) => {
    globalState = { ...globalState, foreignRelations: globalState.foreignRelations.filter(r => r.id !== id) };
    emit();
  }, []);

  const fetchAvailableModels = useCallback(async () => {
    try {
      const { OllamaService } = await import('../ai/runtime/ollama');
      const models = await OllamaService.listModels();
      globalState = { ...globalState, availableModels: models };
      emit();
    } catch (e) { }
  }, []);

  const updateAiConfig = useCallback((config: Partial<AiConfig>) => {
    globalState = { ...globalState, aiConfig: { ...globalState.aiConfig, ...config } };
    emit();
  }, []);

  return {
    ...state,
    refresh,
    refreshSection,
    addRelation,
    removeRelation,
    fetchAvailableModels,
    updateAiConfig
  };
}
