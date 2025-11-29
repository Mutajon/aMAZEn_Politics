// src/hooks/useEventNarration.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useSettingsStore } from "../store/settingsStore";
import { useNarrator } from "./useNarrator";
import { narrationTextForDilemma } from "../lib/narration";
import { TTS_VOICE } from "../lib/ttsConfig";

type PreparedTTSHandle = { start: () => Promise<void>; dispose: () => void } | null;

export function useEventNarration() {
  const { current } = useDilemmaStore();
  const narrationEnabled = useSettingsStore((s) => s.narrationEnabled !== false);
  const { prepare: prepareNarration, speaking } = useNarrator();

  const preparedDilemmaRef = useRef<PreparedTTSHandle>(null);
  const dilemmaPlayedRef = useRef(false);
  const skipNarrationLogRef = useRef(false);
  const [canShowDilemma, setCanShowDilemma] = useState(false);

  // Prepare narration whenever the dilemma changes
  // IMPORTANT: Don't block dilemma display on TTS - show text immediately, let audio catch up
  useEffect(() => {
    const d = current;
    dilemmaPlayedRef.current = false;

    // cleanup previous audio
    preparedDilemmaRef.current?.dispose?.();
    preparedDilemmaRef.current = null;

    if (!d) {
      setCanShowDilemma(false);
      return;
    }

    // Show dilemma immediately - don't wait for TTS
    setCanShowDilemma(true);

    const speech = narrationTextForDilemma(d);
    if (!speech) {
      return;
    }

    // Skip TTS preparation if narration disabled
    if (!narrationEnabled) {
      if (!skipNarrationLogRef.current) {
        console.log("[EventNarration] Skipping TTS preparation (narration disabled)");
        skipNarrationLogRef.current = true;
      }
      return;
    }
    skipNarrationLogRef.current = false;

    // Prepare TTS in background (non-blocking)
    let cancelled = false;
    prepareNarration(speech, { voiceName: TTS_VOICE })
      .then(p => {
        if (cancelled) {
          p.dispose();
          return;
        }
        preparedDilemmaRef.current = p;
        // Auto-start if dilemma is already showing and hasn't been played yet
        if (!dilemmaPlayedRef.current) {
          dilemmaPlayedRef.current = true;
          p.start().catch((e) => console.warn("[Event] TTS start blocked:", e));
        }
      })
      .catch(e => console.warn("[Event] TTS prepare failed:", e));

    return () => {
      cancelled = true;
      preparedDilemmaRef.current?.dispose?.();
      preparedDilemmaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.title, current?.description, narrationEnabled, prepareNarration]);

  // Start narration when we reveal the dilemma (once) - controlled by reveal sequence
  // Note: TTS may still be preparing when this is called, so we mark it as "should play"
  // and the TTS preparation will auto-start when ready
  const startNarrationIfReady = useCallback((shouldShowDilemma: boolean = true) => {
    if (!canShowDilemma || !shouldShowDilemma) return;
    const p = preparedDilemmaRef.current;
    if (narrationEnabled && p && !dilemmaPlayedRef.current) {
      dilemmaPlayedRef.current = true;
      p.start().catch((e) => console.warn("[Event] TTS start blocked:", e));
    }
    // If TTS not ready yet, the preparation effect will auto-start when done
  }, [canShowDilemma, narrationEnabled]);

  // Check if we should show overlay while preparing TTS
  const overlayPreparing = !!current && !canShowDilemma;

  return {
    canShowDilemma,
    overlayPreparing,
    narrationEnabled,
    startNarrationIfReady,
    speaking, // Expose speaking state for tutorial timing
  };
}
