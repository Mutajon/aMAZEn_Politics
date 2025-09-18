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

/** placeholder avatar (used when image gen is OFF and no saved avatar) */
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

export default function MirrorQuizScreen({ push }: { push: PushFn }) {
  const applyEffects = useCompassStore((s) => s.applyEffects);
  const values = useCompassStore((s) => s.values);
  const reset = useCompassStore((s) => s.reset);

  const character = useRoleStore((s) => s.character);
  const generateImages = useSettingsStore((s) => s.generateImages);

  const displayAvatar = useMemo(() => {
    if (character?.avatarUrl) return character.avatarUrl;
    if (!generateImages) return DEFAULT_AVATAR_DATA_URL;
    return ""; // images ON but not yet generated
  }, [character?.avatarUrl, generateImages]);

  // pick exactly 3 on mount
  const [quiz, setQuiz] = useState<MirrorQA[]>([]);
  const [idx, setIdx] = useState(0);
  const [answering, setAnswering] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    reset();
    const three = pickQuiz(3);
    setQuiz(three);
    setIdx(0);
    setDone(three.length === 0);
  }, [reset]);

  const current = quiz[idx];
  const remaining = Math.max(quiz.length - idx - (done ? 1 : 0), done ? 0 : (current ? 1 : 0));

  function answer(opt: { a: string; mappings: string[] }) {
    if (!current || answering) return;
    setAnswering(true);

    // apply value effects
    const pairs = opt.mappings
      .map(resolveLabel)
      .filter((x): x is NonNullable<ReturnType<typeof resolveLabel>> => x !== null);
    const effects = pairs.map(({ prop, idx }) => ({ prop, idx, delta: VALUE_RULES.strongPositive }));
    applyEffects(effects);

    // after short pause, advance to next (AnimatePresence will fade out/in)
    setTimeout(() => {
      if (idx + 1 >= quiz.length) {
        setDone(true);
      } else {
        setIdx((i) => i + 1);
      }
      setAnswering(false);
    }, 580);
  }

  /** layout sizes (mirror/dialog 30% smaller pattern) */
  const MIRROR = 126;
  const CARD = 154;

  return (
    <div className="min-h-[100dvh] px-5 py-5" style={bgStyle}>
      <div className="w-full max-w-xl mx-auto">
        {/* TOP ROW — mirror (left) + avatar (right), aligned at top */}
        <div className="flex items-start justify-between gap-4 mt-1">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="relative shrink-0"
            style={{ width: MIRROR + 100, height: MIRROR + 100 }}
          >
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <MiniCompass
                size={MIRROR + 100}
                innerRadius={MIRROR / 2 + 10}
                values={values}
                lengthScale={0.45}
                rotate
                rotationSpeedSec={60}
              />
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <img
                src="/assets/images/mirror.png"
                alt="Mystic mirror"
                width={MIRROR}
                height={MIRROR}
                className="rounded-full object-cover"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-[22px] border border-white/10 bg-white/5 backdrop-blur-sm shadow-xl overflow-hidden grid place-items-center"
            style={{ width: CARD, height: CARD }}
          >
            {displayAvatar ? (
              <img src={displayAvatar} alt="Character avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="text-white/80 text-sm">Preparing avatar…</div>
            )}
          </motion.div>
        </div>

        {/* Remaining counter */}
        <div className="mt-3 text-center text-white/70 text-xs tracking-wide">
          Mirror questions remaining: {remaining}
        </div>

        {/* QUIZ PANEL — reserved vertical space prevents jumps */}
        <div className="mt-4 relative">
          <div className="min-h-[210px]">
            <AnimatePresence mode="wait">
              {current && !done && (
                <motion.div
                  key={idx} // change per question
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="rounded-3xl p-4 border shadow-2xl backdrop-blur-md
                             bg-white/10 border-white/20"
                >
                  <div className="text-[17px] font-semibold text-white drop-shadow">
                    {current.q}
                  </div>

                  <div className="mt-3 grid gap-2">
                    {current.options.map((opt, i) => (
                      <motion.button
                        key={i}
                        onClick={() => answer(opt)}
                        disabled={answering}
                        whileTap={{ scale: 0.985 }}
                        className={[
                          "w-full text-left px-4 py-2 rounded-2xl transition",
                          "border bg-gradient-to-br",
                          "from-white/15 to-white/5 border-white/15 text-white",
                          "hover:from-white/25 hover:to-white/10 hover:border-white/30 hover:shadow-lg",
                          "focus:outline-none focus:ring-2 focus:ring-amber-300/60",
                          "disabled:opacity-70",
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

        {/* Done → CTA */}
        {done && (
          <div className="mt-6 text-center">
            <div className="text-white/90 mb-4">Nicely done. The mirror has spoken.</div>
            <button
              onClick={() => push("/compass-vis")}
              className="rounded-2xl px-5 py-3 font-semibold text-lg bg-white/15 text-white hover:bg-white/25 border border-white/30"
            >
              See your compass
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
