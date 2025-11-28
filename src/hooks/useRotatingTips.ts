import { useState, useEffect, useRef, useMemo } from 'react';
import { useLang } from '../i18n/lang';

/**
 * Hook for rotating loading tips with fade transitions
 * Modeled after useRotatingLeader pattern
 *
 * Cycle: 10 seconds per tip
 * - 0.5s fade in
 * - 9s visible
 * - 0.5s fade out
 *
 * Tips are shuffled on mount so each overlay display shows a random tip first
 */

const LOADING_TIP_KEYS = [
  "LOADING_TIP_AVATAR",
  "LOADING_TIP_SUGGEST_ACTIONS",
  "LOADING_TIP_BALANCE",
  "LOADING_TIP_INQUIRE",
  "LOADING_TIP_MIRROR",
  "LOADING_TIP_CONSEQUENCES",
];

/**
 * Fisher-Yates shuffle algorithm for randomizing array
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

type FadeState = 'in' | 'visible' | 'out';

export function useRotatingTips() {
  const lang = useLang();
  
  // Get translated tips and shuffle them - recompute when language changes
  const shuffledTips = useMemo(() => {
    const tips = LOADING_TIP_KEYS.map(key => lang(key));
    return shuffleArray(tips);
  }, [lang]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadeState, setFadeState] = useState<FadeState>('in');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const cycleTip = () => {
      // Fade in (0.5s)
      setFadeState('in');

      timerRef.current = setTimeout(() => {
        // Visible (9s)
        setFadeState('visible');

        timerRef.current = setTimeout(() => {
          // Fade out (0.5s)
          setFadeState('out');

          timerRef.current = setTimeout(() => {
            // Move to next tip (cycling through shuffled array)
            setCurrentIndex((prev) => (prev + 1) % shuffledTips.length);
          }, 500);
        }, 9000);
      }, 500);
    };

    cycleTip();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentIndex, shuffledTips.length]);

  return {
    currentTip: shuffledTips[currentIndex],
    fadeState,
  };
}
