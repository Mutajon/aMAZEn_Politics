// DynamicParameters.tsx — Static display with emoji-based narrative parameters
// Displays 1-3 dynamic parameters horizontally with fade-in animation
// Based on player's last action and narrative context

import React from "react";
import { motion } from "framer-motion";
import type { DynamicParam } from "../../hooks/useEventDataCollector";

/** Types for parameter items */
export type ParameterItem = {
  id: string;
  tone: "up" | "down" | "neutral";
  text: string;
  icon: string; // Now an emoji character (🎨, 🔥, etc.)
};

// Day 1 placeholder messages (randomly selected)
const DAY_ONE_MESSAGES = [
  { emoji: "📜", text: "New leader, new hope — same problems." },
  { emoji: "🎯", text: "Day one: optimism 100%, plan 0%." },
  { emoji: "🏛️", text: "Nation cheers. Bureaucracy yawns." },
  { emoji: "🌅", text: "Change is in the air… or maybe that's just politics." },
  { emoji: "📋", text: "Leader promises reform. Reality pending." },
  { emoji: "☁️", text: "A new dawn! Clouds gathering." },
  { emoji: "😌", text: "Nation sighs in relief — for now." },
  { emoji: "✨", text: "Hope returns — warranty unclear." },
  { emoji: "💭", text: "The people believe again. Adorable." },
  { emoji: "🖼️", text: "Official portrait unveiled: strong jawline, uncertain future." },
  { emoji: "📊", text: "Economy stable — mostly out of confusion." }
];

/**
 * Get 3 random Day 1 messages
 */
function getRandomDayOneMessages(): ParameterItem[] {
  const shuffled = [...DAY_ONE_MESSAGES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map((msg, i) => ({
    id: `day1-${i}`,
    tone: "neutral" as const,
    text: msg.text,
    icon: msg.emoji
  }));
}

/**
 * Convert DynamicParam[] to ParameterItem[]
 * Used to display dynamic parameters in the UI
 *
 * @param params - Dynamic parameters (null = loading, [] = Day 1)
 * @param isFirstDay - Whether this is Day 1 (show random messages instead of loading)
 */
export function buildDynamicParamsItems(
  params: DynamicParam[] | null,
  isFirstDay: boolean = false
): ParameterItem[] {
  // Day 1: Show 3 random onboarding messages
  if (isFirstDay) {
    return getRandomDayOneMessages();
  }

  // Day 2+: Show loading placeholder (null params)
  if (!params || params.length === 0) {
    return [{
      id: "placeholder",
      tone: "neutral" as const,
      text: "News items incoming...",
      icon: "📰"
    }];
  }

  // Day 2+: Show actual dynamic parameters
  return params.map(p => ({
    id: p.id,
    tone: p.tone,
    text: p.text,
    icon: p.icon // Now an emoji character from AI
  }));
}

/** Single parameter chip with emoji and text */
export function ParameterChip({ item }: { item: ParameterItem }) {
  // Uniform light gray color for all parameters
  const textTint = "text-slate-300";

  // Unified navy gradient background for all capsules
  const capsuleClass = "bg-gradient-to-br from-slate-800/90 to-slate-900/90 ring-slate-600/50";

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ring-1 ${capsuleClass} backdrop-blur-sm`}>
      <span className="text-lg leading-none">{item.icon}</span>
      <span className={`whitespace-nowrap text-sm ${textTint}`}>{item.text}</span>
    </div>
  );
}

/**
 * DynamicParameters
 * - Displays 1-3 parameters horizontally (all visible at once)
 * - Fades in with 1.5s animation when appearing
 * - Uses emoji characters instead of icon components
 * - Special case: Placeholder shows as blinking text
 */
export function DynamicParameters({ items }: { items: ParameterItem[] }) {
  if (!items?.length) return null;

  // Check if this is placeholder mode
  const isPlaceholder = items.length === 1 && items[0].text === "News items incoming...";

  return (
    <motion.div
      className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500/15 via-fuchsia-500/10 to-rose-500/15 ring-1 ring-white/10"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
    >
      {/* Header with animated indicator */}
      <div className="flex items-center gap-2 px-3 py-1">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
        </span>
        <span className="text-[11px] font-semibold tracking-widest text-white/80">
          IMPACT
        </span>
      </div>

      {/* Parameters display */}
      <div className="px-3 pb-2">
        {isPlaceholder ? (
          // Placeholder mode: Simple blinking text
          <div className="flex items-center justify-center py-1">
            <span className="text-sm text-white/60 animate-pulse">
              {items[0].text}
            </span>
          </div>
        ) : (
          // Normal mode: Static horizontal row with fade-in
          <motion.div
            className="flex flex-wrap gap-3 items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, delay: 0.2 }}
          >
            {items.map((item) => (
              <ParameterChip key={item.id} item={item} />
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
