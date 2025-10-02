import { useSettingsStore } from "../store/settingsStore";
import { useCompassStore } from "../store/compassStore";
import type { Dilemma } from "./dilemma";

function topK(arr: number[] | undefined, k = 3): string[] {
  const a = Array.isArray(arr) ? arr : [];
  return a
    .map((v, i) => ({ v: Number(v) || 0, i }))
    .sort((a, b) => b.v - a.v)
    .slice(0, k)
    .map(x => String(x.i));
}

export async function requestMirrorDilemmaLine(dilemma?: Dilemma | null): Promise<string> {
  const debug = useSettingsStore.getState().debugMode;
  try {
    const comp = useCompassStore.getState().values;
    const payload = {
      topWhat:    topK(comp?.what, 3),
      topWhence:  topK(comp?.whence, 3),
      topOverall: topK(
        ["what","whence","how","whither"]
          .flatMap((k) => (Array.isArray((comp as any)?.[k]) ? (comp as any)[k] : []))
          .slice(0, 10),
        3
      ),
      // Add dilemma context for recommendations
      dilemma: dilemma ? {
        title: dilemma.title,
        description: dilemma.description,
        actions: dilemma.actions.map(action => ({
          id: action.id,
          title: action.title,
          summary: action.summary,
          cost: action.cost
        }))
      } : null,
    };

    if (debug) console.log("[mirror-dilemma] → POST /api/mirror-summary", payload);

    const r = await fetch("/api/mirror-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => ({}));
    const text = (j?.summary || "").trim();
    if (debug) console.log("[mirror-dilemma] ←", text || j);
    return text || "The mirror squints—say more, and it will too.";
  } catch (e: any) {
    if (debug) console.log("[mirror-dilemma] ERROR", e?.message || e);
    return "The mirror is foggy…";
  }
}
