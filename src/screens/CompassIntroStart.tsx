// src/screens/CompassIntroStart.tsx
import { useEffect, useState, useMemo, useRef } from "react";
import type { PushFn } from "../lib/router";
import { bgStyleWithRoleImage } from "../lib/ui";
import { useRoleStore } from "../store/roleStore";
import { useSettingsStore } from "../store/settingsStore";
import { useNarrator, type PreparedTTS } from "../hooks/useNarrator";
import { motion, AnimatePresence } from "framer-motion";
import LoadingOverlay from "../components/LoadingOverlay";
import { useLogger } from "../hooks/useLogger";
import { useNavigationGuard } from "../hooks/useNavigationGuard";
import { useLang } from "../i18n/lang";
import { useTranslatedConst, createTranslatedConst } from "../i18n/useTranslatedConst";
import { getPredefinedRole } from "../data/predefinedRoles";

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

function trimEra(role: string): string {
  return (role || "").replace(/\s*[—–-].*$/u, "").trim();
}
function genderizeRole(role: string, gender: "male" | "female" | "any"): string {
  const r = (role || "").trim().toLowerCase();
  const map: Record<string, { male: string; female: string }> = {
    emperor: { male: "Emperor of", female: "Empress of" },
    king: { male: "King of", female: "Queen of" },
    prince: { male: "Prince of", female: "Princess of" },
    hero: { male: "Hero of", female: "Heroine of" },
    monk: { male: "Monk of", female: "Nun of" },
    lord: { male: "Lord of", female: "Lady of" },
    duke: { male: "Duke of", female: "Duchess of" },
    tsar: { male: "Tsar of", female: "Tsarina of" },
    pharaoh: { male: "Pharaoh of", female: "Pharaoh of" },
    chancellor: { male: "Chancellor of", female: "Chancellor of" },
    kanzler: { male: "Kanzler von", female: "Kanzlerin von" },
  };
  for (const key of Object.keys(map)) {
    if (r.startsWith(key)) {
      const rest = role.slice(key.length).trim();
      const pair = map[key];
      if (gender === "female") return `${pair.female} ${rest}`.trim();
      return `${pair.male} ${rest}`.trim();
    }
  }
  return role || "your new role";
}

