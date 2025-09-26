// src/lib/compassMapping.ts
// Client helper: calls backend /api/compass-analyze, then applies effects
// via useCompassFX (updates store + shows pills).

import { COMPONENTS, COMPONENT_CUES, type PropKey } from "../data/compass-data";
import { VALUE_RULES } from "../store/compassStore";
import type { FXEffect } from "../hooks/useCompassFX";

/** Build a compact "cues" string for the backend LLM prompt. */
function buildCueList(): string {
  return Object.entries(COMPONENT_CUES)
    .map(([prop, items]) => items.map((c, idx) => `${prop}.${idx}: ${c.short} → ${c.example}`).join("\n"))
    .join("\n");
}

/**
 * Analyze text with the backend AI and apply the resulting effects.
 * @param text - Player or AI text to analyze
 * @param applyWithPings - from useCompassFX(); updates store + shows pills
 * @param apiPath - override if needed (defaults to /api/compass-analyze)
 */
export async function analyzeTextToCompassFn(

  text: string,
  applyWithPings: (effects: FXEffect[]) => FXEffect[],
  apiPath: string = "/api/compass-analyze"
): Promise<FXEffect[]> {
  const cues = buildCueList();

  const resp = await fetch(apiPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, cues }),
  }).catch(() => null);

  let items: any[] = [];
  if (resp && resp.ok) {
    const json = await resp.json().catch(() => ({}));
    if (Array.isArray(json?.items)) items = json.items;
  }

  // Convert backend items → FXEffect[]
  const effects: FXEffect[] = items
    .map((p: any) => {
      const prop: PropKey = p?.prop;
      const idx = Number(p?.idx);
      const polarity = String(p?.polarity || "").toLowerCase();
      const strength = String(p?.strength || "").toLowerCase();

      if (!["what", "whence", "how", "whither"].includes(prop)) return null;
      if (!Number.isFinite(idx) || idx < 0 || idx >= COMPONENTS[prop].length) return null;

      let delta = 0;
      if (polarity === "positive") {
        delta = strength === "strong" ? VALUE_RULES.strongPositive : VALUE_RULES.mildPositive;
      } else if (polarity === "negative") {
        delta = strength === "strong" ? VALUE_RULES.strongNegative : VALUE_RULES.mildNegative;
      }
      if (delta === 0) return null;

      return { prop, idx, delta };
    })
    .filter(Boolean) as FXEffect[];

  // Apply to store and show pills. Store already clamps to [0,10].
  return applyWithPings(effects);
}

export { analyzeTextToCompassFn as analyzeTextToCompass };
export default analyzeTextToCompassFn;

