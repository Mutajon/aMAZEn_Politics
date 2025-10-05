// src/hooks/useEventDataCollector.ts
// EventDataCollector: Gathers ALL data needed for a dilemma screen
//
// Handles:
// - Day 1 vs Day 2+ differences
// - API dependencies (dilemma before mirror)
// - Fallbacks for optional data
// - Errors for required data (dilemma)
//
// Used by: EventScreen3
// Dependencies: dilemmaStore, roleStore, compassStore

import { useState, useCallback } from "react";
import { useDilemmaStore, buildSnapshot } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { useCompassStore } from "../store/compassStore";
import type { Dilemma, DilemmaAction } from "../lib/dilemma";
import type { TickerItem } from "../components/event/NewsTicker";

// ============================================================================
// TYPES
// ============================================================================

export type SupportEffect = {
  id: "people" | "middle" | "mom";
  delta: number;
  explain: string;
};

export type CompassPill = {
  prop: "what" | "whence" | "how" | "whither";
  idx: number;
  delta: number;
};

export type DynamicParam = {
  id: string;
  icon: string;
  text: string;
  tone: "up" | "down" | "neutral";
};

export type CollectedData = {
  // Core data (always present)
  dilemma: Dilemma;
  mirrorText: string;
  newsItems: TickerItem[];

  // Day 2+ only (null on Day 1)
  supportEffects: SupportEffect[] | null;
  compassPills: CompassPill[] | null;
  dynamicParams: DynamicParam[] | null;

  // Status tracking
  status: {
    dilemmaReady: boolean;
    mirrorReady: boolean;
    newsReady: boolean;
    supportReady: boolean;
    compassReady: boolean;
    dynamicReady: boolean;
  };

  // Error tracking (for debugging)
  errors: {
    dilemma?: Error;
    mirror?: Error;
    news?: Error;
    support?: Error;
    compass?: Error;
    dynamic?: Error;
  };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate top K indices from array (for mirror compass analysis)
 * Same logic as mirrorDilemma.ts
 */
function topK(arr: number[] | undefined, k = 3): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((v, i) => ({ v: Number(v) || 0, i }))
    .sort((a, b) => b.v - a.v)
    .slice(0, k)
    .map(x => String(x.i));
}

/**
 * Fetch dilemma from API
 * REQUIRED - throws error if fails (no fallback)
 */
async function fetchDilemma(): Promise<Dilemma> {
  const snapshot = buildSnapshot();

  const response = await fetch("/api/dilemma", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot)
  });

  if (!response.ok) {
    throw new Error(`Dilemma API failed: ${response.status}`);
  }

  const data = await response.json();

  // Validate required fields
  if (!data.title || !data.description || !Array.isArray(data.actions) || data.actions.length !== 3) {
    throw new Error("Invalid dilemma response: missing required fields");
  }

  return {
    title: data.title,
    description: data.description,
    actions: data.actions,
    topic: data.topic || "General"
  } as Dilemma;
}

/**
 * Analyze support changes from previous action (Day 2+ only)
 * Fallback: [] (empty array)
 */
