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
import { useEventDataCollector } from "../hooks/useEventDataCollector";
import { useEventNarration } from "../hooks/useEventNarration";
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
import CorruptionPill from "../components/event/CorruptionPill";
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

type Props = {
  push: (path: string) => void;
};

export default function EventScreen3({ push }: Props) {
  const lang = useLang();

  // Global state (read only - single source of truth)
  const { day, totalDays, budget, supportPeople, supportMiddle, supportMom, corruptionLevel, score, crisisMode: storedCrisisMode } = useDilemmaStore();
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
  const { canShowDilemma, startNarrationIfReady } = useEventNarration();

  // Loading progress (auto-increments, smooth catchup animation)
  const { progress, start: startProgress, reset: resetProgress, notifyReady } = useLoadingProgress();

  // Phase tracking
  const [phase, setPhase] = useState<'collecting' | 'presenting' | 'interacting' | 'cleaning'>('collecting');

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

  // Compass pills state (for visual display during Step 4A)
  const [showCompassPills, setShowCompassPills] = useState(false);

  // Corruption pill state (for visual display during Step 4A, Day 2+)
  const [showCorruptionPill, setShowCorruptionPill] = useState(false);

  // Snapshot restoration flag (prevents collection when restored)
  const [restoredFromSnapshot, setRestoredFromSnapshot] = useState(false);

  // Convert collected compassPills to CompassEffectPing format with unique IDs
  const compassPings: CompassEffectPing[] = useMemo(() => {
    if (!collectedData?.compassPills) return [];
    const pills = collectedData.compassPills.map((pill, i) => ({
      id: `${Date.now()}-${i}`,
      prop: pill.prop,
      idx: pill.idx,
      delta: pill.delta
    }));
    if (pills.length > 0) {
      console.log(`[EventScreen3] 💊 CompassPings populated: ${pills.length} pills`, pills);
    }
    return pills;
  }, [collectedData?.compassPills]);

  // Extract corruption pill data (Day 2+ only, feature flag gated)
  const corruptionTrackingEnabled = useSettingsStore((s) => s.corruptionTrackingEnabled);
  const corruptionPillData = useMemo(() => {
    if (!corruptionTrackingEnabled) return null;
    if (!collectedData?.corruptionShift || day === 1) return null;
    if (Math.abs(collectedData.corruptionShift.delta) < 0.1) return null; // Ignore tiny changes

    console.log(`[EventScreen3] 🔸 Corruption pill data:`, collectedData.corruptionShift);
    return collectedData.corruptionShift;
  }, [collectedData?.corruptionShift, day, corruptionTrackingEnabled]);

  const scoreDetails: ResourceBarScoreDetails = useMemo(() => {
    const breakdown = calculateLiveScoreBreakdown({
      supportPeople,
      supportMiddle,
      supportMom,
      corruptionLevel,
    });

    const middleLabel =
      analysis?.challengerSeat?.name || lang("FINAL_SCORE_POWER_HOLDERS_SUPPORT");

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
        {
          id: "corruption" as const,
          label: lang("FINAL_SCORE_CORRUPTION"),
          valueLabel: `${breakdown.corruption.normalizedLevel.toFixed(1)}/10`,
          points: breakdown.corruption.points,
          maxPoints: breakdown.corruption.maxPoints,
        },
      ],
    } as const;
  }, [
    supportPeople,
    supportMiddle,
    supportMom,
    corruptionLevel,
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
  // EFFECT 4B: Show/hide corruption pill based on phase and data availability
  // ========================================================================
  useEffect(() => {
    // Show corruption pill when interacting AND data exists AND it's Day 2+ AND feature enabled
    const shouldShow = phase === 'interacting' && corruptionPillData !== null && day > 1 && corruptionTrackingEnabled;

    if (shouldShow !== showCorruptionPill) {
      console.log(`[EventScreen3] 🔸 Corruption pill visibility: ${shouldShow} (phase: ${phase}, day: ${day}, enabled: ${corruptionTrackingEnabled})`);
      setShowCorruptionPill(shouldShow);
    }
  }, [phase, day, corruptionPillData, corruptionTrackingEnabled, showCorruptionPill]);

  // ========================================================================
  // EFFECT 5: Redirect to downfall screen when terminal crisis occurs
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
   * Handle action confirmation - delegates ALL logic to EventDataCleaner
   */
  const handleConfirm = async (id: string) => {
    // Find the action card
    const actionsForDeck = collectedData?.dilemma
      ? actionsToDeckCards(collectedData.dilemma.actions)
      : [];
    const actionCard = actionsForDeck.find(a => a.id === id);

    if (!actionCard) {
      console.error('[EventScreen3] ❌ Action not found:', id);
      return;
    }

    // Advance to cleaning phase
    setPhase('cleaning');

    // Run cleaner (handles: save choice, update budget, coin animation, advance day)
    await cleanAndAdvanceDay(actionCard, clearFlights);

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
    if (!text || !text.trim()) {
      console.warn('[EventScreen3] ❌ handleSuggest called with empty text');
      return;
    }

    console.log('[EventScreen3] 💡 Processing custom suggestion:', text);

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

    // Advance to cleaning phase
    setPhase('cleaning');

    // Run cleaner (handles: save choice, update budget, wait for animation, advance day)
    await cleanAndAdvanceDay(suggestionCard, clearFlights);

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
    if (!collectedData?.dilemma?.actions || collectedData.dilemma.actions.length === 0) {
      console.warn('[EventScreen3] Cannot jump - no actions available');
      return;
    }

    // Pick random action from current dilemma
    const actions = collectedData.dilemma.actions;
    const randomIndex = Math.floor(Math.random() * actions.length);
    const randomAction = actions[randomIndex];

    console.log('[EventScreen3] 🚀 Jumping to final day with random choice:', randomAction.title);

    // Save this as last choice
    const { setLastChoice, setBudget } = useDilemmaStore.getState();
    setLastChoice({
      id: randomAction.id as 'a' | 'b' | 'c',
      title: randomAction.title,
      summary: randomAction.summary,
      cost: randomAction.cost
    });

    // Apply budget change immediately (so it's reflected in the context)
    const currentBudget = useDilemmaStore.getState().budget;
    setBudget(currentBudget + randomAction.cost);

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
  // RENDER: Loading State (collecting phase)
  // ========================================================================
  // Don't show loading overlay if we're restoring from snapshot
  if ((phase === 'collecting' || isCollecting) && !restoredFromSnapshot) {
    return (
      <CollectorLoadingOverlay
        progress={progress} // Real-time progress with auto-increment and catchup animation
        message={lang("GATHERING_INTELLIGENCE")}
      />
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
  // RENDER: Presenting/Interacting/Cleaning Phase
  // ========================================================================
  if (collectedData && (phase === 'presenting' || phase === 'interacting' || phase === 'cleaning')) {
    // Calculate derived values
    const daysLeft = totalDays - day + 1;

    // Game end detection - empty actions array signals conclusion
    const isGameEnd = Array.isArray(collectedData.dilemma.actions) && collectedData.dilemma.actions.length === 0;

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
      <div className="min-h-screen p-6 pb-24" style={roleBgStyle}>
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

        <div className="max-w-3xl mx-auto space-y-3">
          {/* Step 0+: ResourceBar (always visible) with avatar */}
          {presentationStep >= 0 && (
            <ResourceBar
              budget={budget}
              daysLeft={daysLeft}
              showBudget={showBudget}
              avatarSrc={character?.avatarUrl || null}
              scoreGoal={roleProgress?.goal ?? null}
              goalStatus={roleProgress?.status ?? "uncompleted"}
              score={score}
              scoreDetails={scoreDetails}
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
                      onClick={() => push('/aftermath')}
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
                />
              )}
            </>
          )}

          {/* Step 5+: MirrorCard with Compass Pills Overlay (skip if game end) */}
          {!isGameEnd && presentationStep >= 5 && collectedData && (
            <div className="relative">
              <MirrorCard
                text={collectedData.mirrorText}
                // onExploreClick temporarily removed - navigation bugs prevent safe return to EventScreen
              />
              {/* Compass Pills Overlay - appears at Step 4A (Day 2+) */}
              {showCompassPills && (
                <CompassPillsOverlay
                  effectPills={compassPings}
                  loading={false}
                  color="#7de8ff"
                />
              )}
              {/* Corruption Pill - appears at Step 4A (Day 2+, if feature enabled) */}
              {showCorruptionPill && corruptionPillData && (
                <CorruptionPill
                  delta={corruptionPillData.delta}
                  reason={corruptionPillData.reason}
                  newLevel={corruptionPillData.newLevel}
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
