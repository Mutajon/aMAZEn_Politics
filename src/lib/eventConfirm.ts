// src/lib/eventConfirm.ts
// Centralized confirm pipeline used by EventScreen.
// - Applies budget delta immediately (so coin+counter stay in sync).
// - Triggers compass analysis with start/stop callbacks for a spinner.
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

export type ConfirmContext = {
  showBudget: boolean;
  setBudget: Dispatch<SetStateAction<number>>;
  // analyzeText should call analyzeTextToCompass(text, applyWithPings) and return a Promise.
  analyzeText: (text: string) => Promise<unknown>;
  onAnalyzeStart?: () => void;
  onAnalyzeDone?: () => void;
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

  // --- 3) Compass analysis (async; spinner hooks optional) ---
  if (text) {
    try {
      ctx.onAnalyzeStart?.();
      await ctx.analyzeText(text);
    } finally {
      ctx.onAnalyzeDone?.();
    }
  }

  return { delta };
}
