// src/components/event/ActionDeck.tsx
// ActionDeck with: confirm flow (collapse → others fly down), "Suggest your own" validation,
// height-lock to prevent scroll gap, and coin flight overlay synced with budget counter.

import React, { useMemo, useRef, useState, useLayoutEffect } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useAnimationControls,
  type Transition,
} from "framer-motion";
import { Coins, CheckCircle2 } from "lucide-react";
import { createPortal } from "react-dom";

import { validateSuggestionStrict, AIConnectionError } from "../../lib/validation";
import { useSettingsStore } from "../../store/settingsStore";
import { useDilemmaStore } from "../../store/dilemmaStore";

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

/* ================== MOTION PRESETS ================== */
const springJuice: Transition = { type: "spring", stiffness: 520, damping: 46, mass: 0.7 };
const springDown: Transition = { type: "spring", stiffness: 380, damping: 32 };
const fade: Transition = { duration: 0.18 };

/* ================== Utils ================== */
async function waitNextFrame(times = 2) {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

// gated debug logger (Settings → Debug mode)
function dlog(...args: any[]) {
  if (useSettingsStore.getState().debugMode) {
    // eslint-disable-next-line no-console
    console.log("[ActionDeck]", ...args);
  }
}

// Build a safe dilemma context for validation (props → store → empty)
function getDilemmaCtx(d?: { title: string; description: string }): { title: string; description: string } {
  if (d && typeof d.title === "string" && typeof d.description === "string") {
    return d;
  }
  const curr: any = useDilemmaStore.getState().current;
  const title = typeof curr?.title === "string" ? curr.title : "";
  const description = typeof curr?.description === "string" ? curr.description : "";
  return { title, description };
}

/* ================== Types ================== */
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

/* ================== CoinFlight overlay ================== */
type Point = { x: number; y: number };
type CoinFlight = { id: number; start: Point; end: Point; count?: number; duration?: number };

function CoinFlightOverlay({ flights, onAllDone }: { flights: CoinFlight[]; onAllDone: () => void }) {
  // Compute total max duration for auto-dispose
  const maxDuration = Math.max(
    0,
    ...flights.map((f) => (f.duration ?? 0.9) + 0.2) // +max stagger
  );
  React.useEffect(() => {
    const t = setTimeout(onAllDone, (maxDuration + 0.1) * 1000);
    return () => clearTimeout(t);
  }, [flights, onAllDone, maxDuration]);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {flights.map((f) => {
        const count = f.count ?? 9;
        const baseDur = f.duration ?? 0.9;
        return Array.from({ length: count }).map((_, i) => {
          const id = `${f.id}-${i}`;
          const dx = f.end.x - f.start.x;
          const dy = f.end.y - f.start.y;
          // Midpoint arc offset
          const midX = f.start.x + dx * 0.5 + (Math.random() * 40 - 20);
          const midY = f.start.y + dy * 0.5 - (Math.random() * 60 + 20);
          const delay = Math.random() * 0.2;
          const dur = baseDur + Math.random() * 0.2;

          return (
            <motion.div
              key={id}
              className="fixed"
              initial={{ x: f.start.x, y: f.start.y, rotate: 0, scale: 0.9, opacity: 0.9 }}
              animate={{
                x: [f.start.x, midX, f.end.x],
                y: [f.start.y, midY, f.end.y],
                rotate: [0, Math.random() * 90 - 45, Math.random() * 30],
                scale: [0.9, 1, 0.9],
                opacity: [0.9, 1, 0.0],
              }}
              transition={{ duration: dur, ease: "easeOut", times: [0, 0.5, 1], delay }}
            >
              <Coins className="w-4 h-4 text-amber-300 drop-shadow-[0_0_6px_rgba(255,200,0,0.35)]" />
            </motion.div>
          );
        });
      })}
    </div>,
    document.body
  );
}

