// src/components/event/ActionDeck.tsx
// Old visuals preserved (dark gradient cards, coin badge, suggest pill/modal)
// + New confirm animation: collapse → others slide down → chosen card floats centered.

import React, { useMemo, useState, useRef, useLayoutEffect } from "react";
import { validateSuggestionStrict, AIConnectionError } from "../../lib/validation";
import { useSettingsStore } from "../../store/settingsStore";
import { useDilemmaStore } from "../../store/dilemmaStore";



import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useAnimationControls,
  type Transition,
  type TargetAndTransition,
} from "framer-motion";
import { Coins, CheckCircle2 } from "lucide-react";
// Utility: await N requestAnimationFrame ticks to let shared-layout collapse commit
async function waitNextFrame(times = 2) {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}
// gated debug logger (uses Settings → Debug mode)
function dlog(...args: any[]) {
  if (useSettingsStore.getState().debugMode) {
    // eslint-disable-next-line no-console
    console.log("[ActionDeck]", ...args);
  }
}
// Build a safe dilemma context for validation (props → store → empty)
function getDilemmaCtx(
  d?: { title: string; description: string }
): { title: string; description: string } {
  if (d && typeof d.title === "string" && typeof d.description === "string") {
    return d;
  }
  const curr: any = useDilemmaStore.getState().current;
  const title = typeof curr?.title === "string" ? curr.title : "";
  const description = typeof curr?.description === "string" ? curr.description : "";
  return { title, description };
}




/* ================== TUNABLES (VISUALS) ================== */
const ENTER_STAGGER = 0.12;
const ENTER_DURATION = 0.36;
const ENTER_Y = 24;

const CARD_TITLE_CLASS = "text-[14px] font-semibold text-white";
const CARD_DESC_CLASS  = "text-[12.5px] leading-snug text-white/95";
const CARD_PAD = "p-3";

const CARD_BASE = "rounded-2xl ring-1 ring-white/20 shadow-sm";

const CONFIRM_BTN_CLASS =
  "px-3 py-1.5 rounded-full bg-emerald-500 text-white text-[12px] font-semibold shadow hover:bg-emerald-600 active:scale-[0.99]";
const SUGGEST_BTN_CLASS =
  "w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-full bg-white/8 ring-1 ring-white/10 text-white shadow-sm";

const OVERLAY_BACKDROP = "absolute inset-0 bg-black/70";

const SUGGEST_PLACEHOLDER = "Type your suggestion…";
const SUGGEST_PREFILL     = "";
/* ========================================================= */

/* ================== TYPED MOTION PRESETS ================= */
const springJuice: Transition = { type: "spring", stiffness: 520, damping: 46, mass: 0.7 };
const springDown: Transition = { type: "spring", stiffness: 380, damping: 32 };
const fade: Transition = { duration: 0.18 };

const othersDownTarget: TargetAndTransition = { y: 320, opacity: 0, transition: springDown };
const suggestDownTarget: TargetAndTransition = { y: 360, opacity: 0, transition: springDown };
/* ========================================================= */

export type ActionCard = {
  id: string;                        // "a" | "b" | "c" is fine too
  title: string;
  summary: string;
  icon: React.ReactNode;             // already-rendered Lucide element
  iconBgClass: string;               // e.g., "bg-sky-400/20"
  iconTextClass: string;             // e.g., "text-sky-200"
  cardGradientClass: string;         // e.g., "bg-gradient-to-br from-sky-950 via-sky-900 to-sky-950"
  cost?: number;                     // negative = spend, positive = gain
};

type Props = {
  actions: ActionCard[];             // exactly 3
  showBudget: boolean;
  budget: number;
  onConfirm: (id: string) => void;
  onSuggest?: (text?: string) => void;
  suggestCost?: number;              // default -300
  dilemma: { title: string; description: string };
};

/* ------------------------- Small helpers ------------------------- */
function CostPill({ cost, affordable }: { cost: number; affordable: boolean }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-black/35 ring-1 ring-white/25">
      <Coins className="w-3.5 h-3.5 text-amber-300" />
      <span
        className={[
          "text-[11px] font-semibold",
          !affordable && cost < 0 ? "text-rose-100" : cost >= 0 ? "text-emerald-100" : "text-white",
        ].join(" ")}
      >
        {cost >= 0 ? `+${cost}` : `${cost}`}
      </span>
    </div>
  );
}

