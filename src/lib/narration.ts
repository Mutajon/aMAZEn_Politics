// src/lib/narration.ts
export function narrationTextForDilemma(d: { title?: string; description?: string }) {
    return (d?.description || "").trim();
  }
  