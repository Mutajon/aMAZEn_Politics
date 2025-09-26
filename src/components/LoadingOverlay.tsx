// src/components/LoadingOverlay.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRotatingText } from "../hooks/useRotatingText";

/** Optional shared list you asked for (exported for convenience). */
export type RichQuote = { text: string; author: string };
export const POLITICS_QUOTES: RichQuote[] = [
  { author: "Winston Churchill", text: "Democracy is the worst form of government, except for all the others." },
  { author: "Mark Twain", text: "Suppose you were an idiot, and suppose you were a member of Congress; but I repeat myself." },
  { author: "Groucho Marx", text: "Politics is the art of looking for trouble, finding it everywhere, diagnosing it incorrectly, and applying the wrong remedies." },
  { author: "George Bernard Shaw", text: "He knows nothing and thinks he knows everything. That points clearly to a political career." },
  { author: "Oscar Wilde", text: "Democracy means simply the bludgeoning of the people by the people for the people." },
  { author: "Will Rogers", text: "I don’t make jokes. I just watch the government and report the facts." },
  { author: "Franklin D. Roosevelt", text: "In politics, nothing happens by accident. If it happens, you can bet it was planned that way." },
  { author: "Thomas Jefferson", text: "Whenever a man has cast a longing eye on offices, a rottenness begins in his conduct." },
  { author: "Ronald Reagan", text: "The nine most terrifying words in the English language are: I’m from the government and I’m here to help." },
  { author: "Harry S. Truman", text: "If you want a friend in Washington, get a dog." },
  { author: "Adlai Stevenson", text: "In America, anybody can be president. That’s one of the risks you take." },
  { author: "Voltaire", text: "In general, the art of government consists of taking as much money as possible from one class of citizens to give to another." },
  { author: "Abraham Lincoln", text: "You can fool all the people some of the time, and some of the people all the time, but you cannot fool all the people all the time." },
  { author: "P. J. O’Rourke", text: "Giving money and power to government is like giving whiskey and car keys to teenage boys." },
  { author: "Machiavelli", text: "Politics have no relation to morals." },
  { author: "John Adams", text: "Because power corrupts, society’s demands for moral authority and character increase as the importance of the position increases." },
  { author: "Margaret Thatcher", text: "Being powerful is like being a lady. If you have to tell people you are, you aren’t." },
  { author: "Napoleon Bonaparte", text: "In politics, stupidity is not a handicap." },
  { author: "Alan Mooe", text: "People shouldn't be afraid of their government. Governments should be afraid of their people." },
  { author: "Unknown", text: "Politicians and diapers must be changed often, and for the same reason." },
  { author: "James Bovard", text: "Democracy must be something more than two wolves and a sheep voting on what to have for dinner." },
];

type Props = {
  visible: boolean;
  title?: string;                    // big headline
  quotes?: string[];                 // legacy: plain strings (still supported)
  quotesRich?: RichQuote[];          // new: structured quotes with authors
  periodMs?: number;                 // rotation interval
  onCancel?: () => void;             // optional cancel handler (Esc or click)
  dismissible?: boolean;             // allow click to close backdrop
};

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function LoadingOverlay({
  visible,
  title = "Working on it…",
  quotes,                                 // legacy
  quotesRich = POLITICS_QUOTES,           // default to the list you provided
  periodMs = 5500,
  onCancel,
  dismissible = false,
}: Props) {
  /** MODE A: legacy strings (no author line). */
  const legacyQuote = useRotatingText(quotes ?? [], periodMs);

  /** MODE B: rich quotes with speaker. */
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Start a fresh random order every time the overlay becomes visible
  useEffect(() => {
    if (!visible) {
      // stop timer when hidden
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    // pick which mode we’re in: rich if provided or fall back to legacy
    if (quotesRich && quotesRich.length > 0) {
      const shuffled = shuffle(Array.from({ length: quotesRich.length }, (_, i) => i));
      setOrder(shuffled);
      setIdx(0);
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setIdx((i) => (i + 1) % shuffled.length);
      }, periodMs) as unknown as number;
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [visible, quotesRich, periodMs]);

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

  // Current rich quote (if in rich mode)
  const currentRich: RichQuote | null =
    quotesRich && quotesRich.length > 0 && order.length > 0
      ? quotesRich[order[idx]]
      : null;

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
            <div
              className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-white/30 border-t-transparent animate-spin"
              aria-hidden
            />

            {/* Title */}
            <h3 className="text-2xl md:text-3xl font-extrabold tracking-wide bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              {title}
            </h3>

            {/* Quote (rich mode preferred, else legacy) */}
            {currentRich ? (
              <>
                <motion.p
                  key={`${order[idx]}-text`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="mt-4 text-lg md:text-xl italic text-white/85"
                  style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
                >
                  “{currentRich.text}”
                </motion.p>
                <motion.div
                  key={`${order[idx]}-author`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25, delay: 0.02 }}
                  className="mt-1 text-sm md:text-[13px] text-amber-300/90 italic tracking-wide"
                >
                  — {currentRich.author}
                </motion.div>
              </>
            ) : !!(quotes && quotes.length) ? (
              <motion.p
                key={legacyQuote}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="mt-4 text-lg md:text-xl italic text-white/85"
                style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
              >
                {legacyQuote}
              </motion.p>
            ) : null}

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
