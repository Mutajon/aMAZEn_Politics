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
import ResourceBar from "../components/event/ResourceBar";
import SupportList from "../components/event/SupportList";
import { NewsTicker, buildDynamicParamsTickerItems } from "../components/event/NewsTicker";
import DilemmaCard from "../components/event/DilemmaCard";
import MirrorCard from "../components/event/MirrorCard";
import CompassPillsOverlay from "../components/event/CompassPillsOverlay";
import ActionDeck, { type ActionCard } from "../components/event/ActionDeck";
import { actionsToDeckCards } from "../components/event/actionVisuals";
import { useCoinFlights, CoinFlightOverlay } from "../components/event/CoinFlightSystem";
import { AnimatePresence } from "framer-motion";
import { bgStyle } from "../lib/ui";
import { Building2, Heart, Users } from "lucide-react";
import type { CompassEffectPing } from "../components/MiniCompass";
import { saveEventScreenSnapshot, loadEventScreenSnapshot, clearEventScreenSnapshot } from "../lib/eventScreenSnapshot";

type Props = {
  push: (path: string) => void;
};

export default function EventScreen3({ push }: Props) {
  // Global state (read only - single source of truth)
  const { day, totalDays, budget } = useDilemmaStore();
  const { character } = useRoleStore();
  const showBudget = useSettingsStore((s) => s.showBudget);
  const debugMode = useSettingsStore((s) => s.debugMode);

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
  const handleSuggest = (text?: string) => {
    // ActionDeck handles suggestion validation internally
    // This handler is just for EventScreen3 to be notified
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
        message="Gathering political intelligence..."
      />
    );
  }

  // ========================================================================
  // RENDER: Error State (dilemma failed - no fallback)
  // ========================================================================
  if (collectionError) {
    return (
      <DilemmaLoadError
        error={collectionError}
        onRetry={() => {
          setPhase('collecting');
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

    // Build ticker items from dynamic parameters
    const isFirstDay = day === 1;
    const tickerItems = buildDynamicParamsTickerItems(
      collectedData?.dynamicParams || null,
      isFirstDay
    );

    return (
      <div className="min-h-screen p-6 pb-24" style={bgStyle}>
        {/* Debug: Jump to Final Day button */}
        {debugMode && day < 7 && phase === 'interacting' && (
          <button
            onClick={jumpToFinalDay}
            className="fixed top-4 right-4 px-3 py-2 text-xs bg-red-900/80 border border-red-500/50 text-red-200 rounded hover:bg-red-800/80 transition-colors z-50"
            title="Debug: Skip to final day with random choice"
          >
            🚀 Jump to Final Day
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
            />
          )}

          {/* Step 1+: SupportList */}
          {presentationStep >= 1 && (
            <SupportList items={supportItems} />
          )}

          {/* Step 3+: NewsTicker - Shows placeholder "News items incoming..." until dynamicParams ready */}
          {presentationStep >= 3 && (
            <NewsTicker items={tickerItems} />
          )}

          {/* Step 4+: DilemmaCard OR Aftermath (game ending) */}
          {presentationStep >= 4 && collectedData && (
            <>
              {isGameEnd ? (
                // Game conclusion - show aftermath card
                <div className="bg-gray-900/70 backdrop-blur-sm border border-amber-500/30 rounded-lg p-6 shadow-xl">
                  <h2 className="text-2xl font-bold text-amber-400 mb-4">
                    {collectedData.dilemma.title}
                  </h2>
                  <p className="text-lg text-gray-200 leading-relaxed mb-6 whitespace-pre-wrap">
                    {collectedData.dilemma.description}
                  </p>
                  {phase === 'interacting' && (
                    <button
                      onClick={() => push('/highscores')}
                      className="w-full px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-amber-500/50"
                    >
                      View Final Results
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
    <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
      <p className="text-white">Unknown phase: {phase}</p>
    </div>
  );
}
