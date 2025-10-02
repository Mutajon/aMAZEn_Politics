// src/screens/SplashScreen.tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { bgStyle } from "../lib/ui";
import { useSettingsStore } from "../store/settingsStore";
import { useNarrator } from "../hooks/useNarrator";


export default function SplashScreen({
  onStart,
  onHighscores,
}: {
  onStart: () => void;
  onHighscores?: () => void; // optional, so we don't break existing callers
}) {

  const [showButton, setShowButton] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Instantiate the OpenAI-backed narrator.
  // We call narrator.prime() on the Start button to unlock audio policies.
  const narrator = useNarrator();

  // --- Global settings (persisted via zustand) -----------------------------
  // Image generation
  const generateImages = useSettingsStore((s) => s.generateImages);
  const setGenerateImages = useSettingsStore((s) => s.setGenerateImages);

  // Narration (voiceover)
  const narrationEnabled = useSettingsStore((s) => s.narrationEnabled);
  const setNarrationEnabled = useSettingsStore((s) => s.setNarrationEnabled);
  
  //budget
  const showBudget = useSettingsStore((s) => s.showBudget);
  const setShowBudget = useSettingsStore((s) => s.setShowBudget);
  // Debug mode
const debugMode = useSettingsStore((s) => s.debugMode);
const setDebugMode = useSettingsStore((s) => s.setDebugMode);

// Dilemmas subject
const dilemmasSubjectEnabled = useSettingsStore((s) => s.dilemmasSubjectEnabled);
const setDilemmasSubjectEnabled = useSettingsStore((s) => s.setDilemmasSubjectEnabled);
const dilemmasSubject = useSettingsStore((s) => s.dilemmasSubject);
const setDilemmasSubject = useSettingsStore((s) => s.setDilemmasSubject);

// Enable modifiers
const enableModifiers = useSettingsStore((s) => s.enableModifiers);
const setEnableModifiers = useSettingsStore((s) => s.setEnableModifiers);

  // -------------------------------------------------------------------------

  useEffect(() => {
    const t = setTimeout(() => setShowButton(true), 1000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="relative min-h-[100dvh] flex items-center justify-center px-5"
      style={bgStyle}
    >
      {/* Settings cog (top-right) */}
    {/* Settings cog (top-right) */}
<div className="absolute top-4 right-4 z-[40] pointer-events-auto">
  <button
    onClick={() => setShowSettings((v) => !v)}
    className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 backdrop-blur shadow-sm"
    aria-haspopup="dialog"
    aria-expanded={showSettings}
    aria-label="Settings"
    title="Settings"
  >
    <span aria-hidden className="text-lg leading-none">⚙</span>
  </button>
</div>

{/* Settings panel (fixed, above gear, outside its wrapper) */}
{showSettings && (
  <motion.div
    initial={{ opacity: 0, y: -6, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ type: "spring", stiffness: 260, damping: 20 }}
    // KEY: fixed + higher z + stop propagation so clicks never bubble to the gear
    className="fixed top-16 right-6 z-[90] w-80 rounded-2xl border border-white/10 bg-neutral-900/90 backdrop-blur p-5 text-white/90 shadow-2xl"
    role="dialog"
    aria-label="Settings"
    onClick={(e) => e.stopPropagation()}
  >
    <div className="font-semibold mb-3">Settings</div>

    {/* --- Budget system toggle (same pattern as others) --- */}
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <div className="text-sm font-medium">Budget system</div>
        <div className="text-xs text-white/60">
          Show budget UI and apply costs to decisions.
        </div>
      </div>
      <button
        onClick={() => {
          console.log("[Settings] Budget toggle click, prev =", showBudget);
          setShowBudget(!showBudget);
        }}
        role="switch"
        aria-checked={showBudget}
        className={[
          "w-12 h-7 rounded-full p-1 transition-colors",
          showBudget ? "bg-emerald-500/70" : "bg-white/20",
        ].join(" ")}
      >
        <span
          className={[
            "block w-5 h-5 rounded-full bg-white transition-transform",
            showBudget ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>

    {/* Image generation ----------------------------------------------------- */}
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium">Image generation</div>
        <div className="text-xs text-white/60">
          Generate AI images in-game (default off)
        </div>
      </div>
      <button
        onClick={() => {
          console.log("[Settings] Images toggle click, prev =", generateImages);
          setGenerateImages(!generateImages);
        }}
        role="switch"
        aria-checked={generateImages}
        className={[
          "w-12 h-7 rounded-full p-1 transition-colors",
          generateImages ? "bg-emerald-500/70" : "bg-white/20",
        ].join(" ")}
      >
        <span
          className={[
            "block w-5 h-5 rounded-full bg-white transition-transform",
            generateImages ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>

    <div className="my-4 border-t border-white/10" />

    {/* Narration (voiceover) ----------------------------------------------- */}
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium">Narration (voiceover)</div>
        <div className="text-xs text-white/60">
          Read story text aloud (default on)
        </div>
      </div>
      <button
        onClick={() => {
          console.log("[Settings] Narration toggle click, prev =", narrationEnabled);
          setNarrationEnabled(!narrationEnabled);
        }}
        role="switch"
        aria-checked={narrationEnabled}
        className={[
          "w-12 h-7 rounded-full p-1 transition-colors",
          narrationEnabled ? "bg-emerald-500/70" : "bg-white/20",
        ].join(" ")}
      >
        <span
          className={[
            "block w-5 h-5 rounded-full bg-white transition-transform",
            narrationEnabled ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
    {/* Divider */}
<div className="my-4 border-t border-white/10" />

{/* Debug mode ------------------------------------------------------------- */}
<div className="flex items-center justify-between gap-3">
  <div>
    <div className="text-sm font-medium">Debug mode</div>
    <div className="text-xs text-white/60">
      Show extra UI & logs (default off).
    </div>
  </div>
  <button
    onClick={() => setDebugMode(!debugMode)}
    role="switch"
    aria-checked={debugMode}
    className={[
      "w-12 h-7 rounded-full p-1 transition-colors",
      debugMode ? "bg-emerald-500/70" : "bg-white/20",
    ].join(" ")}
  >
    <span
      className={[
        "block w-5 h-5 rounded-full bg-white transition-transform",
        debugMode ? "translate-x-5" : "translate-x-0",
      ].join(" ")}
    />
  </button>
</div>

{/* Dilemmas subject ------------------------------------------------------- */}
<div className="mt-3">
  <div className="flex items-center justify-between gap-3">
    <div>
      <div className="text-sm font-medium">Dilemmas subject</div>
      <div className="text-xs text-white/60">
        Gate events to a theme (default off).
      </div>
    </div>
    <button
      onClick={() => setDilemmasSubjectEnabled(!dilemmasSubjectEnabled)}
      role="switch"
      aria-checked={dilemmasSubjectEnabled}
      className={[
        "w-12 h-7 rounded-full p-1 transition-colors",
        dilemmasSubjectEnabled ? "bg-emerald-500/70" : "bg-white/20",
      ].join(" ")}
    >
      <span
        className={[
          "block w-5 h-5 rounded-full bg-white transition-transform",
          dilemmasSubjectEnabled ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
    />
    </button>
  </div>

  {/* Subject input: enabled only when toggle is on */}
  <input
    type="text"
    value={dilemmasSubject}
    onChange={(e) => setDilemmasSubject(e.currentTarget.value)}
    placeholder="Subject (e.g., Personal freedom)"
    className={[
      "mt-2 w-full rounded-lg px-3 py-2 bg-white/10 text-white/90 placeholder-white/40 outline-none border",
      dilemmasSubjectEnabled
        ? "border-white/20"
        : "border-white/10 opacity-50 pointer-events-none",
    ].join(" ")}
  />
</div>

{/* Divider */}
<div className="my-4 border-t border-white/10" />

{/* Enable modifiers ------------------------------------------------------------- */}
<div className="flex items-center justify-between gap-3">
  <div>
    <div className="text-sm font-medium">Enable modifiers</div>
    <div className="text-xs text-white/60">
      Apply dynamic gameplay modifiers (default off).
    </div>
  </div>
  <button
    onClick={() => setEnableModifiers(!enableModifiers)}
    role="switch"
    aria-checked={enableModifiers}
    className={[
      "w-12 h-7 rounded-full p-1 transition-colors",
      enableModifiers ? "bg-emerald-500/70" : "bg-white/20",
    ].join(" ")}
  >
    <span
      className={[
        "block w-5 h-5 rounded-full bg-white transition-transform",
        enableModifiers ? "translate-x-5" : "translate-x-0",
      ].join(" ")}
    />
  </button>
</div>

  </motion.div>
)}


      {/* Center content */}
      <div className="w-full max-w-md text-center select-none space-y-5">
        <motion.h1
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
        >
          aMAZE&apos;n Politics
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35 }}
          className="text-base sm:text-lg bg-gradient-to-r from-indigo-200 via-violet-200 to-amber-200 bg-clip-text text-transparent"
        >
          Discover yourself — and your best!
        </motion.p>

        <div className="mt-8 flex flex-col items-center gap-3 min-h-[52px]">
  {/* Primary: Start */}
  <motion.button
    initial={{ opacity: 0 }}
    animate={{ opacity: showButton ? 1 : 0 }}
    transition={{ type: "spring", stiffness: 250, damping: 22 }}
    style={{ visibility: showButton ? "visible" : "hidden" }}
    onClick={() => {
      narrator.prime();
      onStart();
      setShowSettings(false);
    }}
    className="w-[14rem] rounded-2xl px-4 py-3 text-base font-semibold bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
  >
    Start!
  </motion.button>

  {/* Secondary: High Scores (subtle/glass) */}
  <motion.button
    initial={{ opacity: 0 }}
    animate={{ opacity: showButton ? 1 : 0 }}
    transition={{ delay: 0.05, type: "spring", stiffness: 250, damping: 22 }}
    style={{ visibility: showButton ? "visible" : "hidden" }}
    onClick={() => {
      onHighscores?.(); // no-op if not wired yet
      setShowSettings(false);
    }}
    className="w-[14rem] rounded-2xl px-4 py-2.5 text-sm font-semibold
               bg-white/10 hover:bg-white/15 text-white/90 border border-white/15
               shadow-sm active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-white/20"
  >
    High Scores
  </motion.button>
</div>

      </div>
    </div>
  );
}
