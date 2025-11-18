// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { useSettingsStore } from "./store/settingsStore";
import { usePastGamesStore } from "./store/pastGamesStore";
import { useFragmentsStore } from "./store/fragmentsStore";
import { useLoggingStore, resetLoggingStore } from "./store/loggingStore";
import { useDilemmaStore } from "./store/dilemmaStore";
import { useCompassStore } from "./store/compassStore";
import { useRoleStore } from "./store/roleStore";
import { useHighscoreStore } from "./store/highscoreStore";

// Disable StrictMode in development to avoid double-invoked effects (which fire duplicate API calls).
const useStrict = import.meta.env.MODE !== "development";

// -------------------- Global Console Commands --------------------
// Add global functions for switching between AI models
(window as any).switchToClaude = () => {
  useSettingsStore.getState().setUseLightDilemmaAnthropic(true);
  console.log("✅ Switched to Claude (Anthropic)");
  console.log("📋 Affected: Dilemma generation + Mirror dialogue");
  console.log("🔧 Models configured in .env:");
  console.log("   - MODEL_DILEMMA_ANTHROPIC");
  console.log("   - MODEL_MIRROR_ANTHROPIC");
  console.log("💡 Next dilemma/mirror will use Anthropic API");
};

(window as any).switchToGPT = () => {
  useSettingsStore.getState().setUseLightDilemmaAnthropic(false);
  useSettingsStore.getState().setUseXAI(false);
  console.log("✅ Switched to GPT (OpenAI)");
  console.log("📋 Affected: Dilemma generation + Mirror dialogue + Image generation");
  console.log("🔧 Models configured in .env:");
  console.log("   - MODEL_DILEMMA");
  console.log("   - MODEL_MIRROR");
  console.log("   - IMAGE_MODEL");
  console.log("💡 Next dilemma/mirror/avatar will use OpenAI API");
};

(window as any).switchToXAI = () => {
  useSettingsStore.getState().setUseLightDilemmaAnthropic(false);
  useSettingsStore.getState().setUseXAI(true);
  console.log("✅ Switched to XAI (X.AI/Grok)");
  console.log("📋 Affected: Dilemma generation + Compass pills + Image generation");
  console.log("🔧 Models configured in .env:");
  console.log("   - MODEL_DILEMMA_XAI");
  console.log("   - IMAGE_MODEL_XAI (optional - falls back to OpenAI)");
  console.log("💡 Next dilemma/compass will use XAI API");
  console.log("⚠️  Note: XAI doesn't support image generation yet - will fall back to OpenAI");
};

// Debug mode toggle commands
(window as any).enableDebug = () => {
  useSettingsStore.getState().setDebugMode(true);
  console.log('✅ Debug mode enabled immediately (no refresh needed).');
  console.log('🎯 Features: "Jump to Final Day" button, extra console logs');
};

(window as any).disableDebug = () => {
  useSettingsStore.getState().setDebugMode(false);
  console.log('❌ Debug mode disabled immediately (no refresh needed).');
};

(window as any).toggleDebug = () => {
  const current = useSettingsStore.getState().debugMode;
  useSettingsStore.getState().setDebugMode(!current);
  if (!current) {
    console.log('✅ Debug mode enabled immediately (no refresh needed).');
    console.log('🎯 Features: "Jump to Final Day" button, extra console logs');
  } else {
    console.log('❌ Debug mode disabled immediately (no refresh needed).');
  }
};

// Previous context debug commands (for diagnosing Day 2+ failures)
(window as any).skipPreviousContext = () => {
  useSettingsStore.getState().setSkipPreviousContext(true);
  console.log('✅ Skipping previous context on Day 2+ (treating as Day 1)');
  console.log('🔧 This bypasses sending previous dilemma data to AI');
  console.log('💡 Useful for diagnosing if Day 2+ failures are context-related');
};

(window as any).includePreviousContext = () => {
  useSettingsStore.getState().setSkipPreviousContext(false);
  console.log('✅ Including previous context on Day 2+ (normal behavior)');
  console.log('🔧 AI will receive previous dilemma + choice for continuity');
};

