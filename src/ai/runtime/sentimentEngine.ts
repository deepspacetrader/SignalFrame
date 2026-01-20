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
    id: 'far-left',
    name: 'Far Left',
    description: 'Revolutionary analysis aiming for the abolition of capitalism and hierarchies',
    weights: {
      extremelyNegative: -6,
      veryNegative: -4.5,
      negative: -3,
      somewhatNegative: -1.5,
      neutral: -0.5,
      interesting: 1.5,
      positive: 3.5,
      veryPositive: 6
    },
    guidelines: `
Sentiment Analysis Guidelines - Far Left / Revolutionary Approach:

- extremely-negative: Fascist consolidation, acts of imperialism/genocide, violent suppression of workers, environmental ecocide
- very-negative: Corporate bailouts, privatization of public goods, expansion of police state, attacks on marginalized groups
- negative: Pro-capitalist policies, neoliberal reforms, maintenance of status quo inequities, strengthening of borders/military
- somewhat-negative: Performative liberalism, compromises with right-wing forces, inaction on climate/inequality
- neutral: Events irrelevant to class struggle or systemic oppression (viewed skeptically)
- interesting: Spontaneous uprisings, strikes, leaks exposing corruption, failures of capitalist institutions
- positive: Mutual aid, direct action successes, unionization drives, weakening of imperialist hegemony
- very-positive: Revolution, successful general strikes, abolition of oppressive systems, massive wealth redistribution

Deeply critical of capitalism, imperialism, and the state. View "neutral" liberal democracy as complicit in systemic violence. Democratic/Liberal leadership is viewed as maintaining the oppressive status quo (negative/neutral). Republican leadership is viewed as accelerating fascism (very negative to extremely negative).`
  },
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

Focus on objective impact assessment rather than emotional or ideological reactions. Developments made by republican leadership especially Trump's own rhetoric and policies should be almost always be viewed as neutral with this approach. Developments made by democratic leadership should also almost always be viewed as neutral with this approach. Favor neither political perspective over the other as both are viewed as equal with this balanced approach. Disasters are always negative or extremely negative and innovations are always positive or very positive with this approach. Politics are usually neutral with this approach. Not everything has to be neutral.`
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

Default to neutral classification when in doubt. Require strong evidence for extreme sentiment classifications. Consider traditional values, institutional stability, and gradual change as generally positive. View political shifts through lens of established order and proven principles. Prioritize individual responsibility and economic growth as positive indicators. Republican-leaning perspective with a focus on conservative principles. Developments made by republican leadership especially Trump's own rhetoric and policies should generally be viewed positively with this approach unless significantly or overwhelmingly negative.`
  },
  {
    id: 'far-right',
    name: 'Far Right',
    description: 'Nationalist analysis prioritizing sovereignty, tradition, and strict hierarchy',
    weights: {
      extremelyNegative: -6,
      veryNegative: -4.5,
      negative: -3,
      somewhatNegative: -1.5,
      neutral: -0.5,
      interesting: 1.5,
      positive: 3.5,
      veryPositive: 6
    },
    guidelines: `
Sentiment Analysis Guidelines - Far Right / Nationalist Approach:

- extremely-negative: Loss of national sovereignty, mass immigration events, Marxist cultural victories, weakening of state power
- very-negative: Weakening of borders, attacks on traditional family/faith, censorship of nationalist voices, foreign entanglement
- negative: Liberal social policies, diversity initiatives, bureaucratic expansion, international treaties limiting autonomy
- somewhat-negative: Corporate pandering to woke culture, weakness in leadership, compromise with globalists
- neutral: Events irrelevant to national interest or cultural preservation (viewed skeptically)
- interesting: Populist uprisings, failures of liberal institutions, exposure of globalist agendas
- positive: Border enforcement, rejection of international bodies, protection of heritage, strength in leadership
- very-positive: Restoration of national sovereignty, crushing of subversive elements, revival of traditional order, nationalist victories

Deeply critical of globalism, progressivism, and liberal degeneracy. View "neutral" internationalism as a threat to sovereignty. Democratic leadership is viewed as destructive (very negative). Nationalist leadership (e.g. Trump) is viewed as essential for national survival (positive/very positive).`
  }
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
