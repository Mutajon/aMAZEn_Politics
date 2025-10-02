// src/lib/contextualDilemmaAnalysis.ts
// Contextual analysis engine implementing NewDilemmaLogic.md rules

import type { DilemmaAction } from "./dilemma";
import type { PowerHolder } from "../store/roleStore";

export type CompassValues = {
  what: number[];
  whence: number[];
  how: number[];
  whither: number[];
};

export type SupportValues = {
  people: number;
  middle: number;
  mom: number;
};

export type EnhancedDilemmaContext = {
  // Core Context
  lastChoice: DilemmaAction | null;
  currentDay: number;
  totalDays: number;

  // From NewDilemmaLogic.md Rules
  politicalSystem: string;
  playerRole: string;
  isFirstDay: boolean;
  isLastDay: boolean;

  // Subject Focus (Rule #3)
  dilemmasSubjectEnabled: boolean;
  dilemmasSubject?: string;

  // Power Dynamics (Rule #4d.iv)
  powerHolders: PowerHolder[];
  playerIndex: number;

  // Support Analysis (Rule #4d.vi)
  supportValues: SupportValues;

  // Compass Analysis (Rule #4d.iii & #10)
  compassValues: CompassValues;

  // Topic Diversity (Rule #9)
  recentTopics: string[];
  topicCounts: Record<string, number>;
};

export type CompassTension = {
  component1: string;
  component2: string;
  description: string;
  intensity: number;
};

export type PowerHolderChallenge = {
  source: string;
  type: string;
  urgency: number;
  description: string;
};

export type SupportCrisis = {
  entity: string;
  level: number;
  severity: 'warning' | 'critical';
  description: string;
};

// Rule #4d.iii: Compass Tension Analysis
export function analyzeCompassTensions(compassValues: CompassValues): {
  dominantComponents: string[];
  tensions: CompassTension[];
} {
  const compassComponents = [
    // What (Ultimate goals)
    { name: "Truth", category: "what", index: 0, values: compassValues.what },
    { name: "Liberty", category: "what", index: 1, values: compassValues.what },
    { name: "Equality", category: "what", index: 2, values: compassValues.what },
    { name: "Care", category: "what", index: 3, values: compassValues.what },
    { name: "Loyalty", category: "what", index: 4, values: compassValues.what },
    { name: "Authority", category: "what", index: 5, values: compassValues.what },
    { name: "Sanctity", category: "what", index: 6, values: compassValues.what },
    { name: "Progress", category: "what", index: 7, values: compassValues.what },
    { name: "Tradition", category: "what", index: 8, values: compassValues.what },
    { name: "Security", category: "what", index: 9, values: compassValues.what },

    // Whence (Goal justification)
    { name: "Evidence", category: "whence", index: 0, values: compassValues.whence },
    { name: "Tradition", category: "whence", index: 1, values: compassValues.whence },
    { name: "Personal intuition", category: "whence", index: 2, values: compassValues.whence },
    { name: "Community consensus", category: "whence", index: 3, values: compassValues.whence },
    { name: "Religious doctrine", category: "whence", index: 4, values: compassValues.whence },
    { name: "Expert opinion", category: "whence", index: 5, values: compassValues.whence },
    { name: "Democratic process", category: "whence", index: 6, values: compassValues.whence },
    { name: "Market forces", category: "whence", index: 7, values: compassValues.whence },
    { name: "Historical precedent", category: "whence", index: 8, values: compassValues.whence },
    { name: "Moral principles", category: "whence", index: 9, values: compassValues.whence },

    // How (Means)
    { name: "Law", category: "how", index: 0, values: compassValues.how },
    { name: "Markets", category: "how", index: 1, values: compassValues.how },
    { name: "Mobilization", category: "how", index: 2, values: compassValues.how },
    { name: "Mutual Aid", category: "how", index: 3, values: compassValues.how },
    { name: "Technology", category: "how", index: 4, values: compassValues.how },
    { name: "Education", category: "how", index: 5, values: compassValues.how },
    { name: "Force", category: "how", index: 6, values: compassValues.how },
    { name: "Persuasion", category: "how", index: 7, values: compassValues.how },
    { name: "Ritual", category: "how", index: 8, values: compassValues.how },
    { name: "Negotiation", category: "how", index: 9, values: compassValues.how },

    // Whither (Recipients)
    { name: "Individual", category: "whither", index: 0, values: compassValues.whither },
    { name: "Community", category: "whither", index: 1, values: compassValues.whither },
    { name: "Nation", category: "whither", index: 2, values: compassValues.whither },
    { name: "Global", category: "whither", index: 3, values: compassValues.whither },
    { name: "Future generations", category: "whither", index: 4, values: compassValues.whither },
    { name: "Nature", category: "whither", index: 5, values: compassValues.whither },
    { name: "Family", category: "whither", index: 6, values: compassValues.whither },
    { name: "Economy", category: "whither", index: 7, values: compassValues.whither },
    { name: "Culture", category: "whither", index: 8, values: compassValues.whither },
    { name: "Marginalized", category: "whither", index: 9, values: compassValues.whither },
  ];

  // Find dominant components (value >= 7)
  const dominantComponents = compassComponents
    .filter(comp => comp.values[comp.index] >= 7)
    .map(comp => comp.name);

  // Identify tensions between high-value conflicting components
  const tensions: CompassTension[] = [];

  // Known tension pairs
  const tensionPairs = [
    { comp1: "Liberty", comp2: "Authority", description: "Personal freedom vs. institutional control" },
    { comp1: "Liberty", comp2: "Security", description: "Freedom vs. safety measures" },
    { comp1: "Equality", comp2: "Markets", description: "Equal outcomes vs. market efficiency" },
    { comp1: "Care", comp2: "Law", description: "Compassion vs. rule enforcement" },
    { comp1: "Progress", comp2: "Tradition", description: "Innovation vs. preservation" },
    { comp1: "Individual", comp2: "Community", description: "Personal rights vs. collective good" },
    { comp1: "Evidence", comp2: "Religious doctrine", description: "Scientific vs. faith-based reasoning" },
    { comp1: "Democratic process", comp2: "Expert opinion", description: "Popular will vs. expertise" },
  ];

  for (const pair of tensionPairs) {
    const comp1 = compassComponents.find(c => c.name === pair.comp1);
    const comp2 = compassComponents.find(c => c.name === pair.comp2);

    if (comp1 && comp2) {
      const value1 = comp1.values[comp1.index];
      const value2 = comp2.values[comp2.index];

      // Both components are significant (>= 5) and create tension
      if (value1 >= 5 && value2 >= 5) {
        tensions.push({
          component1: pair.comp1,
          component2: pair.comp2,
          description: pair.description,
          intensity: Math.min(value1, value2), // Tension intensity is limited by weaker component
        });
      }
    }
  }

  return {
    dominantComponents,
    tensions: tensions.sort((a, b) => b.intensity - a.intensity),
  };
}

