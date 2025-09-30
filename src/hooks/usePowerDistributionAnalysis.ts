/**
 * usePowerDistributionAnalysis.ts
 *
 * Handles AI-powered role analysis, political system classification, and data processing.
 * Manages the complex logic for fetching and transforming power distribution data.
 *
 * Used by: PowerDistributionScreen.tsx
 * Uses: roleStore.ts, validation.ts, politicalSystems.ts
 */

import { useEffect } from "react";
import type { AnalysisResult, PowerHolder } from "../store/roleStore";
import { AIConnectionError } from "../lib/validation";
import { POLITICAL_SYSTEMS } from "../data/politicalSystems";
import type { FetchState, EnhancedPowerHolder } from "./usePowerDistributionState";

// AI Analysis API call
async function fetchAnalysis(role: string): Promise<AnalysisResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch("/api/analyze-role", {
      method: "POST",
      body: JSON.stringify({ role }),
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 504) throw new AIConnectionError("AI analysis timed out");
      try {
        const j = await res.json();
        if (j?.error) throw new AIConnectionError(String(j.error));
      } catch {}
      throw new AIConnectionError(`AI analysis failed (HTTP ${res.status})`);
    }

    return (await res.json()) as AnalysisResult;
  } catch (e: any) {
    if (e?.name === "AbortError") throw new AIConnectionError("AI analysis timed out");
    if (e instanceof AIConnectionError) throw e;
    throw new AIConnectionError("Cannot reach AI analysis service");
  } finally {
    clearTimeout(timer);
  }
}

// Icon assignment logic
function getIconKeyPool() {
  return [
    "Crown","Shield","Coins","Landmark","BookOpen","Gavel","Scale","Swords",
    "Users","Flame","Building2","Banknote","ScrollText",
  ] as const;
}

function pickIconKeyByName(name: string, used: Set<string>): string {
  const n = name.toLowerCase();
  const pool = getIconKeyPool();

  const keywordMap: Array<[RegExp, string]> = [
    [/(king|queen|monarch|emperor|crown|royal)/i, "Crown"],
    [/(army|military|defense|security|guard|police)/i, "Shield"],
    [/(treasury|finance|budget|tax|economic|bank)/i, "Coins"],
    [/(congress|parliament|legislature|senate|assembly)/i, "Landmark"],
    [/(education|school|university|academic|research)/i, "BookOpen"],
    [/(court|judge|justice|legal|law)/i, "Gavel"],
    [/(balance|equality|rights|civil)/i, "Scale"],
    [/(war|conflict|battle|combat|force)/i, "Swords"],
    [/(people|citizen|public|popular|folk)/i, "Users"],
    [/(revolution|rebel|uprising|protest|movement)/i, "Flame"],
    [/(corporate|business|industry|company)/i, "Building2"],
    [/(commerce|trade|market|merchant)/i, "Banknote"],
    [/(bureaucrat|official|administration|clerk)/i, "ScrollText"],
  ];

  for (const [regex, key] of keywordMap) {
    if (regex.test(n) && !used.has(key)) {
      used.add(key);
      return key;
    }
  }

  // Fallback: pick first available from pool
  for (const key of pool) {
    if (!used.has(key)) {
      used.add(key);
      return key;
    }
  }

  return "HelpCircle"; // Ultimate fallback
}

// Text normalization for player matching
function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function inferPlayerIndex(roleText: string, holders: PowerHolder[]): number | null {
  const roleSet = new Set(normalizeTokens(roleText));
  let bestIdx = -1;
  let bestScore = 0;

  holders.forEach((h, i) => {
    const nameSet = new Set(normalizeTokens(h.name));
    let score = 0;
    nameSet.forEach((t) => {
      if (roleSet.has(t)) score++;
    });
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });

  if (bestScore > 0) return bestIdx;
  return holders.length > 0 ? 0 : null; // default to the strongest holder if nothing matched
}

// Data processing and decoration
function coerceAndDecorate(
  raw: PowerHolder[],
  playerIndex: number | null,
  makeId: () => string,
  clampPct: (n: number) => number
): { holders: EnhancedPowerHolder[]; playerHolderId: string | null } {
  let base = (raw || []).filter((h) => (h?.name ?? "").trim().length > 0);

  if (base.length > 5) base = [...base].sort((a, b) => b.percent - a.percent).slice(0, 5);

  const sum = base.reduce((s, h) => s + (h.percent ?? 0), 0);
  if (sum > 0 && sum !== 100) {
    const factor = 100 / sum;
    base = base.map((h) => ({ ...h, percent: clampPct((h.percent ?? 0) * factor) }));
    let diff = 100 - base.reduce((s, h) => s + h.percent, 0);
    for (let i = 0; diff !== 0 && i < base.length; i++) {
      base[i].percent += diff > 0 ? 1 : -1;
      diff += diff > 0 ? -1 : 1;
    }
  }

  // semantic, no-duplicate icons (override any incoming)
  const used = new Set<string>();
  const withIcons = base.map((h) => ({ ...h, icon: pickIconKeyByName(h.name ?? "", used) }));
  const holders = withIcons.map((h) => ({ ...h, _id: makeId() }));

  const playerHolderId =
    playerIndex != null && playerIndex >= 0 && playerIndex < holders.length ? holders[playerIndex]._id : null;

  return { holders, playerHolderId };
}

