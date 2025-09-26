// src/screens/PowerDistributionScreen.tsx
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { bgStyle } from "../lib/ui";
import type { PushFn } from "../lib/router";
import { useRoleStore } from "../store/roleStore";
import type { AnalysisResult, PowerHolder } from "../store/roleStore";
import { AIConnectionError } from "../lib/validation";
import LoadingOverlay from "../components/LoadingOverlay";

import {
  Crown, Shield, Coins, Landmark, BookOpen, Gavel, Scale, Swords, Users,
  Flame, Building2, Banknote, ScrollText, Cog, HelpCircle, ArrowLeft,
} from "lucide-react";

import { POLITICAL_SYSTEMS } from "../data/politicalSystems";

// darkest → lightest per rank (1..5)
const RANK_COLORS = ["#4C1D95", "#5B21B6", "#6D28D9", "#8B5CF6", "#A78BFA"] as const;

type FetchState = "idle" | "loading" | "error" | "done";

/* ------------------------------ AI Fetcher ------------------------------ */
async function fetchAnalysis(role: string): Promise<AnalysisResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch("/api/analyze-role", {
      method: "POST",
      body: JSON.stringify({ role }),
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 504) throw new AIConnectionError("AI analysis timed out");
      try {
        const j = await res.json();
        if (j?.error) throw new AIConnectionError(String(j.error));
      } catch {}
      throw new AIConnectionError(`AI analysis failed (HTTP ${res.status})`);
    }

    return (await res.json()) as AnalysisResult;
  } catch (e: any) {
    if (e?.name === "AbortError") throw new AIConnectionError("AI analysis timed out");
    if (e instanceof AIConnectionError) throw e;
    throw new AIConnectionError("Cannot reach AI analysis service");
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------- Helpers & Icons --------------------------- */
function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function rebalance(
  holders: Array<PowerHolder & { _id: string }>,
  idx: number,
  newValue: number
) {
  const others = holders.filter((_, i) => i !== idx);
  const othersSum = others.reduce((s, h) => s + h.percent, 0);
  const remaining = 100 - clampPct(newValue);

  if (othersSum <= 0) {
    return holders.map((h, i) => ({ ...h, percent: i === idx ? clampPct(newValue) : 0 }));
  }

  const factor = remaining / othersSum;
  const out = holders.map((h, i) =>
    i === idx ? { ...h, percent: clampPct(newValue) } : { ...h, percent: clampPct(h.percent * factor) }
  );

  let diff = 100 - out.reduce((s, h) => s + h.percent, 0);
  for (let i = 0; diff !== 0 && i < out.length; i++) {
    if (i === idx) continue;
    out[i].percent += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
  }
  return out;
}

function getIconKeyPool() {
  return [
    "Crown","Shield","Coins","Landmark","BookOpen","Gavel","Scale","Swords",
    "Users","Flame","Building2","Banknote","ScrollText",
  ] as const;
}

const ICON_RENDERERS: Record<string, (props: { className?: string }) => ReactElement> = {
  Crown: (p) => <Crown {...p} />,
  Shield: (p) => <Shield {...p} />,
  Coins: (p) => <Coins {...p} />,
  Landmark: (p) => <Landmark {...p} />,
  BookOpen: (p) => <BookOpen {...p} />,
  Gavel: (p) => <Gavel {...p} />,
  Scale: (p) => <Scale {...p} />,
  Swords: (p) => <Swords {...p} />,
  Users: (p) => <Users {...p} />,
  Flame: (p) => <Flame {...p} />,
  Building2: (p) => <Building2 {...p} />,
  Banknote: (p) => <Banknote {...p} />,
  ScrollText: (p) => <ScrollText {...p} />,
};

function IconFromKey({ keyName, className }: { keyName?: string; className?: string }) {
  const Comp = (keyName && ICON_RENDERERS[keyName]) || Crown;
  return <Comp className={className} />;
}

/** Match entity → icon (semantic, no duplicates within the list) */
function pickIconKeyByName(nameRaw: string, used: Set<string>): string {
  const name = (nameRaw || "").toLowerCase();
  const tryPick = (key: string) => (!used.has(key) ? (used.add(key), key) : null);
  if (/(emperor|king|queen|monarch|autocrat)/.test(name)) return tryPick("Crown") || fallback(used);
  if (/(senate|council|assembly|parliament|congress)/.test(name)) return tryPick("Landmark") || tryPick("Users") || fallback(used);
  if (/(consul|magistrate|executive|bureaucracy|minister|governor)/.test(name)) return tryPick("Building2") || tryPick("Gavel") || fallback(used);
  if (/(judge|court|tribunal|justice)/.test(name)) return tryPick("Gavel") || tryPick("Scale") || fallback(used);
  if (/(law|constitution|charter|edict|decree)/.test(name)) return tryPick("ScrollText") || tryPick("Scale") || fallback(used);
  if (/(nobility|aristocrat|lord|duke|patrician)/.test(name)) return tryPick("Shield") || tryPick("Crown") || fallback(used);
  if (/(military|army|legion|guard|general|commander|warlord)/.test(name)) return tryPick("Swords") || tryPick("Shield") || fallback(used);
  if (/(merchant|trade|commerce|guild|bank|financ)/.test(name)) return tryPick("Coins") || tryPick("Banknote") || fallback(used);
  if (/(people|citizen|plebeian|mob|popul)/.test(name)) return tryPick("Users") || tryPick("Landmark") || fallback(used);
  if (/(priest|temple|church|cult|oracle|relig)/.test(name)) return tryPick("Flame") || tryPick("ScrollText") || fallback(used);
  if (/(scholar|sage|academy|university|scribe|intelligentsia)/.test(name)) return tryPick("BookOpen") || fallback(used);
  if (/(state|government|ministry|office)/.test(name)) return tryPick("Building2") || fallback(used);
  if (/(reform|revolt|revolution|uprising)/.test(name)) return tryPick("Flame") || fallback(used);
  return fallback(used);
  function fallback(usedSet: Set<string>) {
    for (const k of getIconKeyPool()) if (!usedSet.has(k)) { usedSet.add(k); return k; }
    return "Crown";
  }
}

/** Choose a political system from our list (fallback when API/store didn’t set one). */
function classifyPoliticalSystem(roleText: string, holders: PowerHolder[]) {
  const text = `${roleText} | ${holders.map(h => `${h.name}:${h.percent}`).join(", ")}`.toLowerCase();
  const top = (holders[0]?.name || "").toLowerCase();

  const pick = (name: string) => POLITICAL_SYSTEMS.find(ps => ps.name === name)!;

  // Monarchies
  if (/emperor|king|queen|monarch|tsar|sultan/.test(top)) {
    if (/divine|god|holy|sacred/.test(text)) return pick("Divine Right Monarchy");
    if (/elect|chosen|vote/.test(text)) return pick("Elective Monarchy");
    if (/parliament|constitution/.test(text)) return pick("Constitutional Monarchy");
    return pick("Absolute Monarchy");
  }
  // Military
  if (/junta|general|army|legion|military|command/.test(top)) {
    if (/institution|permanent/.test(text)) return pick("Stratocracy");
    return pick("Military Junta");
  }
  // Theocracy
  if (/priest|temple|church|cleric|oracle|relig/.test(top)) return pick("Clerical Theocracy");
  // One-party / dictatorship
  if (/party/.test(text) && /single|only|sole|one/.test(text)) return pick("One-Party State");
  if (/dictator|supreme leader|strongman/.test(text)) return pick("Dictatorship");
  // Democracies
  if (/assembly|referendum|vote directly|plebiscite/.test(text)) return pick("Direct Democracy");
  if (/parliament|prime minister|pm|coalition/.test(text)) return pick("Parliamentary Democracy");
  if (/president\b/.test(text) && /legislature|congress/.test(text)) return pick("Presidential Democracy");
  if (/senate|consul|representative|assembly|congress/.test(text)) return pick("Representative Democracy");
  // Republics (federal/unitary)
  if (/federal|province|state|regional|cantonal/.test(text)) return pick("Federal Republic");
  if (/unitary|central/.test(text)) return pick("Unitary Republic");
  // Oligarchy / plutocracy / technocracy / gerontocracy
  if (/oligarch|elite|patrician|nobility/.test(text)) return pick("Oligarchy");
  if (/merchant|wealth|bank|trade|commerce/.test(text)) return pick("Plutocracy");
  if (/expert|technocrat|engineer|scientist|scholar|academy/.test(text)) return pick("Technocracy");
  if (/elder|council of elders|old/.test(text)) return pick("Gerontocracy");
  // Catch-alls
  if (/anarchy|no government/.test(text)) return pick("Anarchy");
  if (/property owners|landed/.test(text)) return pick("Timocracy");
  if (/corrupt|klepto|steal|graft/.test(text)) return pick("Kleptocracy");
  if (/banana|clientelist|puppet/.test(text)) return pick("Banana Republic");
  return pick("Representative Democracy");
}
/** Tokenize + light singularization for simple matches (senators → senator, tribunes → tribune, etc.) */
function normalizeTokens(s: string): string[] {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      if (tok.endsWith("ies") && tok.length > 3) return tok.slice(0, -3) + "y";
      if (tok.endsWith("ses") && tok.length > 3) return tok.slice(0, -2); // e.g., "consuls" won't hit this, but "classes" → "class"
      if (tok.endsWith("s") && tok.length > 3) return tok.slice(0, -1);
      return tok;
    });
}

/** If the API doesn't provide playerIndex, infer it from role text vs holder names; fall back to 0. */
function inferPlayerIndex(roleText: string, holders: PowerHolder[]): number | null {
  const roleSet = new Set(normalizeTokens(roleText));
  let bestIdx = -1;
  let bestScore = 0;

  holders.forEach((h, i) => {
    const nameSet = new Set(normalizeTokens(h.name));
    let score = 0;
    nameSet.forEach((t) => {
      if (roleSet.has(t)) score++;
    });
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });

  if (bestScore > 0) return bestIdx;
  return holders.length > 0 ? 0 : null; // default to the strongest holder if nothing matched
}

/**
 * Normalize totals and ensure distinct, semantic icons.
 * Do NOT pad to 5; if API returns 4, we show 4.
 */
function coerceAndDecorate(
  raw: PowerHolder[],
  playerIndex: number | null
) {
  let base = (raw || []).filter((h) => (h?.name ?? "").trim().length > 0);

  if (base.length > 5) base = [...base].sort((a, b) => b.percent - a.percent).slice(0, 5);

  const sum = base.reduce((s, h) => s + (h.percent ?? 0), 0);
  if (sum > 0 && sum !== 100) {
    const factor = 100 / sum;
    base = base.map((h) => ({ ...h, percent: clampPct((h.percent ?? 0) * factor) }));
    let diff = 100 - base.reduce((s, h) => s + h.percent, 0);
    for (let i = 0; diff !== 0 && i < base.length; i++) {
      base[i].percent += diff > 0 ? 1 : -1;
      diff += diff > 0 ? -1 : 1;
    }
  }

  // semantic, no-duplicate icons (override any incoming)
  const used = new Set<string>();
  const withIcons = base.map((h) => ({ ...h, icon: pickIconKeyByName(h.name ?? "", used) }));
  const holders = withIcons.map((h) => ({ ...h, _id: makeId() }));

  const playerHolderId =
    playerIndex != null && playerIndex >= 0 && playerIndex < holders.length ? holders[playerIndex]._id : null;

  return { holders, playerHolderId };
}

