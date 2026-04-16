
import { OllamaService } from './ollama';
import { LMStudioService, LMStudioMessage } from './lmstudio';
import { RawSignal } from '../../services/feedIngest';
import type { ForeignRelation, AiConfig, DeepDiveData, NarrativePredictionsData, SourceRef, Signal, SituationState } from '../../state/useSituationStore';
import { StorageService } from '../../services/db';
import { getSentimentProfile, generateCustomSentimentGuidelines } from './sentimentEngine';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Service wrapper functions that route to the appropriate backend based on provider
function getOptionsForProvider(aiConfig: AiConfig, signal?: AbortSignal) {
  if (aiConfig.provider === 'lmstudio') {
    return {
      max_tokens: aiConfig.maxTokens || aiConfig.numPredict || 16384,
      temperature: 0,
      signal,
      // LM Studio doesn't accept num_ctx per request, but we pass it for prompt truncation
      contextWindow: aiConfig.numCtx || 32000
    };
  }
  // Ollama default
  return {
    num_ctx: aiConfig.numCtx,
    num_predict: aiConfig.numPredict,
    temperature: 0,
    signal
  };
}

async function generateWithProvider(
  aiConfig: AiConfig,
  prompt: string,
  format?: 'json',
  systemPrompt?: string
): Promise<string> {
  const options = getOptionsForProvider(aiConfig);
  
  if (aiConfig.provider === 'lmstudio') {
    // For LM Studio with limited context, use simpler prompts for JSON
    let finalPrompt = prompt;
    
    // If JSON format and prompt is very long, truncate aggressively
    if (format === 'json' && prompt.length > 2000) {
      // Keep only essential parts - instructions and minimal context
      const lines = prompt.split('\n');
      const essentialLines = lines.slice(0, 50); // Keep first 50 lines
      finalPrompt = essentialLines.join('\n') + '\n\n[Context truncated due to size limit]\n';
    }
    
    // For JSON format, add strong instruction to the system prompt
    const finalSystemPrompt = format === 'json' 
      ? `${systemPrompt || ''}\n\nCRITICAL: You MUST respond with ONLY valid JSON. No markdown, no explanations, no text outside the JSON.`.trim()
      : systemPrompt;
    
    const result = await LMStudioService.generate(aiConfig.model, finalPrompt, finalSystemPrompt, options);
    
    // If empty result for JSON, log warning
    if (format === 'json' && (!result || result.trim() === '')) {
      console.warn('LM Studio returned empty response for JSON request. Context may be insufficient.');
    }
    
    return result;
  }
  
  return OllamaService.generate(aiConfig.model, prompt, format, options);
}

async function streamGenerateWithProvider(
  aiConfig: AiConfig,
  prompt: string,
  onChunk: (text: string) => void,
  systemPrompt?: string
): Promise<void> {
  const options = getOptionsForProvider(aiConfig);
  
  if (aiConfig.provider === 'lmstudio') {
    return LMStudioService.streamGenerate(aiConfig.model, prompt, onChunk, systemPrompt, options);
  }
  
  return OllamaService.streamGenerate(aiConfig.model, prompt, onChunk, options);
}

async function generateWithThinkingWithProvider(
  aiConfig: AiConfig,
  prompt: string,
  systemPrompt?: string
): Promise<{ response: string; thinking?: string }> {
  const options = getOptionsForProvider(aiConfig);
  
  if (aiConfig.provider === 'lmstudio') {
    return LMStudioService.generateWithThinking(aiConfig.model, prompt, systemPrompt, options);
  }
  
  return OllamaService.generateWithThinking(aiConfig.model, prompt, options);
}

async function streamGenerateWithThinkingWithProvider(
  aiConfig: AiConfig,
  prompt: string,
  onThinking: (text: string) => void,
  onContent: (text: string) => void,
  systemPrompt?: string
): Promise<void> {
  const options = getOptionsForProvider(aiConfig);
  
  if (aiConfig.provider === 'lmstudio') {
    return LMStudioService.streamGenerateWithThinking(aiConfig.model, prompt, onThinking, onContent, systemPrompt, options);
  }
  
  return OllamaService.streamGenerateWithThinking(aiConfig.model, prompt, onThinking, onContent, options);
}

async function chatWithProvider(
  aiConfig: AiConfig,
  messages: { role: string; content: string }[],
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const options = getOptionsForProvider(aiConfig, signal);
  
  if (aiConfig.provider === 'lmstudio') {
    const lmMessages: LMStudioMessage[] = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content
    }));
    return LMStudioService.streamChat(aiConfig.model, lmMessages, onChunk, options);
  }
  
  return OllamaService.chat(aiConfig.model, messages, onChunk, options);
}

const CATEGORY_MAP: Record<string, string> = {
  'narrative': 'narrative briefing',
  'signals': 'delta signals',
  'insights': 'hidden insights',
  'map': 'map coordinates',
  'relations': 'relation trackers',
  'bigPicture': 'grand strategy analysis'
};



// Global cancellation token manager
class CancellationTokenManager {
  private controllers = new Map<string, AbortController>();

  // Create a new controller for a given job ID
  createController(jobId: string): AbortController {
    // Cancel any existing job with the same ID
    this.cancelJob(jobId);

    const controller = new AbortController();
    this.controllers.set(jobId, controller);
    return controller;
  }

  // Cancel a specific job
  cancelJob(jobId: string): boolean {
    const controller = this.controllers.get(jobId);
    if (controller) {
      controller.abort();
      this.controllers.delete(jobId);
      console.log(`Cancelled AI job: ${jobId}`);
      return true;
    }
    return false;
  }

  // Cancel all jobs
  cancelAll(): void {
    for (const [jobId, controller] of this.controllers) {
      controller.abort();
      console.log(`Cancelled AI job: ${jobId}`);
    }
    this.controllers.clear();
  }

  // Check if a job is currently running
  isJobRunning(jobId: string): boolean {
    return this.controllers.has(jobId);
  }

  // Get list of running job IDs
  getRunningJobs(): string[] {
    return Array.from(this.controllers.keys());
  }

  // Clean up completed job
  cleanupJob(jobId: string): void {
    this.controllers.delete(jobId);
  }
}

// Global instance
export const cancellationTokenManager = new CancellationTokenManager();

async function getRecentSignalsForNovelty(days: number = 7): Promise<string[]> {
  try {
    const dates = await StorageService.getAllDates();
    const recentDates = dates.slice(-days).reverse();
    const signals: string[] = [];
    for (const date of recentDates) {
      const analysis = await StorageService.getAnalysis(date);
      if (analysis && Array.isArray(analysis.signals)) {
        for (const s of analysis.signals) {
          const text = typeof s === 'string' ? s : (s?.text ? String(s.text) : '');
          if (text) signals.push(text);
        }
      }
    }
    return signals;
  } catch (e) {
    return [];
  }
}

function generateFeedIndex(feeds: RawSignal[]) {
  return feeds.map((f, idx) => ({
    feedId: String(idx), // Use simple numeric index for AI citation reliability
    source: f.source,
    title: f.title,
    // link purposely omitted to prevent hallucination
    timestamp: f.timestamp,
    category: f.category
  }));
}


async function getHistoricalRelationsContext(foreignRelations: ForeignRelation[]): Promise<string> {
  try {
    const dates = await StorageService.getAllDates();
    let historicalContext = '';

    // Get the last 7 days of historical data for context
    const recentDates = dates.slice(-7).reverse();

    for (const date of recentDates) {
      const analysis = await StorageService.getAnalysis(date);
      if (analysis && analysis.foreignRelations && analysis.foreignRelations.length > 0) {
        historicalContext += `DATE: ${date}\n`;
        analysis.foreignRelations.forEach((rel: any) => {
          // Only include relations that match current trackers
          const currentRel = foreignRelations.find(r =>
            r.id === rel.id ||
            (r.countryA.toLowerCase() === rel.countryA.toLowerCase() && r.countryB.toLowerCase() === rel.countryB.toLowerCase())
          );
          if (currentRel) {
            historicalContext += `- ${rel.countryA} vs ${rel.countryB} (${rel.topic}): ${rel.status} [${rel.sentiment}]\n`;
          }
        });
        historicalContext += '\n';
      }
    }

    return historicalContext.trim();
  } catch (error) {
    console.error('Error getting historical context:', error);
    return '';
  }
}

