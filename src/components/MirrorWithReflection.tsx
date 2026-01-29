// src/components/MirrorWithReflection.tsx
// Displays the mirror image with an optional avatar reflection overlay
// The reflection is circular, center-cropped (face area), with animated color transition
//
// IMPORTANT: The reflection is rendered as a sibling to the mirror image (using Fragment)
// so that parent shimmer filters (drop-shadow) don't interfere with the invert animation.
// The parent container MUST have position: relative for the reflection to position correctly.

// Animation tunables
const HOLD_DURATION = 3; // seconds to hold at each end (normal and inverted)
const TRANSITION_DURATION = 7.5; // seconds to transition between states
const TOTAL_DURATION = (HOLD_DURATION + TRANSITION_DURATION) * 2; // 21 seconds total

// Calculate keyframe percentages based on durations
const holdPercent = (HOLD_DURATION / TOTAL_DURATION) * 100; // ~14.3%

const keyframes = `
  @keyframes mirrorInvertPingPong {
    0% { filter: invert(0); }
    ${holdPercent}% { filter: invert(0); }
    50% { filter: invert(1); }
    ${50 + holdPercent}% { filter: invert(1); }
    100% { filter: invert(0); }
  }
`;

// Inject keyframes once globally
let keyframesInjected = false;
function injectKeyframes() {
  if (keyframesInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = keyframes;
  document.head.appendChild(style);
  keyframesInjected = true;
}

export type MirrorWithReflectionProps = {
  /** Width/height of the mirror in pixels */
  mirrorSize: number;
  /** Avatar image URL (base64 data URL or regular URL) */
  avatarUrl?: string;
  /** Size of the circular reflection overlay (default: 60% of mirror size) */
  reflectionSize?: number;
  /** Opacity of the reflection (default: 0.45) */
  reflectionOpacity?: number;
  /** Additional CSS classes for the container */
  className?: string;
  /** Alt text for mirror image */
  mirrorAlt?: string;
};

/**
 * Mirror image only (for use inside shimmer wrapper)
 */
export function MirrorImage({
  mirrorSize,
  className = "",
  mirrorAlt = "Mystic mirror",
  src = "/assets/images/mirrorBroken.png",
}: Pick<MirrorWithReflectionProps, "mirrorSize" | "className" | "mirrorAlt"> & { src?: string }) {
  return (
    <img
      src={src}
      alt={mirrorAlt}
      width={mirrorSize}
      height={mirrorSize}
      className={`w-full h-full object-cover rounded-full ${className}`}
    />
  );
}

/**
 * Reflection overlay only (render as sibling to shimmer wrapper)
 */
export function MirrorReflection({
  mirrorSize,
  avatarUrl,
  reflectionSize,
  reflectionOpacity = 0.45,
}: Pick<MirrorWithReflectionProps, "mirrorSize" | "avatarUrl" | "reflectionSize" | "reflectionOpacity">) {
  injectKeyframes();

  if (!avatarUrl) return null;

  const actualReflectionSize = reflectionSize ?? Math.round(mirrorSize * 0.6);

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        width: actualReflectionSize,
        height: actualReflectionSize,
        borderRadius: "50%",
        opacity: reflectionOpacity,
        overflow: "hidden",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 5,
      }}
    >
      <img
        src={avatarUrl}
        alt="Reflection"
        className="w-full h-full object-cover"
        style={{
          objectPosition: "center 25%",
          animation: `mirrorInvertPingPong ${TOTAL_DURATION}s ease-in-out infinite`,
        }}
      />
    </div>
  );
}

/**
 * Combined component for simple cases (no shimmer interference)
 * For screens WITH shimmer, use MirrorImage + MirrorReflection separately
 */
export default function MirrorWithReflection({
  mirrorSize,
  avatarUrl,
  reflectionSize,
  reflectionOpacity = 0.45,
  className = "",
  mirrorAlt = "Mystic mirror",
}: MirrorWithReflectionProps) {
  injectKeyframes();

  const actualReflectionSize = reflectionSize ?? Math.round(mirrorSize * 0.6);

  return (
    <div
      className={`relative ${className}`}
      style={{ width: mirrorSize, height: mirrorSize }}
    >
      <MirrorImage mirrorSize={mirrorSize} mirrorAlt={mirrorAlt} />
      <MirrorReflection
        mirrorSize={mirrorSize}
        avatarUrl={avatarUrl}
        reflectionSize={actualReflectionSize}
        reflectionOpacity={reflectionOpacity}
      />
    </div>
  );
}
