// src/lib/scoring.ts
// Shared scoring helpers for live UI and final scoring screen.
//
// Implements the simplified scoring schema:
// - Three support tracks (People, Power Holders, Personal Anchor)
//   • Each track: 0‒100% → 0‒500 pts (linear)
//   • Combined support maximum: 1500 pts
// - Corruption level: 0‒10 → 0‒500 pts (linear)
//   • Incoming corruption level may be 0‒10 or 0‒100 (legacy); values >10 are scaled down.
// - Total maximum: 2000 pts
//
// Exports helpers used by:
// - Event screen resource bar (live score display)
// - FinalScoreScreen (animated breakdown + highscore submission)
// - Highscore utilities (formatting and entry creation)

import type { HighscoreEntry } from "../data/highscores-default";

// ===========================================================================
// CONSTANTS
// ===========================================================================

export const SUPPORT_TRACK_MAX_POINTS = 500;
export const SUPPORT_TRACK_COUNT = 3;
export const SUPPORT_TOTAL_MAX_POINTS =
  SUPPORT_TRACK_MAX_POINTS * SUPPORT_TRACK_COUNT; // 1500

export const CORRUPTION_MAX_POINTS = 500;
export const MAX_FINAL_SCORE = SUPPORT_TOTAL_MAX_POINTS + CORRUPTION_MAX_POINTS; // 2000

// ===========================================================================
// TYPES
// ===========================================================================

/**
 * Aftermath rating levels (from AI aftermath analysis).
 * Still used for highscore storytelling on the final screen.
 */
export type AftermathRating = "very-low" | "low" | "medium" | "high" | "very-high";

export type SupportTrackBreakdown = {
  percent: number; // 0-100 support %
  points: number; // 0-500 points
  maxPoints: number; // 500
};

export type CorruptionBreakdown = {
  rawLevel: number; // Raw value from store/API (0-10 or 0-100 legacy)
  normalizedLevel: number; // Coerced 0-10 scale
  points: number; // 0-500 points (higher level = higher points per spec)
  maxPoints: number; // 500
};

/**
 * Unified score breakdown returned by live + final scoring flows.
 */
export type ScoreBreakdown = {
  support: {
    people: SupportTrackBreakdown;
    middle: SupportTrackBreakdown;
    mom: SupportTrackBreakdown;
    total: number; // Sum of track points
    maxPoints: number; // 1500
  };
  corruption: CorruptionBreakdown;
  final: number; // Total score (support.total + corruption.points)
  maxFinal: number; // 2000
};

// ===========================================================================
// CORE HELPERS
// ===========================================================================

/**
 * Clamp a numeric value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Convert a support percentage (0-100) to points (0-500).
 */
function supportPercentToPoints(percent: number): number {
  const clamped = clamp(Math.round(percent), 0, 100);
  return Math.round((clamped / 100) * SUPPORT_TRACK_MAX_POINTS);
}

/**
 * Normalize corruption to 0-10 scale (legacy data may be 0-100).
 */
export function normalizeCorruptionLevel(rawLevel: number): number {
  if (!Number.isFinite(rawLevel)) return 0;
  if (rawLevel <= 10) {
    return clamp(rawLevel, 0, 10);
  }
  // Legacy data used 0-100 scale, so scale down.
  return clamp(rawLevel / 10, 0, 10);
}

/**
 * Convert corruption level (0-10) to points (0-500).
 * Spec states linear mapping 0 → 0 pts, 10 → 500 pts.
 */
function corruptionLevelToPoints(normalizedLevel: number): number {
  const clamped = clamp(normalizedLevel, 0, 10);
  return Math.round((clamped / 10) * CORRUPTION_MAX_POINTS);
}

// ===========================================================================
// PUBLIC API
// ===========================================================================

export function buildSupportTrackBreakdown(percent: number): SupportTrackBreakdown {
  return {
    percent: clamp(Math.round(percent), 0, 100),
    points: supportPercentToPoints(percent),
    maxPoints: SUPPORT_TRACK_MAX_POINTS,
  };
}

