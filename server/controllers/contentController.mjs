import { aiJSONGemini } from "../utils/ai.mjs";
import { getScenarioSuggestionsCollection } from "../db/mongodb.mjs";
import { ANTI_JARGON_RULES, ISSUE_KEYS, ISSUE_LABELS } from "../config/constants.mjs";
import { MODEL_VALIDATE_GEMINI } from "../config/config.mjs";
import {
    buildSuggestionValidatorSystemPrompt,
    buildSuggestionValidatorUserPrompt
} from "../services/promptBuilders.mjs";

// -------------------- HELPERS --------------------

function backgroundHeuristic(role = "") {
    const r = role.toLowerCase();
    if (r.includes("china")) return "red pagoda";
    if (r.includes("japan")) return "torii gate";
    if (r.includes("german") || r.includes("germany") || r.includes("kanzler") || r.includes("chancellor"))
        return "brandenburg gate";
    if (r.includes("rome") || r.includes("roman")) return "colosseum";
    if (r.includes("egypt")) return "pyramids of giza";
    if (r.includes("viking")) return "drakkar longship";
    if (r.includes("arab") || r.includes("caliph")) return "crescent-adorned minaret";
    return "ornate palace backdrop";
}

// -------------------- ROUTES --------------------

/**
 * POST /api/bg-suggestion
 */
export async function suggestBackground(req, res) {
    try {
        const { role, gender, model: modelOverride = null } = req.body || {};
        const system =
            "Output a single JSON object with key 'object' naming one concise, iconic background object that visually matches the role. " +
            "Max 3 words. Example: {\"object\":\"red pagoda\"}. No prose.";
        const genderWord = gender === "female" ? "female" : gender === "male" ? "male" : "any gender";
        const user = `Role: ${role || ""}. Gender: ${genderWord}. JSON ONLY.`;

        const ai = await aiJSONGemini({
            system,
            user,
            model: modelOverride || "gemini-3-flash-preview",
            temperature: 0.2,
            fallback: { object: backgroundHeuristic(role) },
        });

        const object =
            typeof ai?.object === "string" && ai.object.trim() ? ai.object.trim() : backgroundHeuristic(role);
        return res.json({ object });
    } catch (err) {
        console.error("Error in /api/bg-suggestion:", err);
        return res.status(500).json({ object: backgroundHeuristic(req?.body?.role) });
    }
}

/**
 * POST /api/compass-analyze
 * Analyze text for political compass values
 */
