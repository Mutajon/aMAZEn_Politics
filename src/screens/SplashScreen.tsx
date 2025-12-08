// src/screens/SplashScreen.tsx
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
import { useQuestionnaireStore } from "../store/questionnaireStore";
import { clearAllSnapshots } from "../lib/eventScreenSnapshot";
import { loggingService } from "../lib/loggingService";
import { useLoggingStore } from "../store/loggingStore";
import { useLang } from "../i18n/lang";
import { useLanguage } from "../i18n/LanguageContext";
import LanguageSelector from "../components/LanguageSelector";
import IDCollectionModal from "../components/IDCollectionModal";
import { useLogger } from "../hooks/useLogger";
import { audioManager } from "../lib/audioManager";

// SUBTITLES now uses GAME_SUBTITLE from i18n
const SUBTITLES: string[] = [];

// Module-level flag to persist Hebrew warning across component remounts
let pendingHebrewWarningFlag = false;
// Key for localStorage to track if Hebrew warning has been shown
const HEBREW_WARNING_SHOWN_KEY = 'hebrew-warning-shown';

export default function SplashScreen({
  onStart,
  onHighscores,
  onAchievements,
  push,
}: {
  onStart: () => void;
  onHighscores?: () => void; // optional, so we don't break existing callers
  onAchievements?: () => void; // optional, navigates to achievements screen
  push: (route: string) => void;
}) {
  const lang = useLang();
  const { language } = useLanguage();
  const logger = useLogger();

  const [visibleSubtitles, setVisibleSubtitles] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showHebrewWarning, setShowHebrewWarning] = useState(false);

  // Helper function to get correct transform for toggle
  const getToggleTransform = (isEnabled: boolean) => {
    if (language === 'he') {
      // RTL: enabled = -translate-x-5 (left), disabled = translate-x-0 (right)
      return isEnabled ? "-translate-x-5" : "translate-x-0";
    } else {
      // LTR: enabled = translate-x-5 (right), disabled = translate-x-0 (left)
      return isEnabled ? "translate-x-5" : "translate-x-0";
    }
  };

  // Instantiate the OpenAI-backed narrator.
  // We call narrator.prime() on the Start button to unlock audio policies.
  const narrator = useNarrator();

  // Audio manager for background music
  const { playMusic } = useAudioManager();

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

  // Initialize default dilemmas subject if empty (only once)
  useEffect(() => {
    if (!dilemmasSubject) {
      setDilemmasSubject(lang("SETTINGS_DEFAULT_DILEMMAS_SUBJECT"));
    }
  }, []); // Only run once on mount

  // Enable modifiers
  const enableModifiers = useSettingsStore((s) => s.enableModifiers);
  const setEnableModifiers = useSettingsStore((s) => s.setEnableModifiers);

  const experimentMode = useSettingsStore((s) => s.experimentMode);
  const setExperimentMode = useSettingsStore((s) => s.setExperimentMode);
  
  // Show ID modal only in experiment mode (after user clicks Start)
  const [showIDModal, setShowIDModal] = useState(false);

  // Treatment (experiment configuration)
  const treatment = useSettingsStore((s) => s.treatment);
  const setTreatment = useSettingsStore((s) => s.setTreatment);

  // -------------------------------------------------------------------------

  // Global effect: Enforce semiAutonomy treatment when experiment mode is disabled
  useEffect(() => {
    if (!experimentMode && treatment !== 'semiAutonomy') {
      console.log("[SplashScreen] Experiment mode disabled, forcing semiAutonomy treatment");
      setTreatment('semiAutonomy');
      useLoggingStore.getState().setTreatment('semiAutonomy');
    }
  }, [experimentMode, treatment, setTreatment]);

  // Update showIDModal when experimentMode changes
  useEffect(() => {
    // Only show modal if experiment mode is enabled
    if (!experimentMode) {
      setShowIDModal(false);
    }
  }, [experimentMode]);

  // Handle ID submission from modal (only called in experiment mode)
  const handleIDSubmit = async (id: string) => {
    // Close modal
    setShowIDModal(false);

    // Proceed with game start - check for available slot only in experiment mode
    setIsLoading(true);
    setShowSettings(false);

    try {
      // Register user and get treatment assignment
      const registerResponse = await fetch('/api/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: id }),
      });

      if (!registerResponse.ok) {
        throw new Error('Failed to register user');
      }

      const registerData = await registerResponse.json();
      
      if (!registerData.success) {
        throw new Error(registerData.error || 'Failed to register user');
      }

      // Save ID and treatment to stores
      useLoggingStore.getState().setUserId(registerData.userId);
      setTreatment(registerData.treatment as 'fullAutonomy' | 'semiAutonomy' | 'noAutonomy');
      useLoggingStore.getState().setTreatment(registerData.treatment);
      // Set consent to true - user has agreed to participate by submitting email
      useLoggingStore.getState().setConsented(true);

      console.log(`[SplashScreen] User registered: ${registerData.userId}, treatment: ${registerData.treatment}, isNewUser: ${registerData.isNewUser}`);

      // Proceed with game start (slot reservation moved to BackgroundIntroScreen)
      // Start new logging session (will use the ID we just set)
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

      // Check if questionnaire needs to be completed (first-time users in experiment mode)
      const hasCompletedQuestionnaire = useQuestionnaireStore.getState().hasCompleted;
      if (!hasCompletedQuestionnaire && registerData.isNewUser) {
        // Redirect to questionnaire for first-time users
        push('/power-questionnaire');
      } else {
        // Proceed to game
        onStart();
      }
    } catch (error) {
      console.error('Error in handleIDSubmit:', error);
      setIsLoading(false);
      if (push) {
        push('/capped');
      }
      // Optionally, show a generic error message to the user
      alert('An error occurred while starting the game. Please try again.');
    }
  };

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
        'User entered fullscreen mode on game start'
      );
      console.log('[SplashScreen] Fullscreen mode activated');
    } catch (error) {
      // Fullscreen request can fail (user denied, browser policy, etc.)
      // This is non-critical, so we just log it and continue
      console.warn('[SplashScreen] Fullscreen request failed:', error);
      logger.log(
        'fullscreen_failed',
        { error: (error as Error).message },
        'Fullscreen request was denied or failed'
      );
    }
  };

  // Handle start button click (when not in experiment mode, skip ID modal)
  const handleStartClick = async () => {
    // Play click sound
    audioManager.playSfx('click-soft');

    // Request fullscreen mode
    await requestFullscreen();

    if (experimentMode) {
      // In experiment mode, show ID modal
      setShowIDModal(true);
      return;
    }

    // Not in experiment mode - start game directly
    setIsLoading(true);
    setShowSettings(false);

    try {
      // Set consent to true for non-experiment mode
      useLoggingStore.getState().setConsented(true);

      // Start new logging session
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
    } catch (error) {
      console.error('Error starting game:', error);
      setIsLoading(false);
      alert('An error occurred while starting the game. Please try again.');
    }
  };

  // Log splash screen loaded (runs once on mount)
  useEffect(() => {
    logger.logSystem('splash_screen_loaded', true, 'Splash screen loaded');
  }, [logger]);

  // Redirect to thank-you screen if post-game questionnaire was completed
  useEffect(() => {
    const hasCompletedPostGame = useQuestionnaireStore.getState().hasCompletedPostGame;
    if (hasCompletedPostGame) {
      console.log('[SplashScreen] Post-game questionnaire already completed, redirecting to thank-you');
      push('/thank-you');
    }
  }, [push]);

  // Simple subtitle reveal: show title, wait 0.5s, fade in subtitle
  useEffect(() => {
    // Wait 500ms after title, then show subtitle
    const subtitleTimer = setTimeout(() => {
      setVisibleSubtitles(1);
    }, 500);

    // Then show button 500ms after subtitle appears
    const buttonTimer = setTimeout(() => {
      setShowButton(true);
    }, 1000);

    return () => {
      clearTimeout(subtitleTimer);
      clearTimeout(buttonTimer);
    };
  }, []);

  // Show Hebrew warning on first load if language is Hebrew and warning hasn't been shown
  useEffect(() => {
    // Check if pending from language switch (no longer used, but keep for safety)
    if (pendingHebrewWarningFlag) {
      pendingHebrewWarningFlag = false;
      // Don't show warning on language switch anymore
      return;
    }

    // Show warning on first visit when language is Hebrew
    if (language === 'he' && !localStorage.getItem(HEBREW_WARNING_SHOWN_KEY)) {
      setShowHebrewWarning(true);
      localStorage.setItem(HEBREW_WARNING_SHOWN_KEY, 'true');
    }
  }, [language]);

  return (
    <div
      className="relative min-h-[100dvh] flex items-center justify-center px-5"
      style={bgStyleSplash}
    >
      {/* Language selector (top-right) - always visible when not loading */}
      {!isLoading && (
        <div className="absolute top-4 right-4 z-[40] pointer-events-auto">
          <LanguageSelector
            variant="compact"
          />
        </div>
      )}

      {/* Settings cog (top-right, shifted left) - visible only in debug mode and when not loading */}
      {!isLoading && debugMode && (
        <div className="absolute top-4 right-14 z-[40] pointer-events-auto">
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
      )}

{/* Settings panel (fixed, above gear, outside its wrapper) - debug only */}
{debugMode && showSettings && (
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
    <div className="font-semibold mb-3">{lang("SETTINGS")}</div>

    {/* Language Selection */}
    <LanguageSelector variant="full" />

    <div className="my-4 border-t border-white/10" />

    {/* --- Budget system toggle (same pattern as others) --- */}
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <div className="text-sm font-medium">{lang("BUDGET_SYSTEM")}</div>
        <div className="text-xs text-white/60">
          {lang("BUDGET_SYSTEM_DESC")}
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
            getToggleTransform(showBudget),
          ].join(" ")}
        />
      </button>
    </div>

    {/* Image generation ----------------------------------------------------- */}
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium">{lang("IMAGE_GENERATION")}</div>
        <div className="text-xs text-white/60">
          {lang("IMAGE_GENERATION_DESC")}
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
            getToggleTransform(generateImages),
          ].join(" ")}
        />
      </button>
    </div>

    <div className="my-4 border-t border-white/10" />

    {/* Narration (voiceover) ----------------------------------------------- */}
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium">{lang("NARRATION_VOICEOVER")}</div>
        <div className="text-xs text-white/60">
          {lang("NARRATION_VOICEOVER_DESC")}
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
            getToggleTransform(narrationEnabled),
          ].join(" ")}
        />
      </button>
    </div>
    {/* Divider */}
