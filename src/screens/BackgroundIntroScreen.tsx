// src/screens/BackgroundIntroScreen.tsx
import { useEffect, useRef, useState } from "react";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { motion, AnimatePresence } from "framer-motion";
import { useNarrator } from "../hooks/useNarrator";
import type { PreparedTTS } from "../hooks/useNarrator";
import { useSettingsStore } from "../store/settingsStore";
import { useRoleStore } from "../store/roleStore";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useLogger } from "../hooks/useLogger";
import { useLang } from "../i18n/lang";

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
  const lang = useLang();
  const narrator = useNarrator();
  const narrationEnabled = useSettingsStore((s) => s.narrationEnabled);

  // Logging hook for data collection
  const logger = useLogger();

  // Role data (forgiving shape)
  const selectedRoleRaw = useRoleStore((s: any) => s.selectedRole);
  const genderRaw = useRoleStore((s: any) => s?.character?.gender);
  const roleText: string =
    typeof selectedRoleRaw === "string"
      ? selectedRoleRaw
      : selectedRoleRaw?.label || selectedRoleRaw?.name || "";
  const gender: "male" | "female" | "any" =
    genderRaw === "male" || genderRaw === "female" ? genderRaw : "any";

  const DEFAULT_LINE = lang("BACKGROUND_INTRO_DEFAULT_LINE");

  const [phase, setPhase] = useState<Phase>("preparingDefault");
  const [para, setPara] = useState<string>("");
  const preparedDefaultRef = useRef<PreparedTTS | null>(null);
  const preparedIntroRef = useRef<PreparedTTS | null>(null);
  // prevent double-plays & track background readiness
const defaultPlayedRef = useRef(false);
const introPlayedRef = useRef(false);
const bgReadyRef = useRef(false);
  const [defaultNarrationComplete, setDefaultNarrationComplete] = useState(false);
  // Track if we've logged the paragraph to avoid duplicate logs
  const paragraphLoggedRef = useRef(false);
  // Track if we're currently fetching the intro paragraph to prevent race condition
  const fetchingIntroRef = useRef(false);
  // Store prefetch AbortController so we can cancel it from onWake
  const prefetchAbortRef = useRef<AbortController | null>(null);


  // 1) On mount, PREPARE default line audio; show nothing until ready
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (narrationEnabled) {
          const p = await narrator.prepare(DEFAULT_LINE, { voiceName: "alloy", format: "mp3" });
          if (cancelled) { p.dispose(); return; }
          preparedDefaultRef.current = p;
        }
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
  }, [narrationEnabled]);
