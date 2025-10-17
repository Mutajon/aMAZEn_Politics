// src/components/event/EventContent.tsx
import React, { useMemo, useRef, useLayoutEffect, useState, useEffect } from "react";
import { useDilemmaStore } from "../../store/dilemmaStore";
import { useRoleStore } from "../../store/roleStore";
import { useSettingsStore } from "../../store/settingsStore";
import ResourceBar from "./ResourceBar";
import SupportList, { type SupportItem, DefaultSupportIcons } from "./SupportList";
import { NewsTicker } from "./NewsTicker";
import PlayerStatusStrip from "./PlayerStatusStrip";
import DilemmaCard, { demoDilemma } from "./DilemmaCard";
import MirrorCard from "./MirrorCard";
import ActionDeck, { type ActionCard } from "./ActionDeck";
import CompassPillsOverlay from "./CompassPillsOverlay";
import ProgressiveLoadingCard from "./ProgressiveLoadingCard";
import { actionsToDeckCards } from "./actionVisuals";
import type { TickerItem } from "./NewsTicker";
import type { SupportDeltas, SupportTrends, SupportNotes, Trio } from "../../hooks/useEventState";
import type { ParamItem } from "./PlayerStatusStrip";
import type { ProgressiveStage } from "../../hooks/useProgressiveLoading";

interface EventContentProps {
  // State from useEventState
  vals: Trio;
  supportDeltas: SupportDeltas;
  supportTrends: SupportTrends;
  supportNotes: SupportNotes;
  middleLabel: string;
  middleIcon: React.ReactNode;
  budget: number;

  // State from useEventEffects
  newsItems: TickerItem[];
  mirrorText: string;
  mirrorLoading: boolean;

  // State from useEventNarration
  canShowDilemma: boolean;
  overlayPreparing: boolean;

  // State from useEventActions
  compassLoading: boolean;

  // Compass FX from centralized hook
  compassPings: any[];

  // Dynamic parameters from useDynamicParameters hook
  dynamicParams: ParamItem[];
  dynamicParamsAnimatingIndex: number | null;

  // Progressive loading state from useProgressiveLoading
  progressiveLoading?: {
    currentStage: ProgressiveStage;
    isLoading: boolean;
    loadingCardPosition: number;
    shouldShowResourceBar: boolean;
    shouldShowSupportList: boolean;
    shouldShowNewsTicker: boolean;
    shouldShowPlayerStatus: boolean;
    shouldShowDilemma: boolean;
    shouldShowMirror: boolean;
    shouldShowActionDeck: boolean;
    shouldShowLoadingCard: boolean;
    // Legacy compatibility
    shouldShowSupport: boolean;
    shouldShowNews: boolean;
    shouldShowParameters: boolean;
    shouldShowActions: boolean;
  };

  // Action handlers
  onConfirm: (id: string) => void;
  onSuggest: (text?: string) => void;
}

