// src/screens/EventScreen.tsx
// Event Screen: generates a daily dilemma, narrates it, and shows action cards
// with dynamic Lucide icons + dark gradients (topic-aware, non-repeating).

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
} from "react";

//
// Imports — Components
//
import { bgStyle } from "../lib/ui";
import ResourceBar from "../components/event/ResourceBar";
import SupportList, { type SupportItem, DefaultSupportIcons } from "../components/event/SupportList";
// replace the demo import:
import { NewsTicker} from "../components/event/NewsTicker";
import type { TickerItem } from "../components/event/NewsTicker";
import { fetchNewsTickerItems } from "../lib/newsTicker";

import PlayerStatusStrip, { demoParams } from "../components/event/PlayerStatusStrip";
import DilemmaCard, { demoDilemma } from "../components/event/DilemmaCard";
import MirrorCard, { demoMirrorLine } from "../components/event/MirrorCard";
import ActionDeck, { type ActionCard } from "../components/event/ActionDeck";
import EventLoadingOverlay from "../components/event/EventLoadingOverlay";
import CompassPillsOverlay from "../components/event/CompassPillsOverlay";

//
// Imports — Stores/Hooks
//
import { useSettingsStore } from "../store/settingsStore";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore, type PowerHolder } from "../store/roleStore";
import { useNarrator } from "../hooks/useNarrator";
import useCompassFX from "../hooks/useCompassFX";

//
// Imports — Lib helpers
//
import { requestMirrorDilemmaLine } from "../lib/mirrorDilemma";
import { analyzeTextToCompass } from "../lib/compassMapping";
import { runConfirmPipeline } from "../lib/eventConfirm";
import { actionsToDeckCards } from "../components/event/actionVisuals";
import { pickIconForHolder } from "../lib/powerHolderIcon";
import { narrationTextForDilemma } from "../lib/narration";
import { analyzeSupport, type SupportEffect } from "../lib/supportAnalysis";
import type { SupportEffectId } from "../lib/eventConfirm";

//
// Local types
//
type Props = { push?: (route: string) => void };
type Trio = { people: number; middle: number; mom: number };

