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
  mother?: SupportProfile | null;
};

export const ROLE_SUPPORT_PROFILES: Record<string, RoleSupportProfiles> = {
  "Railroad Strike — The Great Upheaval (1877)": {
    people: {
      summary: "Workers demand fair wages, safe conditions, and dignity; fear starvation but also bloodshed.",
      stances: {
        governance: "Seek worker representation and collective bargaining rights.",
        order: "Prefer peaceful protest but will defend themselves if attacked.",
        economy: "Demand living wages and an end to arbitrary pay cuts.",
        justice: "Want fair treatment and an end to blacklisting.",
        foreign: "Solidarity with workers in other cities and industries.",
        culture: "Value community, family, and mutual aid among workers.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "Railroad owners prioritize profits, property rights, and crushing labor organization.",
      stances: {
        governance: "Maintain owner control; resist any worker influence.",
        order: "Use state force to break strikes and restore operations.",
        economy: "Cut wages to maintain dividends; workers are expendable.",
        justice: "Blacklist agitators; prosecute strike leaders.",
        foreign: "Coordinate with other railroads to prevent spread.",
        culture: "Frame strikers as criminals and foreign agitators.",
      },
      origin: "predefined",
    },
  },
  "Athens — Shadows of War (-431)": {
    people: {
      summary: "Assembly citizens prize direct democracy, naval power, and imperial tribute but fear costly wars.",
      stances: {
        governance: "Preserve Assembly sovereignty; resist oligarchic plots.",
        order: "Trust law courts and citizen oversight over military strongmen.",
        economy: "Secure tribute from allies; fund public works and navy.",
        justice: "Favor mass juries and ostracism to check elites.",
        foreign: "Expand Delian League; contain Sparta; avoid land wars.",
        culture: "Celebrate festivals, drama, philosophy; honor Athena.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "Generals seek strategic flexibility and military prestige, sometimes chafing under popular oversight.",
      stances: {
        governance: "Value expert military judgment over crowd emotion.",
        order: "Enforce discipline in ranks; demand loyalty and obedience.",
        economy: "Prioritize fleet funding and campaign supplies.",
        justice: "Prefer commanders' authority over Assembly trials.",
        foreign: "Pursue bold campaigns and decisive victories for glory.",
        culture: "Honor martial virtue and strategic excellence.",
      },
      origin: "predefined",
    },
  },
  "Tel Aviv — The Campus Uprising (2025)": {
    people: {
      summary: "Students demand democratic voice and national relevance for university actions.",
      stances: {
        governance: "Expand direct democracy; let students vote on major issues.",
        order: "Strikes are legitimate protest; disruption is speech.",
        economy: "Protect vulnerable workers and first-gen students from harm.",
        culture: "University should be a moral beacon, not a neutral bystander.",
        foreign: "National politics belong on campus; we are citizens first.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "University management seeks stability, legal safety, and donor confidence.",
      stances: {
        governance: "Representative bodies, not referendums, should decide policy.",
        order: "Maintain normal operations; disruption harms everyone.",
        economy: "Protect tuition revenue, donor relations, and staff jobs.",
        culture: "Academic neutrality requires avoiding political entanglement.",
        foreign: "Keep national politics off campus; focus on education.",
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
  "The Chain Traders": {
    people: {
      summary: "The village families depend on the slave trade for survival and protection, yet they fear the spiritual rot it brings and the vengeance of those they hunt.",
      stances: {
        governance: "Maneuver for family stability and equitable resource sharing.",
        order: "Seek protection from rival tribal raids and internal chaos.",
        economy: "Maintain the trade as the only currency for supplies and safety.",
        justice: "Balance necessary cruelty with the whispers of personal conscience.",
        foreign: "Sway alliances through the leverage of the bound labor supply.",
        culture: "Listen to the shamans' warnings of spiritual decay.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "Rival families and ambitious war captains seek to seize control of the trade, pushing for more aggressive expansion.",
      stances: {
        governance: "Demand stronger, more decisive leadership to dominate the region.",
        order: "Rule through fear and absolute control of the labor chains.",
        economy: "Aggressively expand the hunt to eliminate all regional rivals.",
        justice: "Discard 'conscience' as a luxury that leads to tribal ruin.",
        foreign: "Force other tribes into total submission or annihilation.",
        culture: "Reject shamanic warnings as weakness that invites collapse.",
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
  "Planet Namek — The Democratic Overload (2099)": {
    people: {
      summary: "Citizens demand responsive governance but suffer from decision fatigue and information overload.",
      stances: {
        governance: "Direct democracy is sacred; every issue deserves a vote.",
        order: "Strikes are legitimate democratic expression, even when disruptive.",
        economy: "Infrastructure must serve all equally; no elite exemptions.",
        justice: "Transparent algorithms; no hidden manipulation of AgoraNet.",
        culture: "Information freedom is the highest value.",
        foreign: "Planetary autonomy; resist external governance models.",
      },
      origin: "predefined",
    },
    challenger: {
      summary: "The volatile Demos swings wildly, demanding contradictory outcomes and exhausting the system.",
      stances: {
        governance: "Vote on everything, even contradictory measures.",
        order: "Strike when dissatisfied; the system will adapt.",
        economy: "Demand services but resist the votes needed to fund them.",
        justice: "Punish unpopular decisions retroactively.",
        culture: "Viral outrage is democratic participation.",
        foreign: "Reject expert advice as elitism.",
      },
      origin: "predefined",
    },
  },
};

