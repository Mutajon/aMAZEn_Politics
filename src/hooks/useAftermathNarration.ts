// src/hooks/useAftermathNarration.ts
// Handles narration for the remembrance section of the aftermath screen
//
// Manages:
// - Preparing TTS audio for remembrance text
// - Starting narration and waiting for completion via audio.onended
// - Notifying when narration completes to advance sequence
// - Stopping narration on skip
//
// Connects to:
// - src/hooks/useNarrator.ts: TTS system
// - src/hooks/useAftermathSequence.ts: sequence control
// - src/screens/AftermathScreen.tsx: main orchestrator

import { useState, useEffect, useRef, useCallback } from "react";
import { useSettingsStore } from "../store/settingsStore";
import { useNarrator } from "./useNarrator";

type PreparedTTSHandle = { start: () => Promise<void>; dispose: () => void } | null;

export function useAftermathNarration(remembranceText: string | undefined) {
  const narrationEnabled = useSettingsStore((s) => s.narrationEnabled !== false);
  const narrator = useNarrator();

  const preparedNarrationRef = useRef<PreparedTTSHandle>(null);
  const narrationPlayedRef = useRef(false);
  const completionCallbackRef = useRef<(() => void) | null>(null);
  const [canStartNarration, setCanStartNarration] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);

  // Prepare narration when remembrance text changes
  useEffect(() => {
    setCanStartNarration(false);
    narrationPlayedRef.current = false;

    // Cleanup previous audio
    preparedNarrationRef.current?.dispose?.();
    preparedNarrationRef.current = null;

    if (!remembranceText) return;

    let cancelled = false;
    (async () => {
      try {
        // Skip TTS preparation if narration disabled
        if (!narrationEnabled) {
          console.log('[AftermathNarration] Skipping TTS preparation (narration disabled)');
          setCanStartNarration(true);
          return;
        }

        console.log('[AftermathNarration] Preparing narration...');
        const p = await narrator.prepare(remembranceText, {
          voiceName: "onyx",
          format: "mp3"
          // No instructions - will use .env TTS_INSTRUCTIONS
        });
        if (cancelled) {
          p.dispose();
          return;
        }
        preparedNarrationRef.current = p;
        setCanStartNarration(true);
        console.log('[AftermathNarration] Narration ready');
      } catch (e) {
        console.warn("[AftermathNarration] TTS prepare failed:", e);
        setCanStartNarration(true); // Allow progression even if TTS fails
      }
    })();

    return () => {
      cancelled = true;
      preparedNarrationRef.current?.dispose?.();
      preparedNarrationRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remembranceText, narrationEnabled, narrator]);

  // Monitor narrator.speaking state to detect narration completion
  useEffect(() => {
    if (!isNarrating) return;

    // When narrator stops speaking, narration is complete
    if (!narrator.speaking && completionCallbackRef.current) {
      console.log('[AftermathNarration] Narration completed (detected via speaking state)');
      const callback = completionCallbackRef.current;
      completionCallbackRef.current = null;
      setIsNarrating(false);
      callback();
    }
  }, [narrator.speaking, isNarrating]);

  // Start narration and notify when complete
  const startNarration = useCallback(async (onComplete: () => void) => {
    console.log('[AftermathNarration] startNarration called', {
      canStart: canStartNarration,
      alreadyPlayed: narrationPlayedRef.current,
      enabled: narrationEnabled
    });

    if (!canStartNarration || narrationPlayedRef.current) {
      // If narration not ready or already played, complete immediately
      console.log('[AftermathNarration] Skipping narration (not ready or already played)');
      onComplete();
      return;
    }

    const p = preparedNarrationRef.current;

    if (!narrationEnabled || !p) {
      // If narration disabled or not available, complete immediately
      console.log('[AftermathNarration] Skipping narration (disabled or no prepared audio)');
      onComplete();
      return;
    }

    narrationPlayedRef.current = true;
    setIsNarrating(true);
    completionCallbackRef.current = onComplete;

    try {
      console.log('[AftermathNarration] Starting audio playback...');
      await p.start();
      console.log('[AftermathNarration] Audio playback started');

      // Completion will be handled by the useEffect watching narrator.speaking
      // However, as a fallback, also use estimated duration
      const wordCount = (remembranceText || "").split(/\s+/).length;
      const estimatedDuration = (wordCount / 150) * 60 * 1000; // Convert to milliseconds
      const fallbackDuration = estimatedDuration + 1000; // Add 1s buffer

      console.log('[AftermathNarration] Setting fallback timer for', fallbackDuration, 'ms');
      setTimeout(() => {
        if (completionCallbackRef.current) {
          console.log('[AftermathNarration] Fallback timer triggered completion');
          const callback = completionCallbackRef.current;
          completionCallbackRef.current = null;
          setIsNarrating(false);
          callback();
        }
      }, fallbackDuration);
    } catch (e) {
      console.warn("[AftermathNarration] TTS start blocked:", e);
      completionCallbackRef.current = null;
      setIsNarrating(false);
      onComplete(); // Continue even if narration fails
    }
  }, [canStartNarration, narrationEnabled, remembranceText, narrator.speaking]);

  // Stop narration (for skip)
  const stopNarration = useCallback(() => {
    console.log('[AftermathNarration] Stopping narration');
    narrator.stop();
    completionCallbackRef.current = null;
    setIsNarrating(false);
  }, [narrator]);

  return {
    canStartNarration,
    isNarrating,
    startNarration,
    stopNarration,
  };
}
