// src/data/freePlaySystems.ts

export interface FreePlaySystem {
    governanceSystem: string;
    sourceOfAuthority: string;
    primaryWeakness: string;
    scenario: string;
    year: string;
    intro: string;
    leaderExperience: string;
    citizenExperience: string;
    image: string;
}

export const FREE_PLAY_SYSTEMS: FreePlaySystem[] = [
    {
        governanceSystem: "Direct Democracy",
        sourceOfAuthority: "The People (Demos)",
        primaryWeakness: "Instability: Susceptibility to demagogues and \"mob rule.\"",
        scenario: "Ancient Athens",
        year: "431 BC",
        intro: "Noisy plazas; shifting public opinion; politics as a daily chore.",
        leaderExperience: "NA",
        citizenExperience: "You are empowered but exhausted; fear of \"tyranny of the majority.\"",
        image: "/assets/images/freePlay/athensCircle.webp"
    },
    {
        governanceSystem: "Republic",
        sourceOfAuthority: "The Law",
        primaryWeakness: "Gridlock: Corruption or procedural paralysis.",
        scenario: "Roman Republic",
        year: "150 BC",
        intro: "Legalistic; power flows through institutions and precedent.",
        leaderExperience: "You are influential but \"boxed in\" by procedural limits and rivals.",
        citizenExperience: "You are protected by stable institutions that outlast individuals.",
        image: "/assets/images/freePlay/romanCircle.webp"
    },
    {
        governanceSystem: "Monarchy",
        sourceOfAuthority: "Bloodline",
        primaryWeakness: "Succession: A weak or incompetent heir can ruin the state.",
        scenario: "Medieval England",
        year: "1215 AD",
        intro: "Hierarchical; built on personal bonds and loyalty.",
        leaderExperience: "Your word is law, but depends on health, heirs, and vassal loyalty.",
        citizenExperience: "You are secure under a strong ruler, but vulnerable to their whims.",
        image: "/assets/images/freePlay/englandCircle.webp"
    },
    {
        governanceSystem: "Theocracy",
        sourceOfAuthority: "Divine Revelation",
        primaryWeakness: "Inflexibility: Dogmatism makes it hard to adapt to modern reality.",
        scenario: "Vatican City",
        year: "1985 AD",
        intro: "Sacred; politics, morality, and faith are inseparable.",
        leaderExperience: "You have Immense legitimacy, provided you uphold sacred doctrine.",
        citizenExperience: "Your Life feels meaningful and structured, but dissent is dangerous.",
        image: "/assets/images/freePlay/vaticanCircle.webp"
    },
    {
        governanceSystem: "Bureaucratic State",
        sourceOfAuthority: "Merit & Tradition",
        primaryWeakness: "Stagnation: \"Red tape\" and resistance to necessary change.",
        scenario: "Imperial China",
        year: "1750 AD",
        intro: "Vast and orderly; governed by paperwork and examinations.",
        leaderExperience: "You are supreme in theory, but constrained by systems that resist change.",
        citizenExperience: "You are distant from power, yet protected by a predictable system.",
        image: "/assets/images/freePlay/chinaCircle.webp"
    },
    {
        governanceSystem: "Technocracy",
        sourceOfAuthority: "Data & Optimization",
        primaryWeakness: "Dehumanization: Loss of agency; \"black box\" decisions.",
        scenario: "Mars Colony",
        year: "2142 AD",
        intro: "Clean and efficient; decisions are optimized rather than debated.",
        leaderExperience: "You are a supervisor of systems with little room for personal vision.",
        citizenExperience: "You are materially satisfied but alienated from the decision-making logic.",
        image: "/assets/images/freePlay/marsCircle.webp"
    }
];