export async function analyzeCompass(req, res) {
    try {
        const { text: rawText, model: modelOverride = null } = req.body || {};
        const text = String(rawText || "").trim();
        if (!text) return res.status(400).json({ error: "Missing 'text'." });

        // OPTIMIZED: Component definitions moved to system prompt (81% token reduction: 682 → 133 tokens)
        // Old approach sent full cues (2,725 chars) with every request
        // New approach: compact reference in system prompt, reused across all requests
        const system =
            "You are a political compass analyzer. Map text to these 40 components:\n\n" +
            "WHAT (ultimate goals):\n" +
            "0=Truth(facts,reliability) 1=Liberty(choice,autonomy) 2=Equality(fairness,equity) 3=Care(solidarity,together) 4=Courage(create,bold) 5=Wellbeing(health,happiness) 6=Security(safety,order) 7=Freedom(responsibility,consequences) 8=Honor(sacrifice,duty) 9=Sacred(awe,reverence)\n\n" +
            "WHENCE (justification):\n" +
            "0=Evidence(data,facts) 1=PublicReason(universal) 2=Personal(intuition,conscience) 3=Tradition(ancestors,customs) 4=Revelation(divine,cosmic) 5=Nature(telos,purpose) 6=Pragmatic(works,practical) 7=Aesthetic(beauty,fitting) 8=Fidelity(loyalty,promised) 9=Law(authority,office)\n\n" +
            "HOW (means):\n" +
            "0=Law(regulations,courts) 1=Deliberation(debate,compromise) 2=Mobilize(organize,march) 3=Markets(prices,incentives) 4=MutualAid(neighbors,direct) 5=Ritual(ceremony,tradition) 6=Design(nudge,UX) 7=Enforce(force,peace) 8=CivicCulture(schools,media) 9=Philanthropy(donate,fund)\n\n" +
            "WHITHER (recipients):\n" +
            "0=Self(personal) 1=Family(kin) 2=Friends(chosen) 3=InGroup(tribe,us) 4=Nation(country) 5=Civilization(culture,region) 6=Humanity(all people) 7=Earth(planet,creatures) 8=Cosmos(sentient life) 9=God(divine)\n\n" +
            "Return STRICT JSON ONLY: array of items like " +
            '[{"prop":"what|whence|how|whither","idx":0-9,"polarity":"positive|negative","strength":"mild|strong"}].\n' +
            "- Max 6 items. Multi-component hits allowed. No extra prose.";

        const user =
            `TEXT: """${text}"""\n\n` +
            "TASK:\n" +
            "- Identify which components above are supported (positive) or opposed (negative) by this text\n" +
            "- Assess strength: mild (slight/implied) or strong (explicit/emphasized)\n" +
            "- Return JSON ARRAY ONLY";

        const items = await aiJSONGemini({
            system,
            user,
            model: modelOverride || "gemini-3-flash-preview",
            temperature: 0.2,
            fallback: [],
        });

        return res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
        console.error("Error in /api/compass-analyze:", e?.message || e);
        return res.status(502).json({ items: [] });
    }
}

/**
 * POST /api/news-ticker
 * Generate satirical scrolling news items
 */
