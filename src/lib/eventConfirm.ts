// src/lib/eventConfirm.ts
// Centralized confirm pipeline used by legacy EventScreen/EventScreen2.
// - Applies budget delta immediately (so coin+counter stay in sync).
// - Triggers compass analysis and support analysis IN PARALLEL.
// NOTE: EventScreen3 uses EventDataCollector → EventDataPresenter → EventDataCleaner pattern instead.

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

  // Compass analysis
  analyzeText?: (text: string) => Promise<unknown>;
  onAnalyzeStart?: () => void;
  onAnalyzeDone?: () => void;

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

  // --- 3) Fire analyses in PARALLEL (if available) ---
  const tasks: Promise<unknown>[] = [];

  if (text && ctx.analyzeText) {
    tasks.push(
      (async () => {
        try {
          ctx.onAnalyzeStart?.();
          await ctx.analyzeText!(text);
        } finally {
          ctx.onAnalyzeDone?.();
        }
      })()
    );
  }

  if (text && ctx.analyzeSupport && ctx.applySupportEffects) {
    tasks.push(
      (async () => {
        try {
          ctx.onSupportStart?.();
          const effects = await ctx.analyzeSupport!(text);
          ctx.applySupportEffects!(effects);
        } finally {
          ctx.onSupportDone?.();
        }
      })()
    );
  }

  if (tasks.length) {
    await Promise.allSettled(tasks); // do not block on either specifically
  }

  return { delta };
}
