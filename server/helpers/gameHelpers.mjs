import { COMPASS_LABELS, COMPASS_DIMENSION_NAMES, DEFAULT_MIRROR_ADVICE } from "../config/constants.mjs";

export function extractTopCompassValues(compassValues, limit = 2) {
    if (!compassValues || typeof compassValues !== "object") return null;

    const result = {};
    let hasAny = false;

    for (const dimension of ["what", "whence", "how", "whither"]) {
        const values = Array.isArray(compassValues?.[dimension]) ? compassValues[dimension] : [];
        if (!values.length) continue;

        const top = values
            .map((value, idx) => ({
                value: Number(value) || 0,
                idx,
            }))
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, limit)
            .map(item => ({
                name: COMPASS_LABELS[dimension]?.[item.idx] || `${dimension} #${item.idx + 1}`,
                strength: Math.round(item.value * 10) / 10,
            }));

        if (top.length) {
            result[dimension] = top;
            hasAny = true;
        }
    }

    return hasAny ? result : null;
}

export function extractTopCompassFromStrings(compassStringMap) {
    if (!compassStringMap || typeof compassStringMap !== "object") return null;
    const result = {};
    let hasAny = false;

    for (const dimension of ["what", "whence", "how", "whither"]) {
        const raw = compassStringMap[dimension];
        if (!raw || typeof raw !== "string") continue;

        const names = raw
            .split(",")
            .map(name => name.trim())
            .filter(Boolean)
            .slice(0, 2)
            .map(name => ({ name, strength: null }));

        if (names.length) {
            result[dimension] = names;
            hasAny = true;
        }
    }

    return hasAny ? result : null;
}

export function compassTopValuesToSummary(topValues) {
    if (!topValues) return null;
    const summary = {};
    for (const dimension of ["what", "whence", "how", "whither"]) {
        const list = Array.isArray(topValues[dimension]) ? topValues[dimension] : null;
        if (list && list.length) {
            summary[dimension] = list.map(item => item.name).join(", ");
        }
    }
    return Object.keys(summary).length ? summary : null;
}

export function formatCompassTopValuesForPrompt(topValues) {
    if (!topValues) return "- None recorded yet; mirror improvises without value cues.";

    const lines = [];
    for (const dimension of ["what", "whence", "how", "whither"]) {
        const list = Array.isArray(topValues[dimension]) ? topValues[dimension] : null;
        if (!list || !list.length) continue;

        const names = list
            .map(item => (item.strength ? `${item.name} (${item.strength})` : item.name))
            .join(", ");

        lines.push(`- ${COMPASS_DIMENSION_NAMES[dimension]}: ${names}`);
    }

    return lines.length ? lines.join("\n") : "- None recorded yet; mirror improvises without value cues.";
}

export function sanitizeMirrorAdvice(text) {
    let cleaned = typeof text === "string" ? text.trim() : "";
    if (!cleaned) return DEFAULT_MIRROR_ADVICE;

    cleaned = cleaned
        .replace(/\[[A-Z]\]/g, "")
        .replace(/\bOption\s+[A-Z]\b/gi, "")
        .replace(/\bchoice\s+[A-Z]\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();

    if (!cleaned) return DEFAULT_MIRROR_ADVICE;

    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length > 25) {
        cleaned = words.slice(0, 25).join(" ");
    }

    if (!/[.!?]$/.test(cleaned)) {
        cleaned += ".";
    }

    return cleaned.length ? cleaned : DEFAULT_MIRROR_ADVICE;
}

/**
 * Helper: Find which institution/seat controls a specific policy domain
 * Returns a descriptive string based on E-12 decisive seats and power holders
 */
