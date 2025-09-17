// src/screens/CompassIntroStart.tsx
import { useEffect, useRef, useState, useMemo } from "react";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { useRoleStore } from "../store/roleStore";
import { useSettingsStore } from "../store/settingsStore";
import LoadingOverlay from "../components/LoadingOverlay";
import { motion, AnimatePresence } from "framer-motion";

/** Small built-in placeholder (no asset file needed). */
const DEFAULT_AVATAR_DATA_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512' viewBox='0 0 128 128'>
      <defs>
        <linearGradient id='g' x1='0' x2='0' y1='0' y2='1'>
          <stop offset='0' stop-color='#EAB308'/>
          <stop offset='1' stop-color='#FDE68A'/>
        </linearGradient>
      </defs>
      <rect x='0' y='0' width='128' height='128' rx='24' fill='url(#g)'/>
      <circle cx='64' cy='50' r='22' fill='rgba(0,0,0,0.25)'/>
      <rect x='26' y='78' width='76' height='30' rx='14' fill='rgba(0,0,0,0.25)'/>
    </svg>`
  );

function trimEra(role: string): string {
  return (role || "").replace(/\s*[—–-].*$/u, "").trim();
}
function genderizeRole(role: string, gender: "male" | "female" | "any"): string {
  const r = (role || "").trim().toLowerCase();
  const map: Record<string, { male: string; female: string }> = {
    emperor: { male: "Emperor of", female: "Empress of" },
    king: { male: "King of", female: "Queen of" },
    prince: { male: "Prince of", female: "Princess of" },
    hero: { male: "Hero of", female: "Heroine of" },
    monk: { male: "Monk of", female: "Nun of" },
    lord: { male: "Lord of", female: "Lady of" },
    duke: { male: "Duke of", female: "Duchess of" },
    tsar: { male: "Tsar of", female: "Tsarina of" },
    pharaoh: { male: "Pharaoh of", female: "Pharaoh of" },
    chancellor: { male: "Chancellor of", female: "Chancellor of" },
    kanzler: { male: "Kanzler von", female: "Kanzlerin von" },
  };
  for (const key of Object.keys(map)) {
    if (r.startsWith(key)) {
      const rest = role.slice(key.length).trim();
      const pair = map[key];
      if (gender === "female") return `${pair.female} ${rest}`.trim();
      return `${pair.male} ${rest}`.trim();
    }
  }
  return role || "your new role";
}

export default function CompassIntroStart({ push }: { push: PushFn }) {
  const generateImages = useSettingsStore((s) => s.generateImages);

  const character = useRoleStore((s) => s.character);
  const selectedRole = useRoleStore((s) => s.selectedRole);
  const updateCharacter = useRoleStore((s) => s.updateCharacter);

  const [avatarUrl, setAvatarUrl] = useState<string>(character?.avatarUrl || "");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [showImage, setShowImage] = useState(false);
  const [showText, setShowText] = useState(false);

  const avatarReqRef = useRef(0);

  /** The URL we actually display, factoring in settings + fallback. */
  const displayAvatar = useMemo(() => {
    // A) If an avatar is already saved, always show it (your preference A)
    if (avatarUrl) return avatarUrl;
    // B) If images are OFF and we don't have one, show placeholder
    if (!generateImages) return DEFAULT_AVATAR_DATA_URL;
    // C) If images are ON and we don't have one yet, we’ll show a “preparing” state until generated
    return "";
  }, [avatarUrl, generateImages]);

  // generate avatar if enabled and needed
  useEffect(() => {
    const prompt = (character?.imagePrompt || character?.description || "").trim();
    if (!generateImages) return; // images disabled → skip fetching
    if (!prompt || avatarUrl) return;

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
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !(data as any)?.dataUrl) {
          throw new Error((data as any)?.error || `HTTP ${res.status}`);
        }
        if (req !== avatarReqRef.current) return;
        setAvatarUrl((data as any).dataUrl);
        updateCharacter({ avatarUrl: (data as any).dataUrl });
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setErrorMsg(e?.message || "Avatar generation failed");
        }
      } finally {
        if (req === avatarReqRef.current) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [generateImages, character?.imagePrompt, character?.description, avatarUrl, updateCharacter]);

  // staged reveal: use the actual thing we’re displaying (avatar or placeholder)
  useEffect(() => {
    if (!displayAvatar) return;
    setShowImage(true);
    const t = setTimeout(() => setShowText(true), 900);
    return () => clearTimeout(t);
  }, [displayAvatar]);

  const roleText = genderizeRole(trimEra(selectedRole || ""), character?.gender || "any");

  return (
    <div className="min-h-[100dvh] px-5 py-6" style={bgStyle}>
      <div className="w-full max-w-xl mx-auto">
        <div className="relative mt-2 grid place-items-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: showImage ? 1 : 0, y: showImage ? 0 : 8, x: 0, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="w-[280px] h-[280px] rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-sm shadow-xl overflow-hidden grid place-items-center relative"
          >
            {displayAvatar ? (
              <motion.img
                key={displayAvatar}
                src={displayAvatar}
                alt="Character avatar"
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              />
            ) : (
              <div className="text-white/80">Preparing avatar…</div>
            )}
          </motion.div>
        </div>

        <AnimatePresence>
          {showText && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="mt-5 text-center text-white/90 leading-relaxed"
            >
              <p className="text-lg">Welcome {character?.name || "Player"},</p>
              <p className="mt-3">
                It is the night before your first day as{" "}
                <span className="font-semibold">{roleText}</span>. A package arrives with no return, only the words:{" "}
                <span className="font-extrabold text-amber-300">Know Thyself</span>.
              </p>
              <p className="mt-3">Inside, a mirror—black, breathless, waiting.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex justify-center">
          <motion.button
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            onClick={() => push("/compass-mirror")}
            className="rounded-2xl px-5 py-3 font-semibold text-lg shadow-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0b1335] hover:scale-[1.02] active:scale-[0.98]"
          >
            Look in the mirror
          </motion.button>
        </div>
      </div>

      {/* Only show the loader when images are ON */}
      <LoadingOverlay
        visible={generateImages && loading}
        title="Preparing avatar…"
        quotes={[
          "Great faces take great pixels.",
          "Applying heroic jawline filter…",
          "Double-checking cheekbone symmetry…",
          "No text, just vibes, promise.",
          "Polishing the background glow…",
        ]}
        periodMs={3000}
      />
    </div>
  );
}
