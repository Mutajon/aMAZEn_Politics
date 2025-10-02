// src/hooks/useDayProgression.ts
// Orchestrates day progression flow following the enhanced event screen plan

import { useState, useCallback } from "react";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { useCompassStore } from "../store/compassStore";
import { useSettingsStore } from "../store/settingsStore";
import { useDynamicParameters } from "./useDynamicParameters";
import { buildEnhancedContext } from "../lib/contextualDilemmaAnalysis";
import type { SupportValues } from "../lib/contextualDilemmaAnalysis";
import { useRevealSequence } from "./useRevealSequence";

interface DayProgressionProps {
  onDilemmaRevealed?: () => void;
}

export function useDayProgression(props?: DayProgressionProps) {
  const [isAnimatingDayCounter, setIsAnimatingDayCounter] = useState(false);
  const revealSequence = useRevealSequence({
    onDilemmaRevealed: props?.onDilemmaRevealed
  });

  const {
    dayProgression,
    startDayProgression,
    setAnalysisComplete,
    endDayProgression,
    loadNext: loadNextDilemma,
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

  // Check if all analyses are complete
  const allAnalysesComplete = useCallback(() => {
    const { analysisComplete } = dayProgression;
    return Object.values(analysisComplete).every(complete => complete);
  }, [dayProgression]);

  // Enhanced dilemma generation with context
  const generateContextualDilemma = useCallback(async (supportValues: SupportValues) => {
    try {
      if (!selectedRole || !analysis) {
        console.warn("[useDayProgression] Missing role or analysis data");
        setAnalysisComplete('contextualDilemma');
        return;
      }

      // Build enhanced context following NewDilemmaLogic.md
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

      // Generate new dilemma with enhanced context
      const response = await fetch("/api/dilemma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Existing dilemma request format
          role: selectedRole,
          systemName: analysis.systemName,
          holders: analysis.holders?.map(h => ({ name: h.name, weight: h.percent })) || [],
          playerIndex: analysis.playerIndex,
          compassValues: flattenCompassValues(compassValues),
          settings: { dilemmasSubjectEnabled, dilemmasSubject },
          day: context.currentDay,
          totalDays: context.totalDays,
          supports: supportValues,

          // Enhanced context for NewDilemmaLogic.md
          enhancedContext: context,
          lastChoice: lastChoice,
          recentTopics: recentTopics,
          topicCounts: topicCounts,
        }),
      });

      if (response.ok) {
        const newDilemma = await response.json();

        // Extract topic from dilemma for tracking (Rule #9)
        if (newDilemma.topic) {
          addDilemmaTopic(newDilemma.topic);
        }

        // Directly update the current dilemma in the store
        useDilemmaStore.setState({
          current: {
            title: newDilemma.title,
            description: newDilemma.description,
            actions: newDilemma.actions
          },
          loading: false,
          error: null
        });

        console.log("[useDayProgression] New dilemma loaded:", newDilemma.title);
      }

      setAnalysisComplete('contextualDilemma');
    } catch (error) {
      console.error("[useDayProgression] Failed to generate contextual dilemma:", error);
      setAnalysisComplete('contextualDilemma'); // Mark complete even on error to avoid blocking
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
    setAnalysisComplete,
    addDilemmaTopic
  ]);

  // Enhanced mirror recommendation with contextual dilemma
  const generateContextualMirrorRecommendation = useCallback(async () => {
    try {
      // This will be handled by the existing mirror system but with enhanced context
      // The mirror system should automatically update when the new dilemma is available
      setAnalysisComplete('mirror');
    } catch (error) {
      console.error("[useDayProgression] Failed to generate mirror recommendation:", error);
      setAnalysisComplete('mirror');
    }
  }, [setAnalysisComplete]);

  // Update news with contextual information
  const updateContextualNews = useCallback(async () => {
    try {
      // This will be handled by the existing news system
      // News should update based on the last choice and new day context
      setAnalysisComplete('news');
    } catch (error) {
      console.error("[useDayProgression] Failed to update news:", error);
      setAnalysisComplete('news');
    }
  }, [setAnalysisComplete]);

  // Enhanced support analysis with day progression context
  const runSupportAnalysis = useCallback(async (actionText: string, analyzeSupport?: (text: string) => Promise<any[]>, applySupportEffects?: (effects: any[]) => void) => {
    try {
      if (analyzeSupport && applySupportEffects) {
        console.log("[useDayProgression] Running support analysis for:", actionText);
        const effects = await analyzeSupport(actionText);
        applySupportEffects(effects);
        console.log("[useDayProgression] Support analysis complete, effects applied");
      }
      setAnalysisComplete('support');
    } catch (error) {
      console.error("[useDayProgression] Failed to analyze support:", error);
      setAnalysisComplete('support');
    }
  }, [setAnalysisComplete]);

  // Enhanced compass analysis with day progression context
  const runCompassAnalysis = useCallback(async (actionText: string, analyzeText?: (text: string) => Promise<unknown>) => {
    try {
      if (analyzeText) {
        console.log("[useDayProgression] Running compass analysis for:", actionText);
        await analyzeText(actionText);
        console.log("[useDayProgression] Compass analysis complete");
      }
      setAnalysisComplete('compass');
    } catch (error) {
      console.error("[useDayProgression] Failed to analyze compass:", error);
      setAnalysisComplete('compass');
    }
  }, [setAnalysisComplete]);

  // Parallel analysis pipeline
  const runAnalysisPipeline = useCallback(async (
    supportValues: SupportValues,
    actionText?: string,
    analyzeText?: (text: string) => Promise<unknown>,
    analyzeSupport?: (text: string) => Promise<any[]>,
    applySupportEffects?: (effects: any[]) => void
  ) => {
    console.log("[useDayProgression] Starting analysis pipeline");

    // Prepare all analyses
    const analyses = [
      generateParameters().then(() => setAnalysisComplete('dynamic')), // Dynamic parameters
      generateContextualDilemma(supportValues), // Enhanced dilemma with context
      generateContextualMirrorRecommendation(), // Mirror advice
      updateContextualNews(), // News updates
    ];

    // Add support and compass analyses if we have the action text and functions
    if (actionText) {
      analyses.push(runSupportAnalysis(actionText, analyzeSupport, applySupportEffects));
      analyses.push(runCompassAnalysis(actionText, analyzeText));
    } else {
      // If no action text, mark them as complete immediately
      analyses.push(Promise.resolve().then(() => setAnalysisComplete('support')));
      analyses.push(Promise.resolve().then(() => setAnalysisComplete('compass')));
    }

    // Run all analyses in parallel
    const results = await Promise.allSettled(analyses);

    // Log any failed analyses
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const analysisNames = ['dynamic', 'contextualDilemma', 'mirror', 'news', 'support', 'compass'];
        console.warn(`[useDayProgression] Analysis failed: ${analysisNames[index]}`, result.reason);
      }
    });

    console.log("[useDayProgression] Analysis pipeline complete");
  }, [generateParameters, generateContextualDilemma, generateContextualMirrorRecommendation, updateContextualNews, setAnalysisComplete, runSupportAnalysis, runCompassAnalysis]);

  // Animate day counter with rotating effect
  const animateDayCounter = useCallback(async () => {
    return new Promise<void>((resolve) => {
      setIsAnimatingDayCounter(true);

      // Simulate rotating counter animation
      setTimeout(() => {
        setIsAnimatingDayCounter(false);
        resolve();
      }, 2000); // 2 second animation
    });
  }, []);

  // Proceed with day counter animation and reveal
  const proceedWithDayTransition = useCallback(async () => {
    console.log("[useDayProgression] All analyses complete, proceeding with day transition");

    // 5. Animate day counter
    await animateDayCounter();

    // 6. Wait 1 second as specified
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 7. End day progression overlay
    endDayProgression();

    // 8. Start sequential reveal of analysis results
    console.log("[useDayProgression] Starting sequential reveal of analysis results");
    await revealSequence.startRevealSequence();

    console.log("[useDayProgression] Day progression complete");
  }, [animateDayCounter, endDayProgression, revealSequence]);

  // Main day progression orchestration
  const startDayProgressionFlow = useCallback(async (
    supportValues: SupportValues,
    actionText?: string,
    analyzeText?: (text: string) => Promise<unknown>,
    analyzeSupport?: (text: string) => Promise<any[]>,
    applySupportEffects?: (effects: any[]) => void
  ) => {
    console.log("[useDayProgression] Starting day progression flow with support values:", supportValues);

    // 1. Start day progression overlay
    startDayProgression();
    revealSequence.resetReveal();
    console.log("[useDayProgression] Day progression overlay started, reveal sequence reset");

    // 2. Reset dynamic parameters for new day
    resetParameters();
    console.log("[useDayProgression] Parameters reset");

    // 3. Run parallel analysis pipeline
    await runAnalysisPipeline(supportValues, actionText, analyzeText, analyzeSupport, applySupportEffects);
    console.log("[useDayProgression] Analysis pipeline completed");

    // 4. All analyses are complete, proceed with day transition
    console.log("[useDayProgression] All analyses complete, proceeding with day transition");
    await proceedWithDayTransition();
  }, [
    startDayProgression,
    resetParameters,
    runAnalysisPipeline,
    proceedWithDayTransition
  ]);

  return {
    // State
    dayProgression,
    isAnimatingDayCounter,
    allAnalysesComplete: allAnalysesComplete(),
    revealSequence,

    // Methods
    startDayProgressionFlow,
    setAnalysisComplete,

    // Helper for external analysis completion
    markAnalysisComplete: setAnalysisComplete,
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