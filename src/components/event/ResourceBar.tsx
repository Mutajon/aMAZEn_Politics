// src/components/event/ResourceBar.tsx
// Restored visuals + animated budget counter + anchor for coin flights + goals display

import React, { useState } from "react";
import { Hourglass, Coins, Trophy } from "lucide-react";
import GoalsCompact from "./GoalsCompact";
import { useSettingsStore } from "../../store/settingsStore";
import { useLang } from "../../i18n/lang";
import type { RoleGoalStatus } from "../../data/predefinedRoles";

export type ResourceBarScoreDetails = {
  total: number;
  maxTotal: number;
  components: Array<{
    id: "people" | "middle" | "mom" | "corruption";
    label: string;
    valueLabel: string;
    points: number;
    maxPoints: number;
  }>;
};

type Props = {
  daysLeft: number;
  budget: number;
  showBudget?: boolean; // defaults to true
  score: number;
  scoreGoal?: number | null;
  goalStatus?: RoleGoalStatus;
  scoreDetails: ResourceBarScoreDetails;
};

export default function ResourceBar({
  daysLeft,
  budget,
  showBudget = true,
  score,
  scoreGoal = null,
  goalStatus = "uncompleted",
  scoreDetails,
}: Props) {
  // Check if modifiers (difficulty + goals) are enabled
  const enableModifiers = useSettingsStore((s) => s.enableModifiers);
  const lang = useLang();

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

  // --- Animated counter for score (runs after store setScore) ---
  const [displayScore, setDisplayScore] = React.useState(score);
  const scorePrevRef = React.useRef(score);
  const scoreRafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const start = performance.now();
    const from = scorePrevRef.current;
    const to = score;
    const DURATION = 1200;

    if (scoreRafRef.current) cancelAnimationFrame(scoreRafRef.current);

    const tick = (t: number) => {
      const p = Math.max(0, Math.min(1, (t - start) / DURATION));
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayScore(Math.round(from + (to - from) * eased));
      if (p < 1) {
        scoreRafRef.current = requestAnimationFrame(tick);
      } else {
        scorePrevRef.current = score;
        scoreRafRef.current = null;
      }
    };

    scoreRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (scoreRafRef.current) cancelAnimationFrame(scoreRafRef.current);
      scoreRafRef.current = null;
    };
  }, [score]);

  const normalizedGoal = typeof scoreGoal === "number" && Number.isFinite(scoreGoal) ? scoreGoal : null;
  const statusValueText = lang(goalStatus === "completed" ? "ROLE_GOAL_COMPLETED" : "ROLE_GOAL_UNCOMPLETED");
  const statusLabelText = lang("ROLE_GOAL_STATUS_LABEL");
  const goalLabelText = lang("ROLE_GOAL_TARGET_LABEL");

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
          <ScorePill
            score={displayScore}
            goal={normalizedGoal}
            statusState={goalStatus}
            statusLabel={statusLabelText}
            statusValue={statusValueText}
            goalLabel={goalLabelText}
            details={scoreDetails}
          />
        </div>
      </div>

      {/* Goals Section (only if modifiers enabled) */}
      {enableModifiers && <GoalsCompact />}
    </div>
  );
}

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function formatPoints(n: number) {
  try {
    return numberFormatter.format(n);
  } catch {
    return String(n);
  }
}

function ResourcePill({
  icon,
  label,
  value,
  iconBgClass = "bg-white/10",
  iconTextClass = "text-white/90",
  width,
  bgClass = "bg-white/10 border border-white/15",
  onMouseEnter,
  onMouseLeave,
  onClick,
  onKeyDown,
  role,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  iconBgClass?: string;
  iconTextClass?: string;
  width: number;
  bgClass?: string;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  role?: React.AriaRole;
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
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={role}
      tabIndex={role === "button" ? 0 : undefined}
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

function ScorePill({
  score,
  goal,
  statusState,
  statusLabel,
  statusValue,
  goalLabel,
  details,
}: {
  score: number;
  goal: number | null;
  statusState: RoleGoalStatus;
  statusLabel: string;
  statusValue: string;
  goalLabel: string;
  details: ResourceBarScoreDetails;
}) {
  const [tooltipPinned, setTooltipPinned] = useState(false);
  const [tooltipHovered, setTooltipHovered] = useState(false);

  const showTooltip = tooltipPinned || tooltipHovered;

  const goalMet = goal !== null && score >= goal;
  const scoreColorClass = goal === null
    ? "text-white/90"
    : goalMet
      ? "text-emerald-300"
      : "text-rose-300";
  return (
    <div
      className="relative z-10"
      onMouseEnter={() => setTooltipHovered(true)}
      onMouseLeave={() => setTooltipHovered(false)}
    >
      <ResourcePill
        icon={<Trophy className="w-4 h-4" />}
        label="Score"
        value={
          <div className="flex items-baseline justify-end gap-1">
            <span
              className={[
                "tabular-nums font-semibold text-xl leading-none", // bigger number
                scoreColorClass,
              ].join(" ")}
            >
              {formatPoints(score)}
            </span>
            {goal !== null && (
              <span className="tabular-nums text-sm text-white/60 leading-none">
                / {formatPoints(goal)}
              </span>
            )}
          </div>
        }
        iconBgClass="bg-violet-500/25"
        iconTextClass="text-violet-200"
        width={180}
        bgClass="bg-[rgba(76,29,149,0.25)] border border-violet-400/40"
        onClick={(event) => {
          event.stopPropagation();
          setTooltipPinned((prev) => !prev);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setTooltipPinned((prev) => !prev);
          }
        }}
        role="button"
      />

      {showTooltip && (
        <div
          className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-white/15 bg-slate-900/95 p-3 text-white shadow-xl backdrop-blur-sm z-20"
          onMouseEnter={(event) => {
            event.stopPropagation();
            setTooltipHovered(true);
          }}
          onMouseLeave={(event) => {
            event.stopPropagation();
            setTooltipHovered(false);
          }}
        >
          {tooltipPinned && (
            <button
              type="button"
              className="absolute right-2 top-2 text-white/60 hover:text-white text-xs"
              onClick={(event) => {
                event.stopPropagation();
                setTooltipPinned(false);
              }}
              aria-label="Close score details"
            >
              ×
            </button>
          )}
          <div className="text-xs uppercase tracking-wide text-white/50 mb-2">
            Score Breakdown
          </div>
          <ul className="space-y-1 text-sm">
            {details.components.map((comp) => (
              <li
                key={comp.id}
                className="flex items-center justify-between gap-3 text-white/80"
              >
                <span className="truncate">{comp.label}</span>
                <span className="tabular-nums font-semibold text-white/90">
                  {formatPoints(comp.points)} pts
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
