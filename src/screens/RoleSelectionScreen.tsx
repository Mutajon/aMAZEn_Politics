// src/screens/RoleSelectionScreen.tsx
// Redesigned with carousel navigation for role selection

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PushFn } from "../lib/router";
import { validateRoleStrict, AIConnectionError } from "../lib/validation";
import { useRoleStore } from "../store/roleStore";
import { useLogger } from "../hooks/useLogger";
import { useNavigationGuard } from "../hooks/useNavigationGuard";
import { useLang } from "../i18n/lang";
import { PREDEFINED_ROLES_ARRAY, getRoleImagePaths } from "../data/predefinedRoles";
import { useSettingsStore } from "../store/settingsStore";
import { useLoggingStore } from "../store/loggingStore";
import Gatekeeper from "../components/Gatekeeper";
import { useRoleCarousel } from "../hooks/useRoleCarousel";
import RoleCarouselContent from "../components/roleSelection/RoleCarouselContent";
import NavigationArrows from "../components/roleSelection/NavigationArrows";
import PositionIndicator from "../components/roleSelection/PositionIndicator";
import RoleInfoBox from "../components/roleSelection/RoleInfoBox";
import { audioManager } from "../lib/audioManager";

export default function RoleSelectionScreen({ push }: { push: PushFn }) {
  const lang = useLang();
  const logger = useLogger();

  // Navigation guard - prevent back button during role selection
  useNavigationGuard({
    enabled: true,
    confirmationMessage: lang("CONFIRM_EXIT_SETUP"),
    screenName: "role_selection_screen"
  });

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
  const setExperimentActiveRole = useLoggingStore((s) => s.setExperimentActiveRole);

  // Carousel hook
  const {
    currentIndex,
    currentItem,
    carouselItems,
    direction,
    navigateNext,
    navigatePrev,
    navigateToIndex,
    canNavigateNext,
    canNavigatePrev,
    touchHandlers,
  } = useRoleCarousel();

  // Custom role modal state
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [input, setInput] = useState("");
  const [aiMsg, setAiMsg] = useState("");
  const [aiError, setAiError] = useState("");
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Scenario suggestion modal state
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [scenarioForm, setScenarioForm] = useState({
    title: "",
    role: "",
    settings: "",
    introParagraph: "",
    topicsToEmphasis: ""
  });
  const [scenarioSubmitting, setScenarioSubmitting] = useState(false);
  const [scenarioSuccess, setScenarioSuccess] = useState(false);
  const [scenarioError, setScenarioError] = useState("");

  // Gatekeeper tutorial state
  const [showGatekeeper, setShowGatekeeper] = useState(true);

  const openSuggest = () => {
    setInput("");
    setAiMsg("");
    setAiError("");
    setChecking(false);
    setShowSuggestModal(true);
    setTimeout(() => inputRef.current?.focus(), 50);
    logger.log('button_click', 'Suggest Your Own', 'User clicked "Suggest your own" button from carousel');
  };

  const closeSuggest = () => {
    setShowSuggestModal(false);
    setAiMsg("");
    setAiError("");
  };

  const openScenarioModal = () => {
    setShowScenarioModal(true);
    setScenarioForm({
      title: "",
      role: "",
      settings: "",
      introParagraph: "",
      topicsToEmphasis: ""
    });
    setScenarioSuccess(false);
    setScenarioError("");
    logger.log('button_click', 'Suggest Scenario', 'User clicked Suggest Scenario button from carousel');
  };

  const closeScenarioModal = () => {
    setShowScenarioModal(false);
    setScenarioSuccess(false);
    setScenarioError("");
  };

  const handleScenarioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!scenarioForm.title.trim() || !scenarioForm.role.trim() || !scenarioForm.settings.trim()) {
      setScenarioError("Please fill in all required fields (Title, Role, Settings)");
      return;
    }

    setScenarioSubmitting(true);
    setScenarioError("");
    setScenarioSuccess(false);

    try {
      const response = await fetch("/api/suggest-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: scenarioForm.title.trim(),
          role: scenarioForm.role.trim(),
          settings: scenarioForm.settings.trim(),
          introParagraph: scenarioForm.introParagraph.trim() || undefined,
          topicsToEmphasis: scenarioForm.topicsToEmphasis.trim() || undefined
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to submit scenario suggestion");
      }

      setScenarioSuccess(true);
      logger.log('scenario_suggestion_submitted', scenarioForm.title, 'User submitted scenario suggestion');

      setTimeout(() => {
        setScenarioForm({
          title: "",
          role: "",
          settings: "",
          introParagraph: "",
          topicsToEmphasis: ""
        });
        setScenarioSuccess(false);
        closeScenarioModal();
      }, 2000);
    } catch (error: any) {
      console.error("Error submitting scenario suggestion:", error);
      setScenarioError(error.message || "Failed to submit scenario suggestion. Please try again.");
      logger.log('scenario_suggestion_error', error.message, 'Error submitting scenario suggestion');
    } finally {
      setScenarioSubmitting(false);
    }
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

  const handleRoleConfirm = () => {
    const item = currentItem;

    // Play click sound
    audioManager.playSfx('click-soft');

    // Handle special carousel items
    if (item.type === 'customRole') {
      openSuggest();
      return;
    }

    if (item.type === 'scenario') {
      openScenarioModal();
      return;
    }

    // Handle locked role attempt
    if (item.isLocked) {
      logger.log(
        'role_locked_attempt',
        item.roleKey || item.id,
        'User attempted to confirm a locked role'
      );
      return;
    }

    // Confirm role
    if (!item.roleKey || !item.role) {
      console.error("Cannot confirm role: missing role data", item);
      return;
    }

    logger.log('role_confirm', item.roleKey, `User confirmed predefined role: ${item.roleKey}`);

    setRole(item.roleKey);
    setExperimentActiveRole(experimentMode ? item.roleKey : null);

    // Prime analysis from role data
    const roleData = PREDEFINED_ROLES_ARRAY.find(r => r.legacyKey === item.roleKey);
    if (roleData) {
      setAnalysis(roleData.powerDistribution);
      setRoleBackgroundImage(getRoleImagePaths(roleData.imageId).full);
      setSupportProfiles(roleData.powerDistribution.supportProfiles ?? null);
      setRoleScope(roleData.roleScope);
      setStoryThemes(roleData.storyThemes);

      if (debugMode && roleData.powerDistribution.supportProfiles) {
        console.log("[RoleSelection][Debug] Support baselines for predefined role:", {
          role: item.roleKey,
          profiles: roleData.powerDistribution.supportProfiles,
        });
      }
      if (debugMode) {
        console.log("[RoleSelection][Debug] Scope & themes:", {
          role: item.roleKey,
          roleScope: roleData.roleScope,
          storyThemes: roleData.storyThemes,
        });
      }
    }

    // Save rich role context for AI
    if (item.title && item.intro && item.year) {
      setRoleContext(item.title, item.intro, item.year);
    }

    // Save role description for player card display
    if (item.youAre) {
      setRoleDescription(item.youAre);
    }

    push("/name");
  };

  return (
    <div className="min-h-[100dvh] overflow-hidden relative">
      {/* Carousel Background Content */}
      <RoleCarouselContent
        currentItem={currentItem}
        currentIndex={currentIndex}
        carouselItems={carouselItems}
        direction={direction}
        touchHandlers={touchHandlers}
      />

      {/* Navigation Arrows */}
      <NavigationArrows
        onPrev={navigatePrev}
        onNext={navigateNext}
        canNavigatePrev={canNavigatePrev}
        canNavigateNext={canNavigateNext}
      />

      {/* Position Indicator */}
      <PositionIndicator
        currentIndex={currentIndex}
        totalCount={carouselItems.length}
        onNavigateToIndex={navigateToIndex}
      />

      {/* Role Info Box (Bottom Panel) */}
      <RoleInfoBox
        item={currentItem}
        onConfirm={handleRoleConfirm}
        onOpenCustomRole={openSuggest}
        onOpenScenario={openScenarioModal}
      />

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
              className="relative w-[92%] max-w-md rounded-2xl p-4 sm:p-5 md:p-6 bg-neutral-900/90 backdrop-blur border border-white/10 shadow-xl text-left"
            >
              <button
                aria-label="Close"
                onClick={closeSuggest}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white"
              >
                ×
              </button>
              <h3 className="text-lg sm:text-xl font-semibold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
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

      {/* Scenario Suggestion Modal */}
      <AnimatePresence>
        {showScenarioModal && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={closeScenarioModal} />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="relative w-[92%] max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-5 md:p-6 bg-neutral-900/90 backdrop-blur border border-white/10 shadow-xl text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                aria-label="Close"
                onClick={closeScenarioModal}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white transition-colors"
              >
                ×
              </button>
              <h3 className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent mb-2">
                Suggest a Scenario
              </h3>
              <p className="text-white/80 text-sm mb-6">
                Help us expand the game by suggesting a new historical or fictional scenario. Your suggestion will be reviewed and may be added to the game.
              </p>

              <form onSubmit={handleScenarioSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={scenarioForm.title}
                    onChange={(e) => setScenarioForm({ ...scenarioForm, title: e.target.value })}
                    placeholder="e.g., The Great Depression"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Role <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={scenarioForm.role}
                    onChange={(e) => setScenarioForm({ ...scenarioForm, role: e.target.value })}
                    placeholder="e.g., President"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Settings (Place + Time) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={scenarioForm.settings}
                    onChange={(e) => setScenarioForm({ ...scenarioForm, settings: e.target.value })}
                    placeholder="e.g., USA during the 30s"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Intro Paragraph <span className="text-white/50 text-xs">(optional)</span>
                  </label>
                  <textarea
                    value={scenarioForm.introParagraph}
                    onChange={(e) => setScenarioForm({ ...scenarioForm, introParagraph: e.target.value })}
                    placeholder="Describe the setting and role in an engaging way"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Topics to Emphasis <span className="text-white/50 text-xs">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={scenarioForm.topicsToEmphasis}
                    onChange={(e) => setScenarioForm({ ...scenarioForm, topicsToEmphasis: e.target.value })}
                    placeholder="e.g., equality, racial tensions, taxes"
                    className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                  />
                </div>

                {scenarioSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 text-sm px-4 py-3"
                    role="alert"
                  >
                    ✓ Scenario suggestion submitted successfully! Thank you for your contribution.
                  </motion.div>
                )}

                {scenarioError && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-red-400/40 bg-red-500/10 text-red-200 text-sm px-4 py-3"
                    role="alert"
                  >
                    {scenarioError}
                  </motion.div>
                )}

                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={closeScenarioModal}
                    disabled={scenarioSubmitting}
                    className="rounded-xl px-5 py-2.5 text-sm font-medium bg-white/10 text-white hover:bg-white/15 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={scenarioSubmitting || !scenarioForm.title.trim() || !scenarioForm.role.trim() || !scenarioForm.settings.trim()}
                    className={`rounded-xl px-5 py-2.5 text-sm font-semibold shadow transition-all ${
                      scenarioSubmitting || !scenarioForm.title.trim() || !scenarioForm.role.trim() || !scenarioForm.settings.trim()
                        ? "bg-amber-300/40 text-[#0b1335]/60 cursor-not-allowed"
                        : "bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] hover:from-amber-400 hover:to-amber-600"
                    }`}
                  >
                    {scenarioSubmitting ? "Submitting..." : "Submit Suggestion"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gatekeeper tutorial hint */}
      <Gatekeeper
        text="So, who would you like to be this time?"
        isVisible={showGatekeeper}
        onDismiss={() => setShowGatekeeper(false)}
      />
    </div>
  );
}
