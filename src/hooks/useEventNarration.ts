// src/hooks/useEventNarration.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useSettingsStore } from "../store/settingsStore";
import { useNarrator } from "./useNarrator";
import { narrationTextForDilemma } from "../lib/narration";

type PreparedTTSHandle = { start: () => Promise<void>; dispose: () => void } | null;

export function useEventNarration() {
  const { current } = useDilemmaStore();
  const narrationEnabled = useSettingsStore((s) => s.narrationEnabled !== false);
  const narrator = useNarrator();

  const preparedDilemmaRef = useRef<PreparedTTSHandle>(null);
  const dilemmaPlayedRef = useRef(false);
  const [canShowDilemma, setCanShowDilemma] = useState(false);

  // Prepare narration whenever the dilemma changes
  useEffect(() => {
    const d = current;
    setCanShowDilemma(false);
    dilemmaPlayedRef.current = false;

    // cleanup previous audio
    preparedDilemmaRef.current?.dispose?.();
    preparedDilemmaRef.current = null;

    if (!d) return;

    let cancelled = false;
    (async () => {
      try {
        const speech = narrationTextForDilemma(d);
        if (!speech) {
          setCanShowDilemma(true);
          return;
        }
        const p = await narrator.prepare(speech, { voiceName: "alloy", format: "mp3" });
        if (cancelled) {
          p.dispose();
          return;
        }
        preparedDilemmaRef.current = p;
        setCanShowDilemma(true);
      } catch (e) {
        console.warn("[Event] TTS prepare failed; showing without audio:", e);
        setCanShowDilemma(true);
      }
    })();

    return () => {
      cancelled = true;
      preparedDilemmaRef.current?.dispose?.();
      preparedDilemmaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.title, current?.description]);

  // Start narration when we reveal the dilemma (once) - controlled by reveal sequence
  const startNarrationIfReady = useCallback((shouldShowDilemma: boolean = true) => {
    if (!canShowDilemma || !shouldShowDilemma) return;
    const p = preparedDilemmaRef.current;
    if (narrationEnabled && p && !dilemmaPlayedRef.current) {
      dilemmaPlayedRef.current = true;
      p.start().catch((e) => console.warn("[Event] TTS start blocked:", e));
    }
  }, [canShowDilemma, narrationEnabled]);

  // Auto-start narration for first day (when no reveal sequence is controlling it)
  useEffect(() => {
    if (!canShowDilemma) return;
    const p = preparedDilemmaRef.current;
    if (narrationEnabled && p && !dilemmaPlayedRef.current) {
      // Add a small delay to ensure this runs after the manual trigger would have run
      const timer = setTimeout(() => {
        if (!dilemmaPlayedRef.current) {
          dilemmaPlayedRef.current = true;
          p.start().catch((e) => console.warn("[Event] TTS start blocked:", e));
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [canShowDilemma, narrationEnabled]);

  // Check if we should show overlay for fallback dilemmas
  const overlayPreparing =
    (!!current && !canShowDilemma) || (!!(current as any)?._isFallback === true);

  return {
    canShowDilemma,
    overlayPreparing,
    narrationEnabled,
    startNarrationIfReady,
  };
}