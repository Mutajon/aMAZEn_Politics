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
  localStorage.setItem('debugMode', 'true');
  console.log('✅ Debug mode enabled. Refresh page to see changes.');
  console.log('🎯 Features: "Jump to Final Day" button, extra console logs');
};

(window as any).disableDebug = () => {
  localStorage.removeItem('debugMode');
  console.log('❌ Debug mode disabled. Refresh page to see changes.');
};

(window as any).toggleDebug = () => {
  const current = localStorage.getItem('debugMode') === 'true';
  if (current) {
    localStorage.removeItem('debugMode');
    console.log('❌ Debug mode disabled. Refresh page to see changes.');
  } else {
    localStorage.setItem('debugMode', 'true');
    console.log('✅ Debug mode enabled. Refresh page to see changes.');
    console.log('🎯 Features: "Jump to Final Day" button, extra console logs');
  }
};

// Log available commands
console.log("🎮 Available console commands:");
console.log("  switchToClaude() - Use Anthropic Claude (configured in .env)");
console.log("  switchToGPT()    - Use OpenAI GPT (configured in .env)");
console.log("  enableDebug()    - Enable debug mode (shows jump button, extra logs)");
console.log("  disableDebug()   - Disable debug mode");
console.log("  toggleDebug()    - Toggle debug mode on/off");
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
