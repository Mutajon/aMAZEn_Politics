/**
 * ActionDeck.tsx
 *
 * Orchestrates action card selection, suggestion validation, and coin flight animations.
 * Handles confirm flow with card collapse animations and budget synchronization.
 *
 * Used by: EventScreen.tsx
 * Uses: ActionDeckContent, CoinFlightSystem, useActionDeckState, useActionSuggestion
 */

import { useMemo, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useSettingsStore } from "../../store/settingsStore";

import ActionDeckContent from "./ActionDeckContent";
import { CoinFlightOverlay, useCoinFlights, getCenterRect, getBudgetAnchorRect, syncCoinAndBudget, type Point } from "./CoinFlightSystem";
import { useActionDeckState, type ActionCard } from "../../hooks/useActionDeckState";
import { useActionSuggestion } from "../../hooks/useActionSuggestion";

export type { ActionCard };

type Props = {
  actions: ActionCard[];
  showBudget: boolean;
  budget: number;
  onConfirm: (id: string) => void;
  onSuggest?: (text?: string) => void;
  suggestCost?: number;
  triggerCoinFlight?: (from: Point, to: Point) => void; // Optional: use parent's trigger if provided
  dilemma: { title: string; description: string };
};

// Gated debug logger (Settings → Debug mode)
function debugLog(...args: any[]) {
  if (useSettingsStore.getState().debugMode) {
    // eslint-disable-next-line no-console
    console.log("[ActionDeck]", ...args);
  }
}

export default function ActionDeck({
  actions,
  showBudget,
  budget,
  onConfirm,
  onSuggest,
  suggestCost = -300,
  triggerCoinFlight: parentTriggerCoinFlight,
  dilemma,
}: Props) {
  // State management
  const state = useActionDeckState(actions);
  const {
    selected,
    setSelected,
    isSuggestOpen,
    suggestText,
    setSuggestText,
    validatingSuggest,
    setValidatingSuggest,
    suggestError,
    setSuggestError,
    confirmingId,
    othersDown,
    deckRef,
    deckHeight,
    lockHeight,
    cardRefs,
    suggestRef,
    othersCtrl,
    suggestCtrl,
    attachCardRef,
    openSuggestModal,
    closeSuggestModal,
    startConfirmationFlow,
    startSuggestConfirmationFlow,
    resetState,
  } = state;

  // Coin flight system - use parent's trigger if provided, otherwise use local
  const localCoinFlights = useCoinFlights();
  const triggerCoinFlight = parentTriggerCoinFlight || localCoinFlights.triggerCoinFlight;
  const { flights, clearFlights } = localCoinFlights;

  // Suggestion validation
  const suggestion = useActionSuggestion({
    dilemma,
    budget,
    showBudget,
    suggestCost,
    validatingSuggest,
    setValidatingSuggest,
    setSuggestError,
    onConfirmSuggestion: async () => {
      await startSuggestConfirmationFlow();

      // Skip coin animation if budget is disabled
      if (!showBudget) {
        debugLog("handleConfirmSuggestion: budget disabled, skipping coin animation");
        onSuggest?.(suggestText);
        return;
      }

      // Coins + budget counter should start at the same time for suggestions
      if (suggestCost < 0) {
        // from budget → to pill
        syncCoinAndBudget(
          () => getBudgetAnchorRect(),
          () => getCenterRect(suggestRef.current),
          () => onSuggest?.(suggestText),
          triggerCoinFlight,
          debugLog
        );
      } else {
        // from pill → to budget
        syncCoinAndBudget(
          () => getCenterRect(suggestRef.current),
          () => getBudgetAnchorRect(),
          () => onSuggest?.(suggestText),
          triggerCoinFlight,
          debugLog
        );
      }
    },
  });

  // Derive affordability + normalized costs
  const cards = useMemo(() => {
    return actions.map((a) => {
      const cost = a.cost ?? 0;
      // If budget is disabled, all actions are affordable
      // If budget is enabled, check if player can afford negative costs
      const affordable = !showBudget || cost >= 0 || budget >= Math.abs(cost);
      return { ...a, cost, affordable };
    });
  }, [actions, showBudget, budget]);

  const selectedCard = cards.find((c) => c.id === selected) || null;

  // Reset visuals when the actions (dilemma) change
  useEffect(() => {
    clearFlights();
  }, [actions, clearFlights]);

  // Handler functions
  const handleSelectCard = (id: string) => {
    setSelected(id);
  };

  const handleConfirmCard = async (id: string) => {
    await startConfirmationFlow(id);

    // Coins + budget counter should start at the same time
    const card = cards.find((c) => c.id === id);
    const targetEl = cardRefs.current[id];

    if (!card || !targetEl) {
      debugLog("handleConfirm: missing card/element for coin flight", { id, hasCard: !!card, hasEl: !!targetEl });
      onConfirm(id);
      return;
    }

    const cost = card.cost ?? 0;

    // Skip coin animation if budget is disabled or cost is zero
    if (!showBudget || cost === 0) {
      debugLog("handleConfirm: budget disabled or zero cost, skipping coin animation");
      onConfirm(id);
      return;
    }

    if (cost > 0) {
      // from card → to budget (positive cost = gain money)
      syncCoinAndBudget(
        () => getCenterRect(targetEl),
        () => getBudgetAnchorRect(),
        () => onConfirm(id),
        triggerCoinFlight,
        debugLog
      );
    } else {
      // from budget → to card (negative cost = spend money)
      syncCoinAndBudget(
        () => getBudgetAnchorRect(),
        () => getCenterRect(targetEl),
        () => onConfirm(id),
        triggerCoinFlight,
        debugLog
      );
    }
  };

  const handleCancelSelection = () => {
    setSelected(null);
  };

  const handleOpenSuggest = () => {
    if (!suggestion.canAffordSuggestion()) {
      debugLog("openSuggest: blocked (budget)", { budget, suggestCost });
      return;
    }
    debugLog("openSuggest: opened");
    openSuggestModal();
  };

  const handleConfirmSuggestion = async () => {
    await suggestion.validateAndConfirmSuggestion(suggestText);
  };

  return (
    <>
      {/* Coin overlay */}
      <AnimatePresence>
        {flights.length > 0 && (
          <CoinFlightOverlay
            flights={flights}
            onAllDone={clearFlights}
          />
        )}
      </AnimatePresence>

      {/* Main content */}
      <ActionDeckContent
        // Data
        cards={cards}
        selectedCard={selectedCard}
        showBudget={showBudget}
        budget={budget}
        suggestCost={suggestCost}

        // Modal state
        isSuggestOpen={isSuggestOpen}
        suggestText={suggestText}
        validatingSuggest={validatingSuggest}
        suggestError={suggestError}

        // Flow state
        confirmingId={confirmingId}
        othersDown={othersDown}

        // Layout
        deckRef={deckRef}
        deckHeight={deckHeight}
        lockHeight={lockHeight}
        attachCardRef={attachCardRef}
        suggestRef={suggestRef}

        // Animation controls
        othersCtrl={othersCtrl}
        suggestCtrl={suggestCtrl}

        // Handlers
        onSelectCard={handleSelectCard}
        onConfirmCard={handleConfirmCard}
        onCancelSelection={handleCancelSelection}
        onOpenSuggest={handleOpenSuggest}
        onCloseSuggest={closeSuggestModal}
        onSuggestTextChange={setSuggestText}
        onConfirmSuggestion={handleConfirmSuggestion}
      />
    </>
  );
}