export async function processSituation(
  feeds: RawSignal[],
  foreignRelations: ForeignRelation[] = [],
  aiConfig: AiConfig,
  bigPicture: any = null,
  onProgress?: (status: string) => void,
  onNarrativeChunk?: (chunk: string) => void,
  onThinkingChunk?: (chunk: string) => void,
  onSectionComplete?: (section: string) => void
): Promise<Partial<SituationState>> {
  // Create a unique job ID for full processing
  const jobId = `full-process-${Date.now()}`;

  // Create cancellation controller for this job
  const controller = cancellationTokenManager.createController(jobId);

  try {
    // Use context limit based on aiConfig.numCtx for LM Studio (default 60000 for Ollama)
    const maxContextChars = aiConfig.provider === 'lmstudio' 
      ? Math.min((aiConfig.numCtx || 8192) * 2, 15000)  // ~2 chars per token, cap at 15000
      : 60000;
    const context = generateContext(feeds, maxContextChars);
    const feedIndex = generateFeedIndex(feeds);

    try {
      onProgress?.(`Generating ${CATEGORY_MAP.narrative}...`);
      const narrativePrompt = generateNarrativePrompt(context, aiConfig);

      let narrative = '';
      let thinkingTrace = '';

      if (aiConfig.enableThinking) {
        // Use thinking-enabled streaming for narrative
        onProgress?.(`Deep reasoning (thinking mode)...`);
        console.log('[Narrative] Using thinking mode for', aiConfig.provider);
        await streamGenerateWithThinkingWithProvider(
          aiConfig,
          narrativePrompt,
          (thinkChunk) => {
            thinkingTrace += thinkChunk;
            onThinkingChunk?.(thinkingTrace);
          },
          (contentChunk) => {
            narrative += contentChunk;
            onNarrativeChunk?.(narrative);
          }
        );
      } else if (onNarrativeChunk && aiConfig.provider !== 'lmstudio') {
        // Use streaming for Ollama only - LM Studio has streaming format issues
        console.log('[Narrative] Using streaming mode for Ollama');
        await streamGenerateWithProvider(aiConfig, narrativePrompt, (chunk) => {
          narrative += chunk;
          onNarrativeChunk(narrative);
        });
      } else {
        // Non-streaming for LM Studio or when no narrative chunk callback
        console.log('[Narrative] Using non-streaming mode for', aiConfig.provider);
        narrative = await generateWithProvider(aiConfig, narrativePrompt);
        console.log('[Narrative] Result length:', narrative?.length, 'First 100 chars:', narrative?.substring(0, 100));
        if (onNarrativeChunk) onNarrativeChunk(narrative);
      }

      onSectionComplete?.('narrative');
      onProgress?.(`Generating ${CATEGORY_MAP.signals}...`);
      const recentSignals = await getRecentSignalsForNovelty(7);
      const signalsRaw = await generateWithProvider(aiConfig, generateSignalsPrompt(context, feedIndex, recentSignals, aiConfig), 'json');
      
      // Debug: Log raw AI output
      // console.log('=== RAW SIGNALS OUTPUT ===');
      // console.log('Raw string:', signalsRaw);
      
      const parsedJson = parseJsonArray(signalsRaw);
      // console.log('Parsed JSON:', JSON.stringify(parsedJson, null, 2));
      
      const parsedSignals = applyNoveltyScores(finalizeSignals(parsedJson, feeds), recentSignals);
      console.log('Final processed signals:', JSON.stringify(parsedSignals.map(s => ({ 
        title: s.title, 
        text: s.text?.substring(0, 50), 
        sentiment: s.sentiment,
        sourceCount: s.source?.length 
      })), null, 2));
      console.log('===========================');
      
      const signalsText = parsedSignals.map((s: any) => `- ${s.text} [Sentiment: ${s.sentiment}]`).join('\n');

      onSectionComplete?.('signals');
      onProgress?.(`Identifying ${CATEGORY_MAP.insights}...`);
      const insightsRaw = await generateWithProvider(aiConfig, generateInsightsPrompt(context, feedIndex, signalsText, parsedSignals, aiConfig), 'json');

      onSectionComplete?.('insights');
      onProgress?.(`Triangulating ${CATEGORY_MAP.map}...`);
      const mapPointsRaw = await generateWithProvider(aiConfig, generateMapPointsPrompt(context, signalsText, aiConfig), 'json');

      onSectionComplete?.('map');
      onProgress?.(`Updating ${CATEGORY_MAP.relations}...`);
      const historicalContext = await getHistoricalRelationsContext(foreignRelations);
      const relationsRaw = await generateWithProvider(aiConfig, generateRelationsPrompt(context, foreignRelations, narrative, parsedSignals, finalizeInsights(parseJsonArray(insightsRaw)), bigPicture, historicalContext, aiConfig), 'json');

      onSectionComplete?.('relations');

      return {
        narrative: finalizeNarrative(narrative),
        thinkingTrace: thinkingTrace.trim(),
        signals: parsedSignals,
        insights: finalizeInsights(parseJsonArray(insightsRaw), feeds),
        mapPoints: finalizeMapPoints(parseJsonArray(mapPointsRaw), parsedSignals),
        foreignRelations: finalizeRelations(parseJsonArray(relationsRaw), foreignRelations),
        rawOutputs: {
          narrative: narrative,
          signals: signalsRaw,
          insights: insightsRaw,
          map: mapPointsRaw,
          relations: relationsRaw
        }
      };
    } catch (error) {
      return handleProcessError(error);
    }

  } catch (error) {
    // Check if this was a cancellation
    if (error instanceof Error && (
      error.message.includes('cancelled') ||
      error.message.includes('AbortError') ||
      error.name === 'AbortError'
    )) {
      console.log('Full situation processing was cancelled');
      throw new Error('Processing cancelled');
    }

    // Re-throw other errors
    throw error;
  } finally {
    // Always clean up the controller when done
    cancellationTokenManager.cleanupJob(jobId);
  }
}

