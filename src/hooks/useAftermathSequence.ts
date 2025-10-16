// src/hooks/useAftermathSequence.ts
// Orchestrates the sequential presentation of the aftermath screen using counter-based progression
//
// Manages:
// - Step counter that increments when each element completes
// - Auto-scrolling to keep active content centered
// - Skip functionality to jump to end
// - First visit detection (animate) vs return visit (instant)
//
// Connects to:
// - src/screens/AftermathScreen.tsx: main orchestrator
// - src/components/aftermath/*: individual section components

import { useState, useCallback, useRef } from "react";
import type { AftermathResponse } from "../lib/aftermath";

export function useAftermathSequence(data: AftermathResponse | null, isFirstVisit: boolean) {
  // Counter-based progression:
  // 0 = Intro typewriter
  // 1 = Remembrance fade-in
  // 2 = Narration (wait for audio)
  // 3+ = Decisions (one per number)
  // N = Final ratings
  // N+1 = Reflection
  // N+2 = Tombstone
  // N+3 = Complete
  const getFinalStep = useCallback(() => {
    if (!data) return 0;
    // 0 (intro) + 1 (remembrance) + 1 (narration) + decisions + ratings + reflection + tombstone + complete
    return 3 + data.decisions.length + 4;
  }, [data]);

  // If not first visit, start at final step (show everything)
  const [counter, setCounter] = useState(isFirstVisit ? 0 : getFinalStep());
  const [isSkipped, setIsSkipped] = useState(!isFirstVisit);

  // Refs for auto-scrolling
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  // Register a section ref for auto-scrolling
  const registerRef = useCallback((key: string, element: HTMLElement | null) => {
    sectionRefs.current[key] = element;
  }, []);

  // Auto-scroll to center the active section
  const scrollToSection = useCallback((key: string) => {
    const element = sectionRefs.current[key];
    if (element) {
      // Check if element is in viewport
      const rect = element.getBoundingClientRect();
      const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;

      if (!isInViewport) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, []);

  // Advance to next step (called by components when they complete)
  const advanceToNext = useCallback(() => {
    setCounter(prev => {
      const next = prev + 1;
      console.log('[AftermathSequence] Advancing from', prev, 'to', next);

      // Auto-scroll based on next step
      if (next === 1 || next === 2) {
        scrollToSection("remembrance");
      } else if (next >= 3 && data && next < 3 + data.decisions.length) {
        scrollToSection("decisions");
      } else if (data && next === 3 + data.decisions.length) {
        scrollToSection("ratings");
      } else if (data && next === 3 + data.decisions.length + 1) {
        scrollToSection("reflection");
      } else if (data && next === 3 + data.decisions.length + 2) {
        scrollToSection("tombstone");
      }

      return next;
    });
  }, [data, scrollToSection]);

  // Skip to end
  const skipToEnd = useCallback(() => {
    console.log('[AftermathSequence] Skipping to end');
    setIsSkipped(true);
    setCounter(getFinalStep());

    // Scroll to bottom to show "Reveal final score" button
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  }, [getFinalStep]);

  // Get step numbers for different sections
  const getStepNumbers = useCallback(() => {
    if (!data) {
      return {
        intro: 0,
        remembrance: 1,
        narration: 2,
        decisionsStart: 3,
        ratingsStep: 3,
        reflectionStep: 4,
        tombstoneStep: 5,
        completeStep: 6,
      };
    }

    const decisionsStart = 3;
    const ratingsStep = decisionsStart + data.decisions.length;
    const reflectionStep = ratingsStep + 1;
    const tombstoneStep = reflectionStep + 1;
    const completeStep = tombstoneStep + 1;

    return {
      intro: 0,
      remembrance: 1,
      narration: 2,
      decisionsStart,
      ratingsStep,
      reflectionStep,
      tombstoneStep,
      completeStep,
    };
  }, [data]);

  const steps = getStepNumbers();

  // Helper to check if counter has reached a specific step
  const hasReached = useCallback((step: number): boolean => {
    return counter >= step;
  }, [counter]);

  // Helper to check if currently at a specific step
  const isAtStep = useCallback((step: number): boolean => {
    return counter === step;
  }, [counter]);

  return {
    counter,
    steps,
    isSkipped,
    hasReached,
    isAtStep,
    advanceToNext,
    skipToEnd,
    registerRef,
    showSkipButton: counter < steps.completeStep && !isSkipped,
  };
}
