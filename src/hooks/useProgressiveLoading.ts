// src/hooks/useProgressiveLoading.ts
// Progressive loading system that reveals analysis results from top to bottom
// Replaces useDayProgression with sequential API calls and floating loading card

import { useState, useCallback } from "react";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { useCompassStore } from "../store/compassStore";
import { useSettingsStore } from "../store/settingsStore";
import { useDynamicParameters } from "./useDynamicParameters";
import { buildEnhancedContext } from "../lib/contextualDilemmaAnalysis";
import type { SupportValues } from "../lib/contextualDilemmaAnalysis";

export type ProgressiveStage =
  | 'hidden'       // All content hidden, no loading card
  | 'support'      // Support analysis loading/complete
  | 'news'         // News ticker loading/complete
  | 'parameters'   // Dynamic parameters loading/complete
  | 'dilemma'      // Dilemma loading/complete, narration starts
  | 'mirror'       // Mirror text + compass pills loading/complete
  | 'actions'      // Action cards loading/complete
  | 'complete';    // All done, loading card removed

interface ProgressiveLoadingState {
  currentStage: ProgressiveStage;
  isLoading: boolean;
  loadingCardPosition: number; // Y position from top in pixels
  completedStages: Set<ProgressiveStage>;
}

interface ProgressiveLoadingProps {
  onDilemmaRevealed?: () => void; // Callback to trigger narration
}