export function findDomainController(domain, decisiveSeats, powerHolders) {
    // Default fallback
    const fallback = "Contested among multiple power holders";

    if (!Array.isArray(decisiveSeats) || decisiveSeats.length === 0) {
        return fallback;
    }

    // Check if player is in decisive seats
    const playerIsDecisive = decisiveSeats.some(seat =>
        seat.toLowerCase().includes("you") ||
        seat.toLowerCase().includes("player") ||
        seat.toLowerCase().includes("character")
    );

    if (playerIsDecisive && decisiveSeats.length === 1) {
        return "You (decisive authority)";
    } else if (playerIsDecisive) {
        return `Shared: You + ${decisiveSeats.filter(s => !s.toLowerCase().includes("you")).slice(0, 2).join(", ")}`;
    } else {
        // Player is not decisive - list who controls it
        return decisiveSeats.slice(0, 2).join(" + ");
    }
}

/**
 * Helper: Format E-12 authority data for AI prompt
 * Converts E-12 domain structure into readable policy domain list with controllers
 */
export function formatE12ForPrompt(e12, powerHolders) {
    if (!e12 || typeof e12 !== 'object') {
        return "⚠️ E-12 authority analysis not available - use generic role scope constraints.";
    }

    const { tierI = [], tierII = [], tierIII = [], decisive = [] } = e12;

    // Domain name mappings for better readability
    const domainNames = {
        "Security": "Security (military, police, emergency)",
        "CivilLib": "Civil Liberties (rights, freedoms)",
        "InfoOrder": "Information Order (media, propaganda)",
        "Diplomacy": "Diplomacy (treaties, foreign relations)",
        "Justice": "Justice (courts, rule of law)",
        "Econ": "Economy (taxes, trade, currency)",
        "Infra": "Infrastructure (roads, buildings, public works)",
        "EduCulture": "Education & Culture (schools, arts, funding)",
        "Welfare": "Public Welfare (health, poverty, aid)",
        "Personnel": "State Personnel (appointments, salaries)"
    };

    let prompt = "POLICY DOMAINS & CONTROL (E-12 Framework):\n";
    const domains = Object.keys(tierI); // Assuming all tiers cover same domains

    for (const domain of domains) {
        const name = domainNames[domain] || domain;

        // Find who controls this domain from decisive seats
        const domainDecisive = decisive[domain] || [];
        // Note: The original code logic for findDomainController was passed decisiveSeats as the whole object or array?
        // Looking at original usage: findDomainController(domain, decisive[domain], powerHolders)
        // We need to match that logic.

        const controller = findDomainController(domain, domainDecisive, powerHolders);
        prompt += `- ${name}: Controlled by [${controller}]\n`;
    }

    return prompt;
}

/**
 * Calculate player's effective authority level
 * @returns {string} 'high' | 'medium' | 'low'
 */
export function calculateAuthorityLevel(e12, powerHolders, playerIndex, roleScope = null) {
    // SEMANTIC OVERRIDE: Citizen roles are always LOW authority
    // Citizens can only propose, not decree - they need votes/approval
    if (roleScope) {
        const scope = roleScope.toLowerCase();
        if (scope.includes('citizen') ||
            scope.includes('assemblyman') ||
            scope.includes('equal voting rights') ||
            scope.includes('you may propose') ||
            scope.includes('assembly will vote') ||
            scope.includes('no permanent office') ||
            scope.includes('cannot enact major changes')) {
            return 'low';
        }
    }

    // Fallback if missing data
    if (!powerHolders || !Array.isArray(powerHolders) || playerIndex === null || playerIndex === undefined) {
        return 'medium';
    }

    const playerHolder = powerHolders[playerIndex];
    if (!playerHolder || !playerHolder.stype) {
        return 'medium';
    }

    const { t: subjectType, i: intensity } = playerHolder.stype;

    // High authority: Dictators or Strong Authors
    if (subjectType === 'Dictator' || (subjectType === 'Author' && intensity === '+')) {
        return 'high';
    }

    // Low authority: Acolytes, Actors, or Weak subjects
    if (subjectType === 'Acolyte' || subjectType === 'Actor' || intensity === '-') {
        return 'low';
    }

    // Medium: Everything else (moderate authors, erasers, agents, etc.)
    return 'medium';
}

