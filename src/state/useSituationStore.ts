import { useState, useCallback, useEffect } from 'react'
import { processSituation, processSingleSection, processBigPicture, cancellationTokenManager } from '../ai/runtime/engine'
import { fetchLatestFeeds, RawSignal } from '../services/feedIngest'
import { StorageService } from '../services/db'
import { zzfx } from '../utils/zzfx'
import { DEFAULT_num_ctx, DEFAULT_num_predict } from '../ai/runtime/ollama'

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

export interface PredictionHistoryItem {
  topic: string;
  date: string;
  data: {
    shortTerm: string;
    mediumTerm: string;
    longTerm: string;
  };
}

export interface AiConfig {
  model: string;
  baseUrl?: string; // Custom Ollama base URL (e.g., for tunnels or remote servers)
  numCtx: number;
  numPredict: number;
  enableThinking: boolean; // Enable thinking/reasoning trace for supported models
  sentimentProfile?: string; // ID of the sentiment profile to use
  customSentimentWeights?: Record<string, number>; // Custom sentiment weight overrides
}

export interface RunningModel {
  name: string;
  size: number;
  size_vram: number;
}

export interface AiStatus {
  isOnline: boolean;
  lastChecked: Date | null;
  lastError: string | null;
}

export type SectionKey = 'narrative' | 'signals' | 'insights' | 'map' | 'relations' | 'rss' | 'bigPicture';

export interface SectionFailureState {
  hasFailed: boolean;
  error: string;
  failedAt: Date | null;
  retryCount: number;
  lastRetryAt: Date | null;
  nextRetryAt: Date | null;
  isRetrying: boolean;
}

export interface JsonErrorState {
  hasError: boolean;
  error: string;
  canRetry: boolean;
  sectionId: keyof SituationState['isProcessingSection'] | null;
  retryCount: number;
}

export interface SectionFailureState {
  hasFailed: boolean;
  error: string;
  failedAt: Date | null;
  retryCount: number;
  lastRetryAt: Date | null;
  nextRetryAt: Date | null;
  isRetrying: boolean;
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
    rss: boolean;
    bigPicture: boolean;
  };
  completedSections: Set<string>;
  bigPicture: BigPictureData | null;
  aiConfig: AiConfig;
  availableModels: string[];
  runningModels: RunningModel[];
  aiStatus: AiStatus;
  lastUpdated: Date | null;
  jsonError: JsonErrorState;
  metricDefs: MetricDef[];
  dailyMetrics: Record<string, number>;
  deepDiveBySignalId: Record<string, DeepDiveData>;
  activeDeepDiveSignalId: string | null;
  isGeneratingDeepDive: boolean;
  rawOutputs: Record<string, string>; // Store raw AI outputs by section
  activeRawOutput: string | null; // Currently displayed raw output section
  sectionGenerationTimes: Record<string, number>; // Track generation time per section in milliseconds
  sectionFailures: Record<SectionKey, SectionFailureState>; // Track section failures and retries
  soundVolume: number; // Master volume for sound effects (0-1)
  predictionHistory: PredictionHistoryItem[];
}

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Load a date-stamped snapshot from static files
 * Attempts to load snapshot for the specific date, falls back to latest available
 */
