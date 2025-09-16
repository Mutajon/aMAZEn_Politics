// src/screens/CompassIntro.tsx
import { useEffect, useRef, useState } from "react";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { useRoleStore } from "../store/roleStore";
import LoadingOverlay from "../components/LoadingOverlay";
import { motion } from "framer-motion";

export default function CompassIntro({ push }: { push: PushFn }) {
  // Pull what we need from the store
  const character = useRoleStore((s) => s.character);
  const updateCharacter = useRoleStore((s) => s.updateCharacter);

  // Mirror store avatar locally for instant UI updates
  const [avatarUrl, setAvatarUrl] = useState<string>(character?.avatarUrl || "");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // StrictMode/fast nav guard
  const avatarReqRef = useRef(0);

  const avatarQuotes = [
    "Great faces take great pixels.",
    "Applying heroic jawline filter…",
    "Double-checking cheekbone symmetry…",
    "No text, just vibes, promise.",
    "Polishing the background glow…",
  ];

  // If user arrives without a description, send them back to Name screen
  useEffect(() => {
    if (!character?.description) push("/name");
  }, [character?.description, push]);

  // Generate avatar exactly once per description (unless Try again)
  useEffect(() => {
    const prompt = character?.description?.trim();
    if (!prompt) return;
    if (avatarUrl) return; // already have one

    const req = ++avatarReqRef.current;
    const ac = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        const res = await fetch("/api/generate-avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
          signal: ac.signal,
        });
        const data = await res.json();
        if (!res.ok || !data?.dataUrl) throw new Error(data?.error || res.statusText);

        if (req !== avatarReqRef.current) return; // stale

        // Update both local state and the store
        setAvatarUrl(data.dataUrl);
        updateCharacter({ avatarUrl: data.dataUrl });
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        if (req !== avatarReqRef.current) return;
        setErrorMsg(e?.message || "Avatar generation failed");
      } finally {
        if (req === avatarReqRef.current) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [character?.description, avatarUrl, updateCharacter]);

  const tryAgain = () => {
    setAvatarUrl("");
    updateCharacter({ avatarUrl: "" });
  };

  return (
    <div className="min-h-[100dvh] px-5 py-8" style={bgStyle}>
      <div className="w-full max-w-xl mx-auto">
        <h1 className="text-4xl font-extrabold text-center bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
          Your Character
        </h1>

        {/* Avatar box */}
        <div className="mt-8 grid place-items-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-[280px] h-[280px] rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-sm shadow-xl overflow-hidden grid place-items-center"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Character avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="text-white/80">Preparing avatar…</div>
            )}
          </motion.div>
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="mt-6 rounded-xl border border-red-400/40 bg-red-500/10 text-red-200 px-3 py-2" role="alert">
            {errorMsg}
            <button onClick={tryAgain} className="ml-3 underline decoration-red-300 hover:opacity-80">
              Try again
            </button>
          </div>
        )}

        {/* Continue CTA (adjust the route when you know the next step) */}
        <div className="mt-8 flex justify-center">
          <button
            disabled={!avatarUrl}
            onClick={() => push("/next")} // TODO: replace with your next route
            className={`rounded-2xl px-5 py-3 font-semibold text-lg shadow-lg ${
              avatarUrl
                ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0b1335] hover:scale-[1.02] active:scale-[0.98]"
                : "bg-white/10 text-white/60 cursor-not-allowed"
            }`}
          >
            Continue →
          </button>
        </div>
      </div>

      {/* Sleek overlay while generating */}
      <LoadingOverlay visible={loading} title="Preparing avatar…" quotes={avatarQuotes} periodMs={3000} />
    </div>
  );
}
