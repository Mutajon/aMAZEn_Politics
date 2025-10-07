// MirrorCard.tsx
// Full-width card styled like MirrorBubble, with local tunables.
// Adds typewriter reveal effect followed by traveling shimmer effect (magical vibe).
// Text insets ensure it won't overlap the mirror art.

import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { mirrorBubbleTheme as T } from "../../theme/mirrorBubbleTheme";

/* ====================== TUNABLES (EDIT HERE) ====================== */
// Card visuals
const CARD_BG         = T.bg;
const CARD_TEXT_COLOR = T.textColor;
const CARD_FONT_FF    = T.fontFamily;
const CARD_FONT_PX    = 13; // simple font size in px
const CARD_PAD_X      = T.paddingX;
const CARD_PAD_Y      = T.paddingY;
const CARD_SHADOW     = T.shadow;
const RADIUS_TL       = T.cornerTL;
const RADIUS_TR       = T.cornerTR;
const RADIUS_BL       = T.cornerBL;
const RADIUS_BR       = T.cornerBR;

// Mirror art (served from /public)
const MIRROR_IMG_SRC  = "/assets/images/mirror.png";
const IMG_WIDTH_PX    = 65;   // your latest values
const IMG_OPACITY     = 0.95;
const IMG_OFFSET_X    = -32;  // Position so left half is cut by component edge
const IMG_OFFSET_Y    = 0;    // Will be calculated dynamically for vertical center

// Keep text away from the image
const TEXT_INSET_LEFT_PX  = 20; // nudge if the image intrudes from the left
const TEXT_INSET_RIGHT_PX = 12; // prevent text cutoff on right edge

// Typewriter reveal effect (initial text reveal)
const TYPEWRITER_ENABLED    = true;
const TYPEWRITER_DURATION_S = 1.0;          // Total time to reveal all characters

// Magical shimmer effect (traveling glow - better readability than wobble)
const SHIMMER_ENABLED       = true;
const SHIMMER_DURATION_S    = 2.0;          // Time for shimmer to travel across text
const SHIMMER_PAUSE_S       = 3.0;          // Pause between shimmer cycles
const SHIMMER_GLOW_COLOR    = "rgba(255, 255, 255, 0.8)";  // Bright white glow
const SHIMMER_GLOW_SIZE     = "8px";        // Glow radius

// Spacing around the card
const OUTER_MARGIN_Y  = "my-2";
/* ================================================================= */

export type MirrorCardProps = {
  text: string;      // 1–2 sentences
  italic?: boolean;
  className?: string;
};

export default function MirrorCard({ text, italic = true, className }: MirrorCardProps) {
  // Always use character-level splitting for smooth shimmer effect
  const segments = useMemo(() => splitGraphemes(text), [text]);

  // Track typewriter reveal completion
  const [typewriterComplete, setTypewriterComplete] = useState(!TYPEWRITER_ENABLED);

  // Reset typewriter when text changes
  useEffect(() => {
    if (TYPEWRITER_ENABLED) {
      setTypewriterComplete(false);
      // Mark as complete after typewriter duration
      const timer = setTimeout(() => {
        setTypewriterComplete(true);
      }, TYPEWRITER_DURATION_S * 1000);
      return () => clearTimeout(timer);
    }
  }, [text]);

  // Calculate card height dynamically to position image in vertical center
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [imageOffsetY, setImageOffsetY] = React.useState(IMG_OFFSET_Y);

  React.useEffect(() => {
    if (cardRef.current) {
      const cardHeight = cardRef.current.offsetHeight;
      // Position image at vertical center (subtract half of image height when rendered)
      // Approximate image height ratio: if width is 65px, height is ~85px (based on typical mirror image aspect)
      const approxImageHeight = IMG_WIDTH_PX * 1.3; // Adjust multiplier based on actual image
      const centerOffset = (cardHeight - approxImageHeight) / 2;
      setImageOffsetY(centerOffset);
    }
  }, [text]); // Recalculate when text changes (affects card height)

  return (
    <motion.div
      className={["w-full flex justify-start", OUTER_MARGIN_Y, className || ""].join(" ")}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      aria-label="Mirror card"
    >
      {/* Full-width card body */}
      <div
        ref={cardRef}
        className="relative overflow-hidden w-full"
        style={{
          background: CARD_BG,
          color: CARD_TEXT_COLOR,
          fontFamily: CARD_FONT_FF,
          fontSize: `${CARD_FONT_PX}px`,
          padding: `${CARD_PAD_Y}px ${CARD_PAD_X}px`,
          boxShadow: CARD_SHADOW,
          borderTopLeftRadius: RADIUS_TL,
          borderTopRightRadius: RADIUS_TR,
          borderBottomLeftRadius: RADIUS_BL,
          borderBottomRightRadius: RADIUS_BR,
        }}
      >
        {/* Text FIRST (above image) with safe insets */}
        <div
          className={["relative z-10 whitespace-pre-wrap", italic ? "italic" : ""].join(" ")}
          style={{
            paddingLeft: TEXT_INSET_LEFT_PX,
            paddingRight: TEXT_INSET_RIGHT_PX,
            wordBreak: "break-word",
            overflowWrap: "break-word",
            hyphens: "auto",
          }}
        >
          {SHIMMER_ENABLED || TYPEWRITER_ENABLED ? (
            <MagicShimmer
              segments={segments}
              totalSegments={segments.length}
              typewriterComplete={typewriterComplete}
            />
          ) : (
            text
          )}
        </div>

        {/* Mirror image BEHIND the text, positioned at vertical center with left half cut */}
        <img
          src={MIRROR_IMG_SRC}
          alt="Mirror"
          className="pointer-events-none select-none absolute top-0 left-0 z-0"
          style={{
            width: IMG_WIDTH_PX,
            height: "auto",
            opacity: IMG_OPACITY,
            transform: `translate(${IMG_OFFSET_X}px, ${imageOffsetY}px)`,
          }}
          loading="lazy"
        />
      </div>
    </motion.div>
  );
}