export async function processBigPicture(
  history: any[],
  aiConfig: AiConfig,
  onStream?: (chunk: string) => void
) {
  // Create a unique job ID for big picture processing
  const jobId = `big-picture-${Date.now()}`;

  // Create cancellation controller for this job
  const controller = cancellationTokenManager.createController(jobId);

  try {
    // Construct context for the Grand Narrative
    const context = history.map(h => `DATE: ${h.date}\nSUMMARY: ${h.narrative}\nSIGNALS: ${h.signals.length} detected.`).join('\n\n');

    // 1. Construct Timeline PRECISELY from existing history (Deterministic)
    const timeline = history.map((h: any) => {
      // deduce sentiment from signals if available
      let sentiment = 'neutral';
      if (h.signals && h.signals.length > 0) {
        // Simple heuristic: if any signal is negative, the day is negative
        const neg = h.signals.find((s: any) => s.sentiment.includes('negative'));
        if (neg) sentiment = neg.sentiment;
      }

      // formatting title/summary from narrative
      let title = 'Situation Report';
      let summaryStr = h.narrative || '';

      // Try to extract a headline if the narrative starts with one
      const lines = summaryStr
        .split("\n")
        .filter((l: string) => l.trim().length > 0);
      if (lines.length > 0) {
        title = lines[0].replace(/[*#]/g, "").trim();
        summaryStr = lines.slice(1).join(" ");
      }

      return {
        date: h.date,
        title: title,
        summary: summaryStr,
        sentiment: sentiment
      };
    }).sort((a: any, b: any) => a.date.localeCompare(b.date));

    // 2. Generate Grand Narrative
    // Get custom sentiment guidelines if profile is specified
    let sentimentGuidance = '';
    if (aiConfig.sentimentProfile) {
      const profile = getSentimentProfile(aiConfig.sentimentProfile);
      sentimentGuidance = `\n\nSENTIMENT ANALYSIS FRAMEWORK:\nWhen analyzing historical events and their trajectory, interpret them through the following lens:\n${generateCustomSentimentGuidelines(profile)}\n\nApply this framework when assessing the significance, tone, and trajectory of events in your Grand Narrative.`;
    }

    const bigPicturePrompt = `
Based on the following historical data of daily briefings, write a "Grand Narrative" that explains the overall trajectory of world events.
Focus on the connections between days, the escalation of tensions, or the resolution of conflicts.
This should be a high-level strategic overview, not a day-by-day recount.
Identify the "Meta-Narrative" - what is the big story happening underneath the noise?${sentimentGuidance} 

HISTORY:
${context}
`;

    let summary = '';
    if (onStream) {
      await streamGenerateWithProvider(aiConfig, bigPicturePrompt, (chunk) => {
        summary += chunk;
        onStream(chunk);
      });
    } else {
      summary = await generateWithProvider(aiConfig, bigPicturePrompt);
    }

    return {
      summary: finalizeNarrative(summary),
      timeline: timeline
    };

  } catch (error) {
    // Check if this was a cancellation
    if (error instanceof Error && (
      error.message.includes('cancelled') ||
      error.message.includes('AbortError') ||
      error.name === 'AbortError'
    )) {
      console.log('Big picture processing was cancelled');
      throw new Error('Processing cancelled');
    }

    // Re-throw other errors
    throw error;
  } finally {
    // Always clean up the controller when done
    cancellationTokenManager.cleanupJob(jobId);
  }
}

function selectRelevantFeeds(signal: Signal, feeds: RawSignal[]) {
  const wantedIds = new Set((signal.source || []).map(e => e.feedId).filter(Boolean));

  const scored = feeds
    .map(f => {
      const baseText = `${f.title || ''} ${f.content || ''}`.toLowerCase();
      const score = calculateTextSimilarity(String(signal.text || '').toLowerCase(), baseText);
      return { f, score };
    })
    .sort((a, b) => b.score - a.score);

  const selected: RawSignal[] = [];
  const seen = new Set<string>();

  // First, try to match by actual feedId from signal.source
  for (const feed of feeds) {
    if (wantedIds.has(feed.id) && !seen.has(feed.id)) {
      selected.push(feed);
      seen.add(feed.id);
    }
  }

  // Then add remaining feeds by similarity score - LIMIT TO 6 for DeepDive
  for (const { f } of scored) {
    if (selected.length >= 6) break; // Reduced from 12 to 6
    if (seen.has(f.id)) continue;
    selected.push(f);
    seen.add(f.id);
  }

  return selected;
}

function generateDeepDivePrompt(signal: Signal, feedsSubset: RawSignal[], dateStr: string, aiConfig?: AiConfig) {
  // Use aggressive truncation to stay under 9,000 byte limit
  const maxContentLength = 600; // Further reduced
  const maxTotalChars = 6000; // Much smaller to stay safe
  
  let feedContent = '';
  for (const f of feedsSubset) {
    const sourceTag = `[${f.source}]`;
    const titleTag = f.title ? `${f.title}. ` : '';
    
    let content = f.content || '';
    if (content.length > maxContentLength) {
      content = content.substring(0, maxContentLength) + '... [truncated]';
    }
    
    const itemText = `${sourceTag} ${titleTag}${content}\n\n`;
    
    if ((feedContent.length + itemText.length) > maxTotalChars) {
      feedContent += `... [Further feeds omitted due to context limit]`;
      break;
    }
    
    feedContent += itemText;
  }

  // Create minimal signal representation to save space
  const minimalSignal = {
    id: signal.id,
    title: signal.title,
    text: signal.text,
    sentiment: signal.sentiment,
    deltaType: signal.deltaType,
    category: signal.category
  };

  // Get custom sentiment guidelines if profile is specified
  let customGuidelines = '';
  if (aiConfig?.sentimentProfile) {
    const profile = getSentimentProfile(aiConfig.sentimentProfile);
    customGuidelines = `\n\nSENTIMENT GUIDELINES:\n${generateCustomSentimentGuidelines(profile)}\n\nWhen analyzing the signal and determining sentiment, apply these guidelines consistently.`;
  }

  // Use optimized prompt for regular JSON generation
  return `You are an elite intelligence analyst.
Generate a comprehensive Deep Dive analysis for the provided Signal.

CRITICAL JSON REQUIREMENTS:
- Return ONLY strict JSON. No markdown. No prose outside JSON.
- All strings must be valid JSON strings.
- If a field is unknown, omit it (do NOT use null).

DATE: ${dateStr}

SIGNAL:
${JSON.stringify(minimalSignal)}

FEED CONTENT:
${feedContent}${customGuidelines}

Return EXACTLY one JSON object with this shape:
{
  "signalId": string,
  "header": {
    "title": string,
    "text": string,
    "sentiment": string,
    "deltaType": string,
    "category": string
  },
  "fiveWs": {
    "who": string[],
    "what": string,
    "where": string,
    "when": string,
    "why": string,
    "soWhat": string
  },
  "source": [
    { "feedId": string, "source": string, "title": string, "timestamp": string, "quote": string }
  ],
  "counterpoints": [
    { "claimA": string, "claimB": string, "sourceA": array, "sourceB": array }
  ],
  "watchNext": string[]
}

Rules:
- Use provided FEED CONTENT as source material
- Include relevant quotes from feed content in your analysis
- watchNext should be PREDICTIVE ANALYSIS about what might happen next - NOT URLs, NOT links, NOT example.com placeholders. Think like an intelligence analyst forecasting likely next developments.`;

/*
{
  "signalId": "sig_872a24e9",
  "header": {
    "title": "Friendly Fire Incident Grounds US Fleet in Kuwait",
    "text": "Multiple reports confirm six US F-15 fighter jets were 'mistakenly shot down' by air defenses, with crews recovering safely but raising questions about regional radar safety protocols during the conflict.",
    "sentiment": "very-negative",
    "deltaType": "escalation",
    "category": "Other"
  },
  "fiveWs": {
    "who": ["US military", "Kuwaiti air defenses"],
    "what": "Six US F-15 fighter jets were mistakenly shot down by Kuwaiti air defenses during a military operation.",
    "where": "Kuwait",
    "when": "2026-03-02",
    "why": "The incident raises concerns about radar safety protocols and potential misidentification of friendly aircraft during the conflict.",
    "soWhat": "The friendly fire incident could impact US military operations in the region and prompt a review of air defense systems."
  },
  "source": [
    {
      "feedId": "41",
      "source": "NY Times World",
      "title": "3 U.S. Planes Are Shot Down in ‘Friendly Fire’ in Kuwait, U.S. Military Says",
      "timestamp": "Mon, 02 Mar 2026 12:38:02 +0000",
      "quote": "CENTCOM says three fighter jets 'mistakenly shot down'."
    },
    {
      "feedId": "20",
      "source": "Al Jazeera",
      "title": "Three US fighter jets ‘mistakenly’ shot down over Kuwait",
      "timestamp": "Mon, 02 Mar 2026 14:51:21 +0000",
      "quote": "CENTCOM says three fighter jets 'mistakenly shot down'."
    }
  ],
  "counterpoints": [
    {
      "claimA": "The US military claims the jets were mistakenly shot down by Kuwaiti defenses.",
      "claimB": "Kuwaiti officials are investigating the cause of the incident.",
      "sourceA": [
        {
          "feedId": "41",
          "source": "NY Times World",
          "title": "3 U.S. Planes Are Shot Down in ‘Friendly Fire’ in Kuwait, U.S. Military Says",
          "timestamp": "Mon, 02 Mar 2026 12:38:02 +0000"
        }
      ],
      "sourceB": [
        {
          "feedId": "20",
          "source": "Al Jazeera",
          "title": "Three US fighter jets ‘mistakenly’ shot down over Kuwait",
          "timestamp": "Mon, 02 Mar 2026 14:51:21 +0000"
        }
      ]
    }
  ],
  "watchNext": [
    "US-Israel war on Iran – live updates",
    "What we know so far on day three of the Iran war",
    "Qatar halts natural gas production after Iranian attacks",
    "Gas prices soar as QatarEnergy halts LNG production after Iran attacks",
    "Spain denies US permission to use jointly operated bases to attack Iran"
  ]
}
*/



  // Original complex prompt for other models
  return `You are an elite intelligence analyst.
Generate a structured Deep Dive for the provided Signal.

CRITICAL JSON REQUIREMENTS:
- Return ONLY strict JSON. No markdown. No prose outside JSON.
- All strings must be valid JSON strings.
- If a field is unknown, omit it (do NOT use null).

DATE: ${dateStr}

SIGNAL:
${JSON.stringify(minimalSignal)}

FEED CONTENT:
${feedContent}${customGuidelines}

Return EXACTLY one JSON object with this shape:
{
  "signalId": string,
  "header": {
    "title": string,
    "text": string,
    "sentiment": string,
    "deltaType": string,
    "category": string
  },
  "fiveWs": {
    "who": string[],
    "what": string,
    "where": string,
    "when": string,
    "why": string,
    "soWhat": string
  },
  "source": [
    { "feedId": string, "source": string, "title": string, "timestamp": string, "quote": string }
  ],
  "counterpoints": [
    { "claimA": string, "claimB": string, "sourceA": SourceRef[], "sourceB": SourceRef[] }
  ],
  "watchNext": string[] // 3-5 predictive statements about what events/indicators to watch for NEXT (e.g., "Potential retaliatory strikes from Iran", "Watch for CENTCOM investigation results", "Monitor gas price fluctuations")
}

Rules:
- Use the provided FEED CONTENT as source material
- Include relevant quotes from the feed content in your analysis
- watchNext should be PREDICTIVE ANALYSIS about what might happen next - NOT URLs, NOT links, NOT example.com placeholders. Think like an intelligence analyst forecasting likely next developments.
`;
}

interface JsonObjectParseResult {
  success: boolean;
  data: any;
  error?: string;
  canRetry: boolean;
}

function parseJsonObjectWithDetection(text: string): JsonObjectParseResult {
  let cleanText = String(text || '').trim();
  if (!cleanText) return { success: false, data: null, error: 'Empty response', canRetry: true };

  const strategies = [
    () => JSON.parse(cleanText),
    () => {
      const start = cleanText.indexOf('{');
      const end = cleanText.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const jsonStr = cleanText.substring(start, end + 1);
        return JSON.parse(jsonStr);
      }
      throw new Error('JSON extraction failed');
    },
    () => {
      // Try to extract JSON array if object parsing fails
      const start = cleanText.indexOf('[');
      const end = cleanText.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        const jsonStr = cleanText.substring(start, end + 1);
        return JSON.parse(jsonStr);
      }
      throw new Error('JSON array extraction failed');
    }
  ];

  let lastError: Error | null = null;
  for (const strat of strategies) {
    try {
      const obj = strat();
      if (obj && typeof obj === 'object') {
        return { success: true, data: obj, canRetry: false };
      }
      throw new Error('Parsed value was not a valid JSON');
    } catch (e) {
      lastError = e as Error;
    }
  }

  const errorDetails = lastError?.message || 'Unknown parsing error';
  const canRetry = !errorDetails.includes('Empty response');
  return { success: false, data: null, error: `JSON parsing failed: ${errorDetails}`, canRetry };
}


// Zod schema for DeepDive structured output - simplified for Ollama compatibility
const DeepDiveSchema = z.object({
  signalId: z.string(),
  header: z.object({
    title: z.string(),
    text: z.string(),
    sentiment: z.string(),
    deltaType: z.string().optional(),
    category: z.string().optional()
  }),
  fiveWs: z.object({
    who: z.array(z.string()),
    what: z.string(),
    where: z.union([z.string(), z.array(z.string())]), // Accept both string and array
    when: z.string(),
    why: z.string(),
    soWhat: z.string()
  }),
  source: z.array(z.object({
    feedId: z.string().optional(),
    source: z.string(),
    title: z.string(),
    timestamp: z.string(),
    quote: z.string()
  })),
  counterpoints: z.array(z.object({
    claimA: z.string(),
    claimB: z.string(),
    sourceA: z.array(z.any()).optional(),
    sourceB: z.array(z.any()).optional()
  })),
  watchNext: z.array(z.string())
});

