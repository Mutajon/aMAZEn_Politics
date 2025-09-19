// src/screens/MirrorQuizScreen.tsx
import { useEffect, useMemo, useState } from "react";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { motion, AnimatePresence } from "framer-motion";
import { useCompassStore, VALUE_RULES } from "../store/compassStore";
import { resolveLabel } from "../data/compass-data";
import { pickQuiz, type MirrorQA } from "../data/mirror-quiz-pool";
import { useRoleStore } from "../store/roleStore";
import { useSettingsStore } from "../store/settingsStore";
import MiniCompass from "../components/MiniCompass";
import { useCompassFX } from "../hooks/useCompassFX";
import { generateMirrorSummary } from "../lib/mirrorSummary";
import { useMirrorQuizStore } from "../store/mirrorQuizStore";
import MirrorBubble from "../components/MirrorBubble";

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
const MIRROR_EPILOGUE =
  "Well, that was unexpectedly insightful. We’ve sketched the first lines of your inner portrait; from here, every choice you make will add color and contour—and I’ll be here to show you what the mirror sees. Rest now. Tomorrow your new role begins.";

export default function MirrorQuizScreen({ push }: { push: PushFn }) {
  // compass
  const values = useCompassStore((s) => s.values);
  const resetCompass = useCompassStore((s) => s.reset);

  // FX
  const { pings, applyWithPings } = useCompassFX();

  // avatar
  const character = useRoleStore((s) => s.character);
  const generateImages = useSettingsStore((s) => s.generateImages);
  const displayAvatar = useMemo(() => {
    if (character?.avatarUrl) return character.avatarUrl;
    if (!generateImages) return DEFAULT_AVATAR_DATA_URL;
    return "";
  }, [character?.avatarUrl, generateImages]);

  // quiz store
  const { quiz, idx, done, summary, epilogueShown, init, advance, setDone, setSummary, markEpilogueShown } =
    useMirrorQuizStore();

  // mount: start quiz if needed
  useEffect(() => {
    if (quiz.length === 0) {
      resetCompass();
      init(pickQuiz(3));
    }
  }, [quiz.length, init, resetCompass]);

  // get summary once done
  useEffect(() => {
    (async () => {
      if (done && !summary) {
        const s = await generateMirrorSummary(values, { useAI: true, topN: 2 });
        setSummary(s);
      }
    })();
  }, [done, summary, setSummary, values]);

  // local progression for epilogue timing
  const [showEpilogue, setShowEpilogue] = useState(false);
  useEffect(() => {
    if (done && summary && !epilogueShown) {
      const t = window.setTimeout(() => setShowEpilogue(true), 2000);
      return () => window.clearTimeout(t);
    }
  }, [done, summary, epilogueShown]);

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
  const RING_SIZE = 260;
  const MIRROR_SIZE = 120;
  const INNER_RADIUS = MIRROR_SIZE / 2 + 10;
  const CARD = 154;

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
            style={{ width: RING_SIZE, height: RING_SIZE }}
          >
            <MiniCompass
              size={RING_SIZE}
              innerRadius={INNER_RADIUS}
              values={values}
              lengthScale={0.7}
              rotate
              rotationSpeedSec={60}
              effectPills={pings}
            />
            <img
              src={MIRROR_SRC}
              alt="Mystic mirror"
              width={MIRROR_SIZE}
              height={MIRROR_SIZE}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full object-cover pointer-events-none"
              style={{ zIndex: 30 }}
            />
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
                    className="rounded-3xl p-4 border shadow-2xl backdrop-blur-md bg-white/10 border-white/20"
                  >
                    <div className="text-[17px] font-semibold text-white drop-shadow">
                      {quiz[idx].q}
                    </div>

                    <div className="mt-3 grid gap-2">
                      {quiz[idx].options.map((opt, i) => (
                        <motion.button
                          key={i}
                          onClick={() => answer(opt)}
                          whileTap={{ scale: 0.985 }}
                          className={[
                            "w-full text-left px-4 py-2 rounded-2xl transition",
                            "border bg-gradient-to-br",
                            "from-white/15 to-white/5 border-white/15 text-white",
                            "hover:from-white/25 hover:to-white/10 hover:border-white/30 hover:shadow-lg",
                            "focus:outline-none focus:ring-2 focus:ring-amber-300/60",
                          ].join(" ")}
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

        {/* DONE: show summary bubble (typewriter once), then epilogue bubble (typewriter after 2s), then buttons.
           When returning from CompassVis, both render fully with no animation. */}
        {done && (
          <div className="mt-6 mx-auto max-w-xl">
            {summary && (
              <MirrorBubble
                text={summary}
                typing={!epilogueShown}             // type only on first reveal
                onDone={() => { /* nothing here — delay handled in parent state */ }}
              />
            )}

            {(epilogueShown || showEpilogue) && (
              <MirrorBubble
                text={MIRROR_EPILOGUE}
                typing={!epilogueShown}             // type only once
                onDone={() => {
                  if (!epilogueShown) markEpilogueShown();
                }}
              />
            )}

            {(epilogueShown) && (
              <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => push("/background-intro")}
                  className="rounded-2xl px-5 py-3 font-semibold text-lg bg-white/90 text-[#0b1335] hover:bg-white"
                >
                  Go to sleep
                </button>
                <button
                  onClick={() => push("/compass-vis")}
                  className="rounded-2xl px-5 py-3 font-semibold text-lg bg-white/15 text-white hover:bg-white/25 border border-white/30"
                >
                  See your compass
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
