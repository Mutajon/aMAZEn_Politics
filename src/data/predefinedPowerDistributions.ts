// src/data/predefinedPowerDistributions.ts
// Predefined power distribution analysis for the four preset roles
// This eliminates the need for AI analysis when players choose these roles

import type { AnalysisResult } from "../store/roleStore";

export const PREDEFINED_POWER_DISTRIBUTIONS: Record<string, AnalysisResult> = {
  "Citizen of the Assembly in Classical Athens": {
    systemName: "Direct Democracy",
    systemDesc: "Major policy decisions are made by citizens voting directly in popular assemblies rather than through full-time representatives.",
    flavor: "Town-square politics, loud debate, lots decided by show of hands.",
    holders: [
      {
        name: "Assembly (Citizens)",
        percent: 60,
        icon: "🏛",
        note: "Adult male citizens debate and vote directly; primary legislative authority."
      },
      {
        name: "Council (Boule)",
        percent: 18,
        icon: "📜",
        note: "Council of representatives prepares agendas and manages day-to-day administration."
      },
      {
        name: "Generals (Strategoi)",
        percent: 8,
        icon: "⚔️",
        note: "Elected military leaders with significant political sway, especially in wartime."
      },
      {
        name: "Magistrates & Courts",
        percent: 9,
        icon: "⚖️",
        note: "Officials who enforce laws and preside over trials; many chosen by lot or election."
      },
      {
        name: "Non‑Citizen Influencers",
        percent: 5,
        icon: "👥",
        note: "Metics, women, slaves, and wealthy patrons affecting policy indirectly."
      }
    ],
    playerIndex: 0
  },

  "Senator of the Roman Republic": {
    systemName: "Oligarchy",
    systemDesc: "Political power concentrated in the hands of a narrow elite or oligarchic council; formal institutions exist but are dominated by a few families or factions.",
    flavor: "An aristocratic res publica where senatorial houses, magistrates, and wealthy interests steer policy through patronage and prestige.",
    holders: [
      {
        name: "Senatorial Elite",
        percent: 45,
        icon: "🏛",
        note: "Hereditary & aristocratic families who control legislation, senatorial decrees."
      },
      {
        name: "Consuls & Magistrates",
        percent: 20,
        icon: "⚖️",
        note: "Elected executives who implement policy, command authority, and preside over assemblies."
      },
      {
        name: "Equestrian/Wealth Class",
        percent: 15,
        icon: "💼",
        note: "Wealthy non-senatorial elites influencing finance, contracts, and provincial administration."
      },
      {
        name: "Popular Assemblies",
        percent: 15,
        icon: "🗳",
        note: "Citizen bodies with formal voting power, often guided by elite proposals and patronage."
      },
      {
        name: "Military Leaders",
        percent: 5,
        icon: "🛡",
        note: "Generals whose command of troops grants bargaining power and political leverage."
      }
    ],
    playerIndex: 0
  },

  "Emperor of Tang China": {
    systemName: "Divine Right Monarchy",
    systemDesc: "A hereditary sovereign claims legitimacy from a divine mandate; the emperor holds supreme legal authority while courts, nobles and military actors exert practical checks.",
    flavor: "The Son of Heaven sits at the center of court intrigue, scholar-official rule, and regional power-brokers.",
    holders: [
      {
        name: "Emperor",
        percent: 40,
        icon: "👑",
        note: "Formal sovereign with ultimate legal authority and ritual legitimacy (Mandate of Heaven)."
      },
      {
        name: "Imperial Bureaucracy",
        percent: 25,
        icon: "📜",
        note: "Meritocratic scholar-officials (chancellors, ministries) who run administration and draft policy."
      },
      {
        name: "Aristocratic Clans",
        percent: 15,
        icon: "🏺",
        note: "Powerful noble families that influence court appointments, marriage alliances, and patronage."
      },
      {
        name: "Regional Military Governors",
        percent: 12,
        icon: "⚔️",
        note: "Jiedushi and generals who control troops and local resources; can check central authority."
      },
      {
        name: "Eunuch & Court Factions",
        percent: 8,
        icon: "🎭",
        note: "Palace insiders who broker access and information, often meddling in succession and policy."
      }
    ],
    playerIndex: 0
  },

  "Chancellor of Modern Germany": {
    systemName: "Parliamentary Democracy",
    systemDesc: "Government is formed from and accountable to an elected legislature; the head of government depends on parliamentary confidence.",
    flavor: "Coalition-driven executive in a federal, consensus-oriented polity.",
    holders: [
      {
        name: "Parliament (Bundestag & Parties)",
        percent: 38,
        icon: "🏛",
        note: "Primary lawmaking body and source of confidence for governments."
      },
      {
        name: "Chancellor & Cabinet",
        percent: 30,
        icon: "👔",
        note: "Executive leadership, implements policy but reliant on parliamentary support."
      },
      {
        name: "State Governments (Länder / Bundesrat)",
        percent: 18,
        icon: "🏙",
        note: "Regional authority with influence via Bundesrat and policy domains."
      },
      {
        name: "Judiciary (Constitutional Court & courts)",
        percent: 7,
        icon: "⚖️",
        note: "Judicial review and rights protection."
      },
      {
        name: "Federal President",
        percent: 7,
        icon: "🕊",
        note: "Ceremonial head with limited reserve powers."
      }
    ],
    playerIndex: 1
  }
};

// Helper function to get predefined power distribution for a role
export function getPredefinedPowerDistribution(roleLabel: string): AnalysisResult | null {
  return PREDEFINED_POWER_DISTRIBUTIONS[roleLabel] || null;
}

// Helper function to check if a role has predefined power distribution
export function hasPredefinedPowerDistribution(roleLabel: string): boolean {
  return roleLabel in PREDEFINED_POWER_DISTRIBUTIONS;
}