export function useProgressiveLoading(props?: ProgressiveLoadingProps) {
  const [state, setState] = useState<ProgressiveLoadingState>({
    currentStage: 'hidden',
    isLoading: false,
    loadingCardPosition: 100, // Start near top
    completedStages: new Set(),
  });

  const {
    lastChoice,
    day,
    totalDays,
    recentTopics,
    topicCounts,
    addDilemmaTopic,
  } = useDilemmaStore();

  const { selectedRole, analysis } = useRoleStore();
  const { values: compassValues } = useCompassStore();
  const { dilemmasSubjectEnabled, dilemmasSubject } = useSettingsStore();
  const { generateParameters, resetParameters } = useDynamicParameters();

  // Enhanced dilemma generation with context
  const generateContextualDilemma = useCallback(async (supportValues: SupportValues) => {
    try {
      if (!selectedRole || !analysis) {
        console.warn("[useProgressiveLoading] Missing role or analysis data");
        return;
      }

      const context = buildEnhancedContext(
        lastChoice,
        day,
        totalDays,
        analysis.systemName || "Democracy",
        selectedRole,
        analysis.holders || [],
        analysis.playerIndex || 0,
        supportValues,
        compassValues,
        recentTopics,
        topicCounts,
        dilemmasSubjectEnabled,
        dilemmasSubject
      );

      const response = await fetch("/api/dilemma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRole,
          systemName: analysis.systemName,
          holders: analysis.holders?.map(h => ({ name: h.name, weight: h.percent })) || [],
          playerIndex: analysis.playerIndex,
          compassValues: flattenCompassValues(compassValues),
          settings: { dilemmasSubjectEnabled, dilemmasSubject },
          day: context.currentDay,
          totalDays: context.totalDays,
          supports: supportValues,
          enhancedContext: context,
          lastChoice: lastChoice,
          recentTopics: recentTopics,
          topicCounts: topicCounts,
        }),
      });

      if (response.ok) {
        const newDilemma = await response.json();

        if (newDilemma.topic) {
          addDilemmaTopic(newDilemma.topic);
        }

        // Update dilemma store with new content
        useDilemmaStore.setState({
          current: {
            title: newDilemma.title,
            description: newDilemma.description,
            actions: newDilemma.actions
          },
          loading: false,
          error: null
        });

        console.log("[useProgressiveLoading] New dilemma loaded:", newDilemma.title);
      }
    } catch (error) {
      console.error("[useProgressiveLoading] Failed to generate contextual dilemma:", error);
    }
  }, [
    selectedRole,
    analysis,
    lastChoice,
    day,
    totalDays,
    compassValues,
    recentTopics,
    topicCounts,
    dilemmasSubjectEnabled,
    dilemmasSubject,
    addDilemmaTopic
  ]);

  // Sequential API call chain
  const runSequentialAnalysis = useCallback(async (
    supportValues: SupportValues,
    actionText?: string,
    analyzeSupport?: (text: string) => Promise<any[]>,
    applySupportEffects?: (effects: any[]) => void,
    updateNewsAfterAction?: (actionData: any) => void
  ) => {
    console.log("[useProgressiveLoading] Starting sequential analysis");

    // 1. Support Analysis (first, most important)
    setState(prev => ({ ...prev, currentStage: 'support', loadingCardPosition: 180 }));
    if (actionText && analyzeSupport && applySupportEffects) {
      try {
        console.log("[useProgressiveLoading] Running support analysis");
        const effects = await analyzeSupport(actionText);
        applySupportEffects(effects);
        setState(prev => ({
          ...prev,
          completedStages: new Set([...prev.completedStages, 'support']),
          loadingCardPosition: 280 // Push down after support reveals
        }));
        // Small delay to show the support changes
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (error) {
        console.error("[useProgressiveLoading] Support analysis failed:", error);
      }
    }

    // 2. News Updates
    setState(prev => ({ ...prev, currentStage: 'news', loadingCardPosition: 350 }));
    try {
      console.log("[useProgressiveLoading] Updating news");
      if (updateNewsAfterAction && actionText) {
        // Extract action data for news update
        const [title, summary] = actionText.split('. ');
        updateNewsAfterAction({ title, summary, cost: 0 });
      }
      setState(prev => ({
        ...prev,
        completedStages: new Set([...prev.completedStages, 'news']),
        loadingCardPosition: 420 // Push down after news reveals
      }));
      await new Promise(resolve => setTimeout(resolve, 600));
    } catch (error) {
      console.error("[useProgressiveLoading] News update failed:", error);
    }

    // 3. Dynamic Parameters
    setState(prev => ({ ...prev, currentStage: 'parameters', loadingCardPosition: 490 }));
    try {
      console.log("[useProgressiveLoading] Generating dynamic parameters");
      await generateParameters();
      setState(prev => ({
        ...prev,
        completedStages: new Set([...prev.completedStages, 'parameters']),
        loadingCardPosition: 580 // Push down after parameters reveal
      }));
      await new Promise(resolve => setTimeout(resolve, 600));
    } catch (error) {
      console.error("[useProgressiveLoading] Parameters generation failed:", error);
    }

    // 4. New Dilemma
    setState(prev => ({ ...prev, currentStage: 'dilemma', loadingCardPosition: 650 }));
    try {
      console.log("[useProgressiveLoading] Generating new dilemma");
      await generateContextualDilemma(supportValues);
      setState(prev => ({
        ...prev,
        completedStages: new Set([...prev.completedStages, 'dilemma']),
        loadingCardPosition: 750 // Push down after dilemma reveals
      }));

      // Trigger narration when dilemma is revealed
      if (props?.onDilemmaRevealed) {
        props.onDilemmaRevealed();
      }

      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (error) {
      console.error("[useProgressiveLoading] Dilemma generation failed:", error);
    }

    // 5. Mirror (compass analysis removed - now happens in Phase 2 data collection)
    setState(prev => ({ ...prev, currentStage: 'mirror', loadingCardPosition: 850 }));
    setState(prev => ({
      ...prev,
      completedStages: new Set([...prev.completedStages, 'mirror']),
      loadingCardPosition: 950 // Push down after mirror reveals
    }));
    await new Promise(resolve => setTimeout(resolve, 400));

    // 6. Action Cards (final stage)
    setState(prev => ({ ...prev, currentStage: 'actions' }));
    await new Promise(resolve => setTimeout(resolve, 400));

    // Mark as complete and remove loading card
    setState(prev => ({
      ...prev,
      currentStage: 'complete',
      isLoading: false,
      completedStages: new Set([...prev.completedStages, 'actions', 'complete'])
    }));

    console.log("[useProgressiveLoading] Sequential analysis complete");
  }, [generateParameters, generateContextualDilemma, props]);

  // Main progressive loading orchestration
  const startProgressiveLoading = useCallback(async (
    supportValues: SupportValues,
    actionText?: string,
    analyzeSupport?: (text: string) => Promise<any[]>,
    applySupportEffects?: (effects: any[]) => void,
    updateNewsAfterAction?: (actionData: any) => void
  ) => {
    console.log("[useProgressiveLoading] Starting progressive loading flow");

    // Reset and hide all elements
    setState({
      currentStage: 'hidden',
      isLoading: true,
      loadingCardPosition: 100,
      completedStages: new Set(),
    });

    // Reset dynamic parameters for new day
    resetParameters();

    // Small delay to let coin animation finish and elements hide
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Start sequential analysis
    await runSequentialAnalysis(
      supportValues,
      actionText,
      analyzeSupport,
      applySupportEffects,
      updateNewsAfterAction
    );
  }, [runSequentialAnalysis, resetParameters]);

  // First day loading - clean sequence as specified by user with AI request sequencing
  const startFirstDayLoading = useCallback(async (supportValues: SupportValues) => {
    console.log("[useProgressiveLoading] Starting first day loading flow with AI request sequencing");

    // STEP 1: Show Resource bar + Support list immediately (DON'T hide everything first)
    setState({
      currentStage: 'support',
      isLoading: true,
      loadingCardPosition: 200,
      completedStages: new Set(['support']), // Support is immediately available
    });

    // Small delay to let support list render
    await new Promise(resolve => setTimeout(resolve, 400));

    // STEP 2: Start AI request sequencing in background while revealing News ticker
    console.log("[useProgressiveLoading] Starting background AI requests: news → dilemma (first day sequence)");

    // Start dilemma generation early (slowest, starts first)
    const dilemmaPromise = generateContextualDilemma(supportValues);

    // News ticker doesn't need AI on first day, just reveal it after brief delay
    await new Promise(resolve => setTimeout(resolve, 200));
    setState(prev => ({
      ...prev,
      currentStage: 'news',
      completedStages: new Set([...prev.completedStages, 'news']),
      loadingCardPosition: 300
    }));
    console.log("[useProgressiveLoading] News ticker revealed");
    await new Promise(resolve => setTimeout(resolve, 600));

    // STEP 3: Show Player status strip (no AI needed on first day), move floater down
    setState(prev => ({
      ...prev,
      currentStage: 'parameters',
      completedStages: new Set([...prev.completedStages, 'parameters']),
      loadingCardPosition: 380
    }));
    console.log("[useProgressiveLoading] Player status strip revealed");
    await new Promise(resolve => setTimeout(resolve, 800));

    // STEP 4: Wait for dilemma generation to complete, then reveal
    setState(prev => ({ ...prev, currentStage: 'dilemma', loadingCardPosition: 460 }));
    console.log("[useProgressiveLoading] Waiting for dilemma generation to complete");

    try {
      // Wait for the dilemma that started generating earlier
      await dilemmaPromise;

      // Verify we have a real dilemma
      const currentDilemma = useDilemmaStore.getState().current;
      if (!currentDilemma || (currentDilemma as any)._isFallback) {
        console.warn("[useProgressiveLoading] Dilemma generation may have failed, but continuing");
      }

      setState(prev => ({
        ...prev,
        completedStages: new Set([...prev.completedStages, 'dilemma']),
        loadingCardPosition: 540
      }));

      // Trigger narration when dilemma is revealed
      if (props?.onDilemmaRevealed) {
        props.onDilemmaRevealed();
      }
    } catch (error) {
      console.error("[useProgressiveLoading] Dilemma generation failed:", error);
      // Even if dilemma fails, mark as complete to continue sequence
      setState(prev => ({
        ...prev,
        completedStages: new Set([...prev.completedStages, 'dilemma']),
        loadingCardPosition: 540
      }));
    }
    await new Promise(resolve => setTimeout(resolve, 800));

    // STEP 5: Reveal Mirror text (no generation needed on first day)
    setState(prev => ({
      ...prev,
      currentStage: 'mirror',
      completedStages: new Set([...prev.completedStages, 'mirror']),
      loadingCardPosition: 620
    }));
    console.log("[useProgressiveLoading] Mirror text revealed for first day");
    await new Promise(resolve => setTimeout(resolve, 400));

    // STEP 6: Show Action deck and remove floater completely
    setState(prev => ({
      ...prev,
      currentStage: 'complete',
      completedStages: new Set([...prev.completedStages, 'actions']),
      isLoading: false // This removes the floater
    }));

    console.log("[useProgressiveLoading] First day loading complete - sequence finished");
  }, [props, generateContextualDilemma]);

  // Reset to initial state
  const resetProgressiveLoading = useCallback(() => {
    setState({
      currentStage: 'hidden',
      isLoading: false,
      loadingCardPosition: 100,
      completedStages: new Set(),
    });
  }, []);

  // Helper functions for component visibility - STRICT GATES
  const shouldShowResourceBar = state.completedStages.has('support') || state.currentStage === 'complete';
  const shouldShowSupportList = state.completedStages.has('support') || state.currentStage === 'complete';
  const shouldShowNewsTicker = state.completedStages.has('news') || state.currentStage === 'complete';
  const shouldShowPlayerStatus = state.completedStages.has('parameters') || state.currentStage === 'complete';
  const shouldShowDilemma = state.completedStages.has('dilemma') || state.currentStage === 'complete';
  const shouldShowMirror = state.completedStages.has('mirror') || state.currentStage === 'complete';
  const shouldShowActionDeck = state.completedStages.has('actions') || state.currentStage === 'complete';
  const shouldShowLoadingCard = state.isLoading && state.currentStage !== 'complete';

  // Debug logging for gates
  console.log("[useProgressiveLoading] Boolean Gates:", {
    currentStage: state.currentStage,
    completedStages: Array.from(state.completedStages),
    shouldShowResourceBar,
    shouldShowSupportList,
    shouldShowNewsTicker,
    shouldShowPlayerStatus,
    shouldShowDilemma,
    shouldShowMirror,
    shouldShowActionDeck,
    shouldShowLoadingCard
  });

  // Legacy compatibility
  const shouldShowSupport = shouldShowSupportList;
  const shouldShowNews = shouldShowNewsTicker;
  const shouldShowParameters = shouldShowPlayerStatus;
  const shouldShowActions = shouldShowActionDeck;

  return {
    // State
    currentStage: state.currentStage,
    isLoading: state.isLoading,
    loadingCardPosition: state.loadingCardPosition,

    // Strict Boolean Gates
    shouldShowResourceBar,
    shouldShowSupportList,
    shouldShowNewsTicker,
    shouldShowPlayerStatus,
    shouldShowDilemma,
    shouldShowMirror,
    shouldShowActionDeck,
    shouldShowLoadingCard,

    // Legacy compatibility
    shouldShowSupport,
    shouldShowNews,
    shouldShowParameters,
    shouldShowActions,

    // Methods
    startProgressiveLoading,
    startFirstDayLoading,
    resetProgressiveLoading,
  };
}

// Helper function to flatten compass values for API
function flattenCompassValues(compassValues: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of ["what", "whence", "how", "whither"] as const) {
    const arr = Array.isArray(compassValues?.[k]) ? compassValues[k] : [];
    for (let i = 0; i < 10; i++) {
      const v = Math.max(0, Math.min(10, Math.round(arr[i] ?? 0)));
      out[`${k}${i}`] = v;
    }
  }
  return out;
}