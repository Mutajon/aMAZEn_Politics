import type { ParameterItem } from "../components/event/DynamicParameters";

// Legacy type alias for backward compatibility
export type TickerItem = ParameterItem;

export type NewsTickerRequest = {
  day: number;
  role?: string | null;
  systemName?: string | null;
  epoch?: "modern" | "ancient" | "futuristic";
  last?: { title: string; summary: string; cost?: number } | null;
  language?: string;
};

export async function fetchNewsTickerItems(req: NewsTickerRequest): Promise<TickerItem[]> {
  const r = await fetch("/api/news-ticker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  }).catch(() => null);

  if (!r || !r.ok) return [];
  const json = await r.json().catch(() => ({}));
  const items = Array.isArray(json?.items) ? json.items : [];
  // Light guard/coerce
  return items
    .slice(0, 3)
    .map((x: any, i: number) => ({
      id: String(x?.id || `news-${i}`),
      kind: String(x?.kind) === "social" ? "social" : "news",
      tone: ((): "up" | "down" | "neutral" => {
        const t = String(x?.tone || "neutral");
        return t === "up" || t === "down" ? t : "neutral";
      })(),
      text: String(x?.text || "").slice(0, 120),
    })) as TickerItem[];
}
