// src/hooks/useRotatingText.ts
import { useEffect, useRef, useState } from "react";

/**
 * Cycles through an array of strings every `periodMs`.
 * Starts at index 0. Resets when `items` identity changes.
 */
export function useRotatingText(items: string[], periodMs = 3000) {
  const [i, setI] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!items?.length) return;
    setI(0); // reset on items change
    const id = window.setInterval(() => {
      setI((prev) => (prev + 1) % items.length);
    }, Math.max(800, periodMs));
    timer.current = id as unknown as number;
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [items, periodMs]);

  return items?.length ? items[i] : "";
}
