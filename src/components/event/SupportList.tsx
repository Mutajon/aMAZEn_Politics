// SupportList.tsx — lucide-react icons with COLORED badge bg + WHITE strokes
// - Emoji left of percent, animated percent, persistent delta, bobbing arrows.
// - Icon badge: per-entity colored background; icon lines (strokes) are white.
// - Minimal knobs live at the top (sizes + colors).

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Landmark, Heart, ArrowUp, ArrowDown, Skull } from "lucide-react";
import { lang } from "../../i18n/lang";
import { useLanguage } from "../../i18n/LanguageContext";
import { useSupportEntityPopover, type OpenEntityType } from "../../hooks/useSupportEntityPopover";
import type { SupportProfile } from "../../data/supportProfiles";
import { useLogger } from "../../hooks/useLogger";
import { useLegacyStore } from "../../store/legacyStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useRoleStore } from "../../store/roleStore";
import SupportEntityPopover from "./SupportEntityPopover";

/* ====================== TUNABLES (EDIT HERE) ====================== */
// Sizing (Mobile-first responsive: smaller on mobile, larger on desktop)
const EMOJI_SIZE_CLASS = "text-[18px] md:text-[24px]";           // 18px mobile → 24px desktop
const PERCENT_FONT_CLASS = "text-[13px] md:text-[15px]";         // 13px mobile → 15px desktop
const DELTA_FONT_CLASS = "text-[11px] md:text-[13px]";           // 11px mobile → 13px desktop
const ARROW_SIZE_CLASS = "w-5 h-5 md:w-7 md:h-7";                // 20px mobile → 28px desktop

