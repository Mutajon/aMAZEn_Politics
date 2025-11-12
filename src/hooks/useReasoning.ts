import { useCallback, useMemo } from 'react';
import { useDilemmaStore } from '../store/dilemmaStore';
import { useSettingsStore } from '../store/settingsStore';
import type { TreatmentType } from '../data/experimentConfig';

/**
 * Hook for managing reasoning prompts during gameplay.
 *
 * Reasoning prompts ask players to explain their decision-making process
 * at specific points during the game, based on their assigned treatment.
 *
 * Schedule by Treatment:
 * - fullAutonomy: Days 2(M), 3(O), 5(M), 6(O), 7(M) = 3 mandatory, 2 optional
 * - semiAutonomy: Days 2(M), 3(O), 5(M), 6(O) = 2 mandatory, 2 optional
 * - noAutonomy: Never
 *
 * M = Mandatory (no skip), O = Optional (can skip)
 */

export type ReasoningPromptType = 'none' | 'mandatory' | 'optional';

interface ValidationResult {
  isValid: boolean;
  reason?: 'too_short' | 'all_same_char' | 'no_letters' | 'only_numbers';
  message?: string;
}

/**
 * Determines the reasoning prompt type for a given treatment and day.
 */
export function getReasoningPromptType(
  treatment: TreatmentType,
  day: number
): ReasoningPromptType {
  // No autonomy: never show reasoning
  if (treatment === 'noAutonomy') {
    return 'none';
  }

  // Full autonomy schedule: [none, mandatory, optional, none, mandatory, optional, mandatory]
  if (treatment === 'fullAutonomy') {
    const schedule: ReasoningPromptType[] = [
      'none',      // Day 1
      'mandatory', // Day 2
      'optional',  // Day 3
      'none',      // Day 4
      'mandatory', // Day 5
      'optional',  // Day 6
      'mandatory', // Day 7
    ];
    return schedule[day - 1] ?? 'none';
  }

  // Semi autonomy schedule: [none, mandatory, optional, none, mandatory, optional, none]
  if (treatment === 'semiAutonomy') {
    const schedule: ReasoningPromptType[] = [
      'none',      // Day 1
      'mandatory', // Day 2
      'optional',  // Day 3
      'none',      // Day 4
      'mandatory', // Day 5
      'optional',  // Day 6
      'none',      // Day 7
    ];
    return schedule[day - 1] ?? 'none';
  }

  return 'none';
}

/**
 * Validates reasoning text to prevent gibberish submissions.
 *
 * Checks:
 * 1. Minimum 10 characters
 * 2. Not all the same character
 * 3. Contains at least some letters
 * 4. Not just numbers and symbols
 */
export function validateReasoningText(text: string): ValidationResult {
  const trimmed = text.trim();

  // Check minimum length
  if (trimmed.length < 10) {
    return {
      isValid: false,
      reason: 'too_short',
      message: 'Please write at least 10 characters.',
    };
  }

  // Check if all same character
  const uniqueChars = new Set(trimmed.split(''));
  if (uniqueChars.size === 1) {
    return {
      isValid: false,
      reason: 'all_same_char',
      message: 'Please provide meaningful text.',
    };
  }

  // Check if contains letters
  const hasLetters = /[a-zA-Z]/.test(trimmed);
  if (!hasLetters) {
    return {
      isValid: false,
      reason: 'no_letters',
      message: 'Please write in words.',
    };
  }

  // Check if only numbers (allow some numbers, but not ONLY numbers)
  const onlyNumbersAndSymbols = /^[0-9\s\W]+$/.test(trimmed);
  if (onlyNumbersAndSymbols) {
    return {
      isValid: false,
      reason: 'only_numbers',
      message: 'Please explain your reasoning in words.',
    };
  }

  return { isValid: true };
}

/**
 * Hook for managing reasoning prompts.
 */
export function useReasoning() {
  const currentDay = useDilemmaStore((state: any) => state.day);
  const treatment = useSettingsStore((state: any) => state.treatment);
  const experimentMode = useSettingsStore((state: any) => state.experimentMode);
  const reasoningHistory = useDilemmaStore((state: any) => state.reasoningHistory);

  /**
   * Get the reasoning prompt type for the current day.
   */
  const currentPromptType = useMemo(
    () => getReasoningPromptType(treatment, currentDay),
    [treatment, currentDay]
  );

  /**
   * Check if reasoning should be shown for the current day.
   * Reasoning is completely disabled when experimentMode is false.
   */
  const shouldShowReasoning = useCallback(() => {
    // Disable reasoning completely when experiment mode is off (classic gameplay)
    if (!experimentMode) {
      return false;
    }
    return currentPromptType !== 'none';
  }, [experimentMode, currentPromptType]);

  /**
   * Check if the current prompt is optional (can be skipped).
   */
  const isOptional = useCallback(() => {
    return currentPromptType === 'optional';
  }, [currentPromptType]);

  /**
   * Check if the current prompt is mandatory.
   */
  const isMandatory = useCallback(() => {
    return currentPromptType === 'mandatory';
  }, [currentPromptType]);

  /**
   * Get count of reasoning entries submitted so far.
   */
  const getReasoningCount = useCallback(() => {
    return reasoningHistory.length;
  }, [reasoningHistory]);

  /**
   * Get reasoning history for the current game.
   */
  const getReasoningHistory = useCallback(() => {
    return reasoningHistory;
  }, [reasoningHistory]);

  return {
    currentPromptType,
    shouldShowReasoning,
    isOptional,
    isMandatory,
    getReasoningCount,
    getReasoningHistory,
    validateReasoningText,
  };
}
