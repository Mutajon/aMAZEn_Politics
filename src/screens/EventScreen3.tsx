// src/screens/EventScreen3.tsx
// EventScreen with EventDataCollector → EventDataPresenter → EventDataCleaner architecture
//
// Phase 1: COLLECTING - Fetch all data with loading overlay
// Phase 2: PRESENTING - Sequential presentation of collected data
// Phase 3: INTERACTING - User chooses action
// Phase 4: CLEANING - Process choice, advance day, restart
//
// Uses: useEventDataCollector, presentEventData, buildSupportItems, cleanAndAdvanceDay

import { useEffect, useState, useRef, useMemo } from "react";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { useSettingsStore } from "../store/settingsStore";
import { useCompassStore } from "../store/compassStore";
import { useEventDataCollector } from "../hooks/useEventDataCollector";
import { useEventNarration } from "../hooks/useEventNarration";
import { useNarrator } from "../hooks/useNarrator";
import { useLoadingProgress } from "../hooks/useLoadingProgress";
import { presentEventData, buildSupportItems } from "../lib/eventDataPresenter";
import { cleanAndAdvanceDay } from "../lib/eventDataCleaner";
import CollectorLoadingOverlay from "../components/event/CollectorLoadingOverlay";
import DilemmaLoadError from "../components/event/DilemmaLoadError";
import ResourceBar, { type ResourceBarScoreDetails } from "../components/event/ResourceBar";
import SupportList from "../components/event/SupportList";
import { DynamicParameters, buildDynamicParamsItems } from "../components/event/DynamicParameters";
import DilemmaCard from "../components/event/DilemmaCard";
import MirrorCard from "../components/event/MirrorCard";
import CompassPillsOverlay from "../components/event/CompassPillsOverlay";
import ActionDeck, { type ActionCard } from "../components/event/ActionDeck";
import CrisisWarningBanner, { type CrisisInfo } from "../components/event/CrisisWarningBanner";
import { actionsToDeckCards } from "../components/event/actionVisuals";
import { useCoinFlights, CoinFlightOverlay } from "../components/event/CoinFlightSystem";
import { AnimatePresence } from "framer-motion";
import { bgStyleWithRoleImage } from "../lib/ui";
import { calculateLiveScoreBreakdown } from "../lib/scoring";
import { Building2, Heart, Users } from "lucide-react";
import type { CompassEffectPing } from "../components/MiniCompass";
import { loadEventScreenSnapshot, clearEventScreenSnapshot } from "../lib/eventScreenSnapshot";
import { useLang } from "../i18n/lang";
import { useRoleProgressStore } from "../store/roleProgressStore";
import { POWER_DISTRIBUTION_TRANSLATIONS } from "../data/powerDistributionTranslations";
import { useTimingLogger } from "../hooks/useTimingLogger";
import { useReasoning } from "../hooks/useReasoning";
import { useLogger } from "../hooks/useLogger";
import { useSessionLogger } from "../hooks/useSessionLogger";
import { useNavigationGuard } from "../hooks/useNavigationGuard";
import ReasoningModal from "../components/event/ReasoningModal";
import SelfJudgmentModal from "../components/event/SelfJudgmentModal";
import { useDay2Tutorial } from "../hooks/useDay2Tutorial";
import { TutorialOverlay } from "../components/event/TutorialOverlay";
import MomDeathToast from "../components/event/MomDeathToast";
import { useAftermathPrefetch } from "../hooks/useAftermathPrefetch";

type Props = {
  push: (path: string) => void;
};

