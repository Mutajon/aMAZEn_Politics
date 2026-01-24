// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./App.css";
import { useSettingsStore } from "./store/settingsStore";
import { usePastGamesStore } from "./store/pastGamesStore";
import { useFragmentsStore } from "./store/fragmentsStore";
import { useMirrorDialogueStore } from "./store/mirrorDialogueStore";
import { useLoggingStore, resetLoggingStore } from "./store/loggingStore";
import { useDilemmaStore } from "./store/dilemmaStore";
import { useCompassStore } from "./store/compassStore";
import { useRoleStore } from "./store/roleStore";
import { useHighscoreStore } from "./store/highscoreStore";
import { useQuestionnaireStore } from "./store/questionnaireStore";
import { resetDay2Tutorial } from "./hooks/useDay2Tutorial";

// Disable StrictMode in development to avoid double-invoked effects (which fire duplicate API calls).
const useStrict = import.meta.env.MODE !== "development";

// -------------------- Global Console Commands --------------------
// Add global functions for switching between AI models
(window as any).switchToClaude = () => {
  useSettingsStore.getState().setUseLightDilemmaAnthropic(true);
  useSettingsStore.getState().setUseXAI(false);
  useSettingsStore.getState().setUseGemini(false);
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
  useSettingsStore.getState().setUseGemini(false);
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
  useSettingsStore.getState().setUseGemini(false);
  console.log("✅ Switched to XAI (X.AI/Grok)");
  console.log("📋 Affected: Dilemma generation + Compass pills + Image generation");
  console.log("🔧 Models configured in .env:");
  console.log("   - MODEL_DILEMMA_XAI");
  console.log("   - IMAGE_MODEL_XAI (optional - falls back to OpenAI)");
  console.log("💡 Next dilemma/compass will use XAI API");
  console.log("⚠️  Note: XAI doesn't support image generation yet - will fall back to OpenAI");
};

