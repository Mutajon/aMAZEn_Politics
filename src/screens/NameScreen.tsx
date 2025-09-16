// src/screens/NameScreen.tsx
import { useEffect, useState } from "react";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { useRoleStore } from "../store/roleStore";

type Trio = {
  male: { name: string; prompt: string };
  female: { name: string; prompt: string };
  any: { name: string; prompt: string };
};

export default function NameScreen({ push }: { push: PushFn }) {
  const selectedRole = useRoleStore((s) => s.selectedRole);
  const character = useRoleStore((s) => s.character);
  const setCharacter = useRoleStore((s) => s.setCharacter);

  const [gender, setGender] = useState<"male" | "female" | "any">(character?.gender || "any");
  const [name, setName] = useState<string>(character?.name || "");
  const [desc, setDesc] = useState<string>(character?.description || "");
  const [trio, setTrio] = useState<Trio | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ---- Minimal, reliable fetcher (posts { role }, runs once) ----
  async function loadSuggestions() {
    if (!selectedRole) return;
    setLoading(true);
    setErrorMsg("");
    try {
      console.log("[NameScreen] requesting name-suggestions for role:", selectedRole);
      const res = await fetch("/api/name-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }), // <- back to simple, proven payload
      });
      if (!res.ok) {
        let j: any = null;
        try {
          j = await res.json();
        } catch {}
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const data: Trio = await res.json();
      setTrio(data);
      const pick = data[gender] || data.any;
      setName(pick?.name || "");
      setDesc(pick?.prompt || "");
    } catch (e: any) {
      setErrorMsg(e?.message || "Name suggestion failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedRole) {
      // if user somehow landed here without a role, send them back
      push("/role");
      return;
    }
    // fetch once, reliably
    loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <-- empty deps = no accidental skips due to memoization

  // Switch between the 3 pre-generated options (no re-fetch)
  useEffect(() => {
    if (!trio) return;
    const pick = trio[gender] || trio.any;
    setName(pick?.name || "");
    setDesc(pick?.prompt || "");
  }, [gender, trio]);

  const onContinue = () => {
    setCharacter({
      gender,
      name: name.trim(),
      description: desc.trim(),
      avatarUrl: character?.avatarUrl || "", // keep existing avatar if any
    });
    push("/compassIntro");
  };

  return (
    <div className="min-h-[100dvh] px-5 py-8" style={bgStyle}>
      <div className="w-full max-w-2xl mx-auto">
        <h1 className="text-4xl font-extrabold text-center bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
          Forge Your Character
        </h1>

        {errorMsg && (
          <div className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 text-red-200 px-3 py-2" role="alert">
            {errorMsg}
            <button onClick={loadSuggestions} className="ml-3 underline decoration-red-300 hover:opacity-80">
              Try again
            </button>
          </div>
        )}

        <div className="mt-6 rounded-3xl p-6 bg-white/5 border border-white/10 shadow-xl">
          {loading && <div className="mb-4 text-center text-white/70 text-sm">Fetching suggestions…</div>}

          {/* Gender */}
          <div className="flex items-center gap-8 justify-center">
            <label className="flex items-center gap-2">
              <input type="radio" name="g" checked={gender === "male"} onChange={() => setGender("male")} />
              <span>Male</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="g" checked={gender === "female"} onChange={() => setGender("female")} />
              <span>Female</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="g" checked={gender === "any"} onChange={() => setGender("any")} />
              <span>Any</span>
            </label>
          </div>

          {/* Name */}
          <div className="mt-6">
            <div className="text-white/90 mb-2">Name:</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Character name"
              className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
            />
          </div>

          {/* Description */}
          <div className="mt-6">
            <div className="text-white/90 mb-2">Description:</div>
            <textarea
              rows={6}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="a game avatar of the face of …"
              className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
            />
          </div>

          <div className="mt-6 text-center text-white/60">Tip: you can edit name and description.</div>

          {/* Continue */}
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
