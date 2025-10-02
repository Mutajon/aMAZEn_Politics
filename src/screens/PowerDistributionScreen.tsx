/**
 * PowerDistributionScreen.tsx
 *
 * Orchestrates the power distribution analysis and editing interface.
 * Now optimized with extracted hooks and components for better maintainability.
 *
 * Used by: App.tsx router
 * Uses: usePowerDistributionState, usePowerDistributionAnalysis, PowerDistributionContent, LoadingOverlay
 */

import { useMemo } from "react";
import { bgStyle } from "../lib/ui";
import type { PushFn } from "../lib/router";
import LoadingOverlay from "../components/LoadingOverlay";
import PowerDistributionContent from "../components/PowerDistributionContent";
import { usePowerDistributionState, makeId, clampPct } from "../hooks/usePowerDistributionState";
import { usePowerDistributionAnalysis } from "../hooks/usePowerDistributionAnalysis";

// Loading quotes for the overlay
const LOADING_QUOTES = [
  "Power is like water; it flows to the lowest resistance.",
  "Influence is a currency; spend it wisely.",
  "Balance is not equality; it's stability.",
  "Power leaves quietly, but chaos throws a party.",
];

export default function PowerDistributionScreen({ push }: { push: PushFn }) {
  // Extract all state management
  const state = usePowerDistributionState();
  const {
    role,
    analysisStore,
    state: fetchState,
    setState,
    error,
    setError,
    holders,
    playerHolderId,
    systemName,
    systemDesc,
    systemFlavor,
    showSystemModal,
    setShowSystemModal,
    setAnalysis,
    handleChangePercent,
    handleChangeName,
    handleReset,
    handleLooksGood,
    handleBack,
    initializeData,
  } = state;

  // Memoize the quotes to avoid recreating on every render
  const quotes = useMemo(() => LOADING_QUOTES, []);

  // Extract analysis logic
  usePowerDistributionAnalysis({
    role,
    analysisStore,
    setState,
    setError,
    setAnalysis,
    initializeData,
    push,
    makeId,
    clampPct,
  });

  // Enhanced handlers with navigation
  const handleBackWithNavigation = () => {
    handleBack();
    push("/role");
  };

  const handleLooksGoodWithNavigation = () => {
    handleLooksGood();
    push("/name");
  };

  const handleRetry = () => {
    setState("idle");
  };

  return (
    <div className="min-h-dvh w-full" style={bgStyle}>
      <LoadingOverlay visible={fetchState === "loading"} title="Analyzing your world…" quotes={quotes} />

      <PowerDistributionContent
        // State
        state={fetchState}
        error={error}
        holders={holders}
        playerHolderId={playerHolderId}
        systemName={systemName}
        systemDesc={systemDesc}
        systemFlavor={systemFlavor}
        showSystemModal={showSystemModal}

        // Handlers
        onBack={handleBackWithNavigation}
        onRetry={handleRetry}
        onChangePercent={handleChangePercent}
        onChangeName={handleChangeName}
        onReset={handleReset}
        onLooksGood={handleLooksGoodWithNavigation}
        onShowSystemModal={() => setShowSystemModal(true)}
        onHideSystemModal={() => setShowSystemModal(false)}
      />
    </div>
  );
}