/* -------------------- Magical shimmer text with typewriter reveal -------------------- */

function MagicShimmer({
  segments,
  totalSegments,
  typewriterComplete,
}: {
  segments: string[];
  totalSegments: number;
  typewriterComplete: boolean;
}) {
  const totalCycle = SHIMMER_DURATION_S + SHIMMER_PAUSE_S;

  return (
    <span>
      {segments.map((seg, i) => {
        if (seg === "\n") return <br key={`br-${i}`} />;

        // Typewriter: reveal character by character
        const typewriterDelay = TYPEWRITER_ENABLED
          ? (i / totalSegments) * TYPEWRITER_DURATION_S
          : 0;

        // Shimmer: travel from left to right (starts after typewriter completes)
        const shimmerDelay = SHIMMER_ENABLED
          ? (i / totalSegments) * SHIMMER_DURATION_S
          : 0;

        return (
          <motion.span
            key={`seg-${i}`}
            className="inline will-change-[text-shadow,opacity]"
            initial={TYPEWRITER_ENABLED ? { opacity: 0 } : { opacity: 1 }}
            animate={
              typewriterComplete && SHIMMER_ENABLED
                ? {
                    // Shimmer animation (after typewriter completes)
                    opacity: [1, 1.3, 1, 1],
                    textShadow: [
                      "0 0 0px transparent",
                      `0 0 ${SHIMMER_GLOW_SIZE} ${SHIMMER_GLOW_COLOR}`,
                      "0 0 0px transparent",
                      "0 0 0px transparent",
                    ],
                  }
                : {
                    // Typewriter animation (initial reveal)
                    opacity: 1,
                  }
            }
            transition={
              typewriterComplete && SHIMMER_ENABLED
                ? {
                    // Shimmer transition
                    duration: totalCycle,
                    repeat: Infinity,
                    delay: shimmerDelay,
                    ease: "easeInOut",
                    times: [0, 0.15, 0.3, 1],
                  }
                : {
                    // Typewriter transition
                    duration: 0.05,
                    delay: typewriterDelay,
                  }
            }
          >
            {seg === " " ? "\u00A0" : seg}
          </motion.span>
        );
      })}
    </span>
  );
}

/* -------------------- Utilities -------------------- */

function splitGraphemes(str: string): string[] {
  try {
    const seg = new (Intl as any).Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(seg.segment(str), (s: any) => s.segment as string);
  } catch {
    return Array.from(str);
  }
}

/* -------------------- Demo helper export (important) -------------------- */
export function demoMirrorLine(): string {
  return "The mirror regards you calmly: “Remember, power reflects—what you show them today is what they’ll see in you tomorrow.”";
}
