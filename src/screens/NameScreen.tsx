// src/screens/NameScreen.tsx
import { useEffect, useMemo, useState } from "react";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { useRoleStore } from "../store/roleStore";
import type { Character } from "../store/roleStore";
import LoadingOverlay from "../components/LoadingOverlay";

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
  const selectedRole = useRoleStore((s) => s.selectedRole);
  const character = useRoleStore((s) => s.character);
  const setCharacter = useRoleStore((s) => s.setCharacter);

  const [gender, setGender] = useState<"male" | "female" | "any">(character?.gender || "any");
  const [name, setName] = useState<string>(character?.name || "");
  const [physical, setPhysical] = useState<string>(character?.description || "");
  const [trio, setTrio] = useState<Trio | null>(null);
  const [bgObject, setBgObject] = useState<string>(character?.bgObject || "");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fullPrompt = useMemo(
    () => buildFullPrompt(selectedRole || "", gender, physical, bgObject),
    [selectedRole, gender, physical, bgObject]
  );

  async function loadSuggestions() {
    if (!selectedRole) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/name-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      if (!res.ok) {
        let j: any = null;
        try { j = await res.json(); } catch {}
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const data: Trio = await res.json();
      setTrio(data);
      const pick = data[gender] || data.any;
      setName(pick?.name || "");
      setPhysical(extractPhysical(pick?.prompt || ""));
      setBgObject((prev) => prev || suggestBackgroundObject(selectedRole));
    } catch (e: any) {
      setErrorMsg(e?.message || "Name suggestion failed");
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

  const onContinue = () => {
    const fullChar: Character = {
      gender,
      name: name.trim(),
      description: physical.trim(),
      avatarUrl: character?.avatarUrl,
      imagePrompt: fullPrompt,
      bgObject,
    };
    setCharacter(fullChar);
    push("/compass-intro");
  };

  return (
    <div className="min-h-[100dvh] px-5 py-8" style={bgStyle}>
      <LoadingOverlay
  visible={loading}          // uses your existing loading state
  title={OVERLAY_TITLE}
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
         

          <div className="flex items-center gap-8 justify-center">
            <label className="flex items-center gap-2 text-white">
              <input
                type="radio"
                name="g"
                className="accent-amber-300 focus:ring-2 focus:ring-amber-300/60"
                checked={gender === "male"}
                onChange={() => setGender("male")}
              />
              <span>Male</span>
            </label>
            <label className="flex items-center gap-2 text-white">
              <input
                type="radio"
                name="g"
                className="accent-amber-300 focus:ring-2 focus:ring-amber-300/60"
                checked={gender === "female"}
                onChange={() => setGender("female")}
              />
              <span>Female</span>
            </label>
            <label className="flex items-center gap-2 text-white">
              <input
                type="radio"
                name="g"
                className="accent-amber-300 focus:ring-2 focus:ring-amber-300/60"
                checked={gender === "any"}
                onChange={() => setGender("any")}
              />
              <span>Any</span>
            </label>
          </div>

          <div className="mt-6">
            <div className="text-white/90 mb-2">Name:</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Character name"
              className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
            />
          </div>

          <div className="mt-6">
            <div className="text-white/90 mb-2">Description (mention any facial features and accessories you want present):</div>
            <textarea
              rows={6}
              value={physical}
              onChange={(e) => setPhysical(e.target.value)}
              placeholder="with a dignified expression, long black hair tied in a topknot, a finely groomed beard…"
              className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
            />
    
          </div>

          <div className="mt-6 flex justify-center">
            <button
              disabled={loading}
              onClick={onContinue}
              className={`rounded-2xl px-5 py-3 font-semibold text-lg shadow-lg ${
                !loading
                  ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0b1335] hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-white/10 text-white/60 cursor-not-allowed"
              }`}
            >
              Create Character
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
