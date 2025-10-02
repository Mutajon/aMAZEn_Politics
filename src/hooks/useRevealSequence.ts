// src/hooks/useRevealSequence.ts
// Manages sequential reveal of analysis results after day progression overlay ends
// Coordinates the timing of support changes, news, parameters, dilemma, mirror, and actions

import { useState, useCallback } from "react";

export type RevealStage = 'hidden' | 'support' | 'news' | 'parameters' | 'dilemma' | 'mirror' | 'actions' | 'complete';

interface RevealSequenceProps {
  onDilemmaRevealed?: () => void; // Callback to trigger narration when dilemma is revealed
}

export function useRevealSequence(props?: RevealSequenceProps) {
  const [currentStage, setCurrentStage] = useState<RevealStage>('hidden');
  const [isRevealing, setIsRevealing] = useState(false);

  // Start the sequential reveal process
  const startRevealSequence = useCallback(async () => {
    setIsRevealing(true);
    setCurrentStage('hidden');

    // Sequence of reveals with timing
    const sequence: { stage: RevealStage; delay: number }[] = [
      { stage: 'support', delay: 500 },    // a. Support effects first
      { stage: 'news', delay: 800 },       // b. News ticker updates
      { stage: 'parameters', delay: 800 }, // c. Dynamic parameters
      { stage: 'dilemma', delay: 1000 },   // d. New dilemma + start narration
      { stage: 'mirror', delay: 1200 },    // e. Mirror text + compass pills
      { stage: 'actions', delay: 800 },    // f. Action cards
      { stage: 'complete', delay: 0 },     // All done
    ];

    for (const { stage, delay } of sequence) {
      await new Promise(resolve => setTimeout(resolve, delay));
      setCurrentStage(stage);
      console.log(`[useRevealSequence] Revealed stage: ${stage}`);

      // Trigger narration when dilemma is revealed
      if (stage === 'dilemma' && props?.onDilemmaRevealed) {
        props.onDilemmaRevealed();
      }
    }

    setIsRevealing(false);
  }, [props]);

  // Reset to hidden state
  const resetReveal = useCallback(() => {
    setCurrentStage('hidden');
    setIsRevealing(false);
  }, []);

  // Helper functions to check if specific content should be visible
  const shouldShowSupport = currentStage !== 'hidden';
  const shouldShowNews = ['news', 'parameters', 'dilemma', 'mirror', 'actions', 'complete'].includes(currentStage);
  const shouldShowParameters = ['parameters', 'dilemma', 'mirror', 'actions', 'complete'].includes(currentStage);
  const shouldShowDilemma = ['dilemma', 'mirror', 'actions', 'complete'].includes(currentStage);
  const shouldShowMirror = ['mirror', 'actions', 'complete'].includes(currentStage);
  const shouldShowActions = ['actions', 'complete'].includes(currentStage);

  return {
    currentStage,
    isRevealing,
    shouldShowSupport,
    shouldShowNews,
    shouldShowParameters,
    shouldShowDilemma,
    shouldShowMirror,
    shouldShowActions,
    startRevealSequence,
    resetReveal,
  };
}