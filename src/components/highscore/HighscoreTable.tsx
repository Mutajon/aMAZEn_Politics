import { useMemo, useRef, useEffect } from "react";
import { motion, type Variants } from "framer-motion";
import type { HighscoreEntry } from "../../data/highscores-default";
import { useLang } from "../../i18n/lang";
import { translateDemocracyLevel, translatePoliticalSystem } from "../../i18n/translateGameData";

// Animation variants (same as current implementation)
const listVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { delayChildren: 0.05, staggerChildren: 0.05 },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 22, mass: 0.8 },
  },
};

function rankColor(i: number): string | undefined {
  if (i === 0) return "#F4C430"; // gold
  if (i === 1) return "#C0C0C0"; // silver
  if (i === 2) return "#B87333"; // copper
  return undefined;
}

function imgForLeader(entry: HighscoreEntry, rank: number): string {
  // Priority 1: Use avatarUrl from API (compressed 64x64 WebP thumbnail from MongoDB)
  if (entry.avatarUrl) {
    return entry.avatarUrl;
  }
  
  // Priority 2: Try historical leader image (for predefined roles)
  const first = entry.name.split(" ")[0];
  const historicalImage = `/assets/images/leaders/${first}.jpg`;
  
  // Priority 3: Placeholder fallback
  // Note: We could return historicalImage here and let onError handle fallback,
  // but for ranks 21+ we go straight to placeholder to avoid image load attempts
  if (rank >= 20) {
    return "/assets/images/leaders/placeholder.jpg";
  }
  
  return historicalImage;
}

type Props = {
  entries: HighscoreEntry[];
  loading: boolean;
  error: string | null;
  onSelect: (entry: HighscoreEntry) => void;
  highlightName?: string;
  emptyMessage?: string;
};

export function HighscoreTable({
  entries,
  loading,
  error,
  onSelect,
  highlightName,
  emptyMessage = "No scores available"
}: Props) {
  const lang = useLang();
  const highlightedRef = useRef<HTMLButtonElement | null>(null);
  
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.score - a.score),
    [entries]
  );

  // Auto-scroll to highlighted entry
  useEffect(() => {
    if (highlightName && highlightedRef.current) {
      const timer = setTimeout(() => {
        highlightedRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [highlightName]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Header */}
      <div
        className="grid gap-2 md:gap-3 pl-1 pr-2 md:pr-4 py-3 text-[11px] md:text-[12px] uppercase tracking-wide text-white/70 sticky top-0 bg-white/10 backdrop-blur z-10"
        style={{
          gridTemplateColumns: window.innerWidth < 640
            ? "44px 1fr 80px"
            : "44px 1.2fr 1.1fr 1fr 1fr 0.7fr"
        }}
      >
        <div className="text-right">{lang("HIGHSCORE_RANK")}</div>
        <div>{lang("HIGHSCORE_LEADER")}</div>
        <div className="hidden sm:block">{lang("HIGHSCORE_SYSTEM")}</div>
        <div className="hidden sm:block">{lang("HIGHSCORE_LIBERALISM")}</div>
        <div className="hidden sm:block">{lang("HIGHSCORE_AUTONOMY")}</div>
        <div className="text-right">{lang("HIGHSCORE_SCORE")}</div>
      </div>

      {/* Scrollable body */}
      <div className="max-h-[60vh] md:max-h-[70vh] overflow-y-auto divide-y divide-white/5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-white/60">Loading...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-red-400">{error}</div>
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-white/60">{emptyMessage}</div>
          </div>
        ) : (
          <motion.div initial="hidden" animate="show" variants={listVariants}>
            {sortedEntries.map((e, i) => {
              const color = rankColor(i);
              const isHighlighted = highlightName && e.name === highlightName;
              const isMobile = window.innerWidth < 640;
              
              return (
                <motion.button
                  type="button"
                  key={`${e.name}-${e.score}-${i}`}
                  ref={isHighlighted ? highlightedRef : null}
                  onClick={() => onSelect(e)}
                  className={[
                    "w-full text-left grid items-center gap-2 md:gap-3 pl-1 pr-2 md:pr-4 py-3 focus:outline-none will-change-[transform,opacity]",
                    isHighlighted
                      ? "bg-amber-500/20 border-2 border-amber-400 ring-2 ring-amber-400/50 rounded-lg my-1"
                      : "hover:bg-white/8"
                  ].join(" ")}
                  style={{
                    gridTemplateColumns: isMobile
                      ? "44px 1fr 80px"
                      : "44px 1.2fr 1.1fr 1fr 1fr 0.7fr"
                  }}
                  variants={rowVariants}
                >
                  {/* Rank */}
                  <div className="flex items-center h-10 md:h-[50px] justify-end">
                    <span
                      className={[
                        "font-bold tabular-nums leading-none text-lg md:text-xl",
                        color ? "" : "text-white/90",
                      ].join(" ")}
                      style={color ? { color } : undefined}
                    >
                      {i + 1}
                    </span>
                  </div>

                  {/* Leader */}
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <img
                      src={imgForLeader(e, i)}
                      alt={e.name}
                      width={isMobile ? 40 : 50}
                      height={isMobile ? 40 : 50}
                      className="w-10 h-10 md:w-[50px] md:h-[50px] rounded-lg object-cover border border-white/10 flex-shrink-0"
                      onError={(ev) => {
                        const img = ev.currentTarget as HTMLImageElement;
                        if (!img.src.includes('placeholder.jpg')) {
                          img.src = "/assets/images/leaders/placeholder.jpg";
                        }
                      }}
                    />
                    <span className="truncate px-2 py-1 rounded-md bg-white/10 text-white/90 text-xs md:text-sm font-medium">
                      {e.name}
                    </span>
                  </div>

                  {/* System */}
                  <div className="hidden sm:block text-white/90 text-sm">
                    <span className="px-2 py-1 rounded-md bg-white/10 truncate">
                      {translatePoliticalSystem(e.politicalSystem, lang) || "—"}
                    </span>
                  </div>

                  {/* Liberalism */}
                  <div className="hidden sm:block text-white/90 text-sm">
                    {translateDemocracyLevel(e.democracy, lang)}
                  </div>

                  {/* Autonomy */}
                  <div className="hidden sm:block text-white/90 text-sm">
                    {translateDemocracyLevel(e.autonomy, lang)}
                  </div>

                  {/* Score */}
                  <div className="text-right font-extrabold text-amber-300 tabular-nums text-sm md:text-base">
                    {e.score.toLocaleString()}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
