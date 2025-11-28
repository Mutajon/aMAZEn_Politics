// src/components/LoadingOverlay.tsx
import { useEffect, useRef, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRotatingText } from "../hooks/useRotatingText";
import { createTranslatedConst, useTranslatedConst } from "../i18n/useTranslatedConst";

/** Optional shared list you asked for (exported for convenience). */
export type RichQuote = { text: string; author: string };

// Translated quotes using i18n
export const POLITICS_QUOTES = createTranslatedConst((lang): RichQuote[] => [
  { author: lang("POLITICS_QUOTE_1_AUTHOR"), text: lang("POLITICS_QUOTE_1_TEXT") },
  { author: lang("POLITICS_QUOTE_2_AUTHOR"), text: lang("POLITICS_QUOTE_2_TEXT") },
  { author: lang("POLITICS_QUOTE_3_AUTHOR"), text: lang("POLITICS_QUOTE_3_TEXT") },
  { author: lang("POLITICS_QUOTE_4_AUTHOR"), text: lang("POLITICS_QUOTE_4_TEXT") },
  { author: lang("POLITICS_QUOTE_5_AUTHOR"), text: lang("POLITICS_QUOTE_5_TEXT") },
  { author: lang("POLITICS_QUOTE_6_AUTHOR"), text: lang("POLITICS_QUOTE_6_TEXT") },
  { author: lang("POLITICS_QUOTE_7_AUTHOR"), text: lang("POLITICS_QUOTE_7_TEXT") },
  { author: lang("POLITICS_QUOTE_8_AUTHOR"), text: lang("POLITICS_QUOTE_8_TEXT") },
  { author: lang("POLITICS_QUOTE_9_AUTHOR"), text: lang("POLITICS_QUOTE_9_TEXT") },
  { author: lang("POLITICS_QUOTE_10_AUTHOR"), text: lang("POLITICS_QUOTE_10_TEXT") },
  { author: lang("POLITICS_QUOTE_11_AUTHOR"), text: lang("POLITICS_QUOTE_11_TEXT") },
  { author: lang("POLITICS_QUOTE_12_AUTHOR"), text: lang("POLITICS_QUOTE_12_TEXT") },
  { author: lang("POLITICS_QUOTE_13_AUTHOR"), text: lang("POLITICS_QUOTE_13_TEXT") },
  { author: lang("POLITICS_QUOTE_14_AUTHOR"), text: lang("POLITICS_QUOTE_14_TEXT") },
  { author: lang("POLITICS_QUOTE_15_AUTHOR"), text: lang("POLITICS_QUOTE_15_TEXT") },
  { author: lang("POLITICS_QUOTE_16_AUTHOR"), text: lang("POLITICS_QUOTE_16_TEXT") },
  { author: lang("POLITICS_QUOTE_17_AUTHOR"), text: lang("POLITICS_QUOTE_17_TEXT") },
  { author: lang("POLITICS_QUOTE_18_AUTHOR"), text: lang("POLITICS_QUOTE_18_TEXT") },
  { author: lang("POLITICS_QUOTE_19_AUTHOR"), text: lang("POLITICS_QUOTE_19_TEXT") },
  { author: lang("POLITICS_QUOTE_20_AUTHOR"), text: lang("POLITICS_QUOTE_20_TEXT") },
  { author: lang("POLITICS_QUOTE_21_AUTHOR"), text: lang("POLITICS_QUOTE_21_TEXT") },
  { author: lang("POLITICS_QUOTE_22_AUTHOR"), text: lang("POLITICS_QUOTE_22_TEXT") },
  { author: lang("POLITICS_QUOTE_23_AUTHOR"), text: lang("POLITICS_QUOTE_23_TEXT") },
  { author: lang("POLITICS_QUOTE_24_AUTHOR"), text: lang("POLITICS_QUOTE_24_TEXT") },
  { author: lang("POLITICS_QUOTE_25_AUTHOR"), text: lang("POLITICS_QUOTE_25_TEXT") },
  { author: lang("POLITICS_QUOTE_26_AUTHOR"), text: lang("POLITICS_QUOTE_26_TEXT") },
  { author: lang("POLITICS_QUOTE_27_AUTHOR"), text: lang("POLITICS_QUOTE_27_TEXT") },
]);

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
  quotesRich,                             // can be provided, or will use default translated quotes
  periodMs = 7500,
  onCancel,
  dismissible = false,
}: Props) {
  // Get translated quotes using the hook - memoized to prevent re-creation
  const translatedQuotes = useTranslatedConst(POLITICS_QUOTES);
  
  // Memoize the effective quotes to prevent unnecessary re-renders
  const effectiveQuotesRich = useMemo(() => {
    return quotesRich ?? translatedQuotes;
  }, [quotesRich, translatedQuotes]);
  
  // Use ref to track if we've initialized for this visibility session
  const initializedRef = useRef(false);
  const quotesRef = useRef<RichQuote[]>([]);
  
  /** MODE A: legacy strings (no author line). */
  const legacyQuote = useRotatingText(quotes ?? [], periodMs);

  /** MODE B: rich quotes with speaker. */
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Update quotes ref when they change
  // If overlay is visible but not initialized yet, initialize now
  useEffect(() => {
    if (effectiveQuotesRich && effectiveQuotesRich.length > 0) {
      const wasEmpty = quotesRef.current.length === 0;
      quotesRef.current = effectiveQuotesRich;
      
      // If overlay is visible but we haven't initialized (quotes just loaded), initialize now
      if (visible && !initializedRef.current && wasEmpty) {
        const shuffled = shuffle(Array.from({ length: effectiveQuotesRich.length }, (_, i) => i));
        setOrder(shuffled);
        setIdx(0);
        initializedRef.current = true;
        
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = window.setInterval(() => {
          setIdx((i) => (i + 1) % shuffled.length);
        }, periodMs) as unknown as number;
      }
    }
  }, [effectiveQuotesRich, visible, periodMs]);

  // Start a fresh random order every time the overlay becomes visible
  // Only shuffle once when visible changes from false to true - NOT when quotes change
  useEffect(() => {
    if (!visible) {
      // stop timer when hidden and reset initialization flag
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      initializedRef.current = false;
      return;
    }
    
    // Only initialize once when overlay becomes visible
    // Use the ref to get current quotes (which are updated separately)
    if (!initializedRef.current) {
      const quotesToUse = quotesRef.current.length > 0 ? quotesRef.current : effectiveQuotesRich;
      if (quotesToUse && quotesToUse.length > 0) {
        const shuffled = shuffle(Array.from({ length: quotesToUse.length }, (_, i) => i));
        setOrder(shuffled);
        setIdx(0);
        initializedRef.current = true;
        
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = window.setInterval(() => {
          setIdx((i) => (i + 1) % shuffled.length);
        }, periodMs) as unknown as number;
      }
    }
    
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, periodMs]); // Only depend on visible and periodMs, not quotes

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
    effectiveQuotesRich && effectiveQuotesRich.length > 0 && order.length > 0
      ? effectiveQuotesRich[order[idx]]
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
            className="relative w-[min(92vw,640px)] rounded-2xl sm:rounded-3xl border border-white/10 bg-[rgba(18,22,45,0.85)] shadow-xl p-4 sm:p-6 text-center select-none"
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
                  className="mt-4 text-base sm:text-lg md:text-xl italic text-white/85"
                  style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
                >
                  "{currentRich.text}"
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
                className="mt-4 text-base sm:text-lg md:text-xl italic text-white/85"
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
