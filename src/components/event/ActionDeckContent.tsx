/**
 * ActionDeckContent.tsx
 *
 * Main UI rendering component for the ActionDeck. Handles card display,
 * expanded view overlay, suggestion modal, and all interactive elements.
 *
 * Used by: ActionDeck.tsx
 * Uses: framer-motion for animations, lucide-react for icons
 */

import React from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Coins, CheckCircle2 } from "lucide-react";
import type { ActionCard } from "../../hooks/useActionDeckState";

// Visual constants
const ENTER_STAGGER = 0.12;
const ENTER_DURATION = 0.36;
const ENTER_Y = 24;

const CARD_TITLE_CLASS = "text-[14px] font-semibold text-white";
const CARD_DESC_CLASS = "text-[12.5px] leading-snug text-white/95";
const CARD_PAD = "p-3";
const CARD_BASE = "rounded-2xl ring-1 ring-white/20 shadow-sm";

const CONFIRM_BTN_CLASS =
  "px-3 py-1.5 rounded-full bg-emerald-500 text-white text-[12px] font-semibold shadow hover:bg-emerald-600 active:scale-[0.99]";
const SUGGEST_BTN_CLASS =
  "w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-full bg-white/8 ring-1 ring-white/10 text-white shadow-sm";

const OVERLAY_BACKDROP = "absolute inset-0 bg-black/70";

const springJuice = { type: "spring" as const, stiffness: 520, damping: 46, mass: 0.7 };

interface EnhancedActionCard extends ActionCard {
  affordable: boolean;
}

interface ActionDeckContentProps {
  // Data
  cards: EnhancedActionCard[];
  selectedCard: EnhancedActionCard | null;
  showBudget: boolean;
  budget: number;
  suggestCost: number;

  // Modal state
  isSuggestOpen: boolean;
  suggestText: string;
  validatingSuggest: boolean;
  suggestError: string | null;

  // Flow state
  confirmingId: string | null;
  othersDown: boolean;

  // Layout
  deckRef: React.RefObject<HTMLDivElement | null>;
  deckHeight: number | null;
  lockHeight: boolean;
  attachCardRef: (id: string) => (el: HTMLElement | null) => void;
  suggestRef: React.RefObject<HTMLButtonElement | null>;

  // Animation controls
  othersCtrl: any;
  suggestCtrl: any;

  // Handlers
  onSelectCard: (id: string) => void;
  onConfirmCard: (id: string) => void;
  onCancelSelection: () => void;
  onOpenSuggest: () => void;
  onCloseSuggest: () => void;
  onSuggestTextChange: (text: string) => void;
  onConfirmSuggestion: () => void;
}