export async function generateNewsTicker(req, res) {
    try {
        const day = Number(req.body?.day || 1);
        const role = String(req.body?.role || "").trim();
        const systemName = String(req.body?.systemName || "").trim();
        const epochReq = String(req.body?.epoch || "").toLowerCase(); // "modern" | "ancient" | "futuristic" (optional)
        const last = req.body?.last || null; // { title, summary, cost? }
        const language = String(req.body?.language || "en").toLowerCase();
        const modelOverride = req.body?.model || null;
        const languageName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en;

        // Heuristic epoch if caller didn't pass one
        function classifyEpoch(sys = "", r = "") {
            const t = (sys + " " + r).toLowerCase();
            if (/(space|colony|cyber|ai|interstellar|orbital|futur)/.test(t)) return "futuristic";
            if (/(monarch|king|queen|theocrat|clergy|empire|duke|feud|sultan|caliph)/.test(t)) return "ancient";
            return "modern";
        }
        const epoch = epochReq || classifyEpoch(systemName, role);

        const mode = day <= 1 ? "onboarding" : "reaction";

        const system =
            "You are a wry political satire writer for a political simulation game. " +
            "Write **3 VERY short, amusing, satirical** ticker items reacting to events. " +
            "Return STRICT JSON ARRAY ONLY (length 3). " +
            'Each item: {"id":"str","kind":"news|social","tone":"up|down|neutral","text":"<=70 chars"}. ' +
            "Be witty, punchy one-liners with NO source names, NO hashtags, NO emojis.\n\n" +
            ANTI_JARGON_RULES;

        const user = [
            `MODE: ${mode}`,                                  // onboarding | reaction
            `EPOCH: ${epoch}`,                                // modern | ancient | futuristic
            `ROLE: ${role || "unknown role"}`,
            `SYSTEM: ${systemName || "unknown system"}`,
            last
                ? `LAST CHOICE: ${String(last.title || "")}. ${String(last.summary || "")}. COST=${Number(last.cost || 0)}.`
                : "LAST CHOICE: n/a",
            "",
            "EXAMPLES of good short amusing items (follow this style):",
            "- \"New leader sworn in; GPS still says 'recalculating'\"",
            "- \"First decree: coffee upgraded to national security asset\"",
            "- \"Parliament applauds; Wi-Fi password changes to 'democracy123'\"",
            "- \"Leader raises taxes; piggy banks file for asylum\"",
            "- \"Finance minister smiles; wallets request a moment of silence\"",
            "",
            "ONBOARDING (day 1): 3 witty items about the player taking power.",
            "REACTION (day ≥2): 3 witty items reacting directly to LAST CHOICE consequences.",
            "",
            "RULES:",
            "- Each text MAXIMUM 70 characters total",
            "- NO source names (like 'Daily News:', '@Twitter:', etc.)",
            "- Single sentence, satirical and witty",
            "- Mix of 'news' and 'social' kinds",
            "- JSON ARRAY ONLY; no prose outside the array",
            language !== 'en' ? `\n- Write the "text" content in ${languageName}.` : '',
            language === 'he' ? `\n- HEBREW RULE: If referring to the player directly (rare), use PLURAL MASCULINE (אתם/שלכם). Ideally use 3rd person (המנהיגות, הממשלה).` : ''
        ].join("\n");

        console.log("[news-ticker] Request params:", { day, role: role.slice(0, 50), systemName, mode, epoch });

        const items = await aiJSONGemini({
            system,
            user,
            model: modelOverride || "gemini-3-flash-preview",
            fallback: null, // No fallbacks - always generate based on actual context
        });

        console.log("[news-ticker] AI returned:", {
            itemsType: typeof items,
            isArray: Array.isArray(items),
            isNull: items === null,
            itemsValue: items
        });

        // Check if items is null (API failure) and provide test data for development
        if (items === null) {
            console.log("[news-ticker] AI generation failed, providing test data for development");
            const testItems = [
                { id: "test-1", kind: "news", tone: "neutral", text: "Markets react to latest policy announcements" },
                { id: "test-2", kind: "social", tone: "up", text: "Citizens praise new government initiative" },
                { id: "test-3", kind: "news", tone: "down", text: "Opposition questions economic strategy" }
            ];
            return res.json({ items: testItems });
        }

        // Sanitize minimally
        const coerce = (x, i) => {
            const id = String(x?.id || `news-${i}`);
            const kind = String(x?.kind).toLowerCase() === "social" ? "social" : "news";
            const tone0 = String(x?.tone || "neutral").toLowerCase();
            const tone = tone0 === "up" || tone0 === "down" ? tone0 : "neutral";
            const text = String(x?.text || "").slice(0, 70);
            return { id, kind, tone, text };
        };

        const out = Array.isArray(items) ? items.slice(0, 3).map(coerce) : [];
        console.log("[news-ticker] Returning items:", out.length, "items");
        return res.json({ items: out });
    } catch (e) {
        console.error("Error in /api/news-ticker:", e?.message || e);

        // When OpenAI quota is exceeded, provide minimal test data to see loading sequence work
        if (e?.message?.includes("insufficient_quota") || e?.message?.includes("429")) {
            console.log("[news-ticker] OpenAI quota exceeded, providing test data for development");
            const testItems = [
                { id: "test-1", kind: "news", tone: "neutral", text: "Markets react to latest policy announcements" },
                { id: "test-2", kind: "social", tone: "up", text: "Citizens praise new government initiative" },
                { id: "test-3", kind: "news", tone: "down", text: "Opposition questions economic strategy" }
            ];
            return res.json({ items: testItems });
        }

        return res.status(502).json({ items: [] });
    }
}

/**
 * POST /api/validate-suggestion
 * Validate user custom suggestion
 */
