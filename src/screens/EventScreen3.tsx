// src/screens/EventScreen3.tsx
// EventScreen with EventDataCollector → EventDataPresenter → EventDataCleaner architecture
//
// Phase 1: COLLECTING - Fetch all data with loading overlay
// Phase 2: PRESENTING - Sequential presentation of collected data
// Phase 3: INTERACTING - User chooses action
// Phase 4: CLEANING - Process choice, advance day, restart
//
// Uses: useEventDataCollector, presentEventData, buildSupportItems, cleanAndAdvanceDay

import { useEffect, useState, useRef } from "react";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { useSettingsStore } from "../store/settingsStore";
import { useEventDataCollector, type DynamicParam } from "../hooks/useEventDataCollector";
import { useEventNarration } from "../hooks/useEventNarration";
import { presentEventData, buildSupportItems } from "../lib/eventDataPresenter";
import { cleanAndAdvanceDay } from "../lib/eventDataCleaner";
import CollectorLoadingOverlay from "../components/event/CollectorLoadingOverlay";
import DilemmaLoadError from "../components/event/DilemmaLoadError";
import ResourceBar from "../components/event/ResourceBar";
import SupportList from "../components/event/SupportList";
import { NewsTicker } from "../components/event/NewsTicker";
import PlayerStatusStrip, { type ParamItem } from "../components/event/PlayerStatusStrip";
import DilemmaCard from "../components/event/DilemmaCard";
import MirrorCard from "../components/event/MirrorCard";
import ActionDeck, { type ActionCard } from "../components/event/ActionDeck";
import { actionsToDeckCards } from "../components/event/actionVisuals";
import { useCoinFlights, CoinFlightOverlay } from "../components/event/CoinFlightSystem";
import { AnimatePresence } from "framer-motion";
import { bgStyle } from "../lib/ui";
import {
  AlertTriangle,
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Shield,
  Flame,
  Heart,
  Zap,
  Target,
  Flag,
  Award,
  Activity,
  Briefcase,
  Globe,
  Home,
  MessageSquare,
  FileText,
  Scale
} from "lucide-react";

// Icon mapper for dynamic parameters
const ICON_MAP: Record<string, any> = {
  AlertTriangle,
  Building: Building2,
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Shield,
  Flame,
  Heart,
  Zap,
  Target,
  Flag,
  Award,
  Activity,
  Briefcase,
  Globe,
  Home,
  MessageSquare,
  FileText,
  Scale
};

/**
 * Convert dynamic parameters from collector (icon: string) to PlayerStatusStrip format (icon: ReactNode)
 */
function convertDynamicParamsToParamItems(params: DynamicParam[]): ParamItem[] {
  return params.map(p => {
    const IconComponent = ICON_MAP[p.icon] || AlertTriangle;
    return {
      id: p.id,
      icon: <IconComponent className="w-3.5 h-3.5" strokeWidth={2.2} />,
      text: p.text,
      tone: p.tone
    };
  });
}

type Props = {
  push: (path: string) => void;
};

