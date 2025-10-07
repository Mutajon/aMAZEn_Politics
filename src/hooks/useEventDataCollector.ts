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
import { useSettingsStore } from "../store/settingsStore";
import { COMPONENTS, type PropKey } from "../data/compass-data";
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
  // Post-game flag (Day 8)
  isPostGame?: boolean;
  reactionSummary?: string;  // Only present in post-game

  // Core data (always present except in post-game where dilemma is missing)
  dilemma?: Dilemma;  // Optional in post-game
  mirrorText: string;
  newsItems: TickerItem[];

  // Day 2+ only (null on Day 1)
  supportEffects: SupportEffect[] | null;
  compassPills: CompassPill[] | null;
  dynamicParams: DynamicParam[] | null;

  // Support snapshot (captured BEFORE applying deltas)
  // Used for display: shows "before" values, deltas show change, store has "after" values
  currentSupport: {
    people: number;
    middle: number;
    mom: number;
  };

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
 * Fetch day bundle from unified API endpoint
 * Returns: dilemma + news + mirror + supportEffects + dynamic + compassPills in ONE call
 * OR post-game bundle: reactionSummary + news + mirror + supportEffects + dynamic + compassPills
 * REQUIRED - throws error if fails (NO fallback)
 */
async function fetchDayBundle(): Promise<{
  isPostGame?: boolean;
  reactionSummary?: string;
  dilemma?: Dilemma;
  newsItems: TickerItem[];
  mirrorText: string;
  supportEffects: SupportEffect[] | null;
  dynamicParams: DynamicParam[] | null;
  compassPills: CompassPill[] | null;
}> {
  console.log('[fetchDayBundle] 🚀 Starting unified bundle fetch...');

  const { day } = useDilemmaStore.getState();
  const snapshot = buildSnapshot();

  console.log(`[fetchDayBundle] Fetching bundle for Day ${day}...`);

  const response = await fetch("/api/day-bundle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error(`[fetchDayBundle] ❌ API failed: ${response.status} - ${errorText}`);
    throw new Error(`Day bundle API failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('[fetchDayBundle] ✅ Bundle received, validating...');

  // Check if this is a post-game response
  const isPostGame = data.type === "post-game";

  if (isPostGame) {
    console.log('[fetchDayBundle] 🏁 Post-game bundle detected');

    // Post-game validation
    if (!data.reactionSummary) {
      console.error('[fetchDayBundle] ❌ Missing reaction summary in post-game bundle');
      throw new Error("Invalid post-game bundle: missing reaction summary");
    }

    if (!Array.isArray(data.news)) {
      console.error('[fetchDayBundle] ❌ Invalid news in post-game bundle');
      throw new Error("Invalid post-game bundle: news must be an array");
    }

    if (!data.mirror || !data.mirror.summary) {
      console.error('[fetchDayBundle] ❌ Invalid mirror in post-game bundle');
      throw new Error("Invalid post-game bundle: missing or invalid mirror");
    }

    if (!Array.isArray(data.supportEffects) || data.supportEffects.length === 0) {
      console.error('[fetchDayBundle] ❌ Missing support effects in post-game bundle');
      throw new Error("Invalid post-game bundle: requires support effects");
    }

    console.log('[fetchDayBundle] ✅ Post-game validation passed');
    console.log(`[fetchDayBundle] 📊 Post-game contents: reaction summary, ${data.news.length} news, mirror, ${data.supportEffects?.length || 0} support effects, ${data.dynamic?.length || 0} dynamic params, ${data.compassPills?.length || 0} compass pills`);
  } else {
    // Normal day validation
    if (!data.dilemma || !data.dilemma.title || !data.dilemma.description) {
      console.error('[fetchDayBundle] ❌ Invalid dilemma in bundle:', data.dilemma);
      throw new Error("Invalid bundle: missing or invalid dilemma");
    }

    if (!Array.isArray(data.dilemma.actions) || data.dilemma.actions.length !== 3) {
      console.error('[fetchDayBundle] ❌ Invalid actions in bundle:', data.dilemma.actions);
      throw new Error("Invalid bundle: dilemma must have exactly 3 actions");
    }

    if (!Array.isArray(data.news)) {
      console.error('[fetchDayBundle] ❌ Invalid news in bundle:', data.news);
      throw new Error("Invalid bundle: news must be an array");
    }

    if (!data.mirror || !data.mirror.summary) {
      console.error('[fetchDayBundle] ❌ Invalid mirror in bundle:', data.mirror);
      throw new Error("Invalid bundle: missing or invalid mirror");
    }

    // Day 2+ validation
    if (day > 1) {
      if (!Array.isArray(data.supportEffects) || data.supportEffects.length === 0) {
        console.error('[fetchDayBundle] ❌ Missing support effects on Day 2+');
        throw new Error("Invalid bundle: Day 2+ requires support effects");
      }

      if (!Array.isArray(data.dynamic)) {
        console.error('[fetchDayBundle] ❌ Missing dynamic params on Day 2+');
        throw new Error("Invalid bundle: Day 2+ requires dynamic parameters");
      }
    }

    console.log('[fetchDayBundle] ✅ Validation passed');
    console.log(`[fetchDayBundle] 📊 Bundle contents: dilemma, ${data.news.length} news, mirror, ${data.supportEffects?.length || 0} support effects, ${data.dynamic?.length || 0} dynamic params, ${data.compassPills?.length || 0} compass pills`);
  }

  // Extract and format data
  const dilemma: Dilemma | undefined = isPostGame
    ? undefined
    : {
        title: data.dilemma.title,
        description: data.dilemma.description,
        actions: data.dilemma.actions as [DilemmaAction, DilemmaAction, DilemmaAction],
        topic: data.dilemma.topic
      };

  const reactionSummary: string | undefined = isPostGame
    ? String(data.reactionSummary || "")
    : undefined;

  const newsItems: TickerItem[] = data.news.map((item: any) => ({
    id: String(item.id || `news-${Math.random()}`),
    kind: item.kind === "social" ? "social" : "news",
    tone: ["up", "down", "neutral"].includes(item.tone) ? item.tone : "neutral",
    text: String(item.text || "")
  }));

  const mirrorText = String(data.mirror.summary || "");

  const supportEffects: SupportEffect[] | null = (day === 1 && !isPostGame)
    ? null
    : (data.supportEffects || []).map((effect: any) => ({
        id: effect.id,
        delta: Number(effect.delta || 0),
        explain: String(effect.explain || "")
      }));

  const dynamicParams: DynamicParam[] | null = (day === 1 && !isPostGame)
    ? null
    : (data.dynamic || []).map((param: any) => ({
        id: String(param.id || ""),
        icon: String(param.icon || "AlertTriangle"),
        text: String(param.text || ""),
        tone: ["up", "down", "neutral"].includes(param.tone) ? param.tone : "neutral"
      }));

  // Extract compass pills (Day 2+ or post-game, included in bundle now)
  const compassPills: CompassPill[] | null = (day === 1 && !isPostGame)
    ? null
    : (data.compassPills || []).map((item: any) => {
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
      }).filter(Boolean) as CompassPill[];

  console.log('[fetchDayBundle] 🎉 Bundle processing complete');

  return {
    isPostGame,
    reactionSummary,
    dilemma,
    newsItems,
    mirrorText,
    supportEffects,
    dynamicParams,
    compassPills
  };
}

/**
 * Get top K compass values with names and strengths (not indices)
 * Returns value names for natural language mirror recommendations
 */
function topKWithNames(arr: number[] | undefined, prop: PropKey, k = 2): Array<{ name: string; strength: number }> {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((v, i) => ({
      v: Number(v) || 0,
      i,
      name: COMPONENTS[prop]?.[i]?.short || `${prop} #${i + 1}`,
    }))
    .filter(x => x.v > 0) // Only non-zero values
    .sort((a, b) => b.v - a.v)
    .slice(0, k)
    .map(x => ({ name: x.name, strength: Math.round(x.v * 10) / 10 }));
}