(window as any).togglePreviousContext = () => {
  const current = useSettingsStore.getState().skipPreviousContext;
  useSettingsStore.getState().setSkipPreviousContext(!current);
  if (!current) {
    console.log('✅ Skipping previous context on Day 2+ (treating as Day 1)');
    console.log('🔧 This bypasses sending previous dilemma data to AI');
  } else {
    console.log('✅ Including previous context on Day 2+ (normal behavior)');
    console.log('🔧 AI will receive previous dilemma + choice for continuity');
  }
};

// Corruption tracking toggle commands
(window as any).enableCorruption = () => {
  useSettingsStore.getState().setCorruptionTrackingEnabled(true);
  console.log('✅ Corruption tracking enabled immediately (no refresh needed).');
  console.log('🔸 Features: Corruption pills appear on Day 2+, AI judges power misuse');
  console.log('💡 Corruption level tracked internally (0-100 scale)');
};

(window as any).disableCorruption = () => {
  useSettingsStore.getState().setCorruptionTrackingEnabled(false);
  console.log('❌ Corruption tracking disabled immediately (no refresh needed).');
};

(window as any).toggleCorruption = () => {
  const current = useSettingsStore.getState().corruptionTrackingEnabled;
  useSettingsStore.getState().setCorruptionTrackingEnabled(!current);
  if (!current) {
    console.log('✅ Corruption tracking enabled immediately (no refresh needed).');
    console.log('🔸 Features: Corruption pills appear on Day 2+, AI judges power misuse');
  } else {
    console.log('❌ Corruption tracking disabled immediately (no refresh needed).');
  }
};

// Democracy rating access (hidden axis for analysis)
(window as any).showDemocracy = () => {
  const democracyRating = (window as any).__democracyRating;
  const allRatings = (window as any).__allRatings;

  if (!democracyRating) {
    console.log('❌ No democracy rating available yet.');
    console.log('💡 Play through to the Aftermath screen first.');
    return;
  }

  console.log('📊 HIDDEN DEMOCRACY RATING (not shown in UI):');
  console.log(`   Democracy: ${democracyRating}`);
  console.log('');
  console.log('📋 All calculated ratings:');
  console.log(`   Autonomy: ${allRatings.autonomy}`);
  console.log(`   Liberalism: ${allRatings.liberalism}`);
  console.log(`   Democracy: ${allRatings.democracy} (hidden)`);
  console.log('');
  console.log('ℹ️  Democracy measures: "Who authors the rules and exceptions?"');
  console.log('   - High: Broad/inclusive authorship, real checks/vetoes');
  console.log('   - Low: Concentrated elite control, weak checks');
};

(window as any).getDemocracy = (window as any).showDemocracy; // Alias for convenience

// Past games storage access commands
(window as any).getPastGames = () => {
  const games = usePastGamesStore.getState().getGames();

  if (games.length === 0) {
    console.log('📭 No past games stored yet.');
    console.log('💡 Complete a playthrough to the Aftermath screen to save your first game.');
    return;
  }

  console.log(`📚 PAST GAMES (${games.length}/10):`);
  console.log('');

  games.forEach((game: any, index: number) => {
    const date = new Date(game.timestamp).toLocaleString();
    console.log(`[${index + 1}] ${game.playerName} — ${game.roleTitle}`);
    console.log(`    System: ${game.systemName} | Score: ${game.finalScore}`);
    console.log(`    Support: People=${game.supportPeople} Middle=${game.supportMiddle} MoM=${game.supportMom}`);
    console.log(`    Corruption: ${game.corruptionLevel} | Date: ${date}`);
    console.log(`    Legacy: "${game.legacy}"`);
    console.log(`    Snapshot Events: ${game.snapshotHighlights.length} highlights`);
    console.log(`    Top Compass: ${game.topCompassValues.length} values`);
    console.log(`    GameId: ${game.gameId}`);
    console.log('');
  });

  console.log(`💾 Total storage: ${games.length}/10 games`);
  console.log('💡 Use exportPastGames() to export as JSON');
  console.log('🗑️  Use clearPastGames() to clear all stored games');

  return games; // Return for programmatic access
};