const loadDateStampedSnapshot = async (targetDate: string): Promise<any | null> => {
  try {
    // First try to load the specific date
    const response = await fetch(`./data/snapshot-${targetDate}.json`);
    if (response.ok) {
      const snapshot = await response.json();
      console.log(`Loaded snapshot for date: ${targetDate}`);
      
      // Ensure feeds are included - if not present, create empty array
      if (!snapshot.feeds) {
        console.log('Feeds missing from snapshot, creating empty feeds array');
        snapshot.feeds = [];
      }
      
      return snapshot;
    }
  } catch (e) {
    console.warn(`Failed to load snapshot for ${targetDate}:`, e);
  }

  // If specific date not found, try to find the latest available snapshot
  try {
    // Try to fetch a directory listing (this may not work on all static hosts)
    // As a fallback, try recent dates in reverse order
    for (let i = 0; i < 30; i++) { // Check last 30 days
      const checkDate = new Date(targetDate);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      try {
        const fallbackResponse = await fetch(`./data/snapshot-${dateStr}.json`);
        if (fallbackResponse.ok) {
          const snapshot = await fallbackResponse.json();
          console.log(`Fallback: Loaded snapshot for date: ${dateStr}`);
          
          // Ensure feeds are included
          if (!snapshot.feeds) {
            console.log('Feeds missing from fallback snapshot, creating empty feeds array');
            snapshot.feeds = [];
          }
          
          return snapshot;
        }
      } catch (e) {
        // Continue to next date
      }
    }
  } catch (e) {
    console.warn('Fallback snapshot search failed:', e);
  }

  // Finally, try the legacy snapshot.json for backward compatibility
  try {
    const legacyResponse = await fetch('./data/snapshot.json');
    if (legacyResponse.ok) {
      const snapshot = await legacyResponse.json();
      console.log('Loaded legacy snapshot.json');
      
      // Ensure feeds are included
      if (!snapshot.feeds) {
        console.log('Feeds missing from legacy snapshot, creating empty feeds array');
        snapshot.feeds = [];
      }
      
      return snapshot;
    }
  } catch (e) {
    console.warn('Failed to load legacy snapshot:', e);
  }

  return null;
};

/**
 * Save snapshot to static JSON file for demo website access
 * This writes the current state to public/data/snapshot-YYYY-MM-DD.json
 */
async function saveSnapshotToFile(date: string) {
  try {
    const snapshot = {
      lastUpdated: globalState.lastUpdated?.toISOString() || new Date().toISOString(),
      narrative: globalState.narrative,
      signals: globalState.signals,
      insights: globalState.insights,
      feeds: globalState.feeds, // Include feeds for demo website!
      mapPoints: globalState.mapPoints,
      foreignRelations: globalState.foreignRelations,
      dailyMetrics: globalState.dailyMetrics,
      availableDates: globalState.availableDates,
      bigPicture: globalState.bigPicture,
      predictionHistory: globalState.predictionHistory,
      deepDiveBySignalId: globalState.deepDiveBySignalId,
      generatedAt: new Date().toISOString(),
      version: '0.2.0'
    };

    // Create blob and download via temporary link
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshot-${date}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`✅ Saved snapshot to file: snapshot-${date}.json with ${globalState.feeds.length} feeds`);
  } catch (error) {
    console.error('Failed to save snapshot to file:', error);
  }
}

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
    rss: false,
    bigPicture: false
  },
  completedSections: new Set(),
  bigPicture: null,
  thinkingTrace: '',
  aiConfig: {
    model: '',
    baseUrl: 'http://127.0.0.1:11434/api',
    numCtx: DEFAULT_num_ctx,
    numPredict: DEFAULT_num_predict,
    enableThinking: false
  },
  availableModels: [],
  runningModels: [],
  aiStatus: {
    isOnline: false,
    lastChecked: null,
    lastError: null
  },
  lastUpdated: null,
  jsonError: {
    hasError: false,
    error: '',
    canRetry: false,
    sectionId: null,
    retryCount: 0
  },

  metricDefs: [],
  dailyMetrics: {},
  deepDiveBySignalId: {},
  activeDeepDiveSignalId: null,
  isGeneratingDeepDive: false,
  rawOutputs: {},
  activeRawOutput: null,
  sectionGenerationTimes: {},
  sectionFailures: {
    narrative: { hasFailed: false, error: '', failedAt: null, retryCount: 0, lastRetryAt: null, nextRetryAt: null, isRetrying: false },
    signals: { hasFailed: false, error: '', failedAt: null, retryCount: 0, lastRetryAt: null, nextRetryAt: null, isRetrying: false },
    insights: { hasFailed: false, error: '', failedAt: null, retryCount: 0, lastRetryAt: null, nextRetryAt: null, isRetrying: false },
    map: { hasFailed: false, error: '', failedAt: null, retryCount: 0, lastRetryAt: null, nextRetryAt: null, isRetrying: false },
    relations: { hasFailed: false, error: '', failedAt: null, retryCount: 0, lastRetryAt: null, nextRetryAt: null, isRetrying: false },
    rss: { hasFailed: false, error: '', failedAt: null, retryCount: 0, lastRetryAt: null, nextRetryAt: null, isRetrying: false },
    bigPicture: { hasFailed: false, error: '', failedAt: null, retryCount: 0, lastRetryAt: null, nextRetryAt: null, isRetrying: false }
  },
  soundVolume: 0.5,
  predictionHistory: []
};

