// src/hooks/useSessionSummary.ts
// Hook to collect all session summary data for logging to MongoDB summary collection
//
// Collects:
// - User identification (email from loggingStore)
// - Session metadata (sessionId, gameVersion, treatment)
// - Role selection
// - Timing data (total play time, average decision time)
// - Feature usage (inquiries, reasoning submissions, custom actions)
// - Compass values (initial and final)
// - Score breakdown (final score and components)
// - Ideology ratings (autonomy, liberalism, democracy from aftermath)
//
// Usage: Call collectSessionSummary() in AftermathScreen after data loads

import { useDilemmaStore } from "../store/dilemmaStore";
import { useCompassStore, type CompassValues } from "../store/compassStore";
import { useLoggingStore } from "../store/loggingStore";
import { useSettingsStore } from "../store/settingsStore";
import { useRoleStore } from "../store/roleStore";
import { calculateLiveScoreBreakdown } from "../lib/scoring";
import type { AftermathResponse } from "../lib/aftermath";
import { COMPONENTS } from "../data/compass-data";

export type SessionSummary = {
  timestamp: Date;
  userId: string;               // Email from splash screen
  sessionId: string;             // Unique session identifier
  gameVersion: string;           // From package.json
  treatment: string;             // Experiment treatment assignment
  role: string;                  // Selected role name
  totalPlayTime: number;         // Session duration in SECONDS
  averageDecisionTime: number;   // Mean decision time in SECONDS
  averageReasoningTime: number;  // Mean reasoning time in SECONDS
  inquiries: {                   // Inquiry feature usage
    count: number;
    texts: string[];
  };
  reasoning: {                   // Reasoning modal submissions
    count: number;
    texts: string[];
  };
  customActions: {               // Custom action submissions
    count: number;
    texts: string[];
  };
  initialCompass: {              // Compass values after quiz (named components)
    what: Record<string, number>;
    whence: Record<string, number>;
    how: Record<string, number>;
    whither: Record<string, number>;
  } | null;
  finalCompass: {                // Compass values at game end (named components)
    what: Record<string, number>;
    whence: Record<string, number>;
    how: Record<string, number>;
    whither: Record<string, number>;
  };
  supportBreakdown: {            // Final support values (0-100)
    people: number;
    middle: number;
    mom: number;
  };
  finalScore: number;            // Total final score
  selfJudgment: string | null;   // Player's self-assessment (Day 8)
  selfTrait: string | null;      // Player's self-identified defining trait (from DreamScreen)
  ideologyRatings: {             // From aftermath API
    autonomy: string;            // "very-low" | "low" | "medium" | "high" | "very-high"
    liberalism: string;          // Same scale
    democracy: string;           // Same scale (extracted from decisions)
  } | null;
  incomplete: boolean;           // True if session ended early
};

/**
 * Convert compass values from arrays to named objects
 * Maps array indexes to component names from compass-data.ts
 * Example: [2, 5, 1, ...] → { "Truth/Trust": 2, "Liberty/Agency": 5, "Equality/Equity": 1, ... }
 */
function mapCompassToNamed(compassValues: CompassValues): {
  what: Record<string, number>;
  whence: Record<string, number>;
  how: Record<string, number>;
  whither: Record<string, number>;
} {
  return {
    what: Object.fromEntries(
      compassValues.what.map((value: number, idx: number) => [COMPONENTS.what[idx].short, value])
    ),
    whence: Object.fromEntries(
      compassValues.whence.map((value: number, idx: number) => [COMPONENTS.whence[idx].short, value])
    ),
    how: Object.fromEntries(
      compassValues.how.map((value: number, idx: number) => [COMPONENTS.how[idx].short, value])
    ),
    whither: Object.fromEntries(
      compassValues.whither.map((value: number, idx: number) => [COMPONENTS.whither[idx].short, value])
    ),
  };
}

/**
 * Extract democracy rating from per-decision ratings
 * Democracy ratings are hidden in UI but calculated by AI for each decision
 */