<div className="my-4 border-t border-white/10" />

{/* Debug mode ------------------------------------------------------------- */}
<div className="flex items-center justify-between gap-3">
  <div>
    <div className="text-sm font-medium">{lang("DEBUG_MODE")}</div>
    <div className="text-xs text-white/60">
      {lang("DEBUG_MODE_DESC")}
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
          getToggleTransform(debugMode),
        ].join(" ")}
      />
  </button>
</div>

{/* Dilemmas subject ------------------------------------------------------- */}
<div className="mt-3">
  <div className="flex items-center justify-between gap-3">
    <div>
      <div className="text-sm font-medium">{lang("DILEMMAS_SUBJECT")}</div>
      <div className="text-xs text-white/60">
        {lang("DILEMMAS_SUBJECT_DESC")}
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
          getToggleTransform(dilemmasSubjectEnabled),
        ].join(" ")}
      />
    </button>
  </div>

  {/* Subject input: enabled only when toggle is on */}
  <input
    type="text"
    value={dilemmasSubject}
    onChange={(e) => setDilemmasSubject(e.currentTarget.value)}
    placeholder={lang("SUBJECT_PLACEHOLDER")}
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
    <div className="text-sm font-medium">{lang("ENABLE_MODIFIERS")}</div>
    <div className="text-xs text-white/60">
      {lang("ENABLE_MODIFIERS_DESC")}
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
        getToggleTransform(enableModifiers),
      ].join(" ")}
    />
  </button>
