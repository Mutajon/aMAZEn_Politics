// src/components/aftermath/ReflectionSection.tsx
// Reflection section styled like MirrorCard
//
// Shows:
// - Compass value pills (top value per dimension)
// - Values summary with typewriter effect
// - Mirror image overlay (left side)
// - "Explore Values" button
//
// Connects to:
// - src/screens/AftermathScreen.tsx: main screen
// - src/hooks/useAftermathSequence.ts: controls visibility
// - src/theme/mirrorBubbleTheme.ts: mirror styling
// - src/components/event/MirrorCard.tsx: design inspiration

import { motion } from "framer-motion";
import React, { useMemo, useEffect, useState } from "react";
import { mirrorBubbleTheme as T } from "../../theme/mirrorBubbleTheme";
import { PALETTE, type PropKey } from "../../data/compass-data";
import { useLang } from "../../i18n/lang";

type TopValue = {
  short: string;
};

type Props = {
  top3ByDimension: Record<PropKey, TopValue[]>;
  valuesSummary: string;
};

// Mirror styling constants from MirrorCard
const MIRROR_IMG_SRC = "/assets/images/mirrorBroken.png";
const IMG_WIDTH_PX = 65;
const IMG_OPACITY = 0.95;
const IMG_OFFSET_X = -32;
const TEXT_INSET_LEFT_PX = 20;
const TEXT_INSET_RIGHT_PX = 12;
const TYPEWRITER_DURATION_S = 2.0;

const FADE_DURATION_S = 0.5;

export default function ReflectionSection({ top3ByDimension, valuesSummary }: Props) {
  const lang = useLang();
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: FADE_DURATION_S }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            background: T.bg,
            color: T.textColor,
            fontFamily: T.fontFamily,
            padding: `${T.paddingY}px ${T.paddingX}px`,
            boxShadow: T.shadow,
            borderTopLeftRadius: T.cornerTL,
            borderTopRightRadius: T.cornerTR,
            borderBottomLeftRadius: T.cornerBL,
            borderBottomRightRadius: T.cornerBR,
          }}
        >
          {/* Content (above mirror image) */}
          <div
            className="relative z-10"
            style={{
              paddingLeft: TEXT_INSET_LEFT_PX,
              paddingRight: TEXT_INSET_RIGHT_PX,
            }}
          >
            <h2 className="text-xl font-bold text-amber-400 mb-4">
              {lang("AFTERMATH_REFLECTION_TITLE")}
            </h2>

            {/* Compass Value Pills - Show top value per dimension */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(["what", "whence", "how", "whither"] as PropKey[]).map(dimension => {
                const dimensionName = {
                  what: lang("COMPASS_WHAT"),
                  whence: lang("COMPASS_WHENCE"),
                  how: lang("COMPASS_HOW"),
                  whither: lang("COMPASS_WHITHER")
                }[dimension];

                const dimensionSubtitle = {
                  what: lang("COMPASS_WHAT_SUBTITLE"),
                  whence: lang("COMPASS_WHENCE_SUBTITLE"),
                  how: lang("COMPASS_HOW_SUBTITLE"),
                  whither: lang("COMPASS_WHITHER_SUBTITLE")
                }[dimension];

                // Get top value for this dimension
                const topValue = top3ByDimension[dimension]?.[0];

                return (
                  <div
                    key={dimension}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: `${PALETTE[dimension].base}20`,
                      borderColor: PALETTE[dimension].base,
                      borderWidth: "1px"
                    }}
                  >
                    <div
                      className="font-bold uppercase text-xs mb-0.5"
                      style={{ color: PALETTE[dimension].base }}
                    >
                      {dimensionName}
                    </div>
                    <div className="text-white/50 text-xs mb-1">
                      {dimensionSubtitle}
                    </div>
                    <div className="text-white/90 font-medium">
                      {topValue?.short || "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Values Summary with typewriter */}
            <p className="text-base leading-relaxed italic">
              <TypewriterText text={valuesSummary} />
            </p>
          </div>

          {/* Mirror image BEHIND the text */}
          <MirrorImage />
        </div>
      </motion.div>
    );
}

/** Mirror image overlay component */
function MirrorImage() {
  const [imageOffsetY, setImageOffsetY] = useState(0);
  const containerRef = React.useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const parent = containerRef.current.parentElement;
      if (parent) {
        const containerHeight = parent.offsetHeight;
        const approxImageHeight = IMG_WIDTH_PX * 1.3;
        const centerOffset = (containerHeight - approxImageHeight) / 2;
        setImageOffsetY(centerOffset);
      }
    }
  }, []);

  return (
    <img
      ref={containerRef}
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
  );
}

/** Typewriter effect component */
function TypewriterText({ text }: { text: string }) {
  const words = useMemo(() => text.split(/(\s+)/).filter(Boolean), [text]);

  return (
    <span>
      {words.map((word, i) => {
        // Handle whitespace - render directly
        if (/^\s+$/.test(word)) return <span key={`space-${i}`}>{word}</span>;

        // Typewriter: reveal word by word
        const delay = (i / words.length) * TYPEWRITER_DURATION_S;

        return (
          <motion.span
            key={`word-${i}`}
            className="inline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.05, delay }}
          >
            {word}
          </motion.span>
        );
      })}
    </span>
  );
}