export async function generateDeepDive(
  signal: Signal,
  feeds: RawSignal[],
  dateStr: string,
  aiConfig: AiConfig
): Promise<DeepDiveData> {
  // Select relevant feeds for this signal
  const relevantFeeds = selectRelevantFeeds(signal, feeds);
  const prompt = generateDeepDivePrompt(signal, relevantFeeds, dateStr, aiConfig);
  
  // Convert Zod schema to JSON schema (disabled for now due to compatibility issues)
  // const deepDiveJsonSchema = zodToJsonSchema(DeepDiveSchema as any);
  // console.log('JSON Schema being sent to Ollama:', JSON.stringify(deepDiveJsonSchema, null, 2));
  
  // Check if prompt is too large for context window
  const promptSize = new Blob([prompt]).size;
  const contextWindow = aiConfig.numCtx || 12000;
  const maxPromptSize = contextWindow * 0.75; // Use 75% of context window for safety
  
  if (promptSize > maxPromptSize) {
    console.warn(`DeepDive prompt size (${promptSize} bytes) exceeds safe limit (${maxPromptSize} bytes). May cause empty responses.`);
  }
  
  // Add detailed debugging
  // console.log('=== DeepDive Debug Info ===');
  // console.log('Model:', aiConfig.model);
  // console.log('Prompt size (bytes):', promptSize);
  // console.log('Context window:', contextWindow);
  // console.log('Safe limit (75%):', maxPromptSize);
  // console.log('Prompt preview (first 300 chars):', prompt?.substring(0, 300) + '...');
  // console.log('Using regular JSON generation with Zod validation');
  // console.log('==============================');
  
  let raw: string = '';
  let retryCount = 0;
  const maxRetries = 2;
  
  while (retryCount < maxRetries) {
    try {
      // First attempt without format parameter (some models don't support it well)
      if (retryCount === 0) {
        raw = await generateWithProvider(aiConfig, prompt, undefined, 'You are an elite intelligence analyst. Generate structured JSON responses.');
      } else {
        // Second attempt with explicit JSON instruction
        raw = await generateWithProvider(aiConfig, prompt, 'json', 'You must respond with valid JSON only.');
      }
      break; // Success, exit retry loop
    } catch (error) {
      retryCount++;
      
      if (retryCount >= maxRetries) {
        raw = ''; // Final failure
      } else {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // Parse and validate with Zod
  try {
    // console.log('Raw response from Ollama:', raw);
    // console.log('Raw response type:', typeof raw);
    // console.log('Raw response length:', raw?.length);
    
    // If we have an empty response, provide the standard fallback DeepDive
    if (!raw || raw.trim() === '') {
      console.warn('Empty response from both structured and regular JSON, providing fallback DeepDive');
      return {
        signalId: signal.id || '',
        generatedAt: new Date().toISOString(),
        header: {
          title: signal.title || 'Signal Analysis',
          text: signal.text || 'Unable to generate detailed analysis at this time.',
          sentiment: signal.sentiment || 'neutral',
          deltaType: signal.deltaType,
          category: signal.category
        },
        fiveWs: {
          who: [],
          what: signal.text || 'Signal analysis unavailable',
          where: '',
          when: dateStr,
          why: 'AI service temporarily unavailable',
          soWhat: 'Manual analysis may be required'
        },
        source: [],
        counterpoints: [],
        watchNext: []
      };
    }
    
    const parsedData = JSON.parse(raw);
    // console.log('Parsed JSON data:', parsedData);
    
    // Check if we're using fallback (regular JSON) or structured format
    const isFallback = raw === '' || 
                      (parsedData && Object.keys(parsedData).length === 0) || 
                      (parsedData && parsedData.error && parsedData.error.includes('Internal Server Error'));
    
    if (isFallback) {
      console.log('Using fallback parsing without Zod validation');
      // Use the original parsing logic for fallback
      const fallbackParsed = parseJsonObjectWithDetection(raw);
      if (!fallbackParsed.success) {
        throw new Error(fallbackParsed.error || 'Fallback parsing failed');
      }
      
      const obj = fallbackParsed.data;
      return {
        signalId: signal.id || '',
        generatedAt: new Date().toISOString(),
        header: {
          title: signal.title || 'Untitled Signal',
          text: obj.header?.text || signal.text || '',
          sentiment: obj.header?.sentiment || signal.sentiment || 'neutral',
          deltaType: obj.header?.deltaType || signal.deltaType,
          category: obj.header?.category || signal.category
        },
        fiveWs: obj.fiveWs || { who: [], what: '', where: '', when: '', why: '', soWhat: '' },
        source: obj.source || [],
        counterpoints: obj.counterpoints || [],
        watchNext: obj.watchNext || []
      };
    }
    
    const validatedData = DeepDiveSchema.parse(parsedData);
    // console.log('Validated data:', validatedData);
    
    // Convert to DeepDiveData format
    return {
      signalId: validatedData.signalId || signal.id || '',
      generatedAt: new Date().toISOString(),
      header: {
        title: validatedData.header.title || signal.title || 'Untitled Signal',
        text: validatedData.header.text || signal.text || '',
        sentiment: validatedData.header.sentiment as any || signal.sentiment || 'neutral',
        deltaType: validatedData.header.deltaType as any || signal.deltaType,
        category: validatedData.header.category as any || signal.category
      },
      fiveWs: {
        ...validatedData.fiveWs,
        where: Array.isArray(validatedData.fiveWs.where) 
          ? validatedData.fiveWs.where.join(', ') 
          : validatedData.fiveWs.where
      },
      source: validatedData.source.map(s => ({ ...s, feedId: s.feedId || '' })) as any,
      counterpoints: validatedData.counterpoints.map(cp => ({
        ...cp,
        sourceA: cp.sourceA || [],
        sourceB: cp.sourceB || []
      })) as any,
      watchNext: validatedData.watchNext
    };
  } catch (error) {
    console.error('DeepDive Zod validation failed:', error);
    console.log('Raw response that failed:', raw);
    
    // If validation fails, try to provide a fallback
    if (!raw || raw.trim() === '') {
      console.warn('Empty response from AI, providing fallback DeepDive');
      return {
        signalId: signal.id || '',
        generatedAt: new Date().toISOString(),
        header: {
          title: signal.title || 'Signal Analysis',
          text: signal.text || 'Unable to generate detailed analysis at this time.',
          sentiment: signal.sentiment || 'neutral',
          deltaType: signal.deltaType,
          category: signal.category
        },
        fiveWs: {
          who: [],
          what: signal.text || 'Signal analysis unavailable',
          where: '',
          when: dateStr,
          why: 'AI service temporarily unavailable',
          soWhat: 'Manual analysis may be required'
        },
        source: [],
        counterpoints: [],
        watchNext: []
      };
    }
    
    throw new Error(`Deep Dive validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


export async function generateNarrativePredictions(
  narrative: string,
  aiConfig: AiConfig
): Promise<NarrativePredictionsData> {
  const prompt = generateNarrativePredictionsPrompt(narrative, aiConfig);
  
  let raw: string = '';
  let retryCount = 0;
  const maxRetries = 2;
  
  while (retryCount < maxRetries) {
    try {
      // First attempt without format parameter
      if (retryCount === 0) {
        raw = await generateWithProvider(aiConfig, prompt, undefined, 'You are an elite intelligence analyst specializing in predictive analysis.');
      } else {
        // Second attempt with explicit JSON instruction
        raw = await generateWithProvider(aiConfig, prompt, 'json', 'You must respond with valid JSON only.');
      }
      break; // Success, exit retry loop
    } catch (error) {
      console.error(`Narrative service error on attempt ${retryCount + 1}:`, error);
      retryCount++;
      
      if (retryCount >= maxRetries) {
        raw = ''; // Final failure
      } else {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // If we have an empty response, provide a standard fallback
  if (!raw || raw.trim() === '') {
    console.warn('Empty response from narrative predictions, providing fallback');
    return {
      generatedAt: new Date().toISOString(),
      sections: [
        {
          title: 'Predictions Unavailable',
          sentiment: 'neutral',
          predictions: ['AI service temporarily unavailable for narrative predictions. Please try again later.']
        }
      ]
    };
  }
  
  const parsed = parseJsonObjectWithDetection(raw);
  if (!parsed.success) {
    console.error('Narrative Predictions parsing failed:', parsed.error);
    throw new Error(parsed.error || 'Watch For JSON parsing error');
  }

  const obj: any = parsed.data;
  
  return {
    generatedAt: new Date().toISOString(),
    sections: obj.sections || []
  };
}

function generateNarrativePredictionsPrompt(narrative: string, aiConfig?: AiConfig): string {
  // Get custom sentiment guidelines if profile is specified
  let sentimentGuidance = '';
  if (aiConfig?.sentimentProfile) {
    const profile = getSentimentProfile(aiConfig.sentimentProfile);
    sentimentGuidance = `\n\nSENTIMENT ANALYSIS FRAMEWORK:\nWhen analyzing the sentiment of each prediction topic, interpret it through the following lens:\n${generateCustomSentimentGuidelines(profile)}\n\nApply this framework when assessing the sentiment of each topic.`;
  }

  return `You are an elite intelligence analyst specializing in predictive analysis. Based on the following narrative summary of current events, analyze what could happen next across the different topics and subjects mentioned.

Your task is to provide forward-looking intelligence predictions that are:
- Grounded in the current narrative context
- Broken down by the main topics/subjects identified in the narrative
- Written as short, concise bullet points
- Focused on likely developments, not speculative scenarios
- Each section should include a sentiment assessment${sentimentGuidance}

Format your response as a JSON object with the following structure:
{
  "sections": [
    {
      "title": "Topic Name",
      "sentiment": "positive|negative|neutral|interesting|very-positive|very-negative|extremely-negative|somewhat-negative",
      "predictions": [
        "Specific prediction about what to expect",
        "Another specific prediction",
        "Third prediction if relevant"
      ]
    },
    {
      "title": "Another Topic",
      "sentiment": "positive|negative|neutral|interesting|very-positive|very-negative|extremely-negative|somewhat-negative",
      "predictions": [
        "Prediction for this topic",
        "Another prediction"
      ]
    }
  ]
}

Each section should have a clear topic title, a sentiment assessment, and 2-4 specific predictions. Keep predictions concise and actionable.

Current Narrative:\\n\\n${narrative}`;
}

/**
 * Constructs the intelligence context from raw signals.
 * Handles enriched full-article crawls with smart truncation to fit within AI context windows.
 */
function generateContext(feeds: RawSignal[], maxTotalChars: number = 60000) {
  if (!feeds || feeds.length === 0) return 'No news data available for the selected period.';

  const grouped = feeds.reduce((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {} as Record<string, RawSignal[]>);

  let fullContext = '';
  const charLimitPerArticle = feeds.length > 20 ? 1000 : 3000; // Shrink individual context if we have many articles

  for (const [category, items] of Object.entries(grouped)) {
    fullContext += `### CATEGORY: ${category}\n`;

    for (const f of items) {
      const sourceTag = `[${f.source}]`;
      const titleTag = f.title ? `${f.title}. ` : '';

      // Smart Truncation: Preserve the start of the article for context
      let content = f.content || '';
      if (content.length > charLimitPerArticle) {
        content = content.substring(0, charLimitPerArticle) + '... [content truncated for context optimization]';
      }

      const itemText = `${sourceTag} ${titleTag}${content}\n\n`;

      // Check if adding this would exceed our hard limit for the entire prompt
      if ((fullContext.length + itemText.length) > maxTotalChars) {
        fullContext += `... [Further ${items.length - items.indexOf(f)} articles in ${category} omitted due to context limit]`;
        break;
      }

      fullContext += itemText;
    }
    fullContext += '\n';
  }

  return fullContext.trim();
}

function generateNarrativePrompt(context: string, aiConfig?: AiConfig) {
  // Get custom sentiment guidelines if profile is specified
  let sentimentGuidance = '';
  if (aiConfig?.sentimentProfile) {
    const profile = getSentimentProfile(aiConfig.sentimentProfile);
    sentimentGuidance = `\n\nSENTIMENT ANALYSIS FRAMEWORK:\nWhen analyzing events, interpret them through the following lens:\n${generateCustomSentimentGuidelines(profile)}\n\nApply this framework when assessing the significance and tone of events in your briefing.`;
  }

  return `You are an elite intelligence analyst. Analyze these news feeds and provide a short but comprehensive briefing for the day that aims to weave together recent events and how they shape the current ongoing narrative and situations. Do not focus on only one event. Instead, synthesize the top 5 most critical global themes currently developing. Keep the tone clinical, objective, and professional. Skip introductions and closings. Do not include any em dashes or other additional formatting. No markdown formatting either. No bullet points or numbered lists. Separate each of the 5 events or themes with a newline. Do not use ** or * for formatting. Do not include a title. Avoid the term "highlights" and focus more on evidence based conclusions by outlining cause and effects. \n\n
  
  Avoid the repetitive use of the following words in their singular or plural form: demonstrates, emphasizes,  highlights, illustrates, intersection, outlines, reflects, underscores. Be more direct instead of talking on the edge of metaphors and similes.

  And for god's sake, avoid sounding melancholy and pessimistic it's not the end of the world.

${sentimentGuidance}
Do not include any sentiment analysis labels directly in the narrative instead use it to guide your tone accordingly.

Feeds:
${context}`;
}

function sanitizeRecentSignals(recentSignals: string[]): string {
  if (!recentSignals.length) return 'None';
  const trimmed = recentSignals
    .slice(0, 20)
    .map(s => s.replace(/[`\n]/g, ' ').trim())
    .filter(Boolean);
  return trimmed.length ? trimmed.map(s => `- ${s}`).join('\n') : 'None';
}

function formatSignalsContextForInsights(signalsContext: string): string {
  const trimmed = String(signalsContext || '').trim();
  if (!trimmed) return 'None provided.';

  const lines = trimmed
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  return lines.slice(0, 12).join('\n');
}

function generateSignalsPrompt(context: string, feedIndex: any[], recentSignals: string[] = [], aiConfig?: AiConfig) {
  // Get custom sentiment guidelines if profile is specified
  let customGuidelines = '';
  if (aiConfig?.sentimentProfile) {
    const profile = getSentimentProfile(aiConfig.sentimentProfile);
    customGuidelines = generateCustomSentimentGuidelines(profile);
  } else {
    // Default to balanced profile when no profile specified
    const defaultProfile = getSentimentProfile('balanced');
    customGuidelines = generateCustomSentimentGuidelines(defaultProfile);
  }

  const prompt = `Act as a senior intelligence officer. Examine the following news feeds and identify 5-8 distinct signals by following these rules:
1. A signal is NOT just a headline; it is a shift in state, a pivot point, or a significant escalation. It can also be a shift in sentiment or seemingly minor events that could lead towards something much more significant.
2. DEDUPLICATE: If multiple sources report on the same event, synthesize them into ONE high-level signal with the most critical takeaway. DO NOT repeat yourself.
3. EXCLUDE: Sports scores/updates, celebrity gossip, movie release, and hyper-local crime stories (unless there are mass casualties).
4. CRITICAL: You MUST return a JSON ARRAY starting with [ and ending with ]. Do NOT return a single object.
5. The sentiment is not significance. Therefore the sentiment of a signal does not qualify or disqualify it.
6. INCLUDE: Tech/AI, Financial, Conflicts, Geopolitical, Science, Health

FEED INDEX (for citations):
${JSON.stringify(feedIndex)}

RECENT SIGNALS (last 7 days, for novelty/dedup):
${sanitizeRecentSignals(recentSignals)}

Your response MUST start with [ and end with ] and contain 5-8 signal objects with EXACTLY these field names:
[
  {
    "title": "Concise headline",
    "text": "Detailed description - use this field name, NOT 'summary' or 'description'",
    "sentiment": "neutral|positive|negative|very-positive|very-negative|extremely-negative|somewhat-negative|interesting",
    "category": "Tech/AI|Financial|Conflicts|Geopolitical|Science|Health|Other",
    "deltaType": "escalation|deescalation|policy|market|breakthrough|disruption|other",
    "source": [
      { "feedId": "3", "source": "BBC News", "title": "Iran: Israel Launches Fresh Strikes", "timestamp": "2025-06-19T10:00:00Z", "quote": "Israeli jets struck multiple nuclear research sites" }
    ]
  }
]

CRITICAL REQUIREMENTS:
- Field names MUST be exactly: title, text (not summary), sentiment, category, source
- The "text" field MUST contain the detailed description (1-2 sentences)
- The "sentiment" field is REQUIRED - analyze the tone and provide one of the allowed values
- The "source" array is REQUIRED - cite at least one feed using the numeric feedId from FEED INDEX
- You MUST include at least one source citation per signal
- Do NOT use "summary" or "description" as field names - use "text"
- The example above shows the EXACT format to use

Rules:
- You MUST return exactly 5-8 signals in the array
- title: MAX ~20 words, shareable headline (e.g., "Crackdown Intensifies Amid Protests")
- text: 1-2 sentences detailed description of the signal (e.g., "Authorities are escalating violent crackdowns on nationwide protests, with reports of mass arrests and lethal force being used against demonstrators.")
- novelty is 0..100 (lower if similar to RECENT SIGNALS).
- feedId MUST be the numeric index from FEED INDEX.
- You MUST include at least 1 reference source per signal item. (if you can't match any source feed reference for a signal, skip it)
- Each signal should cover different topics/events (don't repeat the same Iran story multiple times)
- Only include contradictions that are clear and relevant to the signal otherwise exclude the contradictions.

SENTIMENT GUIDELINES:
${customGuidelines}

Feeds:
${context}`;

  // console.log('Signals prompt length:', prompt.length);
  // console.log('Feed index length:', feedIndex.length);
  return prompt;
}

function generateInsightsPrompt(context: string, feedIndex: any[], signalsContext: string = '', parsedSignals: any[] = [], aiConfig?: AiConfig) {
  const signalsSummary = formatSignalsContextForInsights(signalsContext);
  const signalsWithIds = parsedSignals.map(s => `- ${s.text} [ID: ${s.id || 'unknown'}]`).join('\n');

  // Get custom sentiment guidelines if profile is specified
  let customGuidelines = '';
  if (aiConfig?.sentimentProfile) {
    const profile = getSentimentProfile(aiConfig.sentimentProfile);
    customGuidelines = generateCustomSentimentGuidelines(profile);
  } else {
    // Default to balanced profile when no profile specified
    const defaultProfile = getSentimentProfile('balanced');
    customGuidelines = generateCustomSentimentGuidelines(defaultProfile);
  }

  return `You are the lead analyst in an intelligence fusion cell. Derive non-obvious, second-order insights grounded in the provided reporting and signals.

DATA SOURCES:
FEED INDEX (JSON, use feedId exactly as provided when citing sources):
${JSON.stringify(feedIndex)}

SIGNALS SUMMARY (for cross-referencing):
${signalsSummary}

SIGNALS WITH IDS (use these IDs in signalId when an insight directly relates to a signal):
${signalsWithIds}

RAW FEED CONTEXT:
${context}

OUTPUT FORMAT (STRICT JSON):
[
  {
    "text": "Observation | Strategic implication",
    "sentiment": "neutral",
    "signalId": "sig_abc123", // Optional: id of the related signal if this insight is derived from a specific signal
    "source": [
      { "feedId": string, "source": string, "title": string, "timestamp": string, "quote": string }
    ]
  }
]

RULES:
- Return 3-6 distinct insights when the feeds support it. If fewer than three credible insights exist, return only those that are defensible; otherwise return an empty array.
- Each insight must feature at least one reference source object (prefer two from different sources) that ties the inference to the feed data.
- If an insight is derived from a specific signal, include its signalId (from the SIGNALS SUMMARY) to enable direct association.
- Use feedId values from the FEED INDEX verbatim. Never invent ids or cite sources not present in the data.
- Do not output markdown, commentary, or the example placeholders (e.g., never literally write "INSIGHT | ANALYSIS").
- Keep source quotes under 180 characters and extract meaningful phrases, not entire articles.
- Sentiment must use the authorized taxonomy.
- If no credible insight exists, return [] exactly.

SENTIMENT GUIDELINES:
${customGuidelines}`;
}

function generateMapPointsPrompt(context: string, signalsContext: string = '', aiConfig?: AiConfig) {
  // Get custom sentiment guidelines if profile is specified
  let customGuidelines = '';
  if (aiConfig?.sentimentProfile) {
    const profile = getSentimentProfile(aiConfig.sentimentProfile);
    customGuidelines = generateCustomSentimentGuidelines(profile);
  } else {
    // Default to balanced profile when no profile specified
    const defaultProfile = getSentimentProfile('balanced');
    customGuidelines = generateCustomSentimentGuidelines(defaultProfile);
  }

  return `Generate geographical map coordinates for the Signals listed below.
CRITICAL: You MUST attempt to generate a map point for EVERY Signal provided.
If a specific city/location is not mentioned, deduce the most relevant country or region (e.g. use the capital city).
ENSURE DIVERSITY: Do not put all points on the same coordinate. Spread them out if they are in the same country.

Return ONLY strict JSON. No comments, no markdown, no explanations.

Return a JSON array of objects with this exact structure:
[
  {
    "lat": number,
    "lng": number,
    "title": string,
    "sentiment": string,
    "category": "Tech/AI"|"Financial"|"Conflicts"|"Geopolitical"|"Other",
    "description": string,
    "sourceLink": string,
    "signalId": string
  }
]

Schema requirements:
- "lat" and "lng" MUST be numbers (no strings).
- "title" should be a concise place name.
- "description" MUST summarize the signal in <=120 characters.
- "sourceLink" MUST be a URL or empty string if unknown.
- "signalId" MUST match the id field for the related signal when available, otherwise use an empty string.
- Use the provided sentiment list exactly as-is.

SIGNALS TO PLOT:
${signalsContext}

SENTIMENT GUIDELINES:
${customGuidelines}

Feeds (for reference/coordinates):
${context}`;
}

function generateRelationsPrompt(
  context: string,
  relations: ForeignRelation[],
  narrative: string = '',
  signals: any[] = [],
  insights: any[] = [],
  bigPicture: any = null,
  historicalContext: string = '',
  aiConfig?: AiConfig
) {
  let deepContext = `### INTELLIGENCE CONTEXT\n`;
  if (narrative) deepContext += `CURRENT SITUATION NARRATIVE:\n${narrative}\n\n`;
  if (signals && signals.length) deepContext += `SIGNALS:\n${signals.map(s => `- ${s.text} (${s.sentiment})`).join('\n')}\n\n`;
  if (insights && insights.length) deepContext += `HIDDEN INSIGHTS:\n${insights.map(i => `- ${i.text}`).join('\n')}\n\n`;
  if (bigPicture) deepContext += `THE BIG PICTURE (STRATEGIC OVERVIEW):\n${bigPicture.summary}\n\n`;
  if (historicalContext) deepContext += `HISTORICAL CONTEXT (Previous relevant data):\n${historicalContext}\n\n`;

  // Get custom sentiment guidelines if profile is specified
  let customGuidelines = '';
  if (aiConfig?.sentimentProfile) {
    const profile = getSentimentProfile(aiConfig.sentimentProfile);
    customGuidelines = generateCustomSentimentGuidelines(profile);
  } else {
    // Default to balanced profile when no profile specified
    const defaultProfile = getSentimentProfile('balanced');
    customGuidelines = generateCustomSentimentGuidelines(defaultProfile);
  }

  return `Act as a geopolitical analyst. Update status/sentiment for these geopolitical trackers using the provided Intelligence Context, News Feeds, and Historical Context.
CRITICAL: You MUST return a JSON object for EVERY SINGLE TRACKER in the EXACT ORDER they are listed below.
IMPORTANT: Analyze both current and historical data to provide comprehensive briefings. If no current data exists but historical data is relevant, provide a summary based on historical patterns.

TRACKERS:
${relations.map((r, i) => `${i + 1}. ID: "${r.id}" | ${r.countryA} vs ${r.countryB} (Topic: ${r.topic})`).join('\n')}

If the provided data does not contain specific information about a pair, you MUST still return it with:
- "status": "No new developments found in current scan."
- "sentiment": "neutral"

Return JSON array: [{"id": "...", "countryA": "...", "countryB": "...", "status": "...", "sentiment": "..."}]

SENTIMENT GUIDELINES (Use these EXACT strings for the sentiment field):
${customGuidelines}

${deepContext}

RAW FEEDS:
${context}`;

}

interface JsonParseResult {
  success: boolean;
  data: any[];
  error?: string;
  canRetry: boolean;
}

function parseJsonArrayWithDetection(text: string): JsonParseResult {
  let cleanText = text.trim();

  if (!cleanText) {
    return { success: false, data: [], error: 'Empty response', canRetry: true };
  }

  // Try multiple parsing strategies
  const strategies = [
    () => {
      // Strategy 1: Direct JSON parse
      let parsed = JSON.parse(cleanText);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        // Check if this is a single signal object (has title/text fields)
        if (parsed.title || parsed.text) {
          console.log('WARNING: AI returned single object instead of array. Converting to array but prompt needs fixing.');
          return [parsed];
        }

        const arrayProp = Object.values(parsed).find(v => Array.isArray(v));
        if (arrayProp && Array.isArray(arrayProp)) return arrayProp.flat(1);
        const keys = Object.keys(parsed);
        if (keys.every(k => k.includes('|') || k.length > 20)) return keys;
        const values = Object.values(parsed);
        return values.every(v => typeof v === 'string') && values.length > 1 ? values : [parsed];
      }
      const result = Array.isArray(parsed) ? parsed.flat(1) : [parsed];
      return result;
    },
    () => {
      // Strategy 2: Fix incomplete arrays
      if (cleanText.startsWith('[') && !cleanText.endsWith(']')) {
        let resArr = cleanText;
        if (resArr.includes('"') && (resArr.split('"').length % 2 === 0)) resArr += '"';
        if (resArr.includes('{') && (resArr.split('{').length > resArr.split('}').length)) resArr += '}';
        resArr += ']';
        const parsed = JSON.parse(resArr);
        if (Array.isArray(parsed)) return parsed.flat(1);
      }
      throw new Error('Incomplete array fix failed');
    },
    () => {
      // Strategy 3: Extract JSON from text
      const start = cleanText.indexOf('[');
      const end = cleanText.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        const jsonStr = cleanText.substring(start, end + 1);
        const parsed = JSON.parse(jsonStr);
        return parsed.flat(1);
      }
      throw new Error('JSON extraction failed');
    },
    () => {
      // Strategy 4: Handle malformed JSON with duplicate keys (common AI issue)
      // Pattern: {"text": "...", "sentiment": "...", "text": "...", "sentiment": "..."}
      if (cleanText.includes('"text":') && cleanText.includes('"sentiment":')) {
        // Split by "text": to find individual objects
        const parts = cleanText.split('"text":').slice(1); // Remove first empty part
        const objects = [];

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          // Find the end of this object (next "text": or end of string)
          let endPos = part.length;
          if (i < parts.length - 1) {
            // Find the position before the next "text":
            const nextTextIndex = part.indexOf('", "text":');
            if (nextTextIndex !== -1) {
              endPos = nextTextIndex + 1;
            }
          }

          // Extract and reconstruct the object
          let objectStr = '{"text":' + part.substring(0, endPos);

          // Ensure it ends properly
          if (!objectStr.endsWith('}') && !objectStr.endsWith('"}')) {
            objectStr += '"';
            if (!objectStr.endsWith('}')) {
              objectStr += '}';
            }
          }

          try {
            const obj = JSON.parse(objectStr);
            if (obj.text && obj.sentiment) {
              objects.push(obj);
            }
          } catch (e) {
            // Skip malformed objects
            continue;
          }
        }

        if (objects.length > 0) {
          return objects;
        }
      }
      throw new Error('Duplicate key parsing failed');
    }
  ];

  let lastError: Error | null = null;

  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = strategies[i]();
      if (Array.isArray(result) && result.length > 0) {
        return { success: true, data: result, canRetry: false };
      }
    } catch (error) {
      lastError = error as Error;
      continue;
    }
  }

  // All strategies failed - return error object instead of fallback data
  const errorDetails = lastError?.message || 'Unknown parsing error';
  const canRetry = !errorDetails.includes('Empty response');

  return {
    success: false,
    data: [{ error: `JSON parsing failed: ${errorDetails}` }], // Return error object to be detected by finalize functions
    error: `JSON parsing failed: ${errorDetails}`,
    canRetry
  };
}

function parseJsonArray(text: string): any[] {
  const result = parseJsonArrayWithDetection(text);
  if (result.success) {
    return result.data;
  }

  // Check if the data contains error objects and filter them out
  if (Array.isArray(result.data)) {
    const filtered = result.data.filter(item =>
      !(typeof item === 'object' && item !== null && 'error' in item)
    );
    return filtered;
  }

  return [];
}

function finalizeNarrative(narrative: string) {
  return narrative.trim().replace(/^(Briefing|Analysis|Summary):/i, '').trim();
}

const DEFAULT_SENTIMENT: any = 'neutral';

function clamp01(n: any): number | undefined {
  const value = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, value));
}

function clamp0100(n: any): number | undefined {
  const value = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(100, value));
}

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function normalizeCategory(raw: any): string | undefined {
  if (!raw) return undefined;
  const value = String(raw).trim();
  const lower = value.toLowerCase();
  if (lower.includes('tech') || lower.includes('ai')) return 'Tech/AI';
  if (lower.includes('fin')) return 'Financial';
  if (lower.includes('conflict') || lower.includes('war') || lower.includes('security')) return 'Conflicts';
  if (lower.includes('geo') || lower.includes('diplom')) return 'Geopolitical';
  // Preserve original category if provided (e.g., 'Science', 'Health', etc.)
  return value || undefined;
}

function normalizeDeltaType(raw: any): 'escalation' | 'deescalation' | 'policy' | 'market' | 'breakthrough' | 'disruption' | 'other' | undefined {
  if (!raw) return undefined;
  const lower = String(raw).trim().toLowerCase();
  const allowed = new Set(['escalation', 'deescalation', 'policy', 'market', 'breakthrough', 'disruption', 'other']);
  return allowed.has(lower) ? (lower as any) : undefined;
}

function normalizeSource(raw: any, feeds: RawSignal[]): SourceRef[] {
  if (!Array.isArray(raw)) return [];
  // Create mapping of IDs and also handle numeric indices for AI reliability
  const feedById = new Map<string, RawSignal>();
  feeds.forEach((f, idx) => {
    feedById.set(String(f.id), f);
    feedById.set(String(idx), f); // Support lookup by prompt index
  });

  const refs = raw.map((entry: any) => {
    if (!entry || typeof entry !== 'object') return null;

    // Handle various field name variations from AI
    const feedId = entry?.feedId || entry?.feed_id || entry?.id || '';
    if (!feedId) return null;

    let feed = feedById.get(String(feedId));

    // Fuzzy fallback: If ID fails, try matching by Title similarity
    const entryTitle = entry?.title || entry?.headline || entry?.name || '';
    if (!feed && entryTitle) {
      const entryTitleLower = String(entryTitle).toLowerCase();
      feed = feeds.find(f =>
        f.title?.toLowerCase() === entryTitleLower ||
        (f.title && calculateTextSimilarity(f.title.toLowerCase(), entryTitleLower) > 0.8)
      );
    }

    const feedSource = feed?.source || 'Unknown Source';
    const feedTitle = feed?.title || entryTitle || 'Untitled';
    const feedTimestamp = feed?.timestamp || new Date().toISOString();

    return {
      feedId: String(feedId),
      source: entry?.source ? String(entry.source) : feedSource,
      title: entry?.title ? String(entry.title) : feedTitle,
      link: feed?.link, // CRITICAL: NEVER use AI-generated links (prevents hallucination)
      timestamp: entry?.timestamp ? String(entry.timestamp) : feedTimestamp,
      quote: entry?.quote ? String(entry.quote) : undefined
    } as SourceRef;
  }).filter(Boolean) as SourceRef[];

  const seen = new Set<string>();
  const deduped: SourceRef[] = [];
  for (const ref of refs) {
    if (seen.has(ref.feedId)) continue;
    seen.add(ref.feedId);
    deduped.push(ref);
  }
  return deduped;
}


function applyNoveltyScores(signals: any[], recentSignals: string[]): any[] {
  if (!Array.isArray(signals) || !signals.length || !recentSignals.length) return signals;

  const normalizedRecent = recentSignals.map(s => String(s).toLowerCase().trim()).filter(Boolean);
  return signals.map(signal => {
    if (typeof signal.novelty === 'number') return signal;
    const text = String(signal.text || '').toLowerCase();
    let maxSim = 0;
    for (const past of normalizedRecent) {
      maxSim = Math.max(maxSim, calculateTextSimilarity(text, past));
      if (maxSim >= 1) break;
    }
    const novelty = Math.round((1 - Math.min(1, maxSim)) * 100);
    return { ...signal, novelty };
  });
}

function deduplicateSignals(signals: any[]) {
  const uniqueSignals: any[] = [];
  const seenTexts = new Set<string>();

  for (const signal of signals) {
    // Normalize text for comparison
    const normalizedText = signal.text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize whitespace

    // Check for exact duplicates
    if (seenTexts.has(normalizedText)) {
      continue;
    }

    // Check for essentially the same signals (high similarity)
    let isDuplicate = false;
    for (const existingSignal of uniqueSignals) {
      const existingNormalized = existingSignal.text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ');

      // Calculate similarity (simple word overlap)
      const similarity = calculateTextSimilarity(normalizedText, existingNormalized);

      // If similarity is high (>0.4) and sentiment is the same, consider it duplicate
      if (similarity > 0.4 && signal.sentiment === existingSignal.sentiment) {
        isDuplicate = true;
        // Keep the longer/more descriptive version
        if (signal.text.length > existingSignal.text.length) {
          const index = uniqueSignals.indexOf(existingSignal);
          uniqueSignals[index] = signal;
        }
        break;
      }
    }

    if (!isDuplicate) {
      uniqueSignals.push(signal);
      seenTexts.add(normalizedText);
    }
  }

  return uniqueSignals;
}

function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(' ').filter(w => w.length > 1));
  const words2 = new Set(text2.split(' ').filter(w => w.length > 1));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

