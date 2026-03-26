// src/screens/LobbyQstScreen.tsx
// Special Lobby with Questionnaire flow (no game limit)
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { bgStyleSplash } from "../lib/ui";
import { useSettingsStore } from "../store/settingsStore";
import { useLang } from "../i18n/lang";
import LanguageSelector from "../components/LanguageSelector";
import { useCompassStore } from "../store/compassStore";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { useMirrorQuizStore } from "../store/mirrorQuizStore";
import { clearAllSnapshots } from "../lib/eventScreenSnapshot";
import { loggingService } from "../lib/loggingService";
import { useLoggingStore } from "../store/loggingStore";
import { useLogger } from "../hooks/useLogger";
import { audioManager } from "../lib/audioManager";
import LobbyPlayPopup from "../components/LobbyPlayPopup";
import CreditsPopup from "../components/lobby/CreditsPopup";
import { useLegacyStore } from "../store/legacyStore";
import { Trophy } from "lucide-react";
import { useReserveGameSlot } from "../hooks/useReserveGameSlot";

export default function LobbyQstScreen({ push }: { push: (route: string) => void }) {
  const lang = useLang();
  const logger = useLogger();

  const [showButton, setShowButton] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPlayPopup, setShowPlayPopup] = useState(false);
  const [showCreditsPopup, setShowCreditsPopup] = useState(false);

  // NEW: State for resumed flow
  const tempLobbyData = useRoleStore((s) => s.tempLobbyData);
  const [initialStep, setInitialStep] = useState<'selection' | 'form' | 'intro' | 'spice' | 'custom' | undefined>(undefined);
  const [initialIntroData, setInitialIntroData] = useState<any>(null);

  // Settings store
  const setExperimentMode = useSettingsStore((s) => s.setExperimentMode);
  const setLobbyMode = useSettingsStore((s) => s.setLobbyMode);
  const setLobbyQstMode = useSettingsStore((s) => s.setLobbyQstMode);
  const setTreatment = useSettingsStore((s) => s.setTreatment);
  const reserveGameSlotMutation = useReserveGameSlot();

  // Check on mount
  useEffect(() => {
    // Enable lobbyQstMode and set modes
    setLobbyQstMode(true);
    setLobbyMode(true);
    useSettingsStore.getState().setFreePlayMode(true);

    // --- NEW: Check for resumed flow from questionnaire ---
    if (tempLobbyData?.introData) {
      setInitialStep('intro');
      setInitialIntroData(tempLobbyData.introData);
      setShowPlayPopup(true);
    }
  }, [setLobbyMode, setLobbyQstMode, tempLobbyData]);

  // Log lobby screen loaded
  useEffect(() => {
    logger.logSystem('lobby_qst_screen_loaded', true, 'Lobby Questionnaire screen loaded');
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
      console.warn('[LobbyQstScreen] Fullscreen request failed:', error);
    }
  };

  // Handle play button click
  const handlePlayClick = async () => {
    audioManager.playSfx('click-soft');
    setShowPlayPopup(true);
  };

  /**
   * Handle the custom game start from the play popup
   * For LobbyQst, this diverts to the questionnaire!
   */
  const handlePopupSubmit = async (data: any) => {
    setIsLoading(true);
    setShowPlayPopup(false);

    try {
      // Request fullscreen mode
      await requestFullscreen();

      // Reserve global game slot
      const isBackstage = useSettingsStore.getState().backstageMode;
      if (!isBackstage) {
        try {
          const result = await reserveGameSlotMutation.mutateAsync();
          if (!result.success) {
            push('/capped');
            return;
          }
        } catch (err) {
          console.error('[LobbyQstScreen] Global slot reservation failed:', err);
          push('/capped');
          return;
        }
      }

      // Check if we are starting the game (intro data is present)
      if (data.introText) {
        // --- START GAME FLOW ---
        // 1. Initialize stores with the final game data
        const roleStore = useRoleStore.getState();
        roleStore.setTempLobbyData(data);
        
        // Prepare Compass and Dilemma stores
        useCompassStore.getState().reset();
        useDilemmaStore.getState().reset();
        // (governance system is stored in analysis, no direct setter in compassStore)

        // Set Role metadata
        roleStore.setRoleContext(
          data.systemName || "Democratic Republic",
          data.introText,
          data.year || "Present Day"
        );
        roleStore.setRoleDescription(data.role);
        roleStore.setRole(data.role);

        // Set Character info
        roleStore.setCharacter({
          name: data.characterName,
          gender: data.gender as "male" | "female" | "any",
          description: `The ${data.role} in ${data.setting}`,
          avatarUrl: data.avatar ? `/assets/images/avatars/${data.avatar}.png` : undefined,
        });

        // Determine background image based on setting
        const getBkgImage = (setting: string) => {
          const s = setting.toLowerCase();
          if (s.includes("athens")) return "/assets/images/freePlay/athensBKG.webp";
          if (s.includes("rome") || s.includes("roman")) return "/assets/images/freePlay/romanBKG.webp";
          if (s.includes("england") || s.includes("london") || s.includes("uk")) return "/assets/images/freePlay/englandBKG.webp";
          if (s.includes("vatican") || s.includes("pope") || s.includes("church")) return "/assets/images/freePlay/vaticanBKG.webp";
          if (s.includes("china") || s.includes("chinese") || s.includes("beijing") || s.includes("ming")) return "/assets/images/freePlay/chinaBKG.webp";
          if (s.includes("mars") || s.includes("space") || s.includes("planet")) return "/assets/images/freePlay/marsBKG.webp";
          // Fallback for custom scenarios
          return "/assets/images/freePlay/chooseOwn.webp";
        };

        roleStore.setRoleBackgroundImage(getBkgImage(data.setting));

        // Set Analysis for placeholders
        roleStore.setAnalysis({
          systemName: data.systemName || data.setting,
          systemDesc: `A unique scenario in ${data.setting} focusing on ${data.role}.`,
          flavor: `The weights of power in ${data.setting} are shifting.`,
          holders: [
            { name: "Your Faction", percent: 40, icon: "👤", note: "The group you lead." },
            { name: "Opposition", percent: 30, icon: "🏛️", note: "The primary institutional power." },
            { name: "The People", percent: 30, icon: "👥", note: "The diverse public." },
          ],
          playerIndex: 0,
          roleCategory: data.roleCategory || null,
          messenger: data.messenger || "",
          grounding: {
            settingType: "real",
            era: data.setting
          }
        });

        // Other session markers
        useLoggingStore.getState().setTreatment('semiAutonomy');
        useLoggingStore.getState().setConsented(true);

        // Reset other states
        useMirrorQuizStore.getState().resetAll();
        useLegacyStore.getState().reset();
        clearAllSnapshots();

        // 2. Navigate away
        push("/event");
        return;
      }

      // --- START QUESTIONNAIRE FLOW ---
      // 1. Prepare game state
      setExperimentMode(false);
      setLobbyMode(true);
      useSettingsStore.getState().setFreePlayMode(true);
      setTreatment('semiAutonomy');
      useLoggingStore.getState().setTreatment('semiAutonomy');
      useLoggingStore.getState().setConsented(true);

      // Reset all game stores for fresh start
      useCompassStore.getState().reset();
      useDilemmaStore.getState().reset();
      useRoleStore.getState().reset();
      useMirrorQuizStore.getState().resetAll();
      useLegacyStore.getState().reset();
      clearAllSnapshots();

      // 2. Save data to tempLobbyData AFTER reset
      useRoleStore.getState().setTempLobbyData(data);

      // Start new logging session
      await loggingService.startSession();

      // 3. Navigate to Power Questionnaire
      push("/power-questionnaire");

    } catch (error) {
      console.error('Error in LobbyQst flow:', error);
      setIsLoading(false);
      alert('An error occurred. Please try again.');
    }
  };

  return (
    <div
      className="relative min-h-[100dvh] flex items-center justify-center px-5"
      style={bgStyleSplash}
    >
      <div className="w-full max-w-md text-center select-none space-y-5">
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center gap-4"
          >
            <div className="w-12 h-12 border-4 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
          </motion.div>
        ) : (
          <>
            <div className="flex flex-col items-center mb-6">
              <motion.img
                src="/assets/images/logoFaces.webp"
                alt="Logo Faces"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: [0, -15, 0] }}
                transition={{
                  opacity: { duration: 0.8 },
                  y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                }}
                className="w-60 sm:w-80 drop-shadow-[0_5px_15px_rgba(0,0,0,0.3)] mb-2"
              />
              <motion.img
                src="/assets/images/logo.webp"
                alt="aMAZE'n Politics"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.2 }}
                className="w-[21rem] sm:w-[26rem] h-auto drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
              />
            </div>

            <div className="relative min-h-[60px] flex flex-col items-center justify-start pt-4">
              <motion.div
                className="flex flex-col items-center"
                animate={{ backgroundPosition: ["0% 100%", "0% 0%"] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1.5, ease: "linear" }}
                style={{
                  backgroundImage: "linear-gradient(180deg, rgba(199, 210, 254, 1), rgba(221, 214, 254, 1), rgba(253, 230, 138, 1), rgba(221, 214, 254, 1), rgba(199, 210, 254, 1))",
                  backgroundSize: "100% 300%",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                <p className="text-base sm:text-lg font-medium">{lang("GAME_SUBTITLE")}</p>
              </motion.div>
              <motion.div className="mt-4"><LanguageSelector variant="lobby" /></motion.div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 min-h-[52px]">
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: showButton ? 1 : 0 }}
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

              <motion.button
                onClick={() => { audioManager.playSfx('click-soft'); push("/highscores"); }}
                className="flex items-center gap-2 px-6 py-2 rounded-xl text-amber-300/80 text-sm font-bold uppercase tracking-widest transition-all border border-amber-300/20 hover:border-amber-300/40"
              >
                <Trophy className="w-4 h-4" />
                {lang("LOBBY_HALL_OF_FAME")}
              </motion.button>
            </div>
          </>
        )}
      </div>

      <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
        <motion.button
          onClick={() => setShowCreditsPopup(true)}
          className="pointer-events-auto px-4 py-2 text-white/30 hover:text-white/60 text-xs font-bold uppercase tracking-[0.3em] transition-all"
        >
          {lang("LOBBY_CREDITS")}
        </motion.button>
      </div>

      <LobbyPlayPopup
        isOpen={showPlayPopup}
        onClose={() => setShowPlayPopup(false)}
        onSubmit={handlePopupSubmit}
        isLoading={isLoading}
        initialStep={initialStep}
        initialIntroData={initialIntroData}
        initialData={tempLobbyData}
      />
      <CreditsPopup isOpen={showCreditsPopup} onClose={() => setShowCreditsPopup(false)} />
    </div>
  );
}
