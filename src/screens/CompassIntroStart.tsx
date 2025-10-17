// src/screens/CompassIntroStart.tsx
import { useEffect, useState, useMemo, useRef } from "react";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { useRoleStore } from "../store/roleStore";
import { useSettingsStore } from "../store/settingsStore";
import { useNarrator, type PreparedTTS } from "../hooks/useNarrator";
import { motion, AnimatePresence } from "framer-motion";
import LoadingOverlay from "../components/LoadingOverlay";

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

// Loading quotes for the overlay
const LOADING_QUOTES = [
  "Preparing the mirror of self-discovery…",
  "Polishing reflective surfaces for maximum introspection…",
  "Calibrating the cosmic mirror for your political soul…",
  "Loading ancient wisdom about knowing thyself…",
  "Adjusting the looking glass for perfect clarity…",
  "Preparing your journey into the depths of conscience…",
];

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
  console.log("[CompassIntroStart] 🟢 Component rendered");

  const generateImages = useSettingsStore((s) => s.generateImages);
  const character = useRoleStore((s) => s.character);
  const selectedRole = useRoleStore((s) => s.selectedRole);

  console.log("[CompassIntroStart] Character data:", {
    name: character?.name,
    gender: character?.gender,
    hasAvatar: !!character?.avatarUrl
  });
  console.log("[CompassIntroStart] Selected role:", selectedRole);

  const [loading, setLoading] = useState(true);
  const [showImage, setShowImage] = useState(false);
  const [showText, setShowText] = useState(false);
  const [narrationReady, setNarrationReady] = useState(false);

  console.log("[CompassIntroStart] Current state:", { loading, showImage, showText, narrationReady });

  // Narration setup
  const { prepare } = useNarrator();
  const preparedTTSRef = useRef<PreparedTTS | null>(null);

  /** The URL we actually display, factoring in settings + fallback. */
  const displayAvatar = useMemo(() => {
    // If an avatar is already saved, always show it
    if (character?.avatarUrl) return character.avatarUrl;
    // If images are OFF and we don't have one, show placeholder
    if (!generateImages) return DEFAULT_AVATAR_DATA_URL;
    // If images are ON but we don't have one, show placeholder too (since generation happens in NameScreen now)
    return DEFAULT_AVATAR_DATA_URL;
  }, [character?.avatarUrl, generateImages]);

  const roleText = genderizeRole(trimEra(selectedRole || ""), character?.gender || "any");

  // Start narration preparation immediately on mount
  useEffect(() => {
    console.log("[CompassIntroStart] 🔵 useEffect triggered");
    console.log("[CompassIntroStart] character?.name:", character?.name);
    console.log("[CompassIntroStart] roleText:", roleText);

    if (!character?.name || !roleText) {
      console.warn("[CompassIntroStart] ⚠️ Missing required data - early return");
      console.warn("[CompassIntroStart] character?.name exists:", !!character?.name);
      console.warn("[CompassIntroStart] roleText exists:", !!roleText);
      return;
    }

    console.log("[CompassIntroStart] ✅ Required data present, proceeding with narration");

    const narrationText = `Welcome ${character.name}. It is the night before your first day as ${roleText}. A package arrives with no return address, only the words: Know Thyself. Inside, a mirror—black, breathless, waiting.`;

    const prepareAndStartNarration = async () => {
      try {
        console.log("[CompassIntroStart] 🎤 Preparing narration");
        const prepared = await prepare(narrationText);
        preparedTTSRef.current = prepared;

        // Start narration immediately when ready
        if (!prepared.disposed()) {
          console.log("[CompassIntroStart] 🔊 Starting narration");
          await prepared.start();
        }

        console.log("[CompassIntroStart] ✅ Narration complete, revealing content");
        // Only after narration is ready, start the reveal sequence
        setLoading(false);
        setShowImage(true);
        setTimeout(() => setShowText(true), 600);
        setTimeout(() => setNarrationReady(true), 1200);
      } catch (error) {
        console.error("[CompassIntroStart] ❌ Narration preparation failed:", error);
        // If narration fails, still allow progression
        console.log("[CompassIntroStart] 🔧 Falling back to no-narration mode");
        setLoading(false);
        setShowImage(true);
        setTimeout(() => setShowText(true), 600);
        setTimeout(() => setNarrationReady(true), 1200);
      }
    };

    prepareAndStartNarration();

    // Cleanup on unmount
    return () => {
      console.log("[CompassIntroStart] 🔴 useEffect cleanup - component unmounting");
      if (preparedTTSRef.current) {
        preparedTTSRef.current.dispose();
        preparedTTSRef.current = null;
      }
    };
  }, [character?.name, roleText, prepare]);

  return (
    <div className="min-h-[100dvh] px-5 py-6" style={bgStyle}>
      <LoadingOverlay visible={loading} title="Know Thyself…" quotes={LOADING_QUOTES} />

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
                <span className="font-semibold">{roleText}</span>. A package arrives with no return address, only the words:{" "}
                <span className="font-extrabold text-amber-300">Know Thyself</span>.
              </p>
              <p className="mt-3">Inside, a mirror—black, breathless, waiting.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex justify-center">
          <AnimatePresence>
            {narrationReady && (
              <motion.button
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 8 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                onClick={() => push("/compass-mirror")}
                className="rounded-2xl px-5 py-3 font-semibold text-lg shadow-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0b1335] hover:scale-[1.02] active:scale-[0.98]"
              >
                Look in the mirror
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
