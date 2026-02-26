// src/components/event/LegacyStarBar.tsx
// Premium Legacy Bar UI for Free Play mode.
//
// Displays:
// - Progress bar (0-100 LP) with gradient fill
// - 4 star icons at thresholds (20, 40, 60, 80)
// - LP counter with animated transitions
//
// Star states:
// - Unearned: Yellow "?" (1-3) or Purple "?" (4)
// - Active (earned + above threshold): Solid star with glow
// - Ghosted (earned + below threshold): Semi-transparent star
//
// Connected to:
// - src/store/legacyStore.ts: Reads LP, stars, activePerks

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLegacyStore } from "../../store/legacyStore";
import { STAR_THRESHOLDS } from "../../data/perks";
import { useLang } from "../../i18n/lang";
import { audioManager } from "../../lib/audioManager";

// ============================================================================
// STAR ICON COMPONENT
// ============================================================================

function StarIcon({
    index,
    state,
    threshold,
}: {
    index: number;
    state: { reached: boolean; perkChosen: boolean; active: boolean };
    threshold: number;
}) {
    const isPurple = index === 3; // Star 4 is purple
    const baseColor = isPurple ? "text-purple-400" : "text-amber-400";
    const glowColor = isPurple
        ? "drop-shadow-[0_0_6px_rgba(168,85,247,0.8)]"
        : "drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]";

    if (!state.reached) {
        // Unearned — question mark
        return (
            <div
                className={`relative flex items-center justify-center w-5 h-5 ${baseColor} opacity-60`}
                title={`${threshold} LP`}
            >
                <span className="text-[11px] font-black">?</span>
            </div>
        );
    }

    if (state.active) {
        // Earned + above threshold — solid star with glow
        return (
            <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={`relative flex items-center justify-center w-5 h-5 ${baseColor} ${glowColor}`}
                title={`★ ${threshold} LP`}
            >
                <span className="text-[13px]">★</span>
            </motion.div>
        );
    }

    // Earned but below threshold — ghosted (semi-transparent)
    return (
        <div
            className={`relative flex items-center justify-center w-5 h-5 ${baseColor} opacity-30`}
            title={`${threshold} LP (lost)`}
        >
            <span className="text-[13px]">★</span>
        </div>
    );
}

// ============================================================================
// ACTIVE PERKS TOOLTIP
// ============================================================================

