// src/screens/NameScreen.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { useRoleStore } from "../store/roleStore";
import { useSettingsStore } from "../store/settingsStore";
import type { Character } from "../store/roleStore";
import LoadingOverlay from "../components/LoadingOverlay";
import { motion } from "framer-motion";
import { getPredefinedCharacters } from "../data/predefinedCharacters";
import { useLogger } from "../hooks/useLogger";

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

// Loading overlay content (edit here later if you want)
const OVERLAY_TITLE = "Generating a character you can edit…";
const LOADING_QUOTES = [
  "Deciding whether your name should strike fear… or just mild confusion.",
  "Polishing your future autobiography’s opening line.",
  "Rolling dice to determine how photogenic your campaign portraits will be.",
  "Giving you a name history teachers will definitely mispronounce.",
  "Assigning you a birthplace that looks great on bumper stickers.",
  "Checking if your haircut is constitutionally appropriate.",
  "Balancing your charisma score against your ability to remember names.",
  "Selecting the font your name will appear in on scandalous headlines.",
  "Installing the dramatic pause before your full title is announced.",
  "Making sure your initials don’t spell something embarrassing.",
];

type Trio = {
  male: { name: string; prompt: string };
  female: { name: string; prompt: string };
  any: { name: string; prompt: string };
};

// Generic placeholders for custom roles (no API call needed)
const GENERIC_CHARACTERS: Trio = {
  male: {
    name: "James Anderson",
    prompt: "with a professional demeanor, confident expression, and well-groomed appearance"
  },
  female: {
    name: "Sarah Chen",
    prompt: "with a poised bearing, thoughtful gaze, and dignified presence"
  },
  any: {
    name: "Morgan Taylor",
    prompt: "with an approachable demeanor, intelligent eyes, and professional appearance"
  }
};

function extractPhysical(input: string): string {
  if (!input) return "";
  const i = input.indexOf(",");
  const trimmed = i >= 0 ? input.slice(i + 1) : input;
  return trimmed.trim().replace(/^with\s+/i, "");
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
  return role;
}

function suggestBackgroundObject(role = ""): string {
  const r = role.toLowerCase();
  if (r.includes("tang") || r.includes("china")) return "red pagoda";
  if (r.includes("rome") || r.includes("roman")) return "colosseum";
  if (r.includes("german") || r.includes("germany") || r.includes("chancellor") || r.includes("kanzler"))
    return "brandenburg gate";
  if (r.includes("egypt")) return "pyramids of giza";
  if (r.includes("japan") || r.includes("shogun")) return "torii gate";
  if (r.includes("viking")) return "drakkar longship";
  if (r.includes("mongol")) return "golden ger";
  return "ornate palace backdrop";
}

function buildFullPrompt(
  role: string,
  gender: "male" | "female" | "any",
  physical: string,
  bgObject: string
): string {
  const genderedRole = genderizeRole(role, gender);
  const genderWord = gender === "male" ? "male " : gender === "female" ? "female " : "";
  const subject = `a ${genderWord}${genderedRole}`.trim();
  const head = ["a fictional right-facing game avatar portrait of the face of", subject].join(" ");
  const physicalClean = physical.trim().replace(/^[,.\s]+/, "");
  const withPhysical = physicalClean ? `${head}, ${physicalClean}` : head;
  const bg = bgObject ? `, with a ${bgObject} in the background` : "";
  const tail = ", colored cartoon with strong lines";
  return `${withPhysical}${bg}${tail}`;
}


