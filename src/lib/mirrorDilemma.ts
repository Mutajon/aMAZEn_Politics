import { useSettingsStore } from "../store/settingsStore";
import { useCompassStore } from "../store/compassStore";
import { COMPONENTS, type PropKey } from "../data/compass-data";
import type { Dilemma } from "./dilemma";

// Helper to get top K compass values with names and strengths (not indices)
function topKWithNames(arr: number[] | undefined, prop: PropKey, k = 2): Array<{ name: string; strength: number }> {
  const a = Array.isArray(arr) ? arr : [];
  return a
    .map((v, i) => ({
      v: Number(v) || 0,
      i,
      name: COMPONENTS[prop]?.[i]?.short || `${prop} #${i + 1}`,
    }))
    .filter(x => x.v > 0) // Only include non-zero values
    .sort((a, b) => b.v - a.v)
    .slice(0, k)
    .map(x => ({ name: x.name, strength: Math.round(x.v * 10) / 10 }));
}

// Helper for overall top values (across all dimensions)
function topOverallWithNames(comp: any, k = 2): Array<{ name: string; strength: number; dimension: PropKey }> {
  const allValues: Array<{ v: number; name: string; dimension: PropKey }> = [];

  (["what", "whence", "how", "whither"] as PropKey[]).forEach((prop) => {
    const arr = Array.isArray(comp?.[prop]) ? comp[prop] : [];
    arr.forEach((v: number, i: number) => {
      allValues.push({
        v: Number(v) || 0,
        name: COMPONENTS[prop]?.[i]?.short || `${prop} #${i + 1}`,
        dimension: prop,
      });
    });
  });

  return allValues
    .filter(x => x.v > 0) // Only non-zero values
    .sort((a, b) => b.v - a.v)
    .slice(0, k)
    .map(x => ({
      name: x.name,
      strength: Math.round(x.v * 10) / 10,
      dimension: x.dimension
    }));
}

export async function requestMirrorDilemmaLine(dilemma?: Dilemma | null): Promise<string> {
  const debug = useSettingsStore.getState().debugMode;
  try {
    const comp = useCompassStore.getState().values;
    const payload = {
      topWhat:    topKWithNames(comp?.what, "what", 2),
      topWhence:  topKWithNames(comp?.whence, "whence", 2),
      topOverall: topOverallWithNames(comp, 2),
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
