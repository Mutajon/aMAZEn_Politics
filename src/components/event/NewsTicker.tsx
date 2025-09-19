// NewsTicker.tsx — lucide-react version
// ✅ Easy knobs (edit these first):
// - TICKER_SPEED_PX_PER_SEC   : scroll speed
// - TICKER_STEP               : items to move per cycle
// - TICKER_ITEM_GAP_PX        : px gap between chips (match Tailwind gap)
// - TICKER_TEXT_CLASS         : chip text font/style
// - TICKER_LABEL_CLASS        : "NEWSWIRE" label font/style
// - TICKER_VISIBLE_COUNT      : how many demo items to show (testing only)

import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, useAnimation } from "framer-motion";
import { Newspaper, MessageCircle, TrendingUp, TrendingDown } from "lucide-react";

/* ====================== TUNABLES (EDIT HERE) ====================== */
export const TICKER_SPEED_PX_PER_SEC = 115.2;             // scroll speed
export const TICKER_STEP = 3;                              // move exactly N items per cycle
export const TICKER_ITEM_GAP_PX = 12;                      // Tailwind gap-3 ≈ 12px
export const TICKER_TEXT_CLASS = "text-sm text-white/90";  // chip text font
export const TICKER_LABEL_CLASS =
  "text-[11px] font-semibold tracking-widest text-white/80";
export const TICKER_VISIBLE_COUNT = 3;                     // demo: show first N items
/* ================================================================ */

/** Types for ticker items */
export type TickerItem = {
  id: string;
  kind: "news" | "social";
  tone: "up" | "down" | "neutral";
  text: string;
};

/** Build satirical items from your game state */
export function buildTickerItems(state: any): TickerItem[] {
  const p = state?.parameters?.find((x: any) => x.id === "people") ?? { value: 0, delta: 0 };
  const c = state?.parameters?.find((x: any) => x.id === "congress") ?? { value: 0, delta: 0 };
  const m = state?.parameters?.find((x: any) => x.id === "mom") ?? { value: 0, delta: 0 };
  const intl = state?.dynamics?.find((d: any) => d.label?.toLowerCase?.().includes("international"));

  const tone = (n: number): TickerItem["tone"] => (n > 0 ? "up" : n < 0 ? "down" : "neutral");

  return [
    {
      id: "news-people",
      kind: "news",
      tone: tone(p.delta),
      text: `Polls show ${p.value}% support — Blob reassures nation: “Numbers are just very shy today.”`,
    },
    {
      id: "news-congress",
      kind: "news",
      tone: tone(c.delta),
      text:
        c.value === 0
          ? "Congress dissolved; exiles launch new show: ‘Democracy After Dark.’"
          : `Congress at ${c.value}% approval — committees rebrand as ‘Vibes Panels.’`,
    },
    {
      id: "news-international",
      kind: "news",
      tone: intl ? "down" : "neutral",
      text: intl
        ? `International standing: ${intl.value}. Blob introduces ‘Staycation Diplomacy.’`
        : "Foreign press still buffering…",
    },
    {
      id: "social-mom",
      kind: "social",
      tone: tone(m.delta),
      text: `@Mom: ${m.value}% proud, ${Math.max(0, 100 - m.value)}% worried. “Eat, hydrate, and maybe don’t execute people on TV.”`,
    },
    {
      id: "social-official",
      kind: "social",
      tone: tone(p.delta),
      text: `@BlobOfficial: New era. Big choices. Bigger hats. #DecisiveLeadership`,
    },
  ];
}