(window as any).switchToGemini = () => {
  useSettingsStore.getState().setUseLightDilemmaAnthropic(false);
  useSettingsStore.getState().setUseXAI(false);
  useSettingsStore.getState().setUseGemini(true);
  console.log("✅ Switched to Gemini (Google)");
  console.log("📋 Affected: Dilemma generation");
  console.log("🔧 Models configured in .env:");
  console.log("   - MODEL_DILEMMA_GEMINI");
  console.log("💡 Next dilemma will use Gemini API");
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

// Debug command: Kill mom (for testing deceased state)
(window as any).killMom = () => {
  const { momAlive, setMomDead } = useDilemmaStore.getState();
  if (!momAlive) {
    console.log('💀 Mom is already dead.');
    return;
  }
  setMomDead();
  console.log('💀 Mom has been killed (debug command).');
  console.log('🔧 Support bar should now show deceased state.');
  console.log('💡 Page refresh will restore mom to alive.');

  // Dispatch the mom-died event to show toast
  window.dispatchEvent(new CustomEvent('mom-died', {
    detail: { shortLine: "Debug command executed" }
  }));
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
    console.log(`    Date: ${date}`);
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
  const fragments = useFragmentsStore.getState().getFragmentGameIds();
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

(window as any).resetMirrorDialogue = () => {
  const currentState = useMirrorDialogueStore.getState().firstMirrorDialogue;

  if (currentState) {
    console.log('ℹ️  Mirror dialogue flag is already true (will show full dialogue).');
    return;
  }

  const confirmed = confirm(
    'Reset mirror dialogue flag? This will make the next mirror dialogue visit show the full conversation again.'
  );

  if (confirmed) {
    useMirrorDialogueStore.getState().resetMirrorDialogue();
    console.log('✅ Mirror dialogue flag reset to true. Next visit will show full dialogue.');
    console.log('💡 Navigate to the mirror dialogue screen to see the change.');
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

// Skip to specific scenarios for testing
(window as any).skipToTelAviv = () => {
  useLoggingStore.getState().markExperimentRoleCompleted('Railroad Strike — The Great Upheaval (1877)');
  useDilemmaStore.getState().reset();
  useRoleStore.getState().reset();
  console.log('✅ Railroad Strike marked complete. Tel Aviv unlocked.');
  console.log('💡 Navigate to /role to start Tel Aviv scenario.');
};

(window as any).skipToMars = () => {
  useLoggingStore.getState().markExperimentRoleCompleted('Railroad Strike — The Great Upheaval (1877)');
  useLoggingStore.getState().markExperimentRoleCompleted('Tel Aviv — The Campus Uprising (2025)');
  useDilemmaStore.getState().reset();
  useRoleStore.getState().reset();
  console.log('✅ Railroad Strike + Tel Aviv marked complete. Mars unlocked.');
  console.log('💡 Navigate to /role to start Mars scenario.');
};

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
    useMirrorDialogueStore.getState().resetMirrorDialogue();
    useHighscoreStore.getState().reset();
    useQuestionnaireStore.getState().reset();

    // Tutorial systems
    resetDay2Tutorial();

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
    console.log('   → Mirror dialogue reset');
    console.log('   → Day 2 tutorial reset');
    console.log('   → Highscores reset to defaults');
    console.log('   → New anonymous user ID generated');
    console.log('   → Treatment reset to semiAutonomy');
    console.log('   → Logging queue cleared');
    console.log('💾 User preferences preserved (audio, language, display)');
    console.log('💡 Refresh the page to start fresh!');
  }
};

// Tutorial management
(window as any).resetDay2Tutorial = () => {
  resetDay2Tutorial();
  console.log('✅ Day 2 tutorial reset');
  console.log('💡 Tutorial will show again on next Day 2 playthrough');
};

// Compass values display
(window as any).getCompass = () => {
  const { values, initialCompassSnapshot } = useCompassStore.getState();

  // Component names for each dimension (10 per dimension)
  const labels: Record<string, string[]> = {
    what: ['Truth/Trust', 'Liberty/Agency', 'Equality/Equity', 'Care/Solidarity', 'Create/Courage',
           'Wellbeing', 'Security/Safety', 'Freedom/Responsibility', 'Honor/Sacrifice', 'Sacred/Awe'],
    whence: ['Evidence', 'Public Reason', 'Personal', 'Tradition', 'Revelation',
             'Nature', 'Pragmatism', 'Aesthesis', 'Fidelity', 'Law (Office)'],
    how: ['Law/Std.', 'Deliberation', 'Mobilize', 'Markets', 'Mutual Aid',
          'Ritual', 'Design', 'Enforce', 'Civic Culture', 'Philanthropy'],
    whither: ['Self', 'Family', 'Friends', 'In-Group', 'Nation',
              'Civiliz.', 'Humanity', 'Earth', 'Cosmos', 'God'],
  };

  const dimensionNames: Record<string, string> = {
    what: 'WHAT (Values)',
    whence: 'WHENCE (Sources)',
    how: 'HOW (Methods)',
    whither: 'WHITHER (Beneficiaries)',
  };

  console.log('🧭 COMPASS VALUES (0-10 scale):');
  console.log('');

  let totalSum = 0;
  for (const dim of ['what', 'whence', 'how', 'whither'] as const) {
    console.log(`📊 ${dimensionNames[dim]}:`);
    const vals = values[dim];
    const dimLabels = labels[dim];

    for (let i = 0; i < 10; i++) {
      const val = vals[i] ?? 0;
      totalSum += val;
      const bar = '█'.repeat(val) + '░'.repeat(10 - val);
      const initial = initialCompassSnapshot ? initialCompassSnapshot[dim][i] : null;
      const delta = initial !== null ? val - initial : null;
      const deltaStr = delta !== null && delta !== 0
        ? ` (${delta > 0 ? '+' : ''}${delta})`
        : '';
      console.log(`  ${dimLabels[i].padEnd(22)} ${bar} ${val}${deltaStr}`);
    }
    console.log('');
  }

  console.log(`📈 Total compass points: ${totalSum}/400`);
  if (initialCompassSnapshot) {
    const initialSum = Object.values(initialCompassSnapshot).flat().reduce((a, b) => a + b, 0);
    const change = totalSum - initialSum;
    console.log(`   Change since quiz: ${change > 0 ? '+' : ''}${change}`);
  }
  console.log('');
  console.log('💡 Values change based on your choices during gameplay');

  return values;
};

// -------------------- Email Testing Commands --------------------
// Test email configuration
(window as any).testEmailConfig = async () => {
  try {
    console.log('📧 Testing email configuration...');
    const response = await fetch('/api/test-email-config');
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Email configuration is valid');
      console.log('📨 Ready to send notifications');
    } else {
      console.log('❌ Email configuration test failed');
      console.log('⚠️  Check EMAIL_USER and EMAIL_PASS in .env');
    }
    return result;
  } catch (error) {
    console.error('❌ Failed to test email config:', error);
  }
};

// Send a test threshold email
(window as any).testThresholdEmail = async (gamesRemaining = 50) => {
  try {
    console.log(`📧 Sending test threshold email for ${gamesRemaining} games remaining...`);
    const response = await fetch('/api/test-threshold-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gamesRemaining })
    });
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Test email sent successfully');
      console.log('📬 Check the recipient inbox');
    } else {
      console.log('❌ Failed to send test email');
    }
    return result;
  } catch (error) {
    console.error('❌ Failed to send test email:', error);
  }
};

// Reset email flag (allows sending threshold email again)
(window as any).resetEmailFlag = async () => {
  try {
    console.log('🔄 Resetting email flag...');
    const response = await fetch('/api/reset-email-flag', { method: 'POST' });
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Email flag reset successfully');
      console.log('📧 Threshold email can be sent again');
    }
    return result;
  } catch (error) {
    console.error('❌ Failed to reset email flag:', error);
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
