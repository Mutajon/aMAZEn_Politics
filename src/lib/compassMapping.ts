// src/lib/compassMapping.ts
// Client helper: calls backend /api/compass-analyze, then applies effects
// via useCompassFX (updates store + shows pills).
//
// OPTIMIZED: Removed cues parameter (81% token reduction)
// - Server now has compact component definitions in system prompt
// - No need to send 2,725 chars with every request
// - Saves ~549 tokens per compass analysis

import { COMPONENTS, type PropKey } from "../data/compass-data";
import { VALUE_RULES } from "../store/compassStore";
import type { FXEffect } from "../hooks/useCompassFX";

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
  // Component definitions now in server system prompt - no need to send cues
  const resp = await fetch(apiPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }), // Removed: cues parameter (was 2,725 chars)
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