// Political system classification fallback
function classifyPoliticalSystem(role: string, holders: PowerHolder[]) {
  const r = role.toLowerCase();
  const h0 = holders[0]?.name?.toLowerCase() || "";

  // Simple keyword matching based on role and top holder
  const keywordMap = [
    { keywords: ["king", "queen", "monarch", "emperor", "absolute"], system: "Absolute Monarchy" },
    { keywords: ["parliament", "pm", "minister"], system: "Parliamentary Democracy" },
    { keywords: ["president", "congress"], system: "Presidential Democracy" },
    { keywords: ["federal", "state"], system: "Federal Republic" },
    { keywords: ["people", "communist", "party"], system: "People's Republic" },
    { keywords: ["direct", "referendum"], system: "Direct Democracy" },
    { keywords: ["military", "junta"], system: "Military Junta" },
  ];

  for (const { keywords, system } of keywordMap) {
    for (const keyword of keywords) {
      if (r.includes(keyword) || h0.includes(keyword)) {
        const found = POLITICAL_SYSTEMS.find((s) => s.name === system);
        if (found) return found;
      }
    }
  }

  return POLITICAL_SYSTEMS.find((s) => s.name === "Representative Democracy") || POLITICAL_SYSTEMS[0];
}

interface UsePowerDistributionAnalysisProps {
  role: string | null;
  analysisStore: any;
  setState: (state: FetchState) => void;
  setError: (error: string | null) => void;
  setAnalysis: (analysis: any) => void;
  initializeData: (
    holders: EnhancedPowerHolder[],
    playerHolderId: string | null,
    systemName: string,
    systemDesc: string,
    systemFlavor: string
  ) => void;
  push: (route: string) => void;
  makeId: () => string;
  clampPct: (n: number) => number;
}

export function usePowerDistributionAnalysis({
  role,
  analysisStore,
  setState,
  setError,
  setAnalysis,
  initializeData,
  push,
  makeId,
  clampPct,
}: UsePowerDistributionAnalysisProps) {
  useEffect(() => {
    if (!role) {
      push("/role");
      return;
    }

    async function run() {
      setState("loading");
      setError(null);
      try {
        // If we already have holders, reuse; else fetch
        const base: AnalysisResult =
          analysisStore?.holders?.length ? (analysisStore as AnalysisResult) : await fetchAnalysis(role!);

        const inferredIndex =
          base.playerIndex != null ? base.playerIndex : inferPlayerIndex(role!, base.holders ?? []);

        const { holders: decorated, playerHolderId } =
          coerceAndDecorate(base.holders ?? [], inferredIndex, makeId, clampPct);

        // Prefer what the API just returned (server enforces canonical names via ALLOWED_SYSTEMS).
        let name = (base.systemName || "").trim();
        let desc = (base.systemDesc || "").trim();
        let flavor = (base.flavor || "").trim();

        // If RoleSelection primed a system (predefined roles), it wins.
        if (analysisStore?.systemName?.trim()) {
          name = analysisStore.systemName.trim();
          desc = (analysisStore.systemDesc || "").trim();
          flavor = (analysisStore.flavor || "").trim();
        }

        // As a final fallback only (extremely rare now), run the local classifier.
        if (!name) {
          const pick = classifyPoliticalSystem(role!, decorated.map(({ _id, ...r }) => r));
          name = pick.name;
          desc = pick.description;
          flavor = pick.flavor;
        }

        // Initialize the component state
        initializeData(decorated, playerHolderId, name, desc, flavor);

        // Save current snapshot (strip _id) + political system fields
        setAnalysis({
          ...base,
          systemName: name,
          systemDesc: desc,
          flavor,
          holders: decorated.map(({ _id, ...rest }) => rest),
          playerIndex: playerHolderId != null
            ? decorated.findIndex((h) => h._id === playerHolderId)
            : inferredIndex,
        });

        setState("done");
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong");
        setState("error");
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return {
    fetchAnalysis,
    classifyPoliticalSystem,
  };
}