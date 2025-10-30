// src/data/supportProfiles.ts
// Baseline stance profiles for People and Challenger factions in predefined roles.
// These are compact summaries used to keep AI support shifts consistent across turns.

export type IssueKey =
  | "governance"
  | "order"
  | "economy"
  | "justice"
  | "culture"
  | "foreign";

export type SupportProfile = {
  summary: string;
  stances: Partial<Record<IssueKey, string>>;
  origin: "predefined" | "ai" | "provisional";
};

export type RoleSupportProfiles = {
  people: SupportProfile | null;
  challenger: SupportProfile | null;
};

export const ROLE_SUPPORT_PROFILES: Record<string, RoleSupportProfiles> = {
  "Athens — The Day Democracy Died (-404)": {
    people: {
      summary: "Broad citizen class wants democracy restored without reigniting Spartan wrath.",
      stances: {
        governance: "Reopen the Assembly and widen participation.",
        order: "Resist terror squads; keep peace with limited coercion.",
        economy: "Ease war levies; restart trade; secure grain.",
        justice: "Prefer amnesties and reconciliation over purges.",
        foreign: "Obey peace terms and avoid provoking Sparta.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "Oligarchic enforcers protect elite rule under Spartan oversight.",
      stances: {
        governance: "Keep power in narrow councils of 'best men'.",
        order: "Use harsh policing and exile to silence dissent.",
        economy: "Shield elite property; impose fiscal discipline fast.",
        justice: "Favor exemplary punishments to deter unrest.",
        foreign: "Defer to Sparta; reject risky adventures.",
      },
      origin: "predefined",
    },
  },
  "Alexandria — Fire over the Nile (-48)": {
    people: {
      summary: "Alexandrians cling to local rule, scholarship, and open markets.",
      stances: {
        governance: "Keep native monarchy; resist foreign governors.",
        order: "End street battles; protect districts and traders.",
        economy: "Safeguard port and grain commerce for all.",
        culture: "Save libraries, temples, and civic pride in learning.",
        foreign: "Balance Rome diplomatically without occupation.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "Roman command prioritises imperial security and compliant rulers.",
      stances: {
        governance: "Install client arrangements loyal to Rome.",
        order: "Impose martial law and crush disorder swiftly.",
        economy: "Guarantee grain shipments and port control for Rome.",
        justice: "Apply military tribunals to punish agitators.",
        foreign: "Advance Roman objectives, co-opting local elites.",
      },
      origin: "predefined",
    },
  },
  "Florence — The Fire and the Faith (1494)": {
    people: {
      summary: "Guilds and patricians want republican balance without zealotry.",
      stances: {
        governance: "Maintain broad councils; avoid factional tyrannies.",
        order: "Keep civic peace; reject mobs and confiscations.",
        economy: "Protect trade, banking, and daily livelihoods.",
        culture: "Value piety but resist destroying art and luxury.",
        foreign: "Limit heavy-handed foreign influence like France.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "Savonarola’s movement enforces moralised rule through religious authority.",
      stances: {
        governance: "Guide the republic through pulpit authority.",
        order: "Police vice; censor vanities; mobilise processions.",
        economy: "Prefer austerity and alms over opulence.",
        culture: "Burn luxuries; enforce puritan reforms and dress codes.",
        foreign: "Seek godly alliances; exclude corrupting powers.",
      },
      origin: "predefined",
    },
  },
  "North America — The First Encounter (1607)": {
    people: {
      summary: "Tribal communities prize consensus, territory, and fair exchange.",
      stances: {
        governance: "Keep council autonomy and collective decision-making.",
        order: "Honor treaties; retaliate only if betrayed.",
        economy: "Protect hunting/fishing grounds; insist on fair trade.",
        culture: "Preserve traditions and spiritual practices.",
        foreign: "Limit settler encroachment; set clear treaty boundaries.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "War captains demand martial vigilance against incursions.",
      stances: {
        governance: "Elevate war leadership during crisis.",
        order: "Strike swiftly at trespassers and raiders.",
        economy: "Seize or block settler resources when threatened.",
        culture: "Guard rites and lands from dilution or conversion.",
        foreign: "Forge war alliances; ration trade for leverage.",
      },
      origin: "predefined",
    },
  },
  "Japan — The Land at War's End (1600)": {
    people: {
      summary: "Peasants and townsfolk crave a single stabilising authority.",
      stances: {
        governance: "Accept predictable rule with fair taxation.",
        order: "End pillage and roaming armies; secure travel.",
        economy: "Stabilise rice levies; lighten war burdens.",
        culture: "Respect local lords who protect villages.",
        foreign: "Avoid foreign entanglements until peace holds.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "Coalition chiefs seek to lock in victory through centralised command.",
      stances: {
        governance: "Centralise under the winning camp; enforce vassal loyalty.",
        order: "Pacify with military policing; disarm rivals.",
        economy: "Guarantee stipends and rice quotas for retainers.",
        culture: "Codify hierarchy and loyalty rituals.",
        foreign: "Stay cautious abroad while consolidating power.",
      },
      origin: "predefined",
    },
  },
  "Haiti — The Island in Revolt (1791)": {
    people: {
      summary: "Enslaved majority and free people of colour fight for emancipation and safety.",
      stances: {
        governance: "End slavery; secure rights and equal citizenship.",
        order: "Protect families; stop plantation terror.",
        economy: "Gain land access; break plantation monoculture.",
        justice: "Punish brutal masters; some seek orderly trials.",
        foreign: "Repel recolonisation; distrust European armies.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "Rebel armies enforce liberation through disciplined command.",
      stances: {
        governance: "Rule militarily to defend emancipation.",
        order: "Maintain strict discipline; retaliate against foes.",
        economy: "Requisition resources; later control labour for survival.",
        justice: "Deal harshly with slavers and collaborators.",
        foreign: "Seek recognition and arms; block invasions.",
      },
      origin: "predefined",
    },
  },
  "Russia — The Throne Crumbles (1917)": {
    people: {
      summary: "Workers and peasants demand bread, land, and an end to tsarism.",
      stances: {
        governance: "Build soviets and representative power.",
        order: "Stop secret police abuses; want fair policing.",
        economy: "End war requisitions; redistribute land and bread.",
        justice: "Amnesty political prisoners; punish abusers.",
        foreign: "Exit disastrous war while defending soil.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "Army command clings to hierarchy and wartime priorities.",
      stances: {
        governance: "Preserve command structures; curb radical councils.",
        order: "Use martial law to suppress strikes and mutiny.",
        economy: "Prioritise war supply; requisition grain.",
        justice: "Court-martial deserters and agitators.",
        foreign: "Continue fighting until honourable terms.",
      },
      origin: "predefined",
    },
  },
  "India — The Midnight of Freedom (1947)": {
    people: {
      summary: "Communities along partition lines seek democracy and safety amidst upheaval.",
      stances: {
        governance: "Embed universal franchise and fair representation.",
        order: "Protect civilians and refugees from communal violence.",
        economy: "Keep food and transport secure during partition.",
        justice: "Investigate massacres; prosecute rioters; avoid revenge cycles.",
        foreign: "Ensure peaceful British exit with international backing.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "Security forces prioritise control and clean borders over liberties.",
      stances: {
        governance: "Enforce directives; maintain curfews and checkpoints.",
        order: "Use rapid crowd control even if heavy-handed.",
        economy: "Secure rails and depots; police rationing.",
        justice: "Detain broadly to stop spirals of violence.",
        foreign: "Coordinate with departing authorities; avoid incidents.",
      },
      origin: "predefined",
    },
  },
  "South Africa — The End of Apartheid (1990)": {
    people: {
      summary: "The majority demands full franchise, safety, and economic redress.",
      stances: {
        governance: "Dismantle apartheid; adopt universal suffrage.",
        order: "Stop political raids; protect communities from state force.",
        economy: "Open jobs and wages; scrap pass laws.",
        justice: "Free prisoners; pursue accountability with truth deals.",
        foreign: "Welcome sanction relief tied to real reform.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "Incumbent executive wants controlled transition safeguarding its leverage.",
      stances: {
        governance: "Stage-managed reforms and possible power-sharing.",
        order: "Keep strong policing and intelligence operations.",
        economy: "Protect big industry; favour gradual change.",
        justice: "Prefer broad amnesty; limit prosecutions.",
        foreign: "Push for lifted sanctions; project investor stability.",
      },
      origin: "predefined",
    },
  },
  "Mars Colony — The Red Frontier (2179)": {
    people: {
      summary: "Colonists push for self-rule, transparency, and fair resource access.",
      stances: {
        governance: "Expand local democracy; cut Earth micromanagement.",
        order: "Keep safety protocols but protect civil rights.",
        economy: "Ensure fair rations, hab time, and equity in expansion.",
        justice: "Guarantee due process even during alerts.",
        foreign: "Trade with Earth yet pursue independence alliances.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "Science council insists on evidence-led control to safeguard survival.",
      stances: {
        governance: "Central decisions anchored in scientific risk assessments.",
        order: "Enforce strict hazard protocols over popular pressure.",
        economy: "Prioritise life-support redundancy above expansion.",
        justice: "Uphold ethics reviews; zero tolerance for data fraud.",
        foreign: "Maintain deep cooperation with Earth for spares and expertise.",
      },
      origin: "predefined",
    },
  },
};