function finalizeSignals(raw: any[], feeds: RawSignal[] = []) {
  // console.log('=== FINALIZE SIGNALS ===');
  // console.log('Input raw data sample:', JSON.stringify(raw[0], null, 2));
  
  // Check if the raw data contains actual error objects (not signal objects)
  const hasError = raw.some(item =>
    typeof item === 'object' &&
    item !== null &&
    'error' in item &&
    typeof item.error === 'string' &&
    // Make sure it's actually an error object, not a signal
    // Signal objects have properties like title, text, sentiment, etc.
    // Error objects typically only have error property
    !('title' in item) && !('text' in item) && !('sentiment' in item)
  );

  if (hasError) {
    console.error('Error detected in raw signals data:', raw);
    return [];
  }

  const processedSignals = raw.map((s: any) => {
    if (typeof s === 'string') return { text: s, sentiment: DEFAULT_SENTIMENT };

    // Extract text from various possible fields
    let text = '';

    if (s.text) {
      text = s.text;
    } else if (s.summary) {
      text = s.summary;
    } else if (s.description) {
      text = s.description;
    } else if (s.content) {
      text = s.content;
    } else if (s.event) {
      text = s.event;
    } else {
      // Handle malformed objects like {"34":"text...", "sentiment":"interesting"}
      const keys = Object.keys(s).filter(k => k !== 'sentiment' && k !== 'level');
      if (keys.length === 1) {
        // Single non-sentiment key, use its value
        const key = keys[0];
        text = String(s[key]);
      } else {
        // Multiple keys, try to find most likely text content
        const textKey = keys.find(k =>
          typeof s[k] === 'string' &&
          s[k].length > 10 &&
          !k.includes('sentiment') && !k.includes('level')
        );
        text = textKey ? String(s[textKey]) : JSON.stringify(s);
      }
    }

    const sentiment = (s.sentiment || s.level || DEFAULT_SENTIMENT).toLowerCase();

    // Validate sentiment is one of the allowed values
    const allowedSentiments: Set<string> = new Set([
      'extremely-negative', 'very-negative', 'negative', 'somewhat-negative',
      'neutral', 'interesting', 'positive', 'very-positive'
    ]);

    const finalSentiment = allowedSentiments.has(sentiment) ? sentiment : 'neutral';

    const title = s.title ? String(s.title) : (s.signal ? String(s.signal) : (s.headline ? String(s.headline) : undefined));
    const category = normalizeCategory(s.category);
    const deltaType = normalizeDeltaType(s.deltaType);
    let source = normalizeSource(s.source, feeds);
    
    // Fallback: Auto-assign sources based on text similarity if AI didn't provide them
    if (!source || source.length === 0) {
      // console.log(`No sources provided for signal "${title}", attempting auto-assignment...`);
      const signalText = `${title || ''} ${text || ''}`.toLowerCase();
      // console.log(`Signal text for matching: "${signalText.substring(0, 80)}..."`);
      
      const scoredFeeds = feeds.map((f, idx) => {
        const feedText = `${f.title || ''} ${f.content || ''}`.toLowerCase();
        const score = calculateTextSimilarity(signalText, feedText);
        return { feed: f, idx, score };
      }).sort((a, b) => b.score - a.score);
      
      // console.log(`Top 3 matches:`, scoredFeeds.slice(0, 3).map(s => ({ title: s.feed.title?.substring(0, 40), score: s.score.toFixed(2) })));
      
      const viableMatches = scoredFeeds.filter(s => s.score > 0.15);
      if (viableMatches.length > 0) {
        const topMatch = viableMatches[0];
        source = [{
          feedId: String(topMatch.idx),
          source: topMatch.feed.source || 'Unknown',
          title: topMatch.feed.title || 'Untitled',
          link: topMatch.feed.link,
          timestamp: topMatch.feed.timestamp || new Date().toISOString()
        }];
        // console.log(`Auto-assigned source: ${topMatch.feed.title} (score: ${topMatch.score.toFixed(2)})`);
      } else {
        console.warn(`No feed match found for signal "${title}"`);
      }
    }
    
    const contradictions = (Array.isArray(s.contradictions) ? s.contradictions : []).map((c: any) => ({
      ...c,
      sourceA: normalizeSource(c.sourceA, feeds),
      sourceB: normalizeSource(c.sourceB, feeds)
    }));

    // Safeguard: prevent text from being set to title
    if (text === s.title || text === title) {
      console.warn('Text was set to title value, clearing to prevent duplication');
      text = '';
    }


    const importance = typeof s.importance === 'number' ? s.importance :
      typeof s.importance === 'string' ? parseFloat(s.importance) : undefined;
    const novelty = typeof s.novelty === 'number' ? s.novelty :
      typeof s.novelty === 'string' ? parseFloat(s.novelty) : undefined;

    const stableSeed = `${title || ''}|${text}|${category || ''}|${deltaType || ''}|${(source[0]?.feedId) || ''}`;
    const id = s.id ? String(s.id) : `sig_${hashString(stableSeed)}`;

    return {
      id,
      title,
      text,
      sentiment: finalSentiment as any,
      category,
      deltaType,
      importance,
      novelty,
      explain: s.explain ? String(s.explain) : undefined,
      shareText: s.shareText ? String(s.shareText) : undefined,
      source,
      contradictions
    };
  });

  // console.log(`Processed ${processedSignals.length} signals`);
  
  // Filter out signals without at least one source
  const signalsWithSources = processedSignals.filter(s => {
    const hasSource = s.source && s.source.length > 0;
    // if (!hasSource) {
    //   console.warn(`Filtering out signal "${s.title}" - no source references`);
    // }
    return hasSource;
  });
  
  // console.log(`${signalsWithSources.length} signals have sources (${processedSignals.length - signalsWithSources.length} filtered out)`);
  
  // if (signalsWithSources.length > 0) {
  //   console.log('First processed signal:', JSON.stringify(signalsWithSources[0], null, 2));
  // }
  // console.log('=== END FINALIZE SIGNALS ===');

  return deduplicateSignals(signalsWithSources);
}

