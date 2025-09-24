// ActionDeck.tsx — deck of 3 action “cards” with staggered entrance,
// DARK opaque gradient backgrounds per card, optional budget,
// expand-on-select + confirm, and a "Suggest your own" modal.

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coins,
  ShieldAlert,
  Megaphone,
  Handshake,
  CheckCircle2,
} from "lucide-react";

/* ================== TUNABLES (EDIT HERE) ================== */
const ENTER_STAGGER = 0.12;
const ENTER_DURATION = 0.36;
const ENTER_Y = 24;

// Typography/layout
const CARD_TITLE_CLASS = "text-[14px] font-semibold text-white";
const CARD_DESC_CLASS  = "text-[12.5px] leading-snug text-white/95";
const CARD_PAD = "p-3";

// Base chrome (opaque, darker ring for separation on saturated colors)
const CARD_BASE = "rounded-2xl ring-1 ring-white/20 shadow-sm";

// Buttons
const CONFIRM_BTN_CLASS =
  "px-3 py-1.5 rounded-full bg-emerald-500 text-white text-[12px] font-semibold shadow hover:bg-emerald-600 active:scale-[0.99]";
const SUGGEST_BTN_CLASS =
  "w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-full bg-white/8 ring-1 ring-white/10 text-white shadow-sm";

// Backdrops
const OVERLAY_BACKDROP = "absolute inset-0 bg-black/70";

// Suggest modal text behavior
const SUGGEST_PLACEHOLDER = "Type your suggestion…";
const SUGGEST_PREFILL     = "";
/* ========================================================== */

export type ActionCard = {
  id: string;
  title: string;
  summary: string;
  icon: React.ReactNode;      // lucide element (e.g., <Megaphone .../>)
  iconBgClass: string;        // e.g., "bg-sky-400/20"
  iconTextClass: string;      // e.g., "text-sky-200"
  /** OPAQUE DARK gradient for the card body (both grid + expanded). */
  cardGradientClass: string;  // e.g., "bg-gradient-to-br from-sky-950 via-sky-900 to-sky-950"
  cost?: number;              // negative = spend, positive = gain
};

type Props = {
  actions: ActionCard[];               // exactly 3
  showBudget: boolean;
  budget: number;
  onConfirm: (id: string) => void;
  onSuggest?: (text?: string) => void;
  suggestCost?: number;                // default -300
};

