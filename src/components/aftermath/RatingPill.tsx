// src/components/aftermath/RatingPill.tsx
// Reusable rating pill component for displaying autonomy/liberalism/democracy ratings
//
// Connects to:
// - src/components/aftermath/FinalScoresSection.tsx: overall ratings display
// - src/components/aftermath/DecisionBreakdownSection.tsx: per-decision ratings
// - src/lib/aftermath.ts: RatingLevel type

import { useLang } from "../../i18n/lang";
import type { RatingLevel } from "../../lib/aftermath";

type Props = {
  label: string; // e.g., "Democracy", "Autonomy", "Liberalism" or "D", "A", "L" for mini
  rating: RatingLevel;
  mini?: boolean; // Mini mode for per-decision pills (smaller, abbreviated labels)
};

/** Get color for rating level */
function getRatingColor(level: string): string {
  switch (level) {
    case "very-high": return "#10b981"; // emerald-500
    case "high": return "#84cc16"; // lime-500
    case "medium": return "#eab308"; // yellow-500
    case "low": return "#f97316"; // orange-500
    case "very-low": return "#ef4444"; // red-500
    default: return "#6b7280"; // gray-500
  }
}

/** Format rating text with translation support */
function formatRating(level: string, lang: (key: string) => string): string {
  const keyMap: Record<string, string> = {
    "very-high": "DEMOCRACY_LEVEL_VERY_HIGH",
    "high": "DEMOCRACY_LEVEL_HIGH",
    "medium": "DEMOCRACY_LEVEL_MEDIUM",
    "low": "DEMOCRACY_LEVEL_LOW",
    "very-low": "DEMOCRACY_LEVEL_VERY_LOW",
  };

  const key = keyMap[level];
  if (key) {
    return lang(key);
  }

  // Fallback to capitalization
  return level
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function RatingPill({ label, rating, mini = false }: Props) {
  const lang = useLang();
  const color = getRatingColor(rating);

  if (mini) {
    // Mini mode: smaller pill with abbreviated label
    return (
      <div
        className="px-2 py-1 rounded text-xs font-semibold"
        style={{
          backgroundColor: `${color}20`,
          borderColor: color,
          borderWidth: "1px",
          color: color
        }}
      >
        {label}: {formatRating(rating, lang)}
      </div>
    );
  }

  // Full mode: larger pill with full label
  return (
    <div
      className="px-4 py-2 rounded-lg font-semibold uppercase text-sm tracking-wide"
      style={{
        backgroundColor: `${color}20`,
        borderColor: color,
        borderWidth: "1px",
        color: color
      }}
    >
      {label}: {formatRating(rating, lang)}
    </div>
  );
}
