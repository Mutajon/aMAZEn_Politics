// src/screens/MirrorQuizScreen.tsx
import { useEffect, useMemo, useState } from "react";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { motion, AnimatePresence } from "framer-motion";
import { useCompassStore, VALUE_RULES } from "../store/compassStore";
import { resolveLabel } from "../data/compass-data";
import { pickQuiz } from "../data/mirror-quiz-pool";
import { useRoleStore } from "../store/roleStore";
import { useSettingsStore } from "../store/settingsStore";
import { useCompassFX } from "../hooks/useCompassFX";
import { generateMirrorQuizSummary } from "../lib/mirrorSummary";
import { useMirrorQuizStore } from "../store/mirrorQuizStore";
import MirrorBubble from "../components/MirrorBubble";
import { mirrorBubbleTheme as T } from "../theme/mirrorBubbleTheme";
import { saveMirrorReturnRoute } from "../lib/eventScreenSnapshot";
import MirrorBubbleTyping from "../components/MirrorBubbleTyping";
import { COMPONENTS, PALETTE } from "../data/compass-data";


/** placeholder avatar for images OFF */
const DEFAULT_AVATAR_DATA_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512' viewBox='0 0 128 128'>
      <defs>
        <linearGradient id='g' x1='0' x2='0' y1='0' y2='1'>
          <stop offset='0' stop-color='#EAB308'/>
          <stop offset='1' stop-color='#FDE68A'/>
        </linearGradient>
      </defs>
      <rect x='0' y='0' width='128' height='128' rx='24' fill='url(#g)'/>
      <circle cx='64' cy='50' r='22' fill='rgba(0,0,0,0.25)'/>
      <rect x='26' y='78' width='76' height='30' rx='14' fill='rgba(0,0,0,0.25)'/>
    </svg>`
  );

const MIRROR_SRC = "/assets/images/mirror.png";

/** fixed epilogue */
const MIRROR_EPILOGUE =
  "Well, that was unexpectedly insightful. We’ve sketched the first lines of your inner portrait; from here, every choice you make will add color and contour—and I’ll be here to show you what the mirror sees. Rest now. Tomorrow your new role begins.";

export default function MirrorQuizScreen({ push }: { push: PushFn }) {
  // compass values + reset
  const values = useCompassStore((s) => s.values);
  const resetCompass = useCompassStore((s) => s.reset);

  // FX (petal growth + pills)
  const { pings, applyWithPings } = useCompassFX();

  // avatar selection (uses flipped avatar if your hook already saved it)
  const character = useRoleStore((s) => s.character);
  const generateImages = useSettingsStore((s) => s.generateImages);
  const displayAvatar = useMemo(() => {
    if (character?.avatarUrl) return character.avatarUrl;
    if (!generateImages) return DEFAULT_AVATAR_DATA_URL;
    return "";
  }, [character?.avatarUrl, generateImages]);

  // quiz state (persists across routes)
  const { quiz, idx, done, summary, epilogueShown, init, advance, setDone, setSummary, markEpilogueShown } =
    useMirrorQuizStore();

  // on first mount, start quiz and clear compass
  useEffect(() => {
    if (quiz.length === 0) {
      resetCompass();
      init(pickQuiz(3));
    }
  }, [quiz.length, init, resetCompass]);

  // once done, fetch a one-shot summary (Mirror Quiz Light API - Mushu/Genie personality)
  useEffect(() => {
    (async () => {
      if (done && !summary) {
        const s = await generateMirrorQuizSummary(values, { useAI: true });
        setSummary(s);
      }
    })();
  }, [done, summary, setSummary, values]);

  /** STRICT sequencing flags for verdict → 2s delay → epilogue. */
  const [showEpilogue, setShowEpilogue] = useState(false);
  // NOTE: we intentionally DO NOT use an effect tied to `summary`.
  // The epilogue is enabled *only* by the verdict bubble's onDone (after 2s).

  function answer(opt: { a: string; mappings: string[] }) {
    if (done) return;
    const pairs = opt.mappings
      .map(resolveLabel)
      .filter((x): x is NonNullable<ReturnType<typeof resolveLabel>> => x !== null);
    const effects = pairs.map(({ prop, idx }) => ({ prop, idx, delta: VALUE_RULES.strongPositive }));
    applyWithPings(effects);

    window.setTimeout(() => {
      if (idx + 1 >= quiz.length) setDone();
      else advance();
    }, 580);
  }

  /** Layout */
  const MIRROR_SIZE = 120;
  const CARD = 154;

  // Mirror-bubble-like options
  const optionStyle: React.CSSProperties = {
    background: T.bg,
    color: T.textColor,
    fontFamily: T.fontFamily,
    fontSize: `${T.fontSizePx}px`,
    padding: `${T.paddingY - 2}px ${T.paddingX}px`,
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 16,
    boxShadow: T.shadow,
  };

  return (
    <div className="min-h-[100dvh] px-5 py-5" style={bgStyle}>
      <div className="w-full max-w-xl mx-auto">
        {/* TOP ROW — aligned at top */}
        <div className="flex items-start justify-between gap-4 mt-1">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="relative self-start"
            style={{ width: MIRROR_SIZE, height: MIRROR_SIZE }}
          >
            <img
              src={MIRROR_SRC}
              alt="Mystic mirror"
              width={MIRROR_SIZE}
              height={MIRROR_SIZE}
              className="rounded-full object-cover"
            />

            {/* Compass Pills Overlay - displays pings above mirror image */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 40 }}>
              <AnimatePresence>
                {pings.map((p, i) => {
                  const color = (PALETTE as any)[p.prop]?.base ?? "#fff";
                  const label = COMPONENTS[p.prop][p.idx]?.short ?? "";
                  const topPx = MIRROR_SIZE / 2 - i * 28; // Stack vertically
                  const delay = i * 0.15; // Stagger animation

                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 0, scale: 0.3 }}
                      animate={{ opacity: 1, y: -20, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.98 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                        delay
                      }}
                      className="absolute rounded-full px-2 py-1 text-xs font-semibold shadow-lg"
                      style={{
                        left: "50%",
                        top: topPx,
                        transform: "translate(-50%, -50%)",
                        background: color,
                        color: "#0b1335",
                        border: "1.5px solid rgba(255,255,255,0.9)",
                        boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {`${p.delta > 0 ? "+" : ""}${p.delta} ${label}`}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-[22px] border border-white/10 bg-white/5 backdrop-blur-sm shadow-xl overflow-hidden grid place-items-center self-start"
            style={{ width: CARD, height: CARD }}
          >
            {displayAvatar ? (
              <img src={displayAvatar} alt="Character avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="text-white/80 text-sm">Preparing avatar…</div>
            )}
          </motion.div>
        </div>

        {/* Remaining counter — hidden once done */}
        {!done && (
          <div className="mt-3 text-center text-white/70 text-xs tracking-wide">
            Mirror questions remaining: {Math.max(quiz.length - idx - 1, 0)}
          </div>
        )}

        {/* QUIZ PANEL (only while not done) */}
        {!done && (
          <div className="mt-4 relative">
            <div className="min-h-[210px]">
              <AnimatePresence mode="wait">
                {quiz[idx] && (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="rounded-3xl p-4 border shadow-2xl backdrop-blur-md bg-transparent border-white/20"
                  >
                    {/* QUESTION — styled like mirror bubble text */}
                    <div
                      className="text-[16px] font-semibold italic drop-shadow"
                      style={{ color: T.textColor, fontFamily: T.fontFamily }}
                    >
                      {quiz[idx].q}
                    </div>

                    {/* OPTIONS — mirror bubble style buttons */}
                    <div className="mt-3 grid gap-2">
                      {quiz[idx].options.map((opt, i) => (
                        <motion.button
                          key={i}
                          onClick={() => answer(opt)}
                          whileTap={{ scale: 0.985 }}
                          className="w-full text-left transition focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                          style={optionStyle}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.55)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = T.bg)}
                        >
                          {opt.a}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* DONE: verdict bubble (type), then after 2s epilogue bubble (type), then buttons.
           Returning from CompassVis renders fully (no typing). */}
        {done && (
  <div className="mt-6 mx-auto max-w-xl">
    {/* ⬇️ while AI is working, show animated typing bubble */}
    {!summary && <MirrorBubbleTyping text="Peering into your soul" />}

    {/* verdict bubble (types once) */}
    {summary && (
      <MirrorBubble
        text={summary}
        typing={!epilogueShown}
        onDone={() => {
          if (!epilogueShown) {
            window.setTimeout(() => setShowEpilogue(true), 2000);
          }
        }}
      />
    )}

    {/* epilogue bubble (appears 2s after verdict finishes) */}
    {(epilogueShown || showEpilogue) && (
      <MirrorBubble
        text={MIRROR_EPILOGUE}
        typing={!epilogueShown}
        onDone={() => {
          if (!epilogueShown) markEpilogueShown();
        }}
      />
    )}

    {epilogueShown && (
      <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={() => push("/background-intro")}
          className="rounded-2xl px-5 py-3 font-semibold text-lg bg-white/90 text-[#0b1335] hover:bg-white"
        >
          Go to sleep
        </button>
        <button
          onClick={() => {
            // Save current route so MirrorScreen knows where to return
            saveMirrorReturnRoute("/compass-quiz");
            push("/mirror");
          }}
          className="rounded-2xl px-5 py-3 font-semibold text-lg bg-white/15 text-white hover:bg-white/25 border border-white/30"
        >
          Examine mirror
        </button>
      </div>
    )}
  </div>
)}

      </div>
    </div>
  );
}
