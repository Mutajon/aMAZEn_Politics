// Event Screen scaffold + TEMP test controls, using shared bgStyle.

import { useState } from "react";
import { bgStyle } from "../lib/ui";
import ResourceBar from "../components/event/ResourceBar";
import SupportList, { type SupportItem, DefaultSupportIcons } from "../components/event/SupportList";
import { NewsTickerDemo } from "../components/event/NewsTicker";
import PlayerStatusStrip, { demoParams } from "../components/event/PlayerStatusStrip";
import { useRoleStore } from "../store/roleStore";
import DilemmaCard, { demoDilemma } from "../components/event/DilemmaCard";
import MirrorCard, { demoMirrorLine } from "../components/event/MirrorCard";
import ActionDeck, { demoActions } from "../components/event/ActionDeck";


type Props = { push?: (route: string) => void };
type Trio = { people: number; middle: number; mom: number };

export default function EventScreen(_props: Props) {
  // ✅ Hooks must be inside the component:
  const SHOW_BUDGET = true;        // ← set to false to hide budget everywhere
const [budget, setBudget] = useState(1500); // demo budget
  const avatarUrl = useRoleStore((s) => s.character?.avatarUrl ?? null);

  // Base values for the 3 supports
  const [vals, setVals] = useState<Trio>({ people: 50, middle: 50, mom: 50 });

  // Persisted change indicators; replaced whenever a new change happens
  const [delta, setDelta] = useState<number | null>(null);
  const [trend, setTrend] = useState<"up" | "down" | null>(null);

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
<ResourceBar daysLeft={7} budget={budget} showBudget={SHOW_BUDGET} />
  return (
    <div className="min-h-[100dvh] px-5 py-5" style={bgStyle}>
      <div className="w-full max-w-xl mx-auto">
        <ResourceBar daysLeft={7} budget={1500} />
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
  <DilemmaCard {...demoDilemma()} />
</div>
<div className="mt-3">
  <MirrorCard text={demoMirrorLine()} />
</div>
<ActionDeck
  actions={demoActions()}
  showBudget={SHOW_BUDGET}
  budget={budget}
  onConfirm={(id) => {
    // Demo: apply the cost to budget and log selection
    const card = demoActions().find((a) => a.id === id);
    const delta = (card?.cost ?? 0);
    if (SHOW_BUDGET) setBudget((b) => b + delta); // positive adds, negative subtracts
    console.log("Confirmed action:", id, "cost:", delta);
  }}
  onSuggest={() => {
    if (SHOW_BUDGET) setBudget((b) => b - 300);
    console.log("Suggested your own (cost -300)");
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