export default function EventContent({
  vals,
  supportDeltas,
  supportTrends,
  supportNotes,
  middleLabel,
  middleIcon,
  budget,
  newsItems,
  mirrorText,
  mirrorLoading,
  canShowDilemma,
  overlayPreparing,
  compassLoading,
  compassPings,
  dynamicParams,
  dynamicParamsAnimatingIndex,
  progressiveLoading,
  onConfirm,
  onSuggest,
}: EventContentProps) {
  const { current, loading, totalDays, day } = useDilemmaStore();
  const debugMode = useSettingsStore((s) => s.debugMode);
  const showBudget = useSettingsStore((s) => s.showBudget);
  const avatarUrl = useRoleStore((s) => s.character?.avatarUrl ?? null);

  // Compass FX passed from parent (no longer creating local instance)

  const daysLeft = Math.max(0, totalDays - day + 1);

  // Read Mirror text color so spinner matches it exactly
  const mirrorWrapRef = useRef<HTMLDivElement | null>(null);
  const [mirrorTextColor, setMirrorTextColor] = useState<string>("#7de8ff");
  useLayoutEffect(() => {
    if (!mirrorWrapRef.current) return;
    const root = mirrorWrapRef.current.firstElementChild as HTMLElement | null;
    if (!root) return;
    const c = getComputedStyle(root).color;
    if (c) setMirrorTextColor(c);
  }, [mirrorText]);

  const items: SupportItem[] = [
    {
      id: "people",
      name: "The People",
      percent: vals.people,
      accentClass: "bg-emerald-600",
      icon: <DefaultSupportIcons.PeopleIcon className="w-4 h-4" />,
      moodVariant: "civic",
      delta: supportDeltas.people,
      trend: supportTrends.people,
      note: supportNotes.people,
    },
    {
      id: "middle",
      name: middleLabel,
      percent: vals.middle,
      accentClass: "bg-amber-600",
      icon: middleIcon,
      moodVariant: "civic",
      delta: supportDeltas.middle,
      trend: supportTrends.middle,
      note: supportNotes.middle,
    },
    {
      id: "mom",
      name: "Mom",
      percent: vals.mom,
      accentClass: "bg-rose-600",
      icon: <DefaultSupportIcons.HeartIcon className="w-4 h-4" />,
      moodVariant: "empathetic",
      delta: supportDeltas.mom,
      trend: supportTrends.mom,
      note: supportNotes.mom,
    },
  ];

  // Build the action deck from the current dilemma
  const actionsForDeck = useMemo<ActionCard[]>(
    () => (current ? actionsToDeckCards(current.actions) : []),
    [current]
  );

  return (
    <>
      {progressiveLoading?.shouldShowResourceBar && (
        <div
          className="
            sticky top-0 z-40
            -mx-5 px-5   /* stretch to page gutters, then restore padding */
            py-2
            bg-[#0b1335]/80 backdrop-blur-md
            border-b border-white/10
          "
          style={{ WebkitBackdropFilter: "blur(8px)" }} // improves Safari
        >
          <ResourceBar daysLeft={daysLeft} budget={budget} showBudget={showBudget} />
        </div>
      )}

      {/* Support values (3 entities), animated */}
      {progressiveLoading?.shouldShowSupportList && (
        <div className="mt-4">
          <div className="text-[11px] text-emerald-300 font-bold uppercase tracking-wide px-2 py-1 mb-2 bg-emerald-500/15 rounded-lg inline-block border border-emerald-400/40">
            Support Values:
          </div>
          <SupportList items={items} animatePercent={true} animateDurationMs={1000} />
        </div>
      )}

      {/* News ticker */}
      {progressiveLoading?.shouldShowNewsTicker && (
        <NewsTicker items={newsItems} />
      )}

      {/* Player status strip: dynamic params (left) + portrait (right) */}
      {progressiveLoading?.shouldShowPlayerStatus && (
        <PlayerStatusStrip
          avatarSrc={avatarUrl || undefined}
          params={dynamicParams}
          animatingIndex={dynamicParamsAnimatingIndex}
        />
      )}

      {/* Dilemma + Actions (gated until narration is ready AND dilemma exists) */}
      {progressiveLoading?.shouldShowDilemma && canShowDilemma && current && (
        <div className="mt-4">
          <DilemmaCard title={current.title} description={current.description} />
        </div>
      )}


      {progressiveLoading?.shouldShowMirror && (
        <div className="mt-3 relative" ref={mirrorWrapRef}>
          <div className={mirrorLoading ? "animate-pulse" : ""}>
            <MirrorCard text={mirrorText} />
          </div>
          {/* Spinner + stacked pills ABOVE the mirror card; no interaction */}
          <CompassPillsOverlay effectPills={compassPings} loading={compassLoading} color={mirrorTextColor} />
        </div>
      )}

      {canShowDilemma && current && progressiveLoading?.shouldShowActionDeck && (
        <ActionDeck
          actions={actionsForDeck}
          showBudget={showBudget}
          budget={budget}
          onConfirm={onConfirm}
          onSuggest={onSuggest}
          dilemma={{ title: current.title, description: current.description }}
        />
      )}

      {/* Progressive Loading Card - small floating card that moves down */}
      {progressiveLoading?.shouldShowLoadingCard && (
        <ProgressiveLoadingCard
          show={progressiveLoading.shouldShowLoadingCard}
          currentStage={progressiveLoading.currentStage}
          position={progressiveLoading.loadingCardPosition}
          currentDay={day}
          totalDays={totalDays}
        />
      )}

    </>
  );
}