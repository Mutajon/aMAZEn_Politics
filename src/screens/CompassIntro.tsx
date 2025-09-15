// src/screens/CompassIntro.tsx
import { useEffect, useState } from "react";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { useRoleStore } from "../store/roleStore";
import { motion, AnimatePresence } from "framer-motion";
import { AIConnectionError } from "../lib/validation";

export default function CompassIntro({ push }: { push: PushFn }) {
  const character = useRoleStore((s) => s.character);
  const setCharacter = useRoleStore((s) => s.setCharacter);

  const [error, setError] = useState("");

  useEffect(() => {
    if (!character) {
      push("/name");
      return;
    }
    if (character.avatarDataUrl) return; // already generated

    (async () => {
      try {
        setError("");
        const res = await fetch("/api/generate-avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: character.description }),
        });
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const j = await res.json();
            if (j?.error) msg = String(j.error);
          } catch {}
          throw new AIConnectionError(msg);
        }
        const data = await res.json();
        setCharacter({ ...character, avatarDataUrl: data.dataUrl });
      } catch (e: any) {
        setError(e instanceof AIConnectionError ? e.message : "Avatar generation failed");
      }
    })();
  }, [character, setCharacter, push]);

  return (
    <div className="min-h-[100dvh] px-5 py-8" style={bgStyle}>
      <div className="w-full max-w-xl mx-auto">
        <h1 className="text-3xl font-extrabold text-center bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
          Your Character
        </h1>

        <div className="mt-6 grid place-items-center">
          <div className="w-56 h-56 rounded-[28px] overflow-hidden shadow-xl border border-white/15 bg-white/5">
            {character?.avatarDataUrl ? (
              <img
                src={character.avatarDataUrl}
                alt="Character avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-white/70">Preparing avatar…</div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 text-red-200 px-3 py-2 text-center"
              role="alert"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
