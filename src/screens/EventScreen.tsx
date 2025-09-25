// src/screens/EventScreen.tsx
// Event Screen scaffold + TEMP test controls, using shared bgStyle.
// This version feeds ActionDeck ONLY the AI-generated actions (no demo cards).

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { bgStyle } from "../lib/ui";
import ResourceBar from "../components/event/ResourceBar";
import SupportList, { type SupportItem, DefaultSupportIcons } from "../components/event/SupportList";
import { NewsTickerDemo } from "../components/event/NewsTicker";
import PlayerStatusStrip, { demoParams } from "../components/event/PlayerStatusStrip";
import { useRoleStore } from "../store/roleStore";
import DilemmaCard, { demoDilemma } from "../components/event/DilemmaCard";
import MirrorCard, { demoMirrorLine } from "../components/event/MirrorCard";
import ActionDeck from "../components/event/ActionDeck";
import { useSettingsStore } from "../store/settingsStore";
import { useDilemmaStore } from "../store/dilemmaStore";
import type { DilemmaAction } from "../lib/dilemma";
import { requestMirrorDilemmaLine } from "../lib/mirrorDilemma";
import EventLoadingOverlay from "../components/event/EventLoadingOverlay";
import { dynamicIconImports } from "lucide-react/dynamic";


type Props = { push?: (route: string) => void };
type Trio = { people: number; middle: number; mom: number };
// Card shape expected by ActionDeck (structural typing; no module export needed)
type ActionDeckCard = {
  id: "a" | "b" | "c";
  title: string;
  summary: string;
  cost: number;
  icon?: React.ReactNode;          // JSX for the Lucide icon (we supply <DynamicLucide />)
  iconBgClass?: string;            // small chip behind the icon
  iconTextClass?: string;          // icon color
  cardGradientClass?: string;      // dark gradient background for the card
};


/**
 * Renders any Lucide icon by *string* name (kebab-case), code-split via dynamic import.
 * Example: <DynamicLucide name="factory" className="w-4 h-4" />
 * If the name is unknown, shows a small placeholder square.
 */
function DynamicLucide({ name, className }: { name: string; className?: string }) {
  // `dynamicIconImports` has keys in kebab-case, e.g. "graduation-cap", "shield-alert"
  const importFn = (dynamicIconImports as Record<string, () => Promise<{ default: React.ComponentType<any> }>>)[name];

  // Memoize the lazy component per icon name
  const Lazy = React.useMemo(() => (importFn ? React.lazy(importFn) : null), [importFn]);

  if (!Lazy) {
    return <span className={className ? `${className} inline-block rounded-sm bg-white/20` : "inline-block w-4 h-4 rounded-sm bg-white/20"} />;
  }

  return (
    <Suspense fallback={<span className={className ? `${className} inline-block rounded-sm bg-white/20` : "inline-block w-4 h-4 rounded-sm bg-white/20"} />}>
      <Lazy className={className} />
    </Suspense>
  );
}

/**
 * Pick a Lucide icon *name* and a dark gradient based on:
 *  1) server-provided iconHint ("security" | "speech" | "diplomacy" | "money" | "tech" | "heart" | "scale")
 *  2) keyword heuristics on title+summary (many categories, easily extendable)
 *
 * Returns { iconName, iconBgClass, iconTextClass, cardGradientClass }.
 */
