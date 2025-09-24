// src/data/politicalSystems.ts
// Canonical list used across the app for classification & UI.
export type PoliticalSystem = {
    key: string;        // stable key (no spaces)
    name: string;       // display name
    description: string;
    flavor: string;     // short italic flavor line
  };
  
  export const POLITICAL_SYSTEMS: PoliticalSystem[] = [
    { key: "absolute_monarchy", name: "Absolute Monarchy", description: "Monarch holds full power, unchecked.", flavor: "“One person makes all the rules because God said so (or so they claim).”" },
    { key: "constitutional_monarchy", name: "Constitutional Monarchy", description: "Monarch limited by a constitution and parliament.", flavor: "“The king/queen waves politely while politicians argue about taxes.”" },
    { key: "elective_monarchy", name: "Elective Monarchy", description: "Monarch chosen by vote rather than inheritance.", flavor: "“Royals audition for the throne like it’s Monarch Idol.”" },
    { key: "direct_democracy", name: "Direct Democracy", description: "Citizens vote directly on laws and policies.", flavor: "“Everyone votes on everything, all the time. Great in theory, chaos in practice.”" },
    { key: "representative_democracy", name: "Representative Democracy", description: "Citizens elect officials to make decisions for them.", flavor: "“You pick someone to argue on your behalf… and hope they remember you exist.”" },
    { key: "parliamentary_democracy", name: "Parliamentary Democracy", description: "Legislature elects the executive branch leader (PM).", flavor: "“Where politicians yell at each other in fancy accents.”" },
    { key: "presidential_democracy", name: "Presidential Democracy", description: "Citizens elect both legislature and president separately.", flavor: "“One person is CEO of the country, hopefully without the stock options.”" },
    { key: "federal_republic", name: "Federal Republic", description: "Power shared between central and regional governments.", flavor: "“Like Russian nesting dolls but with paperwork.”" },
    { key: "unitary_republic", name: "Unitary Republic", description: "Central government holds most of the power.", flavor: "“One government to rule them all, preferably without dark lords.”" },
    { key: "peoples_republic", name: "People’s Republic", description: "Republic in name, often single-party authoritarian in reality.", flavor: "“Usually means ‘Not much republic, not many people deciding.’”" },
    { key: "banana_republic", name: "Banana Republic", description: "Corrupt government propped up by foreign interests or elites.", flavor: "“Not about fruit—just corruption with a tropical flair.”" },
    { key: "dictatorship", name: "Dictatorship", description: "One leader holds total power, often seized.", flavor: "“One person hogs the remote control of the state and never gives it back.”" },
    { key: "military_junta", name: "Military Junta", description: "Military leaders rule after seizing power.", flavor: "“When generals say ‘fine, we’ll do it ourselves.’”" },
    { key: "one_party_state", name: "One-Party State", description: "Only one political party is legally allowed.", flavor: "“Democracy, but with only one brand on the ballot.”" },
    { key: "clerical_theocracy", name: "Clerical Theocracy", description: "Religious leaders hold supreme authority.", flavor: "“Sermons double as laws.”" },
    { key: "divine_right_monarchy", name: "Divine Right Monarchy", description: "Monarch claims authority from divine will.", flavor: "“Like absolute monarchy, but with extra holy glitter.”" },
    { key: "anarchy", name: "Anarchy", description: "Absence of structured government.", flavor: "“Everyone’s free! (to do whatever they want… until things get messy).”" },
    { key: "oligarchy", name: "Oligarchy", description: "Rule by a small elite group.", flavor: "“The ‘rich and powerful friends’ club runs the show.”" },
    { key: "plutocracy", name: "Plutocracy", description: "Rule by the wealthy.", flavor: "“Money votes, people don’t.”" },
    { key: "technocracy", name: "Technocracy", description: "Rule by technical experts and specialists.", flavor: "“Expect more acronyms than laws.”" },
    { key: "timocracy", name: "Timocracy", description: "Rule by property owners.", flavor: "“No house, no say.”" },
    { key: "kleptocracy", name: "Kleptocracy", description: "Rule by thieves and corrupt officials.", flavor: "“The government is basically a giant five-finger discount.”" },
    { key: "stratocracy", name: "Stratocracy", description: "Rule by the military as an institution.", flavor: "“The country is one big barracks.”" },
    { key: "gerontocracy", name: "Gerontocracy", description: "Rule by the elderly.", flavor: "“Wise or just cranky, depends on the day.”" },
    { key: "kakistocracy", name: "Kakistocracy", description: "Rule by the least qualified or most corrupt.", flavor: "“Literally rule by the worst. Enough said.”" },
  ];
  