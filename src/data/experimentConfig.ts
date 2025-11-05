/**
 * Experiment Configuration System
 *
 * Centralized configuration for A/B testing and research experiments.
 * Controls feature availability based on treatment assignment.
 *
 * Treatment Types:
 * - fullAutonomy: Player creates own actions only (no AI suggestions)
 * - semiAutonomy: Hybrid AI + custom actions (default balanced mode)
 * - noAutonomy: Only AI-generated actions (no custom input)
 *
 * Usage:
 * ```typescript
 * import { getTreatmentConfig } from '@/data/experimentConfig';
 * const config = getTreatmentConfig(treatment);
 * if (config.showCustomAction) { ... }
 * ```
 */

export type TreatmentType = 'fullAutonomy' | 'semiAutonomy' | 'noAutonomy';

export interface TreatmentConfig {
  id: TreatmentType;
  name: string;
  description: string;

  // Action Deck Configuration
  generateAIOptions: boolean;    // Whether to call API for AI actions (token optimization)
  showAIOptions: boolean;        // Show AI-generated actions in UI
  showCustomAction: boolean;     // Show "suggest your own" button

  // Inquiry System (future feature)
  inquiryTokensPerDilemma: number;

  // Reasoning Prompts (future features)
  mandatoryReasoningPrompts: number;
  optionalReasoningPrompts: number;
}

export const EXPERIMENT_CONFIG: Record<TreatmentType, TreatmentConfig> = {
  fullAutonomy: {
    id: 'fullAutonomy',
    name: 'Full Autonomy',
    description: 'Player creates own actions only',
    generateAIOptions: false,      // 🔥 Save tokens - don't generate AI options
    showAIOptions: false,          // Hide AI cards
    showCustomAction: true,        // Show only "suggest your own"
    inquiryTokensPerDilemma: 2,
    mandatoryReasoningPrompts: 3,
    optionalReasoningPrompts: 2,
  },
  semiAutonomy: {
    id: 'semiAutonomy',
    name: 'Semi Autonomy',
    description: 'Balanced AI support and player agency',
    generateAIOptions: true,       // Generate AI options
    showAIOptions: true,           // Show all 3 AI cards
    showCustomAction: true,        // Show "suggest your own" below
    inquiryTokensPerDilemma: 1,
    mandatoryReasoningPrompts: 2,
    optionalReasoningPrompts: 2,
  },
  noAutonomy: {
    id: 'noAutonomy',
    name: 'No Autonomy',
    description: 'AI-guided experience only',
    generateAIOptions: true,       // Generate AI options
    showAIOptions: true,           // Show all 3 AI cards
    showCustomAction: false,       // Hide "suggest your own" completely
    inquiryTokensPerDilemma: 0,
    mandatoryReasoningPrompts: 0,
    optionalReasoningPrompts: 0,
  },
};

/**
 * Get configuration for a specific treatment
 * Falls back to semiAutonomy if treatment is invalid
 */
export function getTreatmentConfig(treatment: TreatmentType): TreatmentConfig {
  const config = EXPERIMENT_CONFIG[treatment];
  if (!config) {
    console.warn(`[experimentConfig] Invalid treatment "${treatment}", falling back to semiAutonomy`);
    return EXPERIMENT_CONFIG.semiAutonomy;
  }
  return config;
}

/**
 * Get list of all available treatment types
 */
export function getAvailableTreatments(): TreatmentType[] {
  return Object.keys(EXPERIMENT_CONFIG) as TreatmentType[];
}

/**
 * Check if a treatment should generate AI options (for API optimization)
 * Falls back to semiAutonomy if treatment is invalid
 */
export function shouldGenerateAIOptions(treatment: TreatmentType): boolean {
  const config = EXPERIMENT_CONFIG[treatment];
  if (!config) {
    console.warn(`[experimentConfig] Invalid treatment "${treatment}", falling back to semiAutonomy`);
    return EXPERIMENT_CONFIG.semiAutonomy.generateAIOptions;
  }
  return config.generateAIOptions;
}
