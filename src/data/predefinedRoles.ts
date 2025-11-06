// src/data/predefinedRoles.ts
// Centralized database for all predefined roles
// All role data (power distributions, characters, images, i18n keys) in one place
// This replaces the scattered data across multiple files

import type { AnalysisResult } from "../store/roleStore";
import { ROLE_SUPPORT_PROFILES } from "./supportProfiles";

export type RoleGoalStatus = "uncompleted" | "completed";

/**
 * Character data with i18n keys for name and prompt
 */
export interface CharacterKeys {
  nameKey: string;
  promptKey: string;
}

/**
 * Role characters (male/female/any) with i18n keys
 */
export interface RoleCharacters {
  male: CharacterKeys;
  female: CharacterKeys;
  any: CharacterKeys;
}

/**
 * Complete predefined role data structure
 */
export interface PredefinedRoleData {
  id: string;                          // Simple identifier (e.g., "athens_404")
  legacyKey: string;                   // Original key for backward compatibility
  titleKey: string;                    // i18n key for title
  subtitleKey: string;                 // i18n key for subtitle (2-4 word theme)
  introKey: string;                    // i18n key for intro paragraph
  youAreKey: string;                   // i18n key for role description
  year: string;                        // Year badge display
  imageId: string;                     // Image identifier for banner/full images
  roleScope: string;                   // In-world authority / what this role can actually do
  storyThemes: string[];               // Core thematic axes or domains to explore
  powerDistribution: AnalysisResult;   // Complete E-12 political system analysis
  characters: RoleCharacters;          // Character name options (male/female/any)
  scoreGoal: number;                   // Target score to mark role as completed
  defaultGoalStatus: RoleGoalStatus;   // Initial completion status
  defaultHighScore: number;            // Baseline high score (persisted separately)
}

/**
 * Centralized predefined roles database
 * All 10 preset roles with complete data
 */
