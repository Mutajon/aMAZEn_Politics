// src/screens/EventScreen.tsx
// Event Screen: generates a daily dilemma, narrates it, and shows action cards
// with dynamic Lucide icons + dark gradients (topic-aware, non-repeating).

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
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
import { useNarrator } from "../hooks/useNarrator";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------
type Props = { push?: (route: string) => void };
type Trio = { people: number; middle: number; mom: number };

// Card shape that ActionDeck expects (structural typing).
type ActionDeckCard = {
  id: "a" | "b" | "c";
  title: string;
  summary: string;
  cost: number;
  icon?: React.ReactNode;
  iconBgClass?: string;
  iconTextClass?: string;
  cardGradientClass?: string;
};

// ---------------------------------------------------------------------------
// Dynamic Lucide icon by name (lazy-loaded per icon to keep bundle small)
// ---------------------------------------------------------------------------
function DynamicLucide({ name, className }: { name: string; className?: string }) {
  const importFn = (dynamicIconImports as Record<string, () => Promise<{ default: React.ComponentType<any> }>>)[name];
  const Lazy = React.useMemo(() => (importFn ? React.lazy(importFn) : null), [importFn]);

  if (!Lazy) {
    // Small placeholder if the icon name isn't found
    return (
      <span
        className={
          className ? `${className} inline-block rounded-sm bg-white/20` : "inline-block w-4 h-4 rounded-sm bg-white/20"
        }
      />
    );
  }

  return (
    <Suspense
      fallback={
        <span
          className={
            className ? `${className} inline-block rounded-sm bg-white/20` : "inline-block w-4 h-4 rounded-sm bg-white/20"
          }
        />
      }
    >
      <Lazy className={className} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Visual mapping: choose icon + dark gradient per action
// * uses server-provided iconHint when available
// * otherwise keyword rules choose an icon + color family
// * color families have multiple variants so repeated topics don't look identical
// ---------------------------------------------------------------------------
function visualForAction(x: DilemmaAction) {
  type V = {
    iconName: string;
    familyKey: keyof typeof families;
    iconBgClass: string;
    iconTextClass: string;
    cardGradientClass: string;
  };

  const families = {
    security: {
      iconBgClass: "bg-rose-400/20",
      iconTextClass: "text-rose-100",
      variants: [
        "bg-gradient-to-br from-rose-950 via-rose-900 to-rose-950",
        "bg-gradient-to-br from-red-950 via-red-900 to-red-950",
        "bg-gradient-to-br from-rose-950 via-rose-800 to-rose-950",
      ],
      defaultIcon: "shield-alert",
    },
    speech: {
      iconBgClass: "bg-sky-400/20",
      iconTextClass: "text-sky-100",
      variants: [
        "bg-gradient-to-br from-sky-950 via-sky-900 to-sky-950",
        "bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950",
        "bg-gradient-to-br from-cyan-950 via-cyan-900 to-cyan-950",
      ],
      defaultIcon: "megaphone",
    },
    diplomacy: {
      iconBgClass: "bg-emerald-400/20",
      iconTextClass: "text-emerald-100",
      variants: [
        "bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950",
        "bg-gradient-to-br from-teal-950 via-teal-900 to-teal-950",
        "bg-gradient-to-br from-green-950 via-green-900 to-green-950",
      ],
      defaultIcon: "handshake",
    },
    money: {
      iconBgClass: "bg-amber-400/20",
      iconTextClass: "text-amber-100",
      variants: [
        "bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950",
        "bg-gradient-to-br from-yellow-950 via-yellow-900 to-yellow-950",
        "bg-gradient-to-br from-orange-950 via-orange-900 to-orange-950",
      ],
      defaultIcon: "coins",
    },
    tech: {
      iconBgClass: "bg-violet-400/20",
      iconTextClass: "text-violet-100",
      variants: [
        "bg-gradient-to-br from-violet-950 via-violet-900 to-violet-950",
        "bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950",
        "bg-gradient-to-br from-fuchsia-950 via-fuchsia-900 to-fuchsia-950",
      ],
      defaultIcon: "cpu",
    },
    heart: {
      iconBgClass: "bg-pink-400/20",
      iconTextClass: "text-pink-100",
      variants: [
        "bg-gradient-to-br from-pink-950 via-pink-900 to-pink-950",
        "bg-gradient-to-br from-rose-950 via-rose-900 to-rose-950",
        "bg-gradient-to-br from-fuchsia-950 via-fuchsia-900 to-fuchsia-950",
      ],
      defaultIcon: "heart",
    },
    scale: {
      iconBgClass: "bg-indigo-400/20",
      iconTextClass: "text-indigo-100",
      variants: [
        "bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-950",
        "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950",
        "bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950",
      ],
      defaultIcon: "scale",
    },
    build: {
      iconBgClass: "bg-stone-400/20",
      iconTextClass: "text-stone-100",
      variants: [
        "bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950",
        "bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950",
        "bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950",
      ],
      defaultIcon: "hammer",
    },
    nature: {
      iconBgClass: "bg-green-400/20",
      iconTextClass: "text-green-100",
      variants: [
        "bg-gradient-to-br from-green-950 via-green-900 to-green-950",
        "bg-gradient-to-br from-lime-950 via-lime-900 to-lime-950",
        "bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950",
      ],
      defaultIcon: "leaf",
    },
    energy: {
      iconBgClass: "bg-yellow-400/20",
      iconTextClass: "text-yellow-100",
      variants: [
        "bg-gradient-to-br from-yellow-950 via-yellow-900 to-yellow-950",
        "bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950",
        "bg-gradient-to-br from-orange-950 via-orange-900 to-orange-950",
      ],
      defaultIcon: "zap",
    },
    civic: {
      iconBgClass: "bg-teal-400/20",
      iconTextClass: "text-teal-100",
      variants: [
        "bg-gradient-to-br from-teal-950 via-teal-900 to-teal-950",
        "bg-gradient-to-br from-cyan-950 via-cyan-900 to-cyan-950",
        "bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950",
      ],
      defaultIcon: "graduation-cap",
    },
  };

  // Prefer server-provided hint first
  const hint = String((x as any)?.iconHint || "").toLowerCase() as keyof typeof families;
  if (hint && families[hint]) {
    const f = families[hint];
    return {
      iconName: f.defaultIcon,
      familyKey: hint,
      iconBgClass: f.iconBgClass,
      iconTextClass: f.iconTextClass,
      cardGradientClass: f.variants[0],
    } as V;
  }

  // Keyword rules → icon + family
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
    if (re.test(text)) {
      const f = families[fam];
      return {
        iconName,
        familyKey: fam,
        iconBgClass: f.iconBgClass,
        iconTextClass: f.iconTextClass,
        cardGradientClass: f.variants[0],
      } as V;
    }
  }

  // Default → speech/blue
  const f = families.speech;
  return {
    iconName: f.defaultIcon,
    familyKey: "speech",
    iconBgClass: f.iconBgClass,
    iconTextClass: f.iconTextClass,
    cardGradientClass: f.variants[0],
  } as V;
}

// Build full deck cards and de-duplicate gradients when families repeat.
function actionsToDeckCards(a: DilemmaAction[]): ActionDeckCard[] {
  const mapped = a.slice(0, 3).map((x, i) => {
    const id = (["a", "b", "c"][i] || `a${i}`) as "a" | "b" | "c";
    const v = visualForAction(x);
    return {
      id,
      title: x.title,
      summary: x.summary,
      cost: x.cost,
      icon: <DynamicLucide name={v.iconName} className="w-4 h-4" />,
      iconBgClass: v.iconBgClass,
      iconTextClass: v.iconTextClass,
      cardGradientClass: v.cardGradientClass,
      __family: v.familyKey as string, // internal marker for second pass
    } as ActionDeckCard & { __family: string };
  });

  // family → gradient variants (same sets as in visualForAction)
  const variantsByFamily: Record<string, string[]> = {
    security: [
      "bg-gradient-to-br from-rose-950 via-rose-900 to-rose-950",
      "bg-gradient-to-br from-red-950 via-red-900 to-red-950",
      "bg-gradient-to-br from-rose-950 via-rose-800 to-rose-950",
    ],
    speech: [
      "bg-gradient-to-br from-sky-950 via-sky-900 to-sky-950",
      "bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950",
      "bg-gradient-to-br from-cyan-950 via-cyan-900 to-cyan-950",
    ],
    diplomacy: [
      "bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950",
      "bg-gradient-to-br from-teal-950 via-teal-900 to-teal-950",
      "bg-gradient-to-br from-green-950 via-green-900 to-green-950",
    ],
    money: [
      "bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950",
      "bg-gradient-to-br from-yellow-950 via-yellow-900 to-yellow-950",
      "bg-gradient-to-br from-orange-950 via-orange-900 to-orange-950",
    ],
    tech: [
      "bg-gradient-to-br from-violet-950 via-violet-900 to-violet-950",
      "bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950",
      "bg-gradient-to-br from-fuchsia-950 via-fuchsia-900 to-fuchsia-950",
    ],
    heart: [
      "bg-gradient-to-br from-pink-950 via-pink-900 to-pink-950",
      "bg-gradient-to-br from-rose-950 via-rose-900 to-rose-950",
      "bg-gradient-to-br from-fuchsia-950 via-fuchsia-900 to-fuchsia-950",
    ],
    scale: [
      "bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-950",
      "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950",
      "bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950",
    ],
    build: [
      "bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950",
      "bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950",
      "bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950",
    ],
    nature: [
      "bg-gradient-to-br from-green-950 via-green-900 to-green-950",
      "bg-gradient-to-br from-lime-950 via-lime-900 to-lime-950",
      "bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950",
    ],
    energy: [
      "bg-gradient-to-br from-yellow-950 via-yellow-900 to-yellow-950",
      "bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950",
      "bg-gradient-to-br from-orange-950 via-orange-900 to-orange-950",
    ],
    civic: [
      "bg-gradient-to-br from-teal-950 via-teal-900 to-teal-950",
      "bg-gradient-to-br from-cyan-950 via-cyan-900 to-cyan-950",
      "bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950",
    ],
  };

  // assign different variants for repeated families
  const idxByFamily: Record<string, number> = {};
  mapped.forEach((c) => {
    const fam = c.__family;
    const variants = variantsByFamily[fam] || [c.cardGradientClass || ""];
    const idx = (idxByFamily[fam] = (idxByFamily[fam] || 0));
    c.cardGradientClass = variants[idx % variants.length] || c.cardGradientClass;
    idxByFamily[fam] = idx + 1;
    delete (c as any).__family;
  });

  return mapped;
}

// ---------------------------------------------------------------------------
// TTS helpers
// ---------------------------------------------------------------------------
function narrationTextForDilemma(d: { title?: string; description?: string }) {
  const t = (d?.title || "").trim();
  const p = (d?.description || "").trim();
  return t && p ? `${t}. ${p}` : t || p || "";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EventScreen(_props: Props) {
  // Stores
  const debugMode = useSettingsStore((s) => s.debugMode);
  const { current, loadNext, loading, error, day, totalDays } = useDilemmaStore();

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

  // Budget + avatar
  const showBudget = useSettingsStore((s) => s.showBudget);
  const [budget, setBudget] = useState(1500); // demo value
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
      name: "Congress",
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

  // Build the action deck from the current dilemma
  const actionsForDeck = useMemo<ActionDeckCard[]>(
    () => (current ? actionsToDeckCards(current.actions) : []),
    [current]
  );

  const overlayPreparing = !!current && !canShowDilemma; // hide dilemma until narration is ready

  return (
    <div className="min-h-[100dvh] px-5 py-5" style={bgStyle}>
      <div className="w-full max-w-xl mx-auto">
        <ResourceBar daysLeft={daysLeft} budget={budget} showBudget={showBudget} />

        {/* Support values (3 entities), animated */}
        <SupportList items={items} animatePercent={true} animateDurationMs={1000} />

        {/* News ticker */}
        <NewsTickerDemo />

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

        <div className="mt-3">
          <div className={mirrorLoading ? "animate-pulse" : ""}>
            <MirrorCard text={mirrorText} />
          </div>
        </div>

        {canShowDilemma && current && (
          <ActionDeck
            actions={actionsForDeck}
            showBudget={showBudget}
            budget={budget}
            onConfirm={(id: "a" | "b" | "c") => {
              const a = actionsForDeck.find((x) => x.id === id);
              const delta = a?.cost ?? 0;
              if (showBudget) setBudget((b) => b + delta);
            }}
            onSuggest={(_text?: string) => {
              if (showBudget) setBudget((b) => b - 300);
            }}
          />
        )}

        <EventLoadingOverlay show={loading || overlayPreparing} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// utils
// ---------------------------------------------------------------------------
function clampPercent(n: number) {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}
