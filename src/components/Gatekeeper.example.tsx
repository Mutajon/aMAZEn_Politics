/**
 * GATEKEEPER COMPONENT USAGE EXAMPLES
 *
 * This file demonstrates how to use the Gatekeeper component for tutorial hints.
 * Copy these examples into your screens where you need tutorial guidance.
 */

import { useState } from 'react';
import Gatekeeper from './Gatekeeper';

// ============================================================================
// EXAMPLE 1: Basic Usage
// ============================================================================

export function BasicExample() {
  const [showHint, setShowHint] = useState(true);

  return (
    <div>
      <h1>Your Game Screen</h1>
      <button onClick={() => setShowHint(true)}>Show Tutorial</button>

      <Gatekeeper
        text="Welcome to the game! Click on any card to make your decision."
        isVisible={showHint}
        onDismiss={() => setShowHint(false)}
      />
    </div>
  );
}

// ============================================================================
// EXAMPLE 2: Custom Typing Speed
// ============================================================================

export function CustomSpeedExample() {
  const [showHint, setShowHint] = useState(true);

  return (
    <Gatekeeper
      text="This message types faster than the default."
      isVisible={showHint}
      onDismiss={() => setShowHint(false)}
      typingSpeed={15} // Faster typing (default: 25ms)
    />
  );
}

// ============================================================================
// EXAMPLE 3: Auto-Close After Typing
// ============================================================================

export function AutoCloseExample() {
  const [showHint, setShowHint] = useState(true);

  return (
    <Gatekeeper
      text="This message will automatically close 3 seconds after typing finishes."
      isVisible={showHint}
      onDismiss={() => {
        setShowHint(false);
        console.log('Gatekeeper auto-closed');
      }}
      autoClose={3000} // Close after 3 seconds
    />
  );
}

// ============================================================================
// EXAMPLE 4: Sequential Tutorial Steps
// ============================================================================

export function SequentialTutorialExample() {
  const [step, setStep] = useState(0);

  const tutorialSteps = [
    "Welcome to the Political Simulation Game!",
    "Your decisions will affect three groups: The People, The Middle Class, and the Powerful Elite.",
    "Watch your resources carefully - if support from any group drops too low, you'll lose power.",
    "Click on action cards to make your decisions. Good luck, leader!",
  ];

  const handleDismiss = () => {
    if (step < tutorialSteps.length - 1) {
      setStep(step + 1); // Move to next step
    } else {
      setStep(-1); // Tutorial complete
    }
  };

  return (
    <Gatekeeper
      text={tutorialSteps[step]}
      isVisible={step >= 0}
      onDismiss={handleDismiss}
    />
  );
}

// ============================================================================
// EXAMPLE 5: Conditional Tutorial (First-Time Users)
// ============================================================================

export function ConditionalTutorialExample() {
  const [showTutorial, setShowTutorial] = useState(() => {
    // Check if user has seen tutorial before
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    return !hasSeenTutorial;
  });

  const handleDismiss = () => {
    setShowTutorial(false);
    localStorage.setItem('hasSeenTutorial', 'true');
  };

  return (
    <Gatekeeper
      text="First time playing? Let me guide you through the basics!"
      isVisible={showTutorial}
      onDismiss={handleDismiss}
    />
  );
}

// ============================================================================
// EXAMPLE 6: Context-Specific Hints
// ============================================================================

export function ContextualHintExample() {
  const [budget, setBudget] = useState(500);
  const [showLowBudgetHint, setShowLowBudgetHint] = useState(false);

  // Show hint when budget gets low
  if (budget < 200 && !showLowBudgetHint) {
    setShowLowBudgetHint(true);
  }

  return (
    <div>
      <p>Budget: {budget}</p>
      <button onClick={() => setBudget(budget - 100)}>Spend 100</button>

      <Gatekeeper
        text="Warning! Your budget is running low. Make careful decisions to avoid bankruptcy."
        isVisible={showLowBudgetHint}
        onDismiss={() => setShowLowBudgetHint(false)}
      />
    </div>
  );
}

// ============================================================================
// INTEGRATION NOTES
// ============================================================================

/*
 * LOGGING:
 * The Gatekeeper component automatically logs three events:
 * - gatekeeper_shown: When the component appears
 * - gatekeeper_typing_skipped: When user clicks during typing
 * - gatekeeper_dismissed: When user closes the component
 *
 * STYLING:
 * All colors and animations are controlled in src/theme/gatekeeperTheme.ts
 * To customize:
 * 1. Edit gatekeeperTheme.ts for global changes
 * 2. Or override via inline styles if needed for specific instances
 *
 * POSITIONING:
 * Component is fixed to bottom-right corner with 24px offset.
 * To change position globally, edit bottomOffset/rightOffset in theme.
 *
 * ACCESSIBILITY:
 * - Component is keyboard accessible (click to skip/dismiss)
 * - Consider adding aria-live region for screen readers
 * - Text should be concise and clear
 */
