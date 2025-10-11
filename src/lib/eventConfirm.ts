// src/lib/eventConfirm.ts
// Centralized confirm pipeline used by EventScreen.
// - Applies budget delta immediately (so coin+counter stay in sync).
// - Triggers support analysis (compass analysis moved to Phase 2 data collection).
// - Keeps UI concerns out of EventScreen. No design changes here.

import type { Dispatch, SetStateAction } from "react";

export type ConfirmInput =
  | {
      kind: "action";
      action: { title: string; summary: string; cost?: number };
    }
  | {
      kind: "suggest";
      text?: string;
      cost?: number; // pass -300 (or whatever you set in ActionDeck) from the caller
    };

export type SupportEffectId = "people" | "middle" | "mom";
export type SupportEffect = { id: SupportEffectId; delta: number; explain: string };

export type ConfirmContext = {
  showBudget: boolean;
  setBudget: Dispatch<SetStateAction<number>>;

  // Support analysis
  analyzeSupport?: (text: string) => Promise<SupportEffect[]>;
  applySupportEffects?: (effects: SupportEffect[]) => void;
  onSupportStart?: () => void;
  onSupportDone?: () => void;
};

export async function runConfirmPipeline(
  input: ConfirmInput,
  ctx: ConfirmContext
): Promise<{ delta: number }> {
  // --- 1) Compute delta + analysis text (if any) ---
  let delta = 0;
  let text = "";

  if (input.kind === "action") {
    const { title, summary, cost = 0 } = input.action;
    delta = cost;
    text = `${title}. ${summary}`.trim();
  } else {
    delta = input.cost ?? 0;
    text = String(input.text || "").trim();
  }

  // --- 2) Budget update happens immediately (sync) ---
  if (ctx.showBudget && delta !== 0) {
    ctx.setBudget((b) => b + delta);
  }

  // --- 3) Fire support analysis (if available) ---
  // NOTE: Compass analysis removed - now happens in Phase 2 data collection
  // This eliminates duplicate API calls and fixes double-application bug
  if (text && ctx.analyzeSupport && ctx.applySupportEffects) {
    try {
      ctx.onSupportStart?.();
      const effects = await ctx.analyzeSupport!(text);
      ctx.applySupportEffects!(effects);
    } catch (error) {
      console.error("[runConfirmPipeline] Support analysis failed:", error);
    } finally {
      ctx.onSupportDone?.();
    }
  }

  return { delta };
}
