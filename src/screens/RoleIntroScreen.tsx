// src/screens/RoleIntroScreen.tsx
// Displays role information after shard selection in DreamScreen
// Shows role background, title, year, intro, score goal, and high scores

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import type { PushFn } from "../lib/router";
import { bgStyleWithRoleImage } from "../lib/ui";
import { useRoleStore } from "../store/roleStore";
import { useLoggingStore } from "../store/loggingStore";
import { useLang } from "../i18n/lang";
import { getPredefinedRole } from "../data/predefinedRoles";
import { useUserBestScore } from "../hooks/useUserBestScore";
import { useGlobalBestScore } from "../hooks/useGlobalBestScore";
import { useLogger } from "../hooks/useLogger";
import { useNarrator } from "../hooks/useNarrator";
import type { PreparedTTS } from "../hooks/useNarrator";
import { TTS_VOICE } from "../lib/ttsConfig";
import { useSettingsStore } from "../store/settingsStore";
import { Trophy, Crown } from "lucide-react";
import { audioManager } from "../lib/audioManager";

export default function RoleIntroScreen({ push }: { push: PushFn }) {
  const lang = useLang();
  const logger = useLogger();
  const narrator = useNarrator();
  const narrationEnabled = useSettingsStore((s) => s.narrationEnabled);
  const experimentMode = useSettingsStore((s) => s.experimentMode);
  const preparedTTSRef = useRef<PreparedTTS | null>(null);

  const selectedRole = useRoleStore((s) => s.selectedRole);
  const roleBackgroundImage = useRoleStore((s) => s.roleBackgroundImage);
  const userId = useLoggingStore((s) => s.userId);

  // Get role data
  const roleData = useMemo(() => {
    if (!selectedRole) return null;
    return getPredefinedRole(selectedRole);
  }, [selectedRole]);

  // Fetch scores (convert null to undefined for hook compatibility)
  const { bestScore: userBestScore } = useUserBestScore(userId ?? undefined);
  const { globalBest: globalBestScore } = useGlobalBestScore();

  // Background style
  const bgStyle = useMemo(
    () => bgStyleWithRoleImage(roleBackgroundImage),
    [roleBackgroundImage]
  );

  // Get translated intro text for TTS
  const introText = roleData?.introKey ? lang(roleData.introKey) : "";

  // Track if TTS has been played to prevent re-triggering
  const ttsPlayedRef = useRef(false);

  // TTS for role intro paragraph - only run once on mount
  useEffect(() => {
    if (!narrationEnabled || !introText || ttsPlayedRef.current) return;

    ttsPlayedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const p = await narrator.prepare(introText, { voiceName: TTS_VOICE });
        if (cancelled) { p.dispose(); return; }
        preparedTTSRef.current = p;
        await p.start();
      } catch (e) {
        console.warn("[RoleIntroScreen] TTS failed:", e);
      }
    })();

    return () => {
      cancelled = true;
      preparedTTSRef.current?.dispose();
      narrator.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introText, narrationEnabled]);

  // Continue handler
  const handleContinue = () => {
    audioManager.playSfx("click-soft");
    logger.log("role_intro_continue", { role: selectedRole }, "Player continued from role intro");
    push("/name");
  };

  // Redirect if no role selected
  if (!selectedRole || !roleData) {
    push("/dream");
    return null;
  }

  // Determine goal color based on score goal
  const goalColorClass = (() => {
    if (!roleData.scoreGoal) return "text-white";
    switch (roleData.scoreGoal) {
      case 200:
        return "text-white";
      case 212:
        return "text-yellow-200";
      case 225:
        return "text-orange-200";
      case 250:
        return "text-orange-300";
      case 275:
        return "text-rose-200";
      default:
        return "text-white";
    }
  })();

  return (
    <div className="min-h-[100dvh] flex flex-col" style={bgStyle}>
      {/* Spacer to push content down */}
      <div className="flex-1" />

      {/* Role info box at bottom */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="pb-6 px-4 md:px-8"
      >
        <div className="max-w-2xl mx-auto bg-black/70 backdrop-blur-md border border-amber-400/30 rounded-2xl shadow-2xl shadow-black/50 p-6 md:p-8">
          {/* Title and year */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-cinzel font-bold text-white tracking-wide drop-shadow-md">
                {lang(roleData.titleKey)}
              </h2>
              {roleData.subtitleKey && (
                <p className="text-white/70 text-sm mt-1">
                  {lang(roleData.subtitleKey)}
                </p>
              )}
            </div>
            {roleData.year && (
              <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-amber-400/30">
                <span className="text-[10px] uppercase tracking-wider text-amber-300/80">
                  {lang("YEAR")}
                </span>
                <span className="text-sm text-amber-300 font-light tracking-wider drop-shadow-md">
                  {roleData.year}
                </span>
              </div>
            )}
          </div>

          {/* Intro paragraph */}
          {introText && (
            <p className="text-sm text-white/90 leading-relaxed mb-4">
              {introText}
            </p>
          )}

          {/* Score goal and high scores */}
          {roleData.scoreGoal && (
            <div className="flex flex-wrap items-center gap-2 text-xs pt-4 border-t border-slate-700/40 mb-4">
              {/* Score Goal */}
              <div className="flex items-center gap-2">
                <span className="text-white/70">{lang("ROLE_GOAL_TARGET_LABEL")}:</span>
                <span className={`font-bold ${goalColorClass}`}>
                  {roleData.scoreGoal.toLocaleString()}
                </span>
              </div>

              {/* User's Personal Best */}
              {userBestScore && userBestScore > 0 && !experimentMode && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 border border-amber-400/30">
                  <Trophy className="w-3 h-3 flex-shrink-0 text-amber-300" />
                  <span className="text-white/70">{lang("ROLE_YOUR_BEST")}</span>
                  <span className="font-bold text-amber-300">
                    {userBestScore.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Global Best */}
              {globalBestScore && globalBestScore > 0 && !experimentMode && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-r from-purple-500/20 via-violet-400/20 to-purple-500/20 border border-purple-400/30">
                  <Crown className="w-3 h-3 flex-shrink-0 text-purple-300" />
                  <span className="text-white/70">{lang("ROLE_GLOBAL_BEST")}</span>
                  <span className="font-bold text-purple-300">
                    {globalBestScore.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={handleContinue}
            className="w-full rounded-xl px-4 sm:px-6 py-3 sm:py-4 font-semibold text-base shadow-lg bg-gradient-to-r from-amber-400 to-amber-600 text-gray-900 hover:from-amber-300 hover:to-amber-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            {lang("CONTINUE")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
