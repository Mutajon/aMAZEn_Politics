import { useCallback, useMemo } from 'react';
import { useDilemmaStore } from '../store/dilemmaStore';
import { useSettingsStore } from '../store/settingsStore';
import type { TreatmentType } from '../data/experimentConfig';
import { lang } from '../i18n/lang';

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
 * Comprehensive validation checks:
 * 1. Length: 10-500 characters
 * 2. Not all the same character (e.g., "aaaaaaa")
 * 3. No repeated 2-character patterns (e.g., "ababababab")
 * 4. No keyboard mashing (same char >5 times)
 * 5. Contains letters (English or Hebrew)
 * 6. Not only numbers and symbols
 * 7. Minimum 3 words
 * 8. Not all single-character words (gibberish)
 * 9. No profanity (common English curse words)
 * 10. Not mostly numbers (>80%)
 */
export function validateReasoningText(text: string): ValidationResult {
  const trimmed = text.trim();

  // Check minimum length
  if (trimmed.length < 10) {
    return {
      isValid: false,
      reason: 'too_short',
      message: lang('REASONING_VALIDATION_TOO_SHORT'),
    };
  }

  // Check maximum length
  if (trimmed.length > 500) {
    return {
      isValid: false,
      reason: 'too_long',
      message: lang('REASONING_VALIDATION_TOO_LONG'),
    };
  }

  // Check if all same character
  const uniqueChars = new Set(trimmed.split(''));
  if (uniqueChars.size === 1) {
    return {
      isValid: false,
      reason: 'all_same_char',
      message: lang('REASONING_VALIDATION_MEANINGFUL'),
    };
  }

  // Check for repeated 2-character patterns (e.g., "ababababab", "121212")
  const repeatedPairPattern = /(.{2})\1{4,}/;
  if (repeatedPairPattern.test(trimmed)) {
    return {
      isValid: false,
      reason: 'repeated_pattern',
      message: lang('REASONING_VALIDATION_REPEATED_PATTERN'),
    };
  }

  // Check for keyboard mashing (same character repeated >5 times)
  const keyboardMashing = /(.)\1{5,}/;
  if (keyboardMashing.test(trimmed)) {
    return {
      isValid: false,
      reason: 'keyboard_mashing',
      message: lang('REASONING_VALIDATION_THOUGHTFUL'),
    };
  }

  // Check if contains letters (support English and Hebrew)
  const hasLetters = /[a-zA-Z\u0590-\u05FF]/.test(trimmed);
  if (!hasLetters) {
    return {
      isValid: false,
      reason: 'no_letters',
      message: lang('REASONING_VALIDATION_WRITE_WORDS'),
    };
  }

  // Check if only numbers (allow some numbers, but not ONLY numbers)
  // Use negative character class to avoid treating Hebrew as \W (non-word)
  const onlyNumbersAndSymbols = /^[^a-zA-Z\u0590-\u05FF]+$/.test(trimmed);
  if (onlyNumbersAndSymbols) {
    return {
      isValid: false,
      reason: 'only_numbers',
      message: lang('REASONING_VALIDATION_EXPLAIN_WORDS'),
    };
  }

  // Check for minimum word count (at least 3 words)
  const words = trimmed.split(/\s+/).filter(word => word.length > 0);
  if (words.length < 3) {
    return {
      isValid: false,
      reason: 'too_few_words',
      message: lang('REASONING_VALIDATION_MIN_WORDS'),
    };
  }

  // Check for gibberish: ensure not all words are single characters
  const singleCharWords = words.filter(word => word.length === 1);
  if (singleCharWords.length === words.length && words.length > 2) {
    return {
      isValid: false,
      reason: 'gibberish',
      message: lang('REASONING_VALIDATION_MEANINGFUL'),
    };
  }

  // Basic profanity check (common English curse words)
  const profanityList = [
    'fuck', 'shit', 'damn', 'bitch', 'ass', 'asshole', 'bastard',
    'crap', 'piss', 'dick', 'cock', 'pussy', 'whore', 'slut',
    'motherfucker', 'fag', 'faggot', 'retard', 'nigger', 'cunt'
  ];

  const lowerText = trimmed.toLowerCase();
  const hasProfanity = profanityList.some(word => {
    // Use word boundaries to avoid false positives (e.g., "assess" contains "ass")
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerText);
  });

  if (hasProfanity) {
    return {
      isValid: false,
      reason: 'profanity',
      message: lang('REASONING_VALIDATION_RESPECTFUL'),
    };
  }

  // Check if text is mostly numbers (>80%)
  const numberChars = trimmed.match(/[0-9]/g)?.length || 0;
  const letterChars = trimmed.match(/[a-zA-Z\u0590-\u05FF]/g)?.length || 0;
  if (numberChars > letterChars * 4) {
    return {
      isValid: false,
      reason: 'mostly_numbers',
      message: lang('REASONING_VALIDATION_NOT_NUMBERS'),
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