// Prefetch the generated paragraph + prepare its TTS AFTER the default narration completes
useEffect(() => {
  if (phase !== "idle" || bgReadyRef.current || !defaultNarrationComplete || fetchingIntroRef.current) return;

  let cancelled = false;
  const controller = new AbortController();
  prefetchAbortRef.current = controller; // Store controller so onWake can cancel it

  (async () => {
    fetchingIntroRef.current = true;

    // Wrap everything in try-finally to guarantee flag reset
    try {
      try {
        const payload = { role: roleText || "Unknown role", gender };
        const r = await fetch("/api/intro-paragraph", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!r.ok) {
          console.warn(`[BackgroundIntro] Prefetch failed: ${r.status}`);
          return;
        }
        const data = await r.json();
        const paragraph = (data?.paragraph || "").trim();
        if (!paragraph) {
          console.warn("[BackgroundIntro] Prefetch returned empty paragraph");
          return;
        }

        if (cancelled) return;
        setPara(paragraph); // so UI has the text when we transition

        // Prepare the TTS for the paragraph ahead of time (only if narration enabled)
        if (narrationEnabled) {
          const p = await narrator.prepare(paragraph, { voiceName: "alloy", format: "mp3" });
          if (cancelled) { p.dispose(); return; }
          preparedIntroRef.current = p;
        }
        bgReadyRef.current = true;
        console.log("[BackgroundIntro] Prefetch succeeded");
      } catch (e: any) {
        if (e?.name === "AbortError") {
          console.log("[BackgroundIntro] Prefetch aborted");
          return;
        }
        console.warn("[BackgroundIntro] Prefetch error:", e.message);
        // silent fail; foreground flow will handle errors
      }
    } finally {
      // ALWAYS reset flag, even if cancelled or error
      if (!cancelled) {
        fetchingIntroRef.current = false;
        console.log("[BackgroundIntro] Prefetch flag reset");
      }
    }
  })();

  return () => {
    cancelled = true;
    controller.abort();
    prefetchAbortRef.current = null; // Clear ref on cleanup
  };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [phase, roleText, gender, defaultNarrationComplete, narrationEnabled]);

  // 2) Wake up → fade out, then load paragraph
  const onWake = () => {
    // Log player clicking "Wake up" button
    logger.log('button_click_wake_up', 'Wake up', 'User clicked Wake up button');

    // Cancel prefetch if still running to prevent race condition
    if (fetchingIntroRef.current && prefetchAbortRef.current) {
      console.log("[BackgroundIntro] Cancelling prefetch before foreground fetch");
      prefetchAbortRef.current.abort();
      fetchingIntroRef.current = false; // Reset flag immediately
      prefetchAbortRef.current = null;
    }

    // If background prefetch finished, jump straight to ready; else do the normal loading flow
    if (bgReadyRef.current && preparedIntroRef.current && para.trim()) {
      setPhase("ready");
    } else {
      setPhase("loading");
    }
  };
  

  // 3) When loading, call the server for the paragraph
  useEffect(() => {
    let abort = new AbortController();
    (async () => {
      if (phase !== "loading" || fetchingIntroRef.current) return;
      fetchingIntroRef.current = true;

      // Wrap in try-finally to guarantee flag reset
      try {
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
      } finally {
        // ALWAYS reset flag
        fetchingIntroRef.current = false;
        console.log("[BackgroundIntro] Foreground fetch flag reset");
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

      // Skip TTS preparation if narration disabled
      if (!narrationEnabled) {
        setPhase("ready");
        return;
      }

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
  }, [phase, para, narrationEnabled]);

  // 5) Log system-generated intro paragraph when it's ready
  useEffect(() => {
    if (phase === "ready" && para.trim() && !paragraphLoggedRef.current) {
      paragraphLoggedRef.current = true;
      logger.logSystem(
        'background_intro_generated',
        para,
        'System presented AI-generated background intro paragraph'
      );
    }
  }, [phase, para, logger]);

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
                if (p && narrationEnabled && !defaultPlayedRef.current) {
                  defaultPlayedRef.current = true;
                  try {
                    await p.start();
                    // Audio finished playing - safe to prefetch now
                    setDefaultNarrationComplete(true);
                  } catch (e) {
                    console.warn("default play blocked:", e);
                    // If blocked, allow prefetch anyway
                    setDefaultNarrationComplete(true);
                  }
                } else if (!narrationEnabled) {
                  // If narration disabled, allow prefetch immediately
                  setDefaultNarrationComplete(true);
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
              if (p && narrationEnabled && !introPlayedRef.current) {
                introPlayedRef.current = true;
                try { await p.start(); } catch (e) { console.warn("intro play blocked:", e); }
              }
            }}
            
          >
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
              {lang("BACKGROUND_INTRO_TITLE")}
            </h1>

            <p className="mt-3 text-white/80 whitespace-pre-wrap">{para}</p>

            <div className="mt-6">
              <button
                className="w-[14rem] rounded-2xl px-4 py-3 text-base font-semibold bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                onClick={() => {
                  console.log("[BackgroundIntro] Begin clicked");

                  // Log player clicking "Begin" button
                  logger.log('button_click_begin', 'Begin', 'User clicked Begin button to start first day');

                  // Clear dilemma history when starting a new game (Day 1)
                  useDilemmaStore.getState().clearHistory();
                  console.log("[BackgroundIntro] Dilemma history cleared for new game");

                  // Navigate to event screen
                  push("/event");
                }}
              >
                {lang("BACKGROUND_INTRO_BEGIN")}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
