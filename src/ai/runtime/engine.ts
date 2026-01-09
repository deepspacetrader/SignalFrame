
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

export async function processSituation(
  feeds: RawSignal[],
  foreignRelations: ForeignRelation[] = [],
  aiConfig: AiConfig,
  onProgress?: (status: string) => void,
  onNarrativeChunk?: (chunk: string) => void
) {
  const context = generateContext(feeds);
  const options = { num_ctx: aiConfig.numCtx, num_predict: aiConfig.numPredict };

  try {
    onProgress?.(`Generating ${CATEGORY_MAP.narrative}...`);
    const narrativePrompt = generateNarrativePrompt(context);

    let narrative = '';
    if (onNarrativeChunk) {
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
Keep the tone clinical, objective, and professional. Skip introductions and closings. Do not include any additional text and especially do not include any emdashes or other additional formatting. Just text.

Feeds:
${context}`;
}

function generateSignalsPrompt(context: string) {
  return `Identify up to 10 most significant "delta" changes or escalations.
Return a JSON array of objects: [{"text": "...", "sentiment": "..."}].

SENTIMENT GUIDELINES:
- extremely-negative: Active conflict, major human rights violations, total market collapse, or massive loss of life, disasters.
- very-negative: Significant escalations in tension, religious/political crackdowns, or major economic downturns.
- negative: General negative news, minor diplomatic friction, or unfavorable economic indicators.
- somewhat-negative: Emerging concerns or slight escalations in regional tension.
- neutral: Raw data points, scheduled events, or shifts without immediate clear impact.
- interesting: Unpredictable or unusual developments that aren't clearly good or bad.
- positive: Diplomatic resolutions, medical breakthroughs, signs of economic recovery.
- very-positive: Peaceful resolutions to long-standing conflicts or transformative humanitarian progress.

Feeds:
${context}`;
}

function generateInsightsPrompt(context: string) {
  return `Identify up to 10 hidden trends and "reading between the lines" implications.
Return a JSON array of objects: [{"text": "TREND | IMPLICATION", "sentiment": "..."}].

Use the SENTIMENT GUIDELINES as defined for signals.

Feeds:
${context}`;
}

function generateMapPointsPrompt(context: string) {
  return `Extract up to 10 geographical locations with sentiment.
Return a JSON array of objects with id, lat, lng, title, sentiment, category.

Use the SENTIMENT GUIDELINES scale for each location.

Feeds:
${context}`;
}

function generateRelationsPrompt(context: string, relations: ForeignRelation[]) {
  return `Update status/sentiment for these trackers:
${relations.map(r => `- ${r.countryA} vs ${r.countryB}`).join('\n')}

Return JSON array: [{"countryA": "...", "countryB": "...", "status": "...", "sentiment": "..."}]

Use the SENTIMENT GUIDELINES scale for each foreign relationship tracker.
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
    const sentiment = (i.sentiment || DEFAULT_SENTIMENT).toLowerCase();
    return { text, sentiment: sentiment as any };
  }).filter(i => i.text.includes('|') && i.text.length > 15);
}

function finalizeMapPoints(raw: any[]) {
  return raw.map((p, idx) => ({
    id: `map-${idx}`,
    lat: Number(p.lat) || 0,
    lng: Number(p.lng) || 0,
    title: p.title || 'Event',
    sentiment: p.sentiment || 'neutral',
    category: p.category || 'Geopolitical'
  }));
}

function finalizeRelations(raw: any[], relations: ForeignRelation[]) {
  return relations.map(rel => {
    const update = raw.find(r => (r.countryA === rel.countryA && r.countryB === rel.countryB) || (r.countryA === rel.countryB && r.countryB === rel.countryA));
    return update ? {
      ...rel,
      status: String(update.status || rel.status),
      sentiment: String(update.sentiment || rel.sentiment) as any,
      lastUpdate: new Date().toISOString()
    } : rel;
  });
}

function handleProcessError(error: any) {
  console.error('AI Error:', error);
  return { narrative: "Engine error.", signals: [], insights: [], mapPoints: [], foreignRelations: [] };
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
