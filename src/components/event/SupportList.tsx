// SupportList.tsx — lucide-react icons with COLORED badge bg + WHITE strokes
// - Emoji left of percent, animated percent, persistent delta, bobbing arrows.
// - Icon badge: per-entity colored background; icon lines (strokes) are white.
// - Minimal knobs live at the top (sizes + colors).

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Users, Landmark, Heart, ArrowUp, ArrowDown } from "lucide-react";

/* ====================== TUNABLES (EDIT HERE) ====================== */
// Sizing
const EMOJI_SIZE_CLASS = "text-[24px]";
const PERCENT_FONT_CLASS = "text-[15px]";
const DELTA_FONT_CLASS = "text-[13px]";
const ARROW_SIZE_CLASS = "w-7 h-7";

// Badge look
const ICON_BADGE_SHAPE = "rounded-xl";       // e.g., rounded-lg | rounded-2xl
const ICON_BADGE_PADDING = "p-2";            // e.g., p-1.5 | p-2.5
const ICON_BADGE_RING = "ring-1 ring-white/15 shadow-sm";

// Icon stroke color (white lines)
const ICON_STROKE_CLASS = "text-white";      // lucide uses currentColor for strokes

// Per-entity badge background colors
// Change these to whatever palette you like.
const ICON_BADGE_BG: Record<string, string> = {
  people: "bg-emerald-600",
  middle: "bg-amber-600",
  mom: "bg-rose-600",
};
/* ================================================================= */

export type SupportItem = {
  id: string; // "people" | "middle" | "mom" (used to pick badge color)
  name: string;
  percent: number;                 // 0..100 (target value - AFTER delta applied)
  initialPercent?: number;         // 0..100 (initial value - BEFORE delta applied, for animation baseline)
  /** kept for compat; not used for bg now */
  accentClass?: string;
  icon?: React.ReactNode;          // optional custom icon
  delta?: number | null;           // persists until caller changes it
  trend?: "up" | "down" | null;    // persists until caller changes it
  note?: string | null;            // optional secondary line
  moodVariant?: "civic" | "empathetic"; // civic => angry low; empathetic => sad low (Mom)
};

type Props = {
  items: SupportItem[];
  animatePercent?: boolean;      // default true
  animateDurationMs?: number;    // default 1000
};

export default function SupportList({
  items,
  animatePercent = true,
  animateDurationMs = 1000,
}: Props) {
  return (
    <div className="border-slate-400/30 bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4">
      <div className="space-y-2">
        {items.map((it, index) => (
          <SupportCard
            key={it.id}
            item={it}
            index={index}
            animatePercent={animatePercent}
            animateDurationMs={animateDurationMs}
          />
        ))}
      </div>
    </div>
  );
}

