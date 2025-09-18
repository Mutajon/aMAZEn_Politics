// src/components/MirrorBubble.tsx
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { mirrorBubbleTheme as T } from "../theme/mirrorBubbleTheme";

/**
 * The mirror's speech bubble, with optional one-time typewriter animation.
 * - Keep `typing` true to type once on mount; pass `onDone` to be notified.
 * - Set `typing={false}` to render fully (used when returning to a screen).
 */
export default function MirrorBubble({
  text,
  typing = true,
  italic = true,
  speedMs = 18,
  onDone,
  className,
}: {
  text: string;
  typing?: boolean;
  italic?: boolean;
  speedMs?: number;
  onDone?: () => void;
  className?: string;
}) {
  const [shown, setShown] = useState(typing ? "" : text);
  const doneRef = useRef(false);
  const cbRef = useRef(onDone);
  useEffect(() => {
    cbRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!typing || doneRef.current) return;
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        doneRef.current = true;
        window.clearInterval(id);
        cbRef.current?.();
      }
    }, speedMs);
    return () => window.clearInterval(id);
    // type only once on mount for this text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, typing, speedMs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={["w-full flex justify-start my-2", className || ""].join(" ")}
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
        <span className={italic ? "italic" : ""}>{shown}</span>
      </div>
    </motion.div>
  );
}
