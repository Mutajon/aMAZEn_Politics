// src/lib/mirrorDilemma.ts
import { useSettingsStore } from "../store/settingsStore";

/**
 * Fetch a 1–2 sentence mirror line that reacts to the *current dilemma*.
 * For this first step we send empty arrays; in a later step we'll pass
 * top compass components and other context.
 */
export async function requestMirrorDilemmaLine(opts?: {
  topWhat?: string[];
  topWhence?: string[];
  topOverall?: string[];
}): Promise<string> {
  const debug = useSettingsStore.getState().debugMode;
  try {
    const body = {
      topWhat: opts?.topWhat ?? [],
      topWhence: opts?.topWhence ?? [],
      topOverall: opts?.topOverall ?? [],
    };
    if (debug) console.log("[mirror-dilemma] → POST /api/mirror-summary", body);

    const r = await fetch("/api/mirror-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const j = await r.json().catch(() => ({}));
    const text = (j?.summary || "").trim();
    if (debug) console.log("[mirror-dilemma] ←", text || j);
    return text || "The mirror is quiet—try again.";
  } catch (e: any) {
    if (debug) console.log("[mirror-dilemma] ERROR", e?.message || e);
    return "The mirror is foggy…";
  }
}