</div>

{/* Divider */}
<div className="my-4 border-t border-white/10" />

{/* Experiment mode ------------------------------------------------------------- */}
<div className="mt-3 flex items-center justify-between gap-3">
  <div>
    <div className="text-sm font-medium">{lang("EXPERIMENT_MODE")}</div>
    <div className="text-xs text-white/60">
      {lang("EXPERIMENT_MODE_DESC")}
    </div>
  </div>
  <button
    onClick={() => setExperimentMode(!experimentMode)}
    role="switch"
    aria-checked={experimentMode}
    className={[
      "w-12 h-7 rounded-full p-1 transition-colors",
      experimentMode ? "bg-emerald-500/70" : "bg-white/20",
    ].join(" ")}
  >
    <span
      className={[
        "block w-5 h-5 rounded-full bg-white transition-transform",
        getToggleTransform(experimentMode),
      ].join(" ")}
    />
  </button>
</div>

  </motion.div>
)}


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
            animate={{ opacity: 1 }}
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
    onClick={handleStartClick}
    className="w-[14rem] rounded-2xl px-4 py-3 text-base font-semibold bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
  >
    {lang("START_BUTTON")}
  </motion.button>

  {/* Secondary: High Scores (subtle/glass) - TEMPORARILY HIDDEN */}
  <motion.button
    initial={{ opacity: 0 }}
    animate={{ opacity: 0 }}
    transition={{ delay: 0.05, type: "spring", stiffness: 250, damping: 22 }}
    style={{ visibility: "hidden", pointerEvents: "none" }}
    onClick={() => {
      // Start music on any user interaction
      playMusic('background', true);

      onHighscores?.(); // no-op if not wired yet
      setShowSettings(false);
    }}
    className="w-[14rem] rounded-2xl px-4 py-2.5 text-sm font-semibold
               bg-white/10 hover:bg-white/15 text-white/90 border border-white/15
               shadow-sm active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-white/20"
  >
    {lang("HALL_OF_FAME")}
  </motion.button>

  {/* Tertiary: Book of Achievements (subtle/glass) - TEMPORARILY HIDDEN */}
  <motion.button
    initial={{ opacity: 0 }}
    animate={{ opacity: 0 }}
    transition={{ delay: 0.1, type: "spring", stiffness: 250, damping: 22 }}
    style={{ visibility: "hidden", pointerEvents: "none" }}
    onClick={() => {
      // Start music on any user interaction
      playMusic('background', true);

      onAchievements?.(); // no-op if not wired yet
      setShowSettings(false);
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

      {/* ID Collection Modal - only show in experiment mode */}
      {experimentMode && <IDCollectionModal isOpen={showIDModal} onSubmit={handleIDSubmit} />}

      {/* Hebrew Translation Warning Popup */}
      {showHebrewWarning && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-neutral-900 p-6 rounded-2xl max-w-sm text-center border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-white/90 mb-4 text-right leading-relaxed" dir="rtl">
              השפה מוגדרת כרגע על עברית. דעו שהתרגום לעברית לא מלא, ייתכנו שגיאות ובפרט ניסוחים לא ניטרליים מבחינה מגדרית. אנו מתנצלים על כך. אם תעדיפו לשחק באנגלית, לחצו בפינה ימין למעלה אחרי סגירת הפופאפ הזה.
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowHebrewWarning(false);
              }}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium transition-colors"
            >
              הבנתי
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
