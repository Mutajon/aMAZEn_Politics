import { useState, useCallback } from 'react';

const TUTORIAL_STORAGE_KEY = 'tutorial_day2_completed';

export type TutorialStep =
  | 'inactive'
  | 'awaiting-avatar'
  | 'awaiting-value'
  | 'showing-explanation'
  | 'awaiting-modal-close'
  | 'awaiting-compass-pills'
  | 'complete';

interface SelectedValue {
  short: string;
  full: string;
  dimension: 'what' | 'whence' | 'how' | 'whither';
  index: number;
}

export function useDay2Tutorial() {
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('inactive');
  const [tutorialCompleted, setTutorialCompleted] = useState<boolean>(() => {
    // Check localStorage on initialization
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true';
  });
  const [selectedValue, setSelectedValue] = useState<SelectedValue | null>(null);

  // Start the tutorial
  const startTutorial = useCallback(() => {
    if (tutorialCompleted) return;
    setTutorialStep('awaiting-avatar');
  }, [tutorialCompleted]);

  // Handle avatar being clicked
  const onAvatarOpened = useCallback(() => {
    if (tutorialStep === 'awaiting-avatar') {
      // Wait 1 second before showing the value highlight (reduced from 2s)
      setTimeout(() => {
        setTutorialStep('awaiting-value');
      }, 1000);
    }
  }, [tutorialStep]);

  // Handle a value being clicked
  const onValueClicked = useCallback((value: SelectedValue) => {
    if (tutorialStep === 'awaiting-value') {
      setSelectedValue(value);
      setTutorialStep('showing-explanation');
    }
  }, [tutorialStep]);

  // Handle explanation modal being closed
  const onExplanationClosed = useCallback(() => {
    if (tutorialStep === 'showing-explanation') {
      // Keep selectedValue, just advance to waiting for modal close
      setTutorialStep('awaiting-modal-close');
      console.log('[Tutorial] Explanation closed, waiting for PlayerCardModal to close');
    }
  }, [tutorialStep]);

  // Handle main modal being closed (advance to compass pills step)
  const onModalClosed = useCallback((checkPillsRefReady?: () => boolean) => {
    if (tutorialStep === 'awaiting-modal-close') {
      console.log('[Tutorial] PlayerCardModal closed, polling for pills ref');
      setSelectedValue(null);

      // Poll for pills ref to be ready (max 1000ms)
      let attempts = 0;
      const maxAttempts = 10; // 10 attempts * 100ms = 1000ms max

      const pollForRef = () => {
        attempts++;
        const refReady = checkPillsRefReady?.() ?? false;

        if (refReady) {
          console.log(`[Tutorial] Pills ref ready after ${attempts * 100}ms, advancing to compass pills step`);
          setTutorialStep('awaiting-compass-pills');
        } else if (attempts < maxAttempts) {
          setTimeout(pollForRef, 100);
        } else {
          console.log('[Tutorial] Pills ref timeout, advancing anyway');
          setTutorialStep('awaiting-compass-pills');
        }
      };

      // Start polling after small initial delay
      setTimeout(pollForRef, 100);
    }
  }, [tutorialStep]);

  // Handle compass pills button being clicked (tutorial completion)
  const onCompassPillsClicked = useCallback(() => {
    if (tutorialStep === 'awaiting-compass-pills') {
      console.log('[Tutorial] Compass pills clicked, completing tutorial');
      setTutorialStep('complete');
      localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
      setTutorialCompleted(true);
    }
  }, [tutorialStep]);

  // Complete the tutorial
  const completeTutorial = useCallback(() => {
    setTutorialStep('complete');
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    setTutorialCompleted(true);
    setSelectedValue(null);
  }, []);

  // Reset tutorial (for testing or full reset)
  const resetTutorial = useCallback(() => {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    setTutorialCompleted(false);
    setTutorialStep('inactive');
    setSelectedValue(null);
  }, []);

  return {
    // State
    tutorialStep,
    tutorialActive: tutorialStep !== 'inactive' && tutorialStep !== 'complete',
    tutorialCompleted,
    selectedValue,
    shouldShowOverlay: tutorialStep === 'awaiting-avatar' || tutorialStep === 'awaiting-value' || tutorialStep === 'awaiting-compass-pills',
    shouldShowValueHighlight: tutorialStep === 'awaiting-value',
    shouldShowExplanation: tutorialStep === 'showing-explanation' && selectedValue !== null,
    shouldDisableModalClose: tutorialStep === 'showing-explanation', // Only disable during explanation, NOT during awaiting-modal-close

    // Actions
    startTutorial,
    onAvatarOpened,
    onValueClicked,
    onExplanationClosed,
    onModalClosed,
    onCompassPillsClicked,
    completeTutorial,
    resetTutorial,
  };
}

// Export function to reset tutorial (for use in resetAll())
export function resetDay2Tutorial() {
  localStorage.removeItem(TUTORIAL_STORAGE_KEY);
}
