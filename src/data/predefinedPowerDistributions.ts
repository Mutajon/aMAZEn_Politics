// src/data/predefinedPowerDistributions.ts
// Predefined power distribution analysis for the four preset roles
// This eliminates the need for AI analysis when players choose these roles

import type { AnalysisResult } from "../store/roleStore";

export const PREDEFINED_POWER_DISTRIBUTIONS: Record<string, AnalysisResult> = {
  "Citizen of the Assembly in Classical Athens": {
    systemName: "Democracy",
    systemDesc: "Major policy decisions are made by citizens voting directly in popular assemblies.",
    flavor: "Town-square politics, loud debate, lots decided by show of hands.",
    holders: [
      {
        name: "Assembly (Citizens)",
        percent: 60,
        icon: "🏛",
        note: "Adult male citizens debate and vote directly; primary legislative authority.",
        role: { A: true, E: true }, // Authors laws and erases executive overreach
        stype: { t: "Author", i: "+" } // Strong Author
      },
      {
        name: "Council (Boule)",
        percent: 18,
        icon: "📜",
        note: "Council of representatives prepares agendas and manages day-to-day administration.",
        role: { A: true, E: false }, // Authors agenda but limited erasure
        stype: { t: "Agent", i: "•" } // Implements Assembly will
      },
      {
        name: "Generals (Strategoi)",
        percent: 8,
        icon: "⚔️",
        note: "Elected military leaders with significant political sway, especially in wartime.",
        role: { A: false, E: false }, // Execute orders but don't author/erase
        stype: { t: "Actor", i: "•" } // Actors with conditional influence
      },
      {
        name: "Magistrates & Courts",
        percent: 9,
        icon: "⚖️",
        note: "Officials who enforce laws and preside over trials; many chosen by lot or election.",
        role: { A: false, E: true }, // Erase through judicial review
        stype: { t: "Eraser", i: "•" } // Moderate Eraser
      },
      {
        name: "Non‑Citizen Influencers",
        percent: 5,
        icon: "👥",
        note: "Metics, women, slaves, and wealthy patrons affecting policy indirectly.",
        role: { A: false, E: false }, // No formal power
        stype: { t: "Acolyte", i: "-" } // Minimal agency
      }
    ],
    playerIndex: 0,
    e12: {
      tierI: ["Security", "CivilLib", "InfoOrder"],
      tierII: ["Justice", "Economy", "Diplomacy"],
      tierIII: ["Infrastructure", "Curricula"],
      stopA: false, // Military does not escalate at will
      stopB: false, // No executive consolidation
      decisive: ["Assembly (Citizens)", "Magistrates & Courts"]
    },
    grounding: {
      settingType: "real",
      era: "Classical Athens, 5th century BCE"
    }
  },

  "Senator of the Roman Republic": {
    systemName: "Republican Oligarchy",
    systemDesc: "Political power concentrated in senatorial elite with formal institutions dominated by a few families.",
    flavor: "An aristocratic res publica where senatorial houses steer policy through patronage and prestige.",
    holders: [
      {
        name: "Senatorial Elite",
        percent: 45,
        icon: "🏛",
        note: "Hereditary & aristocratic families who control legislation, senatorial decrees.",
        role: { A: true, E: true }, // Authors and erases through influence
        stype: { t: "Author", i: "+" } // Strong Author
      },
      {
        name: "Consuls & Magistrates",
        percent: 20,
        icon: "⚖️",
        note: "Elected executives who implement policy, command authority, and preside over assemblies.",
        role: { A: true, E: false }, // Authors decrees but limited veto
        stype: { t: "Author", i: "•" } // Moderate Author
      },
      {
        name: "Equestrian/Wealth Class",
        percent: 15,
        icon: "💼",
        note: "Wealthy non-senatorial elites influencing finance, contracts, and provincial administration.",
        role: { A: false, E: false }, // Influence but no formal authority
        stype: { t: "Actor", i: "•" } // Economic actors
      },
      {
        name: "Popular Assemblies",
        percent: 15,
        icon: "🗳",
        note: "Citizen bodies with formal voting power, often guided by elite proposals and patronage.",
        role: { A: false, E: true }, // Can veto but don't initiate
        stype: { t: "Eraser", i: "-" } // Weak Eraser (manipulated)
      },
      {
        name: "Military Leaders",
        percent: 5,
        icon: "🛡",
        note: "Generals whose command of troops grants bargaining power and political leverage.",
        role: { A: false, E: false }, // Execute orders
        stype: { t: "Actor", i: "-" } // Conditional actors
      }
    ],
    playerIndex: 0,
    e12: {
      tierI: ["Security", "InfoOrder", "CivilLib"],
      tierII: ["Economy", "Appointments", "Justice", "Diplomacy"],
      tierIII: ["Infrastructure", "Curricula"],
      stopA: false, // Military restrained by Senate
      stopB: false, // Power distributed among offices
      decisive: ["Senatorial Elite", "Consuls & Magistrates"]
    },
    grounding: {
      settingType: "real",
      era: "Roman Republic, 3rd century BCE"
    }
  },

  "Emperor of Tang China": {
    systemName: "Theocratic Monarchy",
    systemDesc: "A hereditary sovereign claims legitimacy from divine mandate; emperor holds supreme legal authority.",
    flavor: "The Son of Heaven sits at the center of court intrigue, scholar-official rule, and regional power-brokers.",
    holders: [
      {
        name: "Emperor",
        percent: 40,
        icon: "👑",
        note: "Formal sovereign with ultimate legal authority and ritual legitimacy (Mandate of Heaven).",
        role: { A: true, E: true }, // Authors and erases through decree
        stype: { t: "Dictator", i: "+" } // Strong Dictator (de jure absolute)
      },
      {
        name: "Imperial Bureaucracy",
        percent: 25,
        icon: "📜",
        note: "Meritocratic scholar-officials (chancellors, ministries) who run administration and draft policy.",
        role: { A: true, E: false }, // Authors implementation but can't veto Emperor
        stype: { t: "Agent", i: "+" } // Strong agents (filter Emperor's will)
      },
      {
        name: "Aristocratic Clans",
        percent: 15,
        icon: "🏺",
        note: "Powerful noble families that influence court appointments, marriage alliances, and patronage.",
        role: { A: false, E: false }, // Influence but no formal authority
        stype: { t: "Actor", i: "•" } // Social/economic actors
      },
      {
        name: "Regional Military Governors",
        percent: 12,
        icon: "⚔️",
        note: "Jiedushi and generals who control troops and local resources; can check central authority.",
        role: { A: false, E: true }, // Can resist/veto central directives
        stype: { t: "Eraser", i: "•" } // Regional erasers
      },
      {
        name: "Eunuch & Court Factions",
        percent: 8,
        icon: "🎭",
        note: "Palace insiders who broker access and information, often meddling in succession and policy.",
        role: { A: false, E: false }, // Manipulate but don't formally decide
        stype: { t: "Actor", i: "-" } // Behind-the-scenes actors
      }
    ],
    playerIndex: 0,
    e12: {
      tierI: ["Security", "Appointments", "InfoOrder"],
      tierII: ["Economy", "Justice", "Diplomacy"],
      tierIII: ["Infrastructure", "Curricula", "Healthcare"],
      stopA: false, // Military governors restrained
      stopB: true, // Emperor accumulates pen+eraser across domains
      decisive: ["Emperor", "Imperial Bureaucracy"]
    },
    grounding: {
      settingType: "real",
      era: "Tang Dynasty China, 8th century AD"
    }
  },

  "Chancellor of Modern Germany": {
    systemName: "Republican Oligarchy",
    systemDesc: "Government is formed from and accountable to an elected legislature; executive depends on parliamentary confidence.",
    flavor: "Coalition-driven executive in a federal, consensus-oriented polity.",
    holders: [
      {
        name: "Parliament (Bundestag & Parties)",
        percent: 38,
        icon: "🏛",
        note: "Primary lawmaking body and source of confidence for governments.",
        role: { A: true, E: true }, // Authors laws and can withdraw confidence
        stype: { t: "Author", i: "+" } // Strong Author (legislative primacy)
      },
      {
        name: "Chancellor & Cabinet",
        percent: 30,
        icon: "👔",
        note: "Executive leadership, implements policy but reliant on parliamentary support.",
        role: { A: true, E: false }, // Authors executive orders but can't veto legislature
        stype: { t: "Author", i: "•" } // Moderate Author (constrained)
      },
      {
        name: "State Governments (Länder / Bundesrat)",
        percent: 18,
        icon: "🏙",
        note: "Regional authority with influence via Bundesrat and policy domains.",
        role: { A: true, E: true }, // Authors regional policy and vetoes federal laws
        stype: { t: "Author", i: "•" } // Moderate Author+Eraser (federalism)
      },
      {
        name: "Judiciary (Constitutional Court & courts)",
        percent: 7,
        icon: "⚖️",
        note: "Judicial review and rights protection.",
        role: { A: false, E: true }, // Erases unconstitutional laws
        stype: { t: "Eraser", i: "+" } // Strong Eraser (constitutional review)
      },
      {
        name: "Federal President",
        percent: 7,
        icon: "🕊",
        note: "Ceremonial head with limited reserve powers.",
        role: { A: false, E: false }, // Symbolic, minimal authority
        stype: { t: "Acolyte", i: "•" } // Figurehead
      }
    ],
    playerIndex: 1,
    e12: {
      tierI: ["CivilLib", "InfoOrder", "Security"],
      tierII: ["Economy", "Justice", "Appointments", "Diplomacy"],
      tierIII: ["Healthcare", "Infrastructure", "Environment", "Immigration"],
      stopA: false, // Civilian control of military
      stopB: false, // Power distributed among Parliament, Chancellor, Länder, Courts
      decisive: ["Parliament (Bundestag & Parties)", "Judiciary (Constitutional Court & courts)"]
    },
    grounding: {
      settingType: "real",
      era: "Federal Republic of Germany, 21st century"
    }
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
