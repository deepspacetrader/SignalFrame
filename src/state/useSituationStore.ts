
import { useState, useCallback, useEffect } from 'react'
import { processSituation, processSingleSection } from '../ai/runtime/engine'
import { fetchLatestFeeds, RawSignal } from '../services/feedIngest'
import { StorageService } from '../services/db'

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

export interface RunningModel {
  name: string;
  size: number;
  size_vram: number;
}

export interface SituationState {
  currentDate: string; // YYYY-MM-DD
  availableDates: string[];
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
  runningModels: RunningModel[];
  lastUpdated: Date | null;
}

const getTodayStr = () => new Date().toISOString().split('T')[0];

const defaultState: SituationState = {
  currentDate: getTodayStr(),
  availableDates: [],
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
  runningModels: [],
  lastUpdated: null
};

let globalState: SituationState = { ...defaultState };
const listeners = new Set<(state: SituationState) => void>();

function emit() {
  // Save snapshot to DB
  StorageService.saveAnalysis(globalState.currentDate, {
    narrative: globalState.narrative,
    signals: globalState.signals,
    insights: globalState.insights,
    feeds: globalState.feeds,
    mapPoints: globalState.mapPoints,
    foreignRelations: globalState.foreignRelations,
    lastUpdated: globalState.lastUpdated
  });

  // Save AI Config and Global relations list (Definitions) separately
  StorageService.saveGlobal('ai_config', globalState.aiConfig);
  StorageService.saveGlobal('relation_defs', globalState.foreignRelations.map(r => ({
    id: r.id,
    countryA: r.countryA,
    countryB: r.countryB,
    topic: r.topic
  })));

  listeners.forEach(l => l({ ...globalState }));
}

export function useSituationStore() {
  const [state, setState] = useState<SituationState>(globalState);

  useEffect(() => {
    listeners.add(setState);
    // Initial Load - Ensure we don't leak async logic into raw state
    const init = async () => {
      const today = getTodayStr();
      const [analysis, config, defs, dates] = await Promise.all([
        StorageService.getAnalysis(today),
        StorageService.getGlobal('ai_config'),
        StorageService.getGlobal('relation_defs'),
        StorageService.getAllDates()
      ]);

      if (config) globalState.aiConfig = config;
      globalState.availableDates = dates.length > 0 ? dates : [today];
      globalState.currentDate = today;

      if (analysis) {
        Object.assign(globalState, analysis);
        if (globalState.lastUpdated) globalState.lastUpdated = new Date(globalState.lastUpdated);
      } else if (defs) {
        globalState.foreignRelations = defs.map((d: any) => ({
          ...d,
          status: 'Awaiting discovery...',
          sentiment: 'neutral',
          lastUpdate: new Date().toISOString()
        }));
      }

      emit();
      fetchRunningModels();
    };
    init();

    // Poll for running models
    const poll = setInterval(() => {
      fetchRunningModels();
    }, 5000);

    return () => {
      listeners.delete(setState);
      clearInterval(poll);
    };
  }, []);

  const loadDate = useCallback(async (dateStr: string) => {
    if (globalState.isProcessing) return;

    globalState.currentDate = dateStr;
    const analysis = await StorageService.getAnalysis(dateStr);

    if (analysis) {
      Object.assign(globalState, analysis);
      if (globalState.lastUpdated) globalState.lastUpdated = new Date(globalState.lastUpdated);
    } else {
      globalState.narrative = '';
      globalState.signals = [];
      globalState.insights = [];
      globalState.feeds = [];
      globalState.mapPoints = [];
      globalState.lastUpdated = null;

      const defs = await StorageService.getGlobal('relation_defs');
      if (defs) {
        globalState.foreignRelations = defs.map((d: any) => ({
          ...d,
          status: 'No data for this date.',
          sentiment: 'neutral',
          lastUpdate: new Date().toISOString()
        }));
      }
    }
    emit();
  }, []);

  const refresh = useCallback(async () => {
    if (globalState.isProcessing) return;

    globalState = {
      ...globalState,
      isProcessing: true,
      processingStatus: 'Initializing Intelligence Network...',
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

      const dates = await StorageService.getAllDates();
      globalState.availableDates = dates;

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

  const fetchRunningModels = useCallback(async () => {
    try {
      const { OllamaService } = await import('../ai/runtime/ollama');
      const models = await OllamaService.getRunningModels();
      globalState = { ...globalState, runningModels: models };
      // Note: We don't call emit() here to avoid saving volatile ps data to DB
      listeners.forEach(l => l({ ...globalState }));
    } catch (e) { }
  }, []);

  return {
    ...state,
    refresh,
    refreshSection,
    addRelation,
    removeRelation,
    fetchAvailableModels,
    updateAiConfig,
    fetchRunningModels,
    loadDate
  };
}
