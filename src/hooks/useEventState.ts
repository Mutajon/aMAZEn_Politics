// src/hooks/useEventState.ts
import React, { useState, useRef } from "react";
import { useRoleStore, type PowerHolder } from "../store/roleStore";
import { DefaultSupportIcons } from "../components/event/SupportList";
import { pickIconForHolder } from "../lib/powerHolderIcon";

// Types extracted from EventScreen
export type Trio = { people: number; middle: number; mom: number };

export type SupportDeltas = {
  people: number | null;
  middle: number | null;
  mom: number | null;
};

export type SupportTrends = {
  people: "up" | "down" | null;
  middle: "up" | "down" | null;
  mom: "up" | "down" | null;
};

export type SupportNotes = {
  people: string;
  middle: string;
  mom: string;
};

const EMPTY_HOLDERS: Readonly<PowerHolder[]> = Object.freeze([]);

// Keep support % in [0,100] and round to int
const clampPercent = (n: number): number =>
  Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export function useEventState() {
  // Support trio local demo state
  const [vals, setVals] = useState<Trio>({ people: 50, middle: 50, mom: 50 });
  const [delta, setDelta] = useState<number | null>(null);
  const [trend, setTrend] = useState<"up" | "down" | null>(null);

  // Per-entity delta/trend for SupportList (so bars can show independent changes)
  const [supportDeltas, setSupportDeltas] = useState<SupportDeltas>({
    people: null,
    middle: null,
    mom: null,
  });

  const [supportTrends, setSupportTrends] = useState<SupportTrends>({
    people: null,
    middle: null,
    mom: null,
  });

  // Short witty reason per entity (wired into SupportList "note")
  const [supportNotes, setSupportNotes] = useState<SupportNotes>({
    people: "",
    middle: "",
    mom: "",
  });

  // Middle support entity dynamic label/icon
  const [middleLabel, setMiddleLabel] = useState<string>("Congress");
  const [middleIcon, setMiddleIcon] = useState<React.ReactNode>(
    React.createElement(DefaultSupportIcons.BuildingIcon, { className: "w-4 h-4" })
  );
  const didInitMiddleRef = useRef(false);

  // Budget state
  const [budget, setBudget] = useState(1500); // demo value

  // Pull holders & playerIndex from role analysis
  const holdersSnap = useRoleStore((s) => s.analysis?.holders as PowerHolder[] | undefined);
  const playerIndex = useRoleStore((s) => s.analysis?.playerIndex ?? null);

  // Initialize middle label/icon based on role analysis
  const initializeMiddleSupport = () => {
    // Narrow to a stable, typed array
    const holders: ReadonlyArray<PowerHolder> = holdersSnap ?? EMPTY_HOLDERS;

    if (didInitMiddleRef.current) return;
    if (holders.length === 0) return;

    // Map with explicit types, then exclude the player (if any)
    const withIndex: Array<PowerHolder & { i: number }> = holders.map(
      (h: PowerHolder, i: number) => ({ ...h, i })
    );
    const candidates: Array<PowerHolder & { i: number }> =
      playerIndex == null ? withIndex : withIndex.filter((h) => h.i !== playerIndex);

    if (candidates.length === 0) return;

    // Pick the highest percent among the rest
    const top = candidates.reduce((a, b) => (b.percent > a.percent ? b : a), candidates[0]);

    setMiddleLabel(top.name || "Congress");
    setMiddleIcon(pickIconForHolder(top.name || ""));
    didInitMiddleRef.current = true;
  };

  return {
    // Support state
    vals,
    setVals,
    delta,
    setDelta,
    trend,
    setTrend,
    supportDeltas,
    setSupportDeltas,
    supportTrends,
    setSupportTrends,
    supportNotes,
    setSupportNotes,

    // Middle support
    middleLabel,
    setMiddleLabel,
    middleIcon,
    setMiddleIcon,
    didInitMiddleRef,
    initializeMiddleSupport,

    // Budget
    budget,
    setBudget,

    // Derived data
    holdersSnap,
    playerIndex,

    // Utilities
    clampPercent,
  };
}