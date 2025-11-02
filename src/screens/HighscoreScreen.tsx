// src/screens/HighscoreScreen.tsx
import { useMemo, useState, useEffect, useRef } from "react";
import { bgStyleSplash } from "../lib/ui";
import { useHighscoreStore } from "../store/highscoreStore";
import LeaderPopup from "../components/LeaderPopup";
import type { HighscoreEntry } from "../data/highscores-default";
import { motion, type Variants } from "framer-motion";
import { useLang } from "../i18n/lang";
import { translateDemocracyLevel, translatePoliticalSystem } from "../i18n/translateGameData";

// Parent controls stagger; children are the individual rows.
// Parent controls stagger; children are the individual rows.
const listVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { delayChildren: 0.05, staggerChildren: 0.05 },
  },
};

// Each row: quick fade + slight slide-up (spring)
const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 22, mass: 0.8 },
  },
};



/**
 * Get avatar image source with intelligent fallback logic
 * @param entry - Highscore entry
 * @param rank - 0-indexed rank (0 = 1st place, 19 = 20th place)
 * @returns Image URL or data URL
 */
function imgForLeader(entry: HighscoreEntry, rank: number): string {
  // Top 20 (Hall of Fame): Use custom avatar if available
  if (rank < 20 && entry.avatarUrl) {
    return entry.avatarUrl;
  }

  // Ranks 21+ (21-50): Use default placeholder avatar
  if (rank >= 20) {
    return "/assets/images/leaders/placeholder.jpg";
  }

  // Top 20 without custom avatar: Try to find static historical image
  const first = entry.name.split(" ")[0];
  return `/assets/images/leaders/${first}.jpg`;
}

function rankColor(i: number): string | undefined {
  if (i === 0) return "#F4C430"; // gold
  if (i === 1) return "#C0C0C0"; // silver
  if (i === 2) return "#B87333"; // copper
  return undefined;              // 4+ → default table color
}

export default function HighscoreScreen() {
  const lang = useLang();
  const entries = useHighscoreStore((s) => s.entries);
  const [selected, setSelected] = useState<HighscoreEntry | null>(null);
  const highlightedRef = useRef<HTMLButtonElement | null>(null);

  // Extract highlight parameter from URL
  const highlightName = useMemo(() => {
    const hash = window.location.hash; // e.g. "#/highscores?highlight=John%20Doe"
    const queryStart = hash.indexOf("?");
    if (queryStart === -1) return null;

    const params = new URLSearchParams(hash.slice(queryStart + 1));
    return params.get("highlight");
  }, []);

  const list = useMemo(
    () => [...entries].sort((a, b) => b.score - a.score).slice(0, 50),
    [entries]
  );

  // Auto-scroll to highlighted entry after animation completes
  useEffect(() => {
    if (highlightName && highlightedRef.current) {
      // Delay to allow animation to complete (stagger: 0.05s per row × 50 rows = ~2.5s max)
      const timer = setTimeout(() => {
        highlightedRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 2800); // Wait 2.8s for animation to mostly complete

      return () => clearTimeout(timer);
    }
  }, [highlightName]);

  return (
    <div className="min-h-[100dvh] px-5 py-8" style={bgStyleSplash}>
      <div className="w-full max-w-5xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
              {lang("HIGHSCORE_TITLE")}
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {lang("HIGHSCORE_CLICK_LEADERS")}
            </p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/15 text-white"
          >
            {lang("HIGHSCORE_BACK")}
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          {/* Header */}
          <div
            className="grid gap-3 pl-1 pr-4 py-3 text-[12px] uppercase tracking-wide text-white/70 sticky top-0 bg-white/10 backdrop-blur z-10"
            style={{ gridTemplateColumns: "44px 1.2fr 1.1fr 1fr 1fr 0.7fr" }}
          >
            <div className="text-right">{lang("HIGHSCORE_RANK")}</div>
            <div>{lang("HIGHSCORE_LEADER")}</div>
            <div>{lang("HIGHSCORE_SYSTEM")}</div>
            <div>{lang("HIGHSCORE_LIBERALISM")}</div>
            <div>{lang("HIGHSCORE_AUTONOMY")}</div>
            <div className="text-right">{lang("HIGHSCORE_SCORE")}</div>
          </div>

          {/* Scrollable body */}
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-white/5">
  <motion.div
    initial="hidden"
    animate="show"
    variants={listVariants}
  >

            {list.map((e, i) => {
              const color = rankColor(i);
              const isHighlighted = highlightName && e.name === highlightName;
              return (
                <motion.button
  type="button"
  key={`${e.name}-${i}`}
  ref={isHighlighted ? highlightedRef : null}
  onClick={() => setSelected(e)}
  className={[
    "w-full text-left grid items-center gap-3 pl-1 pr-4 py-3 focus:outline-none will-change-[transform,opacity]",
    isHighlighted
      ? "bg-amber-500/20 border-2 border-amber-400 ring-2 ring-amber-400/50 rounded-lg my-1"
      : "hover:bg-white/8"
  ].join(" ")}
  style={{ gridTemplateColumns: "44px 1.2fr 1.1fr 1fr 1fr 0.7fr" }}
  variants={rowVariants}
>

                  {/* Rank */}
                  <div className="flex items-center h-[50px] justify-end">
                    <span
                      className={[
                        "font-bold tabular-nums leading-none",
                        "text-xl",
                        color ? "" : "text-white/90",
                      ].join(" ")}
                      style={color ? { color } : undefined}
                      aria-label={`rank ${i + 1}`}
                    >
                      {i + 1}
                    </span>
                  </div>

                  {/* Leader cell: 50x50 image + name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={imgForLeader(e, i)}
                      alt={e.name}
                      width={50}
                      height={50}
                      className="w-[50px] h-[50px] rounded-lg object-cover border border-white/10"
                      onError={(ev) => {
                        (ev.currentTarget as HTMLImageElement).src =
                          "/assets/images/leaders/placeholder.jpg";
                      }}
                    />
                    <span className="truncate px-2 py-1 rounded-md bg-white/10 text-white/90 text-sm font-medium">
                      {e.name}
                    </span>
                  </div>

                  {/* System */}
                  <div className="text-white/90">
                    <span className="px-2 py-1 rounded-md bg-white/10">{translatePoliticalSystem(e.politicalSystem, lang) || "—"}</span>
                  </div>

                  <div className="text-white/90">{translateDemocracyLevel(e.democracy, lang)}</div>
                  <div className="text-white/90">{translateDemocracyLevel(e.autonomy, lang)}</div>

                  {/* Score */}
                  <div className="text-right font-extrabold text-amber-300 tabular-nums">
                    {e.score.toLocaleString()}
                  </div>
                  </motion.button>
              );
            })}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Popup */}
      <LeaderPopup entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
