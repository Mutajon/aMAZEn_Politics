// src/screens/MirrorDialogueScreen.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { useRoleStore } from "../store/roleStore";
import { useCompassStore } from "../store/compassStore";
import { useSettingsStore } from "../store/settingsStore";
import MirrorBubble from "../components/MirrorBubble";
import { motion, AnimatePresence } from "framer-motion";
import { useLogger } from "../hooks/useLogger";
import { useLang } from "../i18n/lang";

/** Built-in placeholder (no file asset needed) */
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

/** Player bubble kept local (white style) */
function PlayerBubble({ text, onDone }: { text: string; onDone?: () => void }) {
  const [shown, setShown] = useState("");
  const cbRef = useRef(onDone);
  useEffect(() => void (cbRef.current = onDone), [onDone]);
  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        window.setTimeout(() => cbRef.current?.(), 700);
      }
    }, 18);
    return () => window.clearInterval(id);
  }, [text]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="w-full flex justify-end my-2"
    >
      <div className="max-w-[85%] rounded-2xl px-4 py-3 shadow-lg bg-white text-black"
           style={{ borderTopLeftRadius: 18, borderTopRightRadius: 6 }}>
        {shown}
      </div>
    </motion.div>
  );
}

export default function MirrorDialogueScreen({ push }: { push: PushFn }) {
  const lang = useLang();
  const generateImages = useSettingsStore((s) => s.generateImages);
  const character = useRoleStore((s) => s.character);
  const resetCompass = useCompassStore((s) => s.reset);

  // Logging hook for data collection
  const logger = useLogger();

  // script
  const playerName = character?.name || lang("PLAYER_DEFAULT_NAME");
  const script: Array<{ side: "mirror" | "player"; text: string; italic?: boolean }> = [
    { side: "mirror", text: lang("MIRROR_DIALOGUE_1"), italic: true },
    { side: "player", text: lang("MIRROR_DIALOGUE_2") },
    { side: "mirror", text: lang("MIRROR_DIALOGUE_3").replace("{playerName}", playerName), italic: true },
    { side: "mirror", text: lang("MIRROR_DIALOGUE_4"), italic: true },
    { side: "mirror", text: lang("MIRROR_DIALOGUE_5"), italic: true },
  ];

  const [chatIndex, setChatIndex] = useState(0);

  // start fresh
  useEffect(() => {
    resetCompass();
    const t = window.setTimeout(() => setChatIndex(1), 300);
    return () => window.clearTimeout(t);
  }, [resetCompass]);

  const showCTA = chatIndex === script.length;

  /** Choose avatar or placeholder */
  const displayAvatar = useMemo(() => {
    if (character?.avatarUrl) return character.avatarUrl;
    if (!generateImages) return DEFAULT_AVATAR_DATA_URL;
    return "";
  }, [character?.avatarUrl, generateImages]);

  // layout
  const MIRROR = 180;

  return (
    <div className="min-h-[100dvh] px-5 py-5" style={bgStyle}>
      <div className="w-full max-w-xl mx-auto">
        {/* TOP ROW: aligned at TOP */}
        <div className="flex items-start justify-between gap-4 mt-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="relative self-start"
            style={{ width: MIRROR, height: MIRROR }}
          >
            <img
              src="/assets/images/mirror.png"
              alt="Mystic mirror"
              width={MIRROR}
              height={MIRROR}
              className="rounded-full object-cover"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-[220px] h-[220px] rounded-[24px] border border-white/10 bg-white/5 backdrop-blur-sm shadow-xl overflow-hidden grid place-items-center"
          >
            {displayAvatar ? (
              <img src={displayAvatar} alt="Character avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="text-white/80">{lang("PREPARING_AVATAR")}</div>
            )}
          </motion.div>
        </div>

        {/* CHAT THREAD */}
        <div className="mt-4">
          <AnimatePresence>
            {chatIndex > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-xl">
                {script.slice(0, chatIndex).map((m, idx) =>
                  m.side === "mirror" ? (
                    <MirrorBubble
                      key={`msg-${idx}`}
                      text={m.text}
                      italic={m.italic}
                      typing={true}
                      onDone={idx === chatIndex - 1 && chatIndex < script.length ? () => setChatIndex(chatIndex + 1) : undefined}
                    />
                  ) : (
                    <PlayerBubble
                      key={`msg-${idx}`}
                      text={m.text}
                      onDone={idx === chatIndex - 1 && chatIndex < script.length ? () => setChatIndex(chatIndex + 1) : undefined}
                    />
                  )
                )}
                {showCTA && (
                  <div className="flex justify-center mt-3">
                    <motion.button
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 280, damping: 22 }}
                      onClick={() => {
                        logger.log('button_click_mirror_dialogue_continue', "Sure, let's go", 'User clicked continue to compass quiz');
                        push("/compass-quiz");
                      }}
                      className="rounded-2xl px-5 py-3 font-semibold text-lg bg-white/15 text-white hover:bg-white/25 border border-white/30"
                    >
                      {lang("MIRROR_DIALOGUE_BUTTON")}
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
