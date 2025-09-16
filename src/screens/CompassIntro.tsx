// src/screens/CompassIntro.tsx
import { useEffect, useRef, useState } from "react";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { useRoleStore } from "../store/roleStore";
import LoadingOverlay from "../components/LoadingOverlay";
import { motion, AnimatePresence } from "framer-motion";

/* utils ----------------------------------------------------- */
function trimEra(role: string): string {
  return (role || "").replace(/\s*[—–-].*$/u, "").trim();
}
function genderizeRole(role: string, gender: "male" | "female" | "any"): string {
  const r = (role || "").trim().toLowerCase();
  const map: Record<string, { male: string; female: string }> = {
    emperor: { male: "Emperor of", female: "Empress of" },
    king: { male: "King of", female: "Queen of" },
    prince: { male: "Prince of", female: "Princess of" },
    hero: { male: "Hero of", female: "Heroine of" },
    monk: { male: "Monk of", female: "Nun of" },
    lord: { male: "Lord of", female: "Lady of" },
    duke: { male: "Duke of", female: "Duchess of" },
    tsar: { male: "Tsar of", female: "Tsarina of" },
    pharaoh: { male: "Pharaoh of", female: "Pharaoh of" },
    chancellor: { male: "Chancellor of", female: "Chancellor of" },
    kanzler: { male: "Kanzler von", female: "Kanzlerin von" },
  };
  for (const key of Object.keys(map)) {
    if (r.startsWith(key)) {
      const rest = role.slice(key.length).trim();
      const pair = map[key];
      if (gender === "female") return `${pair.female} ${rest}`.trim();
      return `${pair.male} ${rest}`.trim();
    }
  }
  return role || "your new role";
}

/* typewriter bubble ----------------------------------------- */
function Bubble({
  side,
  text,
  italic,
  onDone,
}: {
  side: "mirror" | "player";
  text: string;
  italic?: boolean;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState("");
const doneRef = useRef<(() => void) | undefined>(onDone);
useEffect(() => { doneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    let i = 0;
    const speed = 18;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setTimeout(() => doneRef.current?.(), 1000); // wait 1s before next bubble
      }
    }, speed);
    return () => clearInterval(id);
  }, [text]);
  

  const isMirror = side === "mirror";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={`w-full flex ${isMirror ? "justify-start" : "justify-end"} my-2`}
    >
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-3 shadow-lg",
          isMirror
            ? "bg-black/40 text-teal-300 italic" // mirror bubble style per request
            : "bg-white text-black",
        ].join(" ")}
        style={{
          borderTopLeftRadius: isMirror ? 6 : 18,
          borderTopRightRadius: isMirror ? 18 : 6,
        }}
      >
        <span className={italic ? "italic" : ""}>{shown}</span>
      </div>
    </motion.div>
  );
}

