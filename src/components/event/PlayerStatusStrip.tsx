// PlayerStatusStrip.tsx
// Dynamic params (left) + player portrait (right), with robust image loading and animations.

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, TrendingUp, Leaf, User } from "lucide-react";

// 🔧 Easy knobs
const AVATAR_SIZE = 100;
const TEXT_CLASS = "text-[13px] leading-snug";
const CHIP_BG = "bg-white/6 ring-1 ring-white/10 rounded-lg";
const CHIP_PAD = "px-2 py-1";
const ICON_SIZE = "w-4.5 h-4.5";
const GAP_X = "gap-2";
const GAP_Y = "gap-1.5";

export type ParamItem = {
  id: string;
  icon: React.ReactNode;
  text: string;
  tone?: "up" | "down" | "neutral";
};

type Props = {
  avatarSrc?: string | null;
  params: ParamItem[];
  debugAvatar?: boolean; // set true to print the resolved URL on screen
  animatingIndex?: number | null; // which parameter is currently animating in
};

export default function PlayerStatusStrip({ avatarSrc, params, debugAvatar = false }: Props) {
  const [imgError, setImgError] = useState(false);

  // Normalize common forms:
  // - http(s)://... or data:... -> as-is
  // - starts with "/" -> as-is (assumes /public)
  // - bare "avatars/me.png" -> prefix "/" so it serves from /public/avatars/me.png
  const resolvedSrc = useMemo(() => {
    const src = (avatarSrc || "").trim();
    if (!src) return "";
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) return src;
    if (src.startsWith("/")) return src;
    return `/${src}`;
  }, [avatarSrc]);

  // Uncomment to also log to console:
  // console.log("avatarUrl (raw):", avatarSrc, "→ resolved:", resolvedSrc, "error?", imgError);

  return (
    <div className="mt-4 w-full">
      <div className="flex items-center justify-between">
        {/* LEFT: dynamic params with staggered animations */}
        <div className={`flex-1 flex flex-wrap ${GAP_X} ${GAP_Y} pr-3`}>
          <AnimatePresence>
            {params.map((p, index) => (
              <ParamChip
                key={p.id}
                item={p}
                index={index}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* RIGHT: portrait pinned to the right edge with stable positioning */}
        <div
          className="shrink-0 rounded-xl overflow-hidden ring-1 ring-white/15 bg-white/5"
          style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, minWidth: AVATAR_SIZE }}
          aria-label="Player portrait"
          title={resolvedSrc || undefined}
        >
          {resolvedSrc && !imgError ? (
            <img
              src={resolvedSrc}
              alt="Player"
              className="w-full h-full object-cover"
              width={AVATAR_SIZE}
              height={AVATAR_SIZE}
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            // Fallback avatar (if empty URL or load error)
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-6 h-6 text-white/80" strokeWidth={2.2} />
            </div>
          )}
        </div>
      </div>

      {debugAvatar && (
        <div className="mt-1 text-[10px] text-white/60">
          avatarSrc(raw): {String(avatarSrc)} &rarr; resolved: {resolvedSrc || "(empty)"} {imgError ? " [load error]" : ""}
        </div>
      )}
    </div>
  );
}

function ParamChip({
  item,
  index
}: {
  item: ParamItem;
  index: number;
  isAnimating?: boolean;
}) {
  const toneClass =
    item.tone === "up"
      ? "text-emerald-300"
      : item.tone === "down"
      ? "text-rose-300"
      : "text-sky-300";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: 1,
        scale: [0.8, 1.15, 1.0], // Pop effect: start small, overshoot, settle
        transition: {
          duration: 0.6,
          times: [0, 0.6, 1], // Control keyframe timing
          ease: [0.34, 1.56, 0.64, 1], // easeOutBack for bounce
          delay: index * 0.15 // Increased stagger delay
        }
      }}
      exit={{
        opacity: 0,
        scale: 0.8,
        transition: { duration: 0.3 }
      }}
      className={`${CHIP_BG} ${CHIP_PAD} inline-flex items-center gap-1.5 backdrop-blur-sm`}
    >
      <span className={toneClass}>{item.icon}</span>
      <span className={`${TEXT_CLASS} text-white/90 whitespace-nowrap`}>{item.text}</span>
    </motion.div>
  );
}

/* Demo items */
export function demoParams(): ParamItem[] {
  return [
    {
      id: "citizens",
      icon: <Users className={ICON_SIZE} strokeWidth={2.2} />,
      text: "1,000 citizens on the streets",
      tone: "neutral",
    },
    {
      id: "inflation",
      icon: <TrendingUp className={ICON_SIZE} strokeWidth={2.4} />,
      text: "Inflation up by 50%",
      tone: "up",
    },
    {
      id: "sheep",
      icon: <Leaf className={ICON_SIZE} strokeWidth={2.2} />,
      text: "3,000 more sheep",
      tone: "neutral",
    },
  ];
}
