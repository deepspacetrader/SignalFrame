
import { OllamaService } from './ollama';
import { RawSignal } from '../../services/feedIngest';
import { ForeignRelation, AiConfig } from '../../state/useSituationStore';

export const DEFAULT_MODEL = 'llama3.2';

const CATEGORY_MAP: Record<string, string> = {
  'narrative': 'narrative briefing',
  'signals': 'delta signals',
  'insights': 'hidden insights',
  'map': 'map coordinates',
  'relations': 'relation trackers'
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


export async function processSituation(
  feeds: RawSignal[],
  foreignRelations: ForeignRelation[] = [],
  aiConfig: AiConfig,
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

    onProgress?.(`Identifying ${CATEGORY_MAP.insights}...`);
    const insightsRaw = await OllamaService.generate(aiConfig.model, generateInsightsPrompt(context), 'json', options);

    onProgress?.(`Triangulating ${CATEGORY_MAP.map}...`);
    const mapPointsRaw = await OllamaService.generate(aiConfig.model, generateMapPointsPrompt(context), 'json', options);

    onProgress?.(`Updating ${CATEGORY_MAP.relations}...`);
    const relationsRaw = await OllamaService.generate(aiConfig.model, generateRelationsPrompt(context, foreignRelations), 'json', options);

    return {
      narrative: finalizeNarrative(narrative),
      thinkingTrace: thinkingTrace.trim(),
      signals: finalizeSignals(parseJsonArray(signalsRaw)),
      insights: finalizeInsights(parseJsonArray(insightsRaw)),
      mapPoints: finalizeMapPoints(parseJsonArray(mapPointsRaw)),
      foreignRelations: finalizeRelations(parseJsonArray(relationsRaw), foreignRelations)
    };
  } catch (error) {
    return handleProcessError(error);
  }
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

A signal is NOT just a headline; it is a shift in state, a pivot point, or a significant escalation.
DEDUPLICATE: If multiple sources report on the same event, synthesize them into ONE high-level signal with the most critical takeaway.

IGNORE: Routine updates, scheduled meetings without outcomes, and low-impact noise.
FOCUS ON: Sudden escalations, policy reversals, surprise outcomes, and breaks in historical patterns.

Return a JSON array of objects: [{"text": "PUNCHY_SIGNAL (MAX 15 WORDS)", "sentiment": "..."}].

SENTIMENT GUIDELINES:
${SENTIMENT_GUIDELINES}

Feeds:
${context}`;

}

function generateInsightsPrompt(context: string) {
  return `Identify up to 10 hidden trends and "reading between the lines" implications.
Return a JSON array of objects: [{"text": "TREND | IMPLICATION", "sentiment": "..."}].

SENTIMENT GUIDELINES:
${SENTIMENT_GUIDELINES}

Feeds:
${context}`;

}

function generateMapPointsPrompt(context: string) {
  return `Extract up to 10 geographical locations with sentiment from the news feeds.
Return a JSON array: [{"lat": ..., "lng": ..., "title": "CITY/REGION", "sentiment": "...", "category": "...", "description": "ONE LINE MAX", "sourceLink": "URL"}]

GUIDELINES:
- "title": Short location name (e.g. "Kyiv", "Taiwan Strait", "Silicon Valley")
- "description": ONE short sentence (max 80 chars) explaining the event. Be punchy and direct.
- "sourceLink": Include the original news article URL from the feed if available. If not available, leave empty string.
- "category": One of "Tech / AI", "Financial", "Conflicts", "Geopolitical"

SENTIMENT GUIDELINES:
${SENTIMENT_GUIDELINES}

Feeds:
${context}`;


}

function generateRelationsPrompt(context: string, relations: ForeignRelation[]) {
  return `Update status/sentiment for these geopolitical trackers:
${relations.map(r => `- ${r.countryA} vs ${r.countryB} (Topic: ${r.topic})`).join('\n')}

Return JSON array: [{"countryA": "...", "countryB": "...", "status": "...", "sentiment": "..."}]

The "status" field MUST be a brief (1-2 sentence) analysis explaining the current state AND the "why" based on the news feeds. Avoid one-word answers. It is critical that this is a detailed explanation.

SENTIMENT GUIDELINES (Use these EXACT strings for the sentiment field):
${SENTIMENT_GUIDELINES}

Feeds:
${context}`;

}

function parseJsonArray(text: string): any[] {
  let cleanText = text.trim();
  if (!cleanText) return [];
  if (cleanText.startsWith('[') && !cleanText.endsWith(']')) {
    let resArr = cleanText;
    if (resArr.includes('"') && (resArr.split('"').length % 2 === 0)) resArr += '"';
    if (resArr.includes('{') && (resArr.split('{').length > resArr.split('}').length)) resArr += '}';
    resArr += ']';
    try { const parsed = JSON.parse(resArr); if (Array.isArray(parsed)) return parsed.flat(1); } catch (err) { }
  }
  try {
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
  } catch (e) {
    const start = cleanText.indexOf('[');
    const end = cleanText.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      try { return JSON.parse(cleanText.substring(start, end + 1)).flat(1); } catch (e) { }
    }
    return cleanText.split('\n').map(l => l.replace(/^[-\d.*[\]{}'":\s,]+/, '').replace(/[\]{}'":\s,]+$/, '').trim()).filter(l => l.length > 15).slice(0, 12);
  }
}

function finalizeNarrative(narrative: string) {
  return narrative.trim().replace(/^(Briefing|Analysis|Summary):/i, '').trim();
}

const DEFAULT_SENTIMENT: any = 'neutral';

function finalizeSignals(raw: any[]) {
  return raw.map(s => {
    if (typeof s === 'string') return { text: s, sentiment: DEFAULT_SENTIMENT };
    const text = String(s.text || s.content || s.event || JSON.stringify(s));
    const sentiment = (s.sentiment || s.level || DEFAULT_SENTIMENT).toLowerCase();

    // Legacy mapping if AI uses old levels
    if (sentiment === 'high') return { text, sentiment: 'extremely-negative' };
    if (sentiment === 'medium') return { text, sentiment: 'negative' };
    if (sentiment === 'low') return { text, sentiment: 'neutral' };

    return { text, sentiment: sentiment as any };
  });
}

function finalizeInsights(raw: any[]) {
  return raw.map(i => {
    if (typeof i === 'string') return { text: i, sentiment: DEFAULT_SENTIMENT };
    const text = i.text || (i.trend && i.impact ? `${i.trend} | ${i.impact}` : JSON.stringify(i));
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
  return relations.map(rel => {
    const update = raw.find(r => (r.countryA === rel.countryA && r.countryB === rel.countryB) || (r.countryA === rel.countryB && r.countryB === rel.countryA));
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
  onStream?: (text: string) => void
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

  const prompts: any = { signals: generateSignalsPrompt(context), insights: generateInsightsPrompt(context), map: generateMapPointsPrompt(context), relations: generateRelationsPrompt(context, foreignRelations) };
  const res = await OllamaService.generate(aiConfig.model, prompts[sectionId], 'json', opt);

  if (sectionId === 'signals') return { signals: finalizeSignals(parseJsonArray(res)) };
  if (sectionId === 'insights') return { insights: finalizeInsights(parseJsonArray(res)) };
  if (sectionId === 'map') return { mapPoints: finalizeMapPoints(parseJsonArray(res)) };
  if (sectionId === 'relations') return { foreignRelations: finalizeRelations(parseJsonArray(res), foreignRelations) };

  return processSituation(feeds, foreignRelations, aiConfig);
}
