// src/components/LoadingOverlay.tsx
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRotatingText } from "../hooks/useRotatingText";

// Optional: if you already have a bgStyle helper, you can import it
// import { bgStyle } from "../lib/ui";

type Props = {
  visible: boolean;
  title?: string;                 // big headline
  quotes?: string[];              // rotating messages
  periodMs?: number;              // rotation interval
  onCancel?: () => void;          // optional cancel handler (Esc or click)
  dismissible?: boolean;          // allow click to close backdrop
};

export default function LoadingOverlay({
  visible,
  title = "Working on it…",
  quotes = [],
  periodMs = 3000,
  onCancel,
  dismissible = false,
}: Props) {
  const quote = useRotatingText(quotes, periodMs);

  // Prevent page scroll while visible
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  // Esc to cancel (if supported)
  useEffect(() => {
    if (!visible || !onCancel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onCancel]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[999] grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={dismissible ? onCancel : undefined}
          />

          {/* Card */}
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="relative w-[min(92vw,640px)] rounded-3xl border border-white/10 bg-[rgba(18,22,45,0.85)] shadow-xl p-6 text-center select-none"
          >
            {/* Subtle spinner */}
            <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-white/30 border-t-transparent animate-spin" aria-hidden />

            {/* Title */}
            <h3 className="text-2xl md:text-3xl font-extrabold tracking-wide bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              {title}
            </h3>

            {/* Quote that rotates */}
            {!!quotes.length && (
              <motion.p
                key={quote} // animates between quotes
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="mt-4 text-lg md:text-xl italic text-white/85"
                style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
              >
                {quote}
              </motion.p>
            )}

            {/* Optional cancel */}
            {onCancel && (
              <button
                onClick={onCancel}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
