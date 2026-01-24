// src/screens/CompassIntroStart.tsx
import { useEffect, useState, useMemo } from "react";
import type { PushFn } from "../lib/router";
import { bgStyleWithRoleImage } from "../lib/ui";
import { useRoleStore } from "../store/roleStore";
import { useSettingsStore } from "../store/settingsStore";
import { audioManager } from "../lib/audioManager";
import { motion, AnimatePresence } from "framer-motion";
import LoadingOverlay from "../components/LoadingOverlay";
import Gatekeeper from "../components/Gatekeeper";
import { useLogger } from "../hooks/useLogger";
import { useNavigationGuard } from "../hooks/useNavigationGuard";
import { useLang } from "../i18n/lang";
import { useTranslatedConst, createTranslatedConst } from "../i18n/useTranslatedConst";

/** Small built-in placeholder (no asset file needed). */
const DEFAULT_AVATAR_DATA_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512' viewBox='0 0 128 128'>
      <defs>
        <linearGradient id='g' x1='0' x2='0' y1='0' y2='1'>
          <stop offset='0' stop-color='#EAB308'/>
          <stop offset='1' stop-color='#FDE68A'/>
        </linearGradient>
      </defs>
      <rect x='0' y='0' width='128' height='128' rx='24' fill='url(#g)'/>
      <circle cx='64' cy='50' r='22' fill='rgba(0,0,0,0.25)'/>
      <rect x='26' y='78' width='76' height='30' rx='14' fill='rgba(0,0,0,0.25)'/>
    </svg>`
  );

// Loading quotes for the overlay
const LOADING_QUOTES = createTranslatedConst((lang) => [
  lang("COMPASS_INTRO_QUOTE_1"),
  lang("COMPASS_INTRO_QUOTE_2"),
  lang("COMPASS_INTRO_QUOTE_3"),
  lang("COMPASS_INTRO_QUOTE_4"),
  lang("COMPASS_INTRO_QUOTE_5"),
  lang("COMPASS_INTRO_QUOTE_6"),
]);

export default function CompassIntroStart({ push }: { push: PushFn }) {
  console.log("[CompassIntroStart] 🟢 Component rendered");

  const lang = useLang();
  const loadingQuotes = useTranslatedConst(LOADING_QUOTES);

  const generateImages = useSettingsStore((s) => s.generateImages);
  const sfxEnabled = useSettingsStore((s) => s.sfxEnabled);
  const character = useRoleStore((s) => s.character);
  const roleBackgroundImage = useRoleStore((s) => s.roleBackgroundImage);

  // Create role-based background style
  const roleBgStyle = useMemo(() => bgStyleWithRoleImage(roleBackgroundImage), [roleBackgroundImage]);

  console.log("[CompassIntroStart] Character data:", {
    name: character?.name,
    gender: character?.gender,
    hasAvatar: !!character?.avatarUrl
  });

  const [loading, setLoading] = useState(true);
  const [showImage, setShowImage] = useState(false);
  const [showGatekeeper, setShowGatekeeper] = useState(false);
  const [buttonReady, setButtonReady] = useState(false);

  console.log("[CompassIntroStart] Current state:", { loading, showImage, showGatekeeper, buttonReady });

  // Logging hook for data collection
  const logger = useLogger();

  // Navigation guard - prevent back button during compass intro
  useNavigationGuard({
    enabled: true,
    confirmationMessage: lang("CONFIRM_EXIT_SETUP"),
    screenName: "compass_intro_start_screen"
  });

  /** The URL we actually display, factoring in settings + fallback. */
  const displayAvatar = useMemo(() => {
    // If an avatar is already saved, always show it
    if (character?.avatarUrl) return character.avatarUrl;
    // If images are OFF and we don't have one, show placeholder
    if (!generateImages) return DEFAULT_AVATAR_DATA_URL;
    // If images are ON but we don't have one, show placeholder too (since generation happens in NameScreen now)
    return DEFAULT_AVATAR_DATA_URL;
  }, [character?.avatarUrl, generateImages]);



  // Initialize screen and play voiceover
  useEffect(() => {
    console.log("[CompassIntroStart] 🔵 useEffect triggered");
    console.log("[CompassIntroStart] character?.name:", character?.name);

    if (!character?.name) {
      console.warn("[CompassIntroStart] ⚠️ Missing character name - early return");
      return;
    }

    console.log("[CompassIntroStart] ✅ Required data present, proceeding");

    // Reveal content sequence
    setLoading(false);
    setShowImage(true);

    // Show Gatekeeper after avatar appears
    setTimeout(() => {
      setShowGatekeeper(true);

      // Play voiceover when Gatekeeper appears
      if (sfxEnabled) {
        console.log("[CompassIntroStart] 🔊 Playing mirror intro voiceover");
        audioManager.playVoiceover('mirror-intro');
      }
    }, 800);

    // Show button after Gatekeeper has time to display
    setTimeout(() => setButtonReady(true), 1500);

    // Cleanup on unmount
    return () => {
      console.log("[CompassIntroStart] 🔴 Component unmounting - stopping voiceover");
      audioManager.stopVoiceover();
    };
  }, [character?.name, sfxEnabled]);

  return (
    <div className="min-h-[100dvh] px-5 py-6" style={roleBgStyle}>
      <LoadingOverlay visible={loading} title={lang("COMPASS_INTRO_TITLE")} quotes={loadingQuotes} />

      <div className="w-full max-w-xl mx-auto">
        <div className="relative mt-2 grid place-items-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: showImage ? 1 : 0, y: showImage ? 0 : 8, x: 0, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="w-[280px] h-[280px] rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-sm shadow-xl overflow-hidden grid place-items-center relative"
          >
            {displayAvatar ? (
              <motion.img
                key={displayAvatar}
                src={displayAvatar}
                alt="Character avatar"
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              />
            ) : (
              <div className="text-white/80">Preparing avatar…</div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Gatekeeper with mirror intro text */}
      <Gatekeeper
        text={lang("COMPASS_MIRROR_INTRO")}
        isVisible={showGatekeeper}
        onDismiss={() => { }} // No dismiss behavior - stays visible
        showHint={false}
      />

      {/* Button in bottom-left corner */}
      <AnimatePresence>
        {buttonReady && (
          <motion.button
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            onClick={() => {
              logger.log('button_click_look_in_mirror', lang("COMPASS_INTRO_LOOK_IN_MIRROR"), 'User clicked Look in the mirror button');
              audioManager.stopVoiceover(); // Stop voiceover when navigating
              push("/compass-mirror");
            }}
            className="fixed bottom-8 left-8 rounded-2xl px-5 py-3 font-semibold text-lg shadow-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0b1335] hover:scale-[1.02] active:scale-[0.98]"
            style={{ zIndex: 150 }}
          >
            {lang("COMPASS_INTRO_LOOK_IN_MIRROR")}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
