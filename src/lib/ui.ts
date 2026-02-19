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
  // Solid fallback (in case gradients aren't supported)
  backgroundColor: "#0b1335",

  // Two stacked backgrounds: subtle glow + main gradient
  backgroundImage: [
    // soft spotlight so the center isn't flat; very low alpha
    "radial-gradient(1000px 600px at 50% -10%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%)",
    // sleek navy → purple
    "linear-gradient(140deg, #0b1335 0%, #191746 45%, #2a1f63 70%, #3a2a70 100%)",
  ].join(", "),

  backgroundRepeat: "no-repeat",
  backgroundSize: "cover",
  backgroundPosition: "center",
};

/**
 * Background for intro/role selection screens with maze image.
 * - Layer 1: Maze image with question marks
 * - Layer 2: Light dark overlay for text readability (lighter than before)
 * - Layer 3: Subtle glow for depth
 */
export const bgStyleWithMaze: CSSProperties = {
  // Solid fallback
  backgroundColor: "#0b1335",

  // Three stacked backgrounds: subtle glow + light overlay + image
  backgroundImage: [
    // subtle glow for depth
    "radial-gradient(1000px 600px at 50% -10%, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 60%)",
    // light dark overlay for text readability (20-30% opacity, lighter than before)
    "linear-gradient(to bottom, rgba(11, 19, 53, 0.2), rgba(11, 19, 53, 0.3))",
    // maze image
    "url(/assets/images/BKGs/startIntroBKG.jpg)",
  ].join(", "),

  backgroundRepeat: "no-repeat, no-repeat, no-repeat",
  backgroundSize: "cover, cover, cover",
  backgroundPosition: "center, center, center",
};

/**
 * Background for role selection screen with custom role selection image.
 * - Layer 1: Role selection background image
 * - Layer 2: Light dark overlay for text readability (lighter than before)
 * - Layer 3: Subtle glow for depth
 */
export const bgStyleRoleSelection: CSSProperties = {
  // Solid fallback
  backgroundColor: "#0b1335",

  // Three stacked backgrounds: subtle glow + light overlay + image
  backgroundImage: [
    // subtle glow for depth
    "radial-gradient(1000px 600px at 50% -10%, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 60%)",
    // light dark overlay for text readability (20-30% opacity, lighter than before)
    "linear-gradient(to bottom, rgba(11, 19, 53, 0.2), rgba(11, 19, 53, 0.3))",
    // role selection image
    "url(/assets/images/BKGs/roleSelectionBKG.png)",
  ].join(", "),

  backgroundRepeat: "no-repeat, no-repeat, no-repeat",
  backgroundSize: "cover, cover, cover",
  backgroundPosition: "center, center, center",
};

/**
 * Background for splash screen with main maze image.
 * - Layer 1: Main maze background image
 * - Layer 2: Light dark overlay for text readability (lighter than before)
 * - Layer 3: Subtle glow for depth
 */
export const bgStyleSplash: CSSProperties = {
  // Solid fallback
  backgroundColor: "#0b1335",

  // Three stacked backgrounds: subtle glow + light overlay + main image
  backgroundImage: [
    // subtle glow for depth
    "radial-gradient(1000px 600px at 50% -10%, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 60%)",
    // light dark overlay for text readability (30-40% opacity, lighter than before)
    "linear-gradient(to bottom, rgba(11, 19, 53, 0.3), rgba(11, 19, 53, 0.4))",
    // main maze image
    "url(/assets/images/BKGs/mainBKG.webp)",
  ].join(", "),

  backgroundRepeat: "no-repeat, no-repeat, no-repeat",
  backgroundSize: "cover, cover, cover",
  backgroundPosition: "center, center, center",
};

/**
 * Background for role-based screens using the selected role's image.
 * Used after role selection to create a themed experience throughout the game.
 *
 * @param imagePath - Path to the role's full image (e.g., "/assets/images/BKGs/Roles/greeceFull.jpg")
 *                    If null/undefined, falls back to splash screen maze image
 * @returns CSSProperties object with the role image as background
 */
export function bgStyleWithRoleImage(imagePath?: string | null): CSSProperties {
  // Fallback to splash screen image if no role image provided
  const roleImage = imagePath || "/assets/images/BKGs/mainBKG.webp";

  return {
    // Solid fallback
    backgroundColor: "#0b1335",

    // Three stacked backgrounds: subtle glow + light overlay + role image
    backgroundImage: [
      // subtle glow for depth
      "radial-gradient(1000px 600px at 50% -10%, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 60%)",
      // light dark overlay for text readability (40-50% opacity, lighter than before)
      "linear-gradient(to bottom, rgba(11, 19, 53, 0.4), rgba(11, 19, 53, 0.5))",
      // role image
      `url(${roleImage})`,
    ].join(", "),

    backgroundRepeat: "no-repeat, no-repeat, no-repeat",
    backgroundSize: "cover, cover, cover",
    backgroundPosition: "center, center, center",
  };
}