export const PREDEFINED_ROLES_ARRAY: PredefinedRoleData[] = [
  {
    id: "athens_404",
    legacyKey: "Athens — The Day Democracy Died (-404)",
    titleKey: "ATHENS_TITLE",
    subtitleKey: "ATHENS_SUBTITLE",
    introKey: "ATHENS_INTRO",
    youAreKey: "ATHENS_YOU_ARE",
    year: "-404",
    imageId: "greece",
    roleScope: "Acts as a respected citizen on the oligarch-controlled civic council, influencing local decrees and relief efforts but never commanding the Spartan garrison.",
    storyThemes: ["autonomy_vs_heteronomy", "liberalism_vs_totalism", "reconciliation"],
    scoreGoal: 1000,
    defaultGoalStatus: "uncompleted",
    defaultHighScore: 0,
    powerDistribution: {
      systemName: "Hard-Power Oligarchy — Stratocracy",
      systemDesc: "Military-backed oligarchy: Spartan garrison with local rulers set rules; courts muted, citizens sidelined.",
      flavor: "Spartan steel props the new order; a few rule, most keep heads down.",
      holders: [
        {
          name: "Coercive Force",
          percent: 35,
          icon: "⚔️",
          note: "Spartan garrison and local enforcers",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Executive",
          percent: 30,
          icon: "👤",
          note: "Thirty rulers and their core allies",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Wealth",
          percent: 15,
          icon: "💰",
          note: "Elite backers fund and profit from seizures",
          role: { A: true, E: false },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "Bureaucracy",
          percent: 10,
          icon: "📜",
          note: "Clerks and boards under oligarch control",
          role: { A: false, E: false },
          stype: { t: "Agent", i: "•" }
        },
        {
          name: "Demos",
          percent: 10,
          icon: "👥",
          note: "Citizens/exiles; suppressed but restive",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "-" }
        }
      ],
      playerIndex: 1,
      challengerSeat: {
        name: "Coercive Force",
        percent: 35,
        index: 0
      },
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: true,
        stopB: true,
        decisive: ["Coercive Force", "Executive"]
      },
      grounding: {
        settingType: "real",
        era: "404–403 BCE Athens"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["Athens — The Day Democracy Died (-404)"] ?? null,
      roleScope: "Acts as a respected citizen on the oligarch-controlled civic council, influencing local decrees and relief efforts but never commanding the Spartan garrison.",
      storyThemes: ["autonomy_vs_heteronomy", "liberalism_vs_totalism", "reconciliation"]
    },
    characters: {
      male: {
        nameKey: "ATHENS_CHAR_MALE_NAME",
        promptKey: "ATHENS_CHAR_MALE_PROMPT"
      },
      female: {
        nameKey: "ATHENS_CHAR_FEMALE_NAME",
        promptKey: "ATHENS_CHAR_FEMALE_PROMPT"
      },
      any: {
        nameKey: "ATHENS_CHAR_ANY_NAME",
        promptKey: "ATHENS_CHAR_ANY_PROMPT"
      }
    }
  },

  {
    id: "alexandria_48",
    legacyKey: "Alexandria — Fire over the Nile (-48)",
    titleKey: "ALEXANDRIA_TITLE",
    subtitleKey: "ALEXANDRIA_SUBTITLE",
    introKey: "ALEXANDRIA_INTRO",
    youAreKey: "ALEXANDRIA_YOU_ARE",
    year: "-48",
    imageId: "alexandria",
    roleScope: "Serves as a city scholar-advisor mediating between palace factions and Roman commanders; can sway civic policy, archives, and urban defenses but not direct legions.",
    storyThemes: ["cultural_survival", "foreign_domination", "knowledge_vs_power"],
    scoreGoal: 1000,
    defaultGoalStatus: "uncompleted",
    defaultHighScore: 0,
    powerDistribution: {
      systemName: "Autocratizing (Military)",
      systemDesc: "Under siege, the foreign general and local army overrule the court; force sets terms, others adapt.",
      flavor: "Siege politics: swords pick rulers, scrolls risk the fire.",
      holders: [
        {
          name: "Roman General & Legions",
          percent: 40,
          icon: "🏛",
          note: "Foreign general holds city by force",
          role: { A: true, E: true },
          stype: { t: "Dictator", i: "+" }
        },
        {
          name: "Egyptian Army & Palace Guards",
          percent: 25,
          icon: "⚔️",
          note: "Besieges city; swaps leverage into terms",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Royal Court (Cleopatra/Ptolemy)",
          percent: 15,
          icon: "👑",
          note: "Decrees depend on which army backs them",
          role: { A: true, E: false },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "City Wealth & Grain Merchants",
          percent: 12,
          icon: "💰",
          note: "Funds supplies; rations shape endurance",
          role: { A: true, E: false },
          stype: { t: "Author", i: "-" }
        },
        {
          name: "Alexandrian Crowd & Dockworkers",
          percent: 8,
          icon: "👥",
          note: "Riots and harbor labor can tip moments",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "•" }
        }
      ],
      playerIndex: 2,
      challengerSeat: {
        name: "Roman General & Legions",
        percent: 40,
        index: 0
      },
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: true,
        stopB: false,
        decisive: ["Roman General & Legions", "Egyptian Army & Palace Guards", "Royal Court (Cleopatra/Ptolemy)"]
      },
      grounding: {
        settingType: "real",
        era: "48–47 BCE Alexandria"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["Alexandria — Fire over the Nile (-48)"] ?? null,
      roleScope: "Serves as a city scholar-advisor mediating between palace factions and Roman commanders; can sway civic policy, archives, and urban defenses but not direct legions.",
      storyThemes: ["cultural_survival", "foreign_domination", "knowledge_vs_power"]
    },
    characters: {
      male: {
        nameKey: "ALEXANDRIA_CHAR_MALE_NAME",
        promptKey: "ALEXANDRIA_CHAR_MALE_PROMPT"
      },
      female: {
        nameKey: "ALEXANDRIA_CHAR_FEMALE_NAME",
        promptKey: "ALEXANDRIA_CHAR_FEMALE_PROMPT"
      },
      any: {
        nameKey: "ALEXANDRIA_CHAR_ANY_NAME",
        promptKey: "ALEXANDRIA_CHAR_ANY_PROMPT"
      }
    }
  },

  {
    id: "florence_1494",
    legacyKey: "Florence — The Fire and the Faith (1494)",
    titleKey: "FLORENCE_TITLE",
    subtitleKey: "FLORENCE_SUBTITLE",
    introKey: "FLORENCE_INTRO",
    youAreKey: "FLORENCE_YOU_ARE",
    year: "1494",
    imageId: "florence",
    roleScope: "Sits on Florence's Great Council, balancing guild and patrician interests; can propose civic edicts, policing orders, and cultural protections but cannot command Papal or French armies.",
    storyThemes: ["faith_vs_freedom", "economic_stability", "civic_identity"],
    scoreGoal: 1100,
    defaultGoalStatus: "uncompleted",
    defaultHighScore: 0,
    powerDistribution: {
      systemName: "Mental-Might Oligarchy — Theocracy",
      systemDesc: "Wide-vote republic led by a strong preacher; laws and diplomacy follow sermons and public piety.",
      flavor: "Great Council votes; a friar's fire shapes the city.",
      holders: [
        {
          name: "Ideology/Religious (Savonarola & Friars)",
          percent: 32,
          icon: "✝️",
          note: "Savonarola's sermons drive laws; moral patrols, censors.",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Legislative (Great Council)",
          percent: 24,
          icon: "🏛",
          note: "3,000-member citizen council passes laws and taxes.",
          role: { A: true, E: false },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "Executive (City Leaders & Chief Magistrate)",
          percent: 18,
          icon: "👤",
          note: "City leaders run daily rule, deals, and enforcement.",
          role: { A: true, E: true },
          stype: { t: "Agent", i: "•" }
        },
        {
          name: "Wealth (Bankers & Guild Elders)",
          percent: 14,
          icon: "💰",
          note: "Funding, credit, and tax leverage stall or speed policy.",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "•" }
        },
        {
          name: "Judicial/Police",
          percent: 12,
          icon: "⚖️",
          note: "Courts and guards enforce bans and punish dissent.",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "•" }
        }
      ],
      playerIndex: 1,
      challengerSeat: {
        name: "Ideology/Religious (Savonarola & Friars)",
        percent: 32,
        index: 0
      },
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: false,
        stopB: false,
        decisive: ["Ideology/Religious (Savonarola & Friars)", "Executive (City Leaders & Chief Magistrate)", "Legislative (Great Council)"]
      },
      grounding: {
        settingType: "real",
        era: "Florence 1494–1498 (Savonarola era)"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["Florence — The Fire and the Faith (1494)"] ?? null,
      roleScope: "Sits on Florence's Great Council, balancing guild and patrician interests; can propose civic edicts, policing orders, and cultural protections but cannot command Papal or French armies.",
      storyThemes: ["faith_vs_freedom", "economic_stability", "civic_identity"]
    },
    characters: {
      male: {
        nameKey: "FLORENCE_CHAR_MALE_NAME",
        promptKey: "FLORENCE_CHAR_MALE_PROMPT"
      },
      female: {
        nameKey: "FLORENCE_CHAR_FEMALE_NAME",
        promptKey: "FLORENCE_CHAR_FEMALE_PROMPT"
      },
      any: {
        nameKey: "FLORENCE_CHAR_ANY_NAME",
        promptKey: "FLORENCE_CHAR_ANY_PROMPT"
      }
    }
  },

  {
    id: "north_america_1607",
    legacyKey: "North America — The First Encounter (1607)",
    titleKey: "NORTH_AMERICA_TITLE",
    subtitleKey: "NORTH_AMERICA_SUBTITLE",
    introKey: "NORTH_AMERICA_INTRO",
    youAreKey: "NORTH_AMERICA_YOU_ARE",
    year: "1607",
    imageId: "northAmerica",
    roleScope: "Leads a tribal council overseeing diplomacy, land stewardship, and trade terms; can mobilize scouts and negotiate boundaries but does not unilaterally declare war without consensus.",
    storyThemes: ["territorial_autonomy", "cultural_preservation", "exchange_vs_exploitation"],
    scoreGoal: 1100,
    defaultGoalStatus: "uncompleted",
    defaultHighScore: 0,
    powerDistribution: {
      systemName: "Personalist Monarchy / Autocracy",
      systemDesc: "Single paramount chief directs war, trade, and justice; councils advise, but his word usually decides.",
      flavor: "Strong chief steering first contact with Jamestown; war or trade by his word.",
      holders: [
        {
          name: "Executive (Paramount Chief)",
          percent: 42,
          icon: "👑",
          note: "Commands alliance; sets war, trade, justice.",
          role: { A: true, E: true },
          stype: { t: "Dictator", i: "+" }
        },
        {
          name: "Coercive Force (War Captains & Warriors)",
          percent: 23,
          icon: "⚔️",
          note: "Raids and blockades can force policy shifts.",
          role: { A: true, E: false },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "Council of Chiefs/Elders",
          percent: 14,
          icon: "👥",
          note: "Advice and consent; can slow risky moves.",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "•" }
        },
        {
          name: "Ideology/Religious (Spiritual Advisers)",
          percent: 11,
          icon: "✨",
          note: "Ritual sanction shapes go/no-go on war/trade.",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "•" }
        },
        {
          name: "Wealth (Food/Trade Gatekeepers)",
          percent: 10,
          icon: "🌾",
          note: "Controls corn, tribute, and gifts to outsiders.",
          role: { A: true, E: false },
          stype: { t: "Agent", i: "•" }
        }
      ],
      playerIndex: 0,
      challengerSeat: {
        name: "Coercive Force (War Captains & Warriors)",
        percent: 23,
        index: 1
      },
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: false,
        stopB: true,
        decisive: ["Executive (Paramount Chief)", "Coercive Force (War Captains & Warriors)"]
      },
      grounding: {
        settingType: "real",
        era: "Tidewater Virginia, 1607–1609"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["North America — The First Encounter (1607)"] ?? null,
      roleScope: "Leads a tribal council overseeing diplomacy, land stewardship, and trade terms; can mobilize scouts and negotiate boundaries but does not unilaterally declare war without consensus.",
      storyThemes: ["territorial_autonomy", "cultural_preservation", "exchange_vs_exploitation"]
    },
    characters: {
      male: {
        nameKey: "NORTH_AMERICA_CHAR_MALE_NAME",
        promptKey: "NORTH_AMERICA_CHAR_MALE_PROMPT"
      },
      female: {
        nameKey: "NORTH_AMERICA_CHAR_FEMALE_NAME",
        promptKey: "NORTH_AMERICA_CHAR_FEMALE_PROMPT"
      },
      any: {
        nameKey: "NORTH_AMERICA_CHAR_ANY_NAME",
        promptKey: "NORTH_AMERICA_CHAR_ANY_PROMPT"
      }
    }
  },

  {
    id: "japan_1600",
    legacyKey: "Japan — The Land at War's End (1600)",
    titleKey: "JAPAN_TITLE",
    subtitleKey: "JAPAN_SUBTITLE",
    introKey: "JAPAN_INTRO",
    youAreKey: "JAPAN_YOU_ARE",
    year: "1600",
    imageId: "japan",
    roleScope: "Heads a mid-level samurai clan caught between warring coalitions; can commit retainers, negotiate allegiances, and manage village protections but cannot dictate national strategy.",
    storyThemes: ["loyalty_vs_survival", "clan_honor", "centralization"],
    scoreGoal: 1200,
    defaultGoalStatus: "uncompleted",
    defaultHighScore: 0,
    powerDistribution: {
      systemName: "Hard-Power Oligarchy — Stratocracy",
      systemDesc: "Warlord coalitions rule by force; law follows the armies, not councils.",
      flavor: "Swords decide law; pick a side before the dust settles.",
      holders: [
        {
          name: "Coercive Force (Armies & Warlords)",
          percent: 38,
          icon: "⚔️",
          note: "Decides war/peace; seizes lands; compels loyalties",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Executive (Coalition Chiefs)",
          percent: 30,
          icon: "👤",
          note: "Top commanders coordinating alliances and orders",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Wealth (Rice Yields & Merchants)",
          percent: 12,
          icon: "🌾",
          note: "Funds rice stipends, supplies, loans for campaigns",
          role: { A: false, E: false },
          stype: { t: "Agent", i: "•" }
        },
        {
          name: "Bureaucracy (Clan Stewards)",
          percent: 10,
          icon: "📜",
          note: "Runs castles, tax rolls, must obey the victors",
          role: { A: false, E: false },
          stype: { t: "Agent", i: "•" }
        },
        {
          name: "Ideology/Religious (Imperial Court & Temples)",
          percent: 10,
          icon: "⛩",
          note: "Grants titles, blessings; boosts legitimacy, not control",
          role: { A: false, E: false },
          stype: { t: "Actor", i: "•" }
        }
      ],
      playerIndex: 0,
      challengerSeat: {
        name: "Executive (Coalition Chiefs)",
        percent: 30,
        index: 1
      },
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: true,
        stopB: false,
        decisive: ["Coercive Force (Armies & Warlords)", "Executive (Coalition Chiefs)"]
      },
      grounding: {
        settingType: "real",
        era: "Japan, 1600 (late Sengoku)"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["Japan — The Land at War's End (1600)"] ?? null,
      roleScope: "Heads a mid-level samurai clan caught between warring coalitions; can commit retainers, negotiate allegiances, and manage village protections but cannot dictate national strategy.",
      storyThemes: ["loyalty_vs_survival", "clan_honor", "centralization"]
    },
    characters: {
      male: {
        nameKey: "JAPAN_CHAR_MALE_NAME",
        promptKey: "JAPAN_CHAR_MALE_PROMPT"
      },
      female: {
        nameKey: "JAPAN_CHAR_FEMALE_NAME",
        promptKey: "JAPAN_CHAR_FEMALE_PROMPT"
      },
      any: {
        nameKey: "JAPAN_CHAR_ANY_NAME",
        promptKey: "JAPAN_CHAR_ANY_PROMPT"
      }
    }
  },

  {
    id: "haiti_1791",
    legacyKey: "Haiti — The Island in Revolt (1791)",
    titleKey: "HAITI_TITLE",
    subtitleKey: "HAITI_SUBTITLE",
    introKey: "HAITI_INTRO",
    youAreKey: "HAITI_YOU_ARE",
    year: "1791",
    imageId: "haiti",
    roleScope: "Acts as a plantation overseer-turned-liaison among rebel factions; can influence local militia deployments, justice for captives, and resource distribution but cannot dictate colony-wide treaties.",
    storyThemes: ["emancipation", "justice_vs_vengeance", "unity_vs_fragmentation"],
    scoreGoal: 1200,
    defaultGoalStatus: "uncompleted",
    defaultHighScore: 0,
    powerDistribution: {
      systemName: "Hard-Power Oligarchy — Stratocracy",
      systemDesc: "Warring armed factions decide outcomes; civil authority is weak.",
      flavor: "Guns and torches rule the sugar island.",
      holders: [
        {
          name: "Rebel Slave Armies (Coercive Force)",
          percent: 36,
          icon: "🔥",
          note: "Burn plantations, seize towns, set facts on the ground",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Colonial Militias & Troops (Coercive Force)",
          percent: 30,
          icon: "⚔️",
          note: "Planter-led forces defend estates, punish rebels",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Planter Elite (Wealth)",
          percent: 14,
          icon: "💰",
          note: "Money, supplies, and orders to militias",
          role: { A: true, E: false },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "Colonial Governor & Bureaucracy (Executive)",
          percent: 8,
          icon: "👤",
          note: "Issues decrees; depends on militias to act",
          role: { A: true, E: false },
          stype: { t: "Agent", i: "•" }
        },
        {
          name: "Vodou & Rebel Organizers (Ideology/Religious)",
          percent: 12,
          icon: "✨",
          note: "Rituals, oaths, and messages unify the revolt",
          role: { A: true, E: false },
          stype: { t: "Author", i: "•" }
        }
      ],
      playerIndex: 2,
      challengerSeat: {
        name: "Rebel Slave Armies (Coercive Force)",
        percent: 36,
        index: 0
      },
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: true,
        stopB: false,
        decisive: ["Rebel Slave Armies (Coercive Force)", "Colonial Militias & Troops (Coercive Force)", "Vodou & Rebel Organizers (Ideology/Religious)"]
      },
      grounding: {
        settingType: "real",
        era: "Saint-Domingue, 1791"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["Haiti — The Island in Revolt (1791)"] ?? null,
      roleScope: "Acts as a plantation overseer-turned-liaison among rebel factions; can influence local militia deployments, justice for captives, and resource distribution but cannot dictate colony-wide treaties.",
      storyThemes: ["emancipation", "justice_vs_vengeance", "unity_vs_fragmentation"]
    },
    characters: {
      male: {
        nameKey: "HAITI_CHAR_MALE_NAME",
        promptKey: "HAITI_CHAR_MALE_PROMPT"
      },
      female: {
        nameKey: "HAITI_CHAR_FEMALE_NAME",
        promptKey: "HAITI_CHAR_FEMALE_PROMPT"
      },
      any: {
        nameKey: "HAITI_CHAR_ANY_NAME",
        promptKey: "HAITI_CHAR_ANY_PROMPT"
      }
    }
  },

  {
    id: "russia_1917",
    legacyKey: "Russia — The Throne Crumbles (1917)",
    titleKey: "RUSSIA_TITLE",
    subtitleKey: "RUSSIA_SUBTITLE",
    introKey: "RUSSIA_INTRO",
    youAreKey: "RUSSIA_YOU_ARE",
    year: "1917",
    imageId: "russia",
    roleScope: "Embattled Tsar managing imperial decrees, military appointments, and court negotiations; can reshuffle ministers, issue manifestos, or seek truces but cannot personally command every garrison simultaneously.",
    storyThemes: ["autocracy_vs_revolution", "bread_land_peace", "loyalty_crisis"],
    scoreGoal: 1300,
    defaultGoalStatus: "uncompleted",
    defaultHighScore: 0,
    powerDistribution: {
      systemName: "Personalist Monarchy / Autocracy",
      systemDesc: "Tsar rules personally; army compliance and urban revolt now decide what sticks.",
      flavor: "One man on a crumbling throne, flanked by generals and crowds.",
      holders: [
        {
          name: "Coercive Force (Army & Garrison)",
          percent: 35,
          icon: "⚔️",
          note: "High Command, Petrograd troops decide to obey or refuse",
          role: { A: true, E: true },
          stype: { t: "Eraser", i: "+" }
        },
        {
          name: "Executive (Tsar)",
          percent: 25,
          icon: "👑",
          note: "Nicholas II issues orders; authority eroding fast",
          role: { A: true, E: true },
          stype: { t: "Dictator", i: "•" }
        },
        {
          name: "Demos (Workers' & Soldiers' Councils)",
          percent: 20,
          icon: "👥",
          note: "Mass protests and mutinies can topple any plan",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "•" }
        },
        {
          name: "Legislative (Duma Leaders)",
          percent: 15,
          icon: "🏛",
          note: "Duma committee claims government; needs army compliance",
          role: { A: true, E: false },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "Wealth (Nobles & Big Industry)",
          percent: 5,
          icon: "💰",
          note: "Funding and elite pressure behind Duma and court",
          role: { A: false, E: false },
          stype: { t: "Agent", i: "-" }
        }
      ],
      playerIndex: 1,
      challengerSeat: {
        name: "Coercive Force (Army & Garrison)",
        percent: 35,
        index: 0
      },
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: false,
        stopB: false,
        decisive: ["Coercive Force (Army & Garrison)", "Executive (Tsar)", "Legislative (Duma Leaders)", "Demos (Workers' & Soldiers' Councils)"]
      },
      grounding: {
        settingType: "real",
        era: "Russia, Feb–Mar 1917"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["Russia — The Throne Crumbles (1917)"] ?? null,
      roleScope: "Embattled Tsar managing imperial decrees, military appointments, and court negotiations; can reshuffle ministers, issue manifestos, or seek truces but cannot personally command every garrison simultaneously.",
      storyThemes: ["autocracy_vs_revolution", "bread_land_peace", "loyalty_crisis"]
    },
    characters: {
      male: {
        nameKey: "RUSSIA_CHAR_MALE_NAME",
        promptKey: "RUSSIA_CHAR_MALE_PROMPT"
      },
      female: {
        nameKey: "RUSSIA_CHAR_FEMALE_NAME",
        promptKey: "RUSSIA_CHAR_FEMALE_PROMPT"
      },
      any: {
        nameKey: "RUSSIA_CHAR_ANY_NAME",
        promptKey: "RUSSIA_CHAR_ANY_PROMPT"
      }
    }
  },

  {
    id: "india_1947",
    legacyKey: "India — The Midnight of Freedom (1947)",
    titleKey: "INDIA_TITLE",
    subtitleKey: "INDIA_SUBTITLE",
    introKey: "INDIA_INTRO",
    youAreKey: "INDIA_YOU_ARE",
    year: "1947",
    imageId: "india",
    roleScope: "District officer coordinating police, relief, and political liaisons along the partition line; manages curfews, convoys, and investigations but cannot redraw national borders.",
    storyThemes: ["communal_trust", "order_vs_liberty", "refugee_protection"],
    scoreGoal: 1300,
    defaultGoalStatus: "uncompleted",
    defaultHighScore: 0,
    powerDistribution: {
      systemName: "Hard-Power Oligarchy — Stratocracy",
      systemDesc: "Armed forces and communal leaders shape rules; administrators improvise to contain violence amid state breakdown.",
      flavor: "Curfews, convoys, and rumors decide who lives through the night.",
      holders: [
        {
          name: "Coercive Force",
          percent: 40,
          icon: "⚔️",
          note: "Army, police, and militias set terms with force",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Ideology/Religious",
          percent: 25,
          icon: "✨",
          note: "Community leaders and clerics mobilize and veto",
          role: { A: true, E: true },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "Executive",
          percent: 20,
          icon: "👤",
          note: "District chief and provincial chiefs issue orders",
          role: { A: true, E: false },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "Demos",
          percent: 10,
          icon: "👥",
          note: "Crowds can overwhelm plans or force retreats",
          role: { A: false, E: true },
          stype: { t: "Actor", i: "+" }
        },
        {
          name: "Media/Platforms",
          percent: 5,
          icon: "📰",
          note: "Rumors, leaflets, and print drive panic or calm",
          role: { A: true, E: false },
          stype: { t: "Agent", i: "•" }
        }
      ],
      playerIndex: 2,
      challengerSeat: {
        name: "Coercive Force",
        percent: 40,
        index: 0
      },
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: true,
        stopB: false,
        decisive: ["Coercive Force", "Ideology/Religious", "Executive"]
      },
      grounding: {
        settingType: "real",
        era: "India Partition, 1947"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["India — The Midnight of Freedom (1947)"] ?? null,
      roleScope: "District officer coordinating police, relief, and political liaisons along the partition line; manages curfews, convoys, and investigations but cannot redraw national borders.",
      storyThemes: ["communal_trust", "order_vs_liberty", "refugee_protection"]
    },
    characters: {
      male: {
        nameKey: "INDIA_CHAR_MALE_NAME",
        promptKey: "INDIA_CHAR_MALE_PROMPT"
      },
      female: {
        nameKey: "INDIA_CHAR_FEMALE_NAME",
        promptKey: "INDIA_CHAR_FEMALE_PROMPT"
      },
      any: {
        nameKey: "INDIA_CHAR_ANY_NAME",
        promptKey: "INDIA_CHAR_ANY_PROMPT"
      }
    }
  },

  {
    id: "south_africa_1990",
    legacyKey: "South Africa — The End of Apartheid (1990)",
    titleKey: "SOUTH_AFRICA_TITLE",
    subtitleKey: "SOUTH_AFRICA_SUBTITLE",
    introKey: "SOUTH_AFRICA_INTRO",
    youAreKey: "SOUTH_AFRICA_YOU_ARE",
    year: "1990",
    imageId: "southAfrica",
    roleScope: "Senior police commander overseeing citywide operations during the transition; can set deployment protocols, liaise with reform negotiators, and manage crowd-control policy but cannot pass national laws.",
    storyThemes: ["justice_vs_amnesty", "public_safety", "institutional_trust"],
    scoreGoal: 1400,
    defaultGoalStatus: "uncompleted",
    defaultHighScore: 0,
    powerDistribution: {
      systemName: "Autocratizing (Executive)",
      systemDesc: "Late-apartheid South Africa: executive-led minority rule with strong security forces and rising mass opposition.",
      flavor: "Orders from above, pressure from below, cameras watching.",
      holders: [
        {
          name: "Executive",
          percent: 32,
          icon: "👤",
          note: "State President and cabinet set rules and budgets.",
          role: { A: true, E: false },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Coercive Force",
          percent: 28,
          icon: "⚔️",
          note: "Police and military enforce, suppress, and shape facts on ground",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Demos",
          percent: 22,
          icon: "👥",
          note: "Mass movements, unions, ANC/UDF force concessions via action",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "+" }
        },
        {
          name: "Wealth",
          percent: 12,
          icon: "💰",
          note: "Big business pressures for stability and reform.",
          role: { A: true, E: false },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "Media/Platforms",
          percent: 6,
          icon: "📰",
          note: "Domestic and foreign press raise costs of crackdowns.",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "•" }
        }
      ],
      playerIndex: 1,
      challengerSeat: {
        name: "Executive",
        percent: 32,
        index: 0
      },
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: false,
        stopB: true,
        decisive: ["Executive", "Coercive Force", "Demos"]
      },
      grounding: {
        settingType: "real",
        era: "South Africa, 1990 transition"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["South Africa — The End of Apartheid (1990)"] ?? null,
      roleScope: "Senior police commander overseeing citywide operations during the transition; can set deployment protocols, liaise with reform negotiators, and manage crowd-control policy but cannot pass national laws.",
      storyThemes: ["justice_vs_amnesty", "public_safety", "institutional_trust"]
    },
    characters: {
      male: {
        nameKey: "SOUTH_AFRICA_CHAR_MALE_NAME",
        promptKey: "SOUTH_AFRICA_CHAR_MALE_PROMPT"
      },
      female: {
        nameKey: "SOUTH_AFRICA_CHAR_FEMALE_NAME",
        promptKey: "SOUTH_AFRICA_CHAR_FEMALE_PROMPT"
      },
      any: {
        nameKey: "SOUTH_AFRICA_CHAR_ANY_NAME",
        promptKey: "SOUTH_AFRICA_CHAR_ANY_PROMPT"
      }
    }
  },

  {
    id: "mars_2179",
    legacyKey: "Mars Colony — The Red Frontier (2179)",
    titleKey: "MARS_TITLE",
    subtitleKey: "MARS_SUBTITLE",
    introKey: "MARS_INTRO",
    youAreKey: "MARS_YOU_ARE",
    year: "2179",
    imageId: "mars",
    roleScope: "Elected Mars colony governor balancing survival systems and autonomy petitions; can adjust habitat policy, rationing, and negotiations with Earth but cannot conjure unlimited supplies.",
    storyThemes: ["autonomy_vs_dependency", "survival_ethics", "science_vs_populism"],
    scoreGoal: 1400,
    defaultGoalStatus: "uncompleted",
    defaultHighScore: 0,
    powerDistribution: {
      systemName: "Mental-Might Oligarchy — Technocracy",
      systemDesc: "Engineers and safety rules steer decisions; an elected governor balances Earth supply leverage and local freedoms.",
      flavor: "Survival-first Mars town where engineers hold the real brakes.",
      holders: [
        {
          name: "Executive",
          percent: 28,
          icon: "👤",
          note: "Elected governor; emergency orders and budgets",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Science/Philosophy",
          percent: 24,
          icon: "🔬",
          note: "Life-support and safety board; can halt risky plans",
          role: { A: true, E: true },
          stype: { t: "Eraser", i: "+" }
        },
        {
          name: "Wealth",
          percent: 22,
          icon: "🌐",
          note: "Earth supply consortium; embargo/price veto power",
          role: { A: true, E: true },
          stype: { t: "Eraser", i: "+" }
        },
        {
          name: "Legislative",
          percent: 16,
          icon: "🏛",
          note: "Colony council; charters, audits, recalls",
          role: { A: true, E: true },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "Coercive Force",
          percent: 10,
          icon: "🛡",
          note: "Peacekeepers; enforce lockdowns under civilian control",
          role: { A: false, E: false },
          stype: { t: "Agent", i: "•" }
        }
      ],
      playerIndex: 0,
      challengerSeat: {
        name: "Science/Philosophy",
        percent: 24,
        index: 1
      },
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: false,
        stopB: false,
        decisive: ["Executive", "Science/Philosophy", "Wealth"]
      },
      grounding: {
        settingType: "fictional",
        era: "late 22nd century"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["Mars Colony — The Red Frontier (2179)"] ?? null,
      roleScope: "Elected Mars colony governor balancing survival systems and autonomy petitions; can adjust habitat policy, rationing, and negotiations with Earth but cannot conjure unlimited supplies.",
      storyThemes: ["autonomy_vs_dependency", "survival_ethics", "science_vs_populism"]
    },
    characters: {
      male: {
        nameKey: "MARS_CHAR_MALE_NAME",
        promptKey: "MARS_CHAR_MALE_PROMPT"
      },
      female: {
        nameKey: "MARS_CHAR_FEMALE_NAME",
        promptKey: "MARS_CHAR_FEMALE_PROMPT"
      },
      any: {
        nameKey: "MARS_CHAR_ANY_NAME",
        promptKey: "MARS_CHAR_ANY_PROMPT"
      }
    }
  }
];

