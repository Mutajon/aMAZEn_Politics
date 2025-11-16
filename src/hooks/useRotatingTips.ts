import { useState, useEffect, useRef } from 'react';

/**
 * Hook for rotating loading tips with fade transitions
 * Modeled after useRotatingLeader pattern
 *
 * Cycle: 10 seconds per tip
 * - 0.5s fade in
 * - 9s visible
 * - 0.5s fade out
 */

const LOADING_TIPS = [
  "Click your avatar picture to learn about your current values",
  "Click the gatekeeper to learn about his background",
  "Remember you can suggest your own actions - experiment!",
  "Try to balance the between desires of different supporters",
  "You can click inquire to learn more about a problem before making a decision",
];

type FadeState = 'in' | 'visible' | 'out';

export function useRotatingTips() {
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
            // Move to next tip
            setCurrentIndex((prev) => (prev + 1) % LOADING_TIPS.length);
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
  }, [currentIndex]);

  return {
    currentTip: LOADING_TIPS[currentIndex],
    fadeState,
  };
}
