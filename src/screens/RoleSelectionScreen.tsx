// src/screens/RoleSelectionScreen.tsx
import { useRef, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { bgStyleWithMaze } from "../lib/ui";
import type { PushFn } from "../lib/router";
import { validateRoleStrict, AIConnectionError } from "../lib/validation";
import { useRoleStore } from "../store/roleStore";
import { useLogger } from "../hooks/useLogger";
import { useLang } from "../i18n/lang";
import { PREDEFINED_ROLES_ARRAY, getRoleImagePaths } from "../data/predefinedRoles";

type RoleItem = {
  key: string; // Unique key for the role (matches predefinedPowerDistributions keys)
  title: string; // Title (e.g., "Athens — The Day Democracy Died")
  year: string; // Year badge (e.g., "(-404)")
  intro: string; // Intro paragraph (situation description)
  youAre: string; // "You are:" role description
  bannerImage?: string; // Banner image path (small, shown when collapsed)
  fullImage?: string; // Full image path (large, shown when expanded)
  suggest?: boolean; // Flag for "Suggest your own" button
};

export default function RoleSelectionScreen({ push }: { push: PushFn }) {
  const lang = useLang();
  const logger = useLogger();
  const setRole = useRoleStore((s) => s.setRole);
  const setAnalysis = useRoleStore(s => s.setAnalysis);
  const setRoleBackgroundImage = useRoleStore(s => s.setRoleBackgroundImage);
  const setRoleContext = useRoleStore(s => s.setRoleContext);

  // Generate roles array dynamically from centralized database
  const roles: RoleItem[] = PREDEFINED_ROLES_ARRAY.map((roleData) => {
    const images = getRoleImagePaths(roleData.imageId);
    return {
      key: roleData.legacyKey,
      title: lang(roleData.titleKey),      // Translated at runtime
      year: roleData.year,
      intro: lang(roleData.introKey),      // Translated at runtime
      youAre: lang(roleData.youAreKey),    // Translated at runtime
      bannerImage: images.banner,
      fullImage: images.full,
    };
  });

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

      setChecking(false);
      setRole(input.trim());

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
    logger.log('role_confirm', role.key, `User confirmed predefined role: ${role.key}`);

    setRole(role.key);

    // Prime analysis from centralized predefined roles database
    const roleData = PREDEFINED_ROLES_ARRAY.find(r => r.legacyKey === role.key);
    if (roleData) {
      setAnalysis(roleData.powerDistribution);
      setRoleBackgroundImage(getRoleImagePaths(roleData.imageId).full);
    }

    // Save rich role context for AI (title, intro, year) - predefined roles only
    setRoleContext(role.title, role.intro, role.year);

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
          {roles.map((role) => (
            <motion.div key={role.key} variants={itemVariants} data-role-card>
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
                  <span className="text-base text-white font-cinzel font-semibold tracking-wide drop-shadow-md flex-1">{role.title}</span>

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

                  <span className="text-sm text-amber-300 font-light tracking-wider drop-shadow-md">{role.year}</span>
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
                              handleRoleConfirm(role);
                            }}
                            className="w-full rounded-xl px-4 py-3 font-semibold text-sm shadow-lg bg-gradient-to-r from-amber-400 to-amber-600 text-gray-900 hover:from-amber-300 hover:to-amber-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                          >
                            {lang("CONFIRM")}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}

          {/* Suggest your own button */}
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
        </motion.div>

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
