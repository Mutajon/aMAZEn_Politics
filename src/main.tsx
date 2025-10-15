// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { useSettingsStore } from "./store/settingsStore";

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
  console.log("✅ Switched to GPT (OpenAI)");
  console.log("📋 Affected: Dilemma generation + Mirror dialogue");
  console.log("🔧 Models configured in .env:");
  console.log("   - MODEL_DILEMMA");
  console.log("   - MODEL_MIRROR");
  console.log("💡 Next dilemma/mirror will use OpenAI API");
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

// Log available commands
console.log("🎮 Available console commands:");
console.log("  switchToClaude()          - Use Anthropic Claude (configured in .env)");
console.log("  switchToGPT()             - Use OpenAI GPT (configured in .env)");
console.log("  enableDebug()             - Enable debug mode (shows jump button, extra logs)");
console.log("  disableDebug()            - Disable debug mode");
console.log("  toggleDebug()             - Toggle debug mode on/off");
console.log("  skipPreviousContext()     - Skip Day 2+ context (diagnose AI failures)");
console.log("  includePreviousContext()  - Include Day 2+ context (normal behavior)");
console.log("  togglePreviousContext()   - Toggle previous context on/off");
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
