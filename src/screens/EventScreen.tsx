// src/screens/EventScreen.tsx
// Event Screen: generates a daily dilemma, narrates it, and shows action cards
// with dynamic Lucide icons + dark gradients (topic-aware, non-repeating).

import { useEffect, useRef } from "react";
import { bgStyle } from "../lib/ui";
import { useDilemmaStore } from "../store/dilemmaStore";
import EventContent from "../components/event/EventContent";
import { useEventState } from "../hooks/useEventState";
import { useEventEffects } from "../hooks/useEventEffects";
import { useEventNarration } from "../hooks/useEventNarration";
import { useEventActions } from "../hooks/useEventActions";
import { useDynamicParameters } from "../hooks/useDynamicParameters";
import { useProgressiveLoading } from "../hooks/useProgressiveLoading";
import { actionsToDeckCards } from "../components/event/actionVisuals";
import useCompassFX from "../hooks/useCompassFX";

//
// Local types
//
type Props = { push?: (route: string) => void };


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EventScreen(_props: Props) {
  const { current, loadNext, day, applyChoice } = useDilemmaStore();

  // Track if first day loading has been initiated to prevent loops
  const firstDayLoadingInitiated = useRef(false);

  // Extract state management
  const eventState = useEventState();
  const {
    vals,
    setVals,
    supportDeltas,
    setSupportDeltas,
    supportTrends,
    setSupportTrends,
    supportNotes,
    setSupportNotes,
    middleLabel,
    middleIcon,
    budget,
    setBudget,
    initializeMiddleSupport,
  } = eventState;

  // Extract side effects
  const { newsItems, mirrorText, mirrorLoading, updateNewsAfterAction } = useEventEffects();

  // Extract narration logic
  const { canShowDilemma, overlayPreparing, startNarrationIfReady } = useEventNarration();

  // Extract dynamic parameters
  const {
    parameters: dynamicParams,
    animatingIndex: dynamicParamsAnimatingIndex,
    generateParameters,
    resetParameters
  } = useDynamicParameters();

  // Extract progressive loading state
  const progressiveLoading = useProgressiveLoading({
    onDilemmaRevealed: () => startNarrationIfReady(true)
  });

  // Centralized compass FX for pills
  const { pings, applyWithPings } = useCompassFX(60 * 60 * 1000);

  // Extract action handlers
  const { handleConfirm, handleSuggest, compassLoading } = useEventActions({
    vals,
    setVals,
    setSupportDeltas,
    setSupportTrends,
    setSupportNotes,
    budget,
    setBudget,
    updateNewsAfterAction,
    applyWithPings,
    startProgressiveLoading: progressiveLoading.startProgressiveLoading,
  });

  // Initialize middle support on mount
  useEffect(() => {
    initializeMiddleSupport();
  }, [initializeMiddleSupport]);

  // Trigger first day progressive loading when on day 1 (only once)
  useEffect(() => {
    console.log("[EventScreen] First day loading check:", {
      day,
      firstDayLoadingInitiated: firstDayLoadingInitiated.current,
      vals,
      hasProgressiveLoading: !!progressiveLoading
    });

    if (day === 1 && !firstDayLoadingInitiated.current) {
      console.log("[EventScreen] Starting first day progressive loading!");
      firstDayLoadingInitiated.current = true;
      // Start immediately - no conditions
      const supportValues = {
        people: vals.people,
        middle: vals.middle,
        mom: vals.mom,
      };
      progressiveLoading.startFirstDayLoading(supportValues);
    }
  }, [day, vals, progressiveLoading]);

  // Reset the ref when day changes (for navigation between days)
  useEffect(() => {
    if (day !== 1) {
      firstDayLoadingInitiated.current = false;
    }
  }, [day]);

  // Handle fallback dilemma auto-reload (but not during progressive loading)
  useEffect(() => {
    const c = current as any;
    if (!c || !c._isFallback) return;
    // Don't auto-reload if progressive loading is active
    if (progressiveLoading.isLoading) return;
    const t = setTimeout(() => loadNext(), 800);
    return () => clearTimeout(t);
  }, [current, loadNext, progressiveLoading.isLoading]);

  // Reset dynamic parameters when day changes
  useEffect(() => {
    resetParameters();
  }, [day, resetParameters]);

  // Create enhanced confirm handler that triggers parameter generation
  const handleConfirmWithParameters = async (id: string) => {
    // First apply the choice to the store
    applyChoice(id as "a" | "b" | "c");

    // Then call the original confirm handler
    await handleConfirm(id, current ? actionsToDeckCards(current.actions) : []);

    // Then generate parameters after a short delay to let the action complete
    setTimeout(() => {
      generateParameters();
    }, 1000);
  };

  return (
    <div className="min-h-[100dvh] px-5 py-5" style={bgStyle}>
      <div className="w-full max-w-xl mx-auto">
        <EventContent
          // State from useEventState
          vals={vals}
          supportDeltas={supportDeltas}
          supportTrends={supportTrends}
          supportNotes={supportNotes}
          middleLabel={middleLabel}
          middleIcon={middleIcon}
          budget={budget}

          // State from useEventEffects
          newsItems={newsItems}
          mirrorText={mirrorText}
          mirrorLoading={mirrorLoading}

          // State from useEventNarration
          canShowDilemma={canShowDilemma}
          overlayPreparing={overlayPreparing}

          // State from useEventActions
          compassLoading={compassLoading}

          // Compass FX from centralized hook
          compassPings={pings}

          // Dynamic parameters from useDynamicParameters hook
          dynamicParams={dynamicParams}
          dynamicParamsAnimatingIndex={dynamicParamsAnimatingIndex}

          // Progressive loading state
          progressiveLoading={progressiveLoading}

          // Action handlers
          onConfirm={handleConfirmWithParameters}
          onSuggest={handleSuggest}
        />
      </div>
    </div>
  );
}
