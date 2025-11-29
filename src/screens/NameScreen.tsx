// src/screens/NameScreen.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import type { PushFn } from "../lib/router";
import { bgStyleWithRoleImage } from "../lib/ui";
import { useRoleStore } from "../store/roleStore";
import { useSettingsStore } from "../store/settingsStore";
import { useLang } from "../i18n/lang";
import { useTranslatedConst, createTranslatedConst } from "../i18n/useTranslatedConst";
import type { Character } from "../store/roleStore";
import LoadingOverlay from "../components/LoadingOverlay";
import { motion } from "framer-motion";
import { getPredefinedRole } from "../data/predefinedRoles";
import { useLogger } from "../hooks/useLogger";
import { useNavigationGuard } from "../hooks/useNavigationGuard";
import { audioManager } from "../lib/audioManager";

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
// Will be defined inside component to access lang function

type Trio = {
  male: { nameKey: string; promptKey: string };
  female: { nameKey: string; promptKey: string };
  any: { nameKey: string; promptKey: string };
};

// Generic placeholders for custom roles (no API call needed)
// Will be defined inside component to access lang function

// Generic characters for custom roles (using i18n keys)
const GENERIC_CHARACTERS: Trio = {
  male: {
    nameKey: "GENERIC_MALE_NAME",
    promptKey: "GENERIC_MALE_PROMPT"
  },
  female: {
    nameKey: "GENERIC_FEMALE_NAME",
    promptKey: "GENERIC_FEMALE_PROMPT"
  },
  any: {
    nameKey: "GENERIC_ANY_NAME",
    promptKey: "GENERIC_ANY_PROMPT"
  }
};

const LOADING_QUOTES = createTranslatedConst((lang) => [
  lang("LOADING_QUOTE_1"),
  lang("LOADING_QUOTE_2"),
  lang("LOADING_QUOTE_3"),
  lang("LOADING_QUOTE_4"),
  lang("LOADING_QUOTE_5"),
  lang("LOADING_QUOTE_6"),
  lang("LOADING_QUOTE_7"),
  lang("LOADING_QUOTE_8"),
  lang("LOADING_QUOTE_9"),
  lang("LOADING_QUOTE_10"),
]);

const OVERLAY_TITLE = createTranslatedConst((lang) => lang("GENERATING_CHARACTER"));

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
  // Existing mappings
  if (r.includes("tang") || r.includes("china")) return "red pagoda";
  if (r.includes("rome") || r.includes("roman")) return "colosseum";
  if (r.includes("german") || r.includes("germany") || r.includes("chancellor") || r.includes("kanzler"))
    return "brandenburg gate";
  if (r.includes("egypt") || r.includes("alexandria")) return "pyramids of giza";
  if (r.includes("japan") || r.includes("shogun")) return "torii gate";
  if (r.includes("viking")) return "drakkar longship";
  if (r.includes("mongol")) return "golden ger";
  // New mappings for predefined roles
  if (r.includes("athens") || r.includes("greek") || r.includes("greece")) return "parthenon";
  if (r.includes("florence") || r.includes("italy") || r.includes("medici")) return "florentine duomo";
  if (r.includes("america") || r.includes("colonial") || r.includes("jamestown")) return "wooden colonial fort";
  if (r.includes("haiti") || r.includes("caribbean") || r.includes("saint-domingue")) return "tropical plantation";
  if (r.includes("russia") || r.includes("russian") || r.includes("tsar") || r.includes("czar")) return "kremlin";
  if (r.includes("india") || r.includes("indian") || r.includes("gandhi") || r.includes("nehru")) return "taj mahal";
  if (r.includes("africa") || r.includes("apartheid") || r.includes("mandela")) return "table mountain";
  if (r.includes("mars") || r.includes("colony") || r.includes("2179")) return "red martian domes";
  return "ornate palace backdrop";
}

/**
 * Derives era/setting context for image generation prompt.
 * Uses grounding.era if available (from AI analysis), otherwise falls back to role name + year.
 */
