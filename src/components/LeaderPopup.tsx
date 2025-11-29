// src/components/LeaderPopup.tsx
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { type HighscoreEntry } from "../data/highscores-default";
import { POLITICAL_SYSTEMS } from "../data/politicalSystems";
import { HelpCircle } from "lucide-react";
import { useLang } from "../i18n/lang";
import { translateDemocracyLevel, translatePoliticalSystem, translateCompassValue, translateLeaderDescription } from "../i18n/translateGameData";

/** Parse "What: X; Whence: Y; How: Z; Whither: W" to parts */
function parseValues(s: string) {
  const grab = (key: string) => {
    const m = new RegExp(`${key}\\s*:\\s*([^;]+)`, "i").exec(s || "");
    return (m?.[1] || "").trim();
  };
  return {
    what: grab("What"),
    whence: grab("Whence"),
    how: grab("How"),
    whither: grab("Whither"),
  };
}

/** Get image URL for leader (V2: supports avatarUrl from MongoDB) */
function imgForLeader(entry: HighscoreEntry) {
  // Priority 1: Use avatarUrl from API (compressed 64x64 WebP thumbnail from MongoDB)
  if (entry.avatarUrl) {
    return entry.avatarUrl;
  }
  
  // Priority 2: Try historical leader image (for predefined roles)
  const first = entry.name.split(" ")[0];
  return `/assets/images/leaders/${first}.jpg`;
}

/** Simple badge/pill used for rankings */
function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 md:gap-2 rounded-xl border border-white/15 bg-gradient-to-br from-white/12 to-white/5 px-2 py-1.5 md:px-3 md:py-2">
      <span className="text-[10px] md:text-[11px] uppercase tracking-wide text-white/70">{label}</span>
      <span className="px-2 py-1 rounded-md bg-white/10 text-white/90 text-xs md:text-sm font-semibold">{value}</span>
    </span>
  );
}

/** Color presets for the four value pills */
const VALUE_COLORS = {
  indigo: { bg: "bg-indigo-500/90", text: "text-white" },
  emerald: { bg: "bg-emerald-500/90", text: "text-white" },
  amber: { bg: "bg-amber-400/95", text: "#0b1335" },
  rose: { bg: "bg-rose-500/90", text: "text-white" },
} as const;

function ValuePill({
  label,
  value,
  color,
}: {
  label: "WHAT" | "WHENCE" | "HOW" | "WHITHER";
  value: string;
  color: keyof typeof VALUE_COLORS;
}) {
  const c = VALUE_COLORS[color];
  return (
    <div className={`rounded-2xl px-3 py-2 md:px-4 md:py-3 ${c.bg} ${c.text} shadow-lg`}>
      <div className="text-[10px] md:text-xs font-bold tracking-wide opacity-90">{label}:</div>
      <div className="text-xs md:text-sm lg:text-base font-semibold truncate">{value || "—"}</div>
    </div>
  );
}