export async function validateSuggestion(req, res) {
    try {
        const {
            text,
            title,
            description,
            era,
            settingType,
            year,
            politicalSystem = "",
            roleName = "",
            roleScope = "",
            model: modelOverride = null
        } = req.body || {};
        if (typeof text !== "string" || typeof title !== "string" || typeof description !== "string") {
            return res.status(400).json({ error: "Missing text/title/description" });
        }

        const system = buildSuggestionValidatorSystemPrompt({
            era,
            year,
            settingType,
            politicalSystem,
            roleName,
            roleScope
        });

        const user = buildSuggestionValidatorUserPrompt({
            title,
            description,
            suggestion: text,
            era,
            year,
            settingType,
            politicalSystem,
            roleName,
            roleScope
        });

        // Use Gemini for validation (gemini-3-flash-preview)
        console.log(`[validate-suggestion] Using Gemini model: ${MODEL_VALIDATE_GEMINI}`);
        const raw = await aiJSONGemini({
            system,
            user,
            model: modelOverride || MODEL_VALIDATE_GEMINI,
            temperature: 0,
            fallback: { valid: true, reason: "Accepted (fallback)" }
        });

        const valid = typeof raw?.valid === "boolean" ? raw.valid : true;

        // Only include reason when validation fails (saves tokens)
        if (valid) {
            return res.json({ valid });
        } else {
            const reason =
                typeof raw?.reason === "string" && raw.reason.trim().length > 0
                    ? raw.reason.trim().slice(0, 240)
                    : "I don't think that fits this setting.";
            return res.json({ valid, reason });
        }
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("validate-suggestion error:", err?.message || err);
        return res.status(500).json({ error: "Validator failed" });
    }
}

/**
 * POST /api/dynamic-parameters
 * Generate dynamic status parameters based on player choice
 */
