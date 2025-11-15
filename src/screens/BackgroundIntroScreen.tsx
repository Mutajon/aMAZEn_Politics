// src/screens/BackgroundIntroScreen.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PushFn } from "../lib/router";
import { bgStyleWithRoleImage } from "../lib/ui";
import { motion, AnimatePresence } from "framer-motion";
import { useNarrator } from "../hooks/useNarrator";
import type { PreparedTTS } from "../hooks/useNarrator";
import { useSettingsStore } from "../store/settingsStore";
import { useRoleStore } from "../store/roleStore";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useLogger } from "../hooks/useLogger";
import { useLang } from "../i18n/lang";
import { useReserveGameSlot } from "../hooks/useReserveGameSlot";

/**
 * Phases:
 *  - "preparingDefault" : fetch & buffer TTS for the default line
 *  - "idle"             : default text visible; Wake up available
 *  - "waitingForSeed"   : waiting for narrative seeding to complete
 *  - "loading"          : calling OpenAI for paragraph
 *  - "preparingIntro"   : buffering TTS for generated paragraph
 *  - "ready" / "error"  : show paragraph + Begin
 *
 * We start audio exactly on the fade-in animation by using onAnimationStart.
 */

type Phase = "preparingDefault" | "idle" | "waitingForSeed" | "loading" | "preparingIntro" | "ready" | "error";

