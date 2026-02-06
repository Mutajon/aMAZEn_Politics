// src/components/event/ResourceBar.tsx
// Restored visuals + animated budget counter + anchor for coin flights + goals display

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Hourglass, Coins, Trophy, User } from "lucide-react";
import GoalsCompact from "./GoalsCompact";
import PlayerCardModal from "./PlayerCardModal";
import { useSettingsStore } from "../../store/settingsStore";
import { useRoleStore } from "../../store/roleStore";
import { useLang } from "../../i18n/lang";
import { AudioButtonsInline } from "../AudioControls";
import { ObjectivePill } from "./ObjectivePill";

export type ResourceBarScoreDetails = {
  total: number;
  maxTotal: number;
  components: Array<{
    id: "people" | "middle" | "mom";
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
  scoreDetails: ResourceBarScoreDetails;
  avatarSrc?: string | null; // Player avatar image
  // Tutorial props
  tutorialMode?: boolean;
  onTutorialAvatarClick?: () => void;
  onTutorialValueClick?: (value: any) => void;
  onTutorialModalClose?: () => void;
  tutorialValueRef?: (element: HTMLElement | null) => void;
  avatarButtonRef?: (element: HTMLElement | null) => void;
  avatarPopCount?: number;
  bonusObjective?: string;
  objectiveStatus?: "incomplete" | "completed";
};

export default function ResourceBar({
  daysLeft,
  budget,
  showBudget = true,
  score,
  scoreGoal = null,
  scoreDetails,
  avatarSrc = null,
  tutorialMode = false,
  onTutorialAvatarClick,
  onTutorialValueClick,
  onTutorialModalClose,
  tutorialValueRef,
  avatarButtonRef,
  avatarPopCount = 0,
  bonusObjective,
  objectiveStatus = "incomplete",
}: Props) {
  // Check if modifiers (difficulty + goals) are enabled
  const enableModifiers = useSettingsStore((s) => s.enableModifiers);
  const isMobile = useSettingsStore((s) => s.isMobileDevice);
  const lang = useLang();

  // Player avatar modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const character = useRoleStore((s) => s.character);
  const playerName = character?.name || "Unknown Leader";

  // Handle modal open during tutorial
  const handleAvatarClick = () => {
    setIsModalOpen(true);
    if (tutorialMode && onTutorialAvatarClick) {
      onTutorialAvatarClick();
    }
  };

  // Handle modal close during tutorial
  const handleModalClose = () => {
    setIsModalOpen(false);
    if (tutorialMode && onTutorialModalClose) {
      onTutorialModalClose();
    }
  };

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

  return (
    <>
      <div className="w-full flex items-end justify-between gap-3">
        {/* Resources Section */}
        <div className="flex flex-col gap-1">
          <div className="text-[10px] text-white/50 uppercase tracking-wide px-1">
            {lang("RESOURCES")}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <ResourcePill
                icon={<Hourglass className="w-4 h-4" />}
                label={lang("DAYS_LEFT")}
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
                  label={lang("BUDGET")}
                  value={formatMoney(displayBudget)}
                  iconBgClass="bg-amber-500/25"
                  iconTextClass="text-amber-200"
                  width={140}
                />
              )}
              <ScorePill
                score={displayScore}
                goal={normalizedGoal}
                details={scoreDetails}
              />
            </div>
            {bonusObjective && (
              <div className="w-full">
                <ObjectivePill objective={bonusObjective} isCompleted={objectiveStatus === "completed"} />
              </div>
            )}
          </div>
        </div>

        {/* Mobile: Audio buttons inline between resources and avatar */}
        {isMobile && <AudioButtonsInline />}

        {/* Player Avatar Section */}
        <motion.button
          ref={avatarButtonRef as any}
          key={`avatar-pop-${avatarPopCount}`}
          animate={avatarPopCount > 0 ? {
            scale: [1, 1.25, 1],
            rotate: [0, -5, 5, 0],
            boxShadow: [
              "0 0 0px rgba(255,255,255,0)",
              "0 0 20px rgba(255,255,255,0.5)",
              "0 0 0px rgba(255,255,255,0)"
            ]
          } : {}}
          transition={{ duration: 0.4, ease: "easeOut" }}
          onClick={handleAvatarClick}
          className={`shrink-0 rounded-xl overflow-hidden ring-1 transition-all duration-200 ${tutorialMode
            ? 'ring-yellow-400 ring-2 bg-white/10 z-[9100] relative'
            : 'ring-white/15 bg-white/5 hover:ring-white/30 hover:bg-white/10'
            }`}
          style={{ width: 80, height: 80, minWidth: 80 }}
          aria-label={`View ${playerName}'s character information`}
          title={`View ${playerName}'s character card`}
        >
          {avatarSrc && !imgError ? (
            <img
              src={avatarSrc}
              alt={playerName}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-8 h-8 text-white/80" />
            </div>
          )}
        </motion.button>

        {/* Goals Section (only if modifiers enabled) */}
        {enableModifiers && <GoalsCompact />}
      </div>

      {/* Player Card Modal */}
      <PlayerCardModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        avatarSrc={avatarSrc}
        tutorialMode={tutorialMode}
        onTutorialValueClick={onTutorialValueClick}
        tutorialValueRef={tutorialValueRef}
      />
    </>
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
          <div className="text-[10px] md:text-[11px] leading-none text-white/80 mb-1">{label}</div>
          <div className="text-sm md:text-base font-semibold leading-tight">{value}</div>
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
  details,
}: {
  score: number;
  goal: number | null;
  details: ResourceBarScoreDetails;
}) {
  const lang = useLang();
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
      <div
        className="shrink-0 px-2 py-2 rounded-2xl bg-[rgba(76,29,149,0.25)] border border-violet-400/40 shadow-sm backdrop-blur-sm text-white flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:bg-[rgba(76,29,149,0.35)] transition-colors duration-200"
        style={{ width: '95px', height: '60px' }}
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
        tabIndex={0}
        aria-label="Score information"
      >
        {/* Top Line: Icon + Label */}
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center shrink-0 rounded-lg p-0.5 bg-violet-500/25 text-violet-200">
            <Trophy className="w-3.5 h-3.5" />
          </span>
          <span className="text-[9px] md:text-[10px] text-white/80 leading-none uppercase tracking-wider">
            {lang("SCORE_LABEL")}
          </span>
        </div>

        {/* Bottom Line: Score + Goal on same line */}
        <div className="flex items-baseline gap-0.5">
          <span
            className={[
              "tabular-nums font-semibold text-xs md:text-sm leading-none",
              scoreColorClass,
            ].join(" ")}
          >
            {formatPoints(score)}
          </span>
          {goal !== null && (
            <span className="tabular-nums text-[10px] md:text-xs text-white/60 leading-none">
              / {formatPoints(goal)}
            </span>
          )}
        </div>
      </div>

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
            {lang("SCORE_BREAKDOWN")}
          </div>
          <ul className="space-y-1 text-sm">
            {details.components.map((comp) => (
              <li
                key={comp.id}
                className="flex items-center justify-between gap-3 text-white/80"
              >
                <span className="truncate">{comp.label}</span>
                <span className="tabular-nums font-semibold text-white/90">
                  {formatPoints(comp.points)} {lang("PTS")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