export async function generateDynamicParameters(req, res) {
    try {
        const {
            lastChoice, // DilemmaAction: { id, title, summary, cost, iconHint }
            politicalContext, // { role, systemName, day, totalDays, compassValues }
            debug = false,
            model: modelOverride = null,
            language = 'en'
        } = req.body;

        const languageCode = String(language).toLowerCase();
        const languageName = LANGUAGE_NAMES[languageCode] || LANGUAGE_NAMES.en;

        if (!lastChoice) {
            return res.json({ parameters: [] });
        }

        if (debug) {
            console.log("[/api/dynamic-parameters] IN:", {
                choice: lastChoice.title,
                role: politicalContext?.role,
                day: politicalContext?.day
            });
        }

        const system = `You are a political simulation system that generates ultra-short dynamic status parameters based on player actions.

Generate between 1 and 3 contextually relevant dynamic parameters that show the immediate consequences of the player's political decision. These parameters must be:
- ULTRA-SHORT: maximum 4-5 words each
- No explanations or narration
- DRAMATIC, concrete events or outcomes
- Numbers are OPTIONAL — use them only when they add dramatic impact
- Focus on STORYTELLING, not statistics

${ANTI_JARGON_RULES}

CRITICAL RESTRICTIONS (ABSOLUTELY ENFORCED):

1. NEVER mention support, approval, satisfaction, morale, or popularity:
   - Avoid any reference to public opinion, faction attitudes, loyalty, or trust
   - Do not report percentage swings in sentiment or confidence

2. NEVER mention budget, currency, revenue, or financial reserves:
   - Financial impacts are tracked elsewhere

3. NEVER output vague or cosmetic observations:
   - Each parameter must describe a concrete, consequential change in the world

4. ALWAYS reflect tangible fallout from the player's action:
   - Show dramatic events, physical changes, or significant outcomes that matter in the story
   - Numbers are optional but welcome when they amplify drama

5. Each parameter must be:
   - Dramatic and concrete (avoid vague abstractions)
   - Interesting (reveals meaningful stakes or pressure)
   - Non-redundant with other surfaced information
   - Focused on direct consequences of the action

✅ GOOD EXAMPLES:
- "Royal palace stormed" (dramatic, no number needed)
- "Fleet defects to rebels" (dramatic, no number needed)
- "4 cities under curfew" (number adds scope)
- "120 factories reopen today" (number adds scale)
- "Generals purged overnight" (dramatic, no number needed)

❌ BAD EXAMPLES:
- "75% citizens unhappy" (abstract percentage)
- "Public approval +12%" (sentiment metric)
- "Parliament trust restored" (vague abstraction)
- "Meetings scheduled" (boring, procedural)

Choose appropriate icons from: Users, TrendingUp, TrendingDown, Shield, AlertTriangle, Heart, Building, Globe, Leaf, Zap, Target, Scale, Flag, Crown, Activity, etc.

Set tone as "up" (positive/green), "down" (negative/red), or "neutral" (blue) based on whether this is generally good or bad for the player's position.

${languageCode !== 'en' ? `LANGUAGE: Write the "text" field in ${languageName}.` : ''}
${languageCode === 'he' ? `HEBREW RULES:
- Use PLURAL MASCULINE if addressing the player (Rare).
- Prefer impersonal/collective descriptions ("The army rebelled", not "Your army rebelled").
- Use "shel" for possession.` : ''}`;

        const user = `Political Context:
Role: ${politicalContext?.role || "Leader"}
Political System: ${politicalContext?.systemName || "Democracy"}
Day: ${politicalContext?.day || 1} of ${politicalContext?.totalDays || 7}

Player's Last Decision:
Action: "${lastChoice.title}"
Details: ${lastChoice.summary}
Cost: ${lastChoice.cost > 0 ? `+$${lastChoice.cost}` : `$${lastChoice.cost}`}

Based on this political decision, generate 1-3 specific dynamic parameters that would realistically result from this action. Return as JSON:

{
  "parameters": [
    {
      "id": "unique_id",
      "icon": "IconName",
      "text": "Dramatic consequence (numbers optional)",
      "tone": "up|down|neutral"
    }
  ]
}`;

        const forbiddenDynamicWords = [
            "approval",
            "approve",
            "support",
            "backing",
            "popularity",
            "favorability",
            "loyalty",
            "morale",
            "confidence",
            "satisfaction",
            "trust"
        ];

        const percentSentimentWords = [
            "people",
            "citizens",
            "populace",
            "voters",
            "residents",
            "supporters",
            "allies",
            "faction",
            "factions",
            "base",
            "crowd",
            "public",
            "opposition"
        ];

        const hasForbiddenDynamicText = text => {
            if (typeof text !== "string" || !text.trim()) return false;
            const lowered = text.toLowerCase();
            if (forbiddenDynamicWords.some(word => lowered.includes(word))) return true;
            if (/\b\d{1,3}%\b/.test(lowered)) {
                if (forbiddenDynamicWords.some(word => lowered.includes(word))) return true;
                if (percentSentimentWords.some(word => lowered.includes(word))) return true;
            }
            return false;
        };

        let attempts = 0;
        let parameters = [];

        while (attempts < 2) {
            const result = await aiJSONGemini({
                system,
                user,
                model: modelOverride || "gemini-3-flash-preview",
                temperature: 0.8,
                fallback: { parameters: [] }
            });

            const mapped = Array.isArray(result.parameters)
                ? result.parameters.slice(0, 3).map((param, index) => ({
                    id: param.id || `param_${index}`,
                    icon: param.icon || "AlertTriangle",
                    text: param.text || "Unknown effect",
                    tone: ["up", "down", "neutral"].includes(param.tone) ? param.tone : "neutral"
                }))
                : [];

            const hasForbidden = mapped.some(param => hasForbiddenDynamicText(param.text));
            if (!hasForbidden) {
                parameters = mapped;
                break;
            }

            console.log(`[dynamic-parameters] Result contained forbidden words, retry ${attempts + 1}`);
            attempts++;
        }

        if (debug) {
            console.log("[/api/dynamic-parameters] OUT:", parameters);
        }

        return res.json({ parameters });

    } catch (error) {
        console.error("Error in /api/dynamic-parameters:", error);
        // Return empty list on error to prevent blocking UI
        return res.json({ parameters: [] });
    }
}

// Assuming getScenarioSuggestionsCollection is imported from a utility file, e.g.:
// import { getScenarioSuggestionsCollection } from '../lib/db';

/**
 * POST /api/suggest-scenario
 * Save user submitted scenario
 */