export default function EventScreen3(_props: Props) {
  // Global state (read only - single source of truth)
  const { day, totalDays, budget, supportPeople, supportMiddle, supportMom } = useDilemmaStore();
  const { analysis, character } = useRoleStore();
  const showBudget = useSettingsStore((s) => s.showBudget);

  // Data collection
  const {
    collectedData,
    isCollecting,
    collectionError,
    collectionProgress,
    collectData,
    isReady
  } = useEventDataCollector();

  // Narration integration - prepares TTS when dilemma loads, provides canShowDilemma flag
  const { canShowDilemma, startNarrationIfReady } = useEventNarration();

  // Phase tracking
  const [phase, setPhase] = useState<'collecting' | 'presenting' | 'interacting' | 'cleaning'>('collecting');

  // Presentation step tracking (controls what's visible)
  const [presentationStep, setPresentationStep] = useState<number>(-1);

  // Coin flight system (persists across all phases)
  const { flights, triggerCoinFlight, clearFlights } = useCoinFlights();

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
      }

      // Only trigger if we haven't already triggered for this day
      if (!collectionTriggeredRef.current && !isCollecting && !collectionError) {
        console.log('[EventScreen3] ✅ Phase is collecting - triggering data collection for day', day);
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
  }, [phase, isCollecting, collectionError, day]);

  // ========================================================================
  // EFFECT 2: Advance to presenting when data ready AND narration ready
  // ========================================================================
  useEffect(() => {
    console.log(`[EventScreen3] EFFECT 2 - isReady: ${isReady}, canShowDilemma: ${canShowDilemma}, phase: ${phase}, hasData: ${!!collectedData}`);

    // Wait for BOTH data collection AND narration preparation
    if (isReady && canShowDilemma && phase === 'collecting' && collectedData && !isCollecting) {
      console.log('[EventScreen3] ✅ All data + narration ready - starting presentation sequence');
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
  }, [isReady, canShowDilemma, phase, collectedData, isCollecting]);

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
    // Collection will be triggered by effect watching phase/day
  };

  /**
   * Handle custom action suggestion
   * Creates a custom action card and proceeds to cleaning phase
   */
  const handleSuggest = async (text?: string) => {
    if (!text) {
      console.warn('[EventScreen3] Suggest received with empty text');
      return;
    }

    console.log('[EventScreen3] Suggest your own:', text);

    // Create a custom action card (id='custom') with the suggested text
    const customActionCard = {
      id: 'custom',
      title: text.slice(0, 60), // Use first part as title
      summary: text, // Full text as summary
      cost: -300, // Default cost for suggestions (matches UI)
      iconHint: 'speech' as const,
    };

    console.log('[EventScreen3] Created custom action:', customActionCard);

    // Advance to cleaning phase
    setPhase('cleaning');
    console.log('[EventScreen3] Entering cleaning phase');

    // Run cleaner (handles: save choice, update budget, coin animation, advance day)
    await cleanAndAdvanceDay(customActionCard, clearFlights);

    // After cleaning complete, reset to collecting phase for next day
    console.log('[EventScreen3] Cleaning complete - resetting to collecting phase');
    setPhase('collecting');
    setPresentationStep(-1);
  };

  // ========================================================================
  // RENDER: Loading State (collecting phase)
  // ========================================================================
  if (phase === 'collecting' || isCollecting) {
    console.log('[EventScreen3] Rendering loading overlay');
    return (
      <CollectorLoadingOverlay
        day={day}
        totalDays={totalDays}
        progress={collectionProgress}
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
  // RENDER: Data Not Ready (safety check - only when NOT collecting)
  // ========================================================================
  if (phase !== 'collecting' && (!collectedData || !isReady)) {
    console.log('[EventScreen3] Data not ready - showing error');
    return (
      <DilemmaLoadError
        error="Data collection incomplete"
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
  if (phase === 'presenting' || phase === 'interacting' || phase === 'cleaning') {
    // Calculate derived values
    const daysLeft = totalDays - day + 1;

    // Build support items with deltas
    const rawSupportItems = buildSupportItems(presentationStep, collectedData);

    // Add icons to support items
    const supportItems = rawSupportItems.map(item => ({
      ...item,
      icon: item.id === 'people'
        ? <Users className="w-4 h-4" />
        : item.id === 'middle'
        ? <Building2 className="w-4 h-4" />
        : <Heart className="w-4 h-4" />
    }));

    // Check if post-game mode
    const isPostGame = collectedData.isPostGame || false;

    // Build action cards (only for normal days)
    const actionsForDeck: ActionCard[] = !isPostGame && collectedData.dilemma
      ? actionsToDeckCards(collectedData.dilemma.actions)
      : [];

    return (
      <div className="min-h-screen p-6 pb-24" style={bgStyle}>
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Step 0+: ResourceBar (always visible, shows daysLeft=0 in post-game) */}
          {presentationStep >= 0 && (
            <ResourceBar
              budget={budget}
              daysLeft={isPostGame ? 0 : daysLeft}
              showBudget={showBudget}
            />
          )}

          {/* Step 1+: SupportList */}
          {presentationStep >= 1 && (
            <SupportList items={supportItems} />
          )}

          {/* Step 3+: NewsTicker */}
          {presentationStep >= 3 && collectedData && (
            <NewsTicker items={collectedData.newsItems} />
          )}

          {/* Step 4+: PlayerStatusStrip */}
          {presentationStep >= 4 && collectedData && (
            <PlayerStatusStrip
              avatarSrc={character?.avatarUrl || null}
              params={convertDynamicParamsToParamItems(collectedData.dynamicParams || [])}
            />
          )}

          {/* Step 5+: DilemmaCard OR ReactionSummary */}
          {presentationStep >= 5 && collectedData && (
            <>
              {isPostGame && collectedData.reactionSummary ? (
                // Post-game: Show reaction summary instead of dilemma
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-amber-600/40 rounded-lg p-5 shadow-xl">
                  <h2 className="text-xl font-semibold text-amber-400 mb-3">Final Outcome</h2>
                  <p className="text-slate-200 text-base leading-relaxed">
                    {collectedData.reactionSummary}
                  </p>
                </div>
              ) : collectedData.dilemma ? (
                // Normal day: Show dilemma
                <DilemmaCard
                  title={collectedData.dilemma.title}
                  description={collectedData.dilemma.description}
                />
              ) : null}
            </>
          )}

          {/* Step 6+: MirrorCard */}
          {presentationStep >= 6 && collectedData && (
            <MirrorCard text={collectedData.mirrorText} />
          )}

          {/* Step 7: ActionDeck OR Summary Button */}
          {presentationStep >= 7 && phase === 'interacting' && (
            <>
              {isPostGame ? (
                // Post-game: Show "View Summary" button
                <div className="flex justify-center pt-6">
                  <button
                    onClick={() => {
                      // Navigate to summary screen
                      if (_props.push) {
                        _props.push('/summary');
                      }
                    }}
                    className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
                  >
                    View Game Summary
                  </button>
                </div>
              ) : (
                // Normal day: Show action deck
                collectedData.dilemma && (
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
                )
              )}
            </>
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