/* main screen ------------------------------------------------ */
export default function CompassIntro({ push }: { push: PushFn }) {
  const character = useRoleStore((s) => s.character);
  const selectedRole = useRoleStore((s) => s.selectedRole);
  const updateCharacter = useRoleStore((s) => s.updateCharacter);

  const [avatarUrl, setAvatarUrl] = useState<string>(character?.avatarUrl || "");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // staged reveals
  const [showImage, setShowImage] = useState(false);
  const [showText, setShowText] = useState(false);
  const [showCTA, setShowCTA] = useState(false);

  // after CTA -> mirror scene
  const [mirrorMode, setMirrorMode] = useState(false);
  const [startChat, setStartChat] = useState(false);
  const [chatIndex, setChatIndex] = useState(0); // how many bubbles to show (kept on screen)

  const avatarReqRef = useRef(0);
  const AVATAR_SIZE = 280;
  const playerScale = mirrorMode ? 0.7 : 1;

  const avatarQuotes = [
    "Great faces take great pixels.",
    "Applying heroic jawline filter…",
    "Double-checking cheekbone symmetry…",
    "No text, just vibes, promise.",
    "Polishing the background glow…",
  ];

  /* guards & avatar generation ---------------------------------- */
  useEffect(() => {
    if (!character?.imagePrompt && !character?.description) push("/name");
  }, [character?.imagePrompt, character?.description, push]);

  useEffect(() => {
    const prompt = (character?.imagePrompt || character?.description || "").trim();
    if (!prompt) return;
    if (avatarUrl) return;

    const req = ++avatarReqRef.current;
    const ac = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        const res = await fetch("/api/generate-avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
          signal: ac.signal,
        });
        const data = await res.json();
        if (!res.ok || !data?.dataUrl) throw new Error(data?.error || res.statusText);

        if (req !== avatarReqRef.current) return;

        setAvatarUrl(data.dataUrl);
        updateCharacter({ avatarUrl: data.dataUrl });
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        if (req !== avatarReqRef.current) return;
        setErrorMsg(e?.message || "Avatar generation failed");
      } finally {
        if (req === avatarReqRef.current) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [character?.imagePrompt, character?.description, avatarUrl, updateCharacter]);

  /* staged initial intro */
  useEffect(() => {
    if (!avatarUrl) return;
    setShowImage(true);
    const t1 = setTimeout(() => setShowText(true), 1000);
    const t2 = setTimeout(() => setShowCTA(true), 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [avatarUrl]);

  /* handle CTA -> mirror scene */
  const onLookInMirror = () => {
    setShowText(false);
    setShowCTA(false);
    setMirrorMode(true);
    setTimeout(() => setStartChat(true), 1000);
  };

  const tryAgain = () => {
    setAvatarUrl("");
    setShowImage(false);
    setShowText(false);
    setShowCTA(false);
    setMirrorMode(false);
    setStartChat(false);
    setChatIndex(0);
    updateCharacter({ avatarUrl: "" });
  };

  const playerName = character?.name || "Player";
  const roleBase = trimEra(selectedRole || "");
  const roleText = genderizeRole(roleBase, character?.gender || "any");

  /* chat script (kept on screen) --------------------------------- */
  const script: Array<{ side: "mirror" | "player"; text: string; italic?: boolean }> = [
    { side: "mirror", text: "Finally... I found you!", italic: true },
    { side: "player", text: "Who are you?" },
    {
      side: "mirror",
      text: `Wrong question, my friend. What you should be asking is who are you, ${playerName}?`,
      italic: true,
    },
    {
      side: "mirror",
      text: "Look at yourself, a hollow avatar with no desires or values.",
      italic: true,
    },
    {
      side: "mirror",
      text: "Come, humor me for just a moment, and let us uncover your soul — together.",
      italic: true,
    },
  ];

  // start first bubble exactly once when chat begins
  useEffect(() => {
    if (startChat && chatIndex === 0) setChatIndex(1);
  }, [startChat, chatIndex]);

  return (
    <div className="min-h-[100dvh] px-5 py-6" style={bgStyle}>
      <div className="w-full max-w-xl mx-auto">
        {/* top area with avatar (right) + mirror placeholder (left) */}
        <div className="relative mt-2 grid place-items-center">
          {/* player image card (slides to the RIGHT) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{
              opacity: showImage ? 1 : 0,
              y: showImage ? 0 : 8,
              x: mirrorMode ? 160 : 0, // move right when mirror mode
              scale: playerScale,
            }}
            transition={{ duration: 0.35 }}
            className="w-[280px] h-[280px] rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-sm shadow-xl overflow-hidden grid place-items-center relative"
          >
            {avatarUrl ? (
              <motion.img
                key={avatarUrl}
                src={avatarUrl}
                alt="Character avatar"
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              />
            ) : (
              <div className="text-white/80">Preparing avatar…</div>
            )}
            {/* name banner when in mirror mode */}
            {mirrorMode && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-xl px-3 py-1 text-xs font-semibold bg-black/60 text-white"
              >
                {playerName}
              </motion.div>
            )}
          </motion.div>

          {/* mirror placeholder (LEFT side) */}
          <AnimatePresence>
            {mirrorMode && (
              <motion.div
              initial={{ opacity: 0, scale: 0.8, x: -200 }}
              animate={{ opacity: 1, scale: 1, x: -220 }}              
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute top-0 left-0 grid place-items-center"
                style={{ height: AVATAR_SIZE, width: AVATAR_SIZE }}
              >
                <div
                  className="rounded-full shadow-xl"
                  style={{
                    width: AVATAR_SIZE * 0.7,
                    height: AVATAR_SIZE * 0.7,
                    background:
                      "radial-gradient(closest-side, rgba(255,255,255,0.9), rgba(255,255,255,0.15) 60%, rgba(0,0,0,0.25))",
                    border: "2px solid rgba(255,255,255,0.65)",
                    boxShadow:
                      "0 8px 24px rgba(0,0,0,0.25), inset 0 2px 8px rgba(255,255,255,0.5)",
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* intro text (fades away when mirror mode begins) */}
        <AnimatePresence>
          {showText && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="mt-5 text-center text-white/90 leading-relaxed"
            >
              <p className="text-lg">Welcome {playerName},</p>
              <p className="mt-3">
                It is the night before your first day as <span className="font-semibold">{roleText}</span>. Suddenly a
                package arrives with no return, only the words:{" "}
                <span className="font-extrabold text-amber-300">Know Thyself</span>.
              </p>
              <p className="mt-3">Inside, a mirror—black, breathless, waiting.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error banner */}
        {errorMsg && (
          <div className="mt-6 rounded-xl border border-red-400/40 bg-red-500/10 text-red-200 px-3 py-2" role="alert">
            {errorMsg}
            <button onClick={tryAgain} className="ml-3 underline decoration-red-300 hover:opacity-80">
              Try again
            </button>
          </div>
        )}

        {/* CTA (hidden in mirror mode) */}
        <div className="mt-8 flex justify-center">
          <AnimatePresence>
            {showCTA && !mirrorMode && (
              <motion.button
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                onClick={() => {
                  onLookInMirror();
                }}
                className="rounded-2xl px-5 py-3 font-semibold text-lg shadow-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0b1335] hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
              >
                Look in the mirror
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* CHAT THREAD (bubbles persist) ---------------------------- */}
        <div className="mt-6">
          <AnimatePresence>
            {startChat && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-xl">
                {script.slice(0, chatIndex).map((m, idx) => (
                  <Bubble
                    key={idx}
                    side={m.side}
                    text={m.text}
                    italic={m.italic}
                    // only the LAST visible bubble controls when the next one appears
                    onDone={idx === chatIndex - 1 && chatIndex < script.length ? () => setChatIndex(chatIndex + 1) : undefined}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* overlay while generating */}
      <LoadingOverlay
        visible={loading}
        title="Preparing avatar…"
        quotes={[
          "Great faces take great pixels.",
          "Applying heroic jawline filter…",
          "Double-checking cheekbone symmetry…",
          "No text, just vibes, promise.",
          "Polishing the background glow…",
        ]}
        periodMs={3000}
      />
    </div>
  );
}
