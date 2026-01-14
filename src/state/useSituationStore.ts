import { useState, useCallback, useEffect } from 'react'
import { processSituation, processSingleSection, processBigPicture } from '../ai/runtime/engine'
import { fetchLatestFeeds, RawSignal } from '../services/feedIngest'
import { StorageService } from '../services/db'

export type Sentiment =
  | 'extremely-negative'
  | 'very-negative'
  | 'negative'
  | 'somewhat-negative'
  | 'neutral'
  | 'interesting'
  | 'positive'
  | 'very-positive';

export type SignalCategory =
  | 'Tech/AI'
  | 'Financial'
  | 'Conflicts'
  | 'Geopolitical'
  | 'Other';

export type DeltaType =
  | 'escalation'
  | 'deescalation'
  | 'policy'
  | 'market'
  | 'breakthrough'
  | 'disruption'
  | 'other';

export interface EvidenceRef {
  feedId: string;
  source?: string;
  title?: string;
  link?: string;
  timestamp?: string;
  quote?: string;
}

export interface ContradictionRef {
  claimA: string;
  claimB: string;
  evidenceA: EvidenceRef[];
  evidenceB: EvidenceRef[];
}

export interface DeepDiveData {
  signalId: string;
  generatedAt: string;
  header: {
    title: string;
    text: string;
    sentiment: Sentiment;
    deltaType?: DeltaType;
    category?: SignalCategory;
  };
  fiveWs: {
    who?: string[];
    what?: string;
    where?: string;
    when?: string;
    why?: string;
    soWhat?: string;
  };
  evidence: EvidenceRef[];
  counterpoints?: {
    claimA: string;
    claimB: string;
    evidenceA: EvidenceRef[];
    evidenceB: EvidenceRef[];
  }[];
  watchNext?: string[];
}

export type MetricDefType = 'category' | 'keyword' | 'tracker';

export interface MetricDef {
  id: string;
  name: string;
  type: MetricDefType;
  config: {
    category?: SignalCategory;
    sentiment?: Sentiment;
    keywords?: string[];
    trackerId?: string;
  };
}

export interface Signal {
  text: string;
  sentiment: Sentiment;
  id?: string;
  title?: string;
  category?: SignalCategory;
  deltaType?: DeltaType;
  importance?: number;
  novelty?: number;
  timeRange?: { start?: string; end?: string };
  location?: { name: string; lat?: number; lng?: number };
  evidence?: EvidenceRef[];
  contradictions?: ContradictionRef[];
  explain?: string;
  shareText?: string;
  threadId?: string;
}

export interface Insight {
  text: string;
  sentiment: Sentiment;
  evidence?: EvidenceRef[];
  signalId?: string; // Optional: tie this insight to a specific signal by its id
}

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  sentiment: Sentiment | 'positive' | 'neutral' | 'negative';
  category: 'Tech / AI' | 'Financial' | 'Conflicts' | 'Geopolitical';
  description?: string;
  sourceLink?: string;
  signalId?: string;
}

export interface ForeignRelation {
  id: string;
  countryA: string;
  countryB: string;
  topic: string;
  status: string;
  sentiment: Sentiment | 'positive' | 'neutral' | 'negative' | 'tension';
  lastUpdate: string;
}

export interface BigPictureData {
  summary: string;
  timeline: {
    date: string;
    title: string;
    summary: string;
    sentiment: Sentiment;
  }[];
  lastUpdated: string;
}

export interface AiConfig {
  model: string;
  numCtx: number;
  numPredict: number;
  enableThinking: boolean; // Enable thinking/reasoning trace for supported models
}

export interface RunningModel {
  name: string;
  size: number;
  size_vram: number;
}

export interface JsonErrorState {
  hasError: boolean;
  error: string;
  canRetry: boolean;
  sectionId: keyof SituationState['isProcessingSection'] | null;
  retryCount: number;
}

