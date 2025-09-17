// src/screens/PowerDistributionScreen.tsx
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { bgStyle } from "../lib/ui";
import type { PushFn } from "../lib/router";
import { useRoleStore } from "../store/roleStore";
import type { AnalysisResult, PowerHolder } from "../store/roleStore";
import { AIConnectionError } from "../lib/validation";
import LoadingOverlay from "../components/LoadingOverlay";

// darkest → lightest per rank (1..5)
const RANK_COLORS = ["#4C1D95", "#5B21B6", "#6D28D9", "#8B5CF6", "#A78BFA"];

type FetchState = "idle" | "loading" | "error" | "done";

async function fetchAnalysis(role: string): Promise<AnalysisResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("/api/analyze-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j?.error) msg = String(j.error);
      } catch {}
      throw new AIConnectionError(msg);
    }
    const data = (await res.json()) as AnalysisResult;
    return data;
  } catch (e: any) {
    if (e?.name === "AbortError") throw new AIConnectionError("AI analysis timed out");
    if (e instanceof AIConnectionError) throw e;
    throw new AIConnectionError("Cannot reach AI analysis service");
  }
}

function rebalance(holders: PowerHolder[], idx: number, newValue: number): PowerHolder[] {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const others = holders.filter((_, i) => i !== idx);
  const othersSum = others.reduce((s, h) => s + h.percent, 0);
  const remaining = 100 - clamp(newValue);

  if (othersSum <= 0) return holders.map((h, i) => ({ ...h, percent: i === idx ? clamp(newValue) : 0 }));

  const factor = remaining / othersSum;
  const out = holders.map((h, i) =>
    i === idx ? { ...h, percent: clamp(newValue) } : { ...h, percent: clamp(h.percent * factor) }
  );

  // fix rounding drift
  let diff = 100 - out.reduce((s, h) => s + h.percent, 0);
  for (let i = 0; diff !== 0 && i < out.length; i++) {
    if (i === idx) continue;
    out[i].percent += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
  }
  return out;
}