let globalState: SituationState = { ...defaultState };
const listeners = new Set<(state: SituationState) => void>();

// Module-level polling manager to prevent multiple instances
class OllamaPollingManager {
  private static instance: OllamaPollingManager | null = null;
  private pollTimeout: number | null = null;
  private currentPollTime = 2000;
  private isPolling = false;
  private pollCount = 0;
  private instanceCount = 0;

  static getInstance(): OllamaPollingManager {
    if (!OllamaPollingManager.instance) {
      OllamaPollingManager.instance = new OllamaPollingManager();
    }
    OllamaPollingManager.instance.instanceCount++;
    return OllamaPollingManager.instance;
  }

  async startPolling() {
    if (this.isPolling) {
      return;
    }
    
    this.isPolling = true;
    this.scheduleNextPoll();
  }

  private async scheduleNextPoll() {
    if (!this.isPolling) return;

    this.pollCount++;
    
    try {
      const { OllamaService } = await import('../ai/runtime/ollama');
      
      // Check if Ollama service is running by testing the /api/tags endpoint
      // This is more reliable than /api/ps which only shows models in GPU memory
      const response = await fetch(`${OllamaService.getBaseUrl()}/tags`);
      const isServiceRunning = response.ok;
      
      console.log(`Ollama service ${isServiceRunning ? 'IS running' : 'is NOT running'}`);
      
      // Update AI status based on service availability
      const wasOnline = globalState.aiStatus.isOnline;
      if (isServiceRunning && !wasOnline) {
        // Ollama service just started
        globalState = {
          ...globalState,
          aiStatus: {
            isOnline: true,
            lastChecked: new Date(),
            lastError: null
          }
        };
        console.log(`Ollama service just started`);
      } else if (!isServiceRunning && wasOnline) {
        // Ollama service just stopped
        globalState = {
          ...globalState,
          aiStatus: {
            isOnline: false,
            lastChecked: new Date(),
            lastError: 'Ollama service stopped'
          }
        };
        console.log(`Ollama service just stopped`);
      } else {
        // No change in status, but still update lastChecked time
        globalState = {
          ...globalState,
          aiStatus: {
            ...globalState.aiStatus,
            lastChecked: new Date(),
            lastError: isServiceRunning ? null : globalState.aiStatus.lastError
          }
        };
      }
      
      // Only fetch running models if service is available (for UI display)
      if (isServiceRunning) {
        try {
          const models = await OllamaService.getRunningModels();
          globalState = { ...globalState, runningModels: models };
          console.log(`${models.length} models currently in GPU memory`);
        } catch (e) {
          // Even if we can't get running models, the service is still running
          console.log(`Could not get running models, but service is available`);
        }
      } else {
        globalState = { ...globalState, runningModels: [] };
      }
      
      // Notify listeners
      listeners.forEach(l => l({ ...globalState }));
      
      // Adjust polling frequency based on service status (not model status)
      const newPollTime = isServiceRunning ? 30000 : 2000;
      if (this.currentPollTime !== newPollTime) {
        this.currentPollTime = newPollTime;
      }
      
    } catch (e) {
      const wasOnline = globalState.aiStatus.isOnline;
      console.error(`Ollama service not available. YOU DO NOT HAVE OLLAMA INSTALLED OR IT IS NOT RUNNING!`);
      
      if (wasOnline) {
        globalState = {
          ...globalState,
          runningModels: [],
          aiStatus: {
            isOnline: false,
            lastChecked: new Date(),
            lastError: e instanceof Error ? e.message : 'Connection error'
          }
        };
        listeners.forEach(l => l({ ...globalState }));
      }
      
      this.currentPollTime = 2000; // Fast polling when service is down
    }
    
    // Schedule next poll
    this.pollTimeout = setTimeout(() => this.scheduleNextPoll(), this.currentPollTime);
  }

