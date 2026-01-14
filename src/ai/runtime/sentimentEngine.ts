import type { Sentiment } from '../../state/useSituationStore';

export interface SentimentWeights {
  extremelyNegative: number;
  veryNegative: number;
  negative: number;
  somewhatNegative: number;
  neutral: number;
  interesting: number;
  positive: number;
  veryPositive: number;
}

export interface SentimentProfile {
  id: string;
  name: string;
  description: string;
  weights: SentimentWeights;
  guidelines: string;
}

export const DEFAULT_SENTIMENT_WEIGHTS: SentimentWeights = {
  extremelyNegative: -4,
  veryNegative: -3,
  negative: -2,
  somewhatNegative: -1,
  neutral: 0,
  interesting: 0.5,
  positive: 2,
  veryPositive: 3
};

export const SENTIMENT_PROFILES: SentimentProfile[] = [
  {
    id: 'progressive',
    name: 'Progressive',
    description: 'Socialist-leaning analysis emphasizing collective welfare and economic equality',
    weights: {
      extremelyNegative: -5,
      veryNegative: -3.5,
      negative: -2,
      somewhatNegative: -1,
      neutral: 0,
      interesting: 1,
      positive: 2.5,
      veryPositive: 4
    },
    guidelines: `
Sentiment Analysis Guidelines - Progressive Approach:

- extremely-negative: Systemic economic collapses, mass layoffs, austerity measures, corporate exploitation, environmental disasters
- very-negative: Major economic crises, widening inequality, significant social safety net cuts, labor rights violations
- negative: Economic downturns, corporate consolidation, reduced social services, rising unemployment, policy regressive for working class
- somewhat-negative: Emerging economic challenges, early signs of inequality, corporate influence on policy, gradual social service erosion
- neutral: Routine economic events, policy announcements, market fluctuations without clear social impact
- interesting: Economic experiments, alternative economic models, emerging labor movements, discussions of systemic change
- positive: Labor rights advances, social program expansions, wealth redistribution efforts, corporate accountability measures, environmental protections
- very-positive: Major social welfare expansions, significant labor victories, transformative economic policies, worker empowerment initiatives

Prioritize economic equality, social safety nets, and protection of vulnerable populations. View economic events through lens of class dynamics and systemic power structures.`
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Neutral, objective sentiment analysis',
    weights: DEFAULT_SENTIMENT_WEIGHTS,
    guidelines: `
Sentiment Analysis Guidelines - Balanced Approach:

- extremely-negative: Large-scale humanitarian crises, major disasters, wars with significant casualties
- very-negative: Serious conflicts, major economic crises, significant political instability
- negative: Economic downturns, political tensions, concerning developments
- somewhat-negative: Minor escalations, emerging concerns, slight negative trends
- neutral: Factual reports, scheduled events, data without clear positive/negative implications
- interesting: Unusual developments, emerging trends, notable but not clearly positive/negative
- positive: Economic improvements, diplomatic progress, beneficial developments
- very-positive: Major breakthroughs, significant peace agreements, transformative positive events

Focus on objective impact assessment rather than emotional or ideological reactions.`
  },
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Capitalist-leaning analysis emphasizing free markets and individual responsibility',
    weights: {
      extremelyNegative: -3,
      veryNegative: -2.5,
      negative: -1.5,
      somewhatNegative: -0.5,
      neutral: 0,
      interesting: 0.25,
      positive: 1.5,
      veryPositive: 2
    },
    guidelines: `
Sentiment Analysis Guidelines - Conservative Approach:

- extremely-negative: Only for catastrophic events with widespread severe impact
- very-negative: Major crises with confirmed significant negative consequences
- negative: Clear negative developments with documented impact
- somewhat-negative: Minor negative trends or potential concerns
- neutral: Default position - most events should be considered neutral unless clearly positive/negative
- interesting: Notable developments that don't clearly fit other categories
- positive: Confirmed beneficial developments with measurable positive impact
- very-positive: Exceptional positive events with widespread beneficial effects

Default to neutral classification when in doubt. Require strong evidence for extreme sentiment classifications. Consider traditional values, institutional stability, and gradual change as generally positive. View political shifts through lens of established order and proven principles. Prioritize free market principles, individual responsibility, and economic growth as positive indicators.`
  },
];

export function getSentimentProfile(profileId: string): SentimentProfile {
  return SENTIMENT_PROFILES.find(p => p.id === profileId) || SENTIMENT_PROFILES[0];
}

export function calculateSentimentScore(sentiment: Sentiment, weights: SentimentWeights): number {
  const scoreMap: Record<Sentiment, keyof SentimentWeights> = {
    'extremely-negative': 'extremelyNegative',
    'very-negative': 'veryNegative',
    'negative': 'negative',
    'somewhat-negative': 'somewhatNegative',
    'neutral': 'neutral',
    'interesting': 'interesting',
    'positive': 'positive',
    'very-positive': 'veryPositive'
  };
  
  return weights[scoreMap[sentiment]] || 0;
}

export function normalizeSentiment(
  originalSentiment: string, 
  profile: SentimentProfile
): Sentiment {
  // Map various sentiment strings to standardized values
  const sentimentMap: Record<string, Sentiment> = {
    'extremely-negative': 'extremely-negative',
    'very-negative': 'very-negative',
    'negative': 'negative',
    'somewhat-negative': 'somewhat-negative',
    'neutral': 'neutral',
    'interesting': 'interesting',
    'positive': 'positive',
    'very-positive': 'very-positive'
  };
  
  return sentimentMap[originalSentiment.toLowerCase()] || 'neutral';
}

export function generateCustomSentimentGuidelines(profile: SentimentProfile): string {
  return profile.guidelines.trim();
}