// Badge look
const ICON_BADGE_SHAPE = "rounded-xl";       // e.g., rounded-lg | rounded-2xl
const ICON_BADGE_PADDING = "p-1.5 md:p-2";  // 6px mobile → 8px desktop
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
  originalDelta?: number | null;   // pre-perk delta (for strikethrough animation)
  trend?: "up" | "down" | null;    // persists until caller changes it
  note?: string | null;            // optional secondary line
  moodVariant?: "civic" | "empathetic"; // civic => angry low; empathetic => sad low (Mom)
  isDeceased?: boolean;            // NEW: True if entity is dead (shows grayed out with skull)
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
  const { openEntity, togglePopover, closePopover, getEntityData } = useSupportEntityPopover();
  const logger = useLogger();
  const isFreePlay = useSettingsStore(s => s.isFreePlay);
  const activePerks = useLegacyStore(s => s.activePerks);

  // Tooltip state for custom perk tooltips
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic names
  const peopleName = (isFreePlay && useRoleStore.getState().analysis?.holders?.[2]?.name) || lang("SUPPORT_THE_PEOPLE") || "The People";

  const handleTooltipEnter = (perkId: string) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = setTimeout(() => {
      setActiveTooltip(perkId);
    }, 300);
  };

  const handleTooltipLeave = () => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    setActiveTooltip(null);
  };

  const handleTooltipToggle = (perkId: string) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    setActiveTooltip(prev => prev === perkId ? null : perkId);
  };

  const formatDesc = (descKey: string) => {
    let text = lang(descKey) || descKey;
    text = text.replace("{people}", peopleName);
    return text;
  };

  const globalPerks = isFreePlay ? activePerks.filter(p => p.targetEntity === "global") : [];

  return (
    <div className="border-slate-400/30 bg-slate-900/60 backdrop-blur-sm rounded-2xl p-3 md:p-4 relative">
      <div className="flex justify-between items-center mb-3 px-1">
        <h3 className="text-[10px] uppercase tracking-widest font-bold text-white/40">{lang("SUPPORT_VALUES_TITLE")}</h3>

        {/* Global Perks Container (Top Left of widget) */}
        {globalPerks.length > 0 && (
          <div className="flex gap-1 relative z-20" dir="ltr">
            {globalPerks.map(perk => (
              <div
                key={perk.id}
                className="relative"
                onMouseEnter={() => handleTooltipEnter(perk.id)}
                onMouseLeave={handleTooltipLeave}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTooltipToggle(perk.id);
                }}
              >
                <div className="w-5 h-5 bg-slate-800/80 border border-slate-600/50 rounded flex items-center justify-center text-[10px] shadow-sm cursor-help hover:bg-slate-700/80 transition-colors">
                  {perk.icon}
                </div>

                {/* Custom Tooltip */}
                <AnimatePresence>
                  {activeTooltip === perk.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-2 w-48 bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl z-50 pointer-events-none"
                    >
                      <p className="text-xs text-white/90 leading-tight whitespace-pre-wrap break-words" dir="auto">
                        <strong>{lang(perk.nameKey) || perk.nameKey}</strong>
                        <br />
                        <span className="text-white/70">{formatDesc(perk.descKey)}</span>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2 md:space-y-2">
        {items.map((it, index) => (
          <SupportCard
            key={it.id}
            item={it}
            index={index}
            animatePercent={animatePercent}
            animateDurationMs={animateDurationMs}
            onCardClick={(entityType) => {
              togglePopover(entityType);
              if (openEntity !== entityType) {
                logger.log(
                  "support_entity_info_opened",
                  { entityType },
                  `User opened support entity info for ${entityType}`
                );
              } else {
                logger.log(
                  "support_entity_info_closed",
                  { entityType },
                  `User closed support entity info for ${entityType}`
                );
              }
            }}
            openEntity={openEntity}
            onClosePopover={() => {
              if (openEntity) {
                logger.log(
                  "support_entity_info_closed",
                  { entityType: openEntity },
                  `User closed support entity info for ${openEntity}`
                );
              }
              closePopover();
            }}
            getEntityData={getEntityData}
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
  onCardClick,
  openEntity,
  onClosePopover,
  getEntityData,
}: {
  item: SupportItem;
  index: number;
  animatePercent: boolean;
  animateDurationMs: number;
  onCardClick: (entityType: NonNullable<OpenEntityType>) => void;
  openEntity: OpenEntityType;
  onClosePopover: () => void;
  getEntityData: (entityType: NonNullable<OpenEntityType>, currentSupport: number) => { name: string, profile: SupportProfile, currentSupport: number } | null;
}) {
  const { language } = useLanguage();
  const isRTL = language === 'he';
  const {
    id,
    name,
    percent,
    initialPercent,
    icon,
    delta = null,
    originalDelta = null,
    trend = null,
    note = null,
    moodVariant = "civic",
    isDeceased = false,
  } = item;

  // Ensure all hooks are called consistently BEFORE any early return
  const isFreePlay = useSettingsStore(s => s.isFreePlay);
  const activePerks = useLegacyStore(s => s.activePerks);
  const localPerks = isFreePlay ? activePerks.filter(p => p.targetEntity === id) : [];

  // Tooltip state for custom perk tooltips on local cards
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const analysis = useRoleStore(s => s.analysis);
  const peopleName = (isFreePlay && analysis?.holders?.[2]?.name) || lang("SUPPORT_THE_PEOPLE") || "The People";

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
    };
  }, [pctTarget, animatePercent, animateDurationMs, id]);

  // Early return for deceased entities (Mom only currently)
  if (isDeceased) {
    return (
      <motion.div
        className="rounded-xl px-2 py-2 md:px-3 md:py-2.5 text-white relative bg-gray-800/50 border border-gray-600/30 opacity-60"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 0.6, x: 0 }}
        transition={{ duration: 0.5, delay: index * 0.2 }}
      >
        <div className="flex items-start">
          {/* Grayed out icon badge with skull */}
          <div className={`mr-2 md:mr-3 inline-flex items-center justify-center shrink-0 ${ICON_BADGE_SHAPE} ${ICON_BADGE_PADDING} bg-gray-600/50 ${ICON_BADGE_RING}`}>
            <span className="text-gray-400">
              <Skull className="w-4 h-4" strokeWidth={2.6} />
            </span>
          </div>

          {/* Main info - grayed out */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="font-semibold text-sm md:text-base text-gray-400 line-through">{name}</div>

              {/* Deceased label */}
              <span className="text-[11px] md:text-[13px] leading-none px-2 py-1 rounded-full border bg-gray-700/50 border-gray-500/40 text-gray-400 font-medium">
                {lang("SUPPORT_DECEASED")}
              </span>

              {/* Frozen at 0% */}
              <span className="text-[13px] md:text-[15px] leading-none px-2 py-1 rounded-full border font-semibold bg-gray-700/50 border-gray-500/40 text-gray-500">
                0%
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const showDelta = typeof delta === "number" && delta !== 0;
  const showTrend = trend === "up" || trend === "down";
  const showNote = !!note;
  // Crisis threshold (< 20%)
  const CRISIS_THRESHOLD = 20;
  const isCrisis = pctDisplay < CRISIS_THRESHOLD;
  const isLow = pctDisplay < 25; // Warning threshold (yellow !)

  // Colored badge bg + white strokes
  const badgeBg = ICON_BADGE_BG[id] ?? "bg-white/20";

  // Determine if this entity can show popover (people or middle only, not mom)
  const isClickable = id === "people" || id === "middle";
  const entityType: "people" | "challenger" | null = id === "people" ? "people" : id === "middle" ? "challenger" : null;
  const isPopoverOpen = entityType && openEntity === entityType;

  const handleTooltipEnter = (perkId: string) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = setTimeout(() => {
      setActiveTooltip(perkId);
    }, 300);
  };

  const handleTooltipLeave = () => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    setActiveTooltip(null);
  };

  const handleTooltipToggle = (perkId: string) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    setActiveTooltip(prev => prev === perkId ? null : perkId);
  };

  const formatDesc = (descKey: string) => {
    let text = lang(descKey) || descKey;
    text = text.replace("{people}", peopleName);
    return text;
  };

  // Get entity data if popover should be shown
  const entityData = entityType && isPopoverOpen ? getEntityData(entityType, pctDisplay) : null;

  const handleClick = () => {
    if (isClickable && entityType) {
      onCardClick(entityType);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isClickable && entityType && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onCardClick(entityType);
    }
  };

  return (
    <motion.div
      id={`support-pill-${id}`}
      className={[
        "rounded-xl px-2 py-2 md:px-3 md:py-2.5 text-white relative",
        isCrisis
          ? "bg-red-500/15 border-2 border-red-500/60" // Crisis: red background + thicker red border
          : "bg-white/3 border border-white/5", // Normal: subtle background + border
        isClickable ? "cursor-pointer hover:bg-white/10 transition-colors" : "", // Make clickable entities interactive
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
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `View ${name} details` : undefined}
    >
      {/* Entity-specific Perks Container (Top Left of Card in RTL, Top Right in LTR) */}
      {localPerks.length > 0 && (
        <div className={`absolute top-1 ${isRTL ? 'left-1.5' : 'right-1.5'} flex gap-1 z-20`} dir="ltr">
          {localPerks.map(perk => (
            <div
              key={perk.id}
              className="relative"
              onMouseEnter={() => handleTooltipEnter(perk.id)}
              onMouseLeave={handleTooltipLeave}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTooltipToggle(perk.id);
              }}
            >
              <div className="w-4 h-4 bg-slate-800/90 border border-slate-600/50 rounded flex items-center justify-center text-[9px] shadow-sm cursor-help hover:bg-slate-700/90 transition-colors">
                {perk.icon}
              </div>

              {/* Custom Tooltip */}
              <AnimatePresence>
                {activeTooltip === perk.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-40 bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl z-50 pointer-events-none"
                  >
                    <p className="text-[10px] text-white/90 leading-tight whitespace-pre-wrap break-words" dir="auto">
                      <strong className="text-xs">{lang(perk.nameKey) || perk.nameKey}</strong>
                      <br />
                      <span className="text-white/70">{formatDesc(perk.descKey)}</span>
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start">
        {/* Left icon badge — colored background + white lines */}
        <div className={`mr-2 md:mr-3 inline-flex items-center justify-center shrink-0 ${ICON_BADGE_SHAPE} ${ICON_BADGE_PADDING} ${badgeBg} ${ICON_BADGE_RING}`}>
          <span className={ICON_STROKE_CLASS}>
            {icon ?? <DefaultSupportIcons.PeopleIcon className="w-4 h-4" />}
          </span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="font-semibold text-sm md:text-base">{name}</div>

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
              <AnimatedDelta
                delta={delta}
                originalDelta={originalDelta}
              />
            )}

            {/* right-aligned trend arrow (bigger/thicker, bobbing, persists) */}
            {showTrend && (
              <div className={`ml-auto ${!isRTL ? 'mr-7' : ''}`}>
                {trend === "up" ? (
                  <motion.span
                    key={`arrow-up`} // stable node so it keeps bobbing
                    aria-hidden="true"
                    animate={{ y: [2, -3, 2] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", type: "tween" }}
                    className="inline-block will-change-transform"
                  >
                    <ArrowUp className={`${ARROW_SIZE_CLASS}`} strokeWidth={2.5} color="#86efac" />
                  </motion.span>
                ) : (
                  <motion.span
                    key={`arrow-down`}
                    aria-hidden="true"
                    animate={{ y: [-2, 3, -2] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", type: "tween" }}
                    className="inline-block will-change-transform"
                  >
                    <ArrowDown className={`${ARROW_SIZE_CLASS}`} strokeWidth={2.5} color="#fca5a5" />
                  </motion.span>
                )}
              </div>
            )}
          </div>

          {/* note (only when provided) */}
          {showNote && (
            <div className="mt-1 text-[11px] md:text-[13px] text-white/80 leading-snug">
              {note}
            </div>
          )}
        </div>
      </div>

      {/* Support Entity Popover */}
      <AnimatePresence>
        {isPopoverOpen && entityData && entityType && (
          <SupportEntityPopover
            entityType={entityType}
            entityName={entityData.name}
            supportProfile={entityData.profile}
            currentSupport={entityData.currentSupport}
            onClose={onClosePopover}
          />
        )}
      </AnimatePresence>
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

const DefaultSupportIcons = {
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

// ============================================================================
// ANIMATED DELTA COMPONENT (Cross-out logic)
// ============================================================================

function AnimatedDelta({ delta, originalDelta }: { delta: number; originalDelta: number | null }) {
  const isModified = typeof originalDelta === "number" && originalDelta !== delta;

  // Base styling classes
  const getStyleClasses = (val: number) => {
    return [
      DELTA_FONT_CLASS,
      "leading-none px-2.5 py-1 rounded-full border",
      val > 0
        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
        : "border-rose-400/40 bg-rose-500/15 text-rose-200",
    ].join(" ");
  };

  const currentStyleClasses = getStyleClasses(delta);

  if (!isModified) {
    // Normal unmodified animation
    return (
      <motion.span
        key={`delta-${delta}`}
        initial={{ scale: 1.2, opacity: 0.0 }}
        animate={{ scale: 1.0, opacity: 1.0 }}
        transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.25 }}
        className={currentStyleClasses}
      >
        {delta > 0 ? `+${delta}` : delta}
      </motion.span>
    );
  }

  // Modified by perk: animate sequence
  const origStyleClasses = getStyleClasses(originalDelta);

  return (
    <div className="flex items-center gap-1.5" dir="ltr">
      {/* 1. Original Value crossed out */}
      <motion.div
        key={`orig-${originalDelta}`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.6, scale: 0.9 }}
        transition={{ duration: 0.3 }}
        className="relative flex items-center justify-center"
      >
        <span className={`${origStyleClasses}`}>
          {originalDelta > 0 ? `+${originalDelta}` : originalDelta}
        </span>
        {/* Diagonal crossover line */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3, ease: "easeOut" }}
          style={{ originX: 0 }}
          className="absolute inset-0 w-full h-[1.5px] bg-red-400/80 -rotate-12 top-1/2 -mt-[0.5px]"
        />
      </motion.div>

      {/* 2. New Final Value popping in */}
      <motion.span
        key={`new-${delta}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 20,
          delay: 0.6 // Wait for original + crossover
        }}
        className={currentStyleClasses}
      >
        {delta > 0 ? `+${delta}` : delta}
      </motion.span>
    </div>
  );
}
