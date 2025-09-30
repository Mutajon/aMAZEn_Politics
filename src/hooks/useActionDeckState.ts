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

  // Reset visuals when the actions (dilemma) change
  useEffect(() => {
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
  };

  const closeSuggestModal = () => {
    setSuggestOpen(false);
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
    closeSuggestModal();

    // Ensure we know sizes and lock height before animations
    if (!deckHeight && deckRef.current) {
      setDeckHeight(deckRef.current.getBoundingClientRect().height);
    }
    setLockHeight(true);

    // Disable interactions, animate THREE cards down (suggest stays)
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
  };
}