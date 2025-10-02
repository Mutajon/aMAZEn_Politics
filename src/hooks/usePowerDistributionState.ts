/**
 * usePowerDistributionState.ts
 *
 * Manages all state for the PowerDistributionScreen component.
 * Handles holder data, political system information, UI state, and form interactions.
 *
 * Used by: PowerDistributionScreen.tsx
 * Uses: roleStore.ts for persistence
 */

import { useState, useRef } from "react";
import { useRoleStore } from "../store/roleStore";
import type { PowerHolder } from "../store/roleStore";

// Local types for enhanced holder data
export type EnhancedPowerHolder = PowerHolder & { _id: string };

export type FetchState = "idle" | "loading" | "error" | "done";

// Utility functions
export function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function rebalance(
  holders: EnhancedPowerHolder[],
  idx: number,
  newValue: number
): EnhancedPowerHolder[] {
  const others = holders.filter((_, i) => i !== idx);
  const othersSum = others.reduce((s, h) => s + h.percent, 0);
  const remaining = 100 - clampPct(newValue);

  if (othersSum <= 0) {
    return holders.map((h, i) => ({ ...h, percent: i === idx ? clampPct(newValue) : 0 }));
  }

  const factor = remaining / othersSum;
  const out = holders.map((h, i) =>
    i === idx ? { ...h, percent: clampPct(newValue) } : { ...h, percent: clampPct(h.percent * factor) }
  );

  let diff = 100 - out.reduce((s, h) => s + h.percent, 0);
  for (let i = 0; diff !== 0 && i < out.length; i++) {
    if (i === idx) continue;
    out[i].percent += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
  }
  return out;
}

export function usePowerDistributionState() {
  // Store connections
  const role = useRoleStore((s) => s.selectedRole);
  const analysisStore = useRoleStore((s) => s.analysis);
  const setAnalysis = useRoleStore((s) => s.setAnalysis);

  // Fetch state
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Power holder data
  const [holders, setHolders] = useState<EnhancedPowerHolder[]>([]);
  const [playerHolderId, setPlayerHolderId] = useState<string | null>(null);

  // Political system data
  const [systemName, setSystemName] = useState<string>("");
  const [systemDesc, setSystemDesc] = useState<string>("");
  const [systemFlavor, setSystemFlavor] = useState<string>("");

  // UI state
  const [showSystemModal, setShowSystemModal] = useState(false);

  // Initial state refs for reset functionality
  const initialHoldersRef = useRef<EnhancedPowerHolder[]>([]);
  const initialPlayerHolderIdRef = useRef<string | null>(null);

  // Handler functions
  const handleChangePercent = (idx: number, value: number) => {
    const updated = rebalance(holders, idx, value);
    updated.sort((a, b) => b.percent - a.percent);
    setHolders(updated);
  };

  const handleChangeName = (id: string, name: string) => {
    setHolders((prev) => prev.map((h) => (h._id === id ? { ...h, name } : h)));
  };

  const handleReset = () => {
    setHolders(initialHoldersRef.current.map((h) => ({ ...h })));
    setPlayerHolderId(initialPlayerHolderIdRef.current);
  };

  const handleLooksGood = () => {
    const a = useRoleStore.getState().analysis;
    if (!a) return;

    const plainHolders: PowerHolder[] = holders.map(({ _id, ...rest }) => rest);
    const newPlayerIndex = playerHolderId != null ? holders.findIndex((h) => h._id === playerHolderId) : a.playerIndex;

    // Save both the edited distribution AND the chosen political system
    useRoleStore.getState().setAnalysis({
      ...a,
      systemName,
      systemDesc,
      flavor: systemFlavor,
      holders: plainHolders,
      playerIndex: newPlayerIndex,
    });
  };


  // State setters for initialization
  const initializeData = (
    newHolders: EnhancedPowerHolder[],
    newPlayerHolderId: string | null,
    newSystemName: string,
    newSystemDesc: string,
    newSystemFlavor: string
  ) => {
    setHolders(newHolders.sort((a, b) => b.percent - a.percent));
    setPlayerHolderId(newPlayerHolderId);
    setSystemName(newSystemName);
    setSystemDesc(newSystemDesc);
    setSystemFlavor(newSystemFlavor);

    // Store initial state for reset
    initialHoldersRef.current = newHolders.map((h) => ({ ...h }));
    initialPlayerHolderIdRef.current = newPlayerHolderId;
  };

  return {
    // Store data
    role,
    analysisStore,
    setAnalysis,

    // Fetch state
    state,
    setState,
    error,
    setError,

    // Power holder data
    holders,
    setHolders,
    playerHolderId,
    setPlayerHolderId,

    // Political system data
    systemName,
    setSystemName,
    systemDesc,
    setSystemDesc,
    systemFlavor,
    setSystemFlavor,

    // UI state
    showSystemModal,
    setShowSystemModal,

    // Refs
    initialHoldersRef,
    initialPlayerHolderIdRef,

    // Handlers
    handleChangePercent,
    handleChangeName,
    handleReset,
    handleLooksGood,

    // Initialization
    initializeData,
  };
}