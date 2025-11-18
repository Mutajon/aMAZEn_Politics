// MirrorCard.tsx
// Full-width card styled like MirrorBubble, with local tunables.
// Adds typewriter reveal effect followed by traveling shimmer effect (magical vibe).
// Text insets ensure it won't overlap the mirror art.

import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { mirrorBubbleTheme as T } from "../../theme/mirrorBubbleTheme";

/* ====================== TUNABLES (EDIT HERE) ====================== */
// Card visuals
const CARD_BG         = T.bg;
const CARD_TEXT_COLOR = T.textColor;
const CARD_FONT_FF    = T.fontFamily;
const CARD_FONT_PX    = 12; // Reduced for mobile (was 13, now 12)
const CARD_PAD_X      = T.paddingX;
const CARD_PAD_Y      = T.paddingY;
const CARD_SHADOW     = T.shadow;
const RADIUS_TL       = T.cornerTL;
const RADIUS_TR       = T.cornerTR;
const RADIUS_BL       = T.cornerBL;
const RADIUS_BR       = T.cornerBR;

// Mirror art (served from /public) - Responsive sizing for mobile
const MIRROR_IMG_SRC  = "/assets/images/mirror.png";
const IMG_WIDTH_PX    = 55;   // Smaller for mobile (was 80, reduced to 55)
const IMG_OPACITY     = 0.95;
const IMG_OFFSET_X    = -20;  // Less protrusion for mobile (was -40, now -20)
const IMG_OFFSET_Y    = -10;  // Less protrusion above (was -20, now -10)

// Card left padding to compensate for protruding mirror
const CARD_PAD_LEFT   = 40;   // Reduced space for smaller mirror (was 60, now 40)

// Keep text away from the image
const TEXT_INSET_LEFT_PX  = 0;  // No longer needed, card padding handles spacing
const TEXT_INSET_RIGHT_PX = 12;

// Typewriter reveal effect (initial text reveal)
const TYPEWRITER_ENABLED    = true;
const TYPEWRITER_DURATION_S = 1.0;          // Total time to reveal all characters

// Magical shimmer effect (traveling glow - better readability than wobble)
const SHIMMER_ENABLED       = true;
const SHIMMER_DURATION_S    = 2.0;          // Time for shimmer to travel across text
const SHIMMER_PAUSE_S       = 3.0;          // Pause between shimmer cycles
const SHIMMER_GLOW_COLOR    = "rgba(255, 255, 255, 0.8)";  // Bright white glow
const SHIMMER_GLOW_SIZE     = "8px";        // Glow radius

// Mirror image shimmer effect (cyan sweep)
const MIRROR_SHIMMER_ENABLED      = true;
const MIRROR_SHIMMER_MIN_INTERVAL = 5000;   // 5 seconds minimum
const MIRROR_SHIMMER_MAX_INTERVAL = 10000;  // 10 seconds maximum
const MIRROR_SHIMMER_DURATION     = 1500;   // 1.5 second sweep duration
const MIRROR_SHIMMER_COLOR        = "rgba(94, 234, 212, 0.6)";  // Cyan/teal, semi-transparent

// Spacing around the card
const OUTER_MARGIN_Y  = "my-2";
/* ================================================================= */

export type MirrorCardProps = {
  text: string;      // 1 sentence (Mirror Light API)
  italic?: boolean;
  className?: string;
  onExploreClick?: () => void; // NEW: Callback for explore button
};

