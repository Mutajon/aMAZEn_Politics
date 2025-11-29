import { useState, useCallback } from 'react';

const TUTORIAL_STORAGE_KEY = 'tutorial_day2_completed';

// Simplified to just 3 tutorial steps + inactive/complete
export type TutorialStep =
  | 'inactive'
  | 'awaiting-avatar'
  | 'awaiting-value'
  | 'awaiting-compass-pills'
  | 'complete';

export function useDay2Tutorial() {
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('inactive');
  const [tutorialCompleted, setTutorialCompleted] = useState<boolean>(() => {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true';
  });

  // Start the tutorial
  const startTutorial = useCallback(() => {
    if (tutorialCompleted) return;
    setTutorialStep('awaiting-avatar');
  }, [tutorialCompleted]);

  // Handle avatar being clicked - advance to awaiting-value after delay
  const onAvatarOpened = useCallback(() => {
    if (tutorialStep === 'awaiting-avatar') {
      setTimeout(() => {
        setTutorialStep('awaiting-value');
      }, 1000);
    }
  }, [tutorialStep]);

  // Handle a value being clicked - user has seen the value details
  const onValueClicked = useCallback(() => {
    // Just record that they clicked, don't advance yet
    // They need to close the modal to advance
  }, []);

  // Handle main modal being closed - advance to compass pills step
  const onModalClosed = useCallback((checkPillsRefReady?: () => boolean) => {
    if (tutorialStep === 'awaiting-value') {
      console.log('[Tutorial] PlayerCardModal closed, polling for pills ref');

      // Poll for pills ref to be ready (max 1000ms)
      let attempts = 0;
      const maxAttempts = 10;

      const pollForRef = () => {
        attempts++;
        const refReady = checkPillsRefReady?.() ?? false;

        if (refReady) {
          console.log(`[Tutorial] Pills ref ready after ${attempts * 100}ms`);
          setTutorialStep('awaiting-compass-pills');
        } else if (attempts < maxAttempts) {
          setTimeout(pollForRef, 100);
        } else {
          console.log('[Tutorial] Pills ref timeout, advancing anyway');
          setTutorialStep('awaiting-compass-pills');
        }
      };

      setTimeout(pollForRef, 100);
    }
  }, [tutorialStep]);

  // Handle compass pills button being clicked - complete tutorial
  const onCompassPillsClicked = useCallback(() => {
    if (tutorialStep === 'awaiting-compass-pills') {
      console.log('[Tutorial] Compass pills clicked, completing tutorial');
      setTutorialStep('complete');
      localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
      setTutorialCompleted(true);
    }
  }, [tutorialStep]);

  // Complete the tutorial manually
  const completeTutorial = useCallback(() => {
    setTutorialStep('complete');
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    setTutorialCompleted(true);
  }, []);

  // Reset tutorial (for testing or full reset)
  const resetTutorial = useCallback(() => {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    setTutorialCompleted(false);
    setTutorialStep('inactive');
  }, []);

  return {
    // State
    tutorialStep,
    tutorialActive: tutorialStep !== 'inactive' && tutorialStep !== 'complete',
    tutorialCompleted,
    shouldShowOverlay:
      tutorialStep === 'awaiting-avatar' ||
      tutorialStep === 'awaiting-value' ||
      tutorialStep === 'awaiting-compass-pills',
    shouldShowValueHighlight: tutorialStep === 'awaiting-value',

    // Actions
    startTutorial,
    onAvatarOpened,
    onValueClicked,
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