/**
 * Convert AI's 6-level support reactions to randomized numeric deltas
 * Applies support caps (0-100 range) to prevent overflow
 */
export function convertSupportShiftToDeltas(supportShift, currentSupport) {
    // Randomized delta ranges for each reaction level
    const REACTION_RANGES = {
        slightly_supportive: { min: 1, max: 5 },
        moderately_supportive: { min: 6, max: 10 },
        strongly_supportive: { min: 11, max: 15 },
        slightly_opposed: { min: -5, max: -1 },
        moderately_opposed: { min: -10, max: -6 },
        strongly_opposed: { min: -15, max: -11 },
        dead: { min: -100, max: -100 }
    };

    const deltas = {
        people: { delta: 0, why: "" },
        holders: { delta: 0, why: "" },
        mom: { delta: 0, why: "" },
        momDied: false
    };

    // Convert each entity's reaction to a random delta within range
    for (const [entity, shift] of Object.entries(supportShift)) {
        // Skip unexpected entity keys from AI response
        if (!deltas[entity]) {
            continue;
        }

        // Check if mom died
        if (entity === 'mom') {
            const isDead = shift.attitudeLevel === 'dead' || shift.momDied === true;
            if (isDead) {
                deltas.mom.delta = -100; // Force to 0 (assuming support is 0-100)
                deltas.momDied = true;
                deltas.mom.why = shift.shortLine || "Deceased";
                continue;
            }
        }

        const level = shift.attitudeLevel;
        const range = REACTION_RANGES[level];

        if (range) {
            // Random integer between min and max (inclusive)
            const randomDelta = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
            deltas[entity].delta = randomDelta;
            deltas[entity].why = shift.shortLine;
        } else {
            deltas[entity].delta = 0; // Unknown level
        }
    }

    // Cap values to ensure support stays 0-100
    // Note: currentSupport might be undefined if not passed, but we return deltas, not final values.
    // The calling code usually applies the delta. 
    // However, the original function (if I recall) might have returned clamped deltas or final values?
    // Let's re-read the original snippet: 3166...
    // It says "Applies support caps (0-100 range) to prevent overflow".
    // But usage suggests it returns `delta` and `why`.
    // Let's assume basic delta calculation for now. The logic above handles the delta generation.
    // If actual clamping logic is needed inside here, we need the `currentSupport` object.

    if (currentSupport) {
        for (const entity of ['people', 'holders', 'mom']) {
            if (deltas.momDied && entity === 'mom') continue; // Already handled

            const current = currentSupport[entity] || 50;
            const proposed = current + deltas[entity].delta;

            if (proposed > 100) deltas[entity].delta = 100 - current;
            if (proposed < 0) deltas[entity].delta = -current;
        }
    }

    return deltas;
}

/**
 * Extract challenger name from challengerSeat string
 * Example: "Sparta (Coercive Force)" → "Sparta"
 */
