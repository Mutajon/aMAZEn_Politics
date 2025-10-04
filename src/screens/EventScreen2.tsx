// src/screens/EventScreen2.tsx
// Fresh implementation of event screen with step-by-step progressive loading
// Building from scratch to replace problematic EventScreen with proper loading sequence

import React, { useEffect, useState, useRef } from "react";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { useEventNarration } from "../hooks/useEventNarration";
import { bgStyle } from "../lib/ui";
import ResourceBar from "../components/event/ResourceBar";
import SupportList from "../components/event/SupportList";
import { NewsTicker } from "../components/event/NewsTicker";
import PlayerStatusStrip from "../components/event/PlayerStatusStrip";
import ProgressiveLoadingCard from "../components/event/ProgressiveLoadingCard";
import DilemmaCard from "../components/event/DilemmaCard";
import MirrorCard from "../components/event/MirrorCard";
import CompassPillsOverlay from "../components/event/CompassPillsOverlay";
import ActionDeck, { type ActionCard } from "../components/event/ActionDeck";
import { actionsToDeckCards } from "../components/event/actionVisuals";
import { requestMirrorDilemmaLine } from "../lib/mirrorDilemma";
import { analyzeTextToCompass } from "../lib/compassMapping";
import { analyzeSupport } from "../lib/supportAnalysis";
import { useSettingsStore } from "../store/settingsStore";
import { useCompassStore } from "../store/compassStore";
import useCompassFX from "../hooks/useCompassFX";
import { useDynamicParameters } from "../hooks/useDynamicParameters";
import { useCoinFlights, CoinFlightOverlay } from "../components/event/CoinFlightSystem";
import { AnimatePresence } from "framer-motion";
import { Users, Heart, Building2, TrendingUp, TrendingDown, DollarSign, Shield, AlertTriangle, Globe, Leaf, Zap, Target, Scale, Flag, Crown } from "lucide-react";

type Props = {
  push: (path: string) => void;
};

// Default role for testing - Prime Minister of New Zealand
const DEFAULT_ROLE = "Prime Minister of New Zealand";
const DEFAULT_ANALYSIS = {
  systemName: "Westminster Democracy",
  systemDesc: "A parliamentary democracy with a Prime Minister as head of government",
  flavor: "Democratic tradition with pragmatic coalition politics",
  holders: [
    { name: "Prime Minister & Cabinet", percent: 35, icon: "🏛️" },
    { name: "Parliament", percent: 30, icon: "🗳️" },
    { name: "The People", percent: 25, icon: "👥" },
    { name: "Governor-General", percent: 10, icon: "👑" }
  ],
  playerIndex: 0
};

// Icon mapping for dynamic parameters
const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    'Users': <Users className="w-3.5 h-3.5" />,
    'TrendingUp': <TrendingUp className="w-3.5 h-3.5" />,
    'TrendingDown': <TrendingDown className="w-3.5 h-3.5" />,
    'DollarSign': <DollarSign className="w-3.5 h-3.5" />,
    'Shield': <Shield className="w-3.5 h-3.5" />,
    'AlertTriangle': <AlertTriangle className="w-3.5 h-3.5" />,
    'Heart': <Heart className="w-3.5 h-3.5" />,
    'Building': <Building2 className="w-3.5 h-3.5" />,
    'Globe': <Globe className="w-3.5 h-3.5" />,
    'Leaf': <Leaf className="w-3.5 h-3.5" />,
    'Zap': <Zap className="w-3.5 h-3.5" />,
    'Target': <Target className="w-3.5 h-3.5" />,
    'Scale': <Scale className="w-3.5 h-3.5" />,
    'Flag': <Flag className="w-3.5 h-3.5" />,
    'Crown': <Crown className="w-3.5 h-3.5" />
  };
  return iconMap[iconName] || <AlertTriangle className="w-3.5 h-3.5" />;
};