(window as any).clearPastGames = () => {
  const gamesCount = usePastGamesStore.getState().getGames().length;

  if (gamesCount === 0) {
    console.log('📭 No past games to clear.');
    return;
  }

  const confirmed = confirm(
    `Are you sure you want to delete all ${gamesCount} past game(s)? This cannot be undone.`
  );

  if (confirmed) {
    usePastGamesStore.getState().clearAll();
    console.log(`✅ Cleared ${gamesCount} past game(s) from localStorage.`);
  } else {
    console.log('❌ Clear cancelled.');
  }
};

(window as any).exportPastGames = () => {
  const games = usePastGamesStore.getState().getGames();

  if (games.length === 0) {
    console.log('📭 No past games to export.');
    return null;
  }

  const json = JSON.stringify(games, null, 2);
  console.log('📦 EXPORTED PAST GAMES (JSON):');
  console.log(json);
  console.log('');
  console.log(`✅ Exported ${games.length} game(s).`);
  console.log('💡 Copy the JSON above to save or share your game history.');

  // Also copy to clipboard if available
  if (navigator.clipboard) {
    navigator.clipboard.writeText(json).then(() => {
      console.log('📋 JSON copied to clipboard!');
    }).catch(() => {
      console.log('⚠️  Could not copy to clipboard automatically.');
    });
  }

  return games; // Return for programmatic access
};

// Fragment collection commands
(window as any).getFragments = () => {
  const fragments = useFragmentsStore.getState().fragmentGameIds;
  const fragmentCount = useFragmentsStore.getState().getFragmentCount();
  const firstIntro = useFragmentsStore.getState().firstIntro;
  const hasAllFragments = useFragmentsStore.getState().hasCompletedThreeFragments();

  console.log('🧩 FRAGMENT COLLECTION STATUS:');
  console.log('');
  console.log(`First Intro: ${firstIntro ? '✅ True (will show full dialog)' : '❌ False (will show abbreviated)'}`);
  console.log(`Fragments Collected: ${fragmentCount}/3`);
  console.log(`All Fragments Complete: ${hasAllFragments ? '✅ Yes' : '❌ No'}`);
  console.log('');

  if (fragmentCount === 0) {
    console.log('📭 No fragments collected yet.');
    console.log('💡 Complete a playthrough to collect your first fragment.');
  } else {
    console.log('Fragment Game IDs:');
    fragments.forEach((gameId: string, index: number) => {
      console.log(`  ${index + 1}. ${gameId}`);
    });
  }

  console.log('');
  console.log('💡 Use clearFragments() to reset for testing');
  console.log('💡 Use resetIntro() to reset first intro flag');

  return { fragments, fragmentCount, firstIntro, hasAllFragments };
};

(window as any).clearFragments = () => {
  const fragmentCount = useFragmentsStore.getState().getFragmentCount();

  if (fragmentCount === 0) {
    console.log('📭 No fragments to clear.');
    return;
  }

  const confirmed = confirm(
    `Are you sure you want to delete all ${fragmentCount} fragment(s)? This cannot be undone.`
  );

  if (confirmed) {
    useFragmentsStore.getState().clearFragments();
    console.log(`✅ Cleared ${fragmentCount} fragment(s).`);
  } else {
    console.log('❌ Clear cancelled.');
  }
};

(window as any).resetIntro = () => {
  const currentState = useFragmentsStore.getState().firstIntro;

  if (currentState) {
    console.log('ℹ️  First intro flag is already true (will show full dialog).');
    return;
  }

  const confirmed = confirm(
    'Reset first intro flag? This will make the next intro visit show the full dialog again.'
  );

  if (confirmed) {
    useFragmentsStore.getState().resetIntro();
    console.log('✅ First intro flag reset to true. Next visit will show full dialog.');
  } else {
    console.log('❌ Reset cancelled.');
  }
};

