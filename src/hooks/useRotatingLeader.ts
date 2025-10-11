// src/hooks/useRotatingLeader.ts
// Hook for rotating through Hall of Fame leaders with fade transitions
//
// Features:
// - Randomly selects and shuffles top 20 leaders by score
// - Cycles through leaders every 12 seconds (0.5s fade in, 11s visible, 0.5s fade out)
// - Provides current leader and fade state for animations
//
// Used by: LeaderProfileCard (via CollectorLoadingOverlay)
// Dependencies: highscoreStore

import { useState, useEffect, useMemo } from "react";
import { useHighscoreStore } from "../store/highscoreStore";
import type { HighscoreEntry } from "../data/highscores-default";

export type FadeState = 'in' | 'visible' | 'out';

export type RotatingLeaderState = {
  currentLeader: HighscoreEntry | null;
  fadeState: FadeState;
};

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Hook for rotating through Hall of Fame leaders with smooth fade transitions
 *
 * Cycle timing:
 * - 0-0.5s: Fade in (opacity 0→1)
 * - 0.5-11.5s: Visible (opacity 1)
 * - 11.5-12s: Fade out (opacity 1→0)
 * - Repeat with next leader
 *
 * Usage:
 * ```tsx
 * const { currentLeader, fadeState } = useRotatingLeader();
 * ```
 */
export function useRotatingLeader(): RotatingLeaderState {
  const entries = useHighscoreStore((s) => s.entries);

  // Get top 20 leaders by score, shuffle once on mount
  const shuffledLeaders = useMemo(() => {
    const top20 = [...entries]
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    return shuffleArray(top20);
  }, [entries]);

  const [leaderIndex, setLeaderIndex] = useState(0);
  const [fadeState, setFadeState] = useState<FadeState>('in');

  const currentLeader = shuffledLeaders[leaderIndex] || null;

  useEffect(() => {
    if (shuffledLeaders.length === 0) return;

    // Start with fade in
    setFadeState('in');

    // After 500ms, transition to visible
    const fadeInTimer = setTimeout(() => {
      setFadeState('visible');
    }, 500);

    // After 11500ms (11.5s total), start fade out
    const fadeOutTimer = setTimeout(() => {
      setFadeState('out');
    }, 11500);

    // After 12000ms (12s total), switch to next leader
    const cycleTimer = setTimeout(() => {
      setLeaderIndex((prev) => (prev + 1) % shuffledLeaders.length);
      setFadeState('in'); // Start fade in for next leader
    }, 12000);

    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(cycleTimer);
    };
  }, [leaderIndex, shuffledLeaders.length]);

  return {
    currentLeader,
    fadeState
  };
}
