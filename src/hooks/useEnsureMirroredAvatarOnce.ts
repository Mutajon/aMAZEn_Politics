// src/hooks/useEnsureMirroredAvatarOnce.ts
// a hook that flips the player avatar, so that it most likely, will face to the left
// src/hooks/useEnsureMirroredAvatarOnce.ts
// Flips the character's avatar horizontally ONCE and saves it into the role store.
// If the image is cross-origin without CORS, we keep the original and just mark as "mirrored".

import { useEffect } from "react";
import { useRoleStore } from "../store/roleStore";

export function useEnsureMirroredAvatarOnce() {
  const character = useRoleStore((s) => s.character);
  const setCharacter = useRoleStore((s) => s.setCharacter);

  useEffect(() => {
    const url = character?.avatarUrl;

    // Nothing to do if:
    // - no character yet
    // - we've already mirrored
    // - no avatar URL yet
    if (!character || character.avatarMirrored || !url) return;

    const img = new Image();
    // If the image is remote and doesn't send CORS headers, toDataURL will fail.
    // We'll try with anonymous CORS and fall back gracefully.
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        // mirror horizontally
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        const flipped = canvas.toDataURL("image/png");
        setCharacter({ ...character, avatarUrl: flipped, avatarMirrored: true });
      } catch {
        // canvas likely tainted (no CORS) — keep original URL but mark as processed
        setCharacter({ ...character, avatarMirrored: true });
      }
    };

    img.onerror = () => {
      // If load fails, avoid retry loops
      setCharacter({ ...character, avatarMirrored: true });
    };

    img.src = url;
  }, [character, setCharacter]);
}

// Optional default export to be forgiving if someone imports default later.
export default useEnsureMirroredAvatarOnce;
