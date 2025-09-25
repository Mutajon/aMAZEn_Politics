// Event Screen scaffold + TEMP test controls, using shared bgStyle.

import { useState, useEffect, useMemo } from "react";
import { bgStyle } from "../lib/ui";
import ResourceBar from "../components/event/ResourceBar";
import SupportList, { type SupportItem, DefaultSupportIcons } from "../components/event/SupportList";
import { NewsTickerDemo } from "../components/event/NewsTicker";
import PlayerStatusStrip, { demoParams } from "../components/event/PlayerStatusStrip";
import { useRoleStore } from "../store/roleStore";
import DilemmaCard, { demoDilemma } from "../components/event/DilemmaCard";
import MirrorCard, { demoMirrorLine } from "../components/event/MirrorCard";
import ActionDeck, { demoActions } from "../components/event/ActionDeck";
import { useSettingsStore } from "../store/settingsStore";
import { useDilemmaStore } from "../store/dilemmaStore";
import type { DilemmaAction } from "../lib/dilemma";
import { requestMirrorDilemmaLine } from "../lib/mirrorDilemma";
import { Coins, ShieldAlert, Megaphone, Handshake, Cpu, Heart, Scale } from "lucide-react";


type Props = { push?: (route: string) => void };
type Trio = { people: number; middle: number; mom: number };

// Replace your current mapActionsToCards with this content-only version:
function mapActionsToCards(a: DilemmaAction[]) {
  return a.slice(0, 3).map((x, i) => {
    const id = (["a", "b", "c"][i] || `a${i}`) as "a" | "b" | "c";
    return {
      id,
      title: x.title,
      summary: x.summary,
      cost: x.cost,
    };
  });
}

// Replace your mergeDeckActions with this safe overlay:
function mergeDeckActions(actions: DilemmaAction[]) {
  const base = demoActions();                 // deck’s native shape (has all the right keys)
  const mapped = mapActionsToCards(actions);  // our content (title/summary/cost only)
  const shape = base[0] || {};

  // Determine which keys the deck uses for title/text/cost
  const TITLE_KEY =
    ("title" in shape && "title") ||
    ("label" in shape && "label") ||
    ("heading" in shape && "heading") ||
    "title";

  const TEXT_KEY =
    ("summary" in shape && "summary") ||
    ("text" in shape && "text") ||
    ("body" in shape && "body") ||
    ("desc" in shape && "desc") ||
    "summary";

  const COST_KEYS = ["cost", "price", "budgetDelta"]; // write to all common options

  return base.slice(0, 3).map((b: any, i: number) => {
    const m = mapped[i];
    const id = (["a", "b", "c"][i] as "a" | "b" | "c");
    const out: any = { ...b, id }; // keep all deck visuals (icon/bg/flags/etc.)

    // Overwrite ONLY the content fields
    out[TITLE_KEY] = m?.title ?? b[TITLE_KEY];
    out[TEXT_KEY]  = m?.summary ?? b[TEXT_KEY];
    COST_KEYS.forEach(k => (out[k] = m?.cost));

    return out;
  });
}



export default function EventScreen(_props: Props) {
  //read the store
  const debugMode = useSettingsStore((s) => s.debugMode);
  const { current, loadNext, loading, day, totalDays, nextDay } = useDilemmaStore();
const daysLeft = Math.max(0, totalDays - day + 1);
const [mirrorText, setMirrorText] = useState(demoMirrorLine());
const [mirrorLoading, setMirrorLoading] = useState(false);
useEffect(() => {
  let alive = true;
  (async () => {
    if (!current) return;
    setMirrorLoading(true);
    // show an in-character placeholder immediately
    setMirrorText("…the mirror squints, light pooling in the glass…");

    const text = await requestMirrorDilemmaLine({
      // NEXT: we’ll pass real “top” values from the compass store
      topWhat: [], topWhence: [], topOverall: [],
    });

    if (alive) {
      setMirrorText(text);
      setMirrorLoading(false);
    }
  })();
  return () => { alive = false; };
}, [current]);





  // ✅ Hooks must be inside the component:
  const showBudget = useSettingsStore((s) => s.showBudget);
        // ← set to false to hide budget everywhere
const [budget, setBudget] = useState(1500); // demo budget
  const avatarUrl = useRoleStore((s) => s.character?.avatarUrl ?? null);

  // Base values for the 3 supports
  const [vals, setVals] = useState<Trio>({ people: 50, middle: 50, mom: 50 });

  // Persisted change indicators; replaced whenever a new change happens
  const [delta, setDelta] = useState<number | null>(null);
  const [trend, setTrend] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (!debugMode) return;
    // One sample object from each shape so we can compare keys in DevTools
    const demo = demoActions();
    console.log("[ActionDeck demoActions()[0]]", demo?.[0]);
    if (current) {
      console.log("[ActionDeck merged[0]]", mergeDeckActions(current.actions)[0]);
    }
  }, [debugMode, current]);

  const actionsForDeck = useMemo(
    () => (current ? mergeDeckActions(current.actions) : demoActions()),
    [current]
  );
  
  // Helper to apply +/- n to all, clamped 0..100
  function adjustAll(n: number) {
    setVals((prev) => ({
      people: clampPercent(prev.people + n),
      middle: clampPercent(prev.middle + n),
      mom: clampPercent(prev.mom + n),
    }));
    setDelta(n);                   // persists until next click
    setTrend(n > 0 ? "up" : n < 0 ? "down" : null);
  }

  const items: SupportItem[] = [
    {
      id: "people",
      name: "The People",
      percent: vals.people,
      // accentClass kept for compatibility with SupportList; color now comes from its tunables
      accentClass: "bg-emerald-600",
      icon: <DefaultSupportIcons.PeopleIcon className="w-4 h-4" />,
      moodVariant: "civic",
      delta,
      trend,
    },
    {
      id: "middle",
      name: "Congress", // will be dynamic later
      percent: vals.middle,
      accentClass: "bg-amber-600",
      icon: <DefaultSupportIcons.BuildingIcon className="w-4 h-4" />,
      moodVariant: "civic",
      delta,
      trend,
    },
    {
      id: "mom",
      name: "Mom",
      percent: vals.mom,
      accentClass: "bg-rose-600",
      icon: <DefaultSupportIcons.HeartIcon className="w-4 h-4" />,
      moodVariant: "empathetic",
      delta,
      trend,
    },
  ];

  return (
    <div className="min-h-[100dvh] px-5 py-5" style={bgStyle}>
      <div className="w-full max-w-xl mx-auto">
      <ResourceBar daysLeft={daysLeft} budget={budget} showBudget={showBudget} />

        {/* Support values (3 entities), animated */}
        <SupportList items={items} animatePercent={true} animateDurationMs={1000} />

        {/* News ticker */}
        <NewsTickerDemo />

        {/* Player status strip: dynamic params (left) + portrait (right) */}
        <PlayerStatusStrip
          avatarSrc={avatarUrl || undefined} // if empty string/null, show fallback icon
          params={demoParams()}               // three demo items for now
        />
    <div className="mt-4">
  {current ? (
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

<div className="mt-3">
<div className={mirrorLoading ? "animate-pulse" : ""}>
<MirrorCard text={mirrorText} />
</div>
</div>


<ActionDeck
  actions={actionsForDeck}
  showBudget={showBudget}
  budget={budget}
  onConfirm={(id) => {
    const a: any = actionsForDeck.find((x: any) => x.id === id);
    const delta =
      (a?.cost ?? a?.price ?? a?.budgetDelta ?? 0) as number;
    if (showBudget) setBudget((b) => b + delta);
  }}
  onSuggest={(_text) => {
    if (showBudget) setBudget((b) => b - 300);
  }}
/>



      </div>
    </div>
  );
}

// utils
function clampPercent(n: number) {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}
