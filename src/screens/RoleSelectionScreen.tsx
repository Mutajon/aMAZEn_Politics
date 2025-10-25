// src/screens/RoleSelectionScreen.tsx
import { useRef, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { bgStyle } from "../lib/ui";
import type { PushFn } from "../lib/router";
import { validateRoleStrict, AIConnectionError } from "../lib/validation";
import { useRoleStore } from "../store/roleStore";
import { POLITICAL_SYSTEMS } from "../data/politicalSystems";
import { getPredefinedPowerDistribution } from "../data/predefinedPowerDistributions";
import { useLogger } from "../hooks/useLogger";
import { useLang } from "../i18n/lang";

// Map display names in the roles list to our canonical political systems.
const SYSTEM_ALIAS: Record<string, string> = {
  "Early Republicanism": "Unitary Republic", // <- one-time mapping you asked for
};

function findPoliticalSystemByName(name: string | undefined) {
  if (!name) return undefined;
  const canonical = SYSTEM_ALIAS[name] ?? name;
  return POLITICAL_SYSTEMS.find(ps => ps.name.toLowerCase() === canonical.toLowerCase());
}

type RoleItem = { 
  icon: string; 
  label: string; 
  subtitle?: string; 
  suggest?: boolean;
  system?: string; // NEW: political system
  flavor?: string; // NEW: flavor text for modal
};

export default function RoleSelectionScreen({ push }: { push: PushFn }) {
  const lang = useLang();
  const logger = useLogger();
  const setRole = useRoleStore((s) => s.setRole);
  const setAnalysis = useRoleStore(s => s.setAnalysis);

// Prime the complete analysis (system + holders) for pre-defined roles.
// If predefined power distribution exists, use it; otherwise just set system info.
const primeAnalysisFromRole = (roleLabel: string, systemName?: string) => {
  // Check if we have a predefined power distribution for this role
  const predefinedAnalysis = getPredefinedPowerDistribution(roleLabel);

  if (predefinedAnalysis) {
    // Use the complete predefined analysis (no AI call needed later)
    setAnalysis(predefinedAnalysis);
  } else {
    // Fall back to just priming the political system (AI will analyze holders later)
    const ps = findPoliticalSystemByName(systemName);
    setAnalysis({
      systemName: ps?.name ?? "",
      systemDesc: ps?.description ?? "",
      flavor: ps?.flavor ?? "",
      holders: [],          // holders will be determined on the Power screen via AI
      playerIndex: null,
    });
  }
};

// Clear holders when entering role selection to ensure fresh API call
// This prevents cached holders from skipping the API analysis
useEffect(() => {
  const currentAnalysis = useRoleStore.getState().analysis;
  if (currentAnalysis?.holders && currentAnalysis.holders.length > 0) {
    setAnalysis({
      ...currentAnalysis,
      holders: [],
      playerIndex: null,
    });
  }
}, [setAnalysis]);

  // Roles with political system + flavor text
  const roles: RoleItem[] = [
    { 
      icon: "🏛️", 
      label: lang("CITIZEN_ASSEMBLY_ATHENS"),
      subtitle: lang("ATHENS_SUBTITLE"),
      system: lang("ROLE_DIRECT_DEMOCRACY"),
      flavor: lang("ATHENS_FLAVOR")
    },
    { 
      icon: "🏺", 
      label: lang("SENATOR_ROMAN_REPUBLIC"),
      subtitle: lang("ROME_SUBTITLE"),
      system: lang("ROLE_EARLY_REPUBLICANISM"),
      flavor: lang("ROME_FLAVOR")
    },
    { 
      icon: "🐉", 
      label: lang("EMPEROR_TANG_CHINA"),
      subtitle: lang("CHINA_SUBTITLE"),
      system: lang("ROLE_ABSOLUTE_MONARCHY"),
      flavor: lang("CHINA_FLAVOR")
    },
    { 
      icon: "🇩🇪", 
      label: lang("CHANCELLOR_MODERN_GERMANY"),
      subtitle: lang("GERMANY_SUBTITLE"),
      system: lang("ROLE_REPRESENTATIVE_DEMOCRACY"),
      flavor: lang("GERMANY_FLAVOR")
    },
    { icon: "❓", label: lang("SUGGEST_YOUR_OWN"), suggest: true },
  ];

  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null); // NEW: for flavor modal
  const [input, setInput] = useState("");
  const [aiMsg, setAiMsg] = useState("");
  const [aiError, setAiError] = useState("");
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

      // BUGFIX: Clear stale political system data when entering custom role
      // This ensures AI will analyze the custom role fresh instead of using cached predefined data
      setAnalysis({
        systemName: "",
        systemDesc: "",
        flavor: "",
        holders: [],
        playerIndex: null,
      });

      // Navigation will be logged automatically by router
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

  const container: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
  };
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 8, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 22 } },
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-5" style={bgStyle}>
      <div className="w-full max-w-md text-center select-none">
        <h2 className="text-3xl font-extrabold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
          {lang("CHOOSE_YOUR_ROLE")}
        </h2>

        <motion.ul variants={container} initial="hidden" animate="show" className="mt-6 space-y-4">
          {roles.map((r, idx) => (
            <motion.li key={idx} variants={itemVariants}>
              <button
                onClick={() => {
                  if (r.suggest) {
                    logger.log('button_click', 'Suggest Your Own', 'User clicked "Suggest your own" button');
                    return openSuggest();
                  }
                  logger.log('role_click', r.label, `User clicked role: ${r.label}`);
                  setSelectedRole(r); // open flavor modal
                }}
                className="relative w-full px-5 py-4 rounded-2xl bg-white/5 text-white/90 border border-white/10 hover:bg-white/10 hover:border-white/20 transition active:scale-[0.98] flex items-center gap-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
              >
                <span className="text-xl leading-none">{r.icon}</span>
                <span className="flex-1">
                  <span className="block text-base">{r.label}</span>
                  {r.subtitle && <span className="block text-xs text-white/70">{r.subtitle}</span>}
                </span>
                {/* Political System in bottom-right */}
                {r.system && (
                  <span className="absolute bottom-2 right-3 text-[11px] text-amber-200/80 italic">
                    {r.system}
                  </span>
                )}
              </button>
            </motion.li>
          ))}
        </motion.ul>

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

        {/* Flavor Modal for predefined roles */}
        <AnimatePresence>
          {selectedRole && (
            <motion.div
              className="fixed inset-0 z-50 grid place-items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedRole(null)} />
              <motion.div
                role="dialog"
                aria-modal="true"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="relative w-[92%] max-w-md rounded-2xl p-6 bg-neutral-900/95 backdrop-blur border border-white/10 shadow-xl text-center"
              >
                <h3 className="text-lg font-semibold text-amber-200 mb-3">{selectedRole.label}</h3>
                <p className="text-white/80 text-sm">{selectedRole.flavor}</p>

                <div className="mt-6 flex gap-4 justify-center">
                  <button
                    onClick={() => {
                      logger.log('button_click', 'Back', 'User clicked Back in flavor modal');
                      setSelectedRole(null);
                    }}
                    className="rounded-xl px-4 py-2 text-sm bg-white/10 text-white hover:bg-white/15"
                  >
                    {lang("BACK")}
                  </button>
                  <button
                    onClick={() => {
                      // Extract role name without time period (e.g., "Senator of the Roman Republic" instead of full label)
                      const roleName = selectedRole.label.replace(/\s*\(.*?\)\s*/g, '').trim();

                      logger.log('role_confirm', roleName, `User confirmed predefined role: ${roleName}`);

                      setRole(selectedRole.label);
                      primeAnalysisFromRole(selectedRole.label, selectedRole.system);

                      // Navigation will be logged automatically by router
                      push("/name");
                    }}
                    className="rounded-xl px-4 py-2 text-sm font-semibold shadow bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335]"
                  >
                    {lang("CONFIRM")}
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