/* ================== Component ================== */
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

  // Confirm flow state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [othersDown, setOthersDown] = useState(false);

  const othersCtrl = useAnimationControls();
  const suggestCtrl = useAnimationControls();

  // Height lock to avoid white scroll gap
  const deckRef = useRef<HTMLDivElement | null>(null);
  const [deckHeight, setDeckHeight] = useState<number | null>(null);
  const [lockHeight, setLockHeight] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      if (deckRef.current) {
        setDeckHeight(deckRef.current.getBoundingClientRect().height);
      }
    };
    measure();
    requestAnimationFrame(measure);
    setLockHeight(false);
  }, [actions]);

  // DOM refs for measuring
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const attachCardRef = (id: string) => (el: HTMLElement | null) => {
    cardRefs.current[id] = el;
  };
  const suggestRef = useRef<HTMLButtonElement | null>(null);

  // Coin flights
  const [flights, setFlights] = useState<CoinFlight[]>([]);
  const flightSeq = useRef(1);

  function getCenterRect(el: Element | null): { x: number; y: number } | null {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

  function getBudgetAnchorRect(): { x: number; y: number } | null {
    const anchor = document.querySelector('[data-budget-anchor="true"]') as HTMLElement | null;
    return getCenterRect(anchor);
  }

  function triggerCoinFlight(from: { x: number; y: number } | null, to: { x: number; y: number } | null) {
    if (!from || !to) {
      dlog("coinFlight: skipped (missing points)", { from, to });
      return;
    }
    const id = flightSeq.current++;
    setFlights((prev) => [...prev, { id, start: from, end: to }]);
  }
  // Launch coins + budget update together at the first moment both endpoints are measurable.
// If points aren't ready this frame, retry once on the next frame; otherwise proceed without coins.
function syncCoinAndBudget(
  getFrom: () => { x: number; y: number } | null,
  getTo: () => { x: number; y: number } | null,
  launchBudgetUpdate: () => void
) {
  const attempt = (retries: number) => {
    const from = getFrom();
    const to = getTo();
    if (from && to) {
      triggerCoinFlight(from, to);
      launchBudgetUpdate();
    } else if (retries > 0) {
      requestAnimationFrame(() => attempt(retries - 1));
    } else {
      dlog("coinFlight: skipped (missing points)", { from, to });
      launchBudgetUpdate();
    }
  };
  attempt(1); // try now, then once more next frame if needed
}


  // Derive affordability + normalized costs
  const cards = useMemo(() => {
    return actions.map((a) => {
      const cost = a.cost ?? 0;
      const affordable = !showBudget || cost >= 0 || budget >= Math.abs(cost);
      return { ...a, cost, affordable };
    });
  }, [actions, showBudget, budget]);

  const selectedCard = cards.find((c) => c.id === selected) || null;

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

      // Close modal (pill shrinks back)
      setSuggestOpen(false);

      // Ensure we know sizes and lock height before animations
      if (!deckHeight && deckRef.current) {
        setDeckHeight(deckRef.current.getBoundingClientRect().height);
      }
      setLockHeight(true);

      // Disable interactions, animate THREE cards down (suggest stays)
      setConfirmingId("suggest");
      setOthersDown(true);
      await waitNextFrame(2);

      void othersCtrl.start({ y: 320, opacity: 0, transition: springDown });

     // Coins + budget counter should start at the same time for suggestions as well.
if (suggestCost < 0) {
  // from budget → to pill
  syncCoinAndBudget(
    () => getBudgetAnchorRect(),
    () => getCenterRect(suggestRef.current),
    () => onSuggest?.(text)
  );
} else {
  // from pill → to budget
  syncCoinAndBudget(
    () => getCenterRect(suggestRef.current),
    () => getBudgetAnchorRect(),
    () => onSuggest?.(text)
  );
}
dlog("onSuggest scheduled (synced with coins)");


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

    // 3) Ensure all target elements subscribe to animation controls & lock height
    if (!deckHeight && deckRef.current) {
      setDeckHeight(deckRef.current.getBoundingClientRect().height);
    }
    setLockHeight(true);
    setOthersDown(true);

    // 4) Wait two frames so the collapse fully commits
    await waitNextFrame(2);

    // 5) Animate the two non-chosen cards + suggest pill downward + fade
    void othersCtrl.start({ y: 320, opacity: 0, transition: springDown });
    void suggestCtrl.start({ y: 360, opacity: 0, transition: springDown });

  // 6) Coins + budget counter should start at the same time.
// Decide direction by cost: + => card → budget, - => budget → card.
// If an endpoint isn't ready, retry next frame; otherwise proceed without coins.
const card = cards.find((c) => c.id === id);
const targetEl = cardRefs.current[id];

if (!card || !targetEl) {
  dlog("handleConfirm: missing card/element for coin flight", { id, hasCard: !!card, hasEl: !!targetEl });
  onConfirm(id); // proceed without coins
} else {
  const cost = card.cost ?? 0;
  if (cost >= 0) {
    // from card → to budget
    syncCoinAndBudget(
      () => getCenterRect(targetEl),
      () => getBudgetAnchorRect(),
      () => onConfirm(id)
    );
  } else {
    // from budget → to card
    syncCoinAndBudget(
      () => getBudgetAnchorRect(),
      () => getCenterRect(targetEl),
      () => onConfirm(id)
    );
  }
}

  };

  // Reset visuals when the actions (dilemma) change
  React.useEffect(() => {
    setSelected(null);
    setConfirmingId(null);
    setOthersDown(false);
    setFlights([]);
  }, [actions]);

  return (
    <LayoutGroup id="action-deck">
      {/* Coin overlay */}
      <AnimatePresence>
        {flights.length > 0 && (
          <CoinFlightOverlay
            flights={flights}
            onAllDone={() => setFlights([])}
          />
        )}
      </AnimatePresence>

      <div
        className="mt-4 relative"
        ref={deckRef}
        style={lockHeight && deckHeight != null ? { height: deckHeight, overflow: "hidden" } : undefined}
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
            const disabled = Boolean(confirmingId) || !c.affordable;


            return (
              <motion.div
                key={c.id}
                layout
                layoutId={`card-${c.id}`} // layout for smooth expand/collapse (no float)
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
                    placeholder="Type your suggestion…"
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
                    disabled={validatingSuggest}
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
            ref={suggestRef}
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
