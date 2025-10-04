// MirrorCard.tsx
// Full-width card styled like MirrorBubble, with local tunables.
// Adds per-letter bobbing (magical vibe) and text insets so it won't overlap the mirror art.

import React, { useMemo } from "react";
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
const TEXT_INSET_RIGHT_PX = 0;

// Magical per-letter bobbing
const MAGIC_ENABLED        = true;
const MAGIC_AMPLITUDE_PX   = 2;        // 1–3px looks good
const MAGIC_DURATION_S     = 1.6;
const MAGIC_STAGGER_S      = 0.035;
const MAGIC_RANDOM_JITTER  = 0.25;

// Spacing around the card
const OUTER_MARGIN_Y  = "my-2";
/* ================================================================= */

export type MirrorCardProps = {
  text: string;      // 1–2 sentences
  italic?: boolean;
  className?: string;
};

export default function MirrorCard({ text, italic = true, className }: MirrorCardProps) {
  const segments = useMemo(() => splitGraphemes(text), [text]);
  const ampScale = useMemo(() => {
    if (!MAGIC_ENABLED) return [];
    const j = Math.max(0, Math.min(1, MAGIC_RANDOM_JITTER));
    return segments.map((_, i) => 1 + (j ? pseudoRandom(i) * j : 0));
  }, [segments]);

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
          style={{ paddingLeft: TEXT_INSET_LEFT_PX, paddingRight: TEXT_INSET_RIGHT_PX }}
        >
          {MAGIC_ENABLED ? (
            <MagicBobble
              segments={segments}
              ampScale={ampScale}
              amplitude={MAGIC_AMPLITUDE_PX}
              duration={MAGIC_DURATION_S}
              stagger={MAGIC_STAGGER_S}
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

/* -------------------- Magical per-letter text -------------------- */

function MagicBobble({
  segments,
  ampScale,
  amplitude,
  duration,
  stagger,
}: {
  segments: string[];
  ampScale: number[];
  amplitude: number;
  duration: number;
  stagger: number;
}) {
  return (
    <span>
      {segments.map((seg, i) => {
        if (seg === "\n") return <br key={`br-${i}`} />;
        const scale = ampScale[i] ?? 1;
        return (
          <motion.span
            key={`ch-${i}-${seg}`}
            className="inline-block will-change-transform"
            animate={{ y: [-amplitude * scale, amplitude * scale] }}
            transition={{
              type: "tween",
              ease: "easeInOut",
              duration,
              repeat: Infinity,
              repeatType: "mirror",
              delay: i * stagger,
            }}
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

function pseudoRandom(i: number) {
  let t = (i + 1) * 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* -------------------- Demo helper export (important) -------------------- */
export function demoMirrorLine(): string {
  return "The mirror regards you calmly: “Remember, power reflects—what you show them today is what they’ll see in you tomorrow.”";
}
