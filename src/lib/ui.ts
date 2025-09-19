// src/lib/ui.ts
// src/lib/ui.ts
import type { CSSProperties } from "react";

/**
 * App-wide background.
 * - Layer 1: a very soft radial glow that adds depth (top-center),
 * - Layer 2: the main navy → purple diagonal gradient.
 *
 * All screens import and use `bgStyle` like:  <div style={bgStyle}>…</div>
 * so changing this file updates the whole app.
 */
export const bgStyle: CSSProperties = {
  // Solid fallback (in case gradients aren’t supported)
  backgroundColor: "#0b1335",

  // Two stacked backgrounds: subtle glow + main gradient
  backgroundImage: [
    // soft spotlight so the center isn’t flat; very low alpha
    "radial-gradient(1000px 600px at 50% -10%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%)",
    // sleek navy → purple
    "linear-gradient(140deg, #0b1335 0%, #191746 45%, #2a1f63 70%, #3a2a70 100%)",
  ].join(", "),

  backgroundRepeat: "no-repeat",
  backgroundSize: "cover",
  backgroundPosition: "center",
};