export async function suggestScenario(req, res) {
    try {
        const { title, role, settings, introParagraph, topicsToEmphasis } = req.body || {};

        // Validate required fields
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Title is required'
            });
        }

        if (!role || typeof role !== 'string' || role.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Role is required'
            });
        }

        if (!settings || typeof settings !== 'string' || settings.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Settings (place + time) is required'
            });
        }

        // Get the scenario suggestions collection
        const collection = await getScenarioSuggestionsCollection();

        // Create the document
        const suggestion = {
            title: title.trim(),
            role: role.trim(),
            settings: settings.trim(),
            introParagraph: introParagraph?.trim() || null,
            topicsToEmphasis: topicsToEmphasis?.trim() || null,
            createdAt: new Date(),
            status: 'pending' // For future use
        };

        // Insert into database
        await collection.insertOne(suggestion);

        console.log(`[API] Scenario suggestion saved: ${title}`);

        return res.json({
            success: true,
            message: 'Scenario suggestion saved successfully'
        });
    } catch (error) {
        console.error("Error in /api/suggest-scenario:", error?.message || error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save scenario suggestion'
        });
    }
}


/**
 * POST /api/narrative-seed
 * Generate narrative memory scaffold for 7-day story arc
 */
export async function seedNarrative(req, res) {
    try {
        const { gameId, gameContext, model: modelOverride = null } = req.body;

        // Validate required fields
        if (!gameId || typeof gameId !== 'string') {
            return res.status(400).json({ error: "Missing or invalid gameId" });
        }

        if (!gameContext) {
            return res.status(400).json({ error: "Missing gameContext" });
        }

        console.log(`[NARRATIVE-SEED] Generating narrative scaffold for gameId=${gameId}`);

        // Fallback response if AI fails
        const fallback = {
            threads: [
                "Rising tensions with institutional opposition",
                "Economic pressures demand difficult trade-offs",
                "Personal legitimacy questioned by key factions"
            ],
            climaxCandidates: [
                "Final confrontation with main institutional opponent - legitimacy crisis",
                "Economic collapse forces radical reforms or compromise"
            ],
            thematicEmphasis: {
                coreConflict: "autonomy vs institutional control",
                emotionalTone: "mounting pressure",
                stakes: "regime survival"
            }
        };

        // Extract key context for narrative seeding
        const {
            role,
            systemName,
            systemDesc,
            powerHolders,
            challengerSeat,
            topCompassValues,
            thematicGuidance,
            supportProfiles
        } = gameContext;

        // Log input validation (after variables are declared)
        console.log(`[NARRATIVE-SEED] Input context:`);
        console.log(`  - Role: ${role || '(missing)'}`);
        console.log(`  - System: ${systemName || '(missing)'}`);
        console.log(`  - Power holders: ${Array.isArray(powerHolders) ? powerHolders.length : 'invalid'}`);
        console.log(`  - Compass values: ${Array.isArray(topCompassValues) ? topCompassValues.length : 'invalid'}`);
        console.log(`  - Support profiles: ${supportProfiles ? (supportProfiles.people || supportProfiles.challenger ? 'valid object' : 'empty object') : 'null'}`);

        // Build system prompt for narrative seeding
        const systemPrompt = `${ANTI_JARGON_RULES}

TASK: You create a compact narrative scaffold for a 7-day political dilemma game.

PURPOSE: Generate 2-3 concrete dramatic threads that will:
- Create narrative coherence across 7 days
- Escalate naturally from Day 1 → Day 7
- Culminate in a climactic Turn 7 moment
- Allow player agency (threads are suggestions, not requirements)

RULES:
- Threads must be CONCRETE and POLITICAL (not abstract themes)
- Make them era-appropriate and setting-specific
- Each thread should involve specific stakeholders/factions
- Avoid bureaucratic minutiae unless dramatically charged
- Keep stakes HUMAN, VISCERAL, and CONSEQUENTIAL
- 1-2 sentences per thread maximum
- No explicit labeling of threads in actual dilemmas (weave subtly)
- Player compass values are provided for inspiration, not requirements
- Historical authenticity > value integration (avoid anachronisms)
- Threads must be DISTINCT storylines (do not describe different beats of the same plot or different days of one tension)
- Each thread must be viable as a stand-alone narrative arc the game can follow

OUTPUT FORMAT (STRICT JSON):
{
  "threads": ["thread 1 description", "thread 2 description", "thread 3 description"],
  "climaxCandidates": ["climax option 1", "climax option 2"],
  "thematicEmphasis": {
    "coreConflict": "brief description of central tension",
    "emotionalTone": "1-2 words describing mood progression",
    "stakes": "1-3 words describing what's at risk"
  }
}`;

        // Build user prompt with game context
        const compassSummary = (topCompassValues || [])
            .map(cv => `${cv.dimension}:${cv.componentName}(${cv.value})`)
            .join(", ");

        const powerSummary = (powerHolders || [])
            .slice(0, 4)
            .map(h => `${h.name} (${h.percent}%)`)
            .join(", ");

        const challengerName = challengerSeat?.name || "Unknown";
        const challengerNote = challengerSeat?.note || "";

        // Group compass values by dimension for clarity
        const compassByDimension = (topCompassValues || []).reduce((acc, cv) => {
            if (!acc[cv.dimension]) acc[cv.dimension] = [];
            acc[cv.dimension].push(cv.componentName);
            return acc;
        }, {});

        const compassText = Object.keys(compassByDimension).length > 0
            ? `TOP PLAYER VALUES (for narrative inspiration):
- What (goals): ${compassByDimension.what?.join(', ') || 'N/A'}
- How (means): ${compassByDimension.how?.join(', ') || 'N/A'}
- Whence (justification): ${compassByDimension.whence?.join(', ') || 'N/A'}
- Whither (recipients): ${compassByDimension.whither?.join(', ') || 'N/A'}`
            : "TOP PLAYER VALUES: None";

        const userPrompt = `ROLE: ${role || "Unknown Leader"}
POLITICAL SYSTEM: ${systemName || "Unknown System"}
SYSTEM DESCRIPTION: ${(systemDesc || "").slice(0, 300)}

POWER HOLDERS: ${powerSummary || "None"}
MAIN CHALLENGER: ${challengerName} - ${challengerNote}

${compassText}

THEMATIC GUIDANCE: ${thematicGuidance || "Autonomy vs Heteronomy, Liberalism vs Totalism"}

SUPPORT BASELINES:
${formatSupportProfilesForPrompt(supportProfiles)}

TASK: Generate 3 distinct dramatic threads, 2 climax candidates, and thematic emphasis.

REQUIREMENTS:
- Threads must involve SPECIFIC STAKEHOLDERS from the power holders above
- Make challenger ${challengerName} central to at least ONE thread
- Ground threads in the political system context (${systemName})
- OPTIONAL: If narratively coherent with historical/role context, weave value tensions involving player's top values (especially ${(topCompassValues || []).filter(cv => cv.dimension === 'what' || cv.dimension === 'how').slice(0, 4).map(v => v.componentName).join(", ") || "the player's values"})
- Prioritize era-appropriate conflicts over modern value frameworks
- Only integrate values where they feel natural to the setting
- Ensure each thread can escalate naturally over 7 days on its own (avoid referencing specific future days or combining multiple beats into one thread)
- Make each thread cover a different axis of conflict (e.g., military vs civil unrest vs legitimacy crisis) so they are not sequential chapters of one storyline
- Make climax candidates feel like HIGH-STAKES turning points
- Avoid day-by-day language like "By Day 4..." unless absolutely required—the game will choose when to surface each thread

Return STRICT JSON ONLY.`;

        // Call AI with Gemini model
        const result = await aiJSONGemini({
            system: systemPrompt,
            user: userPrompt,
            model: modelOverride || "gemini-3-flash-preview",
            temperature: 0.7, // Slightly more creative for narrative generation
            fallback
        });

        // Normalize and validate response
        const narrativeMemory = {
            threads: Array.isArray(result?.threads) && result.threads.length >= 2
                ? result.threads.slice(0, 3).map(t => String(t).slice(0, 300))
                : fallback.threads,
            climaxCandidates: Array.isArray(result?.climaxCandidates) && result.climaxCandidates.length >= 2
                ? result.climaxCandidates.slice(0, 2).map(c => String(c).slice(0, 300))
                : fallback.climaxCandidates,
            thematicEmphasis: {
                coreConflict: String(result?.thematicEmphasis?.coreConflict || fallback.thematicEmphasis.coreConflict).slice(0, 200),
                emotionalTone: String(result?.thematicEmphasis?.emotionalTone || fallback.thematicEmphasis.emotionalTone).slice(0, 100),
                stakes: String(result?.thematicEmphasis?.stakes || fallback.thematicEmphasis.stakes).slice(0, 100)
            },
            threadDevelopment: [] // Will be populated as threads advance across days
        };

        // Log narrative content in human-readable format
        console.log(`[NARRATIVE-SEED] ✅ Generated narrative scaffold:`);
        console.log(`  📖 THREADS (${narrativeMemory.threads.length}):`);
        narrativeMemory.threads.forEach((thread, i) => {
            console.log(`     ${i + 1}. ${thread}`);
        });
        console.log(`  🎬 CLIMAX CANDIDATES (${narrativeMemory.climaxCandidates.length}):`);
        narrativeMemory.climaxCandidates.forEach((climax, i) => {
            console.log(`     ${i + 1}. ${climax}`);
        });
        console.log(`  🎭 THEMATIC EMPHASIS:`);
        console.log(`     - Core Conflict: ${narrativeMemory.thematicEmphasis.coreConflict}`);
        console.log(`     - Emotional Tone: ${narrativeMemory.thematicEmphasis.emotionalTone}`);
        console.log(`     - Stakes: ${narrativeMemory.thematicEmphasis.stakes}`);

        return res.json({ narrativeMemory });

    } catch (e) {
        console.error("[NARRATIVE-SEED] ❌ Error:", e?.message || e);
        return res.status(500).json({
            error: "Narrative seeding failed",
            message: e?.message || "Unknown error",
            fallback: {
                threads: [
                    "Rising tensions with institutional opposition",
                    "Economic pressures demand difficult trade-offs",
                    "Personal legitimacy questioned by key factions"
                ],
                climaxCandidates: [
                    "Final confrontation with main institutional opponent",
                    "Economic collapse forces radical reforms"
                ],
                thematicEmphasis: {
                    coreConflict: "autonomy vs institutional control",
                    emotionalTone: "mounting pressure",
                    stakes: "regime survival"
                },
                threadDevelopment: []
            }
        });
    }
}

// -------------------- SUPPORT PROFILE HELPERS --------------------

function formatSupportProfilesForPrompt(profiles) {
    if (!profiles) {
        return "- No baseline stances provided (infer from narrative).";
    }

    const blocks = [];
    const makeBlock = (label, profile) => {
        if (!profile) {
            return `- ${label}: No baseline supplied.`;
        }
        const baseLine = `- ${label}: ${profile.summary || "Baseline not provided."}`;
        const stanceText = summarizeStances(profile);
        return stanceText ? `${baseLine}\n  • ${stanceText.split("; ").join("\n  • ")}` : baseLine;
    };

    blocks.push(makeBlock("People", profiles.people));
    blocks.push(makeBlock("Challenger", profiles.challenger));
    return blocks.join("\n");
}

function summarizeStances(profile) {
    if (!profile || !profile.stances) return "";
    const parts = [];
    ISSUE_KEYS.forEach((key) => {
        const text = profile.stances[key];
        if (text) {
            parts.push(`${ISSUE_LABELS[key]}: ${text}`);
        }
    });
    return parts.join("; ");
}