function finalizeInsights(raw: any[], feeds: RawSignal[] = []) {
  console.log('Raw insights data:', raw);

  // Check if the raw data contains error objects
  const hasError = raw.some(item =>
    typeof item === 'object' &&
    item !== null &&
    'error' in item &&
    typeof item.error === 'string'
  );

  if (hasError) {
    // Find the first error and throw it to trigger the error handling
    const errorItem = raw.find(item =>
      typeof item === 'object' &&
      item !== null &&
      'error' in item
    );
    console.error('AI returned error for insights:', errorItem);
    throw new Error(errorItem?.error || 'JSON parsing error in insights');
  }

  return raw.map((i: any) => {
    if (typeof i === 'string') return { text: i, sentiment: DEFAULT_SENTIMENT };

    // Handle malformed objects like {"34":"text...", "sentiment":"interesting"}
    let text = '';
    if (i.text) {
      text = i.text;
    } else if (i.trend && i.impact) {
      text = `${i.trend} | ${i.impact}`;
    } else {
      // Extract text from malformed objects
      const keys = Object.keys(i).filter(k => k !== 'sentiment' && k !== 'source');

      // Skip if the only remaining keys look like URLs or numbers
      const nonUrlKeys = keys.filter(k => {
        const value = String(i[k]);
        return !value.startsWith('http') && !value.match(/^\d+$/);
      });

      if (nonUrlKeys.length === 1) {
        // Single non-sentiment key, use its value
        const key = nonUrlKeys[0];
        text = String(i[key]);
      } else if (nonUrlKeys.length > 1) {
        // Multiple keys, try to find the most likely text content
        const textKey = nonUrlKeys.find(k =>
          typeof i[k] === 'string' &&
          i[k].length > 20 &&
          !i[k].startsWith('http') &&
          !k.includes('sentiment')
        );
        text = textKey ? String(i[textKey]) : JSON.stringify(i);
      } else {
        // All remaining keys are URLs or numbers, create a fallback
        text = 'Unable to parse insight content - AI returned URLs instead of text';
      }
    }

    // Final validation: if text is still a URL or too short, create fallback
    if (text.startsWith('http') || text.length < 10) {
      text = 'AI model returned invalid content format - expected insight text';
    }

    let sentiment = String(i.sentiment || DEFAULT_SENTIMENT).toLowerCase();

    // Mapping for numeric or common string sentiments
    const sentimentMap: Record<string, string> = {
      '1': 'extremely-negative', '2': 'very-negative', '3': 'negative', '4': 'somewhat-negative',
      '5': 'neutral', '6': 'interesting', '7': 'positive', '8': 'very-positive'
    };
    if (sentimentMap[sentiment]) sentiment = sentimentMap[sentiment];

    const source = normalizeSource(i.source, feeds);
    const signalId = i.signalId ? String(i.signalId) : undefined;
    return { text, sentiment: sentiment as any, source, signalId };
  }).filter(i => i.text.length > 10);
}


