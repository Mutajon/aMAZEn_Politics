// src/hooks/useNarrator.ts
// Gemini-backed TTS narrator with "prepare()" for exact A/V sync.
// - prepare(text) → returns a Prepared handle that resolves once audio has enough data to play
//   (canplay). You decide exactly when to start() it (e.g., on fade-in start).
// - speak(text) is kept for convenience (prepare + start immediately).
// - prime() should be called from a user gesture (Splash "Start!") to unlock mobile audio.
// - All requests go to /api/tts on your server; the API key never touches the client.

import { useCallback, useState } from "react";

type PreparedTTS = {
  /** starts playback; resolves when play() settles (may throw if blocked) */
  start: () => Promise<void>;
  /** stops playback immediately and frees resources */
  dispose: () => void;
  /** true if already disposed */
  disposed: () => boolean;
};

const log = (...a: unknown[]) => console.log("[Narrator/OAI]", ...a);

// Global refs shared across all useNarrator instances
// This allows any component to stop the currently playing narration
let globalAudioRef: HTMLAudioElement | null = null;
let globalObjectUrlRef: string | null = null;
let globalAbortRef: AbortController | null = null;
let globalIsPlayingRef = false;

export function useNarrator() {
  const [speaking, setSpeaking] = useState(false);

  const _cleanup = useCallback(() => {
    // Smart cleanup: Don't interrupt actively playing audio
    if (globalIsPlayingRef) {
      log("_cleanup() skipped - audio is actively playing");
      return;
    }

    try { globalAudioRef?.pause?.(); } catch { }
    globalAudioRef = null;

    if (globalObjectUrlRef) {
      URL.revokeObjectURL(globalObjectUrlRef);
      globalObjectUrlRef = null;
    }
    if (globalAbortRef) {
      globalAbortRef.abort();
      globalAbortRef = null;
    }
    setSpeaking(false);
  }, []);

  const stop = useCallback(() => {
    log("stop()");
    globalIsPlayingRef = false; // Force stop regardless of playing state
    _cleanup();
  }, [_cleanup]);

  // Prime audio on a user gesture (iOS/Safari autoplay policies)
  const prime = useCallback(() => {
    try {
      const a = new Audio();
      a.preload = "auto";
      // a silent play/pause to unlock
      a.play().then(() => a.pause()).catch(() => { });
      log("prime() done");
    } catch (e) {
      log("prime() error:", e);
    }
  }, []);

  /**
   * Prepare an audio buffer for precise sync.
   * Resolves only after the audio element fires 'canplaythrough'.
   * If narration is disabled, returns a no-op Prepared that resolves immediately.
   */
  const prepare = useCallback(
    async (text: string): Promise<PreparedTTS> => {
      if (!text?.trim()) {
        // return a no-op that behaves like "already ready"
        return {
          start: async () => { },
          dispose: () => { },
          disposed: () => true,
        };
      }

      // ALL TTS TEMPORARILY DISABLED PER USER REQUEST
      return {
        start: async () => { },
        dispose: () => { },
        disposed: () => true,
      };
    },
    [_cleanup]
  );

  // Convenience: prepare + start immediately (no strict sync with UI)
  const speak = useCallback(
    async (text: string) => {
      const p = await prepare(text);
      try {
        await p.start();
      } catch (e) {
        console.warn("[Narrator/OAI] autoplay blocked or error:", e);
      }
    },
    [prepare]
  );

  return {
    supportsTTS: true,
    speaking,
    prepare,
    speak,
    stop,
    prime,
    setPreferredVoice: () => { }, // no-op; we pass voice per call
  };
}