function deriveEraSetting(role: string, year: string | null, era: string | undefined): string {
  // Use grounding.era if available (most descriptive)
  if (era) {
    // Extract just the period part, e.g., "431 BCE Athens" from "431 BCE Athens (outbreak...)"
    const cleaned = era.replace(/\s*\([^)]*\)/g, '').trim();
    return cleaned || "historical period";
  }

  // Fallback: construct from role name + year
  const r = role.toLowerCase();
  if (r.includes("athens") || r.includes("greece")) return `ancient Greece${year ? `, ${year.replace('-', '')} BCE` : ''}`;
  if (r.includes("alexandria") || r.includes("egypt")) return `ancient Alexandria${year ? `, ${year.replace('-', '')} BCE` : ''}`;
  if (r.includes("florence") || r.includes("italy")) return `Renaissance Florence${year ? `, ${year} CE` : ''}`;
  if (r.includes("japan") || r.includes("shogun")) return `feudal Japan${year ? `, ${year} CE` : ''}`;
  if (r.includes("america") || r.includes("colonial") || r.includes("jamestown")) return `colonial North America${year ? `, ${year} CE` : ''}`;
  if (r.includes("haiti") || r.includes("saint-domingue")) return `colonial Haiti${year ? `, ${year} CE` : ''}`;
  if (r.includes("russia") || r.includes("tsar")) return `imperial Russia${year ? `, ${year} CE` : ''}`;
  if (r.includes("india") || r.includes("gandhi")) return `British India${year ? `, ${year} CE` : ''}`;
  if (r.includes("africa") || r.includes("mandela")) return `South Africa${year ? `, ${year} CE` : ''}`;
  if (r.includes("mars") || r.includes("2179")) return `Mars colony${year ? `, ${year} CE` : ''}`;

  // Generic fallback
  return year ? `year ${year}` : "historical setting";
}

function buildFullPrompt(
  role: string,
  gender: "male" | "female" | "any",
  physical: string,
  bgObject: string,
  eraSetting: string,
  roleDescription: string | null
): string {
  // Clean the role name - strip "— Subtitle (-year)" patterns
  const cleanRole = role
    .replace(/\s*—.*$/, '')           // Remove "— Shadows of War"
    .replace(/\s*\([^)]*\)/g, '')     // Remove "(-431)"
    .trim() || "leader";

  const genderedRole = genderizeRole(cleanRole, gender);

  // Extract era without dates for cleaner prompt
  const eraClean = eraSetting
    .replace(/\d+\s*(BCE|CE|BC|AD)/gi, '')
    .replace(/,\s*$/, '')
    .trim() || "historical setting";

  // Use role description if available, otherwise use role name
  const roleContext = roleDescription
    ? roleDescription.split('.')[0].trim()  // First sentence only
    : `a ${genderedRole}`;

  const physicalClean = physical.trim().replace(/^[,.\s]+/, '');
  const physicalDesc = physicalClean || "with distinctive features";

  const bg = bgObject ? `, with ${bgObject} in the background` : "";

  return `A drawing of a close up of the face only of ${roleContext} from ${eraClean}, ${physicalDesc}${bg}.`;
}