function finalizeMapPoints(raw: any[], signals: any[] = []) {
  console.log('Raw map points data:', raw);

  // Check if the raw data contains error objects
  const hasError = raw.some(item =>
    typeof item === 'object' &&
    item !== null &&
    'error' in item &&
    typeof item.error === 'string'
  );

  if (hasError) {
    // Find the first error and log it
    const errorItem = raw.find(item =>
      typeof item === 'object' &&
      item !== null &&
      'error' in item
    );
    console.error('AI returned error for map points:', errorItem);

    // Return empty array instead of throwing to allow the app to continue
    return [];
  }

  // Handle case where raw is not an array or is empty
  if (!Array.isArray(raw) || raw.length === 0) {
    console.warn('Map points raw data is not an array or is empty:', raw);
    return [];
  }

  const allSignals = Array.isArray(signals) ? signals : [];

  const bestSignalForDescription = (desc: string) => {
    const d = String(desc || '').toLowerCase();
    if (!d) return null;
    let best: any = null;
    let bestScore = 0;
    for (const s of allSignals) {
      const sim = calculateTextSimilarity(d, String(s.text || '').toLowerCase());
      if (sim > bestScore) {
        bestScore = sim;
        best = s;
      }
    }
    return bestScore > 0.2 ? best : null;
  };

  return raw.map((p, idx) => {
    // Truncate description to max 100 chars for compact popups
    let desc = String(p.description || '').trim();
    if (desc.length > 100) desc = desc.substring(0, 97) + '...';

    const match = bestSignalForDescription(String(p.description || p.title || ''));

    return {
      id: `map-${idx}`,
      lat: Number(p.lat) || 0,
      lng: Number(p.lng) || 0,
      title: p.title || 'Event',
      sentiment: p.sentiment || 'neutral',
      category: p.category || 'Geopolitical',
      description: desc,
      sourceLink: p.sourceLink || p.source_link || p.link || '',
      signalId: match?.id
    };
  });
}



