// src/screens/RoleSelectionScreen.tsx
import { useRef, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { bgStyleWithMaze } from "../lib/ui";
import type { PushFn } from "../lib/router";
import { validateRoleStrict, AIConnectionError } from "../lib/validation";
import { useRoleStore } from "../store/roleStore";
import { useLogger } from "../hooks/useLogger";
import { useSessionLogger } from "../hooks/useSessionLogger";
import { useLang } from "../i18n/lang";
import { PREDEFINED_ROLES_ARRAY, getRoleImagePaths, type RoleGoalStatus, EXPERIMENT_PREDEFINED_ROLE_KEYS } from "../data/predefinedRoles";
import { useSettingsStore } from "../store/settingsStore";
import { useRoleProgressStore } from "../store/roleProgressStore";
import { useLoggingStore } from "../store/loggingStore";

const EXPERIMENT_ROLE_KEY_SET = new Set(EXPERIMENT_PREDEFINED_ROLE_KEYS);

type RoleItem = {
  key: string; // Unique key for the role (matches predefinedPowerDistributions keys)
  title: string; // Title (e.g., "Athens — The Day Democracy Died")
  subtitle: string; // Subtitle theme (e.g., "Power and Legitimacy")
  year: string; // Year badge (e.g., "(-404)")
  intro: string; // Intro paragraph (situation description)
  youAre: string; // "You are:" role description
  bannerImage?: string; // Banner image path (small, shown when collapsed)
  fullImage?: string; // Full image path (large, shown when expanded)
  suggest?: boolean; // Flag for "Suggest your own" button
  scoreGoal: number;
  goalStatus: RoleGoalStatus;
  highScore: number;
};

export default function RoleSelectionScreen({ push }: { push: PushFn }) {
  const lang = useLang();
  const logger = useLogger();
  const sessionLogger = useSessionLogger();
  const setRole = useRoleStore((s) => s.setRole);
  const setAnalysis = useRoleStore(s => s.setAnalysis);
  const setRoleBackgroundImage = useRoleStore(s => s.setRoleBackgroundImage);
  const setRoleContext = useRoleStore(s => s.setRoleContext);
  const setRoleDescription = useRoleStore(s => s.setRoleDescription);
  const setSupportProfiles = useRoleStore(s => s.setSupportProfiles);
  const setRoleScope = useRoleStore(s => s.setRoleScope);
  const setStoryThemes = useRoleStore(s => s.setStoryThemes);
  const debugMode = useSettingsStore(s => s.debugMode);
  const experimentMode = useSettingsStore(s => s.experimentMode);
  const roleGoals = useRoleProgressStore((s) => s.goals);
  const experimentProgress = useLoggingStore((s) => s.experimentProgress);
  const setExperimentActiveRole = useLoggingStore((s) => s.setExperimentActiveRole);

  // Generate roles array dynamically from centralized database
  const roles: RoleItem[] = PREDEFINED_ROLES_ARRAY.map((roleData) => {
    const images = getRoleImagePaths(roleData.imageId);
    return {
      key: roleData.legacyKey,
      title: lang(roleData.titleKey),      // Translated at runtime
      subtitle: lang(roleData.subtitleKey), // Translated at runtime
      year: roleData.year,
      intro: lang(roleData.introKey),      // Translated at runtime
      youAre: lang(roleData.youAreKey),    // Translated at runtime
      bannerImage: images.banner,
      fullImage: images.full,
      scoreGoal: roleData.scoreGoal,
      goalStatus: roleGoals[roleData.legacyKey]?.status ?? roleData.defaultGoalStatus,
      highScore: roleGoals[roleData.legacyKey]?.bestScore ?? roleData.defaultHighScore,
    };
  });

  const experimentCompletedRoles = experimentProgress.completedRoles;
  const experimentCompletedCount = EXPERIMENT_PREDEFINED_ROLE_KEYS.reduce(
    (count, key) => count + (experimentCompletedRoles?.[key] ? 1 : 0),
    0
  );
  const experimentAllCompleted =
    experimentCompletedCount >= EXPERIMENT_PREDEFINED_ROLE_KEYS.length;

  const experimentVisibleRoles = experimentMode
    ? roles.filter((role) => EXPERIMENT_ROLE_KEY_SET.has(role.key))
    : roles;

  const isExperimentRoleUnlocked = (roleKey: string) => {
    if (!experimentMode) {
      return true;
    }
    if (!EXPERIMENT_ROLE_KEY_SET.has(roleKey)) {
      return false;
    }
    if (experimentAllCompleted) {
      return false;
    }
    if (experimentCompletedRoles?.[roleKey]) {
      return false;
    }
    const roleIndex = EXPERIMENT_PREDEFINED_ROLE_KEYS.indexOf(roleKey);
    if (roleIndex === -1) {
      return false;
    }

    return roleIndex === experimentCompletedCount;
  };

  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [input, setInput] = useState("");
  const [aiMsg, setAiMsg] = useState("");
  const [aiError, setAiError] = useState("");
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Click outside to collapse
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-role-card]')) {
        setExpandedRole(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (experimentMode && expandedRole && !EXPERIMENT_ROLE_KEY_SET.has(expandedRole)) {
      setExpandedRole(null);
    }
  }, [experimentMode, expandedRole]);

  const openSuggest = () => {
    setInput("");
    setAiMsg("");
    setAiError("");
    setChecking(false);
    setShowSuggestModal(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const closeSuggest = () => {
    setShowSuggestModal(false);
    setAiMsg("");
    setAiError("");
  };

  const amusingFallbacks = [
    lang("AI_FALLBACK_1"),
    lang("AI_FALLBACK_2"),
    lang("AI_FALLBACK_3"),
  ];

  async function handleConfirmSuggest() {
    if (checking) return;

    logger.log('button_click', 'Validate Custom Role', 'User clicked Validate for custom role');

    setChecking(true);
    setAiMsg("");
    setAiError("");

    try {
      const { valid, reason } = await validateRoleStrict(input);

      if (!valid) {
        logger.log('role_validation_failed', input, `Custom role validation failed: ${reason}`);

        const witty =
          reason && reason.length > 0
            ? reason
            : amusingFallbacks[Math.floor(Math.random() * amusingFallbacks.length)];
        setAiMsg(witty);
        setChecking(false);
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }

      setAiMsg(lang("AI_NICE_ROLE"));
      logger.log('role_confirm', input.trim(), 'User confirmed custom role');
      sessionLogger.start({ roleType: 'custom', role: input.trim() });

      setChecking(false);
      setRole(input.trim());
      setExperimentActiveRole(null);

      // Clear stale political system data when entering custom role
      setAnalysis({
        systemName: "",
        systemDesc: "",
        flavor: "",
        holders: [],
        playerIndex: null,
      });

      // For custom roles, use the splash screen maze image as background
      setRoleBackgroundImage("/assets/images/BKGs/mainBKG.jpg");

      // Clear role context (custom roles have no intro/year data)
      setRoleContext(null, null, null);

      // Set role description to the custom role text
      setRoleDescription(input.trim());

      setSupportProfiles(null);
      setRoleScope(null);
      setStoryThemes(null);

      push("/name");
      closeSuggest();
    } catch (err) {
      logger.log('role_validation_error', input, 'Error during custom role validation');

      if (err instanceof AIConnectionError) {
        setAiError(lang("AI_CONNECTION_ERROR"));
      } else {
        setAiError(lang("AI_UNEXPECTED_ERROR"));
      }
      setChecking(false);
    }
  }

  const handleRoleConfirm = (role: RoleItem) => {
    if (experimentMode && !isExperimentRoleUnlocked(role.key)) {
      logger.log(
        'role_locked_attempt',
        role.key,
        'User attempted to confirm a locked role while experiment mode is active'
      );
      return;
    }

    logger.log('role_confirm', role.key, `User confirmed predefined role: ${role.key}`);
    sessionLogger.start({ roleType: 'predefined', role: role.key });

    setRole(role.key);
    setExperimentActiveRole(experimentMode ? role.key : null);

    // Treatment is assigned during user registration (via /api/users/register)
    // and should not be changed based on role selection

    // Prime analysis from centralized predefined roles database
    const roleData = PREDEFINED_ROLES_ARRAY.find(r => r.legacyKey === role.key);
    if (roleData) {
      setAnalysis(roleData.powerDistribution);
      setRoleBackgroundImage(getRoleImagePaths(roleData.imageId).full);
      setSupportProfiles(roleData.powerDistribution.supportProfiles ?? null);
      setRoleScope(roleData.roleScope);
      setStoryThemes(roleData.storyThemes);
      if (debugMode && roleData.powerDistribution.supportProfiles) {
        console.log("[RoleSelection][Debug] Support baselines for predefined role:", {
          role: role.key,
          profiles: roleData.powerDistribution.supportProfiles,
        });
      }
      if (debugMode) {
        console.log("[RoleSelection][Debug] Scope & themes:", {
          role: role.key,
          roleScope: roleData.roleScope,
          storyThemes: roleData.storyThemes,
        });
      }
    }

    // Save rich role context for AI (title, intro, year) - predefined roles only
    setRoleContext(role.title, role.intro, role.year);

    // Save role description for player card display (e.g., "Governor in Florence")
    setRoleDescription(role.youAre);

    push("/name");
  };

  const container: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 8, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 22 } },
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-5 py-8" style={bgStyleWithMaze}>
      <div className="w-full max-w-2xl text-center select-none">
        <h2 className="text-3xl font-extrabold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
          {lang("CHOOSE_YOUR_ROLE")}
        </h2>

        <motion.div variants={container} initial="hidden" animate="show" className="mt-6 space-y-3">
          {experimentVisibleRoles.map((role) => {
            const statusCompleted = role.goalStatus === "completed";
            const statusLabel = lang(statusCompleted ? "ROLE_GOAL_COMPLETED" : "ROLE_GOAL_UNCOMPLETED");
            const statusClasses = statusCompleted
              ? "bg-gradient-to-r from-emerald-400/40 via-emerald-500/40 to-emerald-400/40 text-emerald-100 border border-emerald-300/40 shadow-[0_0_8px_rgba(16,185,129,0.25)]"
              : "bg-slate-800/60 text-slate-300 border border-slate-600/60";
            const goalColorClass = (() => {
              switch (role.scoreGoal) {
                case 1000:
                  return "text-white";
                case 1100:
                  return "text-yellow-200";
                case 1200:
                  return "text-orange-200";
                case 1300:
                  return "text-orange-300";
                case 1400:
                  return "text-rose-200";
                default:
                  return "text-white";
              }
            })();
            const highScoreDisplay = role.highScore > 0 ? role.highScore.toLocaleString() : "-";
            const experimentRoleLocked = experimentMode && !isExperimentRoleUnlocked(role.key);
            const experimentRoleCompleted = experimentMode && !!experimentCompletedRoles?.[role.key];
            const lockMessage = experimentRoleCompleted
              ? lang("EXPERIMENT_ROLE_ALREADY_COMPLETED")
              : lang("EXPERIMENT_ROLE_LOCKED");
            const confirmButtonClasses = experimentRoleLocked
              ? "w-full rounded-xl px-4 py-3 font-semibold text-sm bg-slate-700/60 text-white/40 cursor-not-allowed transition-all duration-200"
              : "w-full rounded-xl px-4 py-3 font-semibold text-sm shadow-lg bg-gradient-to-r from-amber-400 to-amber-600 text-gray-900 hover:from-amber-300 hover:to-amber-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200";

            return (
              <motion.div
                key={role.key}
                variants={itemVariants}
                data-role-card
                className={experimentRoleLocked ? "opacity-70" : undefined}
              >
              {/* Golden frame wrapper that contains both title and expanded content */}
              <div className={`rounded-2xl overflow-hidden shadow-xl transition-all duration-300 ${
                expandedRole === role.key
                  ? 'ring-2 ring-amber-400/80 shadow-amber-500/20 shadow-2xl'
                  : 'ring-1 ring-amber-400/40 hover:ring-amber-400/60'
              }`}>
                {/* Title row - always visible with sleek navy gradient background */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    logger.log('role_click', role.key, `User clicked role: ${role.key}`);
                    setExpandedRole(expandedRole === role.key ? null : role.key);
                  }}
                  className="w-full px-6 py-.5 flex items-center gap-4 text-left transition-all duration-300 bg-gradient-to-r from-slate-900/95 via-blue-950/95 to-slate-900/95 hover:from-slate-800/98 hover:via-blue-900/98 hover:to-slate-800/98"
                >
                  <div className="flex-1 flex flex-col gap-0.5">
                    <span className="text-base text-white font-cinzel font-semibold tracking-wide drop-shadow-md">{role.title}</span>
                  </div>

                  {/* Banner image - fades out when expanded */}
                  {role.bannerImage && (
                    <AnimatePresence>
                      {expandedRole !== role.key && (
                        <motion.img
                          key={`banner-${role.key}`}
                          src={role.bannerImage}
                          alt={`${role.title} banner`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="h-14 w-auto rounded-lg object-cover shadow-md"
                        />
                      )}
                    </AnimatePresence>
                  )}

                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-amber-300/80">{lang("ROLE_YEAR_LABEL")}</span>
                      <span className="text-sm text-amber-300 font-light tracking-wider drop-shadow-md">{role.year}</span>
                    </div>
                    <span
                      className={[
                        "text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full",
                        "font-medium transition-colors duration-200",
                        statusClasses,
                      ].join(" ")}
                    >
                      {statusLabel}
                    </span>
                  </div>
                </button>

                {/* Expandable content with black semi-transparent background */}
                <AnimatePresence>
                  {expandedRole === role.key && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="bg-black/60 backdrop-blur-sm border-t border-slate-700/50">
                        <div className="px-6 py-5 space-y-4">
                          {/* Framed content area with two-column layout */}
                          <div className="rounded-xl border border-slate-700/50 bg-black/30 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                              {/* Left column: Text content */}
                              <div className="space-y-3">
                                {/* Intro paragraph */}
                                <p className="text-sm text-white/95 leading-relaxed">
                                  {role.intro}
                                </p>

                                {/* "You are:" section */}
                                <div className="pt-2 border-t border-slate-700/40">
                                  <p className="text-sm text-white/95">
                                    <span className="font-semibold text-amber-300">You are:</span>{" "}
                                    <span className="text-white/90">{role.youAre}</span>
                                  </p>
                                </div>

                                <div className="flex flex-col items-center gap-1 text-xs text-center">
                                  <span className="uppercase tracking-wide font-semibold text-purple-300">
                                    {lang("ROLE_GOAL_TARGET_LABEL")}
                                  </span>
                                  <span className={["font-semibold text-lg", goalColorClass, "drop-shadow-sm"].join(" ")}>
                                    {role.scoreGoal.toLocaleString()}
                                  </span>
                                  <span className="text-[11px] text-white/60 font-medium">
                                    {lang("ROLE_CURRENT_HIGH_SCORE_LABEL")}: {highScoreDisplay}
                                  </span>
                                </div>
                              </div>

                              {/* Right column: Full image */}
                              {role.fullImage && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ duration: 0.3, delay: 0.1, ease: "easeInOut" }}
                                  className="flex items-center justify-center"
                                >
                                  <img
                                    src={role.fullImage}
                                    alt={`${role.title} scene`}
                                    className="rounded-xl object-cover w-full md:w-[300px] max-h-[200px] shadow-lg"
                                  />
                                </motion.div>
                              )}
                            </div>
                          </div>

                          {/* Confirm button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (experimentRoleLocked) {
                                logger.log(
                                  'role_locked_attempt',
                                  role.key,
                                  'User attempted to confirm a locked role from button press'
                                );
                                return;
                              }
                              handleRoleConfirm(role);
                            }}
                            className={confirmButtonClasses}
                            disabled={experimentRoleLocked}
                            aria-disabled={experimentRoleLocked}
                          >
                            {experimentRoleLocked ? lang("LOCKED") : lang("CONFIRM")}
                          </button>
                          {experimentMode && experimentRoleLocked && (
                            <p className="mt-2 text-xs text-amber-100/80 text-center">
                              {lockMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              </motion.div>
            );
          })}

          {!experimentMode && (
            <motion.div variants={itemVariants}>
              <button
                onClick={() => {
                  logger.log('button_click', 'Suggest Your Own', 'User clicked "Suggest your own" button');
                  openSuggest();
                }}
                className="w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-purple-900/90 to-purple-700/90 hover:from-purple-800/95 hover:to-purple-700/95 text-white border border-purple-500/30 hover:border-purple-400/40 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-3 shadow-xl"
              >
                <span className="text-xl leading-none">❓</span>
                <span className="text-base font-medium tracking-wide drop-shadow-sm">{lang("SUGGEST_YOUR_OWN")}</span>
              </button>
            </motion.div>
          )}
        </motion.div>

        {experimentMode && experimentAllCompleted && (
          <div className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            {lang("EXPERIMENT_ALL_ROLES_COMPLETE")}
          </div>
        )}

        {/* Suggest-your-own Modal */}
        <AnimatePresence>
          {showSuggestModal && (
            <motion.div
              className="fixed inset-0 z-50 grid place-items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-black/60" onClick={closeSuggest} />
              <motion.div
                role="dialog"
                aria-modal="true"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="relative w-[92%] max-w-md rounded-2xl p-5 bg-neutral-900/90 backdrop-blur border border-white/10 shadow-xl text-left"
              >
                <button
                  aria-label="Close"
                  onClick={closeSuggest}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white"
                >
                  ×
                </button>
                <h3 className="text-xl font-semibold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                  {lang("SUGGEST_ROLE_TITLE")}
                </h3>
                <p className="mt-2 text-white/80 text-sm">
                  {lang("SUGGEST_ROLE_DESC")}
                </p>
                <div className="mt-4">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      logger.log('custom_role_input', e.target.value, 'User typing custom role');
                    }}
                    placeholder={lang("SUGGEST_ROLE_PLACEHOLDER")}
                    className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                  />
                </div>

                {aiMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-amber-200/95 text-sm"
                    aria-live="polite"
                  >
                    {aiMsg}
                  </motion.div>
                )}

                {aiError && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 text-red-200 text-sm px-3 py-2"
                    role="alert"
                  >
                    {aiError}
                  </motion.div>
                )}

                <div className="mt-5 flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      logger.log('button_click', 'Cancel Custom Role', 'User clicked Cancel/Close in custom role modal');
                      closeSuggest();
                    }}
                    className="rounded-xl px-4 py-2 text-sm bg-white/10 text-white hover:bg-white/15"
                  >
                    {lang("CLOSE")}
                  </button>
                  <button
                    disabled={input.trim().length < 10 || checking || !!aiError}
                    onClick={handleConfirmSuggest}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold shadow ${
                      input.trim().length < 10 || checking || !!aiError
                        ? "bg-amber-300/40 text-[#0b1335]/60 cursor-not-allowed"
                        : "bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335]"
                    }`}
                  >
                    {checking ? lang("CHECKING") : lang("CONFIRM")}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
