// src/lib/scoring.ts
// Shared scoring helpers for live UI and final scoring screen.
//
// Implements the simplified scoring schema:
// - Three support tracks (People, Power Holders, Personal Anchor)
//   • Each track: 0‒100% → 0‒500 pts (linear)
//   • Combined support maximum: 1500 pts
// - Total maximum: 1500 pts (all support)
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

export const MAX_FINAL_SCORE = SUPPORT_TOTAL_MAX_POINTS; // 1500

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
  final: number; // Total score (support.total)
  maxFinal: number; // 1500
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

/**
 * Main scoring helper used by live resource bar + final screen.
 */
export function calculateLiveScoreBreakdown({
  supportPeople,
  supportMiddle,
  supportMom,
  isFreePlay = false,
}: {
  supportPeople: number;
  supportMiddle: number;
  supportMom: number;
  isFreePlay?: boolean;
}): ScoreBreakdown {
  const people = buildSupportTrackBreakdown(supportPeople);
  const middle = buildSupportTrackBreakdown(supportMiddle);
  const mom = buildSupportTrackBreakdown(supportMom);

  const tracks = isFreePlay ? [people, middle] : [people, middle, mom];
  const supportTotal = tracks.reduce((sum, t) => sum + t.points, 0);
  const maxPoints = tracks.length * SUPPORT_TRACK_MAX_POINTS;
  const final = Math.max(0, supportTotal);

  return {
    support: {
      people,
      middle,
      mom,
      total: supportTotal,
      maxPoints,
    },
    final,
    maxFinal: maxPoints,
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
  top3ByDimension: Record<string, Array<{ short: string }>>,
  role: string | undefined      // Added role parameter
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
    role: role || "Unknown",         // Include role key
  };
}
