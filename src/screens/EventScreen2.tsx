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
import { useSettingsStore } from "../store/settingsStore";
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
  const { canShowDilemma, startNarrationIfReady } = useEventNarration();

  // Loading sequence state
  const [loadingStage, setLoadingStage] = useState<'initial' | 'support' | 'supportAnalysis' | 'news' | 'dynamicParams' | 'playerStatus' | 'dilemma' | 'mirror' | 'complete'>('initial');
  const [supportItems, setSupportItems] = useState<any[]>([]);
  const [supportChanges, setSupportChanges] = useState<any[]>([]);
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [dynamicParams, setDynamicParams] = useState<any[]>([]);
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
      setLoadingStage('dynamicParams');
      setIsGeneratingParams(true);

      if (day === 1) {
        console.log("[EventScreen2] Day 1 - no dynamic parameters");
        setDynamicParams([]);
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        console.log("[EventScreen2] Generating dynamic parameters for day", day);
        try {
          // TODO: Get previous choice from store when available
          const previousChoice = null; // Placeholder - replace with actual previous choice

          if (previousChoice) {
            const paramResponse = await fetch('/api/dynamic-parameters', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lastChoice: previousChoice,
                politicalContext: {
                  role: selectedRole || DEFAULT_ROLE,
                  systemName: analysis?.systemName || DEFAULT_ANALYSIS.systemName,
                  day,
                  totalDays
                }
              })
            });

            if (paramResponse.ok) {
              const paramData = await paramResponse.json();
              console.log("[EventScreen2] Dynamic parameters generated:", paramData.parameters?.length, "items");

              // Transform API response to PlayerStatusStrip format
              const transformedParams = (paramData.parameters || []).map((param: any) => ({
                id: param.id,
                icon: getIconComponent(param.icon),
                text: param.text,
                tone: param.tone
              }));

              setDynamicParams(transformedParams);
            } else {
              setDynamicParams([]);
            }
          } else {
            setDynamicParams([]);
          }
        } catch (error) {
          console.error('[EventScreen2] Failed to generate dynamic parameters:', error);
          setDynamicParams([]);
        }
      }

      setIsGeneratingParams(false);
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

  // Action handlers (TODO: implement full action confirmation pipeline)
  const handleConfirm = (id: string) => {
    console.log("[EventScreen2] Action confirmed:", id);
    // TODO: Implement action confirmation pipeline
    // - Update budget
    // - Run compass analysis
    // - Run support analysis
    // - Update news
    // - Load next dilemma
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
            -mx-5 px-5   /* stretch to page gutters, then restore padding */
            py-2
            bg-[#0b1335]/80 backdrop-blur-md
            border-b border-white/10
          "
          style={{ WebkitBackdropFilter: "blur(8px)" }}
        >
          <ResourceBar daysLeft={daysLeft} budget={budget} showBudget={showBudget} />
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
            <div className="mt-4">
              <SupportList
                items={supportItems}
                changes={supportChanges}
                animateChanges={supportChanges.length > 0}
              />
            </div>
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
                animatingIndex={null}
              />
            </div>
          )}

          {/* Step 7: DilemmaCard - show when dilemma loaded and narration ready */}
          {(loadingStage === 'dilemma' || loadingStage === 'mirror' || loadingStage === 'complete') && current && canShowDilemma && (
            <div className="mt-8">
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
              {/* Note: Compass pills will be added here after day 1 when player makes choices */}
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
              dilemma={{ title: current.title, description: current.description }}
            />
          )}
        </div>
      </div>
    </div>
  );
}