export default function BackgroundIntroScreen({ push }: { push: PushFn }) {
  const lang = useLang();
  const narrator = useNarrator();
  const narrationEnabled = useSettingsStore((s) => s.narrationEnabled);
  const experimentMode = useSettingsStore((s) => s.experimentMode);
  const reserveGameSlotMutation = useReserveGameSlot();

  // Logging hook for data collection
  const logger = useLogger();

  // Role data (forgiving shape)
  const selectedRoleRaw = useRoleStore((s: any) => s.selectedRole);
  const genderRaw = useRoleStore((s: any) => s?.character?.gender);
  const roleBackgroundImage = useRoleStore((s) => s.roleBackgroundImage);
  const roleText: string =
    typeof selectedRoleRaw === "string"
      ? selectedRoleRaw
      : selectedRoleRaw?.label || selectedRoleRaw?.name || "";
  const gender: "male" | "female" | "any" =
    genderRaw === "male" || genderRaw === "female" ? genderRaw : "any";

  // Create role-based background style
  const roleBgStyle = useMemo(() => bgStyleWithRoleImage(roleBackgroundImage), [roleBackgroundImage]);

  // Get gender-aware translation keys
  const getGenderKey = (baseKey: string): string => {
    if (gender === "female") {
      return `${baseKey}_FEMALE`;
    } else if (gender === "male") {
      return `${baseKey}_MALE`;
    }
    // For "any" or undefined, use the base key (which defaults to male form)
    return baseKey;
  };

  const DEFAULT_LINE = useMemo(() => lang(getGenderKey("BACKGROUND_INTRO_DEFAULT_LINE")), [lang, gender]);

  const [phase, setPhase] = useState<Phase>("preparingDefault");
  const [para, setPara] = useState<string>("");
  const preparedDefaultRef = useRef<PreparedTTS | null>(null);
  const preparedIntroRef = useRef<PreparedTTS | null>(null);
  // prevent double-plays & track background readiness
  const defaultPlayedRef = useRef(false);
  const introPlayedRef = useRef(false);
  const bgReadyRef = useRef(false);
  const isMountedRef = useRef(true);
  const seedPromiseRef = useRef<Promise<void> | null>(null);
  const [defaultNarrationComplete, setDefaultNarrationComplete] = useState(false);
  // Track if we've logged the paragraph to avoid duplicate logs
  const paragraphLoggedRef = useRef(false);
  // Track if we're currently fetching the intro paragraph to prevent race condition
  const fetchingIntroRef = useRef(false);
  // Store prefetch AbortController so we can cancel it from onWake
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const [beginPending, setBeginPending] = useState(false);

  const waitForNarrativeMemory = useCallback(async (timeoutMs = 8000, pollIntervalMs = 100) => {
    const deadline = Date.now() + timeoutMs;
    let memory = useDilemmaStore.getState().narrativeMemory;
    while (!memory && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      memory = useDilemmaStore.getState().narrativeMemory;
    }
    return memory;
  }, []);


  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

// Narrative seeding removed - v2 system uses stateful conversation history instead
// The /api/game-turn-v2 endpoint builds narrative coherence through conversation state,
// eliminating the need for pre-seeded story threads

  // 2) Wake up → immediately transition to waitingForSeed phase
  const onWake = async () => {
    // Log player clicking "Wake up" button
    logger.log('button_click_wake_up', 'Wake up', 'User clicked Wake up button');

    // Reserve game slot if experiment mode is enabled
    if (experimentMode) {
      try {
        const result = await reserveGameSlotMutation.mutateAsync();
        
        if (!result.success) {
          // Redirect to capped screen if reservation failed
          push('/capped');
          return;
        }
      } catch (error) {
        console.error('[BackgroundIntro] Error reserving game slot:', error);
        // Redirect to capped screen on error
        push('/capped');
        return;
      }
    }

    // Cancel prefetch if still running to prevent race condition
    if (fetchingIntroRef.current && prefetchAbortRef.current) {
      console.log("[BackgroundIntro] Cancelling prefetch before foreground fetch");
      prefetchAbortRef.current.abort();
      fetchingIntroRef.current = false; // Reset flag immediately
      prefetchAbortRef.current = null;
    }

    // Immediately show loading state - the useEffect will handle the wait
    setPhase("waitingForSeed");
  };

  // 2.5) When in waitingForSeed phase, wait for narrative seeding to complete
  useEffect(() => {
    if (phase !== "waitingForSeed") return;

    (async () => {
      // Wait for narrative seeding if still in flight
      if (seedPromiseRef.current) {
        console.log("[BackgroundIntro] Waiting for narrative seed to complete...");
        try {
          await seedPromiseRef.current;
          console.log("[BackgroundIntro] Narrative seed resolved.");
        } catch (e: any) {
          console.warn("[BackgroundIntro] Narrative seed wait hit error:", e?.message || e);
        }
      }

      // After seed completes, transition to appropriate phase
      if (bgReadyRef.current && preparedIntroRef.current && para.trim()) {
        console.log("[BackgroundIntro] Intro paragraph ready from prefetch");
        setPhase("ready");
      } else {
        console.log("[BackgroundIntro] Need to fetch intro paragraph");
        setPhase("loading");
      }
    })();
  }, [phase, para]);

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
            setPara(lang(getGenderKey("BACKGROUND_INTRO_ERROR_MESSAGE")));
            setPhase("error");
            return;
          }
          const data = await r.json();
          const paragraph = (data?.paragraph || "").trim();
          if (!paragraph) {
            setPara(lang(getGenderKey("BACKGROUND_INTRO_ERROR_MESSAGE")));
            setPhase("error");
            return;
          }
          setPara(paragraph);
          setPhase("preparingIntro"); // buffer TTS before revealing
        } catch (e) {
          if ((e as any)?.name === "AbortError") return;
          console.warn("Intro generation error:", e);
          setPara(lang(getGenderKey("BACKGROUND_INTRO_ERROR_MESSAGE")));
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

  const handleBeginClick = useCallback(async () => {
    if (beginPending) {
      return;
    }

    console.log("[BackgroundIntro] Begin clicked");
    logger.log('button_click_begin', 'Begin', 'User clicked Begin button to start first day');

    setBeginPending(true);
    try {
      let memory = useDilemmaStore.getState().narrativeMemory;

      if (!memory) {
        console.log("[BackgroundIntro] Waiting for narrative memory before leaving intro screen…");
        memory = await waitForNarrativeMemory();
        if (memory) {
          console.log("[BackgroundIntro] Narrative memory ready; continuing to Day 1.");
        } else {
          console.warn("[BackgroundIntro] Narrative memory still missing after wait; proceeding as fallback.");
        }
      } else {
        console.log("[BackgroundIntro] Narrative memory already available; continuing immediately.");
      }

      useDilemmaStore.getState().clearHistory();
      console.log("[BackgroundIntro] Dilemma history cleared for new game");

      push("/event");
    } finally {
      if (isMountedRef.current) {
        setBeginPending(false);
      }
    }
  }, [beginPending, logger, push, waitForNarrativeMemory]);

  return (
    <div className="min-h-[100dvh] px-5 py-6" style={roleBgStyle}>
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
                {lang("BACKGROUND_INTRO_NIGHT_FALLS")}
              </h1>

              <p className="mt-3 text-white/80 bg-black/60 border border-amber-500/30 rounded-xl p-4">{DEFAULT_LINE}</p>

              <div className="mt-6">
                <button
                  className="w-[14rem] rounded-2xl px-4 py-3 text-base font-semibold bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                  onClick={onWake}
                >
                  {lang(getGenderKey("BACKGROUND_INTRO_WAKE_UP"))}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stage B: waiting for narrative seeding ---------------------------------- */}
        <AnimatePresence mode="wait">
          {phase === "waitingForSeed" && (
            <motion.div
              key="waitingForSeed"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-4"
            >
              <h2 className="text-lg font-medium text-white/80">
                {lang("BACKGROUND_INTRO_WEAVING_NARRATIVE")}
              </h2>
              <div className="mt-4 flex items-center gap-3 text-white/70">
                <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden />
                <span>
                  {lang("BACKGROUND_INTRO_PREPARING_STORY_ARC")}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stage C: loading indicator ---------------------------------------------- */}
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
                {phase === "loading" ? lang("BACKGROUND_INTRO_GATHERING_THREADS") : lang("BACKGROUND_INTRO_WARMING_VOICE")}
              </h2>
              <div className="mt-4 flex items-center gap-3 text-white/70">
                <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden />
                <span>
                  {phase === "loading"
                    ? lang("BACKGROUND_INTRO_SHAPING_MORNING").replace("{role}", roleText || lang("BACKGROUND_INTRO_YOUR_ROLE") || "your role")
                    : lang("BACKGROUND_INTRO_PREPARING_NARRATION")}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stage D: result (or error) --------------------------------------------- */}
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

            <p className="mt-3 text-white/80 whitespace-pre-wrap bg-black/60 border border-amber-500/30 rounded-xl p-4">{para}</p>

            <div className="mt-6">
              <button
                className="w-[14rem] rounded-2xl px-4 py-3 text-base font-semibold bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-300/60 disabled:opacity-70 disabled:cursor-wait"
                onClick={handleBeginClick}
                disabled={beginPending}
              >
                {beginPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span
                      className="h-4 w-4 rounded-full border-2 border-[#0b1335]/40 border-t-[#0b1335] animate-spin"
                      aria-hidden
                    />
                    {lang("BACKGROUND_INTRO_PREPARING_STORY")}
                  </span>
                ) : (
                  lang(getGenderKey("BACKGROUND_INTRO_BEGIN"))
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