export default function MirrorCard({ text, italic = true, className, onExploreClick }: MirrorCardProps) {
  // Use word-level splitting to prevent mid-word line breaks while maintaining shimmer effect
  const segments = useMemo(() => splitWords(text), [text]);

  // Track typewriter reveal completion
  const [typewriterComplete, setTypewriterComplete] = useState(!TYPEWRITER_ENABLED);

  // Track mirror shimmer trigger (toggles to trigger animation)
  const [mirrorShimmerTrigger, setMirrorShimmerTrigger] = useState(0);

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

  // Random interval shimmer effect for mirror image
  useEffect(() => {
    if (!MIRROR_SHIMMER_ENABLED) return;

    const scheduleNextShimmer = () => {
      // Random interval between min and max
      const randomInterval =
        MIRROR_SHIMMER_MIN_INTERVAL +
        Math.random() * (MIRROR_SHIMMER_MAX_INTERVAL - MIRROR_SHIMMER_MIN_INTERVAL);

      return setTimeout(() => {
        setMirrorShimmerTrigger(prev => prev + 1);
        scheduleNextShimmer();
      }, randomInterval);
    };

    const timerId = scheduleNextShimmer();
    return () => clearTimeout(timerId);
  }, []);

  // Removed dynamic vertical centering - using fixed offset to match speaker avatar pattern

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
        className="relative w-full"
        style={{
          background: CARD_BG,
          color: CARD_TEXT_COLOR,
          fontFamily: CARD_FONT_FF,
          fontSize: `${CARD_FONT_PX}px`,
          padding: `${CARD_PAD_Y}px ${CARD_PAD_X}px ${CARD_PAD_Y}px ${CARD_PAD_LEFT}px`,
          boxShadow: CARD_SHADOW,
          borderTopLeftRadius: RADIUS_TL,
          borderTopRightRadius: RADIUS_TR,
          borderBottomLeftRadius: RADIUS_BL,
          borderBottomRightRadius: RADIUS_BR,
          overflow: 'visible', // Allow mirror to protrude beyond card boundaries
        }}
      >
        {/* Text with safe insets */}
        <div
          className={["relative whitespace-pre-wrap", italic ? "italic" : ""].join(" ")}
          style={{
            paddingLeft: TEXT_INSET_LEFT_PX,
            paddingRight: TEXT_INSET_RIGHT_PX,
            wordBreak: "break-word",
            hyphens: "auto",
            zIndex: 5,  // Below mirror (10) but above background
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

        {/* Mirror image protruding from left side (matches speaker avatar pattern) */}
        <div
          className="absolute"
          style={{
            left: `${IMG_OFFSET_X}px`,  // Protrudes 40px to the left
            top: `${IMG_OFFSET_Y}px`,   // Protrudes 20px above
            zIndex: 10,                  // In front like speaker avatar
          }}
        >
          <motion.img
            key={mirrorShimmerTrigger} // Key change triggers animation restart
            src={MIRROR_IMG_SRC}
            alt="Mirror"
            className="pointer-events-none select-none"
            style={{
              width: IMG_WIDTH_PX,
              height: "auto",
              opacity: IMG_OPACITY,
            }}
            loading="lazy"
            animate={
              MIRROR_SHIMMER_ENABLED
                ? {
                    filter: [
                      "drop-shadow(0px 0px 0px transparent)",
                      `drop-shadow(-8px -8px 12px ${MIRROR_SHIMMER_COLOR})`,
                      `drop-shadow(0px 0px 16px ${MIRROR_SHIMMER_COLOR})`,
                      `drop-shadow(8px 8px 12px ${MIRROR_SHIMMER_COLOR})`,
                      "drop-shadow(0px 0px 0px transparent)",
                    ],
                  }
                : {}
            }
            transition={{
              duration: MIRROR_SHIMMER_DURATION / 1000,
              ease: "easeInOut",
              times: [0, 0.25, 0.5, 0.75, 1],
            }}
          />
        </div>

        {/* Explore button - top-right corner */}
        {onExploreClick && (
          <motion.button
            onClick={onExploreClick}
            className="
              absolute top-2 right-2 z-20
              w-8 h-8 rounded-full
              bg-white/20 hover:bg-white/30
              backdrop-blur-sm border border-white/40
              flex items-center justify-center
              transition-colors cursor-pointer
            "
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            title="Explore your compass values"
            aria-label="Explore compass values"
          >
            <HelpCircle className="w-5 h-5 text-white" />
          </motion.button>
        )}
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
        // Handle newlines
        if (seg === "\n") return <br key={`br-${i}`} />;

        // Handle whitespace (spaces, tabs) - render directly without animation
        if (/^\s+$/.test(seg)) return <span key={`space-${i}`}>{seg}</span>;

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
            {seg}
          </motion.span>
        );
      })}
    </span>
  );
}

/* -------------------- Utilities -------------------- */

/**
 * Split text by words and whitespace while preserving newlines
 * This prevents mid-word line breaks while maintaining shimmer animation
 * Returns array of words and whitespace segments
 */
function splitWords(str: string): string[] {
  // Split by spaces/tabs but keep the delimiters and preserve newlines
  // Regex: capture sequences of non-whitespace OR sequences of whitespace
  return str.split(/(\s+)/).filter(Boolean);
}

/* -------------------- Demo helper export (important) -------------------- */
export function demoMirrorLine(): string {
  return "The mirror regards you calmly: “Remember, power reflects—what you show them today is what they’ll see in you tomorrow.”";
}
