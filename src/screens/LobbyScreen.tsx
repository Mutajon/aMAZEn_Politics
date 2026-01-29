// src/screens/LobbyScreen.tsx
// Lobby screen for external website flow - similar to splash but with 3 game limit
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
import { useLanguage } from "../i18n/LanguageContext";
import LanguageSelector from "../components/LanguageSelector";
import { useLogger } from "../hooks/useLogger";
import { audioManager } from "../lib/audioManager";
import LobbyPlayPopup from "../components/LobbyPlayPopup";

// localStorage key for tracking lobby games played
const LOBBY_GAMES_PLAYED_KEY = 'lobby-games-played';
const MAX_LOBBY_GAMES = 3;

/**
 * Get the number of games played from lobby mode
 */
function getLobbyGamesPlayed(): number {
  try {
    const stored = localStorage.getItem(LOBBY_GAMES_PLAYED_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Increment the lobby games counter
 */
function incrementLobbyGames(): number {
  const current = getLobbyGamesPlayed();
  const newCount = current + 1;
  try {
    localStorage.setItem(LOBBY_GAMES_PLAYED_KEY, newCount.toString());
  } catch {
    // localStorage might be full or disabled
  }
  return newCount;
}

export default function LobbyScreen({ push }: { push: (route: string) => void }) {
  const lang = useLang();
  const { language } = useLanguage();
  const logger = useLogger();

  const [showButton, setShowButton] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [showPlayPopup, setShowPlayPopup] = useState(false);

  // Narrator and audio
  const narrator = useNarrator();
  const { playMusic } = useAudioManager();

  // Settings store
  const setExperimentMode = useSettingsStore((s) => s.setExperimentMode);
  const setLobbyMode = useSettingsStore((s) => s.setLobbyMode);
  const setTreatment = useSettingsStore((s) => s.setTreatment);

  // Check games played on mount
  useEffect(() => {
    const played = getLobbyGamesPlayed();
    setGamesPlayed(played);
    setIsLimitReached(played >= MAX_LOBBY_GAMES);
  }, []);

  // Log lobby screen loaded
  useEffect(() => {
    logger.logSystem('lobby_screen_loaded', true, 'Lobby screen loaded');
  }, [logger]);

  // Show button after delay
  useEffect(() => {
    const buttonTimer = setTimeout(() => {
      setShowButton(true);
    }, 1000);

    return () => clearTimeout(buttonTimer);
  }, []);

  // Helper function to request fullscreen
  const requestFullscreen = async () => {
    try {
      interface DocumentElementWithFullscreen extends HTMLElement {
        webkitRequestFullscreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      }

      const elem = document.documentElement as DocumentElementWithFullscreen;

      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }

      logger.log('fullscreen_entered', 'requested', 'User entered fullscreen mode on lobby start');
    } catch (error) {
      console.warn('[LobbyScreen] Fullscreen request failed:', error);
    }
  };

  // Handle play button click
  const handlePlayClick = async () => {
    // Check limit again (in case it changed)
    const currentPlayed = getLobbyGamesPlayed();
    if (currentPlayed >= MAX_LOBBY_GAMES) {
      setIsLimitReached(true);
      return;
    }

    // Play click sound
    audioManager.playSfx('click-soft');

    // Open the new play popup instead of direct start
    setShowPlayPopup(true);
  };

  /**
   * Handle the custom game start from the play popup
   */
  const handlePopupSubmit = async (data: {
    characterName: string;
    setting: string;
    role: string;
    emphasis: string;
    gender: string;
    difficulty: string;
    avatar: string | null;
    introText?: string;
    supportEntities?: Array<{ name: string; icon: string; type: string }>;
  }) => {
    setIsLoading(true);
    setShowPlayPopup(false);

    try {
      // Request fullscreen mode
      await requestFullscreen();

      // Increment games played counter
      const newCount = incrementLobbyGames();
      setGamesPlayed(newCount);

      // Disable experiment mode (allows all roles)
      setExperimentMode(false);

      // Enable lobby mode (for play again routing)
      setLobbyMode(true);

      // Enable Free Play mode
      useSettingsStore.getState().setFreePlayMode(true);

      // Set treatment to semiAutonomy (standard gameplay)
      setTreatment('semiAutonomy');
      useLoggingStore.getState().setTreatment('semiAutonomy');

      // Set consent to true for lobby mode
      useLoggingStore.getState().setConsented(true);

      // Start new logging session
      await loggingService.startSession();

      // Reset all game stores for fresh start
      useCompassStore.getState().reset();
      useDilemmaStore.getState().reset();
      useRoleStore.getState().reset();
      useMirrorQuizStore.getState().resetAll();
      clearAllSnapshots();

      // --- Custom Scenario Setup ---
      const roleStore = useRoleStore.getState();

      // Set name
      roleStore.setPlayerName(data.characterName);

      // Select the custom role
      roleStore.setRole(data.role);

      // Create character object with selected gender and avatar
      roleStore.setCharacter({
        name: data.characterName,
        gender: data.gender as "male" | "female" | "any",
        description: `The ${data.role} in ${data.setting}`,
        avatarUrl: data.avatar ? `/assets/images/avatars/${data.avatar}.png` : undefined,
      });

      // Character description for the card
      roleStore.setRoleDescription(data.role);

      // Determine Target Score (Difficulty)
      let targetScore = 1150; // Normal
      if (data.difficulty === 'easy') targetScore = 950;
      if (data.difficulty === 'hard') targetScore = 1300;

      // Determine Support Entities (Dynamic)
      const population = data.supportEntities?.find(e => e.type === 'population') || { name: "The People", icon: "👥" };
      const opposition = data.supportEntities?.find(e => e.type === 'opposition') || { name: "The Establishment", icon: "🏛️" };

      // Prepare analysis for a custom scenario
      roleStore.setAnalysis({
        systemName: data.setting,
        systemDesc: `A unique scenario in ${data.setting} focusing on ${data.role}.`,
        flavor: `The weights of power in ${data.setting} are shifting.`,
        holders: [
          { name: "Your Faction", percent: 40, icon: "👤" },
          { name: opposition.name, percent: 30, icon: opposition.icon }, // "Middle" / Antagonist
          { name: population.name, percent: 30, icon: population.icon }, // "People" / Population
        ],
        targetScore, // Pass difficulty target to store
        playerIndex: 0,
        grounding: {
          settingType: "real",
          era: data.setting
        },
        dilemmaEmphasis: data.emphasis || `Role: ${data.role} in ${data.setting}.`,
        roleScope: `As ${data.role} in ${data.setting}, you must navigate the complex political landscape to ensure your faction's survival and goals.`,
        authorityLevel: "medium"
      });

      // Use the splash screen maze image as background for custom scenarios
      roleStore.setRoleBackgroundImage("/assets/images/BKGs/mainBKG.jpg");

      // Set role context
      roleStore.setRoleContext(data.setting, data.introText || `The story of ${data.characterName} in ${data.setting}.`, "N/A");

      // Prime narrator and start music
      narrator.prime();
      playMusic('background', true);

      // Navigate directly to event screen (skip assessments/intro)
      push("/event");
    } catch (error) {
      console.error('Error starting custom lobby game:', error);
      setIsLoading(false);
      alert('An error occurred while starting the game. Please try again.');
    }
  };

  const remainingGames = MAX_LOBBY_GAMES - gamesPlayed;

  return (
    <div
      className="relative min-h-[100dvh] flex items-center justify-center px-5"
      style={bgStyleSplash}
    >
      {/* Language selector (top-right) - always visible when not loading */}
      {!isLoading && (
        <div className="absolute top-4 right-4 z-[40] pointer-events-auto">
          <LanguageSelector variant="compact" />
        </div>
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

            {/* Animated subtitle */}
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

            {/* Game limit info */}
            {!isLimitReached && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-white/70 text-sm"
              >
                {language === 'he' ? (
                  <span>{remainingGames} משחקים נותרו מתוך {MAX_LOBBY_GAMES}</span>
                ) : (
                  <span>{remainingGames} of {MAX_LOBBY_GAMES} games remaining</span>
                )}
              </motion.div>
            )}

            <div className="mt-8 flex flex-col items-center gap-3 min-h-[52px]">
              {isLimitReached ? (
                // Limit reached message
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center space-y-4"
                >
                  <p className="text-amber-300 text-lg font-medium">
                    {language === 'he'
                      ? 'הגעת למגבלת המשחקים החינמיים'
                      : 'You have reached the free play limit'}
                  </p>
                  <p className="text-white/70 text-sm">
                    {language === 'he'
                      ? 'להמשך משחק, הורד את קוד המקור והשתמש במפתח API משלך'
                      : 'To continue playing, download the source code and use your own API key'}
                  </p>
                </motion.div>
              ) : (
                // Play button
                <motion.button
                  initial={{ opacity: 0, rotate: 0 }}
                  animate={{ opacity: showButton ? 1 : 0, rotate: 0 }}
                  whileHover={{
                    scale: 1.02,
                    rotate: [0, -2, 2, -2, 2, 0],
                    transition: {
                      rotate: { duration: 0.5, repeat: 0 },
                      scale: { duration: 0.2 }
                    }
                  }}
                  transition={{ type: "spring", stiffness: 250, damping: 22 }}
                  style={{ visibility: showButton ? "visible" : "hidden" }}
                  onClick={handlePlayClick}
                  className="w-[14rem] rounded-2xl px-4 py-3 text-base font-semibold bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                >
                  {lang("FREE_PLAY_BUTTON") || "Play Now"}
                </motion.button>
              )}
            </div>
          </>
        )}
      </div>
      {/* Custom play popup */}
      <LobbyPlayPopup
        isOpen={showPlayPopup}
        onClose={() => setShowPlayPopup(false)}
        onSubmit={handlePopupSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}