// Experiment roles: Athens (index 0), North America (index 3), Mars (index 9)
export const EXPERIMENT_PREDEFINED_ROLE_KEYS = [
  PREDEFINED_ROLES_ARRAY[0].legacyKey,  // Athens (-404)
  PREDEFINED_ROLES_ARRAY[3].legacyKey,  // North America (1607)
  PREDEFINED_ROLES_ARRAY[9].legacyKey   // Mars (2179)
];

/**
 * Record mapping for quick lookup by legacy key
 */
export const PREDEFINED_ROLES_MAP: Record<string, PredefinedRoleData> =
  PREDEFINED_ROLES_ARRAY.reduce((acc, role) => {
    acc[role.legacyKey] = role;
    return acc;
  }, {} as Record<string, PredefinedRoleData>);

/**
 * Helper function to get predefined role by legacy key
 */
export function getPredefinedRole(legacyKey: string): PredefinedRoleData | null {
  return PREDEFINED_ROLES_MAP[legacyKey] || null;
}

/**
 * Helper function to check if a role exists
 */
export function hasPredefinedRole(legacyKey: string): boolean {
  return legacyKey in PREDEFINED_ROLES_MAP;
}

/**
 * Helper function to get image paths for a role
 */
export function getRoleImagePaths(imageId: string): { banner: string; full: string } {
  return {
    banner: `/assets/images/BKGs/Roles/banners/${imageId}Banner.png`,
    full: `/assets/images/BKGs/Roles/${imageId}Full.jpg`,
  };
}
