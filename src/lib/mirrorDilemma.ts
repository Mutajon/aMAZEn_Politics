import { useSettingsStore } from "../store/settingsStore";
import { useCompassStore } from "../store/compassStore";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
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
  const { debugMode, useLightDilemmaAnthropic } = useSettingsStore.getState();
  const debug = debugMode;
  try {
    const comp = useCompassStore.getState().values;
    const {
      day,
      totalDays,
      dilemmaHistory,
      supportPeople,
      supportMiddle,
      supportMom
    } = useDilemmaStore.getState();

    // Get middle entity name from role store
    const { analysis } = useRoleStore.getState();
    const holders = Array.isArray(analysis?.holders) ? analysis.holders : [];
    const playerIndex = typeof analysis?.playerIndex === "number" ? analysis.playerIndex : null;

    // Find strongest non-player holder
    const withIdx = holders.map((h, i) => ({ ...h, i }));
    const candidates = playerIndex == null ? withIdx : withIdx.filter((h) => h.i !== playerIndex);
    const top = candidates.length > 0
      ? candidates.reduce((a, b) => ((b as any).percent > (a as any).percent ? b : a), candidates[0])
      : null;
    const middleName = String((top as any)?.name || "the establishment");

    const payload = {
      topWhat:    topKWithNames(comp?.what, "what", 2),
      topWhence:  topKWithNames(comp?.whence, "whence", 2),
      topOverall: topOverallWithNames(comp, 3), // Increased to 3 for richer context
      // Add dilemma context
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
      // NEW: Game context for holistic reflection
      dilemmaHistory,
      supportPeople,
      supportMiddle,
      supportMom,
      middleName,
      day,
      totalDays,
      useAnthropic: useLightDilemmaAnthropic,
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