export default function EventScreen3({ push }: Props) {
  const lang = useLang();

  // Global state (read only - single source of truth)
  const { day, totalDays, budget, supportPeople, supportMiddle, supportMom, score, crisisMode: storedCrisisMode } = useDilemmaStore();
  const { character, roleBackgroundImage, analysis } = useRoleStore();
  const selectedRoleKey = useRoleStore((s) => s.selectedRole);
  const roleProgress = useRoleProgressStore((s) =>
    selectedRoleKey ? s.goals[selectedRoleKey] ?? null : null
  );
  const showBudget = useSettingsStore((s) => s.showBudget);
  const debugMode = useSettingsStore((s) => s.debugMode);

  // Create role-based background style
  const roleBgStyle = useMemo(() => bgStyleWithRoleImage(roleBackgroundImage), [roleBackgroundImage]);

  // Build crisis information for warning banner
  const crises = useMemo((): CrisisInfo[] => {
    const CRISIS_THRESHOLD = 20;
    const crisisArray: CrisisInfo[] = [];

    if (supportPeople < CRISIS_THRESHOLD) {
      crisisArray.push({
        entity: "The People",
        currentSupport: supportPeople,
        type: "people"
      });
    }

    if (supportMiddle < CRISIS_THRESHOLD) {
      const challengerName = analysis?.challengerSeat?.name || "Power Holders";
      crisisArray.push({
        entity: challengerName,
        currentSupport: supportMiddle,
        type: "challenger"
      });
    }

    if (supportMom < CRISIS_THRESHOLD) {
      crisisArray.push({
        entity: "Personal Anchor",
        currentSupport: supportMom,
        type: "caring"
      });
    }

    return crisisArray;
  }, [supportPeople, supportMiddle, supportMom, analysis]);

  // Data collection (progressive 3-phase loading)
  const {
    collectedData,     // Legacy format (for presenter compatibility)
    isCollecting,
    collectionError,
    collectData,
    isReady,           // Legacy flag (same as phase1Ready now)
    registerOnReady,   // Callback registration for progress notification
    restoreCollectedData // Restore from snapshot
  } = useEventDataCollector();

  // Narration integration - prepares TTS when dilemma loads, provides canShowDilemma flag
  const { canShowDilemma, startNarrationIfReady, speaking } = useEventNarration();

  // Global narration stop (for stopping audio when navigating away or opening modals)
  const { stop: stopNarration } = useNarrator();

  // Loading progress (auto-increments, smooth catchup animation)
  const { progress, start: startProgress, reset: resetProgress, notifyReady } = useLoadingProgress();

  // Phase tracking
  const [phase, setPhase] = useState<'collecting' | 'presenting' | 'interacting' | 'reasoning' | 'confirming'>('collecting');

  // Presentation step tracking (controls what's visible)
  const [presentationStep, setPresentationStep] = useState<number>(-1);

  // Initial support values (captured at Step 1 BEFORE Step 2 applies deltas)
  // Used as animation baseline so counter animates from old→new (e.g., 50→35 on Day 2)
  const [initialSupportValues, setInitialSupportValues] = useState<{
    people: number;
    middle: number;
    mom: number;
  } | null>(null);

  // Coin flight system (persists across all phases)
  const { flights, triggerCoinFlight, clearFlights } = useCoinFlights();

  // Data logging hooks (Timing, Player actions, Session lifecycle)
  // Note: State change tracking is handled globally in App.tsx via useStateChangeLogger
  // Note: AI output logging is handled in useEventDataCollector.ts at the source
  const timingLogger = useTimingLogger();
  const logger = useLogger();
  const sessionLogger = useSessionLogger();

  // Reasoning feature (treatment-based)
  const reasoning = useReasoning();
  const [showReasoningModal, setShowReasoningModal] = useState(false);
  const [reasoningModalAction, setReasoningModalAction] = useState<ActionCard | null>(null);
  const [isSubmittingReasoning, setIsSubmittingReasoning] = useState(false);
  const reasoningResolveRef = useRef<(() => void) | null>(null);
  const addReasoningEntry = useDilemmaStore((s) => s.addReasoningEntry);

  // Self-judgment modal (Day 8 only)
  const [showSelfJudgmentModal, setShowSelfJudgmentModal] = useState(false);

  // Aftermath prefetch (triggered when Day 8 modal opens)
  const { startPrefetch: startAftermathPrefetch } = useAftermathPrefetch();

  // Tutorial system (Day 2 only)
  const tutorial = useDay2Tutorial();
  const [tutorialAvatarRef, setTutorialAvatarRef] = useState<HTMLElement | null>(null);
  const [tutorialValueRef, setTutorialValueRef] = useState<HTMLElement | null>(null);
  const [tutorialPillsRef, setTutorialPillsRef] = useState<HTMLElement | null>(null);
  const [narrationWasPlaying, setNarrationWasPlaying] = useState(false);

  // Debug: Log when tutorial value ref is set
  useEffect(() => {
    if (tutorialValueRef && day === 2) {
      console.log('[EventScreen3] Tutorial value ref set:', tutorialValueRef);
    }
  }, [tutorialValueRef, day]);

  // Debug: Log when tutorial pills ref is set
  useEffect(() => {
    if (tutorialPillsRef && day === 2) {
      console.log('[EventScreen3] Tutorial pills ref set:', tutorialPillsRef);
    }
  }, [tutorialPillsRef, day]);

  // Navigation guard - prevent back button during gameplay
  useNavigationGuard({
    enabled: true,
    confirmationMessage: lang("CONFIRM_EXIT_GAMEPLAY"),
    screenName: "event_screen"
  });

  // Timing tracker: time from dilemma presented to action confirmed
  const decisionTimingIdRef = useRef<string | null>(null);

  // Compass pills state (for visual display during Step 4A)
  const [showCompassPills, setShowCompassPills] = useState(false);

  // Snapshot restoration flag (prevents collection when restored)
  const [restoredFromSnapshot, setRestoredFromSnapshot] = useState(false);

  // Read pending compass pills from dilemmaStore (set by cleaner after action confirmation)
  // NOTE: Pills are now applied in eventDataCleaner.ts BEFORE day advances,
  // not during next day's presentation. This fixes the one-day delay issue.
  const pendingCompassPills = useDilemmaStore((s) => s.pendingCompassPills);

  // Convert pending pills to CompassEffectPing format with unique IDs
  const compassPings: CompassEffectPing[] = useMemo(() => {
    if (!pendingCompassPills) return [];
    const pills = pendingCompassPills.map((pill, i) => ({
      id: `${Date.now()}-${i}`,
      prop: pill.prop,
      idx: pill.idx,
      delta: pill.delta
    }));
    if (pills.length > 0) {
      console.log(`[EventScreen3] 💊 CompassPings populated: ${pills.length} pills`, pills);
    }
    return pills;
  }, [pendingCompassPills]);

  const scoreDetails: ResourceBarScoreDetails = useMemo(() => {
    const breakdown = calculateLiveScoreBreakdown({
      supportPeople,
      supportMiddle,
      supportMom,
    });

    // Helper function to translate challenger seat name
    const translateChallengerName = (name: string): string => {
      // Check all predefined role translations for a matching holder name
      for (const roleTranslations of Object.values(POWER_DISTRIBUTION_TRANSLATIONS)) {
        const holderTranslation = roleTranslations.holders[name];
        if (holderTranslation) {
          return lang(holderTranslation.name);
        }
      }
      // If no translation found, return name as-is (for AI-generated roles)
      return name;
    };

    const middleLabel = analysis?.challengerSeat?.name
      ? translateChallengerName(analysis.challengerSeat.name)
      : lang("FINAL_SCORE_POWER_HOLDERS_SUPPORT");

    return {
      total: breakdown.final,
      maxTotal: breakdown.maxFinal,
      components: [
        {
          id: "people" as const,
          label: lang("FINAL_SCORE_PUBLIC_SUPPORT"),
          valueLabel: `${breakdown.support.people.percent}%`,
          points: breakdown.support.people.points,
          maxPoints: breakdown.support.people.maxPoints,
        },
        {
          id: "middle" as const,
          label: middleLabel,
          valueLabel: `${breakdown.support.middle.percent}%`,
          points: breakdown.support.middle.points,
          maxPoints: breakdown.support.middle.maxPoints,
        },
        {
          id: "mom" as const,
          label: lang("FINAL_SCORE_MOM_SUPPORT"),
          valueLabel: `${breakdown.support.mom.percent}%`,
          points: breakdown.support.mom.points,
          maxPoints: breakdown.support.mom.maxPoints,
        },
      ],
    } as const;
  }, [
    supportPeople,
    supportMiddle,
    supportMom,
    analysis?.challengerSeat?.name,
    lang,
  ]);

  // ========================================================================
  // EFFECT 0A: Restore from snapshot if available (runs once on mount)
  // ========================================================================
  useEffect(() => {
    if (restoredFromSnapshot) return; // Already restored

    const snapshot = loadEventScreenSnapshot();
    if (snapshot) {
      console.log('[EventScreen3] 📸 Restoring from snapshot');

      // Restore phase and presentation state
      setPhase(snapshot.phase);
      setPresentationStep(snapshot.presentationStep);

      // Restore collected data through collector
      restoreCollectedData(snapshot.collectedData);

      // Clear snapshot (one-time use)
      clearEventScreenSnapshot();

      // Mark as restored
      setRestoredFromSnapshot(true);

      // Notify progress system that we're ready
      notifyReady();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // ========================================================================
  // EFFECT 0B: Register progress callback with data collector
  // ========================================================================
  useEffect(() => {
    registerOnReady(() => {
      notifyReady();
    });
  }, [registerOnReady, notifyReady]);

  // ========================================================================
  // EFFECT 0C: Start session timing on first mount (not on snapshot restore)
  // Session timing: EventScreen first load → AftermathScreen load
  // ========================================================================
  const sessionStartedRef = useRef(false);

  useEffect(() => {
    // Only start session once, and only if NOT restored from snapshot
    if (!sessionStartedRef.current && !restoredFromSnapshot) {
      const { selectedRole } = useRoleStore.getState();
      const { character } = useRoleStore.getState();

      sessionLogger.start({
        role: selectedRole || 'Unknown',
        playerName: character?.name || 'Unknown',
        day,
        totalDays
      });

      sessionStartedRef.current = true;
      console.log('[EventScreen3] ⏱️ Session timing started');
    }
  }, [restoredFromSnapshot, day, totalDays, sessionLogger]);

  // ========================================================================
  // EFFECT 1: Trigger collection when phase changes TO 'collecting'
  // Uses a ref to track if we've already collected for this phase cycle
  // ========================================================================
  const collectionTriggeredRef = useRef(false);
  const lastCollectedDayRef = useRef<number>(0);

  useEffect(() => {
    // Skip collection if restored from snapshot
    if (restoredFromSnapshot) return;

    if (phase === 'collecting') {
      // Reset ref if we're on a new day
      if (day !== lastCollectedDayRef.current) {
        collectionTriggeredRef.current = false;
        lastCollectedDayRef.current = day;
        resetProgress();
        startProgress();
      }

      // Only trigger if we haven't already triggered for this day
      if (!collectionTriggeredRef.current && !isCollecting && !collectionError) {
        collectionTriggeredRef.current = true;
        collectData();
      }
    } else {
      // Reset flag when leaving collecting phase
      collectionTriggeredRef.current = false;
    }
  }, [phase, isCollecting, collectionError, day, collectData, startProgress, resetProgress, restoredFromSnapshot]);

  // ========================================================================
  // EFFECT 2: Capture and clear initial support values for animation
  // ========================================================================
  useEffect(() => {
    // Capture at Step 1 (before Step 2 applies deltas)
    if (presentationStep === 1 && !initialSupportValues) {
      const { supportPeople, supportMiddle, supportMom } = useDilemmaStore.getState();
      setInitialSupportValues({
        people: supportPeople,
        middle: supportMiddle,
        mom: supportMom
      });
    }

    // Clear after Step 2 completes (at Step 3+) so animation doesn't reset
    if (presentationStep >= 3 && initialSupportValues) {
      setInitialSupportValues(null);
    }
  }, [presentationStep, initialSupportValues]);

  // ========================================================================
  // EFFECT 2A: Log AI outputs when collected data arrives
  // ========================================================================
  // REMOVED: Logging moved to useEventDataCollector.ts to prevent duplicates
  // AI outputs are now logged ONCE at the source when data is fetched
  //
  // NOTE: Compass pills logging removed - no longer tracking compass pill events

  // ========================================================================
  // EFFECT 3: Advance to presenting when data ready
  // ========================================================================
  useEffect(() => {
    // Skip presentation if restored from snapshot
    if (restoredFromSnapshot) return;

    if (isReady && canShowDilemma && !isCollecting && phase === 'collecting' && collectedData) {
      setPhase('presenting');

      // Run presentation sequence with narration callback
      presentEventData(
        collectedData,
        setPresentationStep,
        () => startNarrationIfReady(true) // Trigger narration when dilemma card is revealed
      )
        .then(() => {
          setPhase('interacting');
        })
        .catch(error => {
          console.error('[EventScreen3] ❌ Presentation error:', error);
        });
    }
  }, [isReady, canShowDilemma, isCollecting, phase, collectedData, startNarrationIfReady, setPresentationStep, restoredFromSnapshot]);

  // ========================================================================
  // EFFECT 3A: Start timing when entering interacting phase
  // ========================================================================
  useEffect(() => {
    if (phase === 'interacting' && !decisionTimingIdRef.current) {
      // Start timing decision
      decisionTimingIdRef.current = timingLogger.start('decision_time', {
        day,
        dilemmaTitle: collectedData?.dilemma?.title
      });
      console.log('[EventScreen3] ⏱️ Decision timing started');
    }
  }, [phase, day, collectedData?.dilemma?.title, timingLogger]);

  // ========================================================================
  // EFFECT 4: Control compass pills visibility (data-based, not step-based)
  // Pills show during interacting phase when they arrive (Phase 2 completes async)
  // ========================================================================
  useEffect(() => {
    // Show pills when we're interacting AND pills data exists AND it's Day 2+
    const shouldShow = phase === 'interacting' && compassPings.length > 0 && day > 1;

    if (shouldShow !== showCompassPills) {
      console.log(`[EventScreen3] 💊 Pills visibility: ${shouldShow} (phase: ${phase}, day: ${day}, pills: ${compassPings.length})`);
      setShowCompassPills(shouldShow);
    }
  }, [phase, day, compassPings.length, showCompassPills]);

  // ========================================================================
  // EFFECT 5A: Track when narration starts playing (for tutorial timing)
  // ========================================================================
  useEffect(() => {
    if (speaking && day === 2) {
      setNarrationWasPlaying(true);
    }
  }, [speaking, day]);

  // ========================================================================
  // EFFECT 5B: Trigger Day 2 tutorial when narration completes OR times out
  // ========================================================================
  useEffect(() => {
    if (day === 2 && phase === 'interacting' && !tutorial.tutorialCompleted) {
      // If narration completed normally
      const narrationComplete = narrationWasPlaying && !speaking;

      if (narrationComplete) {
        const timer = setTimeout(() => {
          console.log('[EventScreen3] 🎓 Starting Day 2 tutorial (narration complete)');
          tutorial.startTutorial();
        }, 500);
        return () => clearTimeout(timer);
      }

      // Fallback: If narration hasn't started after 3 seconds, start tutorial anyway
      // This handles: disabled narration, TTS errors, credit exhausted, etc.
      if (!narrationWasPlaying) {
        const fallbackTimer = setTimeout(() => {
          console.log('[EventScreen3] 🎓 Starting Day 2 tutorial (narration fallback - TTS may have failed or be disabled)');
          tutorial.startTutorial();
        }, 3000);
        return () => clearTimeout(fallbackTimer);
      }
    }
  }, [day, phase, narrationWasPlaying, speaking, tutorial.tutorialCompleted, tutorial.startTutorial]);

  // ========================================================================
  // EFFECT 6: Redirect to downfall screen when terminal crisis occurs
  // ========================================================================
  useEffect(() => {
    // Check if game ended with downfall crisis (all 3 tracks < 20%)
    const isGameEnd = collectedData?.dilemma?.isGameEnd;

    if (isGameEnd && storedCrisisMode === "downfall" && phase === 'interacting') {
      console.log('[EventScreen3] 🚨 DOWNFALL DETECTED - Redirecting to downfall screen');
      push('/downfall');
    }
  }, [collectedData, storedCrisisMode, phase, push]);

  // ========================================================================
  // ACTION HANDLERS
  // ========================================================================

  /**
   * Show reasoning modal and wait for completion
   */
  const showReasoningModalForAction = (actionCard: ActionCard): Promise<void> => {
    return new Promise((resolve) => {
      reasoningResolveRef.current = resolve;
      setReasoningModalAction(actionCard);
      setShowReasoningModal(true);
    });
  };

  /**
   * Handle reasoning submission - analyzes reasoning text with compass API
   */
  const handleReasoningSubmit = async (reasoningText: string): Promise<{ pills: any[]; message: string } | null> => {
    if (!reasoningModalAction) return null;

    setIsSubmittingReasoning(true);

    try {
      // Get current game and dilemma context
      const gameId = useDilemmaStore.getState().gameId;
      const dilemma = collectedData?.dilemma;

      if (!gameId || !dilemma) {
        console.error('[EventScreen3] Missing gameId or dilemma for reasoning analysis');
        return null;
      }

      // Log analysis start
      logger.log('reasoning_compass_analysis_started', {
        day,
        actionId: reasoningModalAction.id,
        reasoningLength: reasoningText.length,
        wordCount: reasoningText.split(/\s+/).length
      }, 'Starting reasoning compass analysis');

      // Build trap context for value-aware analysis
      const trapContext = collectedData?.valueTargeted ? {
        valueTargeted: collectedData.valueTargeted,
        dilemmaTitle: dilemma.title,
        dilemmaDescription: dilemma.description
      } : undefined;

      // Call compass conversation API for reasoning analysis
      const response = await fetch('/api/compass-conversation/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          action: {
            title: dilemma.title,
            summary: dilemma.description
          },
          reasoning: {
            text: reasoningText,
            selectedAction: reasoningModalAction.title
          },
          gameContext: {
            setting: useRoleStore.getState().roleIntro?.split('.')[0] || 'Unknown setting',
            role: useRoleStore.getState().roleScope,
            systemName: useRoleStore.getState().analysis?.systemName || 'Unknown system'
          },
          trapContext,  // NEW: Include trap context for value-aware analysis
          debugMode
        })
      });

      if (!response.ok) {
        throw new Error(`Compass analysis failed (${response.status})`);
      }

      const data = await response.json();
      const hints = data.compassHints || [];

      // Convert hints to CompassPill format
      const pills = hints.map((hint: any) => ({
        prop: hint.prop,
        idx: hint.idx,
        delta: hint.polarity
      }));

      // Update compass store with new values
      const compassStore = useCompassStore.getState();
      pills.forEach((pill: any) => {
        const currentValue = compassStore.values[pill.prop][pill.idx];
        const newValue = Math.max(0, Math.min(10, currentValue + pill.delta));
        compassStore.setValue(pill.prop, pill.idx, newValue);
      });

      // Store reasoning entry in dilemmaStore
      addReasoningEntry({
        day,
        actionId: reasoningModalAction.id,
        actionTitle: reasoningModalAction.title,
        actionDescription: reasoningModalAction.summary,
        reasoningText,
      });

      // Log successful analysis
      logger.log('reasoning_compass_analysis_completed', {
        day,
        actionId: reasoningModalAction.id,
        pillsCount: pills.length,
        dimensions: pills.map((p: any) => `${p.prop}:${p.idx}`),
        entryCount: useDilemmaStore.getState().reasoningHistory.length,
        hasMirrorMessage: !!data.mirrorMessage
      }, `Reasoning compass analysis completed with ${pills.length} pills`);

      // Use AI-generated mirror message if available, otherwise fallback to random pre-made
      let mirrorMessage = data.mirrorMessage;
      if (!mirrorMessage) {
        // Fallback pool of pre-made whimsical messages
        const fallbackMessages = [
          "Ah, thank you—your thought now curls up nicely in my collection.",
          "Gratitude, traveler. I've tucked your thought among the others.",
          "Thank you. Your thought has found its shelf in my curious archive.",
          "Much obliged—your thought now wanders my halls with the rest.",
          "I appreciate the offering; your thought has joined my growing hoard.",
          "Thank you. Another thought slips into my vault of oddities.",
          "My thanks—your thought is now bottled and labeled accordingly.",
          "Cheers, wanderer. Your thought now chatters with its new neighbors.",
          "Thank you. I've added your thought to the maze—may it not get lost.",
          "Grateful, I am. Your thought now hums quietly in my collection."
        ];
        mirrorMessage = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
        console.log('[EventScreen3] 🪞 Using fallback mirror message (no AI message received)');
      } else {
        console.log('[EventScreen3] 🪞 Using AI-generated mirror message');
      }

      setIsSubmittingReasoning(false);

      // Return pills and message for modal to display
      return { pills, message: mirrorMessage };

    } catch (error) {
      console.error('[EventScreen3] Reasoning compass analysis failed:', error);

      // Log error
      logger.log('reasoning_compass_analysis_failed', {
        day,
        actionId: reasoningModalAction.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Reasoning compass analysis failed');

      // Still store reasoning entry even if analysis fails
      addReasoningEntry({
        day,
        actionId: reasoningModalAction.id,
        actionTitle: reasoningModalAction.title,
        actionDescription: reasoningModalAction.summary,
        reasoningText,
      });

      setIsSubmittingReasoning(false);

      // Return null to indicate failure (modal will show fallback message)
      return null;
    }
  };

  /**
   * Handle reasoning skip (optional prompts only)
   */
  const handleReasoningSkip = () => {
    setShowReasoningModal(false);
    setReasoningModalAction(null);

    // Resolve the promise to continue game flow
    if (reasoningResolveRef.current) {
      reasoningResolveRef.current();
      reasoningResolveRef.current = null;
    }
  };

  /**
   * Handle reasoning modal close - called after pills are shown and user clicks Close
   */
  const handleReasoningClose = () => {
    setShowReasoningModal(false);
    setReasoningModalAction(null);

    // Resolve the promise to continue game flow
    if (reasoningResolveRef.current) {
      reasoningResolveRef.current();
      reasoningResolveRef.current = null;
    }
  };

  /**
   * Handle action confirmation - delegates ALL logic to EventDataCleaner
   */
  const handleConfirm = async (id: string) => {
    // Track choice for tutorial (Day 2 only)
    if (day === 2 && !tutorial.tutorialCompleted) {
      tutorial.onChoiceMade();
    }

    // Set phase to confirming immediately to show loading overlay
    setPhase('confirming');

    // Find the action card
    const actionsForDeck = collectedData?.dilemma
      ? actionsToDeckCards(collectedData.dilemma.actions)
      : [];
    const actionCard = actionsForDeck.find(a => a.id === id);

    if (!actionCard) {
      console.error('[EventScreen3] ❌ Action not found:', id);
      return;
    }

    console.log('[EventScreen3] ✅ Action confirmed:', actionCard.title);

    // End decision timing and store in dilemmaStore
    if (decisionTimingIdRef.current) {
      const duration = timingLogger.end(decisionTimingIdRef.current, {
        day,
        actionId: actionCard.id,
        actionTitle: actionCard.title,
        actionCost: actionCard.cost,
        wasCustomAction: false
      });
      console.log(`[EventScreen3] ⏱️ Decision time: ${duration}ms`);

      // Store decision time for session summary
      const { addDecisionTime } = useDilemmaStore.getState();
      addDecisionTime(duration);

      decisionTimingIdRef.current = null;
    }

    // Check if reasoning is required for this day
    const shouldShowReasoning = reasoning.shouldShowReasoning();

    if (shouldShowReasoning) {
      console.log('[EventScreen3] 💭 Reasoning required - temporarily hiding loading for modal');

      // Temporarily hide loading overlay by switching to reasoning phase
      setPhase('reasoning');

      // Show reasoning modal and wait for completion
      await showReasoningModalForAction(actionCard);

      console.log('[EventScreen3] ✅ Reasoning complete - resuming loading overlay');

      // Return to confirming phase to show loading overlay again
      setPhase('confirming');
    }

    // Keep phase as 'confirming' during cleanup (loading overlay stays visible)
    console.log('[EventScreen3] 🔄 Starting cleanup with loading overlay visible...');

    // Build trap context for value-aware compass analysis
    const trapContext = collectedData?.valueTargeted && collectedData?.dilemma ? {
      valueTargeted: collectedData.valueTargeted,
      dilemmaTitle: collectedData.dilemma.title,
      dilemmaDescription: collectedData.dilemma.description
    } : undefined;

    // Run cleaner (handles: save choice, update budget, coin animation, advance day)
    await cleanAndAdvanceDay(actionCard, clearFlights, trapContext);

    // After cleaning complete, reset to collecting phase for next day
    setPhase('collecting');
    setPresentationStep(-1);
    setInitialSupportValues(null); // Clear for next day
    // Collection will be triggered by effect watching phase/day
  };

  /**
   * Handle custom action suggestion
   */
  const handleSuggest = async (text?: string) => {
    // Set phase to confirming immediately to show loading overlay
    setPhase('confirming');

    if (!text || !text.trim()) {
      console.warn('[EventScreen3] ❌ handleSuggest called with empty text');
      return;
    }

    console.log('[EventScreen3] 💡 Processing custom suggestion:', text);

    // End decision timing (custom action confirmed) and store in dilemmaStore
    if (decisionTimingIdRef.current) {
      const duration = timingLogger.end(decisionTimingIdRef.current, {
        day,
        actionId: 'suggest',
        actionTitle: text.trim(),
        actionLength: text.trim().length,
        wasCustomAction: true
      });
      console.log(`[EventScreen3] ⏱️ Decision time (custom): ${duration}ms`);

      // Store decision time for session summary
      const { addDecisionTime } = useDilemmaStore.getState();
      addDecisionTime(duration);

      decisionTimingIdRef.current = null;
    }

    // Track custom action for goals system
    const { incrementCustomActions } = useDilemmaStore.getState();
    incrementCustomActions();
    console.log('[EventScreen3] 📊 Custom action tracked for goals');

    // Convert suggestion to ActionCard format (same as regular actions)
    // This allows cleanAndAdvanceDay to process it uniformly
    const suggestCost = -300; // Default suggestion cost from ActionDeck
    const suggestionCard: ActionCard = {
      id: 'suggest',
      title: text.trim(),
      summary: '', // No summary for custom suggestions
      cost: suggestCost,
      icon: null as any, // Not used by cleaner
      iconBgClass: '',
      iconTextClass: '',
      cardGradientClass: ''
    };

    // Check if reasoning is required for this day
    const shouldShowReasoning = reasoning.shouldShowReasoning();

    if (shouldShowReasoning) {
      console.log('[EventScreen3] 💭 Reasoning required - temporarily hiding loading for modal');

      // Temporarily hide loading overlay by switching to reasoning phase
      setPhase('reasoning');

      // Show reasoning modal and wait for completion
      await showReasoningModalForAction(suggestionCard);

      console.log('[EventScreen3] ✅ Reasoning complete - resuming loading overlay');

      // Return to confirming phase to show loading overlay again
      setPhase('confirming');
    }

    // Keep phase as 'confirming' during cleanup (loading overlay stays visible)
    console.log('[EventScreen3] 🔄 Starting cleanup with loading overlay visible...');

    // Build trap context for value-aware compass analysis (same as regular actions)
    const trapContext = collectedData?.valueTargeted && collectedData?.dilemma ? {
      valueTargeted: collectedData.valueTargeted,
      dilemmaTitle: collectedData.dilemma.title,
      dilemmaDescription: collectedData.dilemma.description
    } : undefined;

    // Run cleaner (handles: save choice, update budget, wait for animation, advance day)
    await cleanAndAdvanceDay(suggestionCard, clearFlights, trapContext);

    // After cleaning complete, reset to collecting phase for next day
    setPhase('collecting');
    setPresentationStep(-1);
    setInitialSupportValues(null); // Clear for next day
    // Collection will be triggered by effect watching phase/day
  };

  /**
   * Debug: Jump to final day (day 7) with random previous choice
   * Useful for testing epic finale and game conclusion
   */
  const jumpToFinalDay = () => {
    const actions = collectedData?.dilemma?.actions || [];

    let choiceData;
    if (actions.length === 0) {
      // Full autonomy mode or no actions - create mock action
      console.log('[EventScreen3] 🚀 Jumping to final day (debug mode - mock action)');
      choiceData = {
        id: 'debug_mock' as 'a' | 'b' | 'c',
        title: '[Debug Jump] Custom Action',
        summary: 'Mock action created by debug tool',
        cost: 0
      };
    } else {
      // Normal mode - pick random action
      const randomIndex = Math.floor(Math.random() * actions.length);
      const randomAction = actions[randomIndex];
      console.log('[EventScreen3] 🚀 Jumping to final day with random choice:', randomAction.title);
      choiceData = {
        id: randomAction.id as 'a' | 'b' | 'c',
        title: randomAction.title,
        summary: randomAction.summary,
        cost: randomAction.cost
      };
    }

    // Save this as last choice
    const { setLastChoice, setBudget } = useDilemmaStore.getState();
    setLastChoice(choiceData);

    // Apply budget change immediately (so it's reflected in the context)
    const currentBudget = useDilemmaStore.getState().budget;
    setBudget(currentBudget + choiceData.cost);

    // Set day to 7 directly (daysLeft will be 1)
    useDilemmaStore.setState({ day: 7 });

    // Reset phase to trigger fresh collection for day 7
    setPhase('collecting');
    setPresentationStep(-1);
    setInitialSupportValues(null);
  };

  /**
   * Handle navigation to Mirror Screen with state preservation
   * TEMPORARILY DISABLED - navigation bugs prevent safe return
   */
  // const handleNavigateToMirror = () => {
  //   if (!collectedData) {
  //     console.warn('[EventScreen3] Cannot navigate to mirror - no collected data');
  //     return;
  //   }
  //
  //   // Save snapshot before navigation
  //   saveEventScreenSnapshot({
  //     phase,
  //     presentationStep,
  //     collectedData,
  //     timestamp: Date.now()
  //   });
  //
  //   console.log('[EventScreen3] 📸 Snapshot saved, navigating to /mirror');
  //   push('/mirror');
  // };

  // ========================================================================
  // RENDER: Loading State (confirming or collecting phase)
  // ========================================================================
  // Don't show loading overlay if we're restoring from snapshot
  if ((phase === 'confirming' || phase === 'collecting' || isCollecting) && !restoredFromSnapshot) {
    return (
      <AnimatePresence mode="wait">
        <CollectorLoadingOverlay
          key="loading-overlay"
          progress={progress} // Real-time progress with auto-increment and catchup animation
          message={lang("GATHERING_INTELLIGENCE")}
        />
      </AnimatePresence>
    );
  }

  // ========================================================================
  // RENDER: Error State (AI generation failed after retries)
  // ========================================================================
  if (collectionError) {
    return (
      <DilemmaLoadError
        error={collectionError}
        onStartNew={() => push('/role-selection')}
        onRetry={() => {
          // Retry data collection without clearing state
          collectData();
        }}
      />
    );
  }

  // ========================================================================
  // RENDER: Presenting/Interacting/Reasoning Phase
  // ========================================================================
  if (collectedData && (phase === 'presenting' || phase === 'interacting' || phase === 'reasoning')) {
    // Calculate derived values
    const daysLeft = totalDays - day + 1;

    // Game end detection - use backend's isGameEnd flag (not actions length)
    // Note: Empty actions are normal in fullAutonomy mode, but that doesn't mean game end
    const isGameEnd = collectedData.dilemma.isGameEnd === true;

    // Build support items with deltas and initial values for animation
    const rawSupportItems = buildSupportItems(presentationStep, collectedData, initialSupportValues);

    // Add icons to support items
    const supportItems = rawSupportItems.map(item => ({
      ...item,
      icon: item.id === 'people'
        ? <Users className="w-4 h-4" />
        : item.id === 'middle'
        ? <Building2 className="w-4 h-4" />
        : <Heart className="w-4 h-4" />
    }));

    // Build action cards
    const actionsForDeck: ActionCard[] = collectedData.dilemma
      ? actionsToDeckCards(collectedData.dilemma.actions)
      : [];

    // Build parameter items from dynamic parameters
    const isFirstDay = day === 1;
    const parameterItems = buildDynamicParamsItems(
      collectedData?.dynamicParams || null,
      isFirstDay
    );

    return (
      <div className="min-h-screen p-4 pb-20 md:p-6 md:pb-24" style={roleBgStyle}>
        {/* Toast notification for mom death */}
        <MomDeathToast />

        {/* Debug: Jump to Final Day button */}
        {debugMode && day < 7 && phase === 'interacting' && (
          <button
            onClick={jumpToFinalDay}
            className="fixed top-4 right-4 px-3 py-2 text-xs bg-red-900/80 border border-red-500/50 text-red-200 rounded hover:bg-red-800/80 transition-colors z-50"
            title={lang("DEBUG_SKIP_TO_FINAL")}
          >
            {lang("JUMP_TO_FINAL_DAY")}
          </button>
        )}

        <div className="max-w-3xl mx-auto space-y-2 md:space-y-3">
          {/* Step 0+: ResourceBar (always visible) */}
          {presentationStep >= 0 && (
            <ResourceBar
              budget={budget}
              daysLeft={daysLeft}
              showBudget={showBudget}
              scoreGoal={roleProgress?.goal ?? null}
              goalStatus={roleProgress?.status ?? "uncompleted"}
              score={score}
              scoreDetails={scoreDetails}
              avatarSrc={character?.avatarUrl || null}
              tutorialMode={tutorial.tutorialActive}
              onTutorialAvatarClick={tutorial.onAvatarOpened}
              onTutorialValueClick={tutorial.onValueClicked}
              onTutorialModalClose={() => {
                setTutorialValueRef(null);
                tutorial.onModalClosed(() => tutorialPillsRef !== null);
              }}
              tutorialValueRef={(el) => setTutorialValueRef(el)}
              avatarButtonRef={(el) => setTutorialAvatarRef(el)}
            />
          )}

          {/* Step 1+: SupportList */}
          {presentationStep >= 1 && (
            <SupportList items={supportItems} />
          )}

          {/* Step 3+: DynamicParameters - Shows 1-3 narrative impacts with emoji (Day 2+ only) */}
          {presentationStep >= 3 && day >= 2 && (
            <DynamicParameters items={parameterItems} />
          )}

          {/* Crisis Warning Banner (only during presenting/interacting phases, if any crises exist) */}
          {(phase === 'presenting' || phase === 'interacting') && crises.length > 0 && presentationStep >= 4 && (
            <CrisisWarningBanner
              crises={crises}
              autoDismiss={true}
            />
          )}

          {/* Step 4+: DilemmaCard OR Aftermath (game ending) */}
          {presentationStep >= 4 && collectedData && (
            <>
              {isGameEnd ? (
                // Game conclusion - show aftermath card
                <div className="bg-gray-900/70 backdrop-blur-sm border border-amber-500/30 rounded-lg p-6 shadow-xl">
                  <h2 className="text-2xl font-bold text-amber-400 mb-4">
                    {lang("THE_LAST_DAY")}
                  </h2>
                  <p className="text-lg text-gray-200 leading-relaxed mb-6 whitespace-pre-wrap">
                    {collectedData.dilemma.description}
                  </p>
                  {phase === 'interacting' && (
                    <button
                      onClick={() => {
                        stopNarration(); // Stop any playing narration before opening modal
                        startAftermathPrefetch(); // Start fetching aftermath data in background
                        setShowSelfJudgmentModal(true);
                      }}
                      className="w-full px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-amber-500/50"
                    >
                      View Aftermath
                    </button>
                  )}
                </div>
              ) : (
                // Normal dilemma card
                <DilemmaCard
                  title={collectedData.dilemma.title}
                  description={collectedData.dilemma.description}
                  speaker={collectedData.dilemma.speaker}
                  speakerDescription={collectedData.dilemma.speakerDescription}
                />
              )}
            </>
          )}

          {/* Step 5+: MirrorCard with Compass Pills Overlay (skip if game end) */}
          {!isGameEnd && presentationStep >= 5 && collectedData && (
            <div className="relative">
              <MirrorCard
                text={collectedData.mirrorText}
                avatarUrl={character?.avatarUrl}
                // onExploreClick temporarily removed - navigation bugs prevent safe return to EventScreen
              />
              {/* Compass Pills Overlay - appears at Step 4A (Day 2+) */}
              {showCompassPills && (
                <CompassPillsOverlay
                  effectPills={compassPings}
                  loading={false}
                  color="#7de8ff"
                  tutorialMode={tutorial.tutorialActive && tutorial.tutorialStep === 'awaiting-compass-pills'}
                  tutorialPillsButtonRef={(el) => setTutorialPillsRef(el)}
                  onTutorialPillsClick={tutorial.onCompassPillsClicked}
                  forceCollapse={tutorial.tutorialStep === 'awaiting-compass-pills'}
                />
              )}
            </div>
          )}

          {/* Step 6: ActionDeck (skip if game end) */}
          {!isGameEnd && presentationStep >= 6 && phase === 'interacting' && (
            <ActionDeck
              actions={actionsForDeck}
              showBudget={showBudget}
              budget={budget}
              onConfirm={handleConfirm}
              onSuggest={handleSuggest}
              triggerCoinFlight={triggerCoinFlight}
              dilemma={{
                title: collectedData.dilemma.title,
                description: collectedData.dilemma.description
              }}
            />
          )}
        </div>

        {/* Coin Flight Overlay - portal-based, persists across all phases */}
        <AnimatePresence>
          {flights.length > 0 && (
            <CoinFlightOverlay
              flights={flights}
              onAllDone={clearFlights}
            />
          )}
        </AnimatePresence>

        {/* Reasoning Modal - appears after action confirmation (treatment-based) */}
        {reasoningModalAction && collectedData && (
          <ReasoningModal
            isOpen={showReasoningModal}
            onClose={handleReasoningClose}
            onSubmit={handleReasoningSubmit}
            onSkip={reasoning.isOptional() ? handleReasoningSkip : undefined}
            actionTitle={reasoningModalAction.title}
            actionSummary={reasoningModalAction.summary}
            day={day}
            isOptional={reasoning.isOptional()}
            isSubmitting={isSubmittingReasoning}
            avatarUrl={character?.avatarUrl}
          />
        )}

        {/* Self-Judgment Modal - appears on Day 8 before aftermath */}
        <SelfJudgmentModal
          isOpen={showSelfJudgmentModal}
          onClose={() => setShowSelfJudgmentModal(false)}
          onSubmit={(judgment) => {
            // Store judgment in dilemmaStore
            useDilemmaStore.getState().addSelfJudgment(judgment);

            // Log self-judgment selection
            logger.log(
              'self_judgment_selected',
              {
                day: 8,
                judgment,
              },
              `Player selected self-judgment: ${judgment}`
            );

            // Navigate to aftermath
            push('/aftermath');
          }}
        />

        {/* Tutorial Overlay - Day 2 only */}
        {tutorial.shouldShowOverlay && (
          <TutorialOverlay
            step={tutorial.tutorialStep}
            targetElement={
              tutorial.tutorialStep === 'awaiting-avatar'
                ? tutorialAvatarRef
                : tutorial.tutorialStep === 'awaiting-compass-pills'
                ? tutorialPillsRef
                : tutorialValueRef
            }
            onOverlayClick={tutorial.onTutorialOverlayClick}
          />
        )}

      </div>
    );
  }

  // ========================================================================
  // RENDER: Fallback
  // ========================================================================
  // Don't show fallback if we're restoring from snapshot (data will be available momentarily)
  if (restoredFromSnapshot) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={roleBgStyle}>
      <p className="text-white">{lang("UNKNOWN_PHASE")}: {phase}</p>
    </div>
  );
}
