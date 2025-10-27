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
import { useSettingsStore } from "../store/settingsStore";
import { useLang } from "../i18n/lang";
import { useTranslatedConst, createTranslatedConst } from "../i18n/useTranslatedConst";

export default function PowerDistributionScreen({ push }: { push: PushFn }) {
  const lang = useLang();
  
  // Loading quotes for the overlay
  const LOADING_QUOTES = createTranslatedConst((lang) => [
    lang("POWER_QUOTE_1"),
    lang("POWER_QUOTE_2"),
    lang("POWER_QUOTE_3"),
    lang("POWER_QUOTE_4"),
  ]);
  
  // Use translated constants
  const loadingQuotes = useTranslatedConst(LOADING_QUOTES);
  
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
    initializeData,
  } = state;

  // Memoize the quotes to avoid recreating on every render
  const quotes = useMemo(() => loadingQuotes, [loadingQuotes]);

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

  // Check if modifiers are enabled
  const enableModifiers = useSettingsStore((s) => s.enableModifiers);

  // Enhanced handlers with navigation
  const handleLooksGoodWithNavigation = () => {
    handleLooksGood();
    // Navigate to difficulty screen if modifiers are enabled, otherwise go to compass intro
    if (enableModifiers) {
      push("/difficulty");
    } else {
      push("/compass-intro");
    }
  };

  const handleRetry = () => {
    setState("idle");
  };

  return (
    <div className="min-h-dvh w-full" style={bgStyle}>
      <LoadingOverlay visible={fetchState === "loading"} title={lang("ANALYZING_YOUR_WORLD")} quotes={quotes} />

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
        e12Data={analysisStore?.e12}
        groundingData={analysisStore?.grounding}

        // Handlers
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