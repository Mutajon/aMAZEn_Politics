// src/lib/sfx.ts
// Tiny, reusable sound helper for short UI SFX (clicks, chimes, etc.)

export type SfxOptions = {
    volume?: number;     // 0..1
    cooldownMs?: number; // minimal gap between plays to avoid spam
  };
  
  /**
   * Prepares an Audio-backed SFX player with cooldown + error safety.
   * Returns a play() function you can call and forget.
   */
  export function makeSfx(url: string, opts: SfxOptions = {}) {
    const volume = Math.max(0, Math.min(1, opts.volume ?? 1));
    const cooldownMs = Math.max(0, opts.cooldownMs ?? 250);
  
    // Preload a primary element (most browsers will lazy-load until play()).
    let lastPlay = 0;
    const base = new Audio(url);
    base.preload = "auto";
    base.volume = volume;
  
    return async function play(): Promise<void> {
      const now = Date.now();
      if (now - lastPlay < cooldownMs) return; // cooldown guard
      lastPlay = now;
  
      try {
        // If base is currently playing, clone so overlapping plays don’t cut off.
        const el = base.paused ? base : base.cloneNode(true) as HTMLAudioElement;
        el.volume = volume;
        await el.play();
      } catch {
        // Autoplay policy or user-gesture required; ignore silently.
        // (First user click anywhere will allow future plays.)
      }
    };
  }
  
  /** App-specific SFX: pills chime (change the path if your public URL differs). */
  export const playPillsChime = makeSfx(
    // If your file lives in the public "assets/sounds" folder, this path is right.
    // Adjust to "/sounds/achievementsChimeShort.mp3" if that's your public path.
    "/assets/sounds/achievementsChimeShort.mp3",
    { volume: 0.7, cooldownMs: 400 }
  );
  