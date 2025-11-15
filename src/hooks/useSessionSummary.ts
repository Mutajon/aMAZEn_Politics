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
import { useCompassStore } from "../store/compassStore";
import { useLoggingStore } from "../store/loggingStore";
import { useSettingsStore } from "../store/settingsStore";
import { calculateLiveScoreBreakdown } from "../lib/scoring";
import type { AftermathResponse } from "../lib/aftermath";

export type SessionSummary = {
  timestamp: Date;
  userId: string;               // Email from splash screen
  sessionId: string;             // Unique session identifier
  gameVersion: string;           // From package.json
  treatment: string;             // Experiment treatment assignment
  role: string;                  // Selected role name
  totalPlayTime: number;         // Session duration in milliseconds
  averageDecisionTime: number;   // Mean decision time in milliseconds
  totalInquiries: number;        // Total inquiry feature usage
  totalReasoningSubmissions: number; // Total reasoning modal submissions
  totalCustomActions: number;    // Total custom action submissions
  initialCompass: {              // Compass values after quiz
    what: number[];
    whence: number[];
    how: number[];
    whither: number[];
  } | null;
  finalCompass: {                // Compass values at game end
    what: number[];
    whence: number[];
    how: number[];
    whither: number[];
  };
  finalScore: number;            // Total final score
  scoreBreakdown: {              // Score components
    supportPeople: { percent: number; points: number; maxPoints: number };
    supportMiddle: { percent: number; points: number; maxPoints: number };
    supportMom: { percent: number; points: number; maxPoints: number };
    supportTotal: number;
    corruptionPenalty: number;
    finalScore: number;
  };
  ideologyRatings: {             // From aftermath API
    autonomy: string;            // "very-low" | "low" | "medium" | "high" | "very-high"
    liberalism: string;          // Same scale
    democracy: string;           // Same scale (extracted from decisions)
  } | null;
  incomplete: boolean;           // True if session ended early
};

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

  // Calculate average decision time
  const { decisionTimes } = dilemmaStore;
  const averageDecisionTime = decisionTimes.length > 0
    ? decisionTimes.reduce((sum, time) => sum + time, 0) / decisionTimes.length
    : 0;

  // Use passed session duration (already calculated by caller)
  const totalPlayTime = sessionDuration || 0;

  // Calculate score breakdown
  const scoreBreakdown = calculateLiveScoreBreakdown({
    supportPeople: dilemmaStore.supportPeople,
    supportMiddle: dilemmaStore.supportMiddle,
    supportMom: dilemmaStore.supportMom,
    corruptionLevel: dilemmaStore.corruptionLevel,
  });

  // Extract ideology ratings from aftermath data
  const ideologyRatings = aftermathData ? {
    autonomy: aftermathData.ratings.autonomy,
    liberalism: aftermathData.ratings.liberalism,
    democracy: extractDemocracyRating(aftermathData.decisions)
  } : null;

  const summary: SessionSummary = {
    timestamp: new Date(),
    userId: loggingStore.userId,
    sessionId: loggingStore.sessionId,
    gameVersion: loggingStore.gameVersion,
    treatment: settingsStore.treatment,
    role: dilemmaStore.role || 'Unknown',
    totalPlayTime,
    averageDecisionTime,
    totalInquiries: dilemmaStore.inquiryHistory.size,
    totalReasoningSubmissions: dilemmaStore.reasoningSubmissionCount,
    totalCustomActions: dilemmaStore.customActionCount,
    initialCompass: compassStore.initialCompassSnapshot,
    finalCompass: {
      what: [...compassStore.values.what],
      whence: [...compassStore.values.whence],
      how: [...compassStore.values.how],
      whither: [...compassStore.values.whither],
    },
    finalScore: scoreBreakdown.final,
    scoreBreakdown: {
      supportPeople: scoreBreakdown.support.people,
      supportMiddle: scoreBreakdown.support.middle,
      supportMom: scoreBreakdown.support.mom,
      supportTotal: scoreBreakdown.support.total,
      corruptionPenalty: scoreBreakdown.corruption.points,
      finalScore: scoreBreakdown.final,
    },
    ideologyRatings,
    incomplete,
  };

  console.log('[useSessionSummary] Session summary collected:', {
    userId: summary.userId,
    sessionId: summary.sessionId,
    role: summary.role,
    totalPlayTime: `${Math.round(summary.totalPlayTime / 1000)}s`,
    averageDecisionTime: `${Math.round(summary.averageDecisionTime / 1000)}s`,
    totalInquiries: summary.totalInquiries,
    totalReasoningSubmissions: summary.totalReasoningSubmissions,
    totalCustomActions: summary.totalCustomActions,
    finalScore: summary.finalScore,
    incomplete: summary.incomplete,
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
      console.error('[useSessionSummary] Failed to send summary:', response.status, response.statusText);
      // Don't throw - we don't want to block the user experience
      return;
    }

    console.log('[useSessionSummary] ✅ Session summary sent successfully');
  } catch (error) {
    console.error('[useSessionSummary] Error sending summary:', error);
    // Don't throw - we don't want to block the user experience
  }
}
