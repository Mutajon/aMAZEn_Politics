/**
 * useActionSuggestion.ts
 *
 * Handles suggestion validation flow including AI validation and dilemma context management.
 * Manages the complete suggestion lifecycle from input to confirmation.
 *
 * Used by: ActionDeck.tsx
 * Uses: validation.ts for AI validation, dilemmaStore for context
 */

import { useCallback } from "react";
import { validateSuggestionStrict, AIConnectionError } from "../lib/validation";
import { useSettingsStore } from "../store/settingsStore";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";

// Build a safe dilemma context for validation (props → store → empty)
function getDilemmaContext(d?: { title: string; description: string }): { title: string; description: string } {
  if (d && typeof d.title === "string" && typeof d.description === "string") {
    return d;
  }
  const curr: any = useDilemmaStore.getState().current;
  const title = typeof curr?.title === "string" ? curr.title : "";
  const description = typeof curr?.description === "string" ? curr.description : "";
  return { title, description };
}

// Build role context for historical validation
function getRoleContext(): { era: string; settingType: string; year: string } {
  const roleStore = useRoleStore.getState();
  const era = roleStore.analysis?.grounding?.era || "";
  const settingType = roleStore.analysis?.grounding?.settingType || "unclear";
  const year = roleStore.roleYear || "";
  return { era, settingType, year };
}

// Gated debug logger (Settings → Debug mode)
function debugLog(...args: any[]) {
  if (useSettingsStore.getState().debugMode) {
    // eslint-disable-next-line no-console
    console.log("[ActionSuggestion]", ...args);
  }
}

interface UseSuggestionParams {
  dilemma: { title: string; description: string };
  budget: number;
  showBudget: boolean;
  suggestCost: number;
  validatingSuggest: boolean;
  setValidatingSuggest: (validating: boolean) => void;
  setSuggestError: (error: string | null) => void;
  onConfirmSuggestion: () => void;
}

export function useActionSuggestion({
  dilemma,
  budget,
  showBudget,
  suggestCost,
  validatingSuggest,
  setValidatingSuggest,
  setSuggestError,
  onConfirmSuggestion,
}: UseSuggestionParams) {

  const canAffordSuggestion = useCallback(() => {
    return !showBudget || budget >= Math.abs(suggestCost);
  }, [showBudget, budget, suggestCost]);

  const validateAndConfirmSuggestion = useCallback(async (text: string) => {
    const trimmedText = text.trim();
    debugLog("validateAndConfirmSuggestion: click", { textLength: trimmedText.length });

    if (!trimmedText) {
      debugLog("validateAndConfirmSuggestion: early return (empty text)");
      return false;
    }

    if (!canAffordSuggestion()) {
      debugLog("validateAndConfirmSuggestion: early return (budget lock)", { budget, suggestCost });
      return false;
    }

    try {
      setSuggestError(null);
      setValidatingSuggest(true);

      const ctx = getDilemmaContext(dilemma);
      const roleCtx = getRoleContext();
      debugLog("validateSuggestionStrict -> request", {
        hasProp: Boolean(dilemma),
        titleLen: ctx.title.length,
        descriptionLen: ctx.description.length,
        roleEra: roleCtx.era,
        roleYear: roleCtx.year,
      });

      const result = await validateSuggestionStrict(trimmedText, ctx, roleCtx);
      debugLog("validateSuggestionStrict -> response", result);

      if (!result.valid) {
        debugLog("validateSuggestionStrict -> invalid", result.reason || "(no reason)");
        setSuggestError(result.reason || "Please refine your suggestion so it clearly relates to the dilemma.");
        setValidatingSuggest(false);
        return false;
      }

      // Success - trigger confirmation flow
      onConfirmSuggestion();
      setValidatingSuggest(false);
      return true;

    } catch (err: any) {
      const msg = err instanceof AIConnectionError ? err.message : "Cannot reach validator";
      debugLog("validateAndConfirmSuggestion: error", msg, err);
      setSuggestError(msg);
      setValidatingSuggest(false);
      return false;
    }
  }, [
    dilemma,
    budget,
    showBudget,
    suggestCost,
    setSuggestError,
    setValidatingSuggest,
    onConfirmSuggestion,
    canAffordSuggestion,
  ]);

  const isDisabled = useCallback((textLength: number) => {
    return validatingSuggest || !canAffordSuggestion() || textLength < 4;
  }, [validatingSuggest, canAffordSuggestion]);

  return {
    canAffordSuggestion,
    validateAndConfirmSuggestion,
    isDisabled,
  };
}