export default function ActionDeck({
  actions,
  showBudget,
  budget,
  onConfirm,
  onSuggest,
  suggestCost = -300,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  // Suggest modal
  const [isSuggestOpen, setSuggestOpen] = useState(false);
  const [suggestText, setSuggestText] = useState<string>(SUGGEST_PREFILL);

  const cards = useMemo(() => {
    return actions.map((a) => {
      const cost = a.cost ?? 0;
      const affordable = !showBudget || cost >= 0 || budget >= Math.abs(cost);
      return { ...a, cost, affordable };
    });
  }, [actions, showBudget, budget]);

  const selectedCard = cards.find((c) => c.id === selected) || null;

  function openSuggest() {
    if (showBudget && budget < Math.abs(suggestCost)) return;
    setSuggestText(SUGGEST_PREFILL);
    setSuggestOpen(true);
  }

  function confirmSuggest() {
    onSuggest?.(suggestText.trim() || undefined);
    setSuggestOpen(false);
  }

  return (
    <div className="mt-4 relative">
      {/* Cards row */}
      <motion.div
        className="grid grid-cols-3 gap-3"
        initial={false}
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: ENTER_STAGGER } } }}
      >
        {cards.map((c) => {
          const isSelected = selected === c.id;
          const disabled = !c.affordable;

          return (
            <motion.div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => !disabled && setSelected(c.id)}
              onKeyDown={(e) => {
                if (!disabled && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setSelected(c.id);
                }
              }}
              className={[
                CARD_BASE,
                CARD_PAD,
                c.cardGradientClass, // ← DARK opaque gradient
                "text-left relative transition-transform",
                disabled ? "opacity-50 saturate-75 cursor-not-allowed" : "cursor-pointer hover:brightness-[1.03]",
                isSelected ? "ring-2 ring-white/30" : "",
              ].join(" ")}
              initial={false}
              variants={{
                hidden: { opacity: 0, y: ENTER_Y, scale: 0.97, rotate: -1.2 },
                show:   { opacity: 1, y: 0,       scale: 1.0,  rotate: 0, transition: { type: "tween", duration: ENTER_DURATION, ease: [0.16, 1, 0.3, 1] } },
              }}
              whileHover={!disabled && !isSelected ? { y: -3 } : undefined}
              animate={{ opacity: 1, y: isSelected ? -6 : 0 }} // snaps back on cancel
            >
              {/* top row: icon (left), cost (right) */}
              <div className="flex items-center justify-between">
                <div className={`inline-flex items-center justify-center rounded-lg p-1.5 ${c.iconBgClass}`}>
                  <span className={c.iconTextClass}>{c.icon}</span>
                </div>
                {showBudget && (
                  <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-black/35 ring-1 ring-white/25">
                    <Coins className="w-3.5 h-3.5 text-amber-300" />
                    <span
                      className={[
                        "text-[11px] font-semibold",
                        !c.affordable && c.cost < 0 ? "text-rose-100" : c.cost >= 0 ? "text-emerald-100" : "text-white",
                      ].join(" ")}
                    >
                      {c.cost >= 0 ? `+${c.cost}` : `${c.cost}`}
                    </span>
                  </div>
                )}
              </div>

              {/* body: title + summary (full width) */}
              <div className="mt-2">
                <div className={CARD_TITLE_CLASS}>{c.title}</div>
                <div className={`${CARD_DESC_CLASS} mt-0.5 line-clamp-3`}>{c.summary}</div>
              </div>

              {/* selected check */}
              {isSelected && (
                <div className="absolute left-2 top-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" strokeWidth={2.5} />
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Expanded overlay */}
      <AnimatePresence>
        {selectedCard && (
          <motion.div
            key="overlay"
            className="absolute inset-0 z-20 flex items-end justify-center pb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={OVERLAY_BACKDROP} onClick={() => setSelected(null)} />

            <motion.div
              key={`expanded-${selectedCard.id}`}
              className={[
                CARD_BASE,
                selectedCard.cardGradientClass, // same dark gradient
                "w-[96%] md:w-[88%] lg:w-[80%] px-4 py-3 relative",
              ].join(" ")}
              initial={{ y: 30, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, scale: 0.98 }}
              transition={{ type: "tween", duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* top row in expanded view */}
              <div className="flex items-center justify-between">
                <div className={`inline-flex items-center justify-center rounded-lg p-1.5 ${selectedCard.iconBgClass}`}>
                  <span className={selectedCard.iconTextClass}>{selectedCard.icon}</span>
                </div>

                {showBudget && (
                  <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-black/35 ring-1 ring-white/25">
                    <Coins className="w-3.5 h-3.5 text-amber-300" />
                    <span
                      className={[
                        "text-[12px] font-semibold",
                        !selectedCard.affordable && selectedCard.cost < 0
                          ? "text-rose-100"
                          : selectedCard.cost >= 0
                          ? "text-emerald-100"
                          : "text-white",
                      ].join(" ")}
                    >
                      {selectedCard.cost >= 0 ? `+${selectedCard.cost}` : `${selectedCard.cost}`}
                    </span>
                  </div>
                )}
              </div>

              {/* full text */}
              <div className="mt-2">
                <div className="text-[15px] font-semibold text-white">{selectedCard.title}</div>
                <div className="text-[13.5px] leading-snug text-white/95 mt-1">
                  {selectedCard.summary}
                </div>
              </div>

              {/* actions */}
              <div className="mt-3 flex items-center justify-center gap-3">
                <button
                  type="button"
                  className={CONFIRM_BTN_CLASS}
                  disabled={showBudget && !selectedCard.affordable}
                  onClick={() => {
                    onConfirm(selectedCard.id);
                    setSelected(null);
                  }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-full bg-white/10 ring-1 ring-white/15 text-white text-[12px]"
                  onClick={() => setSelected(null)}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggest modal */}
      <AnimatePresence>
        {isSuggestOpen && (
          <motion.div
            key="suggest"
            className="absolute inset-0 z-30 flex items-center justify-center p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={OVERLAY_BACKDROP} onClick={() => setSuggestOpen(false)} />
            <motion.div
              className={`${CARD_BASE} bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 w-[96%] max-w-md px-4 py-4 relative`}
              initial={{ y: 30, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, scale: 0.98 }}
              transition={{ type: "tween", duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold text-white">Suggest your own</div>
                {showBudget && (
                  <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-black/35 ring-1 ring-white/25">
                    <span className="text-[12px] font-semibold text-rose-100">{suggestCost}</span>
                    <Coins className="w-3.5 h-3.5 text-amber-300" />
                  </div>
                )}
              </div>

              <div className="mt-3">
                <input
                  type="text"
                  autoFocus
                  value={suggestText}
                  onChange={(e) => setSuggestText(e.target.value)}
                  placeholder={SUGGEST_PLACEHOLDER}
                  className="w-full rounded-xl bg-black/35 ring-1 ring-white/25 text-white placeholder-white/70 px-3 py-2 outline-none focus:ring-white/35"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmSuggest();
                    }
                  }}
                />
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-full bg-white/10 ring-1 ring-white/15 text-white text-[12px]"
                  onClick={() => setSuggestOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={CONFIRM_BTN_CLASS}
                  disabled={showBudget && budget < Math.abs(suggestCost)}
                  onClick={confirmSuggest}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggest-your-own pill (opens modal) */}
      <div className="mt-3">
        <button
          type="button"
          className={SUGGEST_BTN_CLASS}
          onClick={openSuggest}
          disabled={showBudget && budget < Math.abs(suggestCost)}
        >
          <span className="text-[12.5px] font-semibold">Suggest your own</span>
          {showBudget && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-black/35 ring-1 ring-white/25">
              <span className={`text-[11px] font-semibold ${suggestCost < 0 ? "text-rose-100" : "text-emerald-100"}`}>
                {suggestCost >= 0 ? `+${suggestCost}` : `${suggestCost}`}
              </span>
              <Coins className="w-3.5 h-3.5 text-amber-300" />
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

/* ----------------------- DEMO HELPERS ----------------------- */
// Use *dark* gradients (950/900 tones) so cards feel deeper.
export function demoActions(): ActionCard[] {
  return [
    {
      id: "curfew",
      title: "Impose Curfew",
      summary: "Lock down after dusk and deploy patrols to restore order.",
      icon: <ShieldAlert className="w-4 h-4" strokeWidth={2.4} />,
      iconBgClass: "bg-rose-400/20",
      iconTextClass: "text-rose-100",
      cardGradientClass: "bg-gradient-to-br from-rose-950 via-rose-900 to-rose-950",
      cost: -150,
    },
    {
      id: "address",
      title: "Address the Nation",
      summary: "Speak live tonight to calm fears and shape the narrative.",
      icon: <Megaphone className="w-4 h-4" strokeWidth={2.4} />,
      iconBgClass: "bg-sky-400/20",
      iconTextClass: "text-sky-100",
      cardGradientClass: "bg-gradient-to-br from-sky-950 via-sky-900 to-sky-950",
      cost: -50,
    },
    {
      id: "talks",
      title: "Open Negotiations",
      summary: "Invite opposition leaders for mediated talks and de-escalation.",
      icon: <Handshake className="w-4 h-4" strokeWidth={2.4} />,
      iconBgClass: "bg-emerald-400/20",
      iconTextClass: "text-emerald-100",
      cardGradientClass: "bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950",
      cost: +50,
    },
  ];
}
