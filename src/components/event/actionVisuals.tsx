// src/components/event/actionVisuals.tsx
// Visual helpers for ActionDeck: dynamic icons + topic gradients.

import React, { Suspense } from "react";
import { dynamicIconImports } from "lucide-react/dynamic";
import type { DilemmaAction } from "../../lib/dilemma";
import type { ActionCard } from "./ActionDeck";

// Dynamic Lucide icon by name (lazy-loaded per icon to keep bundle small)
export function DynamicLucide({ name, className }: { name: string; className?: string }) {
  const importFn = (dynamicIconImports as Record<string, () => Promise<{ default: React.ComponentType<any> }>>)[name];
  const Lazy = React.useMemo(() => (importFn ? React.lazy(importFn) : null), [importFn]);

  if (!Lazy) {
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

// Choose icon + dark gradient per action (uses server iconHint or keywords)
export function visualForAction(x: DilemmaAction) {
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
export function actionsToDeckCards(a: DilemmaAction[]): ActionCard[] {
  const variantsByFamily = {
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
  } as const;

  type Family = keyof typeof variantsByFamily;

  const familyOfIcon = (iconName: string): Family => {
    switch (iconName) {
      case "shield-alert":
      case "eye":
        return "security";
      case "megaphone":
        return "speech";
      case "handshake":
      case "globe":
        return "diplomacy";
      case "coins":
        return "money";
      case "cpu":
      case "flask-conical":
        return "tech";
      case "heart":
      case "hospital":
        return "heart";
      case "scale":
        return "scale";
      case "hammer":
      case "factory":
      case "home":
        return "build";
      case "graduation-cap":
      case "palette":
        return "civic";
      case "leaf":
      case "wheat":
      case "droplets":
        return "nature";
      case "zap":
        return "energy";
      default:
        return "speech";
    }
  };

  type Tmp = ActionCard & { __fam: Family };

  const tmp: Tmp[] = a.slice(0, 3).map((x, i) => {
    const v = visualForAction(x);
    const fam = familyOfIcon(v.iconName);
    const id = (["a", "b", "c"][i] || `a${i}`) as string;

    return {
      id,
      title: x.title,
      summary: x.summary,
      cost: x.cost,
      icon: <DynamicLucide name={v.iconName} className="w-4 h-4" />,
      iconBgClass: v.iconBgClass,
      iconTextClass: v.iconTextClass,
      cardGradientClass: v.cardGradientClass,
      __fam: fam,
    };
  });

  const idxByFamily: Partial<Record<Family, number>> = {};
  tmp.forEach((c) => {
    const list = variantsByFamily[c.__fam];
    const idx = idxByFamily[c.__fam] ?? 0;
    c.cardGradientClass = list[idx % list.length] || c.cardGradientClass;
    idxByFamily[c.__fam] = idx + 1;
  });

  return tmp.map(({ __fam, ...rest }) => rest);
}
