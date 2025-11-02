// src/hooks/useNarrator.ts
// OpenAI-backed TTS narrator with "prepare()" for exact A/V sync.
// - prepare(text) → returns a Prepared handle that resolves once audio is fully buffered
//   (canplaythrough). You decide exactly when to start() it (e.g., on fade-in start).
// - speak(text) is kept for convenience (prepare + start immediately).
// - prime() should be called from a user gesture (Splash "Start!") to unlock mobile audio.
// - All requests go to /api/tts on your server; the API key never touches the client.

import { useCallback, useState } from "react";
import { useSettingsStore } from "../store/settingsStore";

type SpeakOptions = {
  voiceName?: string;           // OpenAI voice name; default "alloy"
  format?: "mp3" | "opus" | "aac" | "flac";
  volume?: number;              // 0..1
};

export type PreparedTTS = {
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

export function useNarrator() {
  const { narrationEnabled } = useSettingsStore();
  const [speaking, setSpeaking] = useState(false);

  const _cleanup = useCallback(() => {
    try { globalAudioRef?.pause?.(); } catch {}
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
    _cleanup();
  }, [_cleanup]);

  // Prime audio on a user gesture (iOS/Safari autoplay policies)
  const prime = useCallback(() => {
    try {
      const a = new Audio();
      a.preload = "auto";
      // a silent play/pause to unlock
      a.play().then(() => a.pause()).catch(() => {});
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
    async (text: string, opts: SpeakOptions = {}): Promise<PreparedTTS> => {
      if (!text?.trim()) {
        // return a no-op that behaves like "already ready"
        return {
          start: async () => {},
          dispose: () => {},
          disposed: () => true,
        };
      }

      if (!narrationEnabled) {
        // narration off → don't block UI; provide a no-op that is "ready"
        return {
          start: async () => {},
          dispose: () => {},
          disposed: () => true,
        };
      }

      // Any previous in-flight fetch/audio is canceled
      _cleanup();
      globalAbortRef = new AbortController();

      const voice = (opts.voiceName || "alloy").toLowerCase();
      const format = opts.format || "mp3";
      const volume = typeof opts.volume === "number" ? Math.max(0, Math.min(1, opts.volume)) : 1;

      log("prepare() fetch /api/tts … voice =", voice, "format =", format);
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, format }),
        signal: globalAbortRef.signal,
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`Server TTS error ${r.status}: ${t}`);
      }

      const buf = await r.arrayBuffer();
      const type =
        format === "aac" ? "audio/aac" :
        format === "flac" ? "audio/flac" :
        format === "opus" ? "audio/ogg" :
        "audio/mpeg";
      const blob = new Blob([buf], { type });
      const url = URL.createObjectURL(blob);

      globalObjectUrlRef = url;
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.volume = volume;

      // Wait for 'canplaythrough' so we know the buffer is ready
      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          audio.removeEventListener("canplaythrough", onReady);
          audio.removeEventListener("error", onErr);
          resolve();
        };
        const onErr = () => {
          audio.removeEventListener("canplaythrough", onReady);
          audio.removeEventListener("error", onErr);
          reject(new Error("Audio element error"));
        };
        audio.addEventListener("canplaythrough", onReady, { once: true });
        audio.addEventListener("error", onErr, { once: true });
        // Nudge the decoder on some browsers
        audio.load();
      });

      let disposed = false;

      const start = async () => {
        if (disposed) return;
        // register as the active audio in global ref
        globalAudioRef = audio;
        audio.onplay = () => { setSpeaking(true); log("play start"); };
        audio.onended = () => { setSpeaking(false); log("play end"); };
        audio.onerror = (e) => { setSpeaking(false); console.warn("[Narrator/OAI] audio error", e); };
        await audio.play();
      };

      const dispose = () => {
        if (disposed) return;
        disposed = true;
        try { audio.pause(); } catch {}
        audio.src = "";
        if (globalObjectUrlRef) {
          URL.revokeObjectURL(globalObjectUrlRef);
          globalObjectUrlRef = null;
        }
      };

      return { start, dispose, disposed: () => disposed };
    },
    [narrationEnabled, _cleanup]
  );

  // Convenience: prepare + start immediately (no strict sync with UI)
  const speak = useCallback(
    async (text: string, opts: SpeakOptions = {}) => {
      const p = await prepare(text, opts);
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
    setPreferredVoice: () => {}, // no-op; we pass voice per call
  };
}