export default function ActionDeckContent({
  cards,
  selectedCard,
  showBudget,
  budget,
  suggestCost,
  isSuggestOpen,
  suggestText,
  validatingSuggest,
  suggestError,
  confirmingId,
  othersDown,
  deckRef,
  deckHeight,
  lockHeight,
  attachCardRef,
  suggestRef,
  othersCtrl,
  suggestCtrl,
  onSelectCard,
  onConfirmCard,
  onCancelSelection,
  onOpenSuggest,
  onCloseSuggest,
  onSuggestTextChange,
  onConfirmSuggestion,
}: ActionDeckContentProps) {

  const canAffordSuggestion = !showBudget || budget >= Math.abs(suggestCost);
  const suggestTextValid = suggestText.trim().length >= 4;

  return (
    <LayoutGroup id="action-deck">
      <div
        className="mt-4 relative"
        ref={deckRef}
        style={lockHeight && deckHeight != null ? { height: deckHeight, overflow: "hidden" } : undefined}
      >
        {/* Cards row (3 columns) */}
        <motion.div
          className="grid grid-cols-3 gap-3"
          initial={false}
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: ENTER_STAGGER } } }}
        >
          {cards.map((c) => {
            const isSelected = selectedCard?.id === c.id;
            const disabled = Boolean(confirmingId) || !c.affordable;

            return (
              <motion.div
                key={c.id}
                layout
                layoutId={`card-${c.id}`}
                ref={attachCardRef(c.id)}
                animate={othersDown && c.id !== confirmingId ? othersCtrl : undefined}
                transition={springJuice}
                className={[
                  CARD_BASE,
                  CARD_PAD,
                  c.cardGradientClass,
                  "text-left relative transition-transform",
                  disabled ? "opacity-50 saturate-75 cursor-not-allowed" : "cursor-pointer hover:brightness-[1.03]",
                  isSelected ? "ring-2 ring-white/30" : "",
                ].join(" ")}
                variants={{
                  hidden: { opacity: 0, y: ENTER_Y, scale: 0.97, rotate: -1.2 },
                  show: {
                    opacity: 1,
                    y: 0,
                    scale: 1.0,
                    rotate: 0,
                    transition: {
                      type: "tween",
                      duration: ENTER_DURATION,
                      ease: [0.16, 1, 0.3, 1]
                    }
                  },
                }}
                onClick={() => !disabled && onSelectCard(c.id)}
                onKeyDown={(e) => {
                  if (!disabled && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onSelectCard(c.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {/* Top row: icon (left), cost (right) */}
                <div className="flex items-center justify-between">
                  <div className={`inline-flex items-center justify-center rounded-lg p-1.5 ${c.iconBgClass}`}>
                    <div className={c.iconTextClass}>{c.icon}</div>
                  </div>
                  {showBudget && (
                    <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-black/35 ring-1 ring-white/25">
                      <Coins className="w-3.5 h-3.5 text-amber-300" />
                      <span
                        className={[
                          "text-[11px] font-semibold",
                          !c.affordable && (c.cost ?? 0) < 0 ? "text-rose-100" : (c.cost ?? 0) >= 0 ? "text-emerald-100" : "text-white",
                        ].join(" ")}
                      >
                        {(c.cost ?? 0) >= 0 ? `+${c.cost}` : `${c.cost}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Body: title + summary (clamped) */}
                <div className="mt-2">
                  <div className={CARD_TITLE_CLASS}>{c.title}</div>
                  <div className={`${CARD_DESC_CLASS} mt-0.5 line-clamp-3`}>{c.summary}</div>
                </div>

                {/* Selected check */}
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
              <div className={OVERLAY_BACKDROP} onClick={onCancelSelection} />

              <motion.div
                key={`expanded-${selectedCard.id}`}
                className={[
                  CARD_BASE,
                  selectedCard.cardGradientClass,
                  "w-[96%] md:w-[88%] lg:w-[80%] px-4 py-3 relative",
                ].join(" ")}
                initial={{ y: 30, scale: 0.98 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 16, scale: 0.98 }}
                transition={{ type: "tween", duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-center justify-between">
                  <div className={`inline-flex items-center justify-center rounded-lg p-1.5 ${selectedCard.iconBgClass}`}>
                    <div className={selectedCard.iconTextClass}>{selectedCard.icon}</div>
                  </div>
                  {showBudget && (
                    <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-black/35 ring-1 ring-white/25">
                      <Coins className="w-3.5 h-3.5 text-amber-300" />
                      <span
                        className={[
                          "text-[11px] font-semibold",
                          !selectedCard.affordable && (selectedCard.cost ?? 0) < 0 ? "text-rose-100" : (selectedCard.cost ?? 0) >= 0 ? "text-emerald-100" : "text-white",
                        ].join(" ")}
                      >
                        {(selectedCard.cost ?? 0) >= 0 ? `+${selectedCard.cost}` : `${selectedCard.cost}`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-2">
                  <div className="text-[15px] font-semibold text-white">{selectedCard.title}</div>
                  <div className="text-[13.5px] leading-snug text-white/95 mt-1">{selectedCard.summary}</div>
                </div>

                <div className="mt-3 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    className={CONFIRM_BTN_CLASS}
                    disabled={showBudget && !selectedCard.affordable}
                    onClick={() => onConfirmCard(selectedCard.id)}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-full bg-white/10 ring-1 ring-white/15 text-white text-[12px]"
                    onClick={onCancelSelection}
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Suggestion modal */}
        <AnimatePresence>
          {isSuggestOpen && (
            <motion.div
              key="suggest"
              className="absolute inset-0 z-30 flex items-center justify-center p-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className={OVERLAY_BACKDROP} onClick={onCloseSuggest} />
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
                    onChange={(e) => onSuggestTextChange(e.target.value)}
                    placeholder="Type your suggestion…"
                    className="w-full rounded-xl bg-black/35 ring-1 ring-white/25 text-white placeholder-white/70 px-3 py-2 outline-none focus:ring-white/35"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onConfirmSuggestion();
                      }
                    }}
                  />
                  {suggestError && (
                    <div className="mt-2 text-[12px] text-rose-200">
                      {suggestError}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-full bg-white/10 ring-1 ring-white/15 text-white text-[12px]"
                    onClick={onCloseSuggest}
                    disabled={validatingSuggest}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={CONFIRM_BTN_CLASS}
                    disabled={validatingSuggest || !canAffordSuggestion || !suggestTextValid}
                    onClick={onConfirmSuggestion}
                  >
                    {validatingSuggest ? "Validating..." : "Confirm"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Suggest-your-own pill */}
        <motion.div className="mt-3" layout>
          <motion.button
            type="button"
            layout
            ref={suggestRef}
            animate={othersDown ? suggestCtrl : undefined}
            className={SUGGEST_BTN_CLASS}
            onClick={onOpenSuggest}
            disabled={Boolean(confirmingId) || validatingSuggest || !canAffordSuggestion}
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
          </motion.button>
        </motion.div>
      </div>
    </LayoutGroup>
  );
}