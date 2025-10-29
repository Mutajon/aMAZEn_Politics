// src/theme/mirrorBubbleTheme.ts
// Single source of truth for the "mirror bubble" look & feel.
export const mirrorBubbleTheme = {
    bg: "rgba(42, 31, 99, 0.6)",            // bubble background (purple, slightly transparent)
    textColor: "#5eead4",                    // teal-ish text
    fontFamily: "Inter, ui-sans-serif, system-ui",
    fontSizePx: 20,                          // change size globally
    paddingX: 16,
    paddingY: 12,
    cornerTL: 6,                             // asymmetric corners (speech feel)
    cornerTR: 18,
    cornerBL: 18,
    cornerBR: 18,
    maxWidth: "85%",
    shadow: "0 8px 24px rgba(0,0,0,0.25)",
  };
  export type MirrorBubbleTheme = typeof mirrorBubbleTheme;
  