//
// Constants
//
const EMPTY_HOLDERS: Readonly<PowerHolder[]> = Object.freeze([]);
// Keep support % in [0,100] and round to int
const clampPercent = (n: number): number =>
  Math.max(0, Math.min(100, Math.round(Number(n) || 0)));


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EventScreen(_props: Props) {
  // Stores
  const debugMode = useSettingsStore((s) => s.debugMode);
  const { current, loadNext, loading, error, day, totalDays } = useDilemmaStore();

  // Support trio local demo state
  const [vals, setVals] = useState<Trio>({ people: 50, middle: 50, mom: 50 });
  const [delta, setDelta] = useState<number | null>(null);
  const [trend, setTrend] = useState<"up" | "down" | null>(null);
  
  // Per-entity delta/trend for SupportList (so bars can show independent changes)
const [supportDeltas, setSupportDeltas] = useState<{ people: number | null; middle: number | null; mom: number | null }>({
  people: null,
  middle: null,
  mom: null,
});
const [supportTrends, setSupportTrends] = useState<{ people: "up" | "down" | null; middle: "up" | "down" | null; mom: "up" | "down" | null }>({
  people: null,
  middle: null,
  mom: null,
});
// Short witty reason per entity (wired into SupportList "note")
const [supportNotes, setSupportNotes] = useState<{ people: string; middle: string; mom: string }>({
  people: "",
  middle: "",
  mom: "",
});


  

  // --- Middle support entity dynamic label/icon (once per screen mount) ---
  const [middleLabel, setMiddleLabel] = useState<string>("Congress");
  const [middleIcon, setMiddleIcon] = useState<React.ReactNode>(
    <DefaultSupportIcons.BuildingIcon className="w-4 h-4" />
  );
  const didInitMiddleRef = useRef(false);

  // Pull holders & playerIndex from role analysis
  const holdersSnap = useRoleStore((s) => s.analysis?.holders as PowerHolder[] | undefined);
  const playerIndex = useRoleStore((s) => s.analysis?.playerIndex ?? null);

  useEffect(() => {
    // Narrow to a stable, typed array
    const holders: ReadonlyArray<PowerHolder> = holdersSnap ?? EMPTY_HOLDERS;

    if (didInitMiddleRef.current) return;
    if (holders.length === 0) return;

    // Map with explicit types, then exclude the player (if any)
    const withIndex: Array<PowerHolder & { i: number }> = holders.map(
      (h: PowerHolder, i: number) => ({ ...h, i })
    );
    const candidates: Array<PowerHolder & { i: number }> =
      playerIndex == null ? withIndex : withIndex.filter((h) => h.i !== playerIndex);

    if (candidates.length === 0) return;

    // Pick the highest percent among the rest
    const top = candidates.reduce((a, b) => (b.percent > a.percent ? b : a), candidates[0]);

    setMiddleLabel(top.name || "Congress");
    setMiddleIcon(pickIconForHolder(top.name || ""));
    didInitMiddleRef.current = true;
  }, [holdersSnap, playerIndex]);
  const selectedRole = useRoleStore((s) => s.selectedRole);
  const analysis = useRoleStore((s) => s.analysis);
  const [newsItems, setNewsItems] = useState<TickerItem[]>([]);
  const didInitNewsRef = useRef(false);
  
  // First day: generate 3 items about the player's entry
  useEffect(() => {
    if (!current) return;
    if (didInitNewsRef.current) return;
  
    if (day <= 1) {
      didInitNewsRef.current = true;
      fetchNewsTickerItems({
        day,
        role: selectedRole,
        systemName: analysis?.systemName,
        // epoch: optional; server will infer if omitted
        last: null,
      }).then((items) => setNewsItems(items));
    }
  }, [current, day, selectedRole, analysis?.systemName]);
  
  // Auto-load a dilemma when the screen mounts
  useEffect(() => {
    if (!current && !loading && !error) loadNext();
  }, [current, loading, error, loadNext]);

  const daysLeft = Math.max(0, totalDays - day + 1);

  // Mirror line
  const [mirrorText, setMirrorText] = useState(demoMirrorLine());
  const [mirrorLoading, setMirrorLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!current) return;
      setMirrorLoading(true);
      setMirrorText("…the mirror squints, light pooling in the glass…");
      const text = await requestMirrorDilemmaLine({ topWhat: [], topWhence: [], topOverall: [] });
      if (alive) {
        setMirrorText(text);
        setMirrorLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [current]);

  // ---- Narration for the current dilemma ----
  const narrationEnabled = useSettingsStore((s) => s.narrationEnabled !== false);
  const narrator = useNarrator();

  type PreparedTTSHandle = { start: () => Promise<void>; dispose: () => void } | null;
  const preparedDilemmaRef = useRef<PreparedTTSHandle>(null);
  const dilemmaPlayedRef = useRef(false);
  const [canShowDilemma, setCanShowDilemma] = useState(false);

  // Prepare narration whenever the dilemma changes
  useEffect(() => {
    const d = current;
    setCanShowDilemma(false);
    dilemmaPlayedRef.current = false;

    // cleanup previous audio
    preparedDilemmaRef.current?.dispose?.();
    preparedDilemmaRef.current = null;

    if (!d) return;

    let cancelled = false;
    (async () => {
      try {
        const speech = narrationTextForDilemma(d);
        if (!speech) {
          setCanShowDilemma(true);
          return;
        }
        const p = await narrator.prepare(speech, { voiceName: "alloy", format: "mp3" });
        if (cancelled) {
          p.dispose();
          return;
        }
        preparedDilemmaRef.current = p;
        setCanShowDilemma(true);
      } catch (e) {
        console.warn("[Event] TTS prepare failed; showing without audio:", e);
        setCanShowDilemma(true);
      }
    })();

    return () => {
      cancelled = true;
      preparedDilemmaRef.current?.dispose?.();
      preparedDilemmaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.title, current?.description]);

  // Start narration when we reveal the dilemma (once)
  useEffect(() => {
    if (!canShowDilemma) return;
    const p = preparedDilemmaRef.current;
    if (narrationEnabled && p && !dilemmaPlayedRef.current) {
      dilemmaPlayedRef.current = true;
      p.start().catch((e) => console.warn("[Event] TTS start blocked:", e));
    }
  }, [canShowDilemma, narrationEnabled]);


// 1) Fire AI to compute support effects (people/middle/mom)
function analyzeSupportWrapper(text: string) {
  const ctx = {
    systemName: analysis?.systemName || "",
    holders: Array.isArray(analysis?.holders)
      ? analysis!.holders.map((h) => ({ name: h.name, percent: h.percent }))
      : [],
    playerIndex: typeof analysis?.playerIndex === "number" ? analysis!.playerIndex : null,
    day: day || 1,
  };
  return analyzeSupport(text, ctx);
}


// 2) Apply effects locally: update percents, per-entity delta/trend
function applySupportEffects(effects: SupportEffect[]) {
  if (!effects?.length) return;

  // 1) Update percents + per-entity delta/trend
  setVals((prev) => {
    const next = { ...prev };
    const newDeltas: { people: number | null; middle: number | null; mom: number | null } = {
      people: null,
      middle: null,
      mom: null,
    };
    const newTrends: { people: "up" | "down" | null; middle: "up" | "down" | null; mom: "up" | "down" | null } = {
      people: null,
      middle: null,
      mom: null,
    };

    for (const e of effects) {
      const id = e.id as SupportEffectId;
      const before = next[id as keyof typeof next] as unknown as number;
      const after = clampPercent(before + e.delta);
      next[id as keyof typeof next] = after as any;

      newDeltas[id] = e.delta;
      newTrends[id] = e.delta > 0 ? "up" : e.delta < 0 ? "down" : null;
    }

    setSupportDeltas(newDeltas);
    setSupportTrends(newTrends);
    return next;
  });

  // 2) Store witty reason lines to display as SupportList "note"
  setSupportNotes((prev) => {
    const out = { ...prev };
    for (const e of effects) {
      if (e.id === "people" && e.explain) out.people = e.explain;
      if (e.id === "middle" && e.explain) out.middle = e.explain;
      if (e.id === "mom" && e.explain)    out.mom    = e.explain;
    }
    return out;
  });
}


  // Compass FX: keep pills until manual dismiss later (TTL 1h for now)
  const { applyWithPings, pings } = useCompassFX(60 * 60 * 1000);

  // Show spinner while we wait for the /api/compass-analyze response
  const [compassLoading, setCompassLoading] = useState(false);

  // Adapter for the pipeline: call analyzer and resolve
  const analyzeText = (t: string) => analyzeTextToCompass(t, applyWithPings).then(() => undefined);

  // Read Mirror text color so spinner matches it exactly
  const mirrorWrapRef = useRef<HTMLDivElement | null>(null);
  const [mirrorTextColor, setMirrorTextColor] = useState<string>("#7de8ff");
  useLayoutEffect(() => {
    if (!mirrorWrapRef.current) return;
    const root = mirrorWrapRef.current.firstElementChild as HTMLElement | null;
    if (!root) return;
    const c = getComputedStyle(root).color;
    if (c) setMirrorTextColor(c);
  }, [mirrorText]);

  // Budget + avatar
  const showBudget = useSettingsStore((s) => s.showBudget);
  const [budget, setBudget] = useState(1500); // demo value
  const avatarUrl = useRoleStore((s) => s.character?.avatarUrl ?? null);

  const items: SupportItem[] = [
    {
      id: "people",
      name: "The People",
      percent: vals.people,
      accentClass: "bg-emerald-600",
      icon: <DefaultSupportIcons.PeopleIcon className="w-4 h-4" />,
      moodVariant: "civic",
      delta: supportDeltas.people,     
    trend: supportTrends.people,
    note: supportNotes.people,
    },
    {
      id: "middle",
      name: middleLabel,
      percent: vals.middle,
      accentClass: "bg-amber-600",
      icon: middleIcon,
      moodVariant: "civic",
      delta: supportDeltas.middle,
    trend: supportTrends.middle,
    note: supportNotes.middle,
    },
    {
      id: "mom",
      name: "Mom",
      percent: vals.mom,
      accentClass: "bg-rose-600",
      icon: <DefaultSupportIcons.HeartIcon className="w-4 h-4" />,
      moodVariant: "empathetic",
      delta: supportDeltas.mom,
      trend: supportTrends.mom,
      note: supportNotes.mom,
    },
  ];

  // Build the action deck from the current dilemma
  const actionsForDeck = useMemo<ActionCard[]>(
    () => (current ? actionsToDeckCards(current.actions) : []),
    [current]
  );

  const overlayPreparing = !!current && !canShowDilemma; // hide dilemma until narration is ready

  return (
    <div className="min-h-[100dvh] px-5 py-5" style={bgStyle}>
      <div className="w-full max-w-xl mx-auto">
        <div
          className="
            sticky top-0 z-40
            -mx-5 px-5   /* stretch to page gutters, then restore padding */
            py-2
            bg-[#0b1335]/80 backdrop-blur-md
            border-b border-white/10
          "
          style={{ WebkitBackdropFilter: "blur(8px)" }} // improves Safari
        >
          <ResourceBar daysLeft={daysLeft} budget={budget} showBudget={showBudget} />
        </div>

        {/* Support values (3 entities), animated */}
        <SupportList items={items} animatePercent={true} animateDurationMs={1000} />

        
        {/* News ticker */}
        <NewsTicker items={newsItems} />


        {/* Player status strip: dynamic params (left) + portrait (right) */}
        <PlayerStatusStrip avatarSrc={avatarUrl || undefined} params={demoParams()} />

        {/* Dilemma + Actions (gated until narration is ready) */}
        <div className="mt-4">
          {canShowDilemma && current ? (
            <DilemmaCard title={current.title} description={current.description} />
          ) : (
            <DilemmaCard {...demoDilemma()} />
          )}
        </div>

        {debugMode && (
          <div className="mt-2">
            <button
              onClick={() => loadNext()}
              className="rounded-xl px-3 py-2 bg-white/10 ring-1 ring-white/15 text-white text-[12px]"
              disabled={loading}
            >
              {loading ? "Generating…" : "Generate (dev)"}
            </button>
          </div>
        )}

        <div className="mt-3 relative" ref={mirrorWrapRef}>
          <div className={mirrorLoading ? "animate-pulse" : ""}>
            <MirrorCard text={mirrorText} />
          </div>
          {/* Spinner + stacked pills ABOVE the mirror card; no interaction */}
          <CompassPillsOverlay effectPills={pings} loading={compassLoading} color={mirrorTextColor} />
        </div>

        {canShowDilemma && current && (
          <ActionDeck
            actions={actionsForDeck}
            showBudget={showBudget}
            budget={budget}
            onConfirm={async (id) => {
              const a = actionsForDeck.find((x) => x.id === id);
              if (!a) return;

              void runConfirmPipeline(
                {
                  kind: "action",
                  action: { title: a.title, summary: a.summary, cost: a.cost },
                },
                {
                  showBudget,
                  setBudget,
                  analyzeText,
                  onAnalyzeStart: () => setCompassLoading(true),
                  onAnalyzeDone: () => setCompassLoading(false),
                  analyzeSupport: analyzeSupportWrapper,
                  applySupportEffects,
                }
              );
              // AFTER runConfirmPipeline(...) (keep your existing code above intact)
void fetchNewsTickerItems({
  day: day + 0, // reacts to the just-made choice
  role: selectedRole,
  systemName: analysis?.systemName,
  last: { title: a.title, summary: a.summary, cost: a.cost },
}).then((items) => setNewsItems(items));

            }}
            onSuggest={(text?: string) => {
              void runConfirmPipeline(
                {
                  kind: "suggest",
                  text: text,
                  cost: -300, // keep in sync with ActionDeck's suggestCost
                },
                {
                  showBudget,
                  setBudget,
                  analyzeText,
                  onAnalyzeStart: () => setCompassLoading(true),
                  onAnalyzeDone: () => setCompassLoading(false),
                  analyzeSupport: analyzeSupportWrapper,
                  applySupportEffects,
                }
              );
              void fetchNewsTickerItems({
                day: day + 0,
                role: selectedRole,
                systemName: analysis?.systemName,
                last: { title: "Player suggestion", summary: String(text || "").slice(0, 140), cost: -300 },
              }).then((items) => setNewsItems(items));
              
            }}
            dilemma={{ title: current.title, description: current.description }}
          />
        )}

        <EventLoadingOverlay show={loading || overlayPreparing} />
      </div>
    </div>
  );
}
