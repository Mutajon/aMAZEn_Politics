// src/hooks/useEventActions.ts
import { useState } from "react";
import { useSettingsStore } from "../store/settingsStore";
import { analyzeTextToCompass } from "../lib/compassMapping";
import { runConfirmPipeline } from "../lib/eventConfirm";
import { useEventSupportManager } from "../components/event/EventSupportManager";
import type { FXEffect } from "./useCompassFX";
import type { ActionCard } from "../components/event/ActionDeck";
import type { SupportDeltas, SupportTrends, SupportNotes, Trio } from "./useEventState";

interface UseEventActionsProps {
  vals: Trio;
  setVals: (vals: Trio | ((prev: Trio) => Trio)) => void;
  setSupportDeltas: (deltas: SupportDeltas) => void;
  setSupportTrends: (trends: SupportTrends) => void;
  setSupportNotes: (notes: SupportNotes | ((prev: SupportNotes) => SupportNotes)) => void;
  budget: number;
  setBudget: (budget: number | ((prev: number) => number)) => void;
  updateNewsAfterAction: (actionData: { title: string; summary: string; cost: number }) => void;
  applyWithPings: (effects: FXEffect[]) => FXEffect[];
}

export function useEventActions({
  vals,
  setVals,
  setSupportDeltas,
  setSupportTrends,
  setSupportNotes,
  budget,
  setBudget,
  updateNewsAfterAction,
  applyWithPings,
}: UseEventActionsProps) {
  const showBudget = useSettingsStore((s) => s.showBudget);

  // Show spinner while we wait for the /api/compass-analyze response
  const [compassLoading, setCompassLoading] = useState(false);

  // Support manager hook
  const { analyzeSupportWrapper, applySupportEffects } = useEventSupportManager({
    vals,
    setVals,
    setSupportDeltas,
    setSupportTrends,
    setSupportNotes,
  });

  // Adapter for the pipeline: call analyzer and resolve
  const analyzeText = (t: string) => analyzeTextToCompass(t, applyWithPings).then(() => undefined);

  const handleConfirm = async (id: string, actionsForDeck: ActionCard[]) => {
    const a = actionsForDeck.find((x) => x.id === id);
    if (!a) return;

    void runConfirmPipeline(
      {
        kind: "action",
        action: { title: a.title, summary: a.summary, cost: a.cost },
      },
      {
        showBudget,
        setBudget,
        analyzeText,
        onAnalyzeStart: () => setCompassLoading(true),
        onAnalyzeDone: () => setCompassLoading(false),
        analyzeSupport: analyzeSupportWrapper,
        applySupportEffects,
      }
    );

    // Update news after action
    updateNewsAfterAction({ title: a.title, summary: a.summary, cost: a.cost || 0 });
  };

  const handleSuggest = async (text?: string) => {
    void runConfirmPipeline(
      {
        kind: "suggest",
        text: text,
        cost: -300, // keep in sync with ActionDeck's suggestCost
      },
      {
        showBudget,
        setBudget,
        analyzeText,
        onAnalyzeStart: () => setCompassLoading(true),
        onAnalyzeDone: () => setCompassLoading(false),
        analyzeSupport: analyzeSupportWrapper,
        applySupportEffects,
      }
    );

    // Update news after suggestion
    updateNewsAfterAction({
      title: "Player suggestion",
      summary: String(text || "").slice(0, 140),
      cost: -300,
    });
  };

  return {
    handleConfirm,
    handleSuggest,
    compassLoading,
  };
}