/* --------------------------- Component --------------------------- */
export default function ActionDeck({
  actions,
  showBudget,
  budget,
  onConfirm,
  onSuggest,
  suggestCost = -300,
  dilemma,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  // Suggest modal
  const [isSuggestOpen, setSuggestOpen] = useState(false);
  const [suggestText, setSuggestText] = useState<string>(SUGGEST_PREFILL);
  const [validatingSuggest, setValidatingSuggest] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  // New confirm flow state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [othersDown, setOthersDown] = useState(false);
  

  const othersCtrl = useAnimationControls();
  const suggestCtrl = useAnimationControls();

  // Derive affordability + normalized costs
  const cards = useMemo(() => {
    return actions.map((a) => {
      const cost = a.cost ?? 0;
      const affordable = !showBudget || cost >= 0 || budget >= Math.abs(cost);
      return { ...a, cost, affordable };
    });
  }, [actions, showBudget, budget]);

  const selectedCard = cards.find((c) => c.id === selected) || null;
// --- Height lock so downward fly-out doesn't extend the page ---
const deckRef = useRef<HTMLDivElement | null>(null);
const [deckHeight, setDeckHeight] = useState<number | null>(null);
const [lockHeight, setLockHeight] = useState(false);

// Measure once per dilemma (and after first layout)
useLayoutEffect(() => {
  // measure after layout
  const m = () => {
    if (deckRef.current) {
      setDeckHeight(deckRef.current.getBoundingClientRect().height);
    }
  };
  m();
  // also schedule one more read on next frame for safety
  requestAnimationFrame(m);
  // releasing any previous locks on new dilemma
  setLockHeight(false);
}, [actions]);
  function openSuggest() {
    if (showBudget && budget < Math.abs(suggestCost)) {
      dlog("openSuggest: blocked (budget)", { budget, suggestCost });
      return;
    }
    dlog("openSuggest: opened");
    setSuggestText(SUGGEST_PREFILL);
    setSuggestError(null);
    setSuggestOpen(true);
  }
  

  async function confirmSuggest() {
    const text = (suggestText || "").trim();
    dlog("confirmSuggest: click", { textLength: text.length });
  
    if (!text) {
      dlog("confirmSuggest: early return (empty text)");
      return;
    }
    if (showBudget && budget < Math.abs(suggestCost)) {
      dlog("confirmSuggest: early return (budget lock)", { budget, suggestCost });
      return;
    }
  
    try {
      setSuggestError(null);
      setValidatingSuggest(true);
      const ctx = getDilemmaCtx(dilemma);
      dlog("validateSuggestionStrict -> request", {
        hasProp: Boolean(dilemma),
        titleLen: ctx.title.length,
        descriptionLen: ctx.description.length,
      });
      
      const result = await validateSuggestionStrict(text, ctx);
      
      dlog("validateSuggestionStrict -> response", result);
  
      if (!result.valid) {
        dlog("validateSuggestionStrict -> invalid", result.reason || "(no reason)");
        setSuggestError(result.reason || "Please refine your suggestion so it clearly relates to the dilemma.");
        setValidatingSuggest(false);
        return;
      }
  
      // Valid path
      dlog("confirmSuggest: valid → close modal & animate cards");
      setSuggestOpen(false);
  
      // Disable interactions, animate ALL THREE pre-available cards down
      setConfirmingId("suggest");
      // Freeze current deck height and clip overflow during exit
if (!deckHeight && deckRef.current) {
  setDeckHeight(deckRef.current.getBoundingClientRect().height);
}
setLockHeight(true);

      setOthersDown(true);
      await waitNextFrame(2);
  
      void othersCtrl.start({
        y: 320,
        opacity: 0,
        transition: {
          type: "spring",
          stiffness: 260,
          damping: 28,
          mass: 0.7,
          duration: 0.36,
        },
      });
      dlog("othersCtrl.start → queued");
  
      onSuggest?.(text);
      dlog("onSuggest callback invoked");
  
      setValidatingSuggest(false);
    } catch (err: any) {
      const msg = err instanceof AIConnectionError ? err.message : "Cannot reach validator";
      dlog("confirmSuggest: error", msg, err);
      setSuggestError(msg);
      setValidatingSuggest(false);
    }
  }
  


// Called when user clicks "Confirm" on the expanded card
const handleConfirm = async (id: string) => {
  // 1) Mark which card is confirming; this disables all interactions
  setConfirmingId(id);

  // 2) Close the expanded view so the chosen card shrinks back to its grid slot
  setSelected(null);
// Freeze current deck height and clip overflow during exit
if (!deckHeight && deckRef.current) {
  setDeckHeight(deckRef.current.getBoundingClientRect().height);
}
setLockHeight(true);

  // 3) Ensure all target elements SUBSCRIBE to the animation controls
  //    (cards/suggest wire their `animate={...}` only when othersDown === true)
  setOthersDown(true);

  // 4) Wait two frames so the shared-layout collapse fully commits and
  //    the new animate props (controls) are attached to the DOM
  await waitNextFrame(2);

  // 5) Animate the two non-chosen cards downward + fade
  void othersCtrl.start({
    y: 320,
    opacity: 0,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 28,
      mass: 0.7,
      duration: 0.36,
    },
  });

  // 6) Animate the "Suggest your own" pill downward + fade
  void suggestCtrl.start({
    y: 360,
    opacity: 0,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 28,
      mass: 0.7,
      duration: 0.36,
      delay: 0.02,
    },
  });

  // 7) Notify parent (budget update, etc.) — we don't await animations
  onConfirm(id);
};



  // Reset visuals when the actions (dilemma) change
  React.useEffect(() => {
    setSelected(null);
    setConfirmingId(null);
    setOthersDown(false);
  }, [actions]);

  return (
    <LayoutGroup id="action-deck">
      <div
  className="mt-4 relative"
  ref={deckRef}
  style={
    lockHeight && deckHeight != null
      ? { height: deckHeight, overflow: "hidden" }
      : undefined
  }
>

        {/* Cards row (3 columns, as before) */}
        <motion.div
          className="grid grid-cols-3 gap-3"
          initial={false}
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: ENTER_STAGGER } } }}
        >
          {cards.map((c) => {
            const isSelected = selected === c.id;
            const disabled = !c.affordable || Boolean(confirmingId && confirmingId !== c.id);

            return (
              <motion.div
                key={c.id}
                layout
                layoutId={`card-${c.id}`} // shared layout for float-to-center
                animate={othersDown && c.id !== confirmingId ? othersCtrl : undefined}
                transition={springJuice}
                className={[
                  CARD_BASE,
                  CARD_PAD,
                  c.cardGradientClass, // DARK opaque gradient
                  "text-left relative transition-transform",
                  disabled ? "opacity-50 saturate-75 cursor-not-allowed" : "cursor-pointer hover:brightness-[1.03]",
                  isSelected ? "ring-2 ring-white/30" : "",
                ].join(" ")}
                variants={{
                  hidden: { opacity: 0, y: ENTER_Y, scale: 0.97, rotate: -1.2 },
                  show:   { opacity: 1, y: 0,       scale: 1.0,  rotate: 0, transition: { type: "tween", duration: ENTER_DURATION, ease: [0.16, 1, 0.3, 1] } },
                }}
                onClick={() => !disabled && setSelected(c.id)}
                onKeyDown={(e) => {
                  if (!disabled && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setSelected(c.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {/* top row: icon (left), cost (right) */}
                <div className="flex items-center justify-between">
                  <div className={`inline-flex items-center justify-center rounded-lg p-1.5 ${c.iconBgClass}`}>
                    <span className={c.iconTextClass}>{c.icon}</span>
                  </div>
                  {showBudget && <CostPill cost={c.cost!} affordable={c.affordable} />}
                </div>

                {/* body: title + summary (clamped) */}
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

        {/* Expanded overlay (same visuals as before) */}
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
                    <span className={selectedCard.iconTextClass}>{selectedCard.icon}</span>
                  </div>
                  {showBudget && <CostPill cost={selectedCard.cost!} affordable={selectedCard.affordable} />}
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
                    onClick={() => handleConfirm(selectedCard.id)}
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

        {/* Suggest modal (unchanged visuals) */}
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
                    onClick={() => setSuggestOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
  type="button"
  className={CONFIRM_BTN_CLASS}
  disabled={
    validatingSuggest ||
    (showBudget && budget < Math.abs(suggestCost)) ||
    (suggestText.trim().length < 4)
  }
  onClick={confirmSuggest}
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
            animate={othersDown ? suggestCtrl : undefined}
            className={SUGGEST_BTN_CLASS}
            onClick={openSuggest}
              disabled={
    Boolean(confirmingId) ||
    validatingSuggest ||
    (showBudget && budget < Math.abs(suggestCost))
  }


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