export default function CompassIntroStart({ push }: { push: PushFn }) {
  console.log("[CompassIntroStart] 🟢 Component rendered");

  const lang = useLang();
  const loadingQuotes = useTranslatedConst(LOADING_QUOTES);

  const generateImages = useSettingsStore((s) => s.generateImages);
  const narrationEnabled = useSettingsStore((s) => s.narrationEnabled);
  const character = useRoleStore((s) => s.character);
  const selectedRole = useRoleStore((s) => s.selectedRole);
  const roleBackgroundImage = useRoleStore((s) => s.roleBackgroundImage);

  // Create role-based background style
  const roleBgStyle = useMemo(() => bgStyleWithRoleImage(roleBackgroundImage), [roleBackgroundImage]);

  console.log("[CompassIntroStart] Character data:", {
    name: character?.name,
    gender: character?.gender,
    hasAvatar: !!character?.avatarUrl
  });
  console.log("[CompassIntroStart] Selected role:", selectedRole);

  const [loading, setLoading] = useState(true);
  const [showImage, setShowImage] = useState(false);
  const [showText, setShowText] = useState(false);
  const [narrationReady, setNarrationReady] = useState(false);

  console.log("[CompassIntroStart] Current state:", { loading, showImage, showText, narrationReady });

  // Narration setup
  const { prepare } = useNarrator();
  const preparedTTSRef = useRef<PreparedTTS | null>(null);

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

  // Get gender-aware translation keys
  const getGenderKey = (baseKey: string): string => {
    const gender = character?.gender;
    if (gender === "female") {
      return `${baseKey}_FEMALE`;
    } else if (gender === "male") {
      return `${baseKey}_MALE`;
    }
    // For "any" or undefined, use the base key (which defaults to male form)
    return baseKey;
  };

  // Get translated role text
  const roleText = useMemo(() => {
    if (!selectedRole) return "";
    
    const roleData = getPredefinedRole(selectedRole);
    if (roleData) {
      // For predefined roles, use gender-aware translation of youAreKey
      const gender = character?.gender;
      const genderKey = gender === "female" ? `${roleData.youAreKey}_FEMALE` : 
                       gender === "male" ? `${roleData.youAreKey}_MALE` : 
                       roleData.youAreKey;
      return lang(genderKey);
    }
    
    // For custom roles, use the old genderize logic
    return genderizeRole(trimEra(selectedRole), character?.gender || "any");
  }, [selectedRole, character?.gender, lang]);

  // Start narration preparation immediately on mount
  useEffect(() => {
    console.log("[CompassIntroStart] 🔵 useEffect triggered");
    console.log("[CompassIntroStart] character?.name:", character?.name);
    console.log("[CompassIntroStart] roleText:", roleText);

    if (!character?.name || !roleText) {
      console.warn("[CompassIntroStart] ⚠️ Missing required data - early return");
      console.warn("[CompassIntroStart] character?.name exists:", !!character?.name);
      console.warn("[CompassIntroStart] roleText exists:", !!roleText);
      return;
    }

    console.log("[CompassIntroStart] ✅ Required data present, proceeding with narration");

    const welcomeKey = character.gender === "female" ? "COMPASS_INTRO_WELCOME_FEMALE" : 
                       character.gender === "male" ? "COMPASS_INTRO_WELCOME_MALE" : 
                       "COMPASS_INTRO_WELCOME";
    const nightBeforeKey = character.gender === "female" ? "COMPASS_INTRO_NIGHT_BEFORE_FEMALE" : 
                           character.gender === "male" ? "COMPASS_INTRO_NIGHT_BEFORE_MALE" : 
                           "COMPASS_INTRO_NIGHT_BEFORE";
    const knowThyselfKey = character.gender === "female" ? "COMPASS_INTRO_KNOW_THYSELF_FEMALE" : 
                          character.gender === "male" ? "COMPASS_INTRO_KNOW_THYSELF_MALE" : 
                          "COMPASS_INTRO_KNOW_THYSELF";
    const narrationText = `${lang(welcomeKey)} ${character.name}. ${lang(nightBeforeKey)} ${roleText}. ${lang("COMPASS_INTRO_PACKAGE")} ${lang(knowThyselfKey)}. ${lang("COMPASS_INTRO_MIRROR")}`;

    const prepareAndStartNarration = async () => {
      try {
        // Only prepare and play narration if enabled
        if (narrationEnabled) {
          console.log("[CompassIntroStart] 🎤 Preparing narration");
          const prepared = await prepare(narrationText);
          preparedTTSRef.current = prepared;

          // Start narration immediately when ready
          if (!prepared.disposed()) {
            console.log("[CompassIntroStart] 🔊 Starting narration");
            await prepared.start();
          }
          console.log("[CompassIntroStart] ✅ Narration complete");
        } else {
          console.log("[CompassIntroStart] ⏭️ Skipping narration (disabled)");
        }

        // Reveal content (with or without narration)
        console.log("[CompassIntroStart] 🎨 Revealing content");
        setLoading(false);
        setShowImage(true);
        setTimeout(() => setShowText(true), 600);
        setTimeout(() => setNarrationReady(true), 1200);
      } catch (error) {
        console.error("[CompassIntroStart] ❌ Narration preparation failed:", error);
        // If narration fails, still allow progression
        console.log("[CompassIntroStart] 🔧 Falling back to no-narration mode");
        setLoading(false);
        setShowImage(true);
        setTimeout(() => setShowText(true), 600);
        setTimeout(() => setNarrationReady(true), 1200);
      }
    };

    prepareAndStartNarration();

    // Cleanup on unmount
    return () => {
      console.log("[CompassIntroStart] 🔴 useEffect cleanup - component unmounting");
      if (preparedTTSRef.current) {
        preparedTTSRef.current.dispose();
        preparedTTSRef.current = null;
      }
    };
  }, [character?.name, character?.gender, roleText, lang, prepare, narrationEnabled]);

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

        <AnimatePresence>
          {showText && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="mt-5 text-center text-white/90 leading-relaxed"
            >
              <p className="text-lg">{lang(getGenderKey("COMPASS_INTRO_WELCOME"))} {character?.name},</p>
              <p className="mt-3">
                {lang(getGenderKey("COMPASS_INTRO_NIGHT_BEFORE"))}{" "}
                <span className="font-semibold">{roleText}</span>. {lang("COMPASS_INTRO_PACKAGE")}{" "}
                <span className="font-extrabold text-amber-300">{lang(getGenderKey("COMPASS_INTRO_KNOW_THYSELF"))}</span>.
              </p>
              <p className="mt-3">{lang("COMPASS_INTRO_MIRROR")}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex justify-center">
          <AnimatePresence>
            {narrationReady && (
              <motion.button
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 8 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                onClick={() => {
                  logger.log('button_click_look_in_mirror', lang(getGenderKey("COMPASS_INTRO_LOOK_IN_MIRROR")), 'User clicked Look in the mirror button');
                  push("/compass-mirror");
                }}
                className="rounded-2xl px-5 py-3 font-semibold text-lg shadow-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0b1335] hover:scale-[1.02] active:scale-[0.98]"
              >
                {lang(getGenderKey("COMPASS_INTRO_LOOK_IN_MIRROR"))}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
