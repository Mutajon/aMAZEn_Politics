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
    bonusObjectiveLeader: string;
    bonusObjectiveCitizen: string;
    messengerLeader: string;
    messengerCommoner: string;
    image: string;
}

export const FREE_PLAY_SYSTEMS: FreePlaySystem[] = [
    {
        governanceSystem: "FREE_PLAY_SYSTEM_DIRECT_DEMOCRACY",
        sourceOfAuthority: "FREE_PLAY_AUTHORITY_PEOPLE",
        primaryWeakness: "FREE_PLAY_WEAKNESS_INSTABILITY",
        scenario: "FREE_PLAY_SCENARIO_ATHENS",
        year: "FREE_PLAY_YEAR_ATHENS",
        intro: "FREE_PLAY_INTRO_ATHENS",
        leaderExperience: "NA",
        citizenExperience: "FREE_PLAY_EXPERIENCE_ATHENS",
        bonusObjectiveLeader: "NA",
        bonusObjectiveCitizen: "FREE_PLAY_BONUS_ATHENS",
        messengerLeader: "NA",
        messengerCommoner: "FREE_PLAY_MESSENGER_NEIGHBOR",
        image: "/assets/images/freePlay/athensCircle.webp"
    },
    {
        governanceSystem: "FREE_PLAY_SYSTEM_REPUBLIC",
        sourceOfAuthority: "FREE_PLAY_AUTHORITY_LAW",
        primaryWeakness: "FREE_PLAY_WEAKNESS_GRIDLOCK",
        scenario: "FREE_PLAY_SCENARIO_ROME",
        year: "FREE_PLAY_YEAR_ROME",
        intro: "FREE_PLAY_INTRO_ROME",
        leaderExperience: "FREE_PLAY_EXPERIENCE_ROME_LEADER",
        citizenExperience: "FREE_PLAY_EXPERIENCE_ROME_CITIZEN",
        bonusObjectiveLeader: "FREE_PLAY_BONUS_ROME_LEADER",
        bonusObjectiveCitizen: "FREE_PLAY_BONUS_ROME_CITIZEN",
        messengerLeader: "FREE_PLAY_MESSENGER_SECRETARY",
        messengerCommoner: "FREE_PLAY_MESSENGER_ENVOY",
        image: "/assets/images/freePlay/romanCircle.webp"
    },
    {
        governanceSystem: "FREE_PLAY_SYSTEM_MONARCHY",
        sourceOfAuthority: "FREE_PLAY_AUTHORITY_BLOODLINE",
        primaryWeakness: "FREE_PLAY_WEAKNESS_SUCCESSION",
        scenario: "FREE_PLAY_SCENARIO_ENGLAND",
        year: "FREE_PLAY_YEAR_ENGLAND",
        intro: "FREE_PLAY_INTRO_ENGLAND",
        leaderExperience: "FREE_PLAY_EXPERIENCE_ENGLAND_LEADER",
        citizenExperience: "FREE_PLAY_EXPERIENCE_ENGLAND_CITIZEN",
        bonusObjectiveLeader: "FREE_PLAY_BONUS_ENGLAND_LEADER",
        bonusObjectiveCitizen: "FREE_PLAY_BONUS_ENGLAND_CITIZEN",
        messengerLeader: "FREE_PLAY_MESSENGER_PAGE",
        messengerCommoner: "FREE_PLAY_MESSENGER_KIN",
        image: "/assets/images/freePlay/englandCircle.webp"
    },
    {
        governanceSystem: "FREE_PLAY_SYSTEM_THEOCRACY",
        sourceOfAuthority: "FREE_PLAY_AUTHORITY_DIVINE",
        primaryWeakness: "FREE_PLAY_WEAKNESS_INFLEXIBILITY",
        scenario: "FREE_PLAY_SCENARIO_VATICAN",
        year: "FREE_PLAY_YEAR_VATICAN",
        intro: "FREE_PLAY_INTRO_VATICAN",
        leaderExperience: "FREE_PLAY_EXPERIENCE_VATICAN_LEADER",
        citizenExperience: "FREE_PLAY_EXPERIENCE_VATICAN_CITIZEN",
        bonusObjectiveLeader: "FREE_PLAY_BONUS_VATICAN_LEADER",
        bonusObjectiveCitizen: "FREE_PLAY_BONUS_VATICAN_CITIZEN",
        messengerLeader: "FREE_PLAY_MESSENGER_CHANCELLOR",
        messengerCommoner: "FREE_PLAY_MESSENGER_CONFESSOR",
        image: "/assets/images/freePlay/vaticanCircle.webp"
    },
    {
        governanceSystem: "FREE_PLAY_SYSTEM_BUREAUCRATIC",
        sourceOfAuthority: "FREE_PLAY_AUTHORITY_MERIT",
        primaryWeakness: "FREE_PLAY_WEAKNESS_STAGNATION",
        scenario: "FREE_PLAY_SCENARIO_CHINA",
        year: "FREE_PLAY_YEAR_CHINA",
        intro: "FREE_PLAY_INTRO_CHINA",
        leaderExperience: "FREE_PLAY_EXPERIENCE_CHINA_LEADER",
        citizenExperience: "FREE_PLAY_EXPERIENCE_CHINA_CITIZEN",
        bonusObjectiveLeader: "FREE_PLAY_BONUS_CHINA_LEADER",
        bonusObjectiveCitizen: "FREE_PLAY_BONUS_CHINA_CITIZEN",
        messengerLeader: "FREE_PLAY_MESSENGER_SCRIBE",
        messengerCommoner: "FREE_PLAY_MESSENGER_COURIER",
        image: "/assets/images/freePlay/chinaCircle.webp"
    },
    {
        governanceSystem: "FREE_PLAY_SYSTEM_TECHNOCRACY",
        sourceOfAuthority: "FREE_PLAY_AUTHORITY_DATA",
        primaryWeakness: "FREE_PLAY_WEAKNESS_DEHUMANIZATION",
        scenario: "FREE_PLAY_SCENARIO_MARS",
        year: "FREE_PLAY_YEAR_MARS",
        intro: "FREE_PLAY_INTRO_MARS",
        leaderExperience: "FREE_PLAY_EXPERIENCE_MARS_LEADER",
        citizenExperience: "FREE_PLAY_EXPERIENCE_MARS_CITIZEN",
        bonusObjectiveLeader: "FREE_PLAY_BONUS_MARS_LEADER",
        bonusObjectiveCitizen: "FREE_PLAY_BONUS_MARS_CITIZEN",
        messengerLeader: "FREE_PLAY_MESSENGER_INTERFACE",
        messengerCommoner: "FREE_PLAY_MESSENGER_LIAISON",
        image: "/assets/images/freePlay/marsCircle.webp"
    }
];
