// src/hooks/useEventActions.ts
// Enhanced action handlers for event screen with day progression integration.
// Connects action confirmation to contextual dilemma generation flow.

import { useState } from "react";
import { useSettingsStore } from "../store/settingsStore";
import { useDilemmaStore } from "../store/dilemmaStore";
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
  enableProgressiveLoading?: boolean; // when true, uses new progressive loading flow
  startProgressiveLoading?: (
    supportValues: { people: number; middle: number; mom: number },
    actionText?: string,
    analyzeText?: (text: string) => Promise<unknown>,
    analyzeSupport?: (text: string) => Promise<any[]>,
    applySupportEffects?: (effects: any[]) => void,
    updateNewsAfterAction?: (actionData: any) => void
  ) => Promise<void>;
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
  enableProgressiveLoading = true, // Enable new progressive loading flow by default
  startProgressiveLoading,
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

    const { current, day, addHistoryEntry } = useDilemmaStore.getState();

    console.log(`[useEventActions] handleConfirm called with enableProgressiveLoading: ${enableProgressiveLoading}`);

    if (enableProgressiveLoading && startProgressiveLoading) {
      console.log("[useEventActions] Using new progressive loading flow");

      // 1. Immediate budget update for responsive feedback (this happens during coin animation)
      if (showBudget && a.cost !== undefined) {
        setBudget(prev => prev + a.cost);
        console.log(`[useEventActions] Budget updated by ${a.cost}`);
      }

      // 2. Start progressive loading flow (this will handle news, support, etc. sequentially)
      // Note: News is not updated immediately - it will be updated as part of the progressive flow
      const supportValues = {
        people: vals.people,
        middle: vals.middle,
        mom: vals.mom,
      };

      console.log("[useEventActions] Starting progressive loading flow with support values:", supportValues);

      // 3. Trigger progressive loading with sequential analysis
      const actionText = `${a.title}. ${a.summary}`;
      await startProgressiveLoading(
        supportValues,
        actionText,
        analyzeText,
        analyzeSupportWrapper,
        applySupportEffects,
        updateNewsAfterAction
      );
      console.log("[useEventActions] Progressive loading flow completed");

      // 4. Collect history entry after support analysis completes
      // Note: vals will have been updated by applySupportEffects during progressive loading
      if (current) {
        addHistoryEntry({
          day,
          dilemmaTitle: current.title,
          dilemmaDescription: current.description,
          choiceId: a.id,
          choiceTitle: a.title,
          choiceSummary: a.summary,
          supportPeople: vals.people,  // Updated values after support analysis
          supportMiddle: vals.middle,
          supportMom: vals.mom,
        });
        console.log(`[useEventActions] History entry added for Day ${day}`);
      }

    } else {
      // Legacy flow: use existing confirmation pipeline
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
    }
  };

  const handleSuggest = async (text?: string) => {
    const suggestCost = -300; // keep in sync with ActionDeck's suggestCost
    const { current, day, addHistoryEntry } = useDilemmaStore.getState();

    if (enableProgressiveLoading && startProgressiveLoading) {
      // New enhanced flow: immediate UI feedback + progressive loading with sequential analysis

      // 1. Immediate budget update for responsive feedback
      if (showBudget) {
        setBudget(prev => prev + suggestCost);
      }

      // 2. Start progressive loading flow with current support values as context
      const supportValues = {
        people: vals.people,
        middle: vals.middle,
        mom: vals.mom,
      };

      // 3. Trigger progressive loading with sequential analysis
      const actionText = `Player suggestion. ${String(text || "").slice(0, 140)}`;
      await startProgressiveLoading(
        supportValues,
        actionText,
        analyzeText,
        analyzeSupportWrapper,
        applySupportEffects,
        updateNewsAfterAction
      );

      // 4. Collect history entry after support analysis completes
      if (current) {
        const suggestionSummary = String(text || "").slice(0, 140);
        addHistoryEntry({
          day,
          dilemmaTitle: current.title,
          dilemmaDescription: current.description,
          choiceId: "suggest",
          choiceTitle: "Player Suggestion",
          choiceSummary: suggestionSummary,
          supportPeople: vals.people,
          supportMiddle: vals.middle,
          supportMom: vals.mom,
        });
        console.log(`[useEventActions] History entry added for Day ${day} (player suggestion)`);
      }

    } else {
      // Legacy flow: use existing confirmation pipeline
      void runConfirmPipeline(
        {
          kind: "suggest",
          text: text,
          cost: suggestCost,
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
        cost: suggestCost,
      });
    }
  };

  return {
    handleConfirm,
    handleSuggest,
    compassLoading,
  };
}