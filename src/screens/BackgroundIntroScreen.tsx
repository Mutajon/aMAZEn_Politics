// src/screens/BackgroundIntroScreen.tsx
import { useEffect, useRef, useState } from "react";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { motion, AnimatePresence } from "framer-motion";
import { useNarrator } from "../hooks/useNarrator";
import type { PreparedTTS } from "../hooks/useNarrator";
import { useSettingsStore } from "../store/settingsStore";
import { useRoleStore } from "../store/roleStore";

/**
 * Phases:
 *  - "preparingDefault" : fetch & buffer TTS for the default line
 *  - "idle"             : default text visible; Wake up available
 *  - "loading"          : calling OpenAI for paragraph
 *  - "preparingIntro"   : buffering TTS for generated paragraph
 *  - "ready" / "error"  : show paragraph + Begin
 *
 * We start audio exactly on the fade-in animation by using onAnimationStart.
 */

type Phase = "preparingDefault" | "idle" | "loading" | "preparingIntro" | "ready" | "error";

export default function BackgroundIntroScreen({ push }: { push: PushFn }) {
  const narrator = useNarrator();
  const narrationEnabled = useSettingsStore((s) => s.narrationEnabled);

  // Role data (forgiving shape)
  const selectedRoleRaw = useRoleStore((s: any) => s.selectedRole);
  const genderRaw = useRoleStore((s: any) => s?.character?.gender);
  const roleText: string =
    typeof selectedRoleRaw === "string"
      ? selectedRoleRaw
      : selectedRoleRaw?.label || selectedRoleRaw?.name || "";
  const gender: "male" | "female" | "any" =
    genderRaw === "male" || genderRaw === "female" ? genderRaw : "any";

  const DEFAULT_LINE =
    "You drift into sleep as the mirror’s last words echo softly. Tomorrow, your new role begins…";

  const [phase, setPhase] = useState<Phase>("preparingDefault");
  const [para, setPara] = useState<string>("");
  const preparedDefaultRef = useRef<PreparedTTS | null>(null);
  const preparedIntroRef = useRef<PreparedTTS | null>(null);

  // 1) On mount, PREPARE default line audio; show nothing until ready
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await narrator.prepare(DEFAULT_LINE, { voiceName: "alloy", format: "mp3" });
        if (cancelled) { p.dispose(); return; }
        preparedDefaultRef.current = p;
        setPhase("idle"); // now we can reveal the default copy; we'll start TTS on fade-in start
      } catch (e) {
        console.warn("[BackgroundIntro] default prepare failed; showing text only", e);
        setPhase("idle"); // soft-fail: still show text
      }
    })();
    return () => {
      cancelled = true;
      preparedDefaultRef.current?.dispose();
      preparedIntroRef.current?.dispose();
      narrator.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Wake up → fade out, then load paragraph
  const onWake = () => {
    setPhase("loading");
  };

  // 3) When loading, call the server for the paragraph
  useEffect(() => {
    let abort = new AbortController();
    (async () => {
      if (phase !== "loading") return;
      try {
        const payload = { role: roleText || "Unknown role", gender };
        const r = await fetch("/api/intro-paragraph", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: abort.signal,
        });
        if (!r.ok) {
          const detail = await r.text().catch(() => "");
          console.warn("Intro API error:", r.status, detail);
          setPara("The morning arrives, but words fail to settle. Try again in a moment.");
          setPhase("error");
          return;
        }
        const data = await r.json();
        const paragraph = (data?.paragraph || "").trim();
        if (!paragraph) {
          setPara("The morning arrives, but words fail to settle. Try again in a moment.");
          setPhase("error");
          return;
        }
        setPara(paragraph);
        setPhase("preparingIntro"); // buffer TTS before revealing
      } catch (e) {
        if ((e as any)?.name === "AbortError") return;
        console.warn("Intro generation error:", e);
        setPara("The morning arrives, but words fail to settle. Try again in a moment.");
        setPhase("error");
      }
    })();
    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // 4) When preparingIntro, PREPARE paragraph audio; reveal only when ready
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (phase !== "preparingIntro") return;
      try {
        const p = await narrator.prepare(para, { voiceName: "alloy", format: "mp3" });
        if (cancelled) { p.dispose(); return; }
        preparedIntroRef.current = p;
        setPhase("ready"); // will start playback on fade-in animation
      } catch (e) {
        console.warn("[BackgroundIntro] intro prepare failed; showing text only", e);
        setPhase("ready"); // soft-fail: still show text
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, para]);

  return (
    <div className="min-h-[100dvh] px-5 py-6" style={bgStyle}>
      <div className="max-w-2xl mx-auto">

        {/* Stage A: default content (only after TTS is buffered) ------------------- */}
        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              // Start the default narration exactly with the fade-in
              onAnimationStart={async () => {
                const p = preparedDefaultRef.current;
                if (p && narrationEnabled) {
                  try { await p.start(); } catch (e) { console.warn("default play blocked:", e); }
                }
              }}
            >
              <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
                Night Falls
              </h1>

              <p className="mt-3 text-white/80">{DEFAULT_LINE}</p>

              <div className="mt-6">
                <button
                  className="w-[14rem] rounded-2xl px-4 py-3 text-base font-semibold bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                  onClick={onWake}
                >
                  Wake up
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stage B: loading indicator ---------------------------------------------- */}
        <AnimatePresence mode="wait">
          {(phase === "loading" || phase === "preparingIntro") && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-4"
            >
              <h2 className="text-lg font-medium text-white/80">
                {phase === "loading" ? "Gathering the threads…" : "Warming the voice…"}
              </h2>
              <div className="mt-4 flex items-center gap-3 text-white/70">
                <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden />
                <span>
                  {phase === "loading"
                    ? `Shaping your first morning as ${roleText || "your role"}…`
                    : "Preparing narration…"}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stage C: result (or error) --------------------------------------------- */}
        {(phase === "ready" || phase === "error") && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-2"
            // Start the paragraph narration exactly with the fade-in
            onAnimationStart={async () => {
              if (phase !== "ready") return;
              const p = preparedIntroRef.current;
              if (p && narrationEnabled) {
                try { await p.start(); } catch (e) { console.warn("intro play blocked:", e); }
              }
            }}
          >
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
              First Light
            </h1>

            <p className="mt-3 text-white/80 whitespace-pre-wrap">{para}</p>

            <div className="mt-6">
              <button
                className="w-[14rem] rounded-2xl px-4 py-3 text-base font-semibold bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                onClick={() => {
                  console.log("[BackgroundIntro] Begin clicked");
                  // TODO: wire next step (push("/...")) when you’re ready
                }}
              >
                Begin
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