export default function PowerDistributionScreen({ push }: { push: PushFn }) {
  const role = useRoleStore((s) => s.selectedRole);
  const analysisStore = useRoleStore((s) => s.analysis);
  const setAnalysis = useRoleStore((s) => s.setAnalysis);

  const [state, setState] = useState<FetchState>(analysisStore ? "done" : "idle");
  const [holders, setHolders] = useState<PowerHolder[]>(analysisStore?.holders || []);
  const [errorMsg, setErrorMsg] = useState("");

  // Loading overlay control
  const [loading, setLoading] = useState(false);

  // Your new power quotes (used by the overlay)
  const powerQuotes = [
    "Power is just permission to hog the remote.",
    "Everyone wants power—until it comes with paperwork.",
    "Power is like Wi-Fi: unstable and password-protected.",
    "Too much power turns meetings into monologues.",
    "Power is borrowed, never owned.",
    "The strongest grip on power leaves the deepest dents.",
    "Power is the art of making others nod.",
    "Hoarding power is the original group project fail.",
    "Real power is skipping the line.",
    "Power leaves quietly, but chaos throws a party.",
  ];

  const initialHolders = useRef<PowerHolder[] | null>(analysisStore?.holders || null);
  const playerNameRef = useRef<string | null>(
    analysisStore?.playerIndex != null ? analysisStore.holders[analysisStore.playerIndex]?.name ?? null : null
  );

  // Kick off analysis once (or when re-trying)
  useEffect(() => {
    if (!role) {
      push("/role");
      return;
    }
    if (state !== "idle") return;

    (async () => {
      try {
        setLoading(true);            // show overlay
        setState("loading");
        setErrorMsg("");

        const result = await fetchAnalysis(role);

        setAnalysis(result);
        initialHolders.current = result.holders;
        setHolders(result.holders);
        playerNameRef.current =
          result.playerIndex != null ? result.holders[result.playerIndex]?.name ?? null : null;

        setState("done");
      } catch (e: any) {
        setErrorMsg(
          e instanceof AIConnectionError ? e.message || "AI analysis unavailable" : "Unexpected error during AI analysis"
        );
        setState("error");
      } finally {
        setLoading(false);           // hide overlay
      }
    })();
  }, [role, state, push, setAnalysis]);

  // stable sort by power (desc), with original index as a tiebreaker to avoid jitter
  const sortByPower = () =>
    setHolders((list) => {
      const withIndex = list.map((h, i) => ({ h, i }));
      withIndex.sort((a, b) => b.h.percent - a.h.percent || a.i - b.i);
      return withIndex.map((x) => x.h);
    });

  return (
    <div className="min-h-[100dvh] px-5 py-8" style={bgStyle}>
      <div className="w-full max-w-2xl mx-auto">
        {/* Error banner */}
        {state === "error" && (
          <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 text-red-200 px-3 py-2" role="alert">
            {errorMsg}
            <button onClick={() => setState("idle")} className="ml-3 underline decoration-red-300 hover:opacity-80">
              Try again
            </button>
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {state === "done" && analysisStore && (
            <motion.div
              key="results"
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
              }}
              className="mt-2"
            >
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-3xl font-extrabold text-center bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                  Top Power Holders In This Game
                </h1>
                <p className="text-center text-white/75 mt-1">
                  Not satisfied with my power distribution? You can adjust influence percentages and edit names.
                </p>
              </motion.div>

              {/* Smooth reordering with layout springs */}
              <LayoutGroup id="power-list">
                <div className="mt-6 space-y-4">
                  {holders.map((h, i) => {
                    const rankColor = RANK_COLORS[i] || RANK_COLORS[RANK_COLORS.length - 1];
                    const badgeBg = `${rankColor}99`; // ~60% alpha
                    const pillBg = `${rankColor}4D`; // ~30% alpha

                    return (
                      <motion.div
                        key={h.name}
                        layout
                        layoutId={h.name}
                        transition={{ layout: { type: "spring", stiffness: 140, damping: 28, mass: 1.1 } }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-3xl bg-white/5 border border-white/10 px-4 py-4"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-8 h-8 rounded-xl text-white grid place-items-center font-bold"
                            style={{ backgroundColor: badgeBg }}
                            aria-label={`rank ${i + 1}`}
                          >
                            {i + 1}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <motion.div
                                layout="position"
                                className="w-7 h-7 rounded-lg grid place-items-center text-lg"
                                style={{ backgroundColor: pillBg }}
                              >
                                {h.icon || "🏷️"}
                              </motion.div>

                              <div className="flex flex-wrap items-baseline gap-x-2">
                                <input
                                  value={h.name}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setHolders((list) => list.map((x, idx) => (idx === i ? { ...x, name: v } : x)));
                                  }}
                                  className="bg-transparent text-white font-semibold outline-none border-b border-transparent focus:border-white/20"
                                />
                                {playerNameRef.current && h.name === playerNameRef.current && (
                                  <span className="text-amber-300 font-semibold text-sm">(That’s you!)</span>
                                )}
                              </div>
                            </div>

                            {h.note && <p className="mt-1 text-white/75 text-sm">{h.note}</p>}

                            <div className="mt-3">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={h.percent}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setHolders((list) => rebalance(list, i, val));
                                }}
                                onPointerUp={() => setTimeout(sortByPower, 0)}
                                onMouseUp={() => setTimeout(sortByPower, 0)}
                                onTouchEnd={() => setTimeout(sortByPower, 0)}
                                className="w-full h-2 rounded-full bg-white/10"
                                style={{ accentColor: rankColor }}
                              />
                            </div>
                          </div>

                          <div
                            className="shrink-0 rounded-xl px-3 py-1 text-purple-50 font-semibold"
                            style={{ backgroundColor: pillBg }}
                          >
                            {h.percent}%
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </LayoutGroup>

              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => {
                    if (initialHolders.current) setHolders(initialHolders.current);
                    setTimeout(sortByPower, 0);
                  }}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 bg-white/10 text-white hover:bg-white/15"
                >
                  <span className="text-lg">⚙️</span>
                  Reset
                </button>

                <button
                  onClick={() => {
                    setAnalysis({ ...analysisStore, holders });
                    push("/name");
                  }}
                  className="rounded-2xl px-5 py-3 font-semibold text-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0b1335] shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                >
                  Looks good →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sleek overlay while analyzing — no more background loading view */}
      <LoadingOverlay
        visible={loading || state === "loading"}
        title="Analyzing your world…"
        quotes={powerQuotes}
        periodMs={3000}
      />
    </div>
  );
}
