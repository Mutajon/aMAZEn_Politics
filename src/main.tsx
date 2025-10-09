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
(window as any).switchToClaudeHaiku = () => {
  useSettingsStore.getState().setUseLightDilemmaAnthropic(true);
  console.log("✅ Switched to Claude 3.5 Haiku for dilemma generation");
  console.log("Model:", "claude-3-5-haiku-latest");
  console.log("Next dilemma will use Anthropic API");
};

(window as any).switchToGPT5 = () => {
  useSettingsStore.getState().setUseLightDilemmaAnthropic(false);
  console.log("✅ Switched to GPT-5 for dilemma generation");
  console.log("Model:", "gpt-5");
  console.log("Next dilemma will use OpenAI API");
};

// Log available commands
console.log("🎮 Available console commands:");
console.log("  switchToClaudeHaiku() - Use Claude 3.5 Haiku for dilemmas");
console.log("  switchToGPT5()        - Use GPT-5 for dilemmas");
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