// Support data builder using store values
const getSupportItems = (people: number, middle: number, mom: number) => [
  {
    id: "people",
    name: "The People",
    percent: people,
    icon: <Users className="w-4 h-4" />,
    accentClass: "bg-emerald-600",
    moodVariant: "civic" as const,
  },
  {
    id: "middle",
    name: "Parliament",
    percent: middle,
    icon: <Building2 className="w-4 h-4" />,
    accentClass: "bg-amber-600",
    moodVariant: "civic" as const,
  },
  {
    id: "mom",
    name: "Coalition Partners",
    percent: mom,
    icon: <Heart className="w-4 h-4" />,
    accentClass: "bg-rose-600",
    moodVariant: "empathetic" as const,
  }
];

export default function EventScreen2(_props: Props) {
  const { day, totalDays, current, budget, supportPeople, supportMiddle, supportMom, loadNext } = useDilemmaStore();
  const { selectedRole, analysis, setRole, setAnalysis } = useRoleStore();
  const showBudget = useSettingsStore((s) => s.showBudget);

  // Narration integration - prepares and auto-plays TTS when dilemma loads
  const { canShowDilemma } = useEventNarration();

  // Compass FX for pills animation
  const { pings: compassPings, applyWithPings } = useCompassFX();

  // Dynamic parameters hook - manages parameter generation and animation
  const {
    parameters: dynamicParams,
    animatingIndex: dynamicParamsAnimatingIndex,
    generateParameters,
  } = useDynamicParameters();

  // Coin flight system - managed at parent level so it persists across ActionDeck unmounts
  const { flights, triggerCoinFlight, clearFlights } = useCoinFlights();

  // Loading sequence state
  const [loadingStage, setLoadingStage] = useState<'initial' | 'support' | 'supportAnalysis' | 'news' | 'dynamicParams' | 'playerStatus' | 'dilemma' | 'mirror' | 'complete'>('initial');
  const [supportItems, setSupportItems] = useState<any[]>([]);
  const [supportChanges, setSupportChanges] = useState<any[]>([]);
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [isAnalyzingSupport, setIsAnalyzingSupport] = useState(false);
  const [isGeneratingNews, setIsGeneratingNews] = useState(false);
  const [isGeneratingParams, setIsGeneratingParams] = useState(false);

  // Mirror state
  const [mirrorText, setMirrorText] = useState("…the mirror squints, light pooling in the glass…");
  const [mirrorLoading, setMirrorLoading] = useState(false);

  // Resource bar data
  const daysLeft = totalDays - day + 1;

  // Initialize default role if none exists (for testing)
  useEffect(() => {
    if (!selectedRole || !analysis) {
      console.log("Setting default role for testing:", DEFAULT_ROLE);
      setRole(DEFAULT_ROLE);
      setAnalysis(DEFAULT_ANALYSIS);
    }
  }, [selectedRole, analysis, setRole, setAnalysis]);

  // Main loading sequence
  useEffect(() => {
    const runLoadingSequence = async () => {
      console.log("[EventScreen2] Starting progressive loading sequence");

      // Step 1: Start with loading floater centered below ResourceBar
      setLoadingStage('initial');

      // Step 2: After 0.5s, show SupportList and move floater below it
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log("[EventScreen2] Showing SupportList");
      const supportData = getSupportItems(supportPeople, supportMiddle, supportMom);
      setSupportItems(supportData);
      setLoadingStage('support');

      // Step 3: Analyze support changes (on first day, no changes)
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log("[EventScreen2] Analyzing support changes");
      setLoadingStage('supportAnalysis');
      setIsAnalyzingSupport(true);

      if (day === 1) {
        // First day - no previous choice, skip support analysis
        console.log("[EventScreen2] First day - no support changes to analyze");
        await new Promise(resolve => setTimeout(resolve, 800));
        setSupportChanges([]);
      } else {
        // TODO: Implement real support analysis for subsequent days
        console.log("[EventScreen2] Analyzing previous choice impact...");
        await new Promise(resolve => setTimeout(resolve, 1200));
        setSupportChanges([]); // Mock - no changes for now
      }
      setIsAnalyzingSupport(false);

      // Step 4: Generate news ticker items
      console.log("[EventScreen2] Generating news ticker");
      setLoadingStage('news');
      setIsGeneratingNews(true);

      try {
        // Generate news based on role and current context
        const response = await fetch('/api/news-ticker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: selectedRole || DEFAULT_ROLE,
            day,
            systemName: analysis?.systemName || DEFAULT_ANALYSIS.systemName,
            previousChoice: day > 1 ? "No previous choice" : null, // TODO: Get from store
            count: 3,
            style: "short_amusing" // Request short, amusing news items
          })
        });

        if (response.ok) {
          const newsData = await response.json();
          console.log("[EventScreen2] News generated:", newsData.items?.length, "items");
          setNewsItems(newsData.items || []);
        } else {
          console.log("[EventScreen2] API failed, no fallback - will show empty news");
          setNewsItems([]);
        }
      } catch (error) {
        console.error('[EventScreen2] Failed to generate news:', error);
        setNewsItems([]);
      }

      setIsGeneratingNews(false);

      // Step 5: START LOADING DILEMMA AND MIRROR IN PARALLEL - don't wait!
      // Both run in background while we show dynamic parameters
      const dilemmaPromise = (async () => {
        if (!current) {
          console.log("[EventScreen2] Loading dilemma in background...");
          try {
            await loadNext();
            console.log("[EventScreen2] Dilemma loaded successfully");
          } catch (error) {
            console.error('[EventScreen2] Failed to load dilemma:', error);
          }
        }
      })();

      // Start mirror generation in parallel (after dilemma loads)
      const mirrorPromise = (async () => {
        // Wait for dilemma to load first
        await dilemmaPromise;

        // Only generate mirror text if we have a dilemma (which we should now)
        const loadedDilemma = useDilemmaStore.getState().current;
        if (loadedDilemma) {
          console.log("[EventScreen2] Loading mirror text in background...");
          setMirrorLoading(true);
          setMirrorText("…the mirror squints, light pooling in the glass…");
          try {
            const text = await requestMirrorDilemmaLine(loadedDilemma);
            setMirrorText(text);
            console.log("[EventScreen2] Mirror text loaded successfully");
          } catch (error) {
            console.error('[EventScreen2] Failed to load mirror text:', error);
            setMirrorText("…the mirror seems distracted, its surface clouded…");
          } finally {
            setMirrorLoading(false);
          }
        }
      })();

      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 6: Generate dynamic parameters (day 1 = none, day 2+ = based on previous choice)
      // Note: Dynamic parameters are now managed by useDynamicParameters hook
      setLoadingStage('dynamicParams');
      setIsGeneratingParams(true);

      if (day > 1) {
        console.log("[EventScreen2] Generating dynamic parameters for day", day);
        try {
          await generateParameters();
          console.log("[EventScreen2] Dynamic parameters generated successfully");
        } catch (error) {
          console.error('[EventScreen2] Failed to generate dynamic parameters:', error);
        }
      } else {
        console.log("[EventScreen2] Day 1 - no dynamic parameters");
      }

      setIsGeneratingParams(false);
      await new Promise(resolve => setTimeout(resolve, 300));
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 7: Show PlayerStatusStrip
      setLoadingStage('playerStatus');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 8: Wait for dilemma to finish loading and narration to be ready
      await dilemmaPromise;

      // Step 9: Show dilemma (canShowDilemma will be true when narration is ready)
      console.log("[EventScreen2] Dilemma loaded - showing dilemma card");
      setLoadingStage('dilemma');

      // Step 10: Wait for mirror to finish loading (it waits for dilemma internally)
      console.log("[EventScreen2] Waiting for mirror to load...");
      setLoadingStage('mirror');
      await mirrorPromise;

      // Step 11: Complete loading sequence - mirror is ready, now show action deck!
      console.log("[EventScreen2] Mirror loaded - ready to show action deck");
      setLoadingStage('complete');
    };

    runLoadingSequence();
  }, [day, selectedRole, analysis]); // Removed 'current' and 'loadNext' - they cause unnecessary re-runs

  // Get current loading stage for floater display
  const getCurrentStage = () => {
    if (loadingStage === 'supportAnalysis' && isAnalyzingSupport) return 'support';
    if (loadingStage === 'news' && isGeneratingNews) return 'news';
    if (loadingStage === 'dynamicParams' && isGeneratingParams) return 'parameters';
    if (loadingStage === 'playerStatus') return 'parameters';
    if (loadingStage === 'dilemma') return 'dilemma';
    if (loadingStage === 'mirror' && mirrorLoading) return 'mirror';
    return 'support';
  };

  // Build action cards from current dilemma
  const actionsForDeck: ActionCard[] = current ? actionsToDeckCards(current.actions) : [];

  // Progressive analysis after action confirmation
  const runProgressiveAnalysis = async (action: ActionCard) => {
    const actionText = `${action.title}. ${action.summary}`;
    console.log("[EventScreen2] Starting progressive analysis for:", actionText);

    // Step 1: Show support list again (will show changes animation)
    await new Promise(resolve => setTimeout(resolve, 500));
    setLoadingStage('support');
    const supportData = getSupportItems(supportPeople, supportMiddle, supportMom);
    setSupportItems(supportData);

    // Step 2: Analyze support changes from the action
    await new Promise(resolve => setTimeout(resolve, 300));
    setLoadingStage('supportAnalysis');
    setIsAnalyzingSupport(true);

    try {
      const ctx = {
        systemName: analysis?.systemName || "",
        holders: Array.isArray(analysis?.holders)
          ? analysis!.holders.map((h) => ({ name: h.name, percent: h.percent }))
          : [],
        playerIndex: typeof analysis?.playerIndex === "number" ? analysis!.playerIndex : null,
        day: day || 1,
      };

      const effects = await analyzeSupport(actionText, ctx);
      console.log("[EventScreen2] Support effects:", effects);

      // Update support values in store
      const { setSupportPeople, setSupportMiddle, setSupportMom } = useDilemmaStore.getState();
      const newPeopleValue = Math.max(0, Math.min(100, supportPeople + (effects.find(e => e.id === "people")?.delta || 0)));
      const newMiddleValue = Math.max(0, Math.min(100, supportMiddle + (effects.find(e => e.id === "middle")?.delta || 0)));
      const newMomValue = Math.max(0, Math.min(100, supportMom + (effects.find(e => e.id === "mom")?.delta || 0)));

      setSupportPeople(newPeopleValue);
      setSupportMiddle(newMiddleValue);
      setSupportMom(newMomValue);

      // Build support items WITH delta, trend, AND note inside each item (for animation)
      const updatedSupportItems = getSupportItems(newPeopleValue, newMiddleValue, newMomValue).map(item => {
        const effect = effects.find(e => e.id === item.id);
        return {
          ...item,
          delta: effect?.delta || null,
          trend: effect && effect.delta > 0 ? "up" : effect && effect.delta < 0 ? "down" : null,
          note: effect?.explain || null,  // API returns 'explain' not 'note'
        };
      });

      setSupportItems(updatedSupportItems);
      setSupportChanges([]); // Clear old changes array (not needed with delta in items)

      await new Promise(resolve => setTimeout(resolve, 1200));
    } catch (error) {
      console.error('[EventScreen2] Support analysis failed:', error);
    }
    setIsAnalyzingSupport(false);

    // Step 3: Update news ticker
    console.log("[EventScreen2] Generating news ticker after action");
    setLoadingStage('news');
    setIsGeneratingNews(true);

    try {
      const response = await fetch('/api/news-ticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole || DEFAULT_ROLE,
          day,
          systemName: analysis?.systemName || DEFAULT_ANALYSIS.systemName,
          previousChoice: actionText,
          count: 3,
          style: "short_amusing"
        })
      });

      if (response.ok) {
        const newsData = await response.json();
        console.log("[EventScreen2] News generated:", newsData.items?.length, "items");
        setNewsItems(newsData.items || []);
      }
    } catch (error) {
      console.error('[EventScreen2] Failed to generate news:', error);
    }
    setIsGeneratingNews(false);

    // Step 4: Load compass pills (only after day 1)
    if (day > 1) {
      console.log("[EventScreen2] Analyzing compass changes");
      try {
        // Use applyWithPings to update compass store AND trigger pill animation
        await analyzeTextToCompass(actionText, applyWithPings);
        console.log("[EventScreen2] Compass analysis complete - pills should be visible");
      } catch (error) {
        console.error('[EventScreen2] Compass analysis failed:', error);
      }
    }

    // Step 5: Load next dilemma in background + dynamic params
    setLoadingStage('dynamicParams');
    setIsGeneratingParams(true);

    const dilemmaPromise = (async () => {
      console.log("[EventScreen2] Loading NEXT dilemma in background...");
      try {
        // Always load next dilemma (don't check if (!current), always advance)
        await loadNext();
        console.log("[EventScreen2] Next dilemma loaded successfully");
      } catch (error) {
        console.error('[EventScreen2] Failed to load next dilemma:', error);
      }
    })();

    // Generate dynamic parameters (day 2+ based on previous choice)
    if (day > 1) {
      console.log("[EventScreen2] Generating dynamic parameters for day", day);
      try {
        await generateParameters();
        console.log("[EventScreen2] Dynamic parameters generated");
      } catch (error) {
        console.error('[EventScreen2] Failed to generate dynamic parameters:', error);
      }
    } else {
      console.log("[EventScreen2] Day 1 - no dynamic parameters");
      // Parameters are already managed by the hook, no need to set manually
    }
    setIsGeneratingParams(false);

    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 6: Show PlayerStatusStrip
    setLoadingStage('playerStatus');
    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 7: Wait for dilemma to load
    await dilemmaPromise;

    // Step 8: Show dilemma
    console.log("[EventScreen2] Dilemma loaded - showing dilemma card");
    setLoadingStage('dilemma');

    // Step 9: Load mirror text for new dilemma
    const mirrorPromise = (async () => {
      await dilemmaPromise; // Ensure dilemma is loaded first

      const loadedDilemma = useDilemmaStore.getState().current;
      if (loadedDilemma) {
        console.log("[EventScreen2] Loading mirror text for new dilemma...");
        setLoadingStage('mirror');
        setMirrorLoading(true);
        setMirrorText("…the mirror squints, light pooling in the glass…");
        try {
          const text = await requestMirrorDilemmaLine(loadedDilemma);
          setMirrorText(text);
          console.log("[EventScreen2] Mirror text loaded successfully");
        } catch (error) {
          console.error('[EventScreen2] Failed to load mirror text:', error);
          setMirrorText("…the mirror seems distracted, its surface clouded…");
        } finally {
          setMirrorLoading(false);
        }
      }
    })();

    await mirrorPromise;

    // Step 10: Complete - show action deck
    console.log("[EventScreen2] All analysis complete - ready for next choice");
    setLoadingStage('complete');
  };

  // Action handlers - implements full confirmation pipeline with progressive reveal
  const handleConfirm = async (id: string) => {
    const action = actionsForDeck.find((a) => a.id === id);
    if (!action) return;

    console.log("[EventScreen2] Action confirmed:", id, action.title);

    // NOTE: Coin animation is now managed at EventScreen2 level via portal
    // It will persist independently even when ActionDeck unmounts - no timing needed!

    // 1. Update budget immediately (happens during coin animation for visual feedback)
    if (showBudget && action.cost !== undefined && action.cost !== 0) {
      const { setBudget } = useDilemmaStore.getState();
      setBudget(budget + action.cost);
      console.log(`[EventScreen2] Budget updated by ${action.cost}`);
    }

    // 2. Save the choice to store for context
    const { applyChoice } = useDilemmaStore.getState();
    applyChoice(id as "a" | "b" | "c");

    // 3. Decrement days left (advance to next day)
    const { nextDay } = useDilemmaStore.getState();
    nextDay();
    console.log("[EventScreen2] Advanced to next day");

    // 4. Start new day sequence immediately (coin animation persists independently)
    console.log("[EventScreen2] Starting new day sequence (coins will continue animating)");
    setLoadingStage('initial');

    // Small delay to allow UI to reset
    await new Promise(resolve => setTimeout(resolve, 300));

    // 5. Start progressive analysis sequence (coins flying in background)
    await runProgressiveAnalysis(action);
  };

  const handleSuggest = (text?: string) => {
    console.log("[EventScreen2] Suggestion requested:", text);
    // TODO: Implement suggestion validation
  };

  return (
    <div className="min-h-[100dvh]" style={bgStyle}>
      <div className="relative">
        {/* Step 1: ResourceBar - always visible immediately */}
        <div
          className="
            sticky top-0 z-40
            py-2
            bg-[#0b1335]/80 backdrop-blur-md
            border-b border-white/10
          "
          style={{ WebkitBackdropFilter: "blur(8px)" }}
        >
          <div className="w-full max-w-xl mx-auto px-5">
            <ResourceBar daysLeft={daysLeft} budget={budget} showBudget={showBudget} />
          </div>
        </div>

        <div className="w-full max-w-xl mx-auto px-5 py-5">
          {/* Loading Floater - Fixed position above support list, highest z-index */}
          <ProgressiveLoadingCard
            show={loadingStage !== 'complete'}
            currentStage={getCurrentStage()}
            position={96} // 96px from top (same as top-24 in Tailwind)
            currentDay={day}
            totalDays={totalDays}
          />

          {/* Step 2: SupportList - appears after 0.5 seconds */}
          {loadingStage !== 'initial' && supportItems.length > 0 && (
            <SupportList
              items={supportItems}
              changes={supportChanges}
              animateChanges={supportChanges.length > 0}
            />
          )}

          {/* Step 4: NewsTicker - show immediately when news items are ready */}
          {newsItems.length > 0 && (
            <div className="mt-6">
              <NewsTicker items={newsItems} />
            </div>
          )}

          {/* Step 6: PlayerStatusStrip - appears after dynamic parameters */}
          {(loadingStage === 'playerStatus' || loadingStage === 'complete') && (
            <div className="mt-6">
              <PlayerStatusStrip
                params={dynamicParams}
                animatingIndex={dynamicParamsAnimatingIndex}
              />
            </div>
          )}

          {/* Step 7: DilemmaCard - show when dilemma loaded and narration ready */}
          {(loadingStage === 'dilemma' || loadingStage === 'mirror' || loadingStage === 'complete') && current && canShowDilemma && (
            <div className="mt-4">
              <DilemmaCard
                title={current.title}
                description={current.description}
                day={day}
                totalDays={totalDays}
              />
            </div>
          )}

          {/* Step 8: MirrorCard - show immediately when dilemma appears, with loading state */}
          {(loadingStage === 'mirror' || loadingStage === 'complete') && current && (
            <div className="mt-3 relative">
              <div className={mirrorLoading ? "animate-pulse" : ""}>
                <MirrorCard text={mirrorText} />
              </div>
              {/* Compass pills - show when triggered by compass analysis (day 2+) */}
              <CompassPillsOverlay effectPills={compassPings} loading={false} color="#7de8ff" />
            </div>
          )}

          {/* Step 9: ActionDeck - show only after mirror is fully loaded */}
          {loadingStage === 'complete' && current && !((current as any)._isFallback) && (
            <ActionDeck
              actions={actionsForDeck}
              showBudget={showBudget}
              budget={budget}
              onConfirm={handleConfirm}
              onSuggest={handleSuggest}
              triggerCoinFlight={triggerCoinFlight}
              dilemma={{ title: current.title, description: current.description }}
            />
          )}
        </div>
      </div>

      {/* Coin Flight Overlay - portal-based, persists independently of ActionDeck lifecycle */}
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