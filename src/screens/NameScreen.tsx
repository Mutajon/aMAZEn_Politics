// src/screens/NameScreen.tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { useRoleStore } from "../store/roleStore";
import type { GenderKey } from "../store/roleStore";
import { AIConnectionError } from "../lib/validation";

type Trio = Record<GenderKey, { name: string; description: string }>;
type FetchState = "idle" | "loading" | "error" | "done";

export default function NameScreen({ push }: { push: PushFn }) {
  const role = useRoleStore((s) => s.selectedRole);
  const analysis = useRoleStore((s) => s.analysis);
  const setCharacter = useRoleStore((s) => s.setCharacter);

  const [state, setState] = useState<FetchState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [options, setOptions] = useState<Trio | null>(null);

  const [gender, setGender] = useState<GenderKey>("neutral");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  async function fetchSuggestions() {
    if (!role) return;
    try {
      setState("loading");
      setErrorMsg("");
      const res = await fetch("/api/name-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, systemName: analysis?.system.name }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j?.error) msg = String(j.error);
        } catch {}
        throw new AIConnectionError(msg);
      }
      const data = (await res.json()) as Trio;
      setOptions(data);
      setGender("neutral");
      setName(data.neutral.name);
      setDesc(data.neutral.description);
      setState("done");
    } catch (e: any) {
      setErrorMsg(e instanceof AIConnectionError ? e.message : "Name suggestion failed");
      setState("error");
    }
  }

  useEffect(() => {
    if (!role) {
      push("/role");
      return;
    }
    fetchSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  function choose(g: GenderKey) {
    setGender(g);
    if (options) {
      setName(options[g].name);
      setDesc(options[g].description);
    }
  }

  function handleCreate() {
    setCharacter({ gender, name: name.trim(), description: desc.trim() });
    push("/compass");
  }

  return (
    <div className="min-h-[100dvh] px-5 py-8" style={bgStyle}>
      <div className="w-full max-w-xl mx-auto">
        <h1 className="text-3xl font-extrabold text-center bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
          Forge Your Character
        </h1>

        {/* Error */}
        {state === "error" && (
          <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 text-red-200 px-3 py-2 flex items-center justify-between" role="alert">
            <span>{errorMsg}</span>
            <button onClick={fetchSuggestions} className="ml-3 underline decoration-red-300 hover:opacity-80">
              Try again
            </button>
          </div>
        )}

        {/* Content */}
        <div className="mt-6 rounded-3xl bg-white/5 border border-white/10 px-5 py-6">
          {/* Gender */}
          <div className="flex items-center gap-6 justify-center">
            {(["male", "female", "neutral"] as GenderKey[]).map((g) => (
              <label key={g} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value={g}
                  checked={gender === g}
                  onChange={() => choose(g)}
                  className="accent-amber-400"
                />
                <span className="text-white/90 capitalize">{g === "neutral" ? "Any" : g}</span>
              </label>
            ))}
          </div>

          {/* Name */}
          <div className="mt-6">
            <label className="block text-white/90 mb-2">Name:</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Character name"
              className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
            />
          </div>

          {/* Description */}
          <div className="mt-6">
            <label className="block text-white/90 mb-2">Description:</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              placeholder={`a game avatar of the face of ${role}, ...`}
              className="w-full px-4 py-3 rounded-xl bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/60 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
            />
          </div>

          <p className="text-center text-white/60 mt-4">Tip: you can edit name and description.</p>

          <div className="mt-6 flex justify-center">
            <button
              disabled={state !== "done" || name.trim().length < 2 || desc.trim().length < 10}
              onClick={handleCreate}
              className={`rounded-2xl px-6 py-3 font-semibold text-lg shadow
                ${state !== "done" || name.trim().length < 2 || desc.trim().length < 10
                  ? "bg-amber-300/40 text-[#0b1335]/60 cursor-not-allowed"
                  : "bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0b1335]"}`}
            >
              Create Character
            </button>
          </div>
        </div>

        {/* Loading */}
        <AnimatePresence>
          {state === "loading" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-center text-white/80"
            >
              Generating fitting names…
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
