// src/components/MirrorBubbleTyping.tsx
// A reusable "mirror is thinking" bubble that matches MirrorBubble styling,
// but animates three dots (… … …) while we wait for AI.
//
// Usage: <MirrorBubbleTyping text="Peering into your soul" />
//
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { mirrorBubbleTheme as T } from "../theme/mirrorBubbleTheme";

export default function MirrorBubbleTyping({
  text = "Peering into your soul",
  speedMs = 400, // dot cadence
  className,
}: {
  text?: string;
  speedMs?: number;
  className?: string;
}) {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const id = window.setInterval(() => {
      setDots((d) => (d % 3) + 1);
    }, speedMs);
    return () => window.clearInterval(id);
  }, [speedMs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={["w-full flex justify-start my-2", className || ""].join(" ")}
      aria-live="polite"
      aria-busy="true"
    >
      <div
        style={{
          background: T.bg,
          color: T.textColor,
          fontFamily: T.fontFamily,
          fontSize: `${T.fontSizePx}px`,
          padding: `${T.paddingY}px ${T.paddingX}px`,
          maxWidth: T.maxWidth,
          boxShadow: T.shadow,
          borderTopLeftRadius: T.cornerTL,
          borderTopRightRadius: T.cornerTR,
          borderBottomLeftRadius: T.cornerBL,
          borderBottomRightRadius: T.cornerBR,
        }}
      >
        <span className="italic">
          {text}
          {".".repeat(dots)}
        </span>
      </div>
    </motion.div>
  );
}