/** Single chip (tone-colored) */
export function TickerChip({ item }: { item: TickerItem }) {
  const IconKind = item.kind === "news" ? Newspaper : MessageCircle;

  const toneClass =
    item.tone === "up"
      ? "bg-emerald-500/15 ring-emerald-500/30"
      : item.tone === "down"
      ? "bg-rose-500/15 ring-rose-500/30"
      : "bg-sky-500/15 ring-sky-500/30";

  const iconTint = item.kind === "news" ? "text-sky-300" : "text-fuchsia-300";
  const ToneIcon =
    item.tone === "up"
      ? () => <TrendingUp className="w-[14px] h-[14px] text-emerald-400" />
      : item.tone === "down"
      ? () => <TrendingDown className="w-[14px] h-[14px] text-rose-400" />
      : null;

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ring-1 ${toneClass} backdrop-blur-sm`}>
      <IconKind className={`w-4 h-4 ${iconTint}`} />
      {ToneIcon && <ToneIcon />}
      <span className={`whitespace-nowrap ${TICKER_TEXT_CLASS}`}>{item.text}</span>
    </div>
  );
}

/**
 * NewsTicker
 * - Scrolls left by exactly TICKER_STEP items per cycle, then rotates those items to the end.
 * - Colors: gradient rail, tone-colored chips (emerald/up, rose/down, sky/neutral).
 * - Speed controlled by TICKER_SPEED_PX_PER_SEC.
 */
export function NewsTicker({ items }: { items: TickerItem[] }) {
  const N_STEP = TICKER_STEP;
  const controls = useAnimation();
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Ensure at least N_STEP items by repeating if needed
  const normalized = React.useMemo(() => {
    if (!items?.length) return [];
    if (items.length >= N_STEP) return items;
    return Array.from({ length: N_STEP }, (_, i) => items[i % items.length]);
  }, [items]);

  const [seq, setSeq] = useState<TickerItem[]>(normalized);

  // update sequence when items change
  useEffect(() => setSeq(normalized), [normalized]);

  const run = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const children = Array.from(track.children) as HTMLElement[];
    if (!children.length) return;

    // measure distance that N_STEP items + 1 gap occupy
    const n = Math.min(N_STEP, children.length);
    const firstLeft = children[0].offsetLeft;
    const last = children[n - 1];
    const lastRight = last.offsetLeft + last.offsetWidth;
    const distance = lastRight - firstLeft + TICKER_ITEM_GAP_PX;

    const duration = Math.max(0.1, distance / TICKER_SPEED_PX_PER_SEC);

    controls.set({ x: 0 });
    controls
      .start({ x: -distance, transition: { duration, ease: "linear", type: "tween" } })
      .then(() => {
        // Rotate first N_STEP items to the end
        setSeq((prev) => {
          const rotated = prev.slice();
          const slice = rotated.splice(0, n);
          return [...rotated, ...slice];
        });
      });
  }, [controls]);

  // after each seq change, kick off the next cycle
  useEffect(() => {
    if (!seq.length) return;
    const id = requestAnimationFrame(run);
    return () => cancelAnimationFrame(id);
  }, [seq, run]);

  if (!seq.length) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500/15 via-fuchsia-500/10 to-rose-500/15 ring-1 ring-white/10">
      <div className="flex items-center gap-2 px-3 py-1">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
        </span>
        <span className={TICKER_LABEL_CLASS}>NEWSWIRE</span>
      </div>

      <div className="relative">
        <motion.div
          ref={trackRef}
          animate={controls}
          className="flex gap-3 px-3 pb-2 will-change-transform"
        >
          {seq.map((it, idx) => (
            <TickerChip key={`${it.id}-${idx}`} item={it} />
          ))}
        </motion.div>
      </div>
    </div>
  );
}

/* ---------------------- Demo support (for now) ---------------------- */

export const DEMO_TICKER_ITEMS: TickerItem[] = [
  {
    id: "demo-1",
    kind: "news",
    tone: "neutral",
    text: "Markets wobble, Blob promises 'comfort carbs for all.'",
  },
  {
    id: "demo-2",
    kind: "news",
    tone: "down",
    text: "Allies uneasy as midnight speeches include interpretive dance.",
  },
  {
    id: "demo-3",
    kind: "social",
    tone: "up",
    text: "@Citizen42: honestly the hats are working. #TeamBlob",
  },
];

export function NewsTickerDemo() {
  return <NewsTicker items={DEMO_TICKER_ITEMS.slice(0, TICKER_VISIBLE_COUNT)} />;
}
