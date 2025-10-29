// src/components/event/ResourceBar.tsx
// Restored visuals + animated budget counter + anchor for coin flights + player avatar + goals display

import React, { useMemo, useState } from "react";
import { Hourglass, Coins, User } from "lucide-react";
import GoalsCompact from "./GoalsCompact";
import { useSettingsStore } from "../../store/settingsStore";

type Props = {
  daysLeft: number;
  budget: number;
  showBudget?: boolean; // defaults to true
  avatarSrc?: string | null;
};

export default function ResourceBar({ daysLeft, budget, showBudget = true, avatarSrc }: Props) {
  // Check if modifiers (difficulty + goals) are enabled
  const enableModifiers = useSettingsStore((s) => s.enableModifiers);

  // --- Animated counter: prev -> budget over 2s (ease-out) ---
  const [displayBudget, setDisplayBudget] = React.useState(budget);
  const prevRef = React.useRef(budget);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const start = performance.now();
    const from = prevRef.current;
    const to = budget;
    const DURATION = 2000; // ms

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (t: number) => {
      const p = Math.max(0, Math.min(1, (t - start) / DURATION));
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplayBudget(Math.round(from + (to - from) * eased));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = budget;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [budget]);

  // --- Avatar URL normalization (from PlayerStatusStrip) ---
  const [imgError, setImgError] = useState(false);

  const resolvedSrc = useMemo(() => {
    const src = (avatarSrc || "").trim();
    if (!src) return "";
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) return src;
    if (src.startsWith("/")) return src;
    return `/${src}`;
  }, [avatarSrc]);

  return (
    <div className="w-full flex items-end justify-between gap-3">
      {/* Resources Section */}
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-white/50 uppercase tracking-wide px-1">
          Resources
        </div>
        <div className="flex items-stretch gap-2">
          <ResourcePill
            icon={<Hourglass className="w-4 h-4" />}
            label="Days Left"
            value={String(daysLeft)}
            iconBgClass="bg-sky-600"
            iconTextClass="text-cyan-200"
            width={120}
            bgClass="bg-[rgba(15,23,42,0.8)] border border-cyan-400/40"
          />
          {showBudget && (
            <ResourcePill
              icon={
                <span data-budget-anchor="true" id="budget-anchor" className="inline-flex">
                  <Coins className="w-4 h-4" />
                </span>
              }
              label="Budget"
              value={formatMoney(displayBudget)}
              iconBgClass="bg-amber-500/25"
              iconTextClass="text-amber-200"
              width={140}
            />
          )}
        </div>
      </div>

      {/* Goals Section (only if modifiers enabled) */}
      {enableModifiers && <GoalsCompact />}

      {/* Avatar */}
      <div
        className="shrink-0 rounded-xl overflow-hidden ring-1 ring-white/15 bg-white/5"
        style={{ width: 100, height: 100, minWidth: 100 }}
        aria-label="Player portrait"
        title={resolvedSrc || undefined}
      >
        {resolvedSrc && !imgError ? (
          <img
            src={resolvedSrc}
            alt="Player"
            className="w-full h-full object-cover"
            width={100}
            height={100}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-8 h-8 text-white/80" strokeWidth={2.2} />
          </div>
        )}
      </div>
    </div>
  );
}

function ResourcePill({
  icon,
  label,
  value,
  iconBgClass = "bg-white/10",
  iconTextClass = "text-white/90",
  width,
  bgClass = "bg-white/10 border border-white/15",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  iconBgClass?: string;
  iconTextClass?: string;
  width: number;
  bgClass?: string;
}) {
  return (
    <div
      className={[
        "shrink-0",
        "px-3 rounded-2xl",
        bgClass,
        "shadow-sm",
        "backdrop-blur-sm",
        "text-white",
        "flex items-center", // Center content vertically
      ].join(" ")}
      style={{ width: `${width}px`, height: "60px" }}
    >
      <div className="flex items-center gap-2 w-full">
        <span
          className={[
            "inline-flex items-center justify-center shrink-0 rounded-lg p-1",
            iconBgClass,
            iconTextClass,
          ].join(" ")}
        >
          {icon}
        </span>
        <div className="truncate flex-1 min-w-0">
          <div className="text-[11px] leading-none text-white/80 mb-1">{label}</div>
          <div className="text-base font-semibold leading-tight">{value}</div>
        </div>
      </div>
    </div>
  );
}

function formatMoney(n: number) {
  try {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(n);
  }
}