async function fetchSupportAnalysis(lastChoice: DilemmaAction): Promise<SupportEffect[]> {
  const { day, totalDays } = useDilemmaStore.getState();
  const { selectedRole, analysis } = useRoleStore.getState();
  const { values: compassValues } = useCompassStore.getState();

  const text = `${lastChoice.title}. ${lastChoice.summary}`;

  const politicalContext = {
    role: selectedRole,
    systemName: analysis?.systemName,
    day,
    totalDays,
    compassValues
  };

  try {
    const response = await fetch("/api/support-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, politicalContext })
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (error) {
    console.error("[Collector] Support analysis failed:", error);
    return [];
  }
}

/**
 * Analyze compass changes from previous action (Day 2+ only)
 * Fallback: [] (empty array)
 */
async function fetchCompassPills(lastChoice: DilemmaAction): Promise<CompassPill[]> {
  const text = `${lastChoice.title}. ${lastChoice.summary}`;

  try {
    const response = await fetch("/api/compass-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data.items)) return [];

    // Convert API response to pills with delta calculation
    const pills: CompassPill[] = data.items
      .map((item: any) => {
        const prop = item.prop;
        const idx = Number(item.idx);
        const polarity = String(item.polarity || "").toLowerCase();
        const strength = String(item.strength || "").toLowerCase();

        if (!["what", "whence", "how", "whither"].includes(prop)) return null;
        if (!Number.isFinite(idx) || idx < 0 || idx > 9) return null;

        let delta = 0;
        if (polarity === "positive") {
          delta = strength === "strong" ? 2 : 1;
        } else if (polarity === "negative") {
          delta = strength === "strong" ? -2 : -1;
        }

        if (delta === 0) return null;

        return { prop: prop as any, idx, delta };
      })
      .filter(Boolean) as CompassPill[];

    return pills;
  } catch (error) {
    console.error("[Collector] Compass analysis failed:", error);
    return [];
  }
}

/**
 * Fetch dynamic parameters from previous action (Day 2+ only)
 * Fallback: [] (empty array)
 */
async function fetchDynamicParams(lastChoice: DilemmaAction): Promise<DynamicParam[]> {
  const { day, totalDays } = useDilemmaStore.getState();
  const { selectedRole, analysis } = useRoleStore.getState();
  const { values: compassValues } = useCompassStore.getState();

  const politicalContext = {
    role: selectedRole,
    systemName: analysis?.systemName,
    day,
    totalDays,
    compassValues
  };

  try {
    const response = await fetch("/api/dynamic-parameters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastChoice,
        politicalContext
      })
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data.parameters) ? data.parameters : [];
  } catch (error) {
    console.error("[Collector] Dynamic parameters failed:", error);
    return [];
  }
}

/**
 * Fetch news ticker items
 * Day 1: last=null (onboarding mode)
 * Day 2+: last=lastChoice (reaction mode)
 * Fallback: [] (empty array)
 */
async function fetchNews(): Promise<TickerItem[]> {
  const { day, lastChoice } = useDilemmaStore.getState();
  const { selectedRole, analysis } = useRoleStore.getState();

  const payload = {
    day,
    role: selectedRole,
    systemName: analysis?.systemName,
    last: day === 1 ? null : lastChoice  // KEY: Day 1 vs Day 2+ logic
  };

  try {
    const response = await fetch("/api/news-ticker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (error) {
    console.error("[Collector] News ticker failed:", error);
    return [];
  }
}

/**
 * Fetch mirror dialogue with dilemma context
 * REQUIRES: dilemma (from Phase 1)
 * Fallback: "The mirror squints, light pooling in the glass..."
 */
async function fetchMirrorText(dilemma: Dilemma): Promise<string> {
  const { values: compassValues } = useCompassStore.getState();

  // Calculate top compass components
  const topWhat = topK(compassValues?.what, 3);
  const topWhence = topK(compassValues?.whence, 3);
  const topOverall = topK(
    ["what", "whence", "how", "whither"]
      .flatMap(k => (compassValues as any)?.[k] || [])
      .slice(0, 10),
    3
  );

  const payload = {
    topWhat,
    topWhence,
    topOverall,
    dilemma: {
      title: dilemma.title,
      description: dilemma.description,
      actions: dilemma.actions.map(a => ({
        id: a.id,
        title: a.title,
        summary: a.summary,
        cost: a.cost
      }))
    }
  };

  try {
    const response = await fetch("/api/mirror-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return "The mirror squints, light pooling in the glass...";

    const data = await response.json();
    return data.summary || "The mirror squints, light pooling in the glass...";
  } catch (error) {
    console.error("[Collector] Mirror dialogue failed:", error);
    return "The mirror squints, light pooling in the glass...";
  }
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useEventDataCollector() {
  const [collectedData, setCollectedData] = useState<CollectedData | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [collectionProgress, setCollectionProgress] = useState(0);

  const collectData = useCallback(async () => {
    console.log('[Collector] 🚀 Starting data collection...');
    setIsCollecting(true);
    setCollectionError(null);
    setCollectionProgress(0);

    const { day, lastChoice} = useDilemmaStore.getState();
    console.log(`[Collector] Day: ${day}, Has lastChoice: ${!!lastChoice}`);
    const errors: CollectedData["errors"] = {};

    try {
      // ========================================================================
      // PHASE 1: Independent Parallel Requests
      // ========================================================================
      console.log('[Collector] 📋 Phase 1: Starting parallel requests...');
      setCollectionProgress(10); // Starting requests

      const phase1Tasks: Promise<any>[] = [
        fetchDilemma(),  // [0] Required
        fetchNews(),     // [1] Optional
      ];

      // Day 2+ only: Add analysis of previous choice
      const totalTasks = day > 1 && lastChoice ? 6 : 3; // Phase 1 (2-5) + Phase 2 (1)
      if (day > 1 && lastChoice) {
        console.log('[Collector] 📊 Day 2+ detected - adding support/compass/dynamic analysis');
        phase1Tasks.push(
          fetchSupportAnalysis(lastChoice),  // [2]
          fetchCompassPills(lastChoice),     // [3]
          fetchDynamicParams(lastChoice)     // [4]
        );
      }

      console.log(`[Collector] 🔄 Awaiting ${phase1Tasks.length} parallel requests...`);
      setCollectionProgress(25); // Requests sent
      const phase1Results = await Promise.allSettled(phase1Tasks);
      console.log('[Collector] ✅ Phase 1 complete');
      setCollectionProgress(60); // Phase 1 done

      // ========================================================================
      // Extract Phase 1 Results
      // ========================================================================
      console.log('[Collector] 📦 Extracting Phase 1 results...');

      // DILEMMA (REQUIRED - stop if failed)
      if (phase1Results[0].status === "rejected") {
        const error = phase1Results[0].reason;
        console.error('[Collector] ❌ Dilemma fetch FAILED:', error);
        setCollectionError(`Failed to load dilemma: ${error.message}`);
        setIsCollecting(false);
        return;
      }
      const dilemma = phase1Results[0].value as Dilemma;
      console.log('[Collector] ✅ Dilemma received:', dilemma.title);

      // Verify dilemma completeness
      if (!dilemma || !dilemma.title || !dilemma.description || dilemma.actions?.length !== 3) {
        console.error('[Collector] ❌ Invalid dilemma data');
        setCollectionError("Invalid dilemma data received");
        setIsCollecting(false);
        return;
      }

      // NEWS (Optional - use fallback)
      let newsItems: TickerItem[] = [];
      if (phase1Results[1].status === "fulfilled") {
        newsItems = phase1Results[1].value;
        console.log(`[Collector] ✅ News received: ${newsItems.length} items`);
      } else {
        console.warn('[Collector] ⚠️ News fetch failed, using fallback');
        errors.news = phase1Results[1].reason;
      }

      // Day 2+ results (Optional - use null fallback)
      let supportEffects: SupportEffect[] | null = null;
      let compassPills: CompassPill[] | null = null;
      let dynamicParams: DynamicParam[] | null = null;

      if (day > 1 && lastChoice) {
        console.log('[Collector] 📊 Processing Day 2+ analysis results...');

        // SUPPORT
        if (phase1Results[2]?.status === "fulfilled") {
          supportEffects = phase1Results[2].value;
          console.log(`[Collector] ✅ Support analysis: ${supportEffects?.length || 0} effects`);
        } else if (phase1Results[2]) {
          console.warn('[Collector] ⚠️ Support analysis failed');
          errors.support = phase1Results[2].reason;
        }

        // COMPASS
        if (phase1Results[3]?.status === "fulfilled") {
          compassPills = phase1Results[3].value;
          console.log(`[Collector] ✅ Compass analysis: ${compassPills?.length || 0} pills`);
        } else if (phase1Results[3]) {
          console.warn('[Collector] ⚠️ Compass analysis failed');
          errors.compass = phase1Results[3].reason;
        }

        // DYNAMIC
        if (phase1Results[4]?.status === "fulfilled") {
          dynamicParams = phase1Results[4].value;
          console.log(`[Collector] ✅ Dynamic params: ${dynamicParams?.length || 0} params`);
        } else if (phase1Results[4]) {
          console.warn('[Collector] ⚠️ Dynamic params failed');
          errors.dynamic = phase1Results[4].reason;
        }
      }

      // ========================================================================
      // PHASE 2: Dependent Request (needs dilemma from Phase 1)
      // ========================================================================
      console.log('[Collector] 📋 Phase 2: Fetching mirror dialogue...');
      setCollectionProgress(70); // Starting Phase 2

      const phase2Results = await Promise.allSettled([
        fetchMirrorText(dilemma)  // Requires dilemma context
      ]);

      setCollectionProgress(85); // Phase 2 done

      // MIRROR (Optional - use fallback)
      let mirrorText = "The mirror squints, light pooling in the glass...";
      if (phase2Results[0].status === "fulfilled") {
        mirrorText = phase2Results[0].value;
        console.log('[Collector] ✅ Mirror dialogue received');
      } else {
        console.warn('[Collector] ⚠️ Mirror dialogue failed, using fallback');
        errors.mirror = phase2Results[0].reason;
      }

      // ========================================================================
      // Build & Store Collected Data
      // ========================================================================
      console.log('[Collector] 🏗️ Building collected data structure...');
      setCollectionProgress(95); // Building data

      const data: CollectedData = {
        dilemma,
        mirrorText,
        newsItems,
        supportEffects,
        compassPills,
        dynamicParams,
        status: {
          dilemmaReady: true,
          mirrorReady: !!mirrorText,
          newsReady: newsItems.length > 0,
          supportReady: day > 1 ? supportEffects !== null : true,
          compassReady: day > 1 ? compassPills !== null : true,
          dynamicReady: day > 1 ? dynamicParams !== null : true
        },
        errors
      };

      console.log('[Collector] 💾 Storing collected data to state');
      setCollectedData(data);
      setCollectionProgress(100); // Complete!
      setIsCollecting(false);
      console.log('[Collector] 🎉 Collection complete! Ready for presentation.');

    } catch (error: any) {
      console.error("[Collector] ❌ Unexpected error:", error);
      setCollectionError(`Collection failed: ${error.message}`);
      setIsCollecting(false);
      setCollectionProgress(0);
    }
  }, []);

  // Comprehensive verification: ALL required data must be present before triggering presenter
  const isFullyReady = useCallback(() => {
    if (!collectedData) return false;

    const { day } = useDilemmaStore.getState();

    // REQUIRED for all days
    if (!collectedData.dilemma) return false;
    if (!collectedData.dilemma.title) return false;
    if (!collectedData.dilemma.description) return false;
    if (collectedData.dilemma.actions?.length !== 3) return false;

    // Mirror and news are optional (have fallbacks) but should be verified
    if (!collectedData.mirrorText) return false;
    // newsItems can be empty array, that's ok

    // Day 2+ REQUIRED data verification
    if (day > 1) {
      const { lastChoice } = useDilemmaStore.getState();
      if (!lastChoice) return false; // Should have previous choice on Day 2+

      // These can be null (failed to load) but status tracking must exist
      if (collectedData.status.supportReady === undefined) return false;
      if (collectedData.status.compassReady === undefined) return false;
      if (collectedData.status.dynamicReady === undefined) return false;
    }

    return true;
  }, [collectedData]);

  return {
    collectedData,        // ← Temp saved for EventDataPresenter
    isCollecting,
    collectionError,
    collectionProgress,   // ← Progress percentage (0-100)
    collectData,
    isReady: isFullyReady()  // ← Reliable counter - only true when ALL data present
  };
}