  stopPolling() {
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    this.isPolling = false;
  }
}

/**
 * Notifies all listeners of state changes without persisting to DB.
 */
function notify() {
  listeners.forEach(l => l({ ...globalState }));
}

/**
 * Start timing for a section
 */
function startTimer(sectionId: string) {
  const now = Date.now();
  (globalState as any).timers = (globalState as any).timers || {};
  (globalState as any).timers[sectionId] = now;
}

/**
 * Stop timing for a section and record the duration
 */
function stopTimer(sectionId: string) {
  const now = Date.now();
  const startTime = (globalState as any).timers?.[sectionId];
  if (startTime) {
    const duration = now - startTime;
    globalState = {
      ...globalState,
      sectionGenerationTimes: {
        ...globalState.sectionGenerationTimes,
        [sectionId]: duration
      }
    };
    delete (globalState as any).timers[sectionId];
  }
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
  await StorageService.saveGlobal('metric_defs', globalState.metricDefs);
  await StorageService.saveGlobal('deep_dive_cache', globalState.deepDiveBySignalId);
  await StorageService.saveGlobal('sound_volume', globalState.soundVolume);
  await StorageService.saveGlobal('prediction_history', globalState.predictionHistory);
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

      const [savedCred, savedMetricDefs, savedDeepDives, savedSoundVolume, savedPredictionHistory] = await Promise.all([
        StorageService.getGlobal('source_credibility'),
        StorageService.getGlobal('metric_defs'),
        StorageService.getGlobal('deep_dive_cache'),
        StorageService.getGlobal('sound_volume'),
        StorageService.getGlobal('prediction_history')
      ]);

      if (config) {
        globalState.aiConfig = config;
        const { OllamaService } = await import('../ai/runtime/ollama');
        if (config.baseUrl) OllamaService.setBaseUrl(config.baseUrl);
      }
      if (savedBigPicture) globalState.bigPicture = savedBigPicture; // Load Global Big Picture
      if (savedMetricDefs && Array.isArray(savedMetricDefs)) globalState.metricDefs = savedMetricDefs;
      if (savedDeepDives && typeof savedDeepDives === 'object') globalState.deepDiveBySignalId = savedDeepDives;
      if (typeof savedSoundVolume === 'number' && savedSoundVolume >= 0 && savedSoundVolume <= 1) {
        globalState.soundVolume = savedSoundVolume;
      }
      if (savedPredictionHistory && Array.isArray(savedPredictionHistory)) {
        globalState.predictionHistory = savedPredictionHistory;
      }

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

      // Check for Static Mode (GitHub Pages / hosted)
      const isStatic = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

      if (isStatic) {
        console.log('Static Mode detected. Loading date-stamped snapshot...');
        try {
          // Load date-stamped snapshot for the current date
          const snapshot = await loadDateStampedSnapshot(globalState.currentDate);
          
          if (snapshot) {
            // Hydrate state with snapshot data
            // We use Object.assign to merge carefully
            Object.assign(globalState, {
              ...snapshot,
              lastUpdated: snapshot.lastUpdated ? new Date(snapshot.lastUpdated) : new Date(),
              // Ensure deepDiveBySignalId is loaded from snapshot if available
              deepDiveBySignalId: snapshot.deepDiveBySignalId || {},
              // Set a special AI status for static mode
              aiStatus: {
                isOnline: true,
                lastChecked: new Date(),
                lastError: null,
                model: 'STATIC SNAPSHOT'
              },
              // Disable processing flags
              isProcessing: false
            });

            // Ensure running models shows a placeholder
            globalState.runningModels = [{
              name: 'STATIC DATA:RO',
              size: 0,
              size_vram: 0
            }];

            console.log('Date-stamped snapshot loaded successfully');
            notify();
            return; // EXIT early - do not start polling Ollama
          }
        } catch (e) {
          console.warn('Failed to load date-stamped snapshot:', e);
        }
      }

      // Initial status will be handled by the polling manager
      // No need for a separate initial check that could cause race conditions
    };
    init();

    // Use the singleton polling manager for running models (Only if NOT in static mode)
    const isStatic = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (!isStatic) {
      const pollingManager = OllamaPollingManager.getInstance();
      pollingManager.startPolling();

      return () => {
        listeners.delete(setState);
        pollingManager.stopPolling();
      };
    } else {
      return () => {
        listeners.delete(setState);
      };
    }
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

  const regenerateDeepDive = useCallback(async (signalId: string) => {
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

  const clearSection = useCallback((sectionId: SectionKey) => {
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

  const setSectionFailure = useCallback((sectionId: SectionKey, error: string) => {
    const now = new Date();
    const retryDelay = Math.min(1000 * Math.pow(2, globalState.sectionFailures[sectionId].retryCount), 30000); // Max 30 seconds
    const nextRetryAt = new Date(now.getTime() + retryDelay);

    globalState = {
      ...globalState,
      sectionFailures: {
        ...globalState.sectionFailures,
        [sectionId]: {
          hasFailed: true,
          error,
          failedAt: now,
          retryCount: globalState.sectionFailures[sectionId].retryCount + 1,
          lastRetryAt: null,
          nextRetryAt,
          isRetrying: false
        }
      }
    };
    notify();
  }, []);

  const clearSectionFailure = useCallback((sectionId: SectionKey) => {
    globalState = {
      ...globalState,
      sectionFailures: {
        ...globalState.sectionFailures,
        [sectionId]: {
          hasFailed: false,
          error: '',
          failedAt: null,
          retryCount: 0,
          lastRetryAt: null,
          nextRetryAt: null,
          isRetrying: false
        }
      }
    };
    notify();
  }, []);

  // Auto-retry mechanism for failed sections - moved after refreshSection definition
  // This will be defined later after refreshSection is declared

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

    // Check if we're in static mode
    const isStatic = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    // Cache current relation defs to prevent overwriting them with historical snapshots
    const currentDefs = await StorageService.getGlobal('relation_defs');
    const currentBigPicture = globalState.bigPicture;

    globalState.currentDate = dateStr;

    if (isStatic) {
      // In static mode, try to load date-stamped snapshot
      console.log(`Static mode: Loading snapshot for date ${dateStr}`);
      const snapshot = await loadDateStampedSnapshot(dateStr);
      
      if (snapshot) {
        Object.assign(globalState, {
          ...snapshot,
          lastUpdated: snapshot.lastUpdated ? new Date(snapshot.lastUpdated) : new Date(),
          deepDiveBySignalId: snapshot.deepDiveBySignalId || {},
          // Preserve static mode settings
          aiStatus: {
            isOnline: true,
            lastChecked: new Date(),
            lastError: null,
            model: 'STATIC SNAPSHOT'
          },
          isProcessing: false
        });

        // Ensure running models shows a placeholder
        globalState.runningModels = [{
          name: 'STATIC DATA:RO',
          size: 0,
          size_vram: 0
        }];

        // RESTORE Global Big Picture if we want it to be truly global
        if (currentBigPicture) globalState.bigPicture = currentBigPicture;

        if (!globalState.dailyMetrics) globalState.dailyMetrics = {};

        notify();
        return;
      } else {
        console.log(`No snapshot found for date ${dateStr}, showing empty state`);
        // Set empty state for dates without snapshots
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
        notify();
        return;
      }
    }

    // Normal mode: Load from database
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

    // Cancel all existing jobs before starting full processing
    const runningJobs = cancellationTokenManager.getRunningJobs();
    if (runningJobs.length > 0) {
      console.log(`Cancelling ${runningJobs.length} existing jobs before full refresh`);
      cancellationTokenManager.cancelAll();
    }

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
      isProcessingSection: { rss: true, narrative: false, signals: false, insights: false, map: false, relations: false, bigPicture: false },
      completedSections: new Set() // Reset completed sections
    };
    startTimer('full-scan');
    startTimer('rss');
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
        },
        (section: string) => {
          const sectionOrder: (keyof SituationState['isProcessingSection'])[] = ['rss', 'narrative', 'signals', 'insights', 'map', 'relations'];
          const typedSection = section as keyof SituationState['isProcessingSection'];
          const currentIndex = sectionOrder.indexOf(typedSection);

          // Mark current section as completed
          globalState = {
            ...globalState,
            completedSections: new Set([...globalState.completedSections, section])
          };
          stopTimer(section);

          // Update processing state: mark current as false, next as true
          const newProcessingState = { ...globalState.isProcessingSection };
          newProcessingState[typedSection] = false;

          if (currentIndex < sectionOrder.length - 1) {
            const nextSection = sectionOrder[currentIndex + 1];
            newProcessingState[nextSection] = true;
            startTimer(nextSection);
          }

          globalState = { ...globalState, isProcessingSection: newProcessingState };
          notify();
        }
      );

      globalState = {
        ...globalState,
        ...result,
        feeds: newsFeeds,
        isProcessing: false,
        processingStatus: 'Scan Complete',
        isProcessingSection: { narrative: false, signals: false, insights: false, map: false, relations: false, rss: false, bigPicture: false },
        lastUpdated: new Date()
      };

      stopTimer('full-scan');

      // Play completion sound effect for full scan
      if (globalState.soundVolume > 0) {
        zzfx.setMasterVolume(globalState.soundVolume);
        zzfx.playCompletion();
      }

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
      stopTimer('full-scan');
      ['narrative', 'signals', 'insights', 'map', 'relations'].forEach(stopTimer);
      globalState = { ...globalState, isProcessing: false, processingStatus: 'Error' };

      // Check if this was a cancellation
      if (error instanceof Error && error.message.includes('Processing cancelled')) {
        console.log('Full processing was cancelled by user');
        globalState = { ...globalState, processingStatus: 'Cancelled' };
      }

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

  const refreshSection = useCallback(async (sectionId: keyof SituationState['isProcessingSection'], force: boolean = false) => {
    // console.log(`refreshSection called for ${sectionId}`, {
    //   isProcessing: globalState.isProcessing,
    //   isProcessingSection: globalState.isProcessingSection[sectionId],
    //   feedsLength: globalState.feeds.length,
    //   runningJobs: cancellationTokenManager.getRunningJobs(),
    //   force
    // });

    if (globalState.isProcessing || globalState.feeds.length === 0) {
      // console.log('refreshSection blocked:', {
      //   isProcessing: globalState.isProcessing,
      //   feedsLength: globalState.feeds.length
      // });
      return;
    }

    // If not forced and section is already processing, don't proceed
    if (!force && globalState.isProcessingSection[sectionId]) {
      // console.log('refreshSection blocked: section already processing', {
      //   sectionId,
      //   isProcessingSection: globalState.isProcessingSection[sectionId]
      // });
      return;
    }

    // Cancel any existing job for this section FIRST
    const runningJobs = cancellationTokenManager.getRunningJobs();
    const sectionJobs = runningJobs.filter(jobId => jobId.includes(`section-${sectionId}-`));

    // console.log(`Found ${sectionJobs.length} jobs for section ${sectionId}:`, sectionJobs);

    if (sectionJobs.length > 0) {
      // console.log(`Cancelling ${sectionJobs.length} existing jobs for section ${sectionId}`);
      sectionJobs.forEach(jobId => cancellationTokenManager.cancelJob(jobId));

      // Force-clear the processing state for this section
      globalState = {
        ...globalState,
        isProcessingSection: { ...globalState.isProcessingSection, [sectionId]: false }
      };
      stopTimer(sectionId);
      notify();

      // Give a brief moment for cancellation to take effect
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Now check if section is still processing (after cancellation attempt)
    if (globalState.isProcessingSection[sectionId]) {
      console.log('Section still processing after cancellation attempt:', {
        sectionId,
        isProcessingSection: globalState.isProcessingSection[sectionId]
      });
      return;
    }

    globalState = {
      ...globalState,
      isProcessingSection: { ...globalState.isProcessingSection, [sectionId]: true }
    };
    startTimer(sectionId);
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
          signalsText: globalState.signals?.map((s: any) => `- ${s.text} [Sentiment: ${s.sentiment}]`).join('\n') || '',
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

      stopTimer(sectionId);

      // Play completion sound effect
      if (globalState.soundVolume > 0) {
        zzfx.setMasterVolume(globalState.soundVolume);

        // Special sound for Signals section
        if (sectionId === 'signals' && globalState.signals.length > 0) {
          // Play pings for number of signals (max 5 to avoid being too long)
          const pingCount = globalState.signals.length; //Math.min(globalState.signals.length, 5);
          if (pingCount > 1) {
            zzfx.playMultiplePings(pingCount);
          } else {
            zzfx.playCompletion();
          }
        } else {
          zzfx.playCompletion();
        }
      }

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
      stopTimer(sectionId);
      globalState = { ...globalState, isProcessingSection: { ...globalState.isProcessingSection, [sectionId]: false } };

      // Check if this was a cancellation - don't set failure state for cancellations
      if (error instanceof Error && error.message.includes('Processing cancelled')) {
        console.log(`Section ${sectionId} processing was cancelled by user`);
        notify();
        return;
      }

      // Set failure state for this section
      setSectionFailure(sectionId as SectionKey, String(error));
      notify();
    }
  }, [setJsonError]);

  const generateBigPicture = useCallback(async () => {
    if (globalState.isProcessing || globalState.isProcessingSection.bigPicture) return;

    // Cancel any existing big picture job
    const runningJobs = cancellationTokenManager.getRunningJobs();
    const bigPictureJobs = runningJobs.filter(jobId => jobId.includes('big-picture-'));

    if (bigPictureJobs.length > 0) {
      console.log(`Cancelling ${bigPictureJobs.length} existing big picture jobs`);
      bigPictureJobs.forEach(jobId => cancellationTokenManager.cancelJob(jobId));
    }

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

      // Check if this was a cancellation
      if (error instanceof Error && error.message.includes('Processing cancelled')) {
        console.log('Big picture processing was cancelled by user');
      }

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

  const updateAiConfig = useCallback(async (config: Partial<AiConfig>) => {
    globalState = { ...globalState, aiConfig: { ...globalState.aiConfig, ...config } };
    if (config.baseUrl) {
      const { OllamaService } = await import('../ai/runtime/ollama');
      OllamaService.setBaseUrl(config.baseUrl);
    }
    notify();
    persist();
  }, []);

  const retryFailedSection = useCallback(async (sectionId: SectionKey) => {
    const failure = globalState.sectionFailures[sectionId];
    if (!failure.hasFailed || failure.isRetrying) return;

    // Update failure state to show we're retrying
    globalState = {
      ...globalState,
      sectionFailures: {
        ...globalState.sectionFailures,
        [sectionId]: {
          ...failure,
          isRetrying: true,
          lastRetryAt: new Date()
        }
      }
    };
    notify();

    try {
      await refreshSection(sectionId, true);
      // Success - clear the failure
      clearSectionFailure(sectionId);
    } catch (error) {
      // Retry failed - update failure state
      const now = new Date();
      const retryDelay = Math.min(1000 * Math.pow(2, failure.retryCount + 1), 30000);
      const nextRetryAt = new Date(now.getTime() + retryDelay);

      globalState = {
        ...globalState,
        sectionFailures: {
          ...globalState.sectionFailures,
          [sectionId]: {
            ...failure,
            error: `Retry failed: ${error}`,
            retryCount: failure.retryCount + 1,
            lastRetryAt: now,
            nextRetryAt,
            isRetrying: false
          }
        }
      };
      notify();
    }
  }, [refreshSection, clearSectionFailure]);

  const fetchAiStatus = useCallback(async () => {
    try {
      const { OllamaService } = await import('../ai/runtime/ollama');
      const [models, running] = await Promise.all([
        OllamaService.listModels(),
        OllamaService.getRunningModels()
      ]);

      globalState = {
        ...globalState,
        availableModels: models,
        runningModels: running,
        aiStatus: {
          isOnline: true,
          lastChecked: new Date(),
          lastError: null
        }
      };
      listeners.forEach(l => l({ ...globalState }));
    } catch (error) {
      globalState = {
        ...globalState,
        aiStatus: {
          isOnline: false,
          lastChecked: new Date(),
          lastError: error instanceof Error ? error.message : 'Unknown error'
        }
      };
      listeners.forEach(l => l({ ...globalState }));
    }
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
      await refreshSection(sectionId, true);
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

  const setSoundVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    globalState = { ...globalState, soundVolume: clampedVolume };
    notify();
    persist();
  }, []);

  const setPredictionHistory = useCallback((history: PredictionHistoryItem[]) => {
    globalState = { ...globalState, predictionHistory: history };
    notify();
    persist();
  }, []);

  const exportSnapshot = useCallback(async () => {
    try {
      console.log('🔍 Export Debug - Current feeds:', globalState.feeds);
      console.log('🔍 Export Debug - Feeds length:', globalState.feeds?.length || 0);
      console.log('🔍 Export Debug - Current date:', globalState.currentDate);
      
      const snapshot = {
        lastUpdated: globalState.lastUpdated?.toISOString() || new Date().toISOString(),
        narrative: globalState.narrative,
        signals: globalState.signals,
        insights: globalState.insights,
        feeds: globalState.feeds, // Include feeds!
        mapPoints: globalState.mapPoints,
        foreignRelations: globalState.foreignRelations,
        dailyMetrics: globalState.dailyMetrics,
        availableDates: globalState.availableDates,
        bigPicture: globalState.bigPicture,
        predictionHistory: globalState.predictionHistory,
        deepDiveBySignalId: globalState.deepDiveBySignalId,
        generatedAt: new Date().toISOString(),
        version: '0.2.0'
      };

      console.log('🔍 Export Debug - Snapshot feeds count:', snapshot.feeds?.length || 0);

      // Create blob and download
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snapshot-${globalState.currentDate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`Exported snapshot with ${globalState.feeds?.length || 0} feeds`);
    } catch (error) {
      console.error('Failed to export snapshot:', error);
    }
  }, []);

  // Auto-retry mechanism for failed sections
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      let hasUpdates = false;

      Object.entries(globalState.sectionFailures).forEach(([sectionId, failure]) => {
        if (failure.hasFailed && !failure.isRetrying && failure.nextRetryAt && now >= failure.nextRetryAt) {
          // Time to retry this section
          retryFailedSection(sectionId as SectionKey);
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        notify();
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [retryFailedSection]);

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
    loadDate,
    setJsonError,
    clearJsonError,
    retryJsonSection,
    upsertMetricDef,
    removeMetricDef,
    openDeepDive,
    closeDeepDive,
    generateDeepDive,
    regenerateDeepDive,
    setRawOutput,
    showRawOutput,
    hideRawOutput,
    clearSection,
    setSoundVolume,
    sectionGenerationTimes: globalState.sectionGenerationTimes,
    sectionFailures: globalState.sectionFailures,
    setSectionFailure,
    clearSectionFailure,
    retryFailedSection,
    setPredictionHistory,
    exportSnapshot,
    isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  };
}