export default function NameScreen({ push }: { push: PushFn }) {
  const logger = useLogger();
  const selectedRole = useRoleStore((s) => s.selectedRole);
  const character = useRoleStore((s) => s.character);
  const setCharacter = useRoleStore((s) => s.setCharacter);
  const updateCharacter = useRoleStore((s) => s.updateCharacter);
  const generateImages = useSettingsStore((s) => s.generateImages);

  const [gender, setGender] = useState<"male" | "female" | "any">(character?.gender || "any");
  const [name, setName] = useState<string>(character?.name || "");
  const [physical, setPhysical] = useState<string>(character?.description || "");
  const [trio, setTrio] = useState<Trio | null>(null);
  const [bgObject, setBgObject] = useState<string>(character?.bgObject || "");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // New state for avatar generation and two-phase UI
  const [phase, setPhase] = useState<"input" | "avatar">("input");
  const [avatarUrl, setAvatarUrl] = useState<string>(character?.avatarUrl || "");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const avatarReqRef = useRef(0);

  const fullPrompt = useMemo(
    () => buildFullPrompt(selectedRole || "", gender, physical, bgObject),
    [selectedRole, gender, physical, bgObject]
  );

  async function loadSuggestions() {
    if (!selectedRole) return;
    setLoading(true);
    setErrorMsg("");

    try {
      // Check if we have predefined characters for this role
      const predefined = getPredefinedCharacters(selectedRole);

      if (predefined) {
        console.log("[NameScreen] Using predefined characters for role:", selectedRole);
        // Use predefined characters - no AI processing needed
        const data: Trio = {
          male: predefined.male,
          female: predefined.female,
          any: predefined.any
        };
        setTrio(data);
        const pick = data[gender] || data.any;
        setName(pick?.name || "");
        setPhysical(extractPhysical(pick?.prompt || ""));
        setBgObject((prev) => prev || suggestBackgroundObject(selectedRole));
      } else {
        console.log("[NameScreen] Using generic placeholders for custom role:", selectedRole);
        // Use generic placeholders for custom roles (no API call)
        const data: Trio = GENERIC_CHARACTERS;
        setTrio(data);
        const pick = data[gender] || data.any;
        setName(pick?.name || "");
        setPhysical(extractPhysical(pick?.prompt || ""));
        setBgObject((prev) => prev || suggestBackgroundObject(selectedRole));
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load character data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedRole) {
      push("/role");
      return;
    }
    loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!trio) return;
    const pick = trio[gender] || trio.any;
    setName(pick?.name || "");
    setPhysical(extractPhysical(pick?.prompt || ""));
    setBgObject((prev) => prev || suggestBackgroundObject(selectedRole || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, trio]);

  // Avatar generation logic (moved from CompassIntroStart)
  useEffect(() => {
    if (phase !== "avatar") return;
    if (!generateImages) return;
    if (avatarUrl) return; // already have one

    const prompt = fullPrompt.trim();
    if (!prompt) return;

    const req = ++avatarReqRef.current;
    const ac = new AbortController();
    (async () => {
      try {
        setAvatarLoading(true);
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
        // Handle error if needed
      } finally {
        if (req === avatarReqRef.current) setAvatarLoading(false);
      }
    })();

    return () => ac.abort();
  }, [phase, generateImages, fullPrompt, avatarUrl, updateCharacter]);

  // Calculate display avatar
  const displayAvatar = useMemo(() => {
    if (avatarUrl) return avatarUrl;
    if (!generateImages) return DEFAULT_AVATAR_DATA_URL;
    return "";
  }, [avatarUrl, generateImages]);

  const onContinue = () => {
    if (phase === "input") {
      // Phase 1: Clear any existing avatar and save character data, then move to avatar generation
      logger.log('button_click_create_character', {
        gender,
        name: name.trim(),
        descriptionLength: physical.trim().length,
        description: physical.trim()
      }, `User clicked Create Character - Name: ${name.trim()}, Gender: ${gender}`);

      const fullChar: Character = {
        gender,
        name: name.trim(),
        description: physical.trim(),
        avatarUrl: "", // Clear existing avatar to force regeneration
        imagePrompt: fullPrompt,
        bgObject,
      };
      setCharacter(fullChar);
      setAvatarUrl(""); // Clear local avatar state to force regeneration
      setPhase("avatar");
    } else {
      // Phase 2: Continue to power distribution
      logger.log('button_click_continue_to_power', {
        characterName: name,
        gender,
        hasAvatar: !!avatarUrl
      }, `User clicked Continue to power distribution`);

      push("/power");
    }
  };

  return (
    <div className="min-h-[100dvh] px-5 py-8" style={bgStyle}>
      <LoadingOverlay
        visible={loading || (phase === "avatar" && avatarLoading)}
        title={phase === "avatar" ? "Generating your avatar..." : OVERLAY_TITLE}
        quotes={LOADING_QUOTES}
      />

      <div className="w-full max-w-2xl mx-auto">
        <h1 className="sr-only">Forge Your Character</h1>

        {errorMsg && (
          <div className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 text-red-200 px-3 py-2" role="alert">
            {errorMsg}
            <button onClick={loadSuggestions} className="ml-3 underline decoration-red-300 hover:opacity-80">
              Try again
            </button>
          </div>
        )}

        <div className="mt-2 rounded-3xl p-6 bg-white/5 border border-white/10 shadow-xl">
          {phase === "input" ? (
            // Phase 1: Input form
            <>
              <div className="flex items-center gap-8 justify-center">
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="radio"
                    name="g"
                    className="accent-amber-300 focus:ring-2 focus:ring-amber-300/60"
                    checked={gender === "male"}
                    onChange={() => {
                      logger.log('character_gender_selection', { gender: 'male' }, 'User selected Male gender');
                      setGender("male");
                    }}
                  />
                  <span>Male</span>
                </label>
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="radio"
                    name="g"
                    className="accent-amber-300 focus:ring-2 focus:ring-amber-300/60"
                    checked={gender === "female"}
                    onChange={() => {
                      logger.log('character_gender_selection', { gender: 'female' }, 'User selected Female gender');
                      setGender("female");
                    }}
                  />
                  <span>Female</span>
                </label>
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="radio"
                    name="g"
                    className="accent-amber-300 focus:ring-2 focus:ring-amber-300/60"
                    checked={gender === "any"}
                    onChange={() => {
                      logger.log('character_gender_selection', { gender: 'any' }, 'User selected Any gender');
                      setGender("any");
                    }}
                  />
                  <span>Any</span>
                </label>
              </div>

              <div className="mt-6">
                <div className="text-white/90 mb-2">Name:</div>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    logger.log('character_name_input', { name: e.target.value }, `User entered character name: "${e.target.value}"`);
                  }}
                  placeholder="Character name"
                  className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                />
              </div>

              <div className="mt-6">
                <div className="text-white/90 mb-2">Description (mention any facial features and accessories you want present):</div>
                <textarea
                  rows={6}
                  value={physical}
                  onChange={(e) => {
                    setPhysical(e.target.value);
                    logger.log('character_description_input', {
                      descriptionLength: e.target.value.length,
                      description: e.target.value
                    }, `User entered character description`);
                  }}
                  placeholder="with a dignified expression, long black hair tied in a topknot, a finely groomed beard…"
                  className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                />
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  disabled={loading || !name.trim() || !physical.trim()}
                  onClick={onContinue}
                  className={`rounded-2xl px-5 py-3 font-semibold text-lg shadow-lg ${
                    !loading && name.trim() && physical.trim()
                      ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0b1335] hover:scale-[1.02] active:scale-[0.98]"
                      : "bg-white/10 text-white/60 cursor-not-allowed"
                  }`}
                >
                  Create Character
                </button>
              </div>
            </>
          ) : (
            // Phase 2: Avatar display
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center"
            >
              {displayAvatar && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="mb-6"
                >
                  <img
                    src={displayAvatar}
                    alt="Your character"
                    className="w-48 h-48 rounded-full object-cover border-4 border-amber-300/30 shadow-xl"
                  />
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-center mb-8"
              >
                <h2 className="text-2xl font-bold text-white mb-2">{name}</h2>
                <p className="text-white/70 text-sm">
                  {genderizeRole(selectedRole || "", gender)}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="flex justify-center"
              >
                <button
                  disabled={avatarLoading}
                  onClick={onContinue}
                  className={`rounded-2xl px-6 py-3 font-semibold text-lg shadow-lg ${
                    !avatarLoading
                      ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0b1335] hover:scale-[1.02] active:scale-[0.98]"
                      : "bg-white/10 text-white/60 cursor-not-allowed"
                  }`}
                >
                  Continue to power analysis
                </button>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
