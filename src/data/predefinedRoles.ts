// src/data/predefinedRoles.ts
// Centralized database for all predefined roles
// All role data (power distributions, characters, images, i18n keys) in one place
// This replaces the scattered data across multiple files

import type { AnalysisResult } from "../store/roleStore";
import type { RoleCharacters } from "./predefinedCharacters";

/**
 * Complete predefined role data structure
 */
export interface PredefinedRoleData {
  id: string;                          // Simple identifier (e.g., "athens_404")
  legacyKey: string;                   // Original key for backward compatibility
  titleKey: string;                    // i18n key for title
  introKey: string;                    // i18n key for intro paragraph
  youAreKey: string;                   // i18n key for role description
  year: string;                        // Year badge display
  imageId: string;                     // Image identifier for banner/full images
  powerDistribution: AnalysisResult;   // Complete E-12 political system analysis
  characters: RoleCharacters;          // Character name options (male/female/any)
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
    introKey: "ATHENS_INTRO",
    youAreKey: "ATHENS_YOU_ARE",
    year: "-404",
    imageId: "greece",
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
      }
    },
    characters: {
      male: {
        name: "Theramenes",
        prompt: "A weathered Athenian citizen with salt-and-pepper beard, wearing a torn chiton, eyes filled with loss and determination, standing amid the ruins of democracy"
      },
      female: {
        name: "Lysandra",
        prompt: "An Athenian woman in simple peplos robes, dark hair covered with a veil, expression resolute yet sorrowful, representing those who survived Athens' fall"
      },
      any: {
        name: "Nikias",
        prompt: "A middle-aged Athenian with weary eyes, wearing travel-worn himation, holding a walking staff, embodying the spirit of a fallen democracy"
      }
    }
  },

  {
    id: "alexandria_48",
    legacyKey: "Alexandria — Fire over the Nile (-48)",
    titleKey: "ALEXANDRIA_TITLE",
    introKey: "ALEXANDRIA_INTRO",
    youAreKey: "ALEXANDRIA_YOU_ARE",
    year: "-48",
    imageId: "alexandria",
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
      }
    },
    characters: {
      male: {
        name: "Apollonios",
        prompt: "A Greek-Egyptian scholar in linen robes with papyrus scrolls, worried expression as smoke rises behind him, caught between warring powers and burning knowledge"
      },
      female: {
        name: "Berenice",
        prompt: "An educated Alexandrian woman in Greco-Egyptian dress with jewelry, intelligent eyes reflecting firelight, torn between loyalty and survival"
      },
      any: {
        name: "Ptolemaios",
        prompt: "A learned librarian in flowing robes with ink-stained fingers, desperate expression as the great Library burns, embodying the clash of knowledge and war"
      }
    }
  },

  {
    id: "florence_1494",
    legacyKey: "Florence — The Fire and the Faith (1494)",
    titleKey: "FLORENCE_TITLE",
    introKey: "FLORENCE_INTRO",
    youAreKey: "FLORENCE_YOU_ARE",
    year: "1494",
    imageId: "florence",
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
      }
    },
    characters: {
      male: {
        name: "Lorenzo",
        prompt: "A Florentine council member in rich Renaissance attire with fur trim, conflicted expression, standing before the burning pyre of vanities with a rosary in hand"
      },
      female: {
        name: "Caterina",
        prompt: "A Renaissance Florentine woman in elegant dress with pearl necklace, eyes reflecting both faith and doubt, representing the city torn between art and piety"
      },
      any: {
        name: "Alessandro",
        prompt: "A thoughtful Florentine in merchant's robes with a ledger, watching Savonarola's followers with concern, embodying the tension between commerce and conviction"
      }
    }
  },

  {
    id: "north_america_1607",
    legacyKey: "North America — The First Encounter (1607)",
    titleKey: "NORTH_AMERICA_TITLE",
    introKey: "NORTH_AMERICA_INTRO",
    youAreKey: "NORTH_AMERICA_YOU_ARE",
    year: "1607",
    imageId: "northAmerica",
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
      }
    },
    characters: {
      male: {
        name: "Powhatan",
        prompt: "A paramount chief in deerskin mantle with shell beads, feathered headdress, weathered face showing wisdom and caution, gazing toward distant wooden ships"
      },
      female: {
        name: "Pocahontas",
        prompt: "A young indigenous leader's daughter in decorated buckskin dress with intricate beadwork, curious yet wary expression, standing at the threshold of two worlds"
      },
      any: {
        name: "Opchanacanough",
        prompt: "A tribal elder in traditional dress with face paint and copper ornaments, eyes reflecting both the forest's ancient ways and the newcomers' strange ships"
      }
    }
  },

  {
    id: "japan_1600",
    legacyKey: "Japan — The Land at War's End (1600)",
    titleKey: "JAPAN_TITLE",
    introKey: "JAPAN_INTRO",
    youAreKey: "JAPAN_YOU_ARE",
    year: "1600",
    imageId: "japan",
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
      }
    },
    characters: {
      male: {
        name: "Takeda Nobushige",
        prompt: "A Japanese clan lord in samurai armor with mon crest, katana at his side, stern face showing the weight of choosing sides before Sekigahara"
      },
      female: {
        name: "Hōjō Masako",
        prompt: "A noble Japanese woman in formal kimono with elaborate hairstyle, intelligent eyes reflecting strategic thinking, wielding influence in a warrior's world"
      },
      any: {
        name: "Shimazu Yoshihiro",
        prompt: "A warlord in battle-worn armor with clan banner, weathered face showing years of war, standing at the crossroads of Japan's final great battle"
      }
    }
  },

  {
    id: "haiti_1791",
    legacyKey: "Haiti — The Island in Revolt (1791)",
    titleKey: "HAITI_TITLE",
    introKey: "HAITI_INTRO",
    youAreKey: "HAITI_YOU_ARE",
    year: "1791",
    imageId: "haiti",
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
      }
    },
    characters: {
      male: {
        name: "Jean-Baptiste",
        prompt: "A mixed-race overseer in colonial clothes torn between two worlds, machete at his belt, eyes showing conflict between survival and justice on a burning island"
      },
      female: {
        name: "Cécile",
        prompt: "A Haitian woman of mixed heritage in practical dress, determined expression, caught between the plantation masters and the rebels' drums echoing through the night"
      },
      any: {
        name: "Toussaint",
        prompt: "A person of African and French descent in overseer's attire, standing amid sugar cane fields with flames on the horizon, embodying revolution's difficult choices"
      }
    }
  },

  {
    id: "russia_1917",
    legacyKey: "Russia — The Throne Crumbles (1917)",
    titleKey: "RUSSIA_TITLE",
    introKey: "RUSSIA_INTRO",
    youAreKey: "RUSSIA_YOU_ARE",
    year: "1917",
    imageId: "russia",
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
      }
    },
    characters: {
      male: {
        name: "Nikolai Alexandrovich",
        prompt: "A Tsar in military uniform with medals and epaulettes, troubled expression, imperial bearing undermined by the weight of a crumbling empire and rising crowds"
      },
      female: {
        name: "Anastasia Nikolaevna",
        prompt: "A Russian noblewoman in elegant dress with fur stole, eyes reflecting both privilege and fear as the old world dissolves into revolution"
      },
      any: {
        name: "Dmitri Kerensky",
        prompt: "A Russian leader in formal suit with Duma pin, exhausted expression, caught between the Tsar's fading authority and the workers' rising councils"
      }
    }
  },

  {
    id: "india_1947",
    legacyKey: "India — The Midnight of Freedom (1947)",
    titleKey: "INDIA_TITLE",
    introKey: "INDIA_INTRO",
    youAreKey: "INDIA_YOU_ARE",
    year: "1947",
    imageId: "india",
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
      }
    },
    characters: {
      male: {
        name: "Rajendra Singh",
        prompt: "An Indian district officer in British colonial uniform, turban and serious expression, standing amid chaos as partition tears his town apart along invisible lines"
      },
      female: {
        name: "Priya Sharma",
        prompt: "An Indian administrator in sari with documents, determined face showing resolve to keep peace while flames of communal violence rise around her"
      },
      any: {
        name: "Arjun Patel",
        prompt: "A civil servant in khaki uniform with police insignia, weary eyes having seen too much violence, trying to hold together a fracturing community at midnight"
      }
    }
  },

  {
    id: "south_africa_1990",
    legacyKey: "South Africa — The End of Apartheid (1990)",
    titleKey: "SOUTH_AFRICA_TITLE",
    introKey: "SOUTH_AFRICA_INTRO",
    youAreKey: "SOUTH_AFRICA_YOU_ARE",
    year: "1990",
    imageId: "southAfrica",
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
      }
    },
    characters: {
      male: {
        name: "Pieter van Rensburg",
        prompt: "A South African police commander in blue uniform with insignia, conflicted expression, standing between the old order's demands and the rising tide of change"
      },
      female: {
        name: "Thandi Mkhize",
        prompt: "A Black South African police official in uniform, determined face showing strength despite working within an unjust system nearing its end"
      },
      any: {
        name: "Johan de Klerk",
        prompt: "A senior commander in SAPS uniform with rank insignia, weathered face showing years of enforcing apartheid, now facing cameras and crowds demanding freedom"
      }
    }
  },

  {
    id: "mars_2179",
    legacyKey: "Mars Colony — The Red Frontier (2179)",
    titleKey: "MARS_TITLE",
    introKey: "MARS_INTRO",
    youAreKey: "MARS_YOU_ARE",
    year: "2179",
    imageId: "mars",
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
      }
    },
    characters: {
      male: {
        name: "Kenji Chen-Martinez",
        prompt: "An elected Mars colony leader in utilitarian jumpsuit with Earth and Mars patches, confident yet burdened expression, standing in a habitat dome with red desert beyond"
      },
      female: {
        name: "Amara Okonkwo-Singh",
        prompt: "A Mars governor in practical colony uniform with communication devices, multicultural features, determined eyes reflecting both survival instinct and freedom's dream"
      },
      any: {
        name: "Zara Al-Rahman",
        prompt: "A future colony administrator in high-tech suit with holographic displays, diverse heritage visible in features, balancing Earth's control against Mars' independence"
      }
    }
  }
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