function PerkTooltip({ onClose }: { onClose: () => void }) {
    const lang = useLang();
    const activePerks = useLegacyStore((s) => s.activePerks);
    const legacyPoints = useLegacyStore((s) => s.legacyPoints);
    const stars = useLegacyStore((s) => s.stars);

    const earnedCount = stars.filter((s) => s.reached).length;

    return (
        <div
            className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-white/15 bg-slate-900/95 p-3 text-white shadow-xl backdrop-blur-sm z-20"
            onMouseEnter={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                className="absolute right-2 top-2 text-white/60 hover:text-white text-xs"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                aria-label="Close"
            >
                ×
            </button>

            {/* Legacy Points */}
            <div className="text-xs uppercase tracking-wide text-white/50 mb-2">
                {lang("LEGACY_BREAKDOWN") || "Legacy Breakdown"}
            </div>

            <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-white/80">{lang("LEGACY_POINTS") || "Legacy Points"}</span>
                <span className="text-lg font-bold tabular-nums text-amber-300">
                    {Math.round(legacyPoints)}
                </span>
            </div>

            {/* Stars Progress */}
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/10">
                {STAR_THRESHOLDS.map((t, i) => (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                        <span className={`text-xs ${stars[i].reached ? (i === 3 ? "text-purple-400" : "text-amber-400") : "text-white/30"}`}>
                            {stars[i].reached ? "★" : "?"}
                        </span>
                        <span className="text-[9px] text-white/40">{t}</span>
                    </div>
                ))}
                <span className="text-[10px] text-white/40 ml-auto">{earnedCount}/4</span>
            </div>

            {/* Active Perks */}
            {activePerks.length > 0 ? (
                <ul className="space-y-1.5">
                    {activePerks.map((perk) => (
                        <li key={perk.id} className="flex items-center gap-2 text-white/80">
                            <span className="text-sm">{perk.icon}</span>
                            <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium truncate block">
                                    {lang(perk.nameKey) || perk.nameKey}
                                </span>
                                <span className="text-[10px] text-white/50 truncate block">
                                    {lang(perk.descKey) || perk.descKey}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-white/40 italic">
                    {lang("LEGACY_NO_PERKS") || "Earn stars to unlock perks"}
                </p>
            )}
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LegacyStarBar() {
    const lang = useLang();
    const legacyPoints = useLegacyStore((s) => s.legacyPoints);
    const stars = useLegacyStore((s) => s.stars);
    const activePerks = useLegacyStore((s) => s.activePerks);
    const hasUltimate = activePerks.some(p => p.effectType === "ultimate");
    const [showTooltip, setShowTooltip] = useState(false);

    // Animated LP display
    const [displayLP, setDisplayLP] = React.useState(legacyPoints);
    const [isProgressing, setIsProgressing] = React.useState(false);

    // Progress percentage (cap visual at 100 LP for bar width)
    // IMPORTANT: Compute from displayLP so the FILL BAR tweens smoothly alongside the stats
    const progressPercent = Math.min(100, (displayLP / 100) * 100);
    const prevRef = React.useRef(legacyPoints);
    const rafRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        // Find if we just crossed any threshold visually
        if (prevRef.current !== displayLP) {
            STAR_THRESHOLDS.forEach((t) => {
                if (prevRef.current < t && displayLP >= t) {
                    audioManager.playSfx('achievement1');
                }
            });
            prevRef.current = displayLP;
        }
    }, [displayLP]);

    React.useEffect(() => {
        const start = performance.now();
        const from = displayLP; // Start tweening from current visual frame
        const to = legacyPoints;
        const DURATION = 2000; // Increased to 2 seconds for clear visibility

        if (from === to) {
            setIsProgressing(false);
            return;
        }

        setIsProgressing(true);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        const tick = (t: number) => {
            const p = Math.max(0, Math.min(1, (t - start) / DURATION));
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplayLP(Math.round(from + (to - from) * eased));
            if (p < 1) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                rafRef.current = null;
                setIsProgressing(false);
            }
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        };
    }, [legacyPoints]);

    return (
        <div
            className="relative z-10 w-full"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            dir="ltr"
        >
            <div
                className={`w-full h-[64px] shrink-0 rounded-xl bg-[rgba(15,23,42,0.85)] border shadow-sm backdrop-blur-sm text-white cursor-pointer transition-colors duration-200 overflow-hidden flex flex-col pt-1.5 ${hasUltimate
                        ? "border-purple-500/50 hover:border-purple-400/80 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                        : "border-amber-500/30 hover:border-amber-500/50"
                    }`}
                onClick={(e) => {
                    e.stopPropagation();
                    setShowTooltip((prev) => !prev);
                }}
                role="button"
                tabIndex={0}
                aria-label="Legacy score information"
            >
                {/* Top: Label (LP removed, visible on hover only) */}
                <div className="flex items-center justify-between px-4 pb-1">
                    <span className={`text-[10px] uppercase tracking-[0.15em] font-black ${hasUltimate ? "text-purple-400/90" : "text-amber-400/80"
                        }`}>
                        {lang("LEGACY_LABEL") || "Current Legacy Power"}
                    </span>
                </div>

                {/* Middle: Progress bar with inline star markers */}
                <div className="relative mx-4 mt-1 h-3 rounded-full bg-white/10 overflow-visible">
                    {/* Fill - Driven by displayLP via style, no motion.div transition to avoid fighting RAF */}
                    <div
                        id="legacy-bar-edge"
                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-75 ${hasUltimate
                                ? "bg-gradient-to-r from-purple-600 via-purple-400 to-indigo-300 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                                : "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300"
                            }`}
                        style={{ width: `${Math.max(2, progressPercent)}%` }}
                    >
                        {/* Edge Glow */}
                        <AnimatePresence>
                            {isProgressing && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute top-0 bottom-0 right-0 w-4 -mr-2 bg-gradient-to-r from-transparent to-white/60 blur-[4px] rounded-full z-10"
                                />
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Star threshold markers & icons perfectly vertically aligned */}
                    {STAR_THRESHOLDS.map((threshold, i) => {
                        const leftPercent = (threshold / 100) * 100;
                        return (
                            <div
                                key={i}
                                className="absolute top-1/2"
                                style={{ left: `${leftPercent}%`, transform: `translate(-50%, -50%)` }}
                            >
                                {/* Marker Dot */}
                                <div className={`w-1.5 h-1.5 rounded-full ${displayLP >= threshold
                                    ? i === 3
                                        ? "bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,1)]"
                                        : "bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,1)]"
                                    : "bg-white/30"
                                    }`} />

                                {/* Icon directly underneath */}
                                <div className="absolute top-1/2 mt-1.5 left-1/2 -translate-x-1/2">
                                    <StarIcon
                                        index={i}
                                        state={{
                                            reached: stars[i].reached,
                                            perkChosen: stars[i].perkChosen,
                                            active: displayLP >= threshold // Visually active only if visual LP crossed it
                                        }}
                                        threshold={threshold}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Tooltip */}
            <AnimatePresence>
                {showTooltip && (
                    <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                    >
                        <PerkTooltip onClose={() => setShowTooltip(false)} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
