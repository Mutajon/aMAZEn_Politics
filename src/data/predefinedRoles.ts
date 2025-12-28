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
      systemName: "Democracy",
      systemDesc: "Direct democracy where citizen Assembly holds decisive authority over war, peace, laws, and leaders through open vote.",
      flavor: "40,000 citizens shout, vote, and rule themselves—glory or chaos, the demos decides.",
      holders: [
        {
          name: "Assembly (Ekklesia)",
          percent: 45,
          icon: "👥",
          note: "All citizens vote directly on laws, war, exile, and finances",
          role: { A: true, E: true },
          stype: { t: "Author", i: "+" }
        },
        {
          name: "Strategos (Generals)",
          percent: 25,
          icon: "⚔️",
          note: "10 elected generals lead military, propose strategy, sway crowds",
          role: { A: true, E: false },
          stype: { t: "Author", i: "•" }
        },
        {
          name: "Council of 500 (Boule)",
          percent: 15,
          icon: "🏛️",
          note: "Selected by lot; prepares Assembly agenda, oversees daily affairs",
          role: { A: true, E: false },
          stype: { t: "Agent", i: "•" }
        },
        {
          name: "Law Courts (Dikasteria)",
          percent: 10,
          icon: "⚖️",
          note: "Mass citizen juries; can overturn laws, punish officials",
          role: { A: false, E: true },
          stype: { t: "Eraser", i: "•" }
        },
        {
          name: "Wealthy Elite (Liturgy Payers)",
          percent: 5,
          icon: "💰",
          note: "Fund triremes, festivals; influence through prestige, not votes",
          role: { A: false, E: false },
          stype: { t: "Actor", i: "-" }
        }
      ],
      playerIndex: 0,
      challengerSeat: {
        name: "Strategos (Generals)",
        percent: 25,
        index: 1
      },
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: false,
        stopB: false,
        decisive: ["Assembly (Ekklesia)", "Strategos (Generals)", "Council of 500 (Boule)"]
      },
      grounding: {
        settingType: "real",
        era: "431 BCE Athens (outbreak of Peloponnesian War)"
      },
      supportProfiles: ROLE_SUPPORT_PROFILES["Athens — Shadows of War (-431)"] ?? null,
      roleScope: "Acts as a citizen-assemblyman with equal voting rights, able to propose decrees and sway crowds but holding no permanent office or command authority.",
      storyThemes: ["democracy_vs_empire", "glory_vs_pragmatism", "citizen_vs_expert"],
      authorityLevel: "low"
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
      dilemmaEmphasis: `ROLE-SPECIFIC EMPHASIS (1877 Railroad Strike):

═══════════════════════════════════════════════════════════════════════════════
CORE TENSION TRIANGLE: AUTONOMY vs DEMOCRACY vs LIBERALISM
═══════════════════════════════════════════════════════════════════════════════

Probe these tensions throughout the game:
- How do strikes STRAIN democratic life? (collective action vs individual rights)
- What is the PERSONAL COST of activism? (leadership risks becoming complicity)
- Every dilemma MUST blur private/public spheres with MATERIAL REALITY: hunger, violence, solidarity, betrayal, fear

═══════════════════════════════════════════════════════════════════════════════
MANDATORY THEMATIC ARCHETYPES — HARD ROTATION REQUIRED
═══════════════════════════════════════════════════════════════════════════════

You MUST cycle through these 7 archetypes. Do NOT repeat an archetype until at least 4 others have been used.
Track usage internally. Each day's dilemma must fit ONE archetype clearly.

1. VIOLENCE ACCOUNTABILITY (tensionCluster: LawJustice or SocialOrder)
   A striker kills in self-defense. A mob destroys railroad property. A Pinkerton is beaten.
   → Protect the movement's image? Protect the individual? Sacrifice someone to appease authorities?

2. FAMILY VS CAUSE (tensionCluster: FamilyPersonal)
   Your child is sick. Your spouse begs you to quit. Your elderly parent needs medicine the company doctor won't give.
   → Sacrifice your family's immediate survival, or weaken the collective struggle?

3. BRIBERY & CORRUPTION (tensionCluster: EconomyResources or InternalPower)
   Railroad owners offer you money, a job, or safe passage for your family.
   → Accept and betray openly? Reject publicly and become a target? Accept secretly and play double agent?

4. MACRO CONSEQUENCES (tensionCluster: HealthDisaster or EconomyResources)
   The strike causes suffering beyond strikers: hospitals lack coal, food shipments rot, a nearby town goes hungry, mail stops.
   → Make humanitarian concessions that weaken your leverage, or hold firm and be blamed for civilian suffering?

5. SOLIDARITY VS BETRAYAL (tensionCluster: InternalPower or SocialOrder)
   A fellow leader is accused of being a company spy. A splinter faction wants dynamite. Ethnic tensions fracture the coalition.
   → Purge the accused? Let factions splinter? Compromise your principles to maintain unity?

6. STATE VIOLENCE (tensionCluster: ExternalConflict or LawJustice)
   Militia is mobilizing. Federal troops are coming. You have intelligence on their plans.
   → Prepare for armed confrontation? Disperse and survive? Negotiate surrender? Leak to newspapers to shame the governor?

7. MORAL COMPROMISE (tensionCluster: ReligionCulture or DiplomacyTreaty)
   A preacher offers sanctuary but demands you renounce violence. A journalist offers coverage but wants exaggerated atrocities. A politician offers support but wants you to betray another union.
   → Trade your integrity for tactical advantage?

═══════════════════════════════════════════════════════════════════════════════
TONE & STYLE
═══════════════════════════════════════════════════════════════════════════════

- GRITTY: Material hardship, physical threat of violence always present
- CONCRETE: Ground every choice in physical consequences (hunger, injury, arrest, death, eviction)
- NO ABSTRACT IDEALISM: "The cause" must always have a body count or a bread line attached`
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
      dilemmaEmphasis: `ROLE-SPECIFIC EMPHASIS (Tel Aviv University Strike 2025):

═══════════════════════════════════════════════════════════════════════════════
CORE TENSION TRIANGLE: AUTONOMY vs DEMOCRACY vs LIBERALISM
═══════════════════════════════════════════════════════════════════════════════

Probe these tensions throughout the game:
- DELIBERATIVE vs POPULAR authority: When does the informed Assembly override raw Referendum results?
- THE GREY ZONE: How do you define "crisis" when the threat is bureaucratic defiance, not open rebellion?
- ETHICS OF ENFORCEMENT: Balance the right to strike against dissenters' rights and harm to vulnerable populations
- PRIVATE vs CIVIC: When is strict neutrality ethical, and when does it become evasion of responsibility?

═══════════════════════════════════════════════════════════════════════════════
MANDATORY THEMATIC ARCHETYPES — HARD ROTATION REQUIRED
═══════════════════════════════════════════════════════════════════════════════

You MUST cycle through these 7 archetypes. Do NOT repeat an archetype until at least 4 others have been used.
Track usage internally. Each day's dilemma must fit ONE archetype clearly.

1. THE GREY ZONE (tensionCluster: LawJustice or InternalPower)
   The government uses passive delays rather than open defiance. A petition demands a "preemptive" strike.
   → Validate the petition (legitimize preemption) or reject it as premature (preserve the "crisis" label for real emergencies)?

2. THE MANDATE MISMATCH (tensionCluster: SocialOrder or InternalPower)
   The Assembly voted 90% to strike, but mass polls show student apathy. The Referendum may fail.
   → Use neutral ballot framing (risking failure) or biased urgency language to align the popular vote with the Assembly?

3. THE INVISIBLE COST (tensionCluster: EconomyResources or FamilyPersonal)
   Unpaid contract workers and first-gen students beg for exemptions—they need wages and grades to survive.
   → Weaken the strike's signal by granting exemptions, or force the most vulnerable to bear the heaviest cost?

4. THE PICKET LINE (tensionCluster: LawJustice or SocialOrder)
   A professor defies the strike to teach class. Students want to physically block him.
   → Authorize the blockade (enforce collective democracy) or clear the way (protect individual dissent)?

5. LEGAL LIABILITY (tensionCluster: DiplomacyTreaty or LawJustice)
   Counsel warns that an official "Shutdown" invites lawsuits from students who want to study.
   → Water down language to "Voluntary Absence" (weaker signal, legal cover) or risk institutional liability for a stronger stance?

6. THE EXIT STRATEGY (tensionCluster: InternalPower or SocialOrder)
   The strike fails to generate reaction after four days. Momentum is dying.
   → Declare a "symbolic victory" and fold with dignity, or escalate to risky tactics to regain attention?

7. STRIKE INFLATION (tensionCluster: ReligionCulture or SocialOrder)
   Students cite your precedent to demand a strike over cafeteria prices or parking fees.
   → Democratize the strike tool for all grievances, or gatekeep it strictly for constitutional crises?

═══════════════════════════════════════════════════════════════════════════════
TONE & STYLE
═══════════════════════════════════════════════════════════════════════════════

- PROCEDURAL PRESSURE: Every choice involves forms, votes, quorums, and deadlines
- MORAL AMBIGUITY: No clear heroes or villains—everyone has legitimate grievances
- PERSONAL ENTANGLEMENT: Private friendships, grades, and career prospects are always at stake
- CONCRETE CONSEQUENCES: Lawsuits, expulsions, career damage, broken friendships`
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
    legacyKey: "North America — The First Encounter (1607)",
    titleKey: "NORTH_AMERICA_TITLE",
    subtitleKey: "NORTH_AMERICA_SUBTITLE",
    introKey: "NORTH_AMERICA_INTRO",
    youAreKey: "NORTH_AMERICA_YOU_ARE",
    year: "1607",
    imageId: "northAmerica",
    avatarPrompt: "Native American tribal chief when European settlers arrived",
    roleScope: "You are a tribal indian chief. You lead a council overseeing diplomacy, land stewardship, and trade terms; can mobilize scouts and negotiate boundaries but does not unilaterally declare war without consensus.",
    storyThemes: ["territorial_autonomy", "cultural_preservation", "exchange_vs_exploitation"],
    scoreGoal: 1100,
    defaultGoalStatus: "uncompleted",
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
      storyThemes: ["territorial_autonomy", "cultural_preservation", "exchange_vs_exploitation"],
      authorityLevel: "high"
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
      storyThemes: ["autonomy_vs_dependency", "survival_ethics", "science_vs_populism"],
      authorityLevel: "high"
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
      dilemmaEmphasis: `ROLE-SPECIFIC EMPHASIS (Planet Namek 2099):

═══════════════════════════════════════════════════════════════════════════════
CORE TENSION TRIANGLE: DEMOCRACY vs LIBERTY vs AUTONOMY
═══════════════════════════════════════════════════════════════════════════════

Probe these tensions throughout the game:
- How do DIGITAL PLATFORMS amplify or distort democratic impulses?
- Strikes EMPOWER citizens but EXHAUST societies—explore both sides
- DEMOCRATIC FATIGUE: constant civic participation becomes pressure, burnout, conflict
- Player must decide: EXPOSE, SHIELD, CRITICIZE, or JOIN movements

═══════════════════════════════════════════════════════════════════════════════
MANDATORY THEMATIC ARCHETYPES — HARD ROTATION REQUIRED
═══════════════════════════════════════════════════════════════════════════════

You MUST cycle through these 7 archetypes. Do NOT repeat until at least 4 others used.

1. THE TRUTH DILEMMA (tensionCluster: InfoOrder or LawJustice)
   You discover damaging truth about strike leaders. Publishing destabilizes the movement.
   → Publish and risk chaos? Shield and compromise journalistic integrity? Leak selectively?

2. THE AMPLIFICATION TRAP (tensionCluster: InternalPower or SocialOrder)
   AgoraNet algorithms push your story viral—but distort its meaning into rage.
   → Retract and lose influence? Ride the wave? Try to correct mid-crisis?

3. THE VOTE FATIGUE (tensionCluster: EconomyResources or HealthDisaster)
   Citizens are exhausted. A crucial infrastructure vote has 12% turnout. Your story could drive turnout—or deepen cynicism.
   → Sensationalize to drive turnout? Report honestly and risk infrastructure collapse?

4. THE STRIKE CROSSFIRE (tensionCluster: SocialOrder or ExternalConflict)
   Workers strike essential services. Hospitals run low. Both sides want you to tell their story.
   → Cover the strikers' grievances? Document the humanitarian cost? Attempt neutrality?

5. THE PLATFORM SHUTDOWN (tensionCluster: CivilLib or InternalPower)
   AgoraNet threatens to suspend your credentials for "destabilizing content."
   → Self-censor to stay online? Go underground? Become a martyr for press freedom?

6. THE JOINING POINT (tensionCluster: FamilyPersonal or ReligionCulture)
   You're asked to stop reporting and join the strike leadership yourself.
   → Abandon observer role? Maintain distance? Secretly advise while appearing neutral?

7. THE EXIT QUESTION (tensionCluster: DiplomacyTreaty or SocialOrder)
   The strike is failing. Movement leaders want you to fabricate a "victory narrative."
   → Help them save face (lie)? Document the defeat honestly? Propose a negotiated ending?

═══════════════════════════════════════════════════════════════════════════════
TONE & STYLE
═══════════════════════════════════════════════════════════════════════════════

- SCI-FI GROUNDED: Technology is pervasive but problems are human
- INFORMATION WARFARE: Truth is a weapon; platforms shape reality
- DEMOCRATIC BURNOUT: Everyone is tired of voting, deciding, participating
- MORAL AMBIGUITY: Strikes are both liberating and destructive`
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

// Experiment roles: Railroad Strike (index 0), Tel Aviv (index 1), Mars (index 10)
export const EXPERIMENT_PREDEFINED_ROLE_KEYS = [
  PREDEFINED_ROLES_ARRAY[0].legacyKey,  // Railroad Strike (1877)
  PREDEFINED_ROLES_ARRAY[1].legacyKey,  // Tel Aviv (2025)
  PREDEFINED_ROLES_ARRAY[10].legacyKey  // Mars (2179)
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
