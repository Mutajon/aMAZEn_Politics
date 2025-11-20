/**
 * useActionSuggestion.ts
 *
 * Handles suggestion validation flow including AI validation and dilemma context management.
 * Manages the complete suggestion lifecycle from input to confirmation.
 *
 * Used by: ActionDeck.tsx
 * Uses: validation.ts for AI validation, dilemmaStore for context
 */

import { useCallback, useRef } from "react";
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
function getRoleContext(): {
  era: string;
  settingType: string;
  year: string;
  politicalSystem: string;
  roleName: string;
  roleScope: string;
} {
  const roleStore = useRoleStore.getState();
  const era = roleStore.analysis?.grounding?.era || "";
  const settingType = roleStore.analysis?.grounding?.settingType || "unclear";
  const year = roleStore.roleYear || "";
  const politicalSystem = roleStore.analysis?.systemName || "";
  const roleName = roleStore.selectedRole || "";
  const roleScope = roleStore.roleScope || roleStore.analysis?.roleScope || "";
  return { era, settingType, year, politicalSystem, roleName, roleScope };
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

  // Submission lock to prevent concurrent validation requests
  const submittingRef = useRef(false);

  const canAffordSuggestion = useCallback(() => {
    return !showBudget || budget >= Math.abs(suggestCost);
  }, [showBudget, budget, suggestCost]);

  const validateAndConfirmSuggestion = useCallback(async (text: string) => {
    const trimmedText = text.trim();
    debugLog("validateAndConfirmSuggestion: click", { textLength: trimmedText.length });

    // Check if already submitting (prevent double-click)
    if (submittingRef.current) {
      debugLog("validateAndConfirmSuggestion: BLOCKED - already submitting");
      return false;
    }

    if (!trimmedText) {
      debugLog("validateAndConfirmSuggestion: early return (empty text)");
      return false;
    }

    if (!canAffordSuggestion()) {
      debugLog("validateAndConfirmSuggestion: early return (budget lock)", { budget, suggestCost });
      return false;
    }

    // Set submission lock
    submittingRef.current = true;
    debugLog("validateAndConfirmSuggestion: LOCK ACQUIRED");

    try {
      setSuggestError(null);
      setValidatingSuggest(true);

      const ctx = getDilemmaContext(dilemma);
      const roleCtx = getRoleContext();

      // Enhanced debug logging - show full request payload
      debugLog("=== VALIDATION REQUEST ===");
      debugLog("Player text:", trimmedText);
      debugLog("Request payload:", {
        text: trimmedText,
        title: ctx.title,
        description: ctx.description,
        era: roleCtx.era,
        year: roleCtx.year,
        settingType: roleCtx.settingType,
        politicalSystem: roleCtx.politicalSystem,
        roleName: roleCtx.roleName,
        roleScope: roleCtx.roleScope
      });

      const result = await validateSuggestionStrict(trimmedText, ctx, roleCtx);

      // Enhanced debug logging - show full response
      debugLog("=== VALIDATION RESPONSE ===");
      debugLog("Valid:", result.valid);
      debugLog("Reason:", result.reason);
      debugLog("Full response:", result);

      if (!result.valid) {
        debugLog("validateAndConfirmSuggestion: validation REJECTED");
        setSuggestError(result.reason || "Please refine your suggestion so it clearly relates to the dilemma.");
        setValidatingSuggest(false);
        submittingRef.current = false; // Release lock on rejection
        debugLog("validateAndConfirmSuggestion: LOCK RELEASED (rejected)");
        return false;
      }

      // Success - trigger confirmation flow
      debugLog("validateAndConfirmSuggestion: validation ACCEPTED, calling onConfirmSuggestion");

      try {
        // CRITICAL: Await the confirmation callback to detect failures
        await onConfirmSuggestion();
        debugLog("validateAndConfirmSuggestion: onConfirmSuggestion completed successfully");
        setValidatingSuggest(false);
        // Keep lock until day advances (released by parent reset)
        return true;

      } catch (callbackErr: any) {
        // CRITICAL: If confirmation callback fails, show error to user
        debugLog("validateAndConfirmSuggestion: onConfirmSuggestion FAILED", callbackErr);
        const callbackMsg = callbackErr?.message || "Failed to process confirmation";
        setSuggestError(`Confirmation failed: ${callbackMsg}`);
        // Keep validatingSuggest true to prevent button re-enable
        setValidatingSuggest(true);
        // Don't release lock - force page refresh or error recovery
        return false;
      }

    } catch (err: any) {
      const msg = err instanceof AIConnectionError ? err.message : "Cannot reach validator";
      debugLog("validateAndConfirmSuggestion: validation error", msg, err);
      setSuggestError(msg);
      setValidatingSuggest(false);
      submittingRef.current = false; // Release lock on error
      debugLog("validateAndConfirmSuggestion: LOCK RELEASED (error)");
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

  // Reset submission lock (call when new dilemma starts)
  const resetSubmissionLock = useCallback(() => {
    submittingRef.current = false;
    debugLog("resetSubmissionLock: lock released");
  }, []);

  return {
    canAffordSuggestion,
    validateAndConfirmSuggestion,
    isDisabled,
    resetSubmissionLock,
  };
}
