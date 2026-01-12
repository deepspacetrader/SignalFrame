
import { OllamaService } from './ollama';
import { RawSignal } from '../../services/feedIngest';
import { ForeignRelation, AiConfig } from '../../state/useSituationStore';
import { StorageService } from '../../services/db';

export const DEFAULT_MODEL = 'llama3.2';

const CATEGORY_MAP: Record<string, string> = {
  'narrative': 'narrative briefing',
  'signals': 'delta signals',
  'insights': 'hidden insights',
  'map': 'map coordinates',
  'relations': 'relation trackers',
  'bigPicture': 'grand strategy analysis'
};

const SENTIMENT_GUIDELINES = `
- extremely-negative: Active conflict, major human rights violations, total market collapse, or massive loss of life, disasters, wars.
- very-negative: Significant escalations in tension, religious/political crackdowns, or major economic downturns, riots.
- negative: General negative news, minor diplomatic friction, or unfavorable economic indicators, protests.
- somewhat-negative: Emerging concerns or slight escalations in regional tension, civil unrest.
- neutral: Raw data points, scheduled events, or shifts without immediate clear impact.
- interesting: Unpredictable or unusual developments that aren't clearly good or bad.
- positive: Diplomatic resolutions, medical breakthroughs, signs of economic recovery, justice being served.
- very-positive: Peaceful resolutions to long-standing conflicts or transformative humanitarian progress, fall of a dictator.
`;


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
  onThinkingChunk?: (chunk: string) => void
) {
  const context = generateContext(feeds);
  const options = { num_ctx: aiConfig.numCtx, num_predict: aiConfig.numPredict };

  try {
    onProgress?.(`Generating ${CATEGORY_MAP.narrative}...`);
    const narrativePrompt = generateNarrativePrompt(context);

    let narrative = '';
    let thinkingTrace = '';

    if (aiConfig.enableThinking) {
      // Use thinking-enabled streaming for narrative
      onProgress?.(`Deep reasoning (thinking mode)...`);
      await OllamaService.streamGenerateWithThinking(
        aiConfig.model,
        narrativePrompt,
        (thinkChunk) => {
          thinkingTrace += thinkChunk;
          onThinkingChunk?.(thinkingTrace);
        },
        (contentChunk) => {
          narrative += contentChunk;
          onNarrativeChunk?.(narrative);
        },
        options
      );
    } else if (onNarrativeChunk) {
      await OllamaService.streamGenerate(aiConfig.model, narrativePrompt, (chunk) => {
        narrative += chunk;
        onNarrativeChunk(narrative);
      }, options);
    } else {
      narrative = await OllamaService.generate(aiConfig.model, narrativePrompt, undefined, options);
    }

    onProgress?.(`Generating ${CATEGORY_MAP.signals}...`);
    const signalsRaw = await OllamaService.generate(aiConfig.model, generateSignalsPrompt(context), 'json', options);
    const parsedSignals = finalizeSignals(parseJsonArray(signalsRaw));
    const signalsText = parsedSignals.map(s => `- ${s.text} [Sentiment: ${s.sentiment}]`).join('\n');

    onProgress?.(`Identifying ${CATEGORY_MAP.insights}...`);
    const insightsRaw = await OllamaService.generate(aiConfig.model, generateInsightsPrompt(context, signalsText), 'json', options);

    onProgress?.(`Triangulating ${CATEGORY_MAP.map}...`);
    const mapPointsRaw = await OllamaService.generate(aiConfig.model, generateMapPointsPrompt(context, signalsText), 'json', options);

    onProgress?.(`Updating ${CATEGORY_MAP.relations}...`);
    const historicalContext = await getHistoricalRelationsContext(foreignRelations);
    const relationsRaw = await OllamaService.generate(aiConfig.model, generateRelationsPrompt(context, foreignRelations, narrative, parsedSignals, finalizeInsights(parseJsonArray(insightsRaw)), bigPicture, historicalContext), 'json', options);

    return {
      narrative: finalizeNarrative(narrative),
      thinkingTrace: thinkingTrace.trim(),
      signals: parsedSignals,
      insights: finalizeInsights(parseJsonArray(insightsRaw)),
      mapPoints: finalizeMapPoints(parseJsonArray(mapPointsRaw)),
      foreignRelations: finalizeRelations(parseJsonArray(relationsRaw), foreignRelations)
    };
  } catch (error) {
    return handleProcessError(error);
  }
}

export async function processBigPicture(
  history: any[],
  aiConfig: AiConfig,
  onStream?: (chunk: string) => void
) {
  // Construct context for the Grand Narrative
  const context = history.map(h => `DATE: ${h.date}\nSUMMARY: ${h.narrative}\nSIGNALS: ${h.signals.length} detected.`).join('\n\n');
  const options = { num_ctx: aiConfig.numCtx, num_predict: aiConfig.numPredict };

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
  const narrativePrompt = `
Based on the following historical data of daily briefings, write a "Grand Narrative" that explains the overall trajectory of world events.
Focus on the connections between days, the escalation of tensions, or the resolution of conflicts.
This should be a high-level strategic overview, not a day-by-day recount.
Identify the "Meta-Narrative" - what is the big story happening underneath the noise?

HISTORY:
${context}
`;

  let summary = '';
  if (onStream) {
    await OllamaService.streamGenerate(aiConfig.model, narrativePrompt, (chunk) => {
      summary += chunk;
      onStream(chunk);
    }, options);
  } else {
    summary = await OllamaService.generate(aiConfig.model, narrativePrompt, undefined, options);
  }

  return {
    summary: finalizeNarrative(summary),
    timeline: timeline
  };
}


function generateContext(feeds: RawSignal[]) {
  const grouped = feeds.reduce((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(`[${f.source}] ${f.content}`);
    return acc;
  }, {} as Record<string, string[]>);

  return Object.entries(grouped)
    .map(([category, items]) => `### CATEGORY: ${category}\n${items.join('\n')}`)
    .join('\n\n');
}

function generateNarrativePrompt(context: string) {
  return `Analyze these news feeds and provide a short but comprehensive Situation Briefing. 
Do not focus on only one event. Instead, synthesize the top 5 most critical global themes currently developing.
Keep the tone clinical, objective, and professional. Skip introductions and closings. Do not include any additional text and especially do not include any em dashes or other additional formatting. Just text.

Feeds:
${context}`;
}

function generateSignalsPrompt(context: string) {
  return `Act as a senior intelligence officer. Filter and SYNTHESIZE the following news feeds to identify the 5-8 most critical "delta" signals. 
1. A signal is NOT just a headline; it is a shift in state, a pivot point, or a significant escalation.
2. DEDUPLICATE: If multiple sources report on the same event, synthesize them into ONE high-level signal with the most critical takeaway. DO NOT repeat yourself.
3. IGNORE: Routine updates, scheduled meetings without outcomes, and low-impact noise.
4. FOCUS ON: Sudden escalations, policy reversals, surprise outcomes, and breaks in historical patterns.
5. EXCLUDE: Sports scores/updates, celebrity gossip, movie release, and hyper-local crime stories (unless there are mass casualties).
6. Return a JSON array of objects: [{"text": "PUNCHY_SIGNAL (MAX 15 WORDS)", "sentiment": "..."}].

SENTIMENT GUIDELINES:
${SENTIMENT_GUIDELINES}

Feeds:
${context}`;

}

function generateInsightsPrompt(context: string, signalsContext: string = '') {
  return `Analyze the Key Signals and News Feeds to generate up to 8 "Hidden Insights".
  
Use this strict definition for Insights:
- Focus: Explaining past or current phenomena, identifying root causes and patterns.
- Time Orientation: Primarily backward-looking (diagnostic/descriptive).
- Goal: Answer "Why did this happen?" or "What does this mean?"
- Exclude: Do NOT generate predictions or future forecasts.

Format: "OBSERVATION/PATTERN | ROOT CAUSE ANALYSIS"

Return a JSON array of objects: [{"text": "PATTERN | CAUSE", "sentiment": "..."}].

KEY SIGNALS:
${signalsContext}

SENTIMENT GUIDELINES:
${SENTIMENT_GUIDELINES}

Feeds:
${context}`;

}

function generateMapPointsPrompt(context: string, signalsContext: string = '') {
  return `Generate geographical map coordinates for the Key Signals listed below.
CRITICAL: You MUST attempt to generate a map point for EVERY Key Signal provided.
If a specific city/location is not mentioned, deduce the most relevant country or region (e.g. use the capital city).
ENSURE DIVERSITY: Do not put all points on the same coordinate. Spread them out if they are in the same country.

Return a JSON array: [{"lat": ..., "lng": ..., "title": "CITY/REGION", "sentiment": "...", "category": "...", "description": "ONE LINE MAX", "sourceLink": "URL"}]

GUIDELINES:
- "title": Short location name (e.g. "Kyiv", "Taiwan Strait", "Silicon Valley")
- "description": Use the text of the Key Signal as the description, or a shortened version of it.
- "sourceLink": Include the original news article URL from the feed if available. If not available, leave empty string.
- "category": One of "Tech / AI", "Financial", "Conflicts", "Geopolitical"

KEY SIGNALS TO PLOT:
${signalsContext}

SENTIMENT GUIDELINES:
${SENTIMENT_GUIDELINES}

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
  historicalContext: string = ''
) {
  let deepContext = `### INTELLIGENCE CONTEXT\n`;
  if (narrative) deepContext += `CURRENT SITUATION NARRATIVE:\n${narrative}\n\n`;
  if (signals && signals.length) deepContext += `KEY SIGNALS:\n${signals.map(s => `- ${s.text} (${s.sentiment})`).join('\n')}\n\n`;
  if (insights && insights.length) deepContext += `HIDDEN INSIGHTS:\n${insights.map(i => `- ${i.text}`).join('\n')}\n\n`;
  if (bigPicture) deepContext += `THE BIG PICTURE (STRATEGIC OVERVIEW):\n${bigPicture.summary}\n\n`;
  if (historicalContext) deepContext += `HISTORICAL CONTEXT (Previous relevant data):\n${historicalContext}\n\n`;

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
${SENTIMENT_GUIDELINES}

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
        const arrayProp = Object.values(parsed).find(v => Array.isArray(v));
        if (arrayProp && Array.isArray(arrayProp)) return arrayProp.flat(1);
        const keys = Object.keys(parsed);
        if (keys.every(k => k.includes('|') || k.length > 20)) return keys;
        const values = Object.values(parsed);
        return values.every(v => typeof v === 'string') && values.length > 1 ? values : [parsed];
      }
      return Array.isArray(parsed) ? parsed.flat(1) : [parsed];
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
  return result.success ? result.data : [];
}

function finalizeNarrative(narrative: string) {
  return narrative.trim().replace(/^(Briefing|Analysis|Summary):/i, '').trim();
}

const DEFAULT_SENTIMENT: any = 'neutral';

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

function finalizeSignals(raw: any[]) {
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
    throw new Error(errorItem?.error || 'JSON parsing error in signals');
  }

  const processedSignals = raw.map(s => {
    if (typeof s === 'string') return { text: s, sentiment: DEFAULT_SENTIMENT };
    
    // Extract text from various possible fields
    let text = '';
    if (s.text) {
      text = s.text;
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

    // Legacy mapping if AI uses old levels
    if (sentiment === 'high') return { text, sentiment: 'extremely-negative' };
    if (sentiment === 'medium') return { text, sentiment: 'negative' };
    if (sentiment === 'low') return { text, sentiment: 'neutral' };

    return { text, sentiment: sentiment as any };
  });

  // Remove duplicates and essentially the same signals
  return deduplicateSignals(processedSignals);
}

