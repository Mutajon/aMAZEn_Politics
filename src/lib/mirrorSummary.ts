// src/lib/mirrorSummary.ts
import { COMPONENTS, PROPERTIES, type PropKey } from "../data/compass-data";
import type { CompassValues } from "../store/compassStore";
import { useSettingsStore } from "../store/settingsStore";

type TopItem = { prop: PropKey; idx: number; label: string; score: number };

export async function generateMirrorSummary(
  values: CompassValues,
  opts: { useAI?: boolean; apiPath?: string; topN?: number } = {}
): Promise<string> {
  const { useAI = true, apiPath = "/api/mirror-summary", topN = 2 } = opts;
  const { useLightDilemmaAnthropic } = useSettingsStore.getState();

  const overall = topComponents(values, topN);
  const whatTop = topByProp(values, "what", topN);
  const whenceTop = topByProp(values, "whence", topN);

  if (useAI) {
    try {
      const resp = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topWhat: whatTop.map(minify),
          topWhence: whenceTop.map(minify),
          topOverall: overall.map(minify),
          useAnthropic: useLightDilemmaAnthropic,
        }),
      });
      if (resp.ok) {
        const j = await resp.json();
        const s = String(j?.summary || "").trim();
        if (s) return s;
      }
    } catch {
      // fall through to local
    }
  }

  // Local playful fallback: keep to 1–2 short sentences
  return localSummary({ whatTop, whenceTop, overall });
}

/* ---------------- helpers ---------------- */

function topComponents(values: CompassValues, n: number): TopItem[] {
  const items: TopItem[] = [];
  for (const p of PROPERTIES) {
    const arr = values[p.key] || [];
    arr.forEach((score, i) => {
      const label = COMPONENTS[p.key]?.[i]?.short ?? `${p.title} #${i + 1}`;
      items.push({ prop: p.key as PropKey, idx: i, label, score: Number(score) || 0 });
    });
  }
  return items.sort((a, b) => b.score - a.score).slice(0, n);
}

function topByProp(values: CompassValues, prop: PropKey, n: number): TopItem[] {
  const arr = values[prop] || [];
  const items: TopItem[] = arr.map((score, i) => ({
    prop,
    idx: i,
    label: COMPONENTS[prop]?.[i]?.short ?? `${prop} #${i + 1}`,
    score: Number(score) || 0,
  }));
  return items.sort((a, b) => b.score - a.score).slice(0, n);
}

function minify(t: TopItem) {
  return { name: t.label, strength: t.score };
}

function soften(label: string) {
  // Convert internal-ish labels to friendlier phrases
  return label
    .replace(/\bTruth\/Trust\b/i, "seeking honest answers")
    .replace(/\bPublic Reason\b/i, "fair-minded debate")
    .replace(/\bCare\/Compassion\b/i, "looking out for people")
    .replace(/\bSecurity\/Order\b/i, "keeping things steady")
    .replace(/\bFreedom\/Autonomy\b/i, "independence")
    .replace(/\bCreativity\/Play\b/i, "playful curiosity")
    .replace(/\bFlourish\/Joy\b/i, "human joy")
    .replace(/\bResponsibility\/Duty\b/i, "showing up when it counts");
}

function localSummary({ whatTop, whenceTop, overall }: { whatTop: TopItem[]; whenceTop: TopItem[]; overall: TopItem[] }) {
  const w = whatTop[0]?.label ? soften(whatTop[0].label) : null;
  const j = whenceTop[0]?.label ? soften(whenceTop[0].label) : null;

  if (!w && !j) return "The mirror blinks—too little to go on… for now.";
  if (w && !j)  return `Well now… it looks like you're driven by ${w}. The glint in your eye gives it away.`;
  if (!w && j)  return `Curious—you mainly justify things through ${j}. The mirror takes note.`;
  return `Well, well… you seem driven by ${w}, and you mostly justify it through ${j}. The mirror is amused.`;
}

/**
 * Generate personality summary using Mirror Quiz Light API
 * Uses Mushu/Genie personality (same as event screen mirror)
 * Takes top 2 "what" + top 2 "whence" values
 * Returns ONE sentence dramatic personality summary
 *
 * Used by: MirrorQuizScreen (end of quiz assessment)
 * API: /api/mirror-quiz-light
 */
export async function generateMirrorQuizSummary(
  values: CompassValues,
  opts: { useAI?: boolean } = {}
): Promise<string> {
  const { useAI = true } = opts;
  const { useLightDilemmaAnthropic } = useSettingsStore.getState();

  // Get top 2 for both dimensions
  const whatTop = topByProp(values, "what", 2);
  const whenceTop = topByProp(values, "whence", 2);

  // Validate we have at least 2 values in each dimension
  if (whatTop.length < 2 || whenceTop.length < 2) {
    return "The mirror blinks—your values are still forming...";
  }

  if (useAI) {
    try {
      const resp = await fetch("/api/mirror-quiz-light", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topWhat: whatTop.map(minify),
          topWhence: whenceTop.map(minify),
          useAnthropic: useLightDilemmaAnthropic,
        }),
      });

      if (resp.ok) {
        const j = await resp.json();
        const s = String(j?.summary || "").trim();
        if (s) return s;
      }
    } catch (error) {
      console.error("[Mirror Quiz Light] Failed:", error);
    }
  }

  // Fallback: Simple local summary with Mushu/Genie energy
  const w1 = whatTop[0]?.label || "mystery";
  const w2 = whatTop[1]?.label || "enigma";
  return `Well, well! ${w1} and ${w2} are dancing in your conscience—the mirror is intrigued!`;
}