function finalizeRelations(raw: any[], relations: ForeignRelation[]) {
  // Check if the raw data contains error objects
  const hasError = raw.some(item =>
    typeof item === 'object' &&
    item !== null &&
    'error' in item &&
    typeof item.error === 'string'
  );

  if (hasError) {
    // Find the first error and throw it to trigger the error handling
    const errorItem = raw.find(item =>
      typeof item === 'object' &&
      item !== null &&
      'error' in item
    );
    throw new Error(errorItem?.error || 'JSON parsing error in relations');
  }

  return relations.map(rel => {
    // 1. Try matching by exact ID
    let update = raw.find(r => r.id === rel.id);

    // 2. Fallback: Try matching by Country A & B (Case insensitive)
    if (!update) {
      update = raw.find(r =>
        (r.countryA?.toLowerCase() === rel.countryA.toLowerCase() && r.countryB?.toLowerCase() === rel.countryB.toLowerCase()) ||
        (r.countryA?.toLowerCase() === rel.countryB.toLowerCase() && r.countryB?.toLowerCase() === rel.countryA.toLowerCase())
      );
    }

    if (!update) return rel;

    let sentiment = String(update.sentiment || rel.sentiment).toLowerCase();

    // Fallback for numeric or common string sentiments
    const sentimentMap: Record<string, string> = {
      '1': 'extremely-negative',
      '2': 'very-negative',
      '3': 'negative',
      '4': 'somewhat-negative',
      '5': 'neutral',
      '6': 'interesting',
      '7': 'positive',
      '8': 'very-positive',
      'tension': 'negative',
      'conflict': 'extremely-negative'
    };

    if (sentimentMap[sentiment]) {
      sentiment = sentimentMap[sentiment];
    }

    return {
      ...rel,
      status: String(update.status || rel.status),
      sentiment: sentiment as any,
      lastUpdate: new Date().toISOString()
    };
  });

}

function handleProcessError(error: any) {
  console.error('AI Error:', error);
  return { narrative: "Engine error.", thinkingTrace: '', signals: [], insights: [], mapPoints: [], foreignRelations: [] };
}

export async function processSingleSection(
  sectionId: string,
  feeds: RawSignal[],
  foreignRelations: ForeignRelation[] = [],
  aiConfig: AiConfig,
  onStream?: (text: string) => void,
  extraContext: any = {},
  onJsonError?: (error: string, canRetry: boolean) => void
): Promise<Partial<SituationState>> {
  // Create a unique job ID for this section processing
  const jobId = `section-${sectionId}-${Date.now()}`;

  // Create cancellation controller for this job
  const controller = cancellationTokenManager.createController(jobId);

  try {
    // Special handling for RSS section - just validate feeds, no AI processing
    if (sectionId === 'rss') {
      // Simulate a brief processing delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if we have any feeds - fail only if all feeds are empty/missing
      if (!feeds || feeds.length === 0) {
        throw new Error('No RSS feeds available. Please try refreshing feeds.');
      }

      // RSS processing "succeeds" if we have any feeds at all
      // Individual feed source failures are handled at the feed level, not section level
      return {
        feeds: feeds // Just return the existing feeds
      };
    }

    // Use context limit based on aiConfig.numCtx for LM Studio (default 60000 for Ollama)
    const maxContextChars = aiConfig.provider === 'lmstudio' 
      ? Math.min((aiConfig.numCtx || 8192) * 2, 15000)  // ~2 chars per token, cap at 15000
      : 60000;
    const context = generateContext(feeds, maxContextChars);
    const feedIndex = generateFeedIndex(feeds);

    if (sectionId === 'narrative') {
      let narrative = '';
      const prompt = generateNarrativePrompt(context, aiConfig);
      if (onStream && aiConfig.provider !== 'lmstudio') {
        // Streaming for Ollama (LM Studio has format issues with streaming)
        await streamGenerateWithProvider(aiConfig, prompt, (c) => { narrative += c; onStream(narrative); });
      } else {
        // Non-streaming for LM Studio or when no stream callback
        console.log('[Narrative] Using non-streaming mode for', aiConfig.provider);
        narrative = await generateWithProvider(aiConfig, prompt);
        if (onStream) onStream(narrative);
      }
      const rawOutputs: Record<string, string> = { narrative: narrative || '' };
      return {
        narrative: finalizeNarrative(narrative),
        rawOutputs
      };
    }

    const prompts: any = {
      signals: async () => {
        const recentSignals = await getRecentSignalsForNovelty(7);
        return generateSignalsPrompt(context, feedIndex, recentSignals, aiConfig);
      },
      insights: generateInsightsPrompt(context, feedIndex, extraContext.signalsText || '', extraContext.signals || [], aiConfig),
      map: generateMapPointsPrompt(context, extraContext.signalsText || '', aiConfig),
      relations: async () => {
        const historicalContext = await getHistoricalRelationsContext(foreignRelations);
        return generateRelationsPrompt(
          context,
          foreignRelations,
          extraContext.narrative || '',
          extraContext.signals || [],
          extraContext.insights || [],
          extraContext.bigPicture || null,
          historicalContext,
          aiConfig
        );
      }
    };

    let res;
    let parseResult: JsonParseResult;
    if (sectionId === 'relations') {
      res = await generateWithProvider(aiConfig, await prompts.relations(), 'json', 'You must respond with valid JSON only.');
      parseResult = parseJsonArrayWithDetection(res);
    } else if (sectionId === 'signals') {
      let lastRes = '';
      let lastParse: JsonParseResult = { success: false, data: [], error: 'No attempt made', canRetry: true };

      for (let attempt = 0; attempt < 2; attempt++) {
        const basePrompt = await prompts.signals();
        const strictSuffix = attempt === 0
          ? ''
          : `\n\nFINAL CHECK (MANDATORY): Output ONLY a JSON array with 5-8 signal objects. If you produced a single object, wrap it in an array and add additional distinct signals until there are 5-8 total. Do not output any prose or markdown.`;

        lastRes = await generateWithProvider(aiConfig, `${basePrompt}${strictSuffix}`, undefined, 'You are an elite intelligence analyst.');

        lastParse = parseJsonArrayWithDetection(lastRes);
        if (!lastParse.success) continue;

        const clean = String(lastRes || '').trim();
        const looksLikeSingleObject = clean.startsWith('{') && !clean.startsWith('[');
        const tooFewSignals = Array.isArray(lastParse.data) && lastParse.data.length < 5;

        if (!looksLikeSingleObject && !tooFewSignals) break;
      }

      res = lastRes;
      parseResult = lastParse;
    } else {
      res = await generateWithProvider(aiConfig, prompts[sectionId], 'json', 'You must respond with valid JSON only.');
      parseResult = parseJsonArrayWithDetection(res);
    }

    if (!parseResult.success) {
      if (onJsonError) {
        onJsonError(parseResult.error || 'Unknown JSON parsing error', parseResult.canRetry);
      }
      throw new Error(parseResult.error);
    }

    if (sectionId === 'signals') {
      const recentSignals = await getRecentSignalsForNovelty(7);
      const rawOutputs: Record<string, string> = { signals: res || '' };
      return {
        signals: applyNoveltyScores(finalizeSignals(parseResult.data, feeds), recentSignals),
        rawOutputs
      };
    }
    if (sectionId === 'insights') {
      const rawOutputs: Record<string, string> = { insights: res || '' };
      return {
        insights: finalizeInsights(parseResult.data, feeds),
        rawOutputs
      };
    }
    if (sectionId === 'map') {
      const rawOutputs: Record<string, string> = { map: res || '' };
      return {
        mapPoints: finalizeMapPoints(parseResult.data, extraContext.signals || []),
        rawOutputs
      };
    }
    if (sectionId === 'relations') {
      const rawOutputs: Record<string, string> = { relations: res || '' };
      return {
        foreignRelations: finalizeRelations(parseResult.data, foreignRelations),
        rawOutputs
      };
    }

    // Fallback to full process if unknown section (shouldn't happen)
    return processSituation(feeds, foreignRelations, aiConfig, extraContext.bigPicture);

  } catch (error) {
    // Check if this was a cancellation
    if (error instanceof Error && (
      error.message.includes('cancelled') ||
      error.message.includes('AbortError') ||
      error.name === 'AbortError'
    )) {
      console.log(`Section ${sectionId} processing was cancelled`);
      throw new Error('Processing cancelled');
    }

    // Re-throw other errors
    throw error;
  } finally {
    // Always clean up the controller when done
    cancellationTokenManager.cleanupJob(jobId);
  }
}
