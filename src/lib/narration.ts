// src/lib/narration.ts
export function narrationTextForDilemma(d: { title?: string; description?: string }) {
    const t = (d?.title || "").trim();
    const p = (d?.description || "").trim();
    return t && p ? `${t}. ${p}` : t || p || "";
  }
  