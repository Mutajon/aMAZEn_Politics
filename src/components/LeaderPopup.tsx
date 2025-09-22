// src/components/LeaderPopup.tsx
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DEFAULT_HIGHSCORES,
  type HighscoreEntry,
} from "../data/highscores-default";
import { POLITICAL_SYSTEMS } from "../data/politicalSystems";
import { HelpCircle } from "lucide-react";

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

function imgForLeader(name: string) {
  const first = name.split(" ")[0];
  return `/assets/images/leaders/${first}.jpg`;
}

/** Simple badge/pill used for rankings */
function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-gradient-to-br from-white/12 to-white/5 px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-white/70">{label}</span>
      <span className="px-2 py-1 rounded-md bg-white/10 text-white/90 text-sm font-semibold">{value}</span>
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
    <div className={`rounded-2xl px-4 py-3 ${c.bg} ${c.text} shadow-lg`}>
      <div className="text-xs font-bold tracking-wide opacity-90">{label}:</div>
      <div className="text-sm md:text-base font-semibold">{value || "—"}</div>
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

  const parsed = useMemo(() => parseValues(entry?.values || ""), [entry]);

  // NEW: system meta from canonical table
  const systemMeta = useMemo(() => {
    if (!entry?.politicalSystem) return null;
    return POLITICAL_SYSTEMS.find((ps) => ps.name === entry.politicalSystem) || null;
  }, [entry]);

  // --- safe period with dataset fallback ---
  const period = useMemo(() => {
    if (!entry) return undefined;
    return (
      entry.period ??
      DEFAULT_HIGHSCORES.find((x) => x.name === entry.name)?.period
    );
  }, [entry]);

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
            <div className="relative px-5 py-4 bg-gradient-to-r from-[#0f1f7a] via-[#142aa8] to-[#0f1f7a]">
              <div className="flex items-center gap-4 flex-wrap">
                <img
                  src={imgForLeader(entry.name)}
                  alt={entry.name}
                  width={90}
                  height={90}
                  className="w-[90px] h-[90px] rounded-xl object-cover border-2 border-white/20 shadow"
                  onError={(ev) => {
                    (ev.currentTarget as HTMLImageElement).src =
                      "/assets/images/leaders/placeholder.jpg";
                  }}
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <h3
                    className="text-3xl md:text-[40px] font-bold tracking-tight text-white drop-shadow"
                    style={{ fontFamily: "'Playfair Display', ui-serif, serif" }}
                  >
                    {entry.name}
                  </h3>

                  {/* period pill */}
                  {period && (
                    <span className="inline-flex items-center rounded-lg bg-white/10 text-white/90 px-3 py-1 text-sm font-semibold border border-white/15">
                      {period}
                    </span>
                  )}
                </div>
              </div>

              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="bg-[#0c1440] px-5 pt-5 pb-4 text-white/90">
              {/* System row */}
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-white/70">Political system:</span>
                {entry.politicalSystem ? (
                  <button
                    type="button"
                    onClick={() => setShowSystemModal(true)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10"
                    aria-label="Show system details"
                  >
                    <span className="font-semibold">{entry.politicalSystem}</span>
                    <HelpCircle className="w-4 h-4 text-amber-300" />
                  </button>
                ) : (
                  <span className="px-2 py-1 rounded-md bg-white/5 text-white/60">—</span>
                )}
              </div>

              <p className="leading-relaxed">{entry.about}</p>

              {/* Ranking pills */}
              <div className="mt-5 flex flex-wrap gap-3">
                <Badge label="Liberalism" value={entry.democracy} />
                <Badge label="Autonomy" value={entry.autonomy} />
              </div>
            </div>

            {/* Footer: Personal values (four 2-line colored pills) */}
            <div className="bg-gradient-to-t from-[#5f2e83] to-[#533076] px-5 py-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ValuePill label="WHAT"    value={parsed.what}    color="indigo" />
                <ValuePill label="WHENCE"  value={parsed.whence}  color="emerald" />
                <ValuePill label="HOW"     value={parsed.how}     color="amber" />
                <ValuePill label="WHITHER" value={parsed.whither} color="rose" />
              </div>
            </div>
          </motion.div>

          {/* System modal */}
          <AnimatePresence>
            {showSystemModal && systemMeta && (
              <motion.div
                className="fixed inset-0 z-[1001] grid place-items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="absolute inset-0 bg-black/55" onClick={() => setShowSystemModal(false)} />
                <motion.div
                  className="relative z-10 w-full max-w-lg rounded-3xl border border-white/10 bg-gradient-to-b from-[#1b1f3b] to-[#261c4a] p-5 shadow-2xl"
                  initial={{ scale: 0.94, y: 10, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.97, y: 6, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-extrabold bg-gradient-to-r from-yellow-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                      {systemMeta.name}
                    </h2>
                    <button
                      onClick={() => setShowSystemModal(false)}
                      className="rounded-xl px-2 py-1 bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                    >
                      Close
                    </button>
                  </div>
                  <p className="mt-3 text-white/85">{systemMeta.description}</p>
                  {systemMeta.flavor && (
                    <p className="mt-3 italic text-amber-200/90">{systemMeta.flavor}</p>
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