export function buildCorruptionBreakdown(rawLevel: number): CorruptionBreakdown {
  const normalizedLevel = normalizeCorruptionLevel(rawLevel);
  return {
    rawLevel,
    normalizedLevel,
    points: corruptionLevelToPoints(normalizedLevel),
    maxPoints: CORRUPTION_MAX_POINTS,
  };
}

/**
 * Main scoring helper used by live resource bar + final screen.
 */
export function calculateLiveScoreBreakdown({
  supportPeople,
  supportMiddle,
  supportMom,
  corruptionLevel,
}: {
  supportPeople: number;
  supportMiddle: number;
  supportMom: number;
  corruptionLevel: number;
}): ScoreBreakdown {
  const people = buildSupportTrackBreakdown(supportPeople);
  const middle = buildSupportTrackBreakdown(supportMiddle);
  const mom = buildSupportTrackBreakdown(supportMom);
  const corruption = buildCorruptionBreakdown(corruptionLevel);

  const supportTotal = people.points + middle.points + mom.points;
  const final = supportTotal + corruption.points;

  return {
    support: {
      people,
      middle,
      mom,
      total: supportTotal,
      maxPoints: SUPPORT_TOTAL_MAX_POINTS,
    },
    corruption,
    final,
    maxFinal: MAX_FINAL_SCORE,
  };
}

/**
 * Provided for compatibility with previous code paths.
 * Simply returns `breakdown.final`.
 */
export function calculateFinalScore(breakdown: ScoreBreakdown): number {
  return clamp(Math.round(breakdown.final), 0, MAX_FINAL_SCORE);
}

// ===========================================================================
// HIGH SCORE HELPERS (unchanged)
// ===========================================================================

/**
 * Format aftermath rating for display
 * Example: "very-high" → "Very High"
 */
export function formatRating(rating: string): string {
  return rating
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Format compass values for highscore entry
 * Example: "What: Liberty/Agency; Whence: Evidence; How: Law/Std.; Whither: Self"
 */
export function formatCompassValuesForHighscore(
  top3ByDimension: Record<string, Array<{ short: string }>>
): string {
  const parts: string[] = [];

  // Format: "What: X; Whence: Y; How: Z; Whither: W"
  for (const dim of ["what", "whence", "how", "whither"]) {
    const dimName = dim.charAt(0).toUpperCase() + dim.slice(1);
    const topValue = top3ByDimension[dim]?.[0]?.short || "—";
    parts.push(`${dimName}: ${topValue}`);
  }

  return parts.join("; ");
}

/**
 * Build highscore entry from score breakdown and game data
 */
export function buildHighscoreEntry(
  breakdown: ScoreBreakdown,
  character: { name: string; aboutRole?: string; avatarUrl?: string } | null,
  analysis: { systemName?: string } | null,
  ratings: { liberalism: AftermathRating; autonomy: AftermathRating } | null,
  top3ByDimension: Record<string, Array<{ short: string }>>
): HighscoreEntry {
  // Map AftermathRating to DemocracyLevel (same type, different name)
  const mapRating = (rating: AftermathRating): HighscoreEntry["democracy"] => {
    switch (rating) {
      case "very-high": return "Very High";
      case "high": return "High";
      case "medium": return "Medium";
      case "low": return "Low";
      case "very-low": return "Very Low";
      default: return "Medium";
    }
  };

  return {
    name: character?.name || "Unknown Leader",
    about: character?.aboutRole || "A leader who shaped their era.",
    democracy: ratings ? mapRating(ratings.liberalism) : "Medium",
    autonomy: ratings ? mapRating(ratings.autonomy) : "Medium",
    values: formatCompassValuesForHighscore(top3ByDimension),
    score: breakdown.final,
    politicalSystem: analysis?.systemName || "Unknown System",
    avatarUrl: character?.avatarUrl, // Include player's custom avatar (if available)
  };
}