function extractDemocracyRating(decisions: AftermathResponse['decisions']): string {
  if (!decisions || decisions.length === 0) return 'medium';

  // Convert all democracy ratings to numbers, average them, convert back
  const ratingToNum: Record<string, number> = {
    'very-low': 1,
    'low': 2,
    'medium': 3,
    'high': 4,
    'very-high': 5
  };

  const numToRating: Record<number, string> = {
    1: 'very-low',
    2: 'low',
    3: 'medium',
    4: 'high',
    5: 'very-high'
  };

  const democracyValues = decisions
    .map(d => d.democracy)
    .filter(Boolean)
    .map(r => ratingToNum[r] || 3);

  if (democracyValues.length === 0) return 'medium';

  const avg = democracyValues.reduce((sum, val) => sum + val, 0) / democracyValues.length;
  const rounded = Math.round(avg);
  const clamped = Math.max(1, Math.min(5, rounded));

  return numToRating[clamped] || 'medium';
}

/**
 * Collect all session summary data
 * @param aftermathData - Aftermath API response (null if incomplete session)
 * @param incomplete - Whether session ended early
 * @param sessionDuration - Session duration in milliseconds (from sessionLogger.getSessionDuration())
 */
export function collectSessionSummary(
  aftermathData: AftermathResponse | null,
  incomplete: boolean,
  sessionDuration: number | null
): SessionSummary {
  // Get store states
  const dilemmaStore = useDilemmaStore.getState();
  const compassStore = useCompassStore.getState();
  const loggingStore = useLoggingStore.getState();
  const settingsStore = useSettingsStore.getState();
  const roleStore = useRoleStore.getState();

  // Defensive validation - ensure critical fields exist
  if (!loggingStore.userId || !loggingStore.sessionId) {
    console.warn('[useSessionSummary] ⚠️ Missing critical fields:', {
      userId: loggingStore.userId,
      sessionId: loggingStore.sessionId
    });
  }

  // Calculate average decision time (convert from milliseconds to seconds)
  const { decisionTimes, reasoningTimes, reasoningHistory, customActionTexts } = dilemmaStore;
  const averageDecisionTime = decisionTimes.length > 0
    ? (decisionTimes.reduce((sum, time) => sum + time, 0) / decisionTimes.length) / 1000
    : 0;

  // Calculate average reasoning time (convert from milliseconds to seconds)
  const averageReasoningTime = reasoningTimes.length > 0
    ? (reasoningTimes.reduce((sum, time) => sum + time, 0) / reasoningTimes.length) / 1000
    : 0;

  // Use passed session duration (convert from milliseconds to seconds)
  const totalPlayTime = sessionDuration ? sessionDuration / 1000 : 0;

  // Defensive logging for critical timing issue
  if (!sessionDuration || sessionDuration === 0) {
    console.warn('[useSessionSummary] ⚠️ CRITICAL: sessionDuration is null or 0!', {
      sessionDuration,
      sessionStartTime: loggingStore.sessionStartTime,
      timestamp: new Date().toISOString()
    });
  }

  // Extract inquiry texts from Map
  const inquiryTexts: string[] = [];
  dilemmaStore.inquiryHistory.forEach((dayInquiries) => {
    dayInquiries.forEach((entry) => {
      inquiryTexts.push(entry.question);
    });
  });

  // Extract reasoning texts from array
  const reasoningTexts = reasoningHistory.map(entry => entry.reasoningText);

  // Calculate score breakdown
  const scoreBreakdown = calculateLiveScoreBreakdown({
    supportPeople: dilemmaStore.supportPeople,
    supportMiddle: dilemmaStore.supportMiddle,
    supportMom: dilemmaStore.supportMom,
  });

  // Extract ideology ratings from aftermath data
  const ideologyRatings = aftermathData ? {
    autonomy: aftermathData.ratings.autonomy,
    liberalism: aftermathData.ratings.liberalism,
    democracy: extractDemocracyRating(aftermathData.decisions)
  } : null;

  // Get initial compass snapshot with fallback chain: loggingStore → compassStore → null
  // loggingStore has more reliable localStorage persistence (proven working)
  const initialCompassSnapshot =
    loggingStore.initialCompassSnapshot ||
    compassStore.initialCompassSnapshot ||
    null;

  const summary: SessionSummary = {
    timestamp: new Date(),
    userId: loggingStore.userId || 'unknown',
    sessionId: loggingStore.sessionId || 'unknown',
    gameVersion: loggingStore.gameVersion,
    treatment: settingsStore.treatment,
    role: roleStore.selectedRole || 'Unknown',
    totalPlayTime,
    averageDecisionTime,
    averageReasoningTime,
    inquiries: {
      count: inquiryTexts.length,
      texts: inquiryTexts,
    },
    reasoning: {
      count: reasoningTexts.length,
      texts: reasoningTexts,
    },
    customActions: {
      count: customActionTexts.length,
      texts: customActionTexts,
    },
    initialCompass: initialCompassSnapshot
      ? mapCompassToNamed(initialCompassSnapshot)
      : null,
    finalCompass: mapCompassToNamed(compassStore.values),
    supportBreakdown: {
      people: dilemmaStore.supportPeople,
      middle: dilemmaStore.supportMiddle,
      mom: dilemmaStore.supportMom,
    },
    finalScore: scoreBreakdown.final,
    selfJudgment: dilemmaStore.selfJudgment || null,
    selfTrait: roleStore.playerTrait || null,
    ideologyRatings,
    incomplete,
  };

  // Defensive logging for critical compass issue
  if (!summary.initialCompass) {
    console.warn('[useSessionSummary] ⚠️ CRITICAL: initialCompass is null!', {
      loggingStoreSnapshot: loggingStore.initialCompassSnapshot,
      compassStoreSnapshot: compassStore.initialCompassSnapshot,
      compassValues: compassStore.values,
      timestamp: new Date().toISOString()
    });
  } else {
    // Success logging - show which source was used
    const source = loggingStore.initialCompassSnapshot
      ? 'loggingStore (primary)'
      : compassStore.initialCompassSnapshot
      ? 'compassStore (fallback)'
      : 'unknown';
    console.log(`[useSessionSummary] ✅ Initial compass loaded from: ${source}`);
  }

  console.log('[useSessionSummary] Session summary collected:', {
    userId: summary.userId,
    sessionId: summary.sessionId,
    role: summary.role,
    totalPlayTime: `${Math.round(summary.totalPlayTime)}s`,
    averageDecisionTime: `${Math.round(summary.averageDecisionTime)}s`,
    averageReasoningTime: `${Math.round(summary.averageReasoningTime)}s`,
    inquiries: summary.inquiries.count,
    reasoning: summary.reasoning.count,
    customActions: summary.customActions.count,
    finalScore: summary.finalScore,
    supportBreakdown: summary.supportBreakdown,
    incomplete: summary.incomplete,
    hasInitialCompass: !!summary.initialCompass,
  });

  return summary;
}

/**
 * Send session summary to backend
 * @param summary - Session summary data
 * @returns Promise that resolves when summary is sent (doesn't throw on error)
 */
export async function sendSessionSummary(summary: SessionSummary): Promise<void> {
  try {
    const response = await fetch('/api/log/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summary),
    });

    if (!response.ok) {
      console.error('[useSessionSummary] ❌ HTTP error sending summary:', response.status, response.statusText);
      // Don't throw - we don't want to block the user experience
      return;
    }

    // Check if backend returned success: false
    const result = await response.json();
    if (!result.success) {
      console.error('[useSessionSummary] ❌ Backend validation failed:', result.error);
      console.error('[useSessionSummary] Summary that failed validation:', {
        userId: summary.userId,
        sessionId: summary.sessionId,
        gameVersion: summary.gameVersion
      });
      // Don't throw - we don't want to block the user experience
      return;
    }

    console.log('[useSessionSummary] ✅ Session summary sent successfully');
  } catch (error) {
    console.error('[useSessionSummary] ❌ Error sending summary:', error);
    // Don't throw - we don't want to block the user experience
  }
}
