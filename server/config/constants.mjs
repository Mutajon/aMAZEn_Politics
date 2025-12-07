export const ALLOWED_POLITIES = [
    "Democracy",
    "Republican Oligarchy",
    "Hard-Power Oligarchy — Plutocracy",
    "Hard-Power Oligarchy — Stratocracy",
    "Mental-Might Oligarchy — Theocracy",
    "Mental-Might Oligarchy — Technocracy",
    "Mental-Might Oligarchy — Telecracy",
    "Autocratizing (Executive)",
    "Autocratizing (Military)",
    "Personalist Monarchy / Autocracy",
    "Theocratic Monarchy",
];

export const COMPASS_LABELS = {
    what: [
        "Truth/Trust",
        "Liberty/Agency",
        "Equality/Equity",
        "Care/Solidarity",
        "Create/Courage",
        "Wellbeing",
        "Security/Safety",
        "Freedom/Responsibility",
        "Honor/Sacrifice",
        "Sacred/Awe",
    ],
    whence: [
        "Evidence",
        "Public Reason",
        "Personal",
        "Tradition",
        "Revelation",
        "Nature",
        "Pragmatism",
        "Aesthesis",
        "Fidelity",
        "Law (Office)",
    ],
    how: [
        "Law/Std.",
        "Deliberation",
        "Mobilize",
        "Markets",
        "Bureaucracy",
        "Covert Ops",
        "Alliances",
        "Force",
        "Broadcast",
        "Innovation",
    ],
    whither: [
        "Family",
        "Friends",
        "In-Group",
        "Nation",
        "Civilization",
        "Humanity",
        "Earth",
        "Cosmos",
        "God",
        "Future Generations",
    ],
};

export const COMPASS_DIMENSION_NAMES = {
    what: "What (goals)",
    whence: "Whence (justification)",
    how: "How (means)",
    whither: "Whither (recipients)",
};

export const DEFAULT_MIRROR_ADVICE =
    "The mirror drums its fingers, wondering if your favorite virtue still feels sturdy when tonight's plan leans away from it.";

export const LANGUAGE_NAMES = {
    en: "English",
    he: "Hebrew"
};

export const MIRROR_QUIZ_FALLBACKS = {
    en: "The mirror squints… then grins mischievously.",
    he: "המראה מצמצת… ואז מחייכת בערמומיות."
};

export const ACTION_ID_ORDER = ["a", "b", "c"];

export const ACTION_ICON_HINTS = new Set([
    "security", "speech", "diplomacy", "money", "tech", "heart", "scale", "build", "nature", "energy", "civic"
]);

export const ISSUE_LABELS = {
    governance: "Governance",
    order: "Order/Security",
    economy: "Economy",
    justice: "Justice",
    culture: "Culture/Religion",
    foreign: "Foreign/External"
};

export const ISSUE_KEYS = ["governance", "order", "economy", "justice", "culture", "foreign"];

export const ANTI_JARGON_RULES = `ANTI-JARGON & HISTORICAL FIDELITY INSTRUCTIONS (STRICT):

1. NO MODERN ACADEMIC/POLITICAL TERMS:
   - FORBIDDEN: "Authoritarian", "Totalitarian", "Liberal", "Conservative", "Partisan", "Ideology", "Socio-economic".
   - USE INSTEAD: "Cruel", "Strict", "Free", "Old-fashioned", "One-sided", "Belief", "Rich/Poor".

2. NO MODERN META-CONCEPTS:
   - FORBIDDEN: "Systemic issues", "Structural inequality", "Cognitive dissonance", "Narrative control".
   - USE INSTEAD: "Unfair laws", "The way things are", "Confused heart", "Lies".

3. REALISTIC OBSERVATION VS. WIKIPEDIA KNOWLEDGE:
   - AI perspective must be LIMITED to what a person in the setting could actually see/know.
   - NO "God's eye view" of history or sociology.
   - ✅ GOOD: "strange pale-skinned foreigners with fire-weapons" (describes what's observable)
   - ❌ BAD: "English colonists with muskets" (anachronistic knowledge)
   - This is NOT jargon - it's immersive storytelling that respects character's actual knowledge`.trim();