/* --------------------------------- UI ---------------------------------- */
export default function PowerDistributionScreen({ push }: { push: PushFn }) {
  const role = useRoleStore((s) => s.selectedRole);
  const analysisStore = useRoleStore((s) => s.analysis);
  const setAnalysis = useRoleStore((s) => s.setAnalysis);

  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [holders, setHolders] = useState<Array<PowerHolder & { _id: string }>>([]);
  const [playerHolderId, setPlayerHolderId] = useState<string | null>(null);

  const [systemName, setSystemName] = useState<string>("");
  const [systemDesc, setSystemDesc] = useState<string>("");
  const [systemFlavor, setSystemFlavor] = useState<string>("");

  const [showSystemModal, setShowSystemModal] = useState(false);

  const initialHoldersRef = useRef<Array<PowerHolder & { _id: string }>>([]);
  const initialPlayerHolderIdRef = useRef<string | null>(null);

  const QUOTES = useMemo(
    () => [
      "Power is like water; it flows to the lowest resistance.",
      "Influence is a currency; spend it wisely.",
      "Balance is not equality; it's stability.",
      "Power leaves quietly, but chaos throws a party.",
    ],
    []
  );

  useEffect(() => {
    if (!role) {
      push("/role");
      return;
    }

    async function run() {
      setState("loading");
      setError(null);
      try {
        // If we already have holders, reuse; else fetch
        const base: AnalysisResult =
          analysisStore?.holders?.length ? (analysisStore as AnalysisResult) : await fetchAnalysis(role!);

          const inferredIndex =
          base.playerIndex != null ? base.playerIndex : inferPlayerIndex(role!, base.holders ?? []);
        
        const { holders: decorated, playerHolderId } =
          coerceAndDecorate(base.holders ?? [], inferredIndex);
        

// Prefer what the API just returned (server enforces canonical names via ALLOWED_SYSTEMS).
let name = (base.systemName || "").trim();
let desc = (base.systemDesc || "").trim();
let flavor = (base.flavor || "").trim();

// If RoleSelection primed a system (predefined roles), it wins.
if (analysisStore?.systemName?.trim()) {
  name = analysisStore.systemName.trim();
  desc = (analysisStore.systemDesc || "").trim();
  flavor = (analysisStore.flavor || "").trim();
}

// As a final fallback only (extremely rare now), run the local classifier.
if (!name) {
  const pick = classifyPoliticalSystem(role!, decorated.map(({ _id, ...r }) => r));
  name = pick.name;
  desc = pick.description;
  flavor = pick.flavor;
}



        setHolders(decorated.sort((a, b) => b.percent - a.percent));
        setPlayerHolderId(playerHolderId);

        setSystemName(name);
        setSystemDesc(desc);
        setSystemFlavor(flavor);

        initialHoldersRef.current = decorated.map((h) => ({ ...h }));
        initialPlayerHolderIdRef.current = playerHolderId;

        // Save current snapshot (strip _id) + political system fields
        setAnalysis({
          ...base,
          systemName: name,
          systemDesc: desc,
          flavor,
          holders: decorated.map(({ _id, ...rest }) => rest),
          playerIndex: playerHolderId != null
  ? decorated.findIndex((h) => h._id === playerHolderId)
  : inferredIndex,

        });

        setState("done");
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong");
        setState("error");
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const handleChangePercent = (idx: number, value: number) => {
    const updated = rebalance(holders, idx, value);
    updated.sort((a, b) => b.percent - a.percent);
    setHolders(updated);
  };

  const handleChangeName = (id: string, name: string) => {
    setHolders((prev) => prev.map((h) => (h._id === id ? { ...h, name } : h)));
  };

  const handleReset = () => {
    setHolders(initialHoldersRef.current.map((h) => ({ ...h })));
    setPlayerHolderId(initialPlayerHolderIdRef.current);
  };
  const handleBack = () => {
    // Clear only the analysis so the next selected role re-analyzes cleanly.
    setAnalysis(null);
    push("/role");
  };
  

  const handleLooksGood = () => {
    const a = useRoleStore.getState().analysis;
    if (!a) return;

    const plainHolders: PowerHolder[] = holders.map(({ _id, ...rest }) => rest);
    const newPlayerIndex = playerHolderId != null ? holders.findIndex((h) => h._id === playerHolderId) : a.playerIndex;

    // ✅ Save both the edited distribution AND the chosen political system
    useRoleStore.getState().setAnalysis({
      ...a,
      systemName,
      systemDesc,
      flavor: systemFlavor,
      holders: plainHolders,
      playerIndex: newPlayerIndex,
    });

    push("/name");
  };

  return (
    <div className="min-h-dvh w-full" style={bgStyle}>
      <LoadingOverlay visible={state === "loading"} title="Analyzing your world…" quotes={QUOTES} periodMs={5500} />

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Top bar with Back */}
<div className="mb-2">
  <button
    onClick={handleBack}
    className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white/80"
    aria-label="Go back to role selection"
  >
    <ArrowLeft className="w-4 h-4" />
    Back
  </button>
</div>

        {state === "error" && (
          <div className="bg-red-900/30 text-red-100 border border-red-700/40 rounded-xl p-4 flex items-start gap-3">
            <span className="mt-0.5">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold">We couldn’t analyze that setting.</p>
              <p className="text-sm opacity-90 mt-0.5">{error}</p>
            </div>
            <button onClick={() => setState("idle")} className="ml-2 rounded-lg bg-red-100/10 px-3 py-1.5 text-sm hover:bg-red-100/20">
              Try again
            </button>
          </div>
        )}

        <AnimatePresence>
          {state === "done" && (
            <motion.div
              key="results"
              initial="hidden"
              animate="show"
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } } }}
              className="mt-2"
            >
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-3xl font-extrabold text-center tracking-tight bg-gradient-to-r from-yellow-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                  Top Power Holders In This Game
                </h1>
                <p className="text-center text-white/75 mt-1">
                  Not satisfied? Use sliders to adjust influence, or click names to edit.
                </p>

                {/* Political System row */}
                <div className="mt-3 flex items-center justify-center gap-2 text-white/85">
                  <span className="font-semibold">Political system:</span>
                  <button
                    onClick={() => setShowSystemModal(true)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10"
                    aria-label="Show political system details"
                  >
                    <span className="font-semibold">{systemName || "—"}</span>
                    <HelpCircle className="w-4 h-4 text-amber-300" />
                  </button>
                </div>
              </motion.div>

              {/* List */}
              <LayoutGroup id="power-list">
                <div className="mt-6 space-y-4">
                  {holders.map((h, i) => {
                    const rank = i + 1;
                    const isPlayer = playerHolderId != null && h._id === playerHolderId;

                    return (
                      <motion.div
                        key={h._id}
                        layout
                        layoutId={h._id}
                        transition={{ type: "spring", stiffness: 450, damping: 38 }}
                        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-4 relative"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white/95 text-sm font-semibold shrink-0"
                            style={{ backgroundColor: RANK_COLORS[Math.min(rank - 1, RANK_COLORS.length - 1)] }}
                          >
                            {rank}
                          </div>

                          <div className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                            <IconFromKey keyName={h.icon ?? undefined} className="w-5 h-5 text-amber-300" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                value={h.name}
                                onChange={(e) => handleChangeName(h._id, e.target.value)}
                                className="bg-transparent font-semibold text-white/95 outline-none flex-auto min-w-0"
                                placeholder="Enter a name…"
                                aria-label="Power holder name"
                              />
                              {isPlayer && (
                                <span className="text-amber-300 text-sm font-semibold whitespace-nowrap">
                                  (That’s you!)
                                </span>
                              )}
                            </div>
                            {h.note && <p className="text-sm text-white/60 mt-0.5 line-clamp-2">{h.note}</p>}
                          </div>

                          <div className="shrink-0 ml-2">
                            <div className="px-2.5 py-1 rounded-xl bg-white/8 border border-white/10 text-white/90 text-sm font-semibold">
                              {h.percent}%
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={h.percent}
                            onChange={(e) => handleChangePercent(i, Number(e.target.value))}
                            className="w-full accent-violet-500"
                            aria-label={`Adjust ${h.name || "this holder"}'s influence`}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </LayoutGroup>

              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/7 active:scale-[.99] text-white/70"
                >
                  <Cog className="w-4 h-4" />
                  Reset
                </button>

                <button
                  onClick={handleLooksGood}
                  className="rounded-2xl px-5 py-3 font-semibold bg-yellow-300 hover:bg-yellow-200 text-[#0b1335] shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                >
                  Looks good →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Political System Modal */}
      <AnimatePresence>
        {showSystemModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/55" onClick={() => setShowSystemModal(false)} />
            <motion.div
              className="relative z-10 w-full max-w-lg rounded-3xl border border-white/10 bg-gradient-to-b from-[#1b1f3b] to-[#261c4a] p-5 shadow-2xl"
              initial={{ scale: 0.94, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.97, y: 6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="psys-title"
            >
              <div className="flex items-center justify-between">
                <h2 id="psys-title" className="text-2xl font-extrabold bg-gradient-to-r from-yellow-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                  {systemName}
                </h2>
                <button
                  onClick={() => setShowSystemModal(false)}
                  className="rounded-xl px-2 py-1 bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                >
                  Close
                </button>
              </div>
              <p className="mt-3 text-white/85">{systemDesc}</p>
              {systemFlavor && (
                <p className="mt-3 italic text-amber-200/90">“{systemFlavor.replace(/^“|”$/g, "")}”</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