export default function NameScreen({ push }: { push: PushFn }) {
  const lang = useLang();

  // Use translated constants
  const loadingQuotes = useTranslatedConst(LOADING_QUOTES);
  const overlayTitle = useTranslatedConst(OVERLAY_TITLE);

  const logger = useLogger();

  // Navigation guard - prevent back button during name/character creation
  useNavigationGuard({
    enabled: true,
    confirmationMessage: lang("CONFIRM_EXIT_SETUP"),
    screenName: "name_screen"
  });

  const selectedRole = useRoleStore((s) => s.selectedRole);
  const roleYear = useRoleStore((s) => s.roleYear);
  const roleDescription = useRoleStore((s) => s.roleDescription);
  const analysis = useRoleStore((s) => s.analysis);
  const character = useRoleStore((s) => s.character);
  const roleBackgroundImage = useRoleStore((s) => s.roleBackgroundImage);
  const setCharacter = useRoleStore((s) => s.setCharacter);
  const updateCharacter = useRoleStore((s) => s.updateCharacter);
  const generateImages = useSettingsStore((s) => s.generateImages);

  // Create role-based background style
  const roleBgStyle = useMemo(() => bgStyleWithRoleImage(roleBackgroundImage), [roleBackgroundImage]);

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
  const [avatarAttempt, setAvatarAttempt] = useState(0);
  const avatarReqRef = useRef(0);

  // Retry configuration for avatar generation
  const MAX_AVATAR_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;

  // Derive era/setting for image generation prompt
  const eraSetting = useMemo(
    () => deriveEraSetting(selectedRole || "", roleYear, analysis?.grounding?.era),
    [selectedRole, roleYear, analysis?.grounding?.era]
  );

  const fullPrompt = useMemo(
    () => buildFullPrompt(selectedRole || "", gender, physical, bgObject, eraSetting, roleDescription),
    [selectedRole, gender, physical, bgObject, eraSetting, roleDescription]
  );

  async function loadSuggestions() {
    if (!selectedRole) return;
    setLoading(true);
    setErrorMsg("");

    try {
      // Check if we have predefined characters for this role
      const roleData = getPredefinedRole(selectedRole);
      const predefined = roleData?.characters;

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
        setName(lang(pick?.nameKey || ""));
        setPhysical(extractPhysical(lang(pick?.promptKey || "")));
        setBgObject((prev) => prev || suggestBackgroundObject(selectedRole));
      } else {
        console.log("[NameScreen] Using generic placeholders for custom role:", selectedRole);
        // Use generic placeholders for custom roles (no API call)
        const data: Trio = GENERIC_CHARACTERS;
        setTrio(data);
        const pick = data[gender] || data.any;
        setName(lang(pick?.nameKey || ""));
        setPhysical(extractPhysical(lang(pick?.promptKey || "")));
        setBgObject((prev) => prev || suggestBackgroundObject(selectedRole));
      }
    } catch (e: any) {
      setErrorMsg(e?.message || lang("FAILED_TO_LOAD"));
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
    setName(lang(pick?.nameKey || ""));
    setPhysical(extractPhysical(lang(pick?.promptKey || "")));
    setBgObject((prev) => prev || suggestBackgroundObject(selectedRole || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, trio]);

  // Avatar generation logic with retry (moved from CompassIntroStart)
  useEffect(() => {
    if (phase !== "avatar") return;
    if (!generateImages) return;
    if (avatarUrl) return; // already have one

    const prompt = fullPrompt.trim();
    if (!prompt) return;

    const req = ++avatarReqRef.current;
    const ac = new AbortController();

    (async () => {
      setAvatarLoading(true);
      setAvatarAttempt(0);

      for (let attempt = 1; attempt <= MAX_AVATAR_RETRIES; attempt++) {
        // Check if aborted or request is stale
        if (ac.signal.aborted || req !== avatarReqRef.current) return;

        setAvatarAttempt(attempt);
        console.log(`[NameScreen] Avatar generation attempt ${attempt}/${MAX_AVATAR_RETRIES}`);
        console.log(`[NameScreen] Era setting: "${eraSetting}"`);
        console.log(`[NameScreen] Full prompt: "${prompt}"`);

        try {
          const useXAI = useSettingsStore.getState().useXAI;
          const useGemini = useSettingsStore.getState().useGemini;
          const res = await fetch("/api/generate-avatar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, useXAI, useGemini }),
            signal: ac.signal,
          });

          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if ((data as any)?.dataUrl) {
              if (req === avatarReqRef.current) {
                console.log(`[NameScreen] Avatar generated successfully on attempt ${attempt}`);
                setAvatarUrl((data as any).dataUrl);
                updateCharacter({ avatarUrl: (data as any).dataUrl });
                setAvatarLoading(false);
              }
              return; // Success!
            }
          }

          // Server error - retry if attempts remaining
          console.warn(`[NameScreen] Avatar generation failed on attempt ${attempt}/${MAX_AVATAR_RETRIES}`);
          if (attempt < MAX_AVATAR_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
          }
        } catch (e: any) {
          if (e.name === "AbortError") return;
          console.warn(`[NameScreen] Avatar generation error on attempt ${attempt}/${MAX_AVATAR_RETRIES}:`, e?.message);
          if (attempt < MAX_AVATAR_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
          }
        }
      }

      // All retries failed - use fallback
      if (req === avatarReqRef.current) {
        console.log("[NameScreen] All avatar generation attempts failed, using fallback");
        setAvatarUrl(DEFAULT_AVATAR_DATA_URL);
        updateCharacter({ avatarUrl: DEFAULT_AVATAR_DATA_URL });
        setAvatarLoading(false);
      }
    })();

    return () => ac.abort();
  }, [phase, generateImages, fullPrompt, avatarUrl, updateCharacter, MAX_AVATAR_RETRIES, RETRY_DELAY_MS]);

  // Calculate display avatar
  const displayAvatar = useMemo(() => {
    if (avatarUrl) return avatarUrl;
    if (!generateImages) return DEFAULT_AVATAR_DATA_URL;
    return "";
  }, [avatarUrl, generateImages]);

  const onContinue = () => {
    // Play click sound
    audioManager.playSfx('click-soft');

    if (phase === "input") {
      // Phase 1: Clear any existing avatar and save character data, then move to avatar generation
      logger.log('button_click', 'Create Character', 'User clicked Create Character button');

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
      logger.log('button_click', 'Continue to Power', 'User clicked Continue to power distribution');

      push("/power");
    }
  };

  return (
    <div className="min-h-[100dvh] px-5 py-8" style={roleBgStyle}>
      <LoadingOverlay
        visible={loading || (phase === "avatar" && avatarLoading)}
        title={phase === "avatar"
          ? `${lang("GENERATING_AVATAR")}${avatarAttempt > 1 ? ` (${lang("ATTEMPT")} ${avatarAttempt}/${MAX_AVATAR_RETRIES})` : ""}`
          : overlayTitle}
        quotes={loadingQuotes}
      />

      <div className="w-full max-w-2xl mx-auto">
        <h1 className="sr-only">{lang("FORGE_YOUR_CHARACTER")}</h1>

        {errorMsg && (
          <div className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 text-red-200 px-3 py-2" role="alert">
            {errorMsg}
            <button onClick={loadSuggestions} className="ml-3 underline decoration-red-300 hover:opacity-80">
              {lang("TRY_AGAIN")}
            </button>
          </div>
        )}

        <div className="mt-2 rounded-3xl p-6 bg-black/60 backdrop-blur-sm border border-slate-700/50 ring-1 ring-amber-400/40 shadow-xl">
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
                      logger.log('character_gender', 'male', 'User selected Male gender');
                      setGender("male");
                    }}
                  />
                  <span>{lang("MALE")}</span>
                </label>
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="radio"
                    name="g"
                    className="accent-amber-300 focus:ring-2 focus:ring-amber-300/60"
                    checked={gender === "female"}
                    onChange={() => {
                      logger.log('character_gender', 'female', 'User selected Female gender');
                      setGender("female");
                    }}
                  />
                  <span>{lang("FEMALE")}</span>
                </label>
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="radio"
                    name="g"
                    className="accent-amber-300 focus:ring-2 focus:ring-amber-300/60"
                    checked={gender === "any"}
                    onChange={() => {
                      logger.log('character_gender', 'any', 'User selected Any gender');
                      setGender("any");
                    }}
                  />
                  <span>{lang("ANY")}</span>
                </label>
              </div>

              <div className="mt-6">
                <div className="text-white/90 mb-2">{lang("NAME_LABEL")}</div>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    logger.log('character_name', e.target.value, 'User entered character name');
                  }}
                  placeholder={lang("NAME_PLACEHOLDER")}
                  className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                />
              </div>

              <div className="mt-6">
                <div className="text-white/90 mb-2">{lang("DESCRIPTION_LABEL")}</div>
                <textarea
                  rows={6}
                  value={physical}
                  onChange={(e) => {
                    setPhysical(e.target.value);
                    logger.log('character_description', e.target.value, 'User entered character description');
                  }}
                  placeholder={lang("DESCRIPTION_PLACEHOLDER")}
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
                  {lang("CREATE_CHARACTER")}
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
                  {(() => {
                    // Check for predefined role first
                    if (selectedRole) {
                      const roleData = getPredefinedRole(selectedRole);
                      if (roleData) {
                        return `${lang(roleData.titleKey)} (${roleData.year})`;
                      }
                    }
                    // For custom roles, use genderizeRole
                    return genderizeRole(selectedRole || "", gender);
                  })()}
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
                  {gender === "female" ? lang("CONTINUE_TO_POWER_FEMALE") : 
                   gender === "male" ? lang("CONTINUE_TO_POWER_MALE") : 
                   lang("CONTINUE_TO_POWER")}
                </button>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