export interface SituationState {
  currentDate: string; // YYYY-MM-DD
  availableDates: string[];
  narrative: string;
  signals: Signal[];
  insights: Insight[];
  feeds: RawSignal[];
  mapPoints: MapPoint[];
  foreignRelations: ForeignRelation[];
  thinkingTrace: string; // AI's reasoning trace for narrative generation
  isProcessing: boolean;
  processingStatus: string;
  isProcessingSection: {
    narrative: boolean;
    signals: boolean;
    insights: boolean;
    map: boolean;
    relations: boolean;
    bigPicture: boolean;
  };
  bigPicture: BigPictureData | null;
  aiConfig: AiConfig;
  availableModels: string[];
  runningModels: RunningModel[];
  lastUpdated: Date | null;
  jsonError: JsonErrorState;
  sourceCredibility: Record<string, number>;
  metricDefs: MetricDef[];
  dailyMetrics: Record<string, number>;
  deepDiveBySignalId: Record<string, DeepDiveData>;
  activeDeepDiveSignalId: string | null;
  isGeneratingDeepDive: boolean;
  rawOutputs: Record<string, string>; // Store raw AI outputs by section
  activeRawOutput: string | null; // Currently displayed raw output section
}

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
    relations: false,
    bigPicture: false
  },
  bigPicture: null,
  thinkingTrace: '',
  aiConfig: {
    model: '',
    numCtx: 0,
    numPredict: 0,
    enableThinking: false
  },
  availableModels: [],
  runningModels: [],
  lastUpdated: null,
  jsonError: {
    hasError: false,
    error: '',
    canRetry: false,
    sectionId: null,
    retryCount: 0
  },
  sourceCredibility: {
    'Reuters': 0.95,
    'Associated Press': 0.92,
    'AP News': 0.92,
    'BBC News': 0.9,
    'Financial Times': 0.9,
    'The Economist': 0.88,
    'The Wall Street Journal': 0.88,
    'The New York Times': 0.86,
    'Bloomberg': 0.86,
    'Al Jazeera': 0.8,
    'Google News Archive': 0.7
  },
  metricDefs: [],
  dailyMetrics: {},
  deepDiveBySignalId: {},
  activeDeepDiveSignalId: null,
  isGeneratingDeepDive: false,
  rawOutputs: {},
  activeRawOutput: null
};

let globalState: SituationState = { ...defaultState };
const listeners = new Set<(state: SituationState) => void>();

/**
 * Notifies all listeners of state changes without persisting to DB.
 */
function notify() {
  listeners.forEach(l => l({ ...globalState }));
}

/**
 * Persists current snapshot and global settings to DB.
 */
async function persist() {
  // Only persist if we have a valid date
  if (!globalState.currentDate) return;

  // Save snapshot to DB - EXCLUDING bigPicture which is now global
  // We construct the object explicitly to avoid sending bigPicture into the daily slot
  await StorageService.saveAnalysis(globalState.currentDate, {
    narrative: globalState.narrative,
    signals: globalState.signals,
    insights: globalState.insights,
    feeds: globalState.feeds,
    mapPoints: globalState.mapPoints,
    foreignRelations: globalState.foreignRelations,
    dailyMetrics: globalState.dailyMetrics,
    lastUpdated: globalState.lastUpdated
  });

  // Save AI Config and Global relations list (Definitions) separately
  await StorageService.saveGlobal('ai_config', globalState.aiConfig);
  await StorageService.saveGlobal('bigPicture', globalState.bigPicture); // GLOBAL PERSISTENCE
  await StorageService.saveGlobal('relation_defs', globalState.foreignRelations.map(r => ({
    id: r.id,
    countryA: r.countryA,
    countryB: r.countryB,
    topic: r.topic
  })));
  await StorageService.saveGlobal('source_credibility', globalState.sourceCredibility);
  await StorageService.saveGlobal('metric_defs', globalState.metricDefs);
  await StorageService.saveGlobal('deep_dive_cache', globalState.deepDiveBySignalId);
}

