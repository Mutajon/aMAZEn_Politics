// src/screens/EventScreen.tsx
// Event Screen: generates a daily dilemma, narrates it, and shows action cards
// with dynamic Lucide icons + dark gradients (topic-aware, non-repeating).

import { useEffect } from "react";
import { bgStyle } from "../lib/ui";
import { useDilemmaStore } from "../store/dilemmaStore";
import EventContent from "../components/event/EventContent";
import { useEventState } from "../hooks/useEventState";
import { useEventEffects } from "../hooks/useEventEffects";
import { useEventNarration } from "../hooks/useEventNarration";
import { useEventActions } from "../hooks/useEventActions";
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
  const { current, loadNext } = useDilemmaStore();

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
  const { canShowDilemma, overlayPreparing } = useEventNarration();

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
  });

  // Initialize middle support on mount
  useEffect(() => {
    initializeMiddleSupport();
  }, [initializeMiddleSupport]);

  // Handle fallback dilemma auto-reload
  useEffect(() => {
    const c = current as any;
    if (!c || !c._isFallback) return;
    const t = setTimeout(() => loadNext(), 800);
    return () => clearTimeout(t);
  }, [current, loadNext]);

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

          // Action handlers
          onConfirm={(id) => handleConfirm(id, current ? actionsToDeckCards(current.actions) : [])}
          onSuggest={handleSuggest}
        />
      </div>
    </div>
  );
}
