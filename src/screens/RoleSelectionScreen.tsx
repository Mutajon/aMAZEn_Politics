// src/screens/RoleSelectionScreen.tsx
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { bgStyle } from "../lib/ui";
import type { PushFn } from "../lib/router";
import { validateRoleStrict, AIConnectionError } from "../lib/validation";
import { useRoleStore } from "../store/roleStore";

type RoleItem = { icon: string; label: string; subtitle?: string; suggest?: boolean };

export default function RoleSelectionScreen({ push }: { push: PushFn }) {
  const setRole = useRoleStore((s) => s.setRole);

  const roles: RoleItem[] = [
    { icon: "🏛️", label: "Citizen of the Assembly in Classical Athens", subtitle: "5th century BCE" },
    { icon: "🏺", label: "Senator of the Roman Republic", subtitle: "3rd century BCE" },
    { icon: "🐉", label: "Emperor of Tang China", subtitle: "8th century AD" },
    { icon: "🇩🇪", label: "Chancellor of Modern Germany", subtitle: "21st century" },
    { icon: "❓", label: "Suggest your own", suggest: true },
  ];

  const [showModal, setShowModal] = useState(false);
  const [input, setInput] = useState("");
  const [aiMsg, setAiMsg] = useState(""); // guidance from AI when invalid
  const [aiError, setAiError] = useState(""); // connection/timeout/etc
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openSuggest = () => {
    setInput("");
    setAiMsg("");
    setAiError("");
    setChecking(false);
    setShowModal(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const closeSuggest = () => {
    setShowModal(false);
    setAiMsg("");
    setAiError("");
  };

  const amusingFallbacks = [
    "That sounds like a vibe, not a role *with* a setting. Try “navigator in a Bronze Age fleet”.",
    "Close! Give a role **and** a setting. e.g., “city treasurer in Renaissance Florence”.",
    "Almost. Add a where/when: “cybernetics minister on Luna, 2199”.",
  ];

  async function handleConfirm() {
    if (checking) return;
    setChecking(true);
    setAiMsg("");
    setAiError("");

    try {
      const { valid, reason } = await validateRoleStrict(input);

      if (!valid) {
        const witty =
          reason && reason.length > 0
            ? reason
            : amusingFallbacks[Math.floor(Math.random() * amusingFallbacks.length)];
        setAiMsg(witty);
        setChecking(false);
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }

      setAiMsg("Nice! That's a clear role and setting.");
      setChecking(false);
      setRole(input.trim());
      push("/power");
      closeSuggest();
    } catch (err) {
      if (err instanceof AIConnectionError) {
        setAiError("We can’t reach the AI service right now. Check your connection or API key and try again.");
      } else {
        setAiError("Unexpected error with AI validation.");
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
          Choose Your Role
        </h2>

        <motion.ul variants={container} initial="hidden" animate="show" className="mt-6 space-y-4">
          {roles.map((r, idx) => (
            <motion.li key={idx} variants={itemVariants}>
              <button
                onClick={() => {
                  if (r.suggest) return openSuggest();
                  const label = r.subtitle ? `${r.label} — ${r.subtitle}` : r.label;
                  setRole(label);
                  push("/power");
                }}
                className="w-full px-5 py-4 rounded-2xl bg-white/5 text-white/90 border border-white/10 hover:bg-white/10 hover:border-white/20 transition active:scale-[0.98] flex items-center gap-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
              >
                <span className="text-xl leading-none">{r.icon}</span>
                <span className="flex-1">
                  <span className="block text-base">{r.label}</span>
                  {r.subtitle && <span className="block text-xs text-white/70">{r.subtitle}</span>}
                </span>
              </button>
            </motion.li>
          ))}
        </motion.ul>

        {/* Suggest-your-own Modal */}
        <AnimatePresence>
          {showModal && (
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
                  Suggest your own role
                </h3>
                <p className="mt-2 text-white/80 text-sm">
                  Write a <span className="font-semibold">role</span> and a <span className="font-semibold">setting</span>.
                  For example: <em>“a king in medieval England”</em> or <em>“a partisan leader in World War II.”</em>
                </p>
                <div className="mt-4">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a role and a setting (king in medieval England, partisan leader in World War II, etc.)"
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
                    onClick={closeSuggest}
                    className="rounded-xl px-4 py-2 text-sm bg-white/10 text-white hover:bg-white/15"
                  >
                    Close
                  </button>
                  <button
                    disabled={input.trim().length < 10 || checking || !!aiError}
                    onClick={handleConfirm}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold shadow ${
                      input.trim().length < 10 || checking || !!aiError
                        ? "bg-amber-300/40 text-[#0b1335]/60 cursor-not-allowed"
                        : "bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335]"
                    }`}
                  >
                    {checking ? "Checking…" : "Confirm"}
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
