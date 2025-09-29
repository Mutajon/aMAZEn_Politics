// src/lib/supportAnalysis.ts
// Client helper for POST /api/support-analyze and typed decode.

export type SupportEffectId = "people" | "middle" | "mom";
export type SupportEffect = { id: SupportEffectId; delta: number; explain: string };

export type SupportContextPayload = {
  systemName: string;
  holders: Array<{ name: string; percent: number }>;
  playerIndex: number | null;
  day: number;
};

export async function analyzeSupport(
  text: string,
  ctx: SupportContextPayload,
  apiPath: string = "/api/support-analyze"
): Promise<SupportEffect[]> {
  const body = { text, ctx };

  const r = await fetch(apiPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!r || !r.ok) return [];

  const json = (await r.json().catch(() => ({}))) as { items?: any[] };
  const items = Array.isArray(json?.items) ? json!.items : [];

  // Coerce to SupportEffect[]
  const out: SupportEffect[] = [];
  for (const it of items) {
    const id = String(it?.id || "").toLowerCase() as SupportEffectId;
    if (id !== "people" && id !== "middle" && id !== "mom") continue;

    const delta = Number(it?.delta ?? 0);
    const explain = String(it?.explain ?? "").slice(0, 140);

    if (Number.isFinite(delta)) out.push({ id, delta, explain });
  }
  return out;
}