function SupportCard({
  item,
  index,
  animatePercent,
  animateDurationMs,
}: {
  item: SupportItem;
  index: number;
  animatePercent: boolean;
  animateDurationMs: number;
}) {
  const {
    id,
    name,
    percent,
    initialPercent,
    icon,
    delta = null,
    trend = null,
    note = null,
    moodVariant = "civic",
  } = item;

  // Smoothly animate displayed percent from initialPercent → percent
  // If initialPercent is provided, use it as the animation baseline (value before delta applied)
  // Otherwise, use current percent (no animation needed)
  const pctTarget = clampPercent(percent);
  const pctInitial = initialPercent !== undefined ? clampPercent(initialPercent) : pctTarget;

  const [pctDisplay, setPctDisplay] = useState<number>(pctInitial);
  const rafRef = useRef<number | null>(null);
  const prevTargetRef = useRef<number>(pctInitial);

  useEffect(() => {
    if (!animatePercent) {
      setPctDisplay(pctTarget);
      prevTargetRef.current = pctTarget;
      return;
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const start = performance.now();
    const from = prevTargetRef.current;
    const to = pctTarget;
    const duration = Math.max(0, animateDurationMs);

    // Only animate if values are different
    if (from === to) {
      setPctDisplay(to);
      prevTargetRef.current = to;
      return;
    }

    console.log(`[SupportCard:${id}] Animating percent: ${from} → ${to} (${to - from >= 0 ? '+' : ''}${to - from})`);

    const tick = (t: number) => {
      const elapsed = t - start;
      const k = duration === 0 ? 1 : Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - k, 3); // easeOutCubic
      const value = Math.round(from + (to - from) * eased);
      setPctDisplay(value);
      if (k < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevTargetRef.current = to;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [pctTarget, animatePercent, animateDurationMs, id]);

  const showDelta = typeof delta === "number" && delta !== 0;
  const showTrend = trend === "up" || trend === "down";
  const showNote = !!note;
  // Crisis threshold (< 20%)
  const CRISIS_THRESHOLD = 20;
  const isCrisis = pctDisplay < CRISIS_THRESHOLD;
  const isLow = pctDisplay < 25; // Warning threshold (yellow !)

  // Colored badge bg + white strokes
  const badgeBg = ICON_BADGE_BG[id] ?? "bg-white/20";

  return (
    <motion.div
      className={[
        "rounded-xl px-3 py-2.5 text-white",
        isCrisis
          ? "bg-red-500/15 border-2 border-red-500/60" // Crisis: red background + thicker red border
          : "bg-white/3 border border-white/5" // Normal: subtle background + border
      ].join(" ")}
      initial={{ opacity: 0, x: -30 }}
      animate={
        isCrisis
          ? { opacity: [0.7, 1, 0.7], x: 0 } // Crisis: pulsing opacity + position
          : { opacity: 1, x: 0 } // Normal: fade in once
      }
      transition={
        isCrisis
          ? {
              opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" }, // Continuous pulse
              x: { duration: 0.5, delay: index * 0.2, ease: [0.25, 0.46, 0.45, 0.94] } // Initial slide-in
            }
          : {
              duration: 0.5,
              delay: index * 0.2, // Stagger: 0s, 0.2s, 0.4s
              ease: [0.25, 0.46, 0.45, 0.94] // easeOutQuart
            }
      }
    >
      <div className="flex items-start">
        {/* Left icon badge — colored background + white lines */}
        <div className={`mr-3 inline-flex items-center justify-center shrink-0 ${ICON_BADGE_SHAPE} ${ICON_BADGE_PADDING} ${badgeBg} ${ICON_BADGE_RING}`}>
          <span className={ICON_STROKE_CLASS}>
            {icon ?? <DefaultSupportIcons.PeopleIcon className="w-4 h-4" />}
          </span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-semibold">{name}</div>

            {/* mood emoji (left of percent), tween-pop when bucket changes */}
            <MoodEmojiTween percent={pctDisplay} variant={moodVariant} />

            {/* percent pill (animated) – size controlled by PERCENT_FONT_CLASS */}
            <span
              className={[
                PERCENT_FONT_CLASS,
                "leading-none px-2 py-1 rounded-full border font-semibold",
                isCrisis
                  ? "bg-red-500/25 border-red-400/60 text-red-200" // Crisis: bright red styling
                  : isLow
                  ? "bg-white/10 border-white/15 text-rose-300" // Warning: subtle red text
                  : "bg-white/10 border-white/15 text-white", // Normal: white
              ].join(" ")}
            >
              {pctDisplay}%
            </span>
            {isCrisis && <span className="ml-1 text-red-300 font-bold">⚠️</span>}
            {!isCrisis && isLow && <span className="ml-1 text-yellow-300">!</span>}


            {/* delta pill (tween-pop, persists) – size controlled by DELTA_FONT_CLASS */}
            {showDelta && (
              <motion.span
                key={`delta-${delta}`} // re-trigger animation on change
                initial={{ scale: 1.2, opacity: 0.0 }}
                animate={{ scale: 1.0, opacity: 1.0 }}
                transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.25 }}
                className={[
                  `${DELTA_FONT_CLASS}`,
                  "leading-none px-2.5 py-1 rounded-full border",
                  delta > 0
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                    : "border-rose-400/40 bg-rose-500/15 text-rose-200",
                ].join(" ")}
              >
                {delta > 0 ? `+${delta}` : `${delta}`}
              </motion.span>
            )}

            {/* right-aligned trend arrow (bigger/thicker, bobbing, persists) */}
            {showTrend && (
              <div className="ml-auto">
                {trend === "up" ? (
                  <motion.span
                    key={`arrow-up`} // stable node so it keeps bobbing
                    aria-hidden="true"
                    animate={{ y: [2, -3, 2] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", type: "tween" }}
                    className="inline-block will-change-transform"
                  >
                    <ArrowUp className={`${ARROW_SIZE_CLASS}`} strokeWidth={3} color="#86efac" />
                  </motion.span>
                ) : (
                  <motion.span
                    key={`arrow-down`}
                    aria-hidden="true"
                    animate={{ y: [-2, 3, -2] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", type: "tween" }}
                    className="inline-block will-change-transform"
                  >
                    <ArrowDown className={`${ARROW_SIZE_CLASS}`} strokeWidth={3} color="#fca5a5"/>
                  </motion.span>
                )}
              </div>
            )}
          </div>

          {/* note (only when provided) */}
          {showNote && (
            <div className="mt-1 text-[13px] text-white/80 leading-snug">
              {note}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------ Mood (emoji only, with tween pop) --------------------- */

function MoodEmojiTween({
  percent,
  variant,
}: {
  percent: number;
  variant: "civic" | "empathetic";
}) {
  const bucket = moodBucket(percent);
  const { emoji, label } = moodForBucket(bucket, variant);
  return (
    <motion.span
      key={bucket} // remount on bucket change to play the pop
      role="img"
      aria-label={label}
      title={label}
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.18, 1] }} // 3-keyframe pop (tween)
      transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.28 }}
      className={`${EMOJI_SIZE_CLASS} leading-none select-none`}
    >
      {emoji}
    </motion.span>
  );
}

// 5-level buckets by percent
function moodBucket(percent: number): 0 | 1 | 2 | 3 | 4 {
  const p = clampPercent(percent);
  if (p >= 80) return 4;   // very positive
  if (p >= 60) return 3;   // slightly positive
  if (p >= 40) return 2;   // neutral
  if (p >= 20) return 1;   // slightly negative
  return 0;                // very negative
}

function moodForBucket(
  bucket: 0 | 1 | 2 | 3 | 4,
  variant: "civic" | "empathetic"
): { emoji: string; label: string } {
  // empathetic (Mom): sad for low buckets
  if (variant === "empathetic") {
    if (bucket === 4) return { emoji: "😄", label: "very happy" };
    if (bucket === 3) return { emoji: "🙂", label: "slightly happy" };
    if (bucket === 2) return { emoji: "😐", label: "neutral" };
    if (bucket === 1) return { emoji: "☹️", label: "slightly sad" };
    return { emoji: "😭", label: "very sad" };
  }
  // civic/default (People + middle): angry for low buckets
  if (bucket === 4) return { emoji: "😄", label: "very happy" };
  if (bucket === 3) return { emoji: "🙂", label: "slightly happy" };
  if (bucket === 2) return { emoji: "😐", label: "neutral" };
  if (bucket === 1) return { emoji: "😠", label: "slightly angry" };
  return { emoji: "😡", label: "very angry" };
}

function clampPercent(n: number) {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}

/* ------------------ Default lucide icons (white strokes) --------------------- */

export const DefaultSupportIcons = {
  PeopleIcon: ({ className = "" }: { className?: string }) => (
    <Users className={`w-4 h-4 ${ICON_STROKE_CLASS} ${className}`} strokeWidth={2.6} />
  ),
  BuildingIcon: ({ className = "" }: { className?: string }) => (
    <Landmark className={`w-4 h-4 ${ICON_STROKE_CLASS} ${className}`} strokeWidth={2.6} />
  ),
  HeartIcon: ({ className = "" }: { className?: string }) => (
    <Heart className={`w-4 h-4 ${ICON_STROKE_CLASS} ${className}`} strokeWidth={2.6} />
  ),
};