// Rule #4d.iv: Power Holder Analysis
export function analyzePowerHolderChallenges(
  holders: PowerHolder[],
  playerIndex: number
): PowerHolderChallenge[] {
  const challenges: PowerHolderChallenge[] = [];

  holders.forEach((holder, index) => {
    if (index === playerIndex) return; // Skip player

    const urgency = Math.max(1, holder.percent / 20); // Higher percentage = more urgent

    // Generate potential challenges based on holder type
    let challengeType = "political";
    let description = `${holder.name} seeks to challenge your authority`;

    if (holder.name.toLowerCase().includes("military") || holder.name.toLowerCase().includes("security")) {
      challengeType = "security";
      description = `${holder.name} presents security concerns requiring your attention`;
    } else if (holder.name.toLowerCase().includes("economic") || holder.name.toLowerCase().includes("business")) {
      challengeType = "economic";
      description = `${holder.name} raises economic policy demands`;
    } else if (holder.name.toLowerCase().includes("religious") || holder.name.toLowerCase().includes("spiritual")) {
      challengeType = "cultural";
      description = `${holder.name} seeks moral guidance on governance`;
    } else if (holder.name.toLowerCase().includes("parliament") || holder.name.toLowerCase().includes("congress")) {
      challengeType = "legislative";
      description = `${holder.name} demands legislative priority`;
    }

    challenges.push({
      source: holder.name,
      type: challengeType,
      urgency,
      description,
    });
  });

  return challenges.sort((a, b) => b.urgency - a.urgency);
}

// Rule #4d.vi: Support Crisis Detection
export function detectSupportCrises(supportValues: SupportValues): SupportCrisis[] {
  const crises: SupportCrisis[] = [];

  Object.entries(supportValues).forEach(([entity, level]) => {
    if (level < 20) {
      const severity = level < 10 ? 'critical' : 'warning';
      let description = `${entity} support has dropped dangerously low`;

      if (entity === "people") {
        description = "Public unrest brewing - citizens demand action";
      } else if (entity === "mom") {
        description = "Personal allies questioning your leadership";
      } else {
        description = `${entity} growing increasingly hostile to your policies`;
      }

      crises.push({
        entity,
        level,
        severity,
        description,
      });
    }
  });

  return crises.sort((a, b) => a.level - b.level); // Most critical first
}

// Rule #9: Topic Diversity Management
export function ensureTopicDiversity(recentTopics: string[], topicCounts: Record<string, number>): {
  shouldChangeTopic: boolean;
  suggestedTopics: string[];
  avoidTopics: string[];
} {
  // If we have 3 or more of the same topic recently, force change
  const topicFrequency: Record<string, number> = {};
  recentTopics.forEach(topic => {
    topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
  });

  const shouldChangeTopic = Object.values(topicFrequency).some(count => count >= 3);
  const avoidTopics = Object.keys(topicFrequency).filter(topic => topicFrequency[topic] >= 2);

  // Suggest diverse topics
  const allTopics = [
    "Economic Policy",
    "Security & Defense",
    "Social Justice",
    "Environmental",
    "International Relations",
    "Healthcare",
    "Education",
    "Infrastructure",
    "Civil Liberties",
    "Cultural Issues",
    "Technology & Innovation",
    "Immigration",
  ];

  const suggestedTopics = allTopics.filter(topic => !avoidTopics.includes(topic));

  return {
    shouldChangeTopic,
    suggestedTopics,
    avoidTopics,
  };
}

// Helper function to build context from various sources
export function buildEnhancedContext(
  lastChoice: DilemmaAction | null,
  currentDay: number,
  totalDays: number,
  politicalSystem: string,
  playerRole: string,
  powerHolders: PowerHolder[],
  playerIndex: number,
  supportValues: SupportValues,
  compassValues: CompassValues,
  recentTopics: string[],
  topicCounts: Record<string, number>,
  dilemmasSubjectEnabled: boolean,
  dilemmasSubject?: string
): EnhancedDilemmaContext {
  return {
    lastChoice,
    currentDay,
    totalDays,
    politicalSystem,
    playerRole,
    isFirstDay: currentDay === 1,
    isLastDay: currentDay === totalDays,
    dilemmasSubjectEnabled,
    dilemmasSubject,
    powerHolders,
    playerIndex,
    supportValues,
    compassValues,
    recentTopics,
    topicCounts,
  };
}