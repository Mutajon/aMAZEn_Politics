/**
 * useActionDeckState.ts
 *
 * Manages all state for the ActionDeck component including card selection,
 * suggestion modal, confirmation flow, and UI interaction states.
 *
 * Used by: ActionDeck.tsx
 * Uses: framer-motion animation controls, react hooks
 */

import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { useAnimationControls } from "framer-motion";
import { useTimingLogger } from "./useTimingLogger";
import { useLogger } from "./useLogger";
import { useDilemmaStore } from "../store/dilemmaStore";

export type ActionCard = {
  id: string;
  title: string;
  summary: string;
  icon: React.ReactNode;
  iconBgClass: string;
  iconTextClass: string;
  cardGradientClass: string;
  cost?: number;
};

async function waitNextFrame(times = 2) {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

export function useActionDeckState(actions: ActionCard[]) {
  // Logging hooks
  const timingLogger = useTimingLogger();
  const logger = useLogger();

  // Card selection state
  const [selected, setSelected] = useState<string | null>(null);

  // Suggestion modal state
  const [isSuggestOpen, setSuggestOpen] = useState(false);
  const [suggestText, setSuggestText] = useState<string>("");
  const [validatingSuggest, setValidatingSuggest] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // Confirmation flow state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [othersDown, setOthersDown] = useState(false);

  // Animation controls
  const othersCtrl = useAnimationControls();
  const suggestCtrl = useAnimationControls();

  // Height lock to avoid white scroll gap
  const deckRef = useRef<HTMLDivElement | null>(null);
  const [deckHeight, setDeckHeight] = useState<number | null>(null);
  const [lockHeight, setLockHeight] = useState(false);

  // DOM refs for measuring
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const suggestRef = useRef<HTMLButtonElement | null>(null);

  // Typing timing tracker for custom action suggestions
  const suggestTypingTimingIdRef = useRef<string | null>(null);

  // Track previous action IDs to detect actual content changes vs reference changes
  const prevActionsRef = useRef<string>("");

  // Measure deck height when actions change
  useLayoutEffect(() => {
    const measure = () => {
      if (deckRef.current) {
        setDeckHeight(deckRef.current.getBoundingClientRect().height);
      }
    };
    measure();
    requestAnimationFrame(measure);
    setLockHeight(false);
  }, [actions]);

  // Reset visuals when the actions (dilemma) actually change (not just reference)
  // This prevents the modal from closing during validation when parent re-renders
  // with a new array reference but same content
  useEffect(() => {
    // Compare by action IDs to detect actual content change vs reference change
    const actionIds = actions.map(a => a.id).join(",");
    if (actionIds === prevActionsRef.current) {
      // Same action IDs, skip reset - prevents closing modal during validation
      return;
    }
    prevActionsRef.current = actionIds;

    // Only reset when actions actually change (new dilemma)
    setSelected(null);
    setConfirmingId(null);
    setOthersDown(false);
    setSuggestOpen(false);
    setSuggestError(null);
    setValidatingSuggest(false);
  }, [actions]);

  const attachCardRef = (id: string) => (el: HTMLElement | null) => {
    cardRefs.current[id] = el;
  };

  const openSuggestModal = () => {
    setSuggestText("");
    setSuggestError(null);
    setSuggestOpen(true);

    // Start timing custom action typing
    suggestTypingTimingIdRef.current = timingLogger.start('custom_action_typing_duration');

    // Log modal opened
    logger.log('custom_action_modal_opened', {
      timestamp: new Date().toISOString()
    }, 'User opened custom action modal');
  };

  const closeSuggestModal = () => {
    setSuggestOpen(false);

    // Cancel timing if modal closed without submitting
    if (suggestTypingTimingIdRef.current) {
      timingLogger.cancel(suggestTypingTimingIdRef.current);
      suggestTypingTimingIdRef.current = null;

      logger.log('custom_action_modal_closed', {
        textLength: suggestText.length,
        submitted: false
      }, 'User closed custom action modal without submitting');
    }
  };

  const startConfirmationFlow = async (cardId: string) => {
    setConfirmingId(cardId);
    setSelected(null);

    // Ensure all target elements subscribe to animation controls & lock height
    if (!deckHeight && deckRef.current) {
      setDeckHeight(deckRef.current.getBoundingClientRect().height);
    }
    setLockHeight(true);
    setOthersDown(true);

    // Wait two frames so the collapse fully commits
    await waitNextFrame(2);

    // Animate the two non-chosen cards + suggest pill downward + fade
    const springDown = { type: "spring" as const, stiffness: 380, damping: 32 };
    void othersCtrl.start({ y: 320, opacity: 0, transition: springDown });
    void suggestCtrl.start({ y: 360, opacity: 0, transition: springDown });
  };

  const startSuggestConfirmationFlow = async () => {
    // DON'T close modal immediately - keep it open to show loading/errors
    // Modal will be closed by parent after successful day advance

    // Ensure we know sizes and lock height before animations
    if (!deckHeight && deckRef.current) {
      setDeckHeight(deckRef.current.getBoundingClientRect().height);
    }
    setLockHeight(true);

    // Disable interactions using atomic state update
    // This prevents race condition where confirmingId might not be set
    setConfirmingId("suggest");
    setOthersDown(true);

    await waitNextFrame(2);

    const springDown = { type: "spring" as const, stiffness: 380, damping: 32 };
    void othersCtrl.start({ y: 320, opacity: 0, transition: springDown });
  };

  const resetState = () => {
    setSelected(null);
    setConfirmingId(null);
    setOthersDown(false);
    setSuggestOpen(false);
    setSuggestError(null);
    setValidatingSuggest(false);
  };

  const closeModalAfterSuccess = () => {
    // Called by parent after successful day advance
    setSuggestOpen(false);
  };

  // Log suggestion submission with timing
  // Consolidated logging with all data (cost, budget, text, timing) to prevent duplicates
  const logSuggestionSubmitted = (cost?: number, budgetBefore?: number) => {
    if (suggestTypingTimingIdRef.current) {
      const duration = timingLogger.end(suggestTypingTimingIdRef.current, {
        textLength: suggestText.length
      });

      logger.log('custom_action_submitted', {
        text: suggestText,
        textLength: suggestText.length,
        cost,
        budgetBefore,
        typingDuration: duration
      }, `Custom action: ${suggestText.substring(0, 50)}... (${suggestText.length} chars, ${duration}ms, cost: ${cost})`);

      // Store custom action text for session summary
      const { addCustomActionText } = useDilemmaStore.getState();
      addCustomActionText(suggestText);

      suggestTypingTimingIdRef.current = null;
    }
  };

  return {
    // Selection state
    selected,
    setSelected,

    // Suggestion modal state
    isSuggestOpen,
    suggestText,
    setSuggestText,
    validatingSuggest,
    setValidatingSuggest,
    suggestError,
    setSuggestError,
    openSuggestModal,
    closeSuggestModal,
    closeModalAfterSuccess,

    // Confirmation flow state
    confirmingId,
    othersDown,

    // Animation controls
    othersCtrl,
    suggestCtrl,

    // Layout state
    deckRef,
    deckHeight,
    lockHeight,
    cardRefs,
    suggestRef,
    attachCardRef,

    // Flow methods
    startConfirmationFlow,
    startSuggestConfirmationFlow,
    resetState,
    logSuggestionSubmitted,
  };
}