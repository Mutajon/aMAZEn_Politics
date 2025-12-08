// MirrorCard.tsx
// Full-width card styled like MirrorBubble, with local tunables.
// Adds typewriter reveal effect followed by traveling shimmer effect (magical vibe).
// Text insets ensure it won't overlap the mirror art.

import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { mirrorBubbleTheme as T } from "../../theme/mirrorBubbleTheme";
import { MirrorImage, MirrorReflection } from "../MirrorWithReflection";
import { useSettingsStore } from "../../store/settingsStore";

/* ====================== TUNABLES (EDIT HERE) ====================== */
// Card visuals
const CARD_BG         = T.bg;
const CARD_TEXT_COLOR = T.textColor;
const CARD_FONT_FF    = T.fontFamily;
const CARD_FONT_PX    = 14; // Enlarged for readability (was 12)
const CARD_PAD_X      = T.paddingX;
const CARD_PAD_Y      = T.paddingY;
const CARD_SHADOW     = T.shadow;
const RADIUS_TL       = T.cornerTL;
const RADIUS_TR       = T.cornerTR;
const RADIUS_BL       = T.cornerBL;
const RADIUS_BR       = T.cornerBR;

// Mirror art (served from /public) - Responsive sizing for mobile
const IMG_WIDTH_PX    = 110;  // Doubled from 55 for better visibility
const IMG_OPACITY     = 0.95;
const IMG_OFFSET_X    = -40;  // Increased protrusion for larger mirror

// Card left padding to compensate for protruding mirror
const CARD_PAD_LEFT   = 80;   // Increased for larger mirror (was 40)

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

// Spacing around the card
const OUTER_MARGIN_Y  = "my-2";
/* ================================================================= */

export type MirrorCardProps = {
  text: string;      // 1 sentence (Mirror Light API)
  italic?: boolean;
  className?: string;
  onExploreClick?: () => void; // NEW: Callback for explore button
  avatarUrl?: string; // Avatar URL for reflection overlay in mirror
};

export default function MirrorCard({ text, italic = true, className, onExploreClick, avatarUrl }: MirrorCardProps) {
  // Mobile detection for responsive mirror positioning
  const isMobile = useSettingsStore((s) => s.isMobileDevice);

  // Responsive mirror offset (reduce protrusion on mobile to prevent horizontal scroll)
  const mirrorOffsetX = isMobile ? 0 : IMG_OFFSET_X; // 0 on mobile (no protrusion), -40 on desktop
  const cardPadLeft = isMobile ? 50 : CARD_PAD_LEFT;   // Adjust padding accordingly

  // Use word-level splitting to prevent mid-word line breaks while maintaining shimmer effect
  const segments = useMemo(() => splitWords(text), [text]);

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
          padding: `${CARD_PAD_Y}px ${CARD_PAD_X}px ${CARD_PAD_Y}px ${cardPadLeft}px`,
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

        {/* Mirror image protruding from left side, vertically centered */}
        <div
          className="absolute"
          style={{
            left: isMobile ? '10px' : `calc(${mirrorOffsetX}px - 30px)`,  // No protrusion on mobile, protrudes on desktop
            top: "50%",                  // Center vertically
            transform: "translateY(-50%)", // Adjust for center alignment
            zIndex: 10,                  // In front like speaker avatar
            width: IMG_WIDTH_PX,
            height: IMG_WIDTH_PX,
          }}
        >
          {/* Mirror image (shimmer disabled) */}
          <div
            className="pointer-events-none select-none"
            style={{
              width: IMG_WIDTH_PX,
              height: IMG_WIDTH_PX,
              opacity: IMG_OPACITY,
            }}
          >
            <MirrorImage mirrorSize={IMG_WIDTH_PX} mirrorAlt="Mirror" />
          </div>

          {/* Reflection overlay */}
          <MirrorReflection
            mirrorSize={IMG_WIDTH_PX}
            avatarUrl={avatarUrl}
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