export function useSituationStore() {
  const [state, setState] = useState<SituationState>(globalState);

  useEffect(() => {
    listeners.add(setState);
    // Initial Load - Ensure we don't leak async logic into raw state
    const init = async () => {
      const today = getTodayStr();
      const [analysis, config, defs, dates, savedBigPicture] = await Promise.all([
        StorageService.getAnalysis(today),
        StorageService.getGlobal('ai_config'),
        StorageService.getGlobal('relation_defs'),
        StorageService.getAllDates(),
        StorageService.getGlobal('bigPicture')
      ]);

      const [savedCred, savedMetricDefs, savedDeepDives] = await Promise.all([
        StorageService.getGlobal('source_credibility'),
        StorageService.getGlobal('metric_defs'),
        StorageService.getGlobal('deep_dive_cache')
      ]);

      if (config) globalState.aiConfig = config;
      if (savedBigPicture) globalState.bigPicture = savedBigPicture; // Load Global Big Picture
      if (savedCred && typeof savedCred === 'object') globalState.sourceCredibility = savedCred;
      if (savedMetricDefs && Array.isArray(savedMetricDefs)) globalState.metricDefs = savedMetricDefs;
      if (savedDeepDives && typeof savedDeepDives === 'object') globalState.deepDiveBySignalId = savedDeepDives;

      globalState.availableDates = dates.length > 0 ? dates : [today];
      globalState.currentDate = today;

      if (analysis) {
        // Load daily analysis but Preserve Global Big Picture if it exists
        const bp = globalState.bigPicture;
        Object.assign(globalState, analysis);
        if (bp) globalState.bigPicture = bp;

        if (!globalState.dailyMetrics) globalState.dailyMetrics = {};

        if (globalState.lastUpdated) globalState.lastUpdated = new Date(globalState.lastUpdated);
      } else if (defs) {
        // Hydrate relations from defs if no daily analysis
        // Try to find last known status for these relations to avoid "No Data" shock
        const historicalRelations = await getLastKnownRelations();
        globalState.foreignRelations = defs.map((d: any) => {
          const history = historicalRelations.find(h => h.id === d.id);
          return history ? history : {
            ...d,
            status: 'Awaiting discovery...',
            sentiment: 'neutral',
            lastUpdate: new Date().toISOString()
          };
        });
      }

      notify();
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

  const updateSourceCredibility = useCallback((source: string, weight: number) => {
    const normalized = String(source || '').trim();
    if (!normalized) return;
    const clamped = Math.max(0, Math.min(1, weight));
    globalState = {
      ...globalState,
      sourceCredibility: { ...globalState.sourceCredibility, [normalized]: clamped }
    };
    notify();
    persist();
  }, []);

  const upsertMetricDef = useCallback((def: MetricDef) => {
    const existingIdx = globalState.metricDefs.findIndex(m => m.id === def.id);
    const next = [...globalState.metricDefs];
    if (existingIdx >= 0) next[existingIdx] = def;
    else next.push(def);
    globalState = { ...globalState, metricDefs: next };
    notify();
    persist();
  }, []);

  const removeMetricDef = useCallback((id: string) => {
    globalState = { ...globalState, metricDefs: globalState.metricDefs.filter(m => m.id !== id) };
    notify();
    persist();
  }, []);

  const openDeepDive = useCallback((signalId: string) => {
    globalState = { ...globalState, activeDeepDiveSignalId: signalId };
    notify();
  }, []);

  const closeDeepDive = useCallback(() => {
    globalState = { ...globalState, activeDeepDiveSignalId: null };
    notify();
  }, []);

  const generateDeepDive = useCallback(async (signalId: string) => {
    const existing = globalState.deepDiveBySignalId[signalId];
    if (existing) {
      globalState = { ...globalState, activeDeepDiveSignalId: signalId };
      notify();
      return;
    }

    const signal = globalState.signals.find(s => (s.id || '') === signalId);
    if (!signal) return;

    globalState = { ...globalState, isGeneratingDeepDive: true, activeDeepDiveSignalId: signalId };
    notify();

    try {
      const { generateDeepDive: generateDeepDiveRuntime } = await import('../ai/runtime/engine');
      const result = await generateDeepDiveRuntime(
        signal,
        globalState.feeds,
        globalState.currentDate,
        globalState.aiConfig
      );

      globalState = {
        ...globalState,
        deepDiveBySignalId: { ...globalState.deepDiveBySignalId, [signalId]: result },
        isGeneratingDeepDive: false
      };
      notify();
      persist();
    } catch (e) {
      globalState = { ...globalState, isGeneratingDeepDive: false };
      notify();
    }
  }, []);

  const setRawOutput = useCallback((sectionId: string, rawOutput: string) => {
    globalState = {
      ...globalState,
      rawOutputs: { ...globalState.rawOutputs, [sectionId]: rawOutput }
    };
    notify();
  }, []);

  const showRawOutput = useCallback((sectionId: string) => {
    globalState = { ...globalState, activeRawOutput: sectionId };
    notify();
  }, []);

  const clearSection = useCallback((sectionId: keyof SituationState['isProcessingSection']) => {
    console.log('Clearing section:', sectionId);
    
    // Clear the specific section data from current state
    if (sectionId === 'narrative') {
      globalState = { ...globalState, narrative: '' };
    } else if (sectionId === 'signals') {
      globalState = { ...globalState, signals: [] };
    } else if (sectionId === 'insights') {
      globalState = { ...globalState, insights: [] };
    } else if (sectionId === 'map') {
      globalState = { ...globalState, mapPoints: [] };
    } else if (sectionId === 'relations') {
      globalState = { ...globalState, foreignRelations: [] };
    }
    
    // Also clear the raw output for this section
    const newRawOutputs = { ...globalState.rawOutputs };
    delete newRawOutputs[sectionId];
    globalState = { ...globalState, rawOutputs: newRawOutputs };
    
    notify();
  }, []);

  const hideRawOutput = useCallback(() => {
    globalState = { ...globalState, activeRawOutput: null };
    notify();
  }, []);

  // Helper to find the last known state of relations across all history
  const getLastKnownRelations = async (): Promise<ForeignRelation[]> => {
    try {
      const dates = await StorageService.getAllDates();
      // Iterate backwards
      for (let i = dates.length - 1; i >= 0; i--) {
        const data = await StorageService.getAnalysis(dates[i]);
        if (data && data.foreignRelations && data.foreignRelations.length > 0) {
          return data.foreignRelations; // Found the most recent snapshot
        }
      }
    } catch (e) { }
    return [];
  };

  const loadDate = useCallback(async (dateStr: string) => {
    if (globalState.isProcessing) return;

    // Cache current relation defs to prevent overwriting them with historical snapshots
    const currentDefs = await StorageService.getGlobal('relation_defs');
    const currentBigPicture = globalState.bigPicture;

    globalState.currentDate = dateStr;
    const analysis = await StorageService.getAnalysis(dateStr);

    if (analysis) {
      Object.assign(globalState, analysis);
      if (globalState.lastUpdated) globalState.lastUpdated = new Date(globalState.lastUpdated);

      // RESTORE Global Big Picture if we want it to be truly global
      if (currentBigPicture) globalState.bigPicture = currentBigPicture;

      if (!globalState.dailyMetrics) globalState.dailyMetrics = {};

      // Ensure we keep the latest relation definitions even when viewing history
      if (currentDefs) {
        const historicalRelations = globalState.foreignRelations;
        globalState.foreignRelations = currentDefs.map((def: any) => {
          const historical = historicalRelations.find(h => h.id === def.id);
          return historical ? { ...def, status: historical.status, sentiment: historical.sentiment, lastUpdate: historical.lastUpdate } : {
            ...def,
            status: 'No data for this date.',
            sentiment: 'neutral',
            lastUpdate: new Date().toISOString()
          };
        });
      }
    } else {
      globalState.narrative = '';
      globalState.signals = [];
      globalState.insights = [];
      globalState.feeds = [];
      globalState.mapPoints = [];
      globalState.dailyMetrics = {};
      globalState.lastUpdated = null;
      if (currentBigPicture) globalState.bigPicture = currentBigPicture;

      if (currentDefs) {
        globalState.foreignRelations = currentDefs.map((d: any) => ({
          ...d,
          status: 'No data for this date.',
          sentiment: 'neutral',
          lastUpdate: new Date().toISOString()
        }));
      }
    }
    notify();
    // We do NOT call persist() here because loading historical data should not overwrite anything.
  }, []);

  const refresh = useCallback(async () => {
    if (globalState.isProcessing) return;

    // Use last known relations for context if current day is empty or just "Awaiting..."
    let contextRelations = globalState.foreignRelations;
    if (contextRelations.every(r => r.status === 'No data for this date.' || r.status.includes('Awaiting'))) {
      const lastKnown = await getLastKnownRelations();
      if (lastKnown.length > 0) {
        contextRelations = await StorageService.getGlobal('relation_defs').then(defs => {
          if (!defs) return lastKnown;
          return defs.map((d: any) => {
            const known = lastKnown.find(k => k.id === d.id);
            return known ? known : d;
          });
        });
      }
    }

    globalState = {
      ...globalState,
      isProcessing: true,
      processingStatus: 'Initializing Intelligence Network...',
      thinkingTrace: '', // Reset thinking trace on new scan
      isProcessingSection: { narrative: true, signals: true, insights: true, map: true, relations: true, bigPicture: false }
    };
    notify();

    try {
      // Check if we already have feeds for today to avoid rate limiting
      let newsFeeds = globalState.feeds;
      
      // Only fetch if we don't have feeds or they're empty
      if (!newsFeeds || newsFeeds.length === 0) {
        globalState = { ...globalState, processingStatus: 'Fetching latest feeds...' };
        notify();
        newsFeeds = await fetchLatestFeeds(globalState.currentDate);
      } else {
        globalState = { ...globalState, processingStatus: 'Using cached feeds...' };
        notify();
      }
      
      const result = await processSituation(
        newsFeeds,
        contextRelations, // Pass enriched relations
        globalState.aiConfig,
        globalState.bigPicture,
        (status: string) => {
          globalState = { ...globalState, processingStatus: status };
          notify();
        },
        (chunk) => {
          globalState = { ...globalState, narrative: chunk };
          notify();
        },
        (thinkingChunk) => {
          globalState = { ...globalState, thinkingTrace: thinkingChunk };
          notify();
        }
      );

      globalState = {
        ...globalState,
        ...result,
        feeds: newsFeeds,
        isProcessing: false,
        processingStatus: 'Scan Complete',
        isProcessingSection: { narrative: false, signals: false, insights: false, map: false, relations: false, bigPicture: false },
        lastUpdated: new Date()
      };

      // Store raw outputs if available
      if ((result as any).rawOutputs) {
        const rawOutputs = (result as any).rawOutputs;
        globalState = {
          ...globalState,
          rawOutputs: { ...globalState.rawOutputs, ...rawOutputs }
        };
      }

      const dates = await StorageService.getAllDates();
      globalState.availableDates = dates;

      notify();
      persist();
    } catch (error) {
      globalState = { ...globalState, isProcessing: false, processingStatus: 'Error' };
      notify();
    }
  }, []);

  const refreshFeeds = useCallback(async () => {
    if (globalState.isProcessing) return;

    globalState = {
      ...globalState,
      isProcessing: true,
      processingStatus: 'Updating Feeds...',
    };
    notify();

    try {
      const newsFeeds = await fetchLatestFeeds(globalState.currentDate);
      globalState = {
        ...globalState,
        feeds: newsFeeds,
        isProcessing: false,
        processingStatus: 'Feed Update Complete',
        lastUpdated: new Date()
      };
      notify();
      persist();
    } catch (error) {
      globalState = { ...globalState, isProcessing: false, processingStatus: 'Feed Update Failed' };
      notify();
    }
  }, []);

  const setJsonError = useCallback((error: string, sectionId: keyof SituationState['isProcessingSection'], canRetry: boolean) => {
    globalState = {
      ...globalState,
      jsonError: {
        hasError: true,
        error,
        canRetry,
        sectionId,
        retryCount: globalState.jsonError.retryCount
      }
    };
    notify();
  }, []);

  const clearJsonError = useCallback(() => {
    globalState = {
      ...globalState,
      jsonError: {
        hasError: false,
        error: '',
        canRetry: false,
        sectionId: null,
        retryCount: 0 // Reset retry count
      }
    };
    notify();
  }, []);

  const refreshSection = useCallback(async (sectionId: keyof SituationState['isProcessingSection']) => {
    if (globalState.isProcessing || globalState.isProcessingSection[sectionId] || globalState.feeds.length === 0) {
      console.log('refreshSection blocked:', { 
        isProcessing: globalState.isProcessing, 
        isProcessingSection: globalState.isProcessingSection[sectionId], 
        feedsLength: globalState.feeds.length 
      });
      return;
    }

    globalState = {
      ...globalState,
      isProcessingSection: { ...globalState.isProcessingSection, [sectionId]: true }
    };
    notify();

    try {
      const result = await processSingleSection(
        sectionId,
        globalState.feeds,
        globalState.foreignRelations,
        globalState.aiConfig,
        sectionId === 'narrative' ? (chunk: string) => {
          globalState = { ...globalState, narrative: chunk };
          notify();
        } : undefined,
        // Pass extra context for deep analysis (especially for relations)
        {
          narrative: globalState.narrative,
          signals: globalState.signals,
          insights: globalState.insights,
          bigPicture: globalState.bigPicture
        },
        // JSON error callback
        (error: string, canRetry: boolean) => {
          setJsonError(error, sectionId, canRetry);
        }
      );

      // console.log('processSingleSection result for', sectionId, ':', result);
      globalState = {
        ...globalState,
        ...result,
        isProcessingSection: { ...globalState.isProcessingSection, [sectionId]: false }
      };

      // Store raw outputs if available
      if ((result as any).rawOutputs) {
        const rawOutputs = (result as any).rawOutputs;
        // console.log('Storing raw outputs:', rawOutputs);
        globalState = {
          ...globalState,
          rawOutputs: { ...globalState.rawOutputs, ...rawOutputs }
        };
      }
      notify();
      persist();
    } catch (error) {
      console.error('refreshSection error for', sectionId, ':', error);
      globalState = { ...globalState, isProcessingSection: { ...globalState.isProcessingSection, [sectionId]: false } };
      notify();
    }
  }, [setJsonError]);

  const generateBigPicture = useCallback(async () => {
    if (globalState.isProcessing || globalState.isProcessingSection.bigPicture) return;

    globalState = {
      ...globalState,
      isProcessingSection: { ...globalState.isProcessingSection, bigPicture: true }
    };
    notify();

    try {
      const dates = await StorageService.getAllDates();
      const historyItems = await Promise.all(
        dates.map(async (date) => {
          const analysis = await StorageService.getAnalysis(date);
          return {
            date,
            narrative: analysis?.narrative || '',
            signals: analysis?.signals || [],
            insights: analysis?.insights || []
          };
        })
      );

      // Filter out days with no data
      const validHistory = historyItems.filter(h => h.narrative.length > 0);

      const result = await processBigPicture(
        validHistory,
        globalState.aiConfig,
        (chunk) => {
          // Optional: Stream the summary part if we want
        }
      );

      globalState = {
        ...globalState,
        bigPicture: {
          summary: result.summary,
          timeline: result.timeline.map((t: any) => ({
            ...t,
            sentiment: (t.sentiment || 'neutral') as Sentiment
          })),
          lastUpdated: new Date().toISOString()
        },
        isProcessingSection: { ...globalState.isProcessingSection, bigPicture: false }
      };
      notify();
      persist(); // Saved globally now
    } catch (error) {
      console.error(error);
      globalState = { ...globalState, isProcessingSection: { ...globalState.isProcessingSection, bigPicture: false } };
      notify();
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
    notify();
    persist();
  }, []);

  const removeRelation = useCallback((id: string) => {
    globalState = { ...globalState, foreignRelations: globalState.foreignRelations.filter(r => r.id !== id) };
    notify();
    persist();
  }, []);

  const fetchAvailableModels = useCallback(async () => {
    try {
      const { OllamaService } = await import('../ai/runtime/ollama');
      const models = await OllamaService.listModels();
      globalState = { ...globalState, availableModels: models };
      notify();
    } catch (e) { }
  }, []);

  const updateAiConfig = useCallback((config: Partial<AiConfig>) => {
    globalState = { ...globalState, aiConfig: { ...globalState.aiConfig, ...config } };
    notify();
    persist();
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

  const retryJsonSection = useCallback(async (sectionId: keyof SituationState['isProcessingSection']) => {
    // Clear any existing error before retrying
    clearJsonError();

    globalState = {
      ...globalState,
      isProcessingSection: {
        ...globalState.isProcessingSection,
        [sectionId]: true
      }
    };
    notify();

    try {
      await refreshSection(sectionId);
      // Success - error should already be cleared by clearJsonError() at the start
    } catch (error) {
      // If retry fails, set error state again with updated retry count
      globalState = {
        ...globalState,
        jsonError: {
          hasError: true,
          error: `Retry failed: ${error}`,
          canRetry: true,
          sectionId,
          retryCount: globalState.jsonError.retryCount + 1
        },
        isProcessingSection: {
          ...globalState.isProcessingSection,
          [sectionId]: false
        }
      };
      notify();
    }
  }, [refreshSection, clearJsonError]);

  return {
    ...state,
    refresh,
    refreshFeeds,
    refreshSection,
    generateBigPicture,
    addRelation,
    removeRelation,
    fetchAvailableModels,
    updateAiConfig,
    fetchRunningModels,
    loadDate,
    setJsonError,
    clearJsonError,
    retryJsonSection,
    updateSourceCredibility,
    upsertMetricDef,
    removeMetricDef,
    openDeepDive,
    closeDeepDive,
    generateDeepDive,
    setRawOutput,
    showRawOutput,
    hideRawOutput,
    clearSection
  };
}