/**
 * Get top overall values across all compass dimensions
 */
function topOverallWithNames(compassValues: any, k = 2): Array<{ name: string; strength: number; dimension: PropKey }> {
  const allValues: Array<{ v: number; name: string; dimension: PropKey }> = [];

  (["what", "whence", "how", "whither"] as PropKey[]).forEach((prop) => {
    const arr = Array.isArray(compassValues?.[prop]) ? compassValues[prop] : [];
    arr.forEach((v: number, i: number) => {
      allValues.push({
        v: Number(v) || 0,
        name: COMPONENTS[prop]?.[i]?.short || `${prop} #${i + 1}`,
        dimension: prop,
      });
    });
  });

  return allValues
    .filter(x => x.v > 0) // Only non-zero values
    .sort((a, b) => b.v - a.v)
    .slice(0, k)
    .map(x => ({
      name: x.name,
      strength: Math.round(x.v * 10) / 10,
      dimension: x.dimension
    }));
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

  // Return the full response to preserve supportEffects for Day 2+
  // The collector will extract what it needs
  return data;
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

  // Calculate top compass components with names (not indices)
  const topWhat = topKWithNames(compassValues?.what, "what", 2);
  const topWhence = topKWithNames(compassValues?.whence, "whence", 2);
  const topOverall = topOverallWithNames(compassValues, 2);

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

    // Check if bundle API mode is enabled
    const { useDayBundleAPI } = useSettingsStore.getState();

    try {
      // ========================================================================
      // BUNDLE MODE: Single unified API call
      // ========================================================================
      if (useDayBundleAPI) {
        console.log('[Collector] 🎯 BUNDLE MODE ENABLED - using unified API');
        setCollectionProgress(10); // Starting bundle request

        try {
          // 1. Capture current support values BEFORE fetching bundle
          // These become the "before" values shown in UI; deltas show change; store gets "after" values
          const { supportPeople, supportMiddle, supportMom } = useDilemmaStore.getState();
          const currentSupport = {
            people: supportPeople,
            middle: supportMiddle,
            mom: supportMom
          };
          console.log(`[Collector] 📸 Support snapshot: people=${currentSupport.people}, middle=${currentSupport.middle}, mom=${currentSupport.mom}`);

          // 2. Fetch complete bundle (dilemma + news + mirror + support + dynamic + compass)
          console.log('[Collector] 📦 Fetching day bundle (includes compass analysis)...');
          const bundle = await fetchDayBundle();
          console.log('[Collector] ✅ Bundle received');
          setCollectionProgress(85); // Bundle received (including compass)

          // 3. Build collected data structure with snapshot
          console.log('[Collector] 🏗️ Building collected data from bundle...');
          const data: CollectedData = {
            isPostGame: bundle.isPostGame,
            reactionSummary: bundle.reactionSummary,
            dilemma: bundle.dilemma,
            mirrorText: bundle.mirrorText,
            newsItems: bundle.newsItems,
            supportEffects: bundle.supportEffects,
            compassPills: bundle.compassPills, // Now included in bundle!
            dynamicParams: bundle.dynamicParams,
            currentSupport, // Snapshot captured before bundle call
            status: {
              dilemmaReady: bundle.isPostGame ? false : !!bundle.dilemma, // No dilemma in post-game
              mirrorReady: true,
              newsReady: bundle.newsItems.length > 0,
              supportReady: (day > 1 || bundle.isPostGame) ? bundle.supportEffects !== null : true,
              compassReady: (day > 1 || bundle.isPostGame) ? bundle.compassPills !== null : true,
              dynamicReady: (day > 1 || bundle.isPostGame) ? bundle.dynamicParams !== null : true
            },
            errors
          };

          console.log('[Collector] 💾 Storing collected data to state');
          setCollectedData(data);

          // Update global dilemma store for narration
          console.log('[Collector] 📢 Updating global dilemmaStore.current for narration');
          useDilemmaStore.setState({ current: bundle.dilemma });

          setCollectionProgress(100); // Complete!
          setIsCollecting(false);
          console.log('[Collector] 🎉 BUNDLE MODE collection complete! Ready for presentation.');
          return;

        } catch (error: any) {
          console.error('[Collector] ❌ BUNDLE MODE failed:', error);
          setCollectionError(`Failed to load game data: ${error.message || 'Unknown error'}. Please try again.`);
          setIsCollecting(false);
          setCollectionProgress(0);
          return;
        }
      }

      // ========================================================================
      // LEGACY MODE: Multiple sequential/parallel API calls
      // ========================================================================
      console.log('[Collector] 🔧 LEGACY MODE - using sequential API calls');

      // Capture current support values BEFORE any API calls
      const { supportPeople, supportMiddle, supportMom } = useDilemmaStore.getState();
      const currentSupport = {
        people: supportPeople,
        middle: supportMiddle,
        mom: supportMom
      };
      console.log(`[Collector] 📸 Support snapshot: people=${currentSupport.people}, middle=${currentSupport.middle}, mom=${currentSupport.mom}`);

      // ========================================================================
      // PHASE 1: Independent Parallel Requests
      // ========================================================================
      console.log('[Collector] 📋 Phase 1: Starting parallel requests...');
      setCollectionProgress(10); // Starting requests

      const phase1Tasks: Promise<any>[] = [
        fetchDilemma(),  // [0] Required - Day 2+ includes supportEffects in response
        fetchNews(),     // [1] Optional
      ];

      // Day 2+ only: Add analysis of previous choice (compass + dynamic params)
      // NOTE: Support analysis now comes FROM the dilemma API response on Day 2+
      const totalTasks = day > 1 && lastChoice ? 5 : 3; // Phase 1 (2-4) + Phase 2 (1)
      if (day > 1 && lastChoice) {
        console.log('[Collector] 📊 Day 2+ detected - adding compass/dynamic analysis');
        phase1Tasks.push(
          fetchCompassPills(lastChoice),     // [2] (was [3])
          fetchDynamicParams(lastChoice)     // [3] (was [4])
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
      const dilemmaResponse = phase1Results[0].value as any; // Can include supportEffects on Day 2+
      console.log('[Collector] ✅ Dilemma received:', dilemmaResponse.title);

      // Extract dilemma data (always present)
      const dilemma: Dilemma = {
        title: dilemmaResponse.title,
        description: dilemmaResponse.description,
        actions: dilemmaResponse.actions
      };

      // Verify dilemma completeness
      if (!dilemma || !dilemma.title || !dilemma.description || dilemma.actions?.length !== 3) {
        console.error('[Collector] ❌ Invalid dilemma data');
        setCollectionError("Invalid dilemma data received");
        setIsCollecting(false);
        return;
      }

      // Extract supportEffects from dilemma response (Day 2+ only)
      let supportEffects: SupportEffect[] | null = null;
      if (day > 1 && dilemmaResponse.supportEffects) {
        supportEffects = dilemmaResponse.supportEffects;
        console.log(`[Collector] ✅ Support effects from dilemma: ${supportEffects?.length || 0} effects`);
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
      let compassPills: CompassPill[] | null = null;
      let dynamicParams: DynamicParam[] | null = null;

      if (day > 1 && lastChoice) {
        console.log('[Collector] 📊 Processing Day 2+ analysis results...');

        // SUPPORT - Now extracted from dilemma response above (no longer a separate API call)
        if (!supportEffects || supportEffects.length === 0) {
          console.warn('[Collector] ⚠️ Support effects missing from dilemma response');
          errors.support = "Support effects not included in dilemma response";
        } else {
          console.log(`[Collector] ✅ Support analysis: ${supportEffects.length} effects`);
        }

        // COMPASS (now at index [2], was [3])
        if (phase1Results[2]?.status === "fulfilled") {
          compassPills = phase1Results[2].value;
          console.log(`[Collector] ✅ Compass analysis: ${compassPills?.length || 0} pills`);
        } else if (phase1Results[2]) {
          console.warn('[Collector] ⚠️ Compass analysis failed');
          errors.compass = phase1Results[2].reason;
        }

        // DYNAMIC (now at index [3], was [4])
        if (phase1Results[3]?.status === "fulfilled") {
          dynamicParams = phase1Results[3].value;
          console.log(`[Collector] ✅ Dynamic params: ${dynamicParams?.length || 0} params`);
        } else if (phase1Results[3]) {
          console.warn('[Collector] ⚠️ Dynamic params failed');
          errors.dynamic = phase1Results[3].reason;
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
        currentSupport, // Snapshot captured at start of collection
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

      // IMPORTANT: Update global dilemma store so useEventNarration can prepare TTS
      // EventScreen3 doesn't use the global store for display, but narration hook needs it
      console.log('[Collector] 📢 Updating global dilemmaStore.current for narration');
      useDilemmaStore.setState({ current: dilemma });

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

      // Day 2+ requires support, compass, and dynamic analysis to be ready
      // These must be true (data successfully loaded), not just defined
      // If they're false, it means data failed to load or hasn't loaded yet
      if (!collectedData.status.supportReady) return false;
      if (!collectedData.status.compassReady) return false;
      if (!collectedData.status.dynamicReady) return false;

      // Also verify the actual data arrays exist (double-check)
      if (!collectedData.supportEffects || collectedData.supportEffects.length === 0) return false;
      if (!collectedData.compassPills || collectedData.compassPills.length === 0) return false;
      // dynamicParams can be empty, that's ok
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