/** Modal popup for a leader card (refreshed visuals) */
export default function LeaderPopup({
  entry,
  onClose,
}: {
  entry: HighscoreEntry | null;
  onClose: () => void;
}) {
  const show = !!entry;
  const [showSystemModal, setShowSystemModal] = useState(false);
  const lang = useLang();

  const parsed = useMemo(() => parseValues(entry?.values || ""), [entry]);

  // NEW: system meta from canonical table
  const systemMeta = useMemo(() => {
    if (!entry?.politicalSystem) return null;
    return POLITICAL_SYSTEMS.find((ps) => ps.name === entry.politicalSystem) || null;
  }, [entry]);

  // Period directly from entry (V2: stored in MongoDB, no fallback needed)
  const period = entry?.period;

  // ESC to close
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, onClose]);

  return (
    <AnimatePresence>
      {show && entry && (
        <motion.div
          className="fixed inset-0 z-[1000] grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          {/* Card */}
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: 14, scale: 0.96, opacity: 0.95 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.98, opacity: 0.9 }}
            transition={{ type: "spring", stiffness: 260, damping: 24, mass: 0.9 }}
            className="relative w-[min(92vw,760px)] rounded-3xl overflow-hidden shadow-2xl border border-white/10"
          >
            {/* Header: image + title */}
            <div className="relative px-3 py-3 md:px-5 md:py-4 bg-gradient-to-r from-[#0f1f7a] via-[#142aa8] to-[#0f1f7a]">
              <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                <img
                  src={imgForLeader(entry)}
                  alt={entry.name}
                  width={64}
                  height={64}
                  className="w-16 h-16 md:w-[90px] md:h-[90px] rounded-xl object-cover border-2 border-white/20 shadow flex-shrink-0"
                  onError={(ev) => {
                    (ev.currentTarget as HTMLImageElement).src =
                      "/assets/images/leaders/placeholder.jpg";
                  }}
                />
                <div className="flex items-center gap-2 md:gap-3 flex-wrap flex-1 min-w-0">
                  <h3
                    className="text-xl md:text-3xl lg:text-[40px] font-bold tracking-tight text-white drop-shadow truncate"
                    style={{ fontFamily: "'Playfair Display', ui-serif, serif" }}
                  >
                    {entry.name}
                  </h3>

                  {/* period pill */}
                  {period && (
                    <span className="inline-flex items-center rounded-lg bg-white/10 text-white/90 px-2 py-1 md:px-3 md:py-1 text-xs md:text-sm font-semibold border border-white/15">
                      {period}
                    </span>
                  )}
                </div>
              </div>

              {/* Close - larger touch target on mobile */}
              <button
                onClick={onClose}
                className="absolute top-2 right-2 w-11 h-11 md:w-9 md:h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="bg-[#0c1440] px-3 pt-4 pb-3 md:px-5 md:pt-5 md:pb-4 text-white/90">
              {/* System row */}
              <div className="mb-3 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] md:text-[11px] uppercase tracking-wide text-white/70">{lang("POWER_POLITICAL_SYSTEM")}</span>
                {entry.politicalSystem ? (
                  <button
                    type="button"
                    onClick={() => setShowSystemModal(true)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 md:py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-sm"
                    aria-label="Show system details"
                  >
                    <span className="font-semibold truncate max-w-[200px] md:max-w-none">{translatePoliticalSystem(entry.politicalSystem, lang)}</span>
                    <HelpCircle className="w-5 h-5 md:w-4 md:h-4 text-amber-300 flex-shrink-0" />
                  </button>
                ) : (
                  <span className="px-2 py-1 rounded-md bg-white/5 text-white/60">—</span>
                )}
              </div>

              <p className="leading-relaxed text-sm md:text-base">{translateLeaderDescription(entry.name, entry.about, lang)}</p>

              {/* Ranking pills */}
              <div className="mt-4 md:mt-5 flex flex-wrap gap-2 md:gap-3">
                <Badge label={lang("LIBERALISM")} value={translateDemocracyLevel(entry.democracy, lang)} />
                <Badge label={lang("AUTONOMY")} value={translateDemocracyLevel(entry.autonomy, lang)} />
              </div>
            </div>

            {/* Footer: Personal values (four 2-line colored pills) */}
            <div className="bg-gradient-to-t from-[#5f2e83] to-[#533076] px-3 py-4 md:px-5 md:py-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                <ValuePill label={lang("COMPASS_WHAT").toUpperCase() as any}    value={translateCompassValue(parsed.what, lang)}    color="indigo" />
                <ValuePill label={lang("COMPASS_WHENCE").toUpperCase() as any}  value={translateCompassValue(parsed.whence, lang)}  color="emerald" />
                <ValuePill label={lang("COMPASS_HOW").toUpperCase() as any}     value={translateCompassValue(parsed.how, lang)}     color="amber" />
                <ValuePill label={lang("COMPASS_WHITHER").toUpperCase() as any} value={translateCompassValue(parsed.whither, lang)} color="rose" />
              </div>
            </div>
          </motion.div>

          {/* System modal */}
          <AnimatePresence>
            {showSystemModal && systemMeta && (
              <motion.div
                className="fixed inset-0 z-[1001] grid place-items-center px-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="absolute inset-0 bg-black/55" onClick={() => setShowSystemModal(false)} />
                <motion.div
                  className="relative z-10 w-[min(90vw,512px)] rounded-3xl border border-white/10 bg-gradient-to-b from-[#1b1f3b] to-[#261c4a] p-4 md:p-5 shadow-2xl"
                  initial={{ scale: 0.94, y: 10, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.97, y: 6, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl md:text-2xl font-extrabold bg-gradient-to-r from-yellow-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent truncate">
                      {translatePoliticalSystem(systemMeta.name, lang)}
                    </h2>
                    <button
                      onClick={() => setShowSystemModal(false)}
                      className="rounded-xl px-3 py-2 bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 text-sm flex-shrink-0"
                    >
                      {lang("CLOSE")}
                    </button>
                  </div>
                  <p className="mt-3 text-white/85 text-sm md:text-base leading-relaxed">{systemMeta.description}</p>
                  {systemMeta.flavor && (
                    <p className="mt-3 italic text-amber-200/90 text-sm md:text-base">{systemMeta.flavor}</p>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
