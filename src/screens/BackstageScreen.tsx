// src/screens/BackstageScreen.tsx
// Backstage mode: Bypasses experiment restrictions and data collection
// Access via URL: /#/backstage

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { bgStyleSplash } from "../lib/ui";
import { useSettingsStore } from "../store/settingsStore";
import { useNarrator } from "../hooks/useNarrator";
import { useAudioManager } from "../hooks/useAudioManager";
import { useCompassStore } from "../store/compassStore";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { useMirrorQuizStore } from "../store/mirrorQuizStore";
import { clearAllSnapshots } from "../lib/eventScreenSnapshot";
import { loggingService } from "../lib/loggingService";
import { useLoggingStore } from "../store/loggingStore";
import { useLang } from "../i18n/lang";
import { useLogger } from "../hooks/useLogger";

const SUBTITLES = [
  "Choose your path. Discover yourself."
];

export default function BackstageScreen({
  onStart,
  onHighscores,
  onAchievements,
}: {
  onStart: () => void;
  onHighscores?: () => void;
  onAchievements?: () => void;
}) {
  const lang = useLang();
  const logger = useLogger();

  const [visibleSubtitles, setVisibleSubtitles] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Instantiate the OpenAI-backed narrator
  const narrator = useNarrator();

  // Audio manager for background music
  const { playMusic } = useAudioManager();

  // Store setters for backstage configuration
  const setExperimentMode = useSettingsStore((s) => s.setExperimentMode);
  const setTreatment = useSettingsStore((s) => s.setTreatment);
  const setBackstageMode = useSettingsStore((s) => s.setBackstageMode);

  // Configure backstage mode on mount
  useEffect(() => {
    console.log("[Backstage] Configuring backstage mode...");

    // Disable experiment mode (unlocks all roles)
    setExperimentMode(false);

    // Force semiAutonomy treatment (classic gameplay: AI options + custom action, 1 inquiry/dilemma)
    setTreatment("semiAutonomy");
    useLoggingStore.getState().setTreatment("semiAutonomy");

    // Enable backstage mode (bypasses email modal, keeps data collection active)
    setBackstageMode(true);

    // Clear experiment progress (removes role completion tracking)
    useLoggingStore.getState().resetExperimentProgress();

    console.log("[Backstage] ✅ Experiment mode disabled");
    console.log("[Backstage] ✅ Treatment set to semiAutonomy");
    console.log("[Backstage] ✅ Backstage mode enabled");
    console.log("[Backstage] ✅ All roles unlocked");

    // Cleanup: reset backstage mode when leaving
    return () => {
      setBackstageMode(false);
      console.log("[Backstage] ✅ Backstage mode disabled (cleanup)");
    };
  }, [setExperimentMode, setTreatment, setBackstageMode]);

  // Simple subtitle reveal: show title, wait 0.5s, fade in all subtitles
  useEffect(() => {
    // Wait 500ms after title, then show all subtitles at once
    const subtitleTimer = setTimeout(() => {
      setVisibleSubtitles(SUBTITLES.length);
    }, 500);

    // Then show button 500ms after subtitles appear
    const buttonTimer = setTimeout(() => {
      setShowButton(true);
    }, 1000);

    return () => {
      clearTimeout(subtitleTimer);
      clearTimeout(buttonTimer);
    };
  }, []);

  // Helper function to request fullscreen
  const requestFullscreen = async () => {
    try {
      // TypeScript interfaces for browser-specific fullscreen APIs
      interface DocumentElementWithFullscreen extends HTMLElement {
        webkitRequestFullscreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      }
      
      const elem = document.documentElement as DocumentElementWithFullscreen;
      
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        // Safari
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        // IE11
        await elem.msRequestFullscreen();
      }
      
      logger.log(
        'fullscreen_entered',
        'requested',
        'User entered fullscreen mode on game start (backstage)'
      );
      console.log('[Backstage] Fullscreen mode activated');
    } catch (error) {
      // Fullscreen request can fail (user denied, browser policy, etc.)
      // This is non-critical, so we just log it and continue
      console.warn('[Backstage] Fullscreen request failed:', error);
      logger.log(
        'fullscreen_failed',
        { error: (error as Error).message },
        'Fullscreen request was denied or failed (backstage)'
      );
    }
  };

  // Handle game start (no ID collection required)
  const handleStart = async () => {
    console.log("[Backstage] Starting game...");
    
    // Request fullscreen mode
    await requestFullscreen();
    
    setIsLoading(true);

    // Start new logging session (will respect disabled data collection)
    await loggingService.startSession();

    // Reset all game stores for fresh start
    useCompassStore.getState().reset();
    useDilemmaStore.getState().reset();
    useRoleStore.getState().reset();
    useMirrorQuizStore.getState().resetAll();
    clearAllSnapshots();

    // Prime narrator and start music (user interaction unlocks browser autoplay)
    narrator.prime();
    playMusic('background', true);

    onStart();
  };

  return (
    <div
      className="relative min-h-[100dvh] flex items-center justify-center px-5"
      style={bgStyleSplash}
    >
      {/* Backstage badge (top-left) */}
      <div className="absolute top-4 left-4 z-[40] pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/20 backdrop-blur border border-purple-400/30">
          <span className="text-xl" aria-hidden>🎭</span>
          <span className="text-xs font-semibold text-purple-200 uppercase tracking-wider">
            Backstage Mode
          </span>
        </div>
      </div>

      {/* Center content */}
      <div className="w-full max-w-md text-center select-none space-y-5">
        {isLoading ? (
          // Loading spinner
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 18 }}
            className="flex flex-col items-center justify-center gap-4"
          >
            <div className="w-12 h-12 border-4 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
          </motion.div>
        ) : (
          <>
            <motion.h1
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
            >
              aMAZE'n Politics
            </motion.h1>

            {/* Animated subtitle - simple fade in */}
            <div className="relative min-h-[80px] flex flex-col items-center justify-start pt-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: visibleSubtitles >= SUBTITLES.length ? 1 : 0 }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <motion.div
                  className="flex flex-col items-center"
                  animate={{
                    backgroundPosition: ["0% 100%", "0% 0%"],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    repeatDelay: 1.5,
                    ease: "linear"
                  }}
                  style={{
                    backgroundImage: "linear-gradient(180deg, rgba(199, 210, 254, 1), rgba(221, 214, 254, 1), rgba(253, 230, 138, 1), rgba(221, 214, 254, 1), rgba(199, 210, 254, 1))",
                    backgroundSize: "100% 300%",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  <p className="text-base sm:text-lg font-medium">
                    {lang("GAME_SUBTITLE")}
                  </p>
                </motion.div>
              </motion.div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 min-h-[52px]">
              {/* Primary: Start */}
              <motion.button
                initial={{ opacity: 0, rotate: 0 }}
                animate={{ opacity: showButton ? 1 : 0, rotate: 0 }}
                whileHover={{
                  scale: 1.02,
                  rotate: [0, -2, 2, -2, 2, 0],
                  transition: {
                    rotate: {
                      duration: 0.5,
                      repeat: 0
                    },
                    scale: {
                      duration: 0.2
                    }
                  }
                }}
                transition={{ type: "spring", stiffness: 250, damping: 22 }}
                style={{ visibility: showButton ? "visible" : "hidden" }}
                onClick={handleStart}
                className="w-[14rem] rounded-2xl px-4 py-3 text-base font-semibold bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
              >
                {lang("START_BUTTON")}
              </motion.button>

              {/* Secondary: High Scores (subtle/glass) */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: showButton ? 1 : 0 }}
                transition={{ delay: 0.05, type: "spring", stiffness: 250, damping: 22 }}
                style={{ visibility: showButton ? "visible" : "hidden" }}
                onClick={() => {
                  // Start music on any user interaction
                  playMusic('background', true);
                  onHighscores?.();
                }}
                className="w-[14rem] rounded-2xl px-4 py-2.5 text-sm font-semibold
                           bg-white/10 hover:bg-white/15 text-white/90 border border-white/15
                           shadow-sm active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                {lang("HALL_OF_FAME")}
              </motion.button>

              {/* Tertiary: Book of Achievements (subtle/glass) */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: showButton ? 1 : 0 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 250, damping: 22 }}
                style={{ visibility: showButton ? "visible" : "hidden" }}
                onClick={() => {
                  // Start music on any user interaction
                  playMusic('background', true);
                  onAchievements?.();
                }}
                className="w-[14rem] rounded-2xl px-4 py-2.5 text-sm font-semibold
                           bg-white/10 hover:bg-white/15 text-white/90 border border-white/15
                           shadow-sm active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                {lang("BOOK_OF_ACHIEVEMENTS")}
              </motion.button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