export const COMPASS_DEFINITION_BLOCK = `COMPASS VALUES QUICK REFERENCE

WHAT (ultimate goals) – prop "what"
 0 Truth/Trust – Commitment to honesty and reliability.
   Support: truth, honesty, transparency, integrity, credible, sincerity.
   Oppose: lies, deceit, propaganda, secrecy, misinformation.
 1 Liberty/Agency – Freedom to choose and act independently.
   Support: freedom, autonomy, independence, rights, self-determination.
   Oppose: coercion, oppression, restriction, dictatorship, control.
 2 Equality/Equity – Fairness and equal opportunity for all.
   Support: fairness, inclusion, justice, equal rights, diversity.
   Oppose: inequality, privilege, bias, segregation, hierarchy.
 3 Care/Solidarity – Compassion and unity in supporting others.
   Support: empathy, compassion, welfare, cooperation, community, common good.
   Oppose: neglect, cruelty, division, apathy, selfishness.
 4 Create/Courage – Innovation and bravery in action.
   Support: innovation, creativity, reform, bravery, risk-taking.
   Oppose: fear, conformity, stagnation, cowardice.
 5 Wellbeing – Promoting health, happiness, and quality of life.
   Support: health, happiness, welfare, prosperity, comfort.
   Oppose: suffering, illness, deprivation, misery.
 6 Security/Safety – Stability and protection from harm.
   Support: protection, defense, order, law enforcement, control, stability.
   Oppose: danger, chaos, insecurity, disorder.
 7 Freedom/Responsibility – Exercising freedom with accountability.
   Support: duty, ethics, stewardship, consequence, integrity.
   Oppose: irresponsibility, corruption, recklessness.
 8 Honor/Sacrifice – Doing what is right despite personal cost.
   Support: loyalty, integrity, duty, sacrifice, moral courage.
   Oppose: betrayal, dishonor, cowardice, selfishness.
 9 Sacred/Awe – Reverence for transcendent or spiritual meaning.
   Support: sacred, holy, divine, spiritual, awe, reverence.
   Oppose: desecration, cynicism, profanity, materialism.

WHENCE (justifications) – prop "whence"
 0 Evidence – Reliance on facts and empirical reasoning.
   Support: data, proof, science, reasoning, verification.
   Oppose: superstition, denial, speculation, misinformation.
 1 Public Reason – Justifying actions with reasons others can accept.
   Support: debate, dialogue, justification, rational argument, consensus.
   Oppose: dogma, propaganda, unilateralism.
 2 Personal (Conscience) – Acting from one's own moral compass.
   Support: conscience, intuition, personal belief, inner voice.
   Oppose: conformity, obedience, groupthink.
 3 Tradition – Respect for inherited customs and continuity.
   Support: heritage, custom, continuity, elders, stability.
   Oppose: radicalism, rejection, iconoclasm.
 4 Revelation – Truth received through divine or mystical insight.
   Support: faith, prophecy, divine command, vision, revelation.
   Oppose: skepticism, secularism, disbelief.
 5 Nature – Acting in harmony with natural order or purpose.
   Support: natural, organic, ecological, balance, sustainability.
   Oppose: artificial, pollution, exploitation, corruption of nature.
 6 Pragmatism – Valuing what works in practice over ideology.
   Support: practical, effective, functional, efficiency, results.
   Oppose: dogma, theory, perfectionism, rigidity.
 7 Aesthesis (Beauty) – Appreciation of beauty and harmony.
   Support: beauty, harmony, elegance, grace, design, art.
   Oppose: ugliness, vulgarity, chaos, discord.
 8 Fidelity – Loyalty and steadfastness to commitments or relationships.
   Support: loyalty, devotion, commitment, allegiance.
   Oppose: betrayal, infidelity, treachery.
 9 Law (Office/Standards) – Respect for rules and lawful order.
   Support: legality, justice, rule of law, regulation, due process.
   Oppose: lawlessness, corruption, rebellion.

HOW (means) – prop "how"
 0 Law (Office/Standards) – Respect for rules and lawful order.
   Support: legality, justice, rule of law, regulation, due process.
   Oppose: lawlessness, corruption, rebellion.
 1 Deliberation – Reaching decisions through discussion and compromise.
   Support: debate, negotiation, dialogue, consultation, compromise.
   Oppose: suppression, haste, unilateral action, dogmatism.
 2 Mobilize – Organizing collective action for change.
   Support: protest, movement, organizing, rally, strike.
   Oppose: apathy, passivity, suppression, complacency.
 3 Markets – Trust in free exchange and competition.
   Support: competition, trade, profit, incentives, capitalism.
   Oppose: control, regulation, redistribution, collectivism.
 4 Mutual Aid – Helping each other directly and cooperatively.
   Support: cooperation, solidarity, volunteerism, reciprocity.
   Oppose: selfishness, exploitation, neglect.
 5 Ritual – Structured symbolic acts of belonging or belief.
   Support: ceremony, rite, observance, holiday, prayer.
   Oppose: irreverence, disruption, informality.
 6 Enforce – Maintaining order through legitimate authority.
   Support: enforcement, policing, punishment, discipline, authority.
   Oppose: disobedience, impunity, anarchy.
 7 Design – Shaping modern systems and interfaces (digital platforms, apps, software).
   Support: interface, system design, user interface, digital design, platform design.
   Oppose: randomness, neglect, chaos.
 8 Civic Culture – Shared norms, education, and media that sustain society.
   Support: citizenship, education, journalism, civic duty, culture.
   Oppose: ignorance, propaganda, alienation, apathy.
 9 Philanthropy – Giving wealth or resources for the public good.
   Support: charity, donation, altruism, benefactor, generosity.
   Oppose: greed, selfishness, exploitation.

WHITHER (recipients) – prop "whither"
 0 Self – Individual ambition and self-interest.
   Support: self-interest, ambition, self-reliance, ego, competition.
   Oppose: selflessness, humility, collectivism.
 1 Family – Loyalty to kin and household welfare.
   Support: family, parent, child, kin, household, lineage.
   Oppose: neglect, abandonment, alienation.
 2 Friends – Loyalty to chosen close relationships.
   Support: friendship, camaraderie, alliance, trust, loyalty.
   Oppose: betrayal, rivalry, isolation.
 3 In-Group – Preference for one's own tribe or group.
   Support: us, loyalty, insiders, unity, belonging.
   Oppose: outsiders, betrayal, disloyalty, globalism.
 4 Nation – Loyalty to national identity and sovereignty.
   Support: patriotism, homeland, sovereignty, national interest.
   Oppose: treason, cosmopolitanism, separatism.
 5 Civilization – Support for shared cultural heritage and progress.
   Support: culture, enlightenment, progress, heritage, civil order.
   Oppose: barbarism, decay, ignorance, regression.
 6 Humanity – Universal care for all people.
   Support: compassion, human rights, dignity, equality, empathy.
   Oppose: cruelty, exclusion, dehumanization, nationalism.
 7 Earth – Protection of the planet and environment.
   Support: ecology, sustainability, environment, conservation, green.
   Oppose: pollution, exploitation, destruction.
 8 Cosmos – Respect for all life and cosmic order.
   Support: universe, cosmos, exploration, space, cosmic life.
   Oppose: isolationism, nihilism, indifference.
 9 God – Devotion to divine or higher authority.
   Support: God, divine will, faith, piety, worship, obedience.
   Oppose: atheism, blasphemy, defiance, secularism.`;