function visualForAction(x: DilemmaAction) {
  type V = { iconName: string; iconBgClass: string; iconTextClass: string; cardGradientClass: string };

  const families: Record<string, Omit<V, "iconName">> = {
    security:   { iconBgClass: "bg-rose-400/20",     iconTextClass: "text-rose-100",     cardGradientClass: "bg-gradient-to-br from-rose-950 via-rose-900 to-rose-950" },
    speech:     { iconBgClass: "bg-sky-400/20",      iconTextClass: "text-sky-100",      cardGradientClass: "bg-gradient-to-br from-sky-950 via-sky-900 to-sky-950"   },
    diplomacy:  { iconBgClass: "bg-emerald-400/20",  iconTextClass: "text-emerald-100",  cardGradientClass: "bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950" },
    money:      { iconBgClass: "bg-amber-400/20",    iconTextClass: "text-amber-100",    cardGradientClass: "bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950" },
    tech:       { iconBgClass: "bg-violet-400/20",   iconTextClass: "text-violet-100",   cardGradientClass: "bg-gradient-to-br from-violet-950 via-violet-900 to-violet-950" },
    heart:      { iconBgClass: "bg-pink-400/20",     iconTextClass: "text-pink-100",     cardGradientClass: "bg-gradient-to-br from-pink-950 via-pink-900 to-pink-950" },
    scale:      { iconBgClass: "bg-indigo-400/20",   iconTextClass: "text-indigo-100",   cardGradientClass: "bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-950" },
    build:      { iconBgClass: "bg-stone-400/20",    iconTextClass: "text-stone-100",    cardGradientClass: "bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950" },
    civic:      { iconBgClass: "bg-teal-400/20",     iconTextClass: "text-teal-100",     cardGradientClass: "bg-gradient-to-br from-teal-950 via-teal-900 to-teal-950" },
    nature:     { iconBgClass: "bg-green-400/20",    iconTextClass: "text-green-100",    cardGradientClass: "bg-gradient-to-br from-green-950 via-green-900 to-green-950" },
    energy:     { iconBgClass: "bg-yellow-400/20",   iconTextClass: "text-yellow-100",   cardGradientClass: "bg-gradient-to-br from-yellow-950 via-yellow-900 to-yellow-950" },
  };

  // 1) Prefer server hint → choose family + a representative iconName within that family.
  const hint = String(x?.iconHint || "").toLowerCase();
  const hintChoice: Record<string, string> = {
    security:  "shield-alert",
    speech:    "megaphone",
    diplomacy: "handshake",
    money:     "coins",
    tech:      "cpu",
    heart:     "heart",
    scale:     "scale",
  };

  if (hint && families[hint]) {
    return { iconName: hintChoice[hint] || "megaphone", ...families[hint] } as V;
  }

  // 2) Rich keyword → specific icon (kebab-case names straight from Lucide).
  const text = `${x?.title ?? ""} ${x?.summary ?? ""}`.toLowerCase();
  const rules: Array<[RegExp, string, keyof typeof families]> = [
    [/(tax|budget|fund|grant|loan|bond|treasury|fee|fine|subsid)/, "coins", "money"],
    [/(build|construct|infrastructure|bridge|road|rail|port|airport|housing|renovat)/, "hammer", "build"],
    [/(factory|industrial|manufact|plant|refinery)/, "factory", "build"],
    [/(school|education|teacher|university|college|curriculum)/, "graduation-cap", "civic"],
    [/(hospital|clinic|health|vaccine|medicine|pandemic|epidemic)/, "hospital", "heart"],
    [/(police|curfew|security|military|army|guard|jail|ban|crackdown)/, "shield-alert", "security"],
    [/(speech|address|broadcast|press|media|announce|campaign)/, "megaphone", "speech"],
    [/(negotia|treaty|accord|ceasefire|dialogue|mediate)/, "handshake", "diplomacy"],
    [/(law|court|legal|judic|regulat|ethic|oversight)/, "scale", "scale"],
    [/(research|science|lab|experiment|study)/, "flask-conical", "tech"],
    [/(technology|ai\b|data|digital|software|network|server|cloud)/, "cpu", "tech"],
    [/(environment|climate|forest|tree|green|conservation|wildlife)/, "leaf", "nature"],
    [/(energy|electric|grid|power plant|renewable|solar|wind)/, "zap", "energy"],
    [/(housing|home|shelter|homeless)/, "home", "build"],
    [/(agriculture|farmer|crop|harvest)/, "wheat", "nature"],
    [/(water|drought|flood|river|dam)/, "droplets", "nature"],
    [/(culture|heritage|museum|art)/, "palette", "civic"],
    [/(privacy|surveillance|monitor|cctv)/, "eye", "security"],
    [/(border|immigration|refugee|asylum|citizen|visa)/, "globe", "diplomacy"],
  ];
  for (const [re, iconName, fam] of rules) {
    if (re.test(text)) return { iconName, ...families[fam] } as V;
  }

  // 3) Default
  return { iconName: "megaphone", ...families.speech } as V;
}

/** Map AI actions → full ActionDeck cards (with icon + gradient). */
function actionsToDeckCards(a: DilemmaAction[]): ActionDeckCard[] {
  return a.slice(0, 3).map((x, i) => {
    const id = (["a", "b", "c"][i] || `a${i}`) as "a" | "b" | "c";
    const v = visualForAction(x);
    return {
      id,
      title: x.title,
      summary: x.summary,
      cost: x.cost,
      icon: <DynamicLucide name={v.iconName} className="w-4 h-4" />, // ← any Lucide icon by name
      iconBgClass: v.iconBgClass,
      iconTextClass: v.iconTextClass,
      cardGradientClass: v.cardGradientClass,
    };
  });
}


export default function EventScreen(_props: Props) {
  // Stores
  const debugMode = useSettingsStore((s) => s.debugMode);
  const { current, loadNext, loading, error, day, totalDays } = useDilemmaStore();

  // Auto-load a dilemma when the screen mounts (or when returning to it)
  useEffect(() => {
    if (!current && !loading && !error) {
      loadNext();
    }
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

  // Budget + avatar
  const showBudget = useSettingsStore((s) => s.showBudget);
  const [budget, setBudget] = useState(1500); // demo budget, replace later with a store if needed
  const avatarUrl = useRoleStore((s) => s.character?.avatarUrl ?? null);

  // Support trio local demo state
  const [vals, setVals] = useState<Trio>({ people: 50, middle: 50, mom: 50 });
  const [delta, setDelta] = useState<number | null>(null);
  const [trend, setTrend] = useState<"up" | "down" | null>(null);

  const items: SupportItem[] = [
    {
      id: "people",
      name: "The People",
      percent: vals.people,
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

  // Build the deck ONLY from AI data
  const actionsForDeck = useMemo<ActionDeckCard[]>(
    () => (current ? actionsToDeckCards(current.actions) : []),
    [current]
  );

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
          avatarSrc={avatarUrl || undefined}
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
          onConfirm={(id: "a" | "b" | "c") => {
            const a = actionsForDeck.find((x) => x.id === id);
            const delta = (a?.cost ?? 0);
            if (showBudget) setBudget((b) => b + delta);
          }}
          onSuggest={(_text?: string) => {
            if (showBudget) setBudget((b) => b - 300);
          }}
        />

        <EventLoadingOverlay show={loading} />
      </div>
    </div>
  );
}

// utils
function clampPercent(n: number) {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}