export function extractChallengerName(challengerSeat) {
    if (!challengerSeat || typeof challengerSeat !== 'string') {
        return 'Unknown Challenger';
    }

    const match = challengerSeat.match(/^([^(]+)/);
    return match ? match[1].trim() : challengerSeat.trim();
}

/**
 * Determines how dilemmas should feel based on the political system
 */
export function analyzeSystemType(systemName) {
    const lower = (systemName || "").toLowerCase();

    // Absolute power systems
    if (/(absolute|monarch|king|queen|emperor|sultan|divine|autocrat|dictator|tsar|czar|pharaoh)/i.test(lower)) {
        return {
            type: "absolute_monarchy",
            feel: "Player's decisions are swift and intimidating. Most people are somewhat afraid. Player has near-total control over the state.",
            dilemmaFraming: "Frame as demands from subjects, events requiring royal decree, or challenges to absolute authority"
        };
    }

    // Direct democracy / Assembly systems
    if (/(assembly|direct.*democracy|citizens.*assembly|athen)/i.test(lower)) {
        return {
            type: "direct_democracy",
            feel: "Player casts one vote among many citizens. They see aggregate results and must live with collective decisions. Influence through persuasion, not command.",
            dilemmaFraming: "Frame as votes on proposals, attempts to build coalitions through debate, public assemblies where player is one voice"
        };
    }

    // Parliamentary/Prime Minister systems
    if (/(prime|chancellor|minister|parliamentary|westminster)/i.test(lower)) {
        return {
            type: "parliamentary",
            feel: "Player has executive power but must maintain coalition support. Can be challenged by legislature, courts, or losing confidence vote.",
            dilemmaFraming: "Frame as policy decisions requiring coalition management, legal challenges, opposition demands, maintaining parliamentary confidence"
        };
    }

    // Presidential systems
    if (/(president|presidential)/i.test(lower)) {
        return {
            type: "presidential",
            feel: "Player has executive authority with checks from legislature and judiciary. Must navigate separation of powers.",
            dilemmaFraming: "Frame as executive decisions balanced against legislative approval, judicial review, public opinion"
        };
    }

    // Theocratic systems
    if (/(theocra|clergy|religious|spiritual|divine.*right|papal|caliphate)/i.test(lower)) {
        return {
            type: "theocracy",
            feel: "Player's authority comes from religious doctrine. Decisions justified by sacred texts or divine will. Religious leaders are key stakeholders.",
            dilemmaFraming: "Frame as religious interpretations, conflicts between doctrine and pragmatism, challenges from competing religious authorities"
        };
    }

    // Oligarchic/Council systems
    if (/(oligarch|council|junta|committee|politburo|triumvirate)/i.test(lower)) {
        return {
            type: "oligarchy",
            feel: "Player is first among equals in a ruling group. Must manage internal rivalries and maintain coalition within the elite circle.",
            dilemmaFraming: "Frame as power struggles within ruling circle, decisions requiring consensus among oligarchs, challenges to collective rule"
        };
    }

    // Tribal/Clan systems
    if (/(tribal|clan|chief|elder|warlord)/i.test(lower)) {
        return {
            type: "tribal",
            feel: "Player's authority based on personal loyalty, kinship ties, and proven strength. Must maintain honor and clan support.",
            dilemmaFraming: "Frame as matters of honor, clan disputes, challenges from rival leaders, maintaining warrior loyalty"
        };
    }

    // Futuristic/Colony systems
    if (/(colony|station|orbital|mars|space|interstellar|cyber|ai.*govern)/i.test(lower)) {
        return {
            type: "futuristic",
            feel: "Player navigates unique challenges of the setting (e.g., limited resources in space, AI integration, corporate control).",
            dilemmaFraming: "Frame as sci-fi appropriate challenges: resource scarcity, tech conflicts, corporate vs colony interests, survival vs ethics"
        };
    }

    // Corporate/Technocratic systems
    if (/(corporate|technocra|ceo|board|meritocra)/i.test(lower)) {
        return {
            type: "corporate",
            feel: "Player's authority based on efficiency and results. Must satisfy shareholders/stakeholders while managing resources.",
            dilemmaFraming: "Frame as business decisions with political consequences, shareholder demands, efficiency vs ethics tradeoffs"
        };
    }

    // Republican/Representative systems
    if (/(republic|representative.*democracy|congress)/i.test(lower)) {
        return {
            type: "republic",
            feel: "Player represents constituents in a complex system of representation. Must balance popular will with institutional processes.",
            dilemmaFraming: "Frame as legislative battles, constituent demands, procedural conflicts, representation vs pragmatism"
        };
    }

    // Default/Custom
    return {
        type: "custom",
        feel: `Analyze the unique political dynamics of "${systemName}" and show what it's like to operate within this system`,
        dilemmaFraming: "Frame events that fit this system's specific power structure and decision-making processes"
    };
}