function finalizeInsights(raw: any[]) {
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
    throw new Error(errorItem?.error || 'JSON parsing error in insights');
  }

  return raw.map(i => {
    if (typeof i === 'string') return { text: i, sentiment: DEFAULT_SENTIMENT };
    
    // Handle malformed objects like {"34":"text...", "sentiment":"interesting"}
    let text = '';
    if (i.text) {
      text = i.text;
    } else if (i.trend && i.impact) {
      text = `${i.trend} | ${i.impact}`;
    } else {
      // Extract text from malformed objects
      const keys = Object.keys(i).filter(k => k !== 'sentiment');
      if (keys.length === 1) {
        // Single non-sentiment key, use its value
        const key = keys[0];
        text = String(i[key]);
      } else {
        // Multiple keys, try to find the most likely text content
        const textKey = keys.find(k => 
          typeof i[k] === 'string' && 
          i[k].length > 20 && 
          !k.includes('sentiment')
        );
        text = textKey ? String(i[textKey]) : JSON.stringify(i);
      }
    }
    
    let sentiment = String(i.sentiment || DEFAULT_SENTIMENT).toLowerCase();

    // Mapping for numeric or common string sentiments
    const sentimentMap: Record<string, string> = {
      '1': 'extremely-negative', '2': 'very-negative', '3': 'negative', '4': 'somewhat-negative',
      '5': 'neutral', '6': 'interesting', '7': 'positive', '8': 'very-positive'
    };
    if (sentimentMap[sentiment]) sentiment = sentimentMap[sentiment];

    return { text, sentiment: sentiment as any };
  }).filter(i => i.text.length > 10); // Relaxed: No longer requiring '|' if it's long enough
}


function finalizeMapPoints(raw: any[]) {
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
    throw new Error(errorItem?.error || 'JSON parsing error in map points');
  }

  return raw.map((p, idx) => {
    // Truncate description to max 100 chars for compact popups
    let desc = String(p.description || '').trim();
    if (desc.length > 100) desc = desc.substring(0, 97) + '...';

    return {
      id: `map-${idx}`,
      lat: Number(p.lat) || 0,
      lng: Number(p.lng) || 0,
      title: p.title || 'Event',
      sentiment: p.sentiment || 'neutral',
      category: p.category || 'Geopolitical',
      description: desc,
      sourceLink: p.sourceLink || p.source_link || p.link || ''
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
) {
  const context = generateContext(feeds);
  const opt = { num_ctx: aiConfig.numCtx, num_predict: aiConfig.numPredict };

  if (sectionId === 'narrative') {
    let narrative = '';
    const prompt = generateNarrativePrompt(context);
    if (onStream) {
      await OllamaService.streamGenerate(aiConfig.model, prompt, (c) => { narrative += c; onStream(narrative); }, opt);
    } else {
      narrative = await OllamaService.generate(aiConfig.model, prompt, undefined, opt);
    }
    return { narrative: finalizeNarrative(narrative) };
  }

  const prompts: any = {
    signals: generateSignalsPrompt(context),
    insights: generateInsightsPrompt(context), // Note: Single section update for insights might lack signals context if we don't pass it. Assuming partial update is rare or handled elsewhere.
    map: generateMapPointsPrompt(context),
    relations: async () => {
      const historicalContext = await getHistoricalRelationsContext(foreignRelations);
      return generateRelationsPrompt(
        context,
        foreignRelations,
        extraContext.narrative || '',
        extraContext.signals || [],
        extraContext.insights || [],
        extraContext.bigPicture || null,
        historicalContext
      );
    }
  };

  let res;
  if (sectionId === 'relations') {
    res = await OllamaService.generate(aiConfig.model, await prompts.relations(), 'json', opt);
  } else {
    res = await OllamaService.generate(aiConfig.model, prompts[sectionId], 'json', opt);
  }

  // Use enhanced JSON parsing with error detection
  const parseResult = parseJsonArrayWithDetection(res);
  
  if (!parseResult.success) {
    if (onJsonError) {
      onJsonError(parseResult.error || 'Unknown JSON parsing error', parseResult.canRetry);
    }
    throw new Error(parseResult.error);
  }

  if (sectionId === 'signals') return { signals: finalizeSignals(parseResult.data) };
  if (sectionId === 'insights') return { insights: finalizeInsights(parseResult.data) };
  if (sectionId === 'map') return { mapPoints: finalizeMapPoints(parseResult.data) };
  if (sectionId === 'relations') return { foreignRelations: finalizeRelations(parseResult.data, foreignRelations) };

  // Fallback to full process if unknown section (shouldn't happen)
  return processSituation(feeds, foreignRelations, aiConfig, extraContext.bigPicture);
}
