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

type Props = {
  push: (path: string) => void;
};

export default function EventScreen3(_props: Props) {
  // Global state (read only - single source of truth)
  const { day, totalDays, budget } = useDilemmaStore();
  const { character } = useRoleStore();
  const showBudget = useSettingsStore((s) => s.showBudget);

  // Data collection (progressive 3-phase loading)
  const {
    collectedData,     // Legacy format (for presenter compatibility)
    isCollecting,
    collectionError,
    collectData,
    isReady,           // Legacy flag (same as phase1Ready now)
    registerOnReady    // Callback registration for progress notification
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

  // Convert collected compassPills to CompassEffectPing format with unique IDs
  const compassPings: CompassEffectPing[] = useMemo(() => {
    if (!collectedData?.compassPills) return [];
    return collectedData.compassPills.map((pill, i) => ({
      id: `${Date.now()}-${i}`,
      prop: pill.prop,
      idx: pill.idx,
      delta: pill.delta
    }));
  }, [collectedData?.compassPills]);

  // ========================================================================
  // EFFECT 0: Register progress callback with data collector
  // ========================================================================
  useEffect(() => {
    console.log('[EventScreen3] Registering progress callback with data collector');
    registerOnReady(() => {
      console.log('[EventScreen3] Data ready - triggering progress catchup animation');
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
    console.log(`[EventScreen3] Effect running - phase: ${phase}, day: ${day}, ref: ${collectionTriggeredRef.current}, lastDay: ${lastCollectedDayRef.current}, isCollecting: ${isCollecting}, error: ${collectionError}`);

    if (phase === 'collecting') {
      // Reset ref if we're on a new day
      if (day !== lastCollectedDayRef.current) {
        console.log(`[EventScreen3] 🔄 New day detected (${lastCollectedDayRef.current} → ${day}), resetting ref`);
        collectionTriggeredRef.current = false;
        lastCollectedDayRef.current = day;

        // Reset and start progress for new day
        resetProgress();
        startProgress();
        console.log('[EventScreen3] 🎯 Started loading progress for new day');
      }

      // Only trigger if we haven't already triggered for this day
      if (!collectionTriggeredRef.current && !isCollecting && !collectionError) {
        console.log(`[EventScreen3] ✅ Phase is collecting - triggering data collection for day ${day}`);
        collectionTriggeredRef.current = true;
        collectData();
      } else {
        console.log(`[EventScreen3] ⏸️ Collection blocked - ref: ${collectionTriggeredRef.current}, isCollecting: ${isCollecting}, error: ${collectionError}`);
      }
    } else {
      // Reset flag when leaving collecting phase
      if (collectionTriggeredRef.current) {
        console.log('[EventScreen3] 🔄 Resetting collection trigger ref (leaving collecting phase)');
      }
      collectionTriggeredRef.current = false;
    }
  }, [phase, isCollecting, collectionError, day, collectData, startProgress, resetProgress]);

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
      console.log('[EventScreen3] 📸 Captured initial support values at Step 1:', { supportPeople, supportMiddle, supportMom });
    }

    // Clear after Step 2 completes (at Step 3+) so animation doesn't reset
    // This ensures SupportCard displays final percent value, not initial value
    if (presentationStep >= 3 && initialSupportValues) {
      console.log('[EventScreen3] 🧹 Clearing initial support values at Step', presentationStep);
      setInitialSupportValues(null);
    }
  }, [presentationStep, initialSupportValues]);

  // ========================================================================
  // EFFECT 3: Advance to presenting when data ready
  // ========================================================================
  useEffect(() => {
    if (isReady && canShowDilemma && !isCollecting && phase === 'collecting' && collectedData) {
      console.log('[EventScreen3] ✅ Data ready - starting presentation sequence');
      setPhase('presenting');

      // Run presentation sequence with narration callback
      presentEventData(
        collectedData,
        setPresentationStep,
        () => startNarrationIfReady(true) // Trigger narration when dilemma card is revealed
      )
        .then(() => {
          console.log('[EventScreen3] Presentation complete - advancing to interacting phase');
          setPhase('interacting');
        })
        .catch(error => {
          console.error('[EventScreen3] Presentation error:', error);
        });
    }
  }, [isReady, canShowDilemma, isCollecting, phase, collectedData, startNarrationIfReady, setPresentationStep]);

  // ========================================================================
  // EFFECT 4: Control compass pills visibility based on presentation step
  // Pills appear at Step 4+ (after dilemma shown) and before Step 6 (action deck)
  // ========================================================================
  useEffect(() => {
    const shouldShow = presentationStep >= 4 && presentationStep < 6 && day > 1 && compassPings.length > 0;

    if (shouldShow !== showCompassPills) {
      console.log(`[EventScreen3] Compass pills visibility: ${shouldShow} (step: ${presentationStep}, day: ${day}, pills: ${compassPings.length})`);
      setShowCompassPills(shouldShow);
    }
  }, [presentationStep, day, compassPings.length, showCompassPills]);

  // ========================================================================
  // ACTION HANDLERS
  // ========================================================================

  /**
   * Handle action confirmation - delegates ALL logic to EventDataCleaner
   */
  const handleConfirm = async (id: string) => {
    console.log('[EventScreen3] Action confirmed:', id);

    // Find the action card
    const actionsForDeck = collectedData?.dilemma
      ? actionsToDeckCards(collectedData.dilemma.actions)
      : [];
    const actionCard = actionsForDeck.find(a => a.id === id);

    if (!actionCard) {
      console.error('[EventScreen3] Action not found:', id);
      return;
    }

    // Advance to cleaning phase
    setPhase('cleaning');
    console.log('[EventScreen3] Entering cleaning phase');

    // Run cleaner (handles: save choice, update budget, coin animation, advance day)
    await cleanAndAdvanceDay(actionCard, clearFlights);

    // After cleaning complete, reset to collecting phase for next day
    console.log('[EventScreen3] Cleaning complete - resetting to collecting phase');
    setPhase('collecting');
    setPresentationStep(-1);
    setInitialSupportValues(null); // Clear for next day
    // Collection will be triggered by effect watching phase/day
  };

  /**
   * Handle custom action suggestion
   */
  const handleSuggest = (text?: string) => {
    console.log('[EventScreen3] Suggest your own:', text);
    // ActionDeck handles suggestion validation internally
    // This handler is just for EventScreen3 to be notified
  };

  // ========================================================================
  // RENDER: Loading State (collecting phase)
  // ========================================================================
  if (phase === 'collecting' || isCollecting) {
    console.log('[EventScreen3] Rendering loading overlay with progress:', progress);
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
    console.log('[EventScreen3] Rendering error screen:', collectionError);
    return (
      <DilemmaLoadError
        error={collectionError}
        onRetry={() => {
          console.log('[EventScreen3] Retry requested - restarting collection');
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

          {/* Step 4+: DilemmaCard (was Step 5) */}
          {presentationStep >= 4 && collectedData && (
            <DilemmaCard
              title={collectedData.dilemma.title}
              description={collectedData.dilemma.description}
            />
          )}

          {/* Step 5+: MirrorCard with Compass Pills Overlay (was Step 6) */}
          {presentationStep >= 5 && collectedData && (
            <div className="relative">
              <MirrorCard text={collectedData.mirrorText} />
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

          {/* Step 6: ActionDeck (was Step 7) */}
          {presentationStep >= 6 && phase === 'interacting' && (
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
  return (
    <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
      <p className="text-white">Unknown phase: {phase}</p>
    </div>
  );
}