// ========================================================================
// Experiment Mode Management
// ========================================================================
(window as any).getExperimentProgress = () => {
  const { experimentProgress } = useLoggingStore.getState();
  console.log('📊 Experiment Progress:', {
    completedRoles: experimentProgress.completedRoles,
    activeRole: experimentProgress.activeRoleKey,
    completedCount: Object.keys(experimentProgress.completedRoles || {}).length
  });
  return experimentProgress;
};

(window as any).resetExperimentProgress = () => {
  if (confirm('⚠️ Reset experiment progress? This will unlock all 3 roles and clear past games/fragments.')) {
    useLoggingStore.getState().resetExperimentProgress();
    usePastGamesStore.getState().clearAll();
    useFragmentsStore.getState().clearFragments();
    useFragmentsStore.getState().resetIntro();
    console.log('✅ Experiment progress reset! All roles unlocked.');
    console.log('✅ Past games cleared.');
    console.log('✅ Fragments cleared and intro reset.');
    console.log('💡 Refresh the page if you\'re on role selection screen.');
  }
};

(window as any).clearExperimentProgress = (window as any).resetExperimentProgress;

// ========================================================================
// Complete Reset (First-Time Player Experience)
// ========================================================================
(window as any).resetAll = () => {
  if (confirm('⚠️ COMPLETE RESET: This will erase ALL game data (progress, scores, ID) except user preferences (audio, language). Continue?')) {
    // Core game state
    useDilemmaStore.getState().reset();
    useCompassStore.getState().reset();
    useRoleStore.getState().reset();

    // Progression systems
    useLoggingStore.getState().resetExperimentProgress();
    usePastGamesStore.getState().clearAll();
    useFragmentsStore.getState().clearFragments();
    useFragmentsStore.getState().resetIntro();
    useHighscoreStore.getState().reset();

    // User identity & treatment
    resetLoggingStore(); // Generates new userId
    useSettingsStore.getState().setTreatment('semiAutonomy'); // Reset to default

    // Manual cleanup
    localStorage.removeItem('logging_queue_backup');
    localStorage.removeItem('hasSeenTutorial');

    console.log('✅ Complete reset successful!');
    console.log('   → Game state cleared (dilemma/compass/role)');
    console.log('   → Experiment progress reset');
    console.log('   → Past games cleared');
    console.log('   → Fragments cleared, intro reset');
    console.log('   → Highscores reset to defaults');
    console.log('   → New anonymous user ID generated');
    console.log('   → Treatment reset to semiAutonomy');
    console.log('   → Logging queue cleared');
    console.log('💾 User preferences preserved (audio, language, display)');
    console.log('💡 Refresh the page to start fresh!');
  }
};

// HIDDEN FOR EXPERIMENTAL DISTRIBUTION
// Console commands are still available but not advertised to users
// Log available commands
// console.log("🎮 Available console commands:");
// console.log("  switchToClaude()          - Use Anthropic Claude (configured in .env)");
// console.log("  switchToGPT()             - Use OpenAI GPT (configured in .env)");
// console.log("  enableDebug()             - Enable debug mode (shows jump button, extra logs)");
// console.log("  disableDebug()            - Disable debug mode");
// console.log("  toggleDebug()             - Toggle debug mode on/off");
// console.log("  skipPreviousContext()     - Skip Day 2+ context (diagnose AI failures)");
// console.log("  includePreviousContext()  - Include Day 2+ context (normal behavior)");
// console.log("  togglePreviousContext()   - Toggle previous context on/off");
// console.log("  enableCorruption()        - Enable corruption tracking (AI judges power misuse)");
// console.log("  disableCorruption()       - Disable corruption tracking");
// console.log("  toggleCorruption()        - Toggle corruption tracking on/off");
// ----------------------------------------------------------------

ReactDOM.createRoot(document.getElementById("root")!).render(
  useStrict ? (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ) : (
    <App />
  )
);
