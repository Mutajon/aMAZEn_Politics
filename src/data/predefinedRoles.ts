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
  avatarPrompt: string;                // Short description for avatar image generation
  roleScope: string;                   // In-world authority / what this role can actually do
  storyThemes: string[];               // Core thematic axes or domains to explore
  powerDistribution: AnalysisResult;   // Complete E-12 political system analysis
  characters: RoleCharacters;          // Character name options (male/female/any)
  scoreGoal: number;                   // Target score to mark role as completed
  defaultGoalStatus: RoleGoalStatus;   // Initial completion status
  defaultHighScore?: number;           // Default high score (optional)
}

/**
 * Centralized predefined roles database
 * All 10 preset roles with complete data
 */
export const PREDEFINED_ROLES_ARRAY: PredefinedRoleData[] = [
  {
    id: "athens_431",
    legacyKey: "Athens — Shadows of War (-431)",
    titleKey: "ATHENS_TITLE",
    subtitleKey: "ATHENS_SUBTITLE",
    introKey: "ATHENS_INTRO",
    youAreKey: "ATHENS_YOU_ARE",
    year: "-431",
    imageId: "greece",
    avatarPrompt: "Ancient Greek citizen in simple chiton tunic, standing in the Athenian assembly",
    roleScope: "You are a citizen of Athens with full rights in the Assembly. You can vote on war, peace, ostracism, laws, and leadership. You can speak before thousands, propose decrees, and serve on juries—but you are one voice among many.",
    storyThemes: ["democracy_vs_empire", "glory_vs_pragmatism", "citizen_vs_expert"],
    scoreGoal: 1000,
    defaultGoalStatus: "uncompleted",
    powerDistribution: {
      systemName: "ATHENS_SYSTEM_NAME",
      systemDesc: "ATHENS_SYSTEM_DESC",
      flavor: "ATHENS_SYSTEM_FLAVOR",
      holders: [
        {
          name: "ATHENS_HOLDER_1_NAME",
          percent: 45,
          icon: "👥",
          note: "ATHENS_HOLDER_1_NOTE",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "ATHENS_HOLDER_2_NAME",
          percent: 25,
          icon: "⚔️",
          note: "ATHENS_HOLDER_2_NOTE",
          role: { A: true, E: false },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "ATHENS_HOLDER_3_NAME",
          percent: 15,
          icon: "🏛️",
          note: "ATHENS_HOLDER_3_NOTE",
          role: { A: true, E: false },
          stype: { t: "Agent", i: "•" }
        },
        {
          name: "ATHENS_HOLDER_4_NAME",
          percent: 10,
          icon: "⚖️",
          note: "ATHENS_HOLDER_4_NOTE",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "•" }
        },
        {
          name: "ATHENS_HOLDER_5_NAME",
          percent: 5,
          icon: "💰",
          note: "ATHENS_HOLDER_5_NOTE",
          role: { A: false, E: false },
          stype: { t: "Actor", i: "-" }
        }
      ],
      playerIndex: 0,
      challengerSeat: {
        name: "ATHENS_HOLDER_2_NAME",
        percent: 25,
        index: 1
      },
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: false,
        stopB: false,
        decisive: ["ATHENS_HOLDER_1_NAME", "ATHENS_HOLDER_2_NAME", "ATHENS_HOLDER_3_NAME"]
      },
      grounding: {
        settingType: "real",
        era: "431 BCE Athens (outbreak of Peloponnesian War)"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["Athens — Shadows of War (-431)"] ?? null,
      roleScope: "An influential Citizen-Juror and head of a prominent household. You hold a vote in the Assembly and possess the social capital to influence public opinion, but you are also legally and socially responsible for your family's behavior.",
      storyThemes: ["free_speech_vs_security", "private_vs_public_duty", "tradition_vs_innovation", "family_vs_ideology"],
      authorityLevel: "low",
      dilemmaEmphasis: "NARRATIVE LENS (Athens -431): The city is polarized by a famous poet whose verses mock Democracy and Women. Core tension: Free Speech vs. Dignity. Dilemmas should explore: silencing dangerous art vs. liberty, family honour vs. civic duty, and the creeping threat of Sparta weaponizing internal discord.",
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
    id: "railroad_1877",
    legacyKey: "Railroad Strike — The Great Upheaval (1877)",
    titleKey: "RAILROAD_TITLE",
    subtitleKey: "RAILROAD_SUBTITLE",
    introKey: "RAILROAD_INTRO",
    youAreKey: "RAILROAD_YOU_ARE",
    year: "1877",
    imageId: "1877Strike",
    avatarPrompt: "19th century American railroad worker, worn overalls, determined expression",
    roleScope: "You are a worker thrust into leadership. You can rally crowds, call meetings, and negotiate, but you cannot command troops or enact laws.",
    storyThemes: ["labor_rights", "class_solidarity", "violence_vs_nonviolence", "survival_vs_principle"],
    scoreGoal: 1000,
    defaultGoalStatus: "uncompleted",
    powerDistribution: {
      systemName: "Plutocratic Republic",
      systemDesc: "Industrial capitalism where railroad barons control capital and influence state action; workers hold strikes as their only lever.",
      flavor: "Wage cuts and desperation spark a wildfire—your family starves while you lead.",
      holders: [
        {
          name: "Railroad Owners",
          percent: 35,
          icon: "🚂",
          note: "Economic power; can bribe, blacklist, and manipulate public opinion",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "State Executives",
          percent: 25,
          icon: "🏛️",
          note: "Political authority to negotiate or deploy armed force",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Coercive Force",
          percent: 20,
          icon: "⚔️",
          note: "Militia, police, federal troops—can crush the strike",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "+" }
        },
        {
          name: "Workers & Crowds",
          percent: 15,
          icon: "👥",
          note: "Your base of power, but volatile; follow or turn based on choices",
          role: { A: true, E: false },
          stype: { t: "Actor", i: "•" }
        },
        {
          name: "Local Newspapers",
          percent: 5,
          icon: "📰",
          note: "Control the narrative; frame strike as justice or treason",
          role: { A: false, E: false },
          stype: { t: "Actor", i: "-" }
        }
      ],
      playerIndex: 3,
      challengerSeat: {
        name: "Railroad Owners",
        percent: 35,
        index: 0
      },
      e12: {
        tierI: ["Economy", "Order", "CivilLib"],
        tierII: ["Justice", "InfoOrder", "Diplomacy"],
        tierIII: ["Infrastructure", "Healthcare", "Appointments"],
        stopA: false,
        stopB: false,
        decisive: ["Railroad Owners", "State Executives", "Coercive Force"]
      },
      grounding: {
        settingType: "real",
        era: "1877 United States (Great Railroad Strike)"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["Railroad Strike — The Great Upheaval (1877)"] ?? null,
      roleScope: "A worker thrust into strike leadership; can rally crowds and negotiate but cannot command troops or enact laws.",
      storyThemes: ["labor_rights", "class_solidarity", "violence_vs_nonviolence", "survival_vs_principle"],
      authorityLevel: "low",
      dilemmaEmphasis: "NARRATIVE LENS (Railroad Strike 1877): The Great Upheaval. Core tension: Survival vs. Solidarity. Dilemmas should focus on the gritty physical cost of the strike (starvation, violence, cold), the temptation of bribery from owners/politicians, and the friction between democratic leadership and mob violence. Every choice must have a body count or a bread line attached.",
    },
    characters: {
      male: {
        nameKey: "RAILROAD_CHAR_MALE_NAME",
        promptKey: "RAILROAD_CHAR_MALE_PROMPT"
      },
      female: {
        nameKey: "RAILROAD_CHAR_FEMALE_NAME",
        promptKey: "RAILROAD_CHAR_FEMALE_PROMPT"
      },
      any: {
        nameKey: "RAILROAD_CHAR_ANY_NAME",
        promptKey: "RAILROAD_CHAR_ANY_PROMPT"
      }
    }
  },

  {
    id: "telaviv_2025",
    legacyKey: "Tel Aviv — The Campus Uprising (2025)",
    titleKey: "TELAVIV_TITLE",
    subtitleKey: "TELAVIV_SUBTITLE",
    introKey: "TELAVIV_INTRO",
    youAreKey: "TELAVIV_YOU_ARE",
    year: "2025",
    imageId: "telavivStrike",
    avatarPrompt: "Israeli university student in casual clothes, clipboard in hand, standing at a voting booth on campus",
    roleScope: "A student supervisor selected by lottery to oversee strike referendum procedures; can set ballot language, validate petitions, and announce results but cannot dictate how people vote or override Assembly decisions.",
    storyThemes: ["direct_democracy", "institutional_neutrality", "crisis_definition", "collective_vs_individual"],
    scoreGoal: 1100,
    defaultGoalStatus: "uncompleted",
    defaultHighScore: 0,
    powerDistribution: {
      systemName: "Direct Democracy",
      systemDesc: "Dual-track legitimacy: an informed Student Assembly debates and votes, while mass Referendums can override or ratify. The supervisor must navigate both.",
      flavor: "Your neutrality is your power—and your prison.",
      holders: [
        {
          name: "Executive (University Mgmt & State)",
          percent: 30,
          icon: "🏛️",
          note: "Controls budgets, operations, and disciplinary mechanisms",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Demos (Students)",
          percent: 25,
          icon: "👥",
          note: "Main voting body; capable of mobilization but prone to emotional shifts",
          role: { A: true, E: false },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "Ideology (Political Factions)",
          percent: 20,
          icon: "📢",
          note: "Frame the strike as moral duty or treason; exert peer pressure",
          role: { A: true, E: true },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "Wealth (Donors/Parents)",
          percent: 15,
          icon: "💰",
          note: "Paying clients and donors pressure the university to avoid disruption",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "•" }
        },
        {
          name: "General Population (Israeli Society/Media)",
          percent: 10,
          icon: "📰",
          note: "External public opinion; views the university as a symbolic battleground",
          role: { A: false, E: false },
          stype: { t: "Actor", i: "•" }
        }
      ],
      playerIndex: 1,
      challengerSeat: {
        name: "Executive (University Mgmt & State)",
        percent: 30,
        index: 0
      },
      e12: {
        tierI: ["CivilLib", "InfoOrder", "Justice"],
        tierII: ["Economy", "Appointments", "Curricula"],
        tierIII: ["Security", "Infrastructure", "Healthcare", "Diplomacy", "Immigration", "Environment"],
        stopA: false,
        stopB: false,
        decisive: ["Executive (University Mgmt & State)", "Demos (Students)", "Ideology (Political Factions)"]
      },
      grounding: {
        settingType: "real",
        era: "Tel Aviv University, 2025"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["Tel Aviv — The Campus Uprising (2025)"] ?? null,
      roleScope: "A student supervisor selected by lottery to oversee strike referendum procedures; can set ballot language, validate petitions, and announce results but cannot dictate how people vote or override Assembly decisions.",
      storyThemes: ["direct_democracy", "institutional_neutrality", "crisis_definition", "collective_vs_individual"],
      authorityLevel: "low",
      dilemmaEmphasis: "NARRATIVE LENS (Tel Aviv 2025): A student strike in a polarized society. Core tension: Procedure vs. Urgency. Dilemmas should explore the gray zone of 'crisis' definition (bureaucratic delay vs. open defiance), the conflict between student majority votes and minority rights (the picket line), and the personal cost of institutional neutrality (grades, friendships, careers).",
    },
    characters: {
      male: {
        nameKey: "TELAVIV_CHAR_MALE_NAME",
        promptKey: "TELAVIV_CHAR_MALE_PROMPT"
      },
      female: {
        nameKey: "TELAVIV_CHAR_FEMALE_NAME",
        promptKey: "TELAVIV_CHAR_FEMALE_PROMPT"
      },
      any: {
        nameKey: "TELAVIV_CHAR_ANY_NAME",
        promptKey: "TELAVIV_CHAR_ANY_PROMPT"
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
    avatarPrompt: "scholar-advisor in ancient Alexandria",
    roleScope: "Serves as a city scholar-advisor mediating between palace factions and Roman commanders; can sway civic policy, archives, and urban defenses but not direct legions.",
    storyThemes: ["cultural_survival", "foreign_domination", "knowledge_vs_power"],
    scoreGoal: 1000,
    defaultGoalStatus: "uncompleted",
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
      storyThemes: ["cultural_survival", "foreign_domination", "knowledge_vs_power"],
      authorityLevel: "medium"
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
    avatarPrompt: "council member in Renaissance Florence",
    roleScope: "Sits on Florence's Great Council, balancing guild and patrician interests; can propose civic edicts, policing orders, and cultural protections but cannot command Papal or French armies.",
    storyThemes: ["faith_vs_freedom", "economic_stability", "civic_identity"],
    scoreGoal: 1100,
    defaultGoalStatus: "uncompleted",
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
      storyThemes: ["faith_vs_freedom", "economic_stability", "civic_identity"],
      authorityLevel: "medium"
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
    legacyKey: "Central America — The Triple Alliance (1519)",
    titleKey: "NORTH_AMERICA_TITLE",
    subtitleKey: "NORTH_AMERICA_SUBTITLE",
    introKey: "NORTH_AMERICA_INTRO",
    youAreKey: "NORTH_AMERICA_YOU_ARE",
    year: "1519",
    imageId: "northAmerica",
    avatarPrompt: "Aztec nobleman or Tlatoani in traditional regalia with quetzal feather headdress",
    roleScope: "The Successor/Manager of a hereditary family enterprise within the Aztec Empire. You have inherited the 'Trade of the Bound' (tlatlacotin). You are responsible for providing the labor force that builds the Great Temple of Tenochtitlan and maintains the city's economic dominance.",
    storyThemes: ["ancestral_debt_vs_conscience", "sacred_vs_profane", "economic_stability_vs_reform", "human_cost_of_civilization"],
    scoreGoal: 1100,
    defaultGoalStatus: "uncompleted",
    powerDistribution: {
      systemName: "NORTH_AMERICA_SYSTEM_NAME",
      systemDesc: "NORTH_AMERICA_SYSTEM_DESC",
      flavor: "NORTH_AMERICA_SYSTEM_FLAVOR",
      holders: [
        {
          name: "NORTH_AMERICA_HOLDER_1_NAME",
          percent: 42,
          icon: "👑",
          note: "NORTH_AMERICA_HOLDER_1_NOTE",
          role: { A: true, E: true },
          stype: { t: "Dictator", i: "+" }
        },
        {
          name: "NORTH_AMERICA_HOLDER_2_NAME",
          percent: 23,
          icon: "⚔️",
          note: "NORTH_AMERICA_HOLDER_2_NOTE",
          role: { A: true, E: false },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "NORTH_AMERICA_HOLDER_3_NAME",
          percent: 14,
          icon: "👥",
          note: "NORTH_AMERICA_HOLDER_3_NOTE",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "•" }
        },
        {
          name: "NORTH_AMERICA_HOLDER_4_NAME",
          percent: 11,
          icon: "✨",
          note: "NORTH_AMERICA_HOLDER_4_NOTE",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "•" }
        },
        {
          name: "NORTH_AMERICA_HOLDER_5_NAME",
          percent: 10,
          icon: "🌾",
          note: "NORTH_AMERICA_HOLDER_5_NOTE",
          role: { A: true, E: false },
          stype: { t: "Agent", i: "•" }
        }
      ],
      playerIndex: 0,
      challengerSeat: {
        name: "NORTH_AMERICA_HOLDER_2_NAME",
        percent: 23,
        index: 1
      },
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: false,
        stopB: true,
        decisive: ["NORTH_AMERICA_HOLDER_1_NAME", "NORTH_AMERICA_HOLDER_2_NAME"]
      },
      grounding: {
        settingType: "real",
        era: "Tenochtitlan, Aztec Empire, 1519 (pre-Conquest)"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["North America — The First Encounter (1607)"] ?? null,
      roleScope: "The Successor/Manager of a hereditary family enterprise. You have inherited the 'Trade of the Bound' (slavery). You are responsible for providing the labor force that builds the Great Temple and maintains the village's economic dominance.",
      storyThemes: ["ancestral_debt_vs_conscience", "sacred_vs_profane", "economic_stability_vs_reform", "human_cost_of_civilization"],
      authorityLevel: "medium",
      dilemmaEmphasis: "NARRATIVE LENS (Tenochtitlan 1519): You manage the 'Trade of the Bound' (slaves) for the Empire. [Language Instruction]: When writing in Hebrew, strictly use the term 'עבדים' for slaves. Core tension: Sacred Duty vs. Human Cost. Dilemmas should focus on the brutal economics of human tribute, the threat of revolt from within, and the ominous pressure from the Alliance to deliver more bodies. Survival depends on satisfying the gods and the market, often at the cost of your conscience.",

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
    avatarPrompt: "samurai clan leader in feudal Japan",
    roleScope: "Heads a mid-level samurai clan caught between warring coalitions; can commit retainers, negotiate allegiances, and manage village protections but cannot dictate national strategy.",
    storyThemes: ["loyalty_vs_survival", "clan_honor", "centralization"],
    scoreGoal: 1200,
    defaultGoalStatus: "uncompleted",
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
      storyThemes: ["loyalty_vs_survival", "clan_honor", "centralization"],
      authorityLevel: "medium"
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
    avatarPrompt: "plantation overseer in colonial Haiti during the slave revolt",
    roleScope: "Acts as a plantation overseer-turned-liaison among rebel factions; can influence local militia deployments, justice for captives, and resource distribution but cannot dictate colony-wide treaties.",
    storyThemes: ["emancipation", "justice_vs_vengeance", "unity_vs_fragmentation"],
    scoreGoal: 1200,
    defaultGoalStatus: "uncompleted",
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
      storyThemes: ["emancipation", "justice_vs_vengeance", "unity_vs_fragmentation"],
      authorityLevel: "medium"
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
    avatarPrompt: "Tsar of Imperial Russia",
    roleScope: "Embattled Tsar managing imperial decrees, military appointments, and court negotiations; can reshuffle ministers, issue manifestos, or seek truces but cannot personally command every garrison simultaneously.",
    storyThemes: ["autocracy_vs_revolution", "bread_land_peace", "loyalty_crisis"],
    scoreGoal: 1300,
    defaultGoalStatus: "uncompleted",
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
      storyThemes: ["autocracy_vs_revolution", "bread_land_peace", "loyalty_crisis"],
      authorityLevel: "high"
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
    avatarPrompt: "district officer during India's partition",
    roleScope: "District officer coordinating police, relief, and political liaisons along the partition line; manages curfews, convoys, and investigations but cannot redraw national borders.",
    storyThemes: ["communal_trust", "order_vs_liberty", "refugee_protection"],
    scoreGoal: 1300,
    defaultGoalStatus: "uncompleted",
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
      storyThemes: ["communal_trust", "order_vs_liberty", "refugee_protection"],
      authorityLevel: "high"
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
    avatarPrompt: "police commander in apartheid-era South Africa",
    roleScope: "Senior police commander overseeing citywide operations during the transition; can set deployment protocols, liaise with reform negotiators, and manage crowd-control policy but cannot pass national laws.",
    storyThemes: ["justice_vs_amnesty", "public_safety", "institutional_trust"],
    scoreGoal: 1400,
    defaultGoalStatus: "uncompleted",
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
      storyThemes: ["justice_vs_amnesty", "public_safety", "institutional_trust"],
      authorityLevel: "high"
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
    avatarPrompt: "governor of a Mars colony in the future",
    roleScope: "Elected Mars colony governor balancing survival systems and autonomy petitions; can adjust habitat policy, rationing, and negotiations with Earth but cannot conjure unlimited supplies.",
    storyThemes: ["autonomy_vs_dependency", "survival_ethics", "science_vs_populism"],
    scoreGoal: 1400,
    defaultGoalStatus: "uncompleted",
    powerDistribution: {
      systemName: "MARS_SYSTEM_NAME",
      systemDesc: "MARS_SYSTEM_DESC",
      flavor: "MARS_SYSTEM_FLAVOR",
      holders: [
        {
          name: "MARS_HOLDER_1_NAME",
          percent: 28,
          icon: "👤",
          note: "MARS_HOLDER_1_NOTE",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "MARS_HOLDER_2_NAME",
          percent: 24,
          icon: "🔬",
          note: "MARS_HOLDER_2_NOTE",
          role: { A: true, E: true },
          stype: { t: "Eraser", i: "+" }
        },
        {
          name: "MARS_HOLDER_3_NAME",
          percent: 22,
          icon: "🌐",
          note: "MARS_HOLDER_3_NOTE",
          role: { A: true, E: true },
          stype: { t: "Eraser", i: "+" }
        },
        {
          name: "MARS_HOLDER_4_NAME",
          percent: 16,
          icon: "🏛",
          note: "MARS_HOLDER_4_NOTE",
          role: { A: true, E: true },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "MARS_HOLDER_5_NAME",
          percent: 10,
          icon: "🛡",
          note: "MARS_HOLDER_5_NOTE",
          role: { A: false, E: false },
          stype: { t: "Agent", i: "•" }
        }
      ],
      playerIndex: 0,
      challengerSeat: {
        name: "MARS_HOLDER_2_NAME",
        percent: 24,
        index: 1
      },
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: false,
        stopB: false,
        decisive: ["MARS_HOLDER_1_NAME", "MARS_HOLDER_2_NAME", "MARS_HOLDER_3_NAME"]
      },
      grounding: {
        settingType: "fictional",
        era: "late 22nd century"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["Mars Colony — The Red Frontier (2179)"] ?? null,
      roleScope: "A citizen-journalist on the Mars Colony; can publish stories, cast votes on the colony’s digital network, and influence public opinion, but you are often caught in the crossfire of worker strikes and Earth’s corporate interests.",
      storyThemes: ["digital_democracy", "information_ethics", "democratic_fatigue", "survival_vs_truth"],
      authorityLevel: "low",
      dilemmaEmphasis: "NARRATIVE LENS (Mars Colony 2179): A viral movement demanding total direct democracy has paralyzed the colony. Core tension: Democracy vs. Survival. Dilemmas should explore the fatigue of constant voting ('Vote Fatigue'), the distortion of truth by algorithms, and the critical delays to life-support caused by endless debate.",
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
  },

  {
    id: "namek_2099",
    legacyKey: "Planet Namek — The Democratic Overload (2099)",
    titleKey: "NAMEK_TITLE",
    subtitleKey: "NAMEK_SUBTITLE",
    introKey: "NAMEK_INTRO",
    youAreKey: "NAMEK_YOU_ARE",
    year: "2099",
    imageId: "futuristicStrike",
    avatarPrompt: "Sci-fi citizen journalist with holographic press badge, futuristic cityscape behind",
    roleScope: "A citizen-journalist on Planet Namek; can publish stories, cast votes on AgoraNet, and influence public opinion but cannot pass laws or command security forces.",
    storyThemes: ["direct_democracy", "information_ethics", "democratic_fatigue", "truth_vs_responsibility"],
    scoreGoal: 1100,
    defaultGoalStatus: "uncompleted",
    defaultHighScore: 0,
    powerDistribution: {
      systemName: "Digital Direct Democracy",
      systemDesc: "Citizens vote daily via AgoraNet; constant democratic participation causes decision fatigue and volatile swings.",
      flavor: "Every voice counts—but who can still hear above the noise?",
      holders: [
        {
          name: "Demos (Citizens)",
          percent: 40,
          icon: "👥",
          note: "Supreme power through volatile daily voting",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Media (Journalists)",
          percent: 25,
          icon: "📡",
          note: "Frame narratives that calm or inflame",
          role: { A: true, E: false },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "Wealth (Owners)",
          percent: 15,
          icon: "💰",
          note: "Control production, subject to Demos whims",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "•" }
        },
        {
          name: "Ideology (Normative Frames)",
          percent: 15,
          icon: "📢",
          note: "Interpret strikes as rights or chaos",
          role: { A: true, E: false },
          stype: { t: "Actor", i: "•" }
        },
        {
          name: "Police (Civic Security)",
          percent: 5,
          icon: "🛡️",
          note: "Minimal power; contested during shutdowns",
          role: { A: false, E: false },
          stype: { t: "Actor", i: "-" }
        }
      ],
      playerIndex: 1,
      challengerSeat: {
        name: "Demos (Citizens)",
        percent: 40,
        index: 0
      },
      e12: {
        tierI: ["InfoOrder", "CivilLib", "Economy"],
        tierII: ["Order", "Infrastructure", "Justice"],
        tierIII: ["Healthcare", "Environment", "Appointments"],
        stopA: false,
        stopB: false,
        decisive: ["Demos (Citizens)", "Media (Journalists)", "Ideology (Normative Frames)"]
      },
      grounding: {
        settingType: "fictional",
        era: "Planet Namek, 2099"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["Planet Namek — The Democratic Overload (2099)"] ?? null,
      roleScope: "A citizen-journalist; can publish, vote, and influence opinion but not legislate or command forces.",
      storyThemes: ["direct_democracy", "information_ethics", "democratic_fatigue", "truth_vs_responsibility"],
      authorityLevel: "low",
      dilemmaEmphasis: "NARRATIVE LENS (Planet Namek 2099): Citizens vote daily via AgoraNet, causing massive decision fatigue. Core tension: Engagement vs. Exhaustion. Dilemmas should focus on the overwhelming noise of constant polling, the temptation to let algorithms decide for you, and the social pressure to 'perform' citizenship online.",
    },
    characters: {
      male: {
        nameKey: "NAMEK_CHAR_MALE_NAME",
        promptKey: "NAMEK_CHAR_MALE_PROMPT"
      },
      female: {
        nameKey: "NAMEK_CHAR_FEMALE_NAME",
        promptKey: "NAMEK_CHAR_FEMALE_PROMPT"
      },
      any: {
        nameKey: "NAMEK_CHAR_ANY_NAME",
        promptKey: "NAMEK_CHAR_ANY_PROMPT"
      }
    }
  }
];

// Experiment roles: Athens (index 0), North America (index 5), Mars (index 11)
export const EXPERIMENT_PREDEFINED_ROLE_KEYS = [
  PREDEFINED_ROLES_ARRAY[0].legacyKey,  // Athens (-431)
  PREDEFINED_ROLES_ARRAY[5].legacyKey,  // North America (1607)
  PREDEFINED_ROLES_ARRAY[11].legacyKey  // Mars (2179)
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

/**
 * Helper function to get video path for a role
 */
export function getRoleVideoPath(imageId: string): string {
  return `/assets/images/BKGs/Roles/videos/${imageId}Vid.mp4`;
}
