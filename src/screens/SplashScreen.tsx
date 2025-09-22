// src/screens/SplashScreen.tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { bgStyle } from "../lib/ui";
import { useSettingsStore } from "../store/settingsStore";
import { useNarrator } from "../hooks/useNarrator";

export default function SplashScreen({ onStart }: { onStart: () => void }) {
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
      <div className="absolute top-4 right-4 z-50">
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

        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="mt-2 w-72 rounded-2xl border border-white/10 bg-neutral-900/80 backdrop-blur p-4 text-white/90"
            role="dialog"
            aria-label="Settings"
          >
            <div className="font-semibold mb-3">Settings</div>

            {/* Row: Image generation ------------------------------------------------ */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Image generation</div>
                <div className="text-xs text-white/60">
                  Generate AI images in-game (default off)
                </div>
              </div>

              {/* Toggle switch */}
              <button
                onClick={() => setGenerateImages(!generateImages)}
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

            {/* Row: Narration (voiceover) ------------------------------------------ */}
            <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-white/10">
              <div>
                <div className="text-sm font-medium">Narration (voiceover)</div>
                <div className="text-xs text-white/60">
                  Read story text aloud (default on)
                </div>
              </div>

              {/* Toggle switch */}
              <button
                onClick={() => setNarrationEnabled(!narrationEnabled)}
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
            {/* --------------------------------------------------------------------- */}
          </motion.div>
        )}
      </div>

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

        <div className="mt-8 flex justify-center min-h-[52px]">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: showButton ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 250, damping: 22 }}
            style={{ visibility: showButton ? "visible" : "hidden" }}
            // IMPORTANT: Prime the audio engine before navigating so OpenAI TTS
            // can play on the next screen without being blocked by autoplay policies.
            onClick={() => {
              narrator.prime(); // unlock audio on mobile (plays/pauses a silent buffer)
              console.log("[Splash] prime() invoked, starting app");
              onStart();        // your existing navigation callback
              setShowSettings(false); // optional: close settings if open
            }}
            className="w-[14rem] rounded-2xl px-4 py-3 text-base font-semibold bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
          >
            Start!
          </motion.button>
        </div>
      </div>
    </div>
  );
}
