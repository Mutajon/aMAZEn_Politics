// src/screens/BackgroundIntroScreen.tsx
import { useEffect, useMemo, useRef } from "react";
import type { PushFn } from "../lib/router";
import { bgStyleWithRoleImage } from "../lib/ui";
import { motion } from "framer-motion";
import { useSettingsStore } from "../store/settingsStore";
import { useRoleStore } from "../store/roleStore";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useLogger } from "../hooks/useLogger";
import { useNavigationGuard } from "../hooks/useNavigationGuard";
import { useLang, getCurrentLanguage } from "../i18n/lang";
import { useReserveGameSlot } from "../hooks/useReserveGameSlot";
import { audioManager } from "../lib/audioManager";

/**
 * Simplified BackgroundIntroScreen:
 * - Shows "Night falls" with pre-recorded voiceover
 * - "Wake up" button navigates directly to /event (skipping intro paragraph generation)
 */

export default function BackgroundIntroScreen({ push }: { push: PushFn }) {
  const lang = useLang();
  const narrationEnabled = useSettingsStore((s) => s.narrationEnabled);
  const experimentMode = useSettingsStore((s) => s.experimentMode);
  const reserveGameSlotMutation = useReserveGameSlot();

  // Logging hook for data collection
  const logger = useLogger();

  // Navigation guard - prevent back button during background intro
  useNavigationGuard({
    enabled: true,
    confirmationMessage: lang("CONFIRM_EXIT_SETUP"),
    screenName: "background_intro_screen"
  });

  // Role data (forgiving shape)
  const genderRaw = useRoleStore((s: any) => s?.character?.gender);
  const roleBackgroundImage = useRoleStore((s) => s.roleBackgroundImage);
  const gender: "male" | "female" | "any" =
    genderRaw === "male" || genderRaw === "female" ? genderRaw : "any";

  // Create role-based background style
  const roleBgStyle = useMemo(() => bgStyleWithRoleImage(roleBackgroundImage), [roleBackgroundImage]);

  // Get gender-aware translation keys
  const getGenderKey = (baseKey: string): string => {
    if (gender === "female") {
      return `${baseKey}_FEMALE`;
    } else if (gender === "male") {
      return `${baseKey}_MALE`;
    }
    // For "any" or undefined, use the base key (which defaults to male form)
    return baseKey;
  };

  const DEFAULT_LINE = useMemo(() => lang(getGenderKey("BACKGROUND_INTRO_DEFAULT_LINE")), [lang, gender]);

  // Prevent double-play of voiceover
  const defaultPlayedRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioManager.stopVoiceover();
    };
  }, []);

  // Wake up → go directly to event screen
  const onWake = async () => {
    // Log player clicking "Wake up" button
    logger.log('button_click_wake_up', 'Wake up', 'User clicked Wake up button');

    // Reserve game slot if experiment mode is enabled
    if (experimentMode) {
      try {
        const result = await reserveGameSlotMutation.mutateAsync();

        if (!result.success) {
          // Redirect to capped screen if reservation failed
          push('/capped');
          return;
        }
      } catch (error) {
        console.error('[BackgroundIntro] Error reserving game slot:', error);
        // Redirect to capped screen on error
        push('/capped');
        return;
      }
    }

    // Clear dilemma history and go directly to event screen
    useDilemmaStore.getState().clearHistory();
    console.log("[BackgroundIntro] Dilemma history cleared for new game");
    push("/event");
  };

  return (
    <div className="min-h-[100dvh] px-5 py-6" style={roleBgStyle}>
      <div className="max-w-2xl mx-auto">
        <motion.div
          key="idle"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          // Start the pre-recorded narration exactly with the fade-in
          onAnimationStart={() => {
            // Only play English voiceover - Hebrew TTS not supported
            if (narrationEnabled && !defaultPlayedRef.current && getCurrentLanguage() === 'en') {
              defaultPlayedRef.current = true;
              audioManager.playVoiceover('drift-to-sleep');
            }
          }}
        >
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
            {lang("BACKGROUND_INTRO_NIGHT_FALLS")}
          </h1>

          <p className="mt-3 text-white/80 bg-black/60 border border-amber-500/30 rounded-xl p-4">{DEFAULT_LINE}</p>

          <div className="mt-6">
            <button
              className="w-[14rem] rounded-2xl px-4 py-3 text-base font-semibold bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
              onClick={onWake}
            >
              {lang(getGenderKey("BACKGROUND_INTRO_WAKE_UP"))}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
