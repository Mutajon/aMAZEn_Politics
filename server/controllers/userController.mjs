import { GEMINI_KEY } from "../config/config.mjs";
import { getUsersCollection, getCountersCollection, incrementCounter } from "../db/mongodb.mjs";
import { LANGUAGE_NAMES } from "../config/constants.mjs";
import { aiJSONGemini, aiTextGemini } from "../utils/ai.mjs";

/**
 * Adaptively assign treatment to ensure balanced distribution
 * Selects from treatments with the minimum count, ensuring even distribution
 * @returns {Promise<string>} One of: 'fullAutonomy', 'semiAutonomy', 'noAutonomy'
 */
export async function assignRandomTreatment() {
    const treatments = ['fullAutonomy', 'semiAutonomy', 'noAutonomy'];
    const countersCollection = await getCountersCollection();

    // Get current counts for all treatments
    const counts = {};
    for (const treatment of treatments) {
        const counterName = `treatment_${treatment}`;
        const counter = await countersCollection.findOne({ name: counterName });
        counts[treatment] = counter?.value || 0;
    }

    // Find the minimum count
    const minCount = Math.min(...Object.values(counts));
    const underrepresented = treatments.filter(t => counts[t] === minCount);
    const selected = underrepresented[
        Math.floor(Math.random() * underrepresented.length)
    ];

    await incrementCounter(`treatment_${selected}`);

    return selected;
}

/**
 * POST /api/users/register
 */
export async function registerUser(req, res) {
    try {
        const { userId } = req.body;

        // Validate userId (email)
        if (!userId || typeof userId !== 'string' || !userId.includes('@')) {
            return res.status(400).json({
                success: false,
                error: 'Valid userId (email) is required'
            });
        }

        const usersCollection = await getUsersCollection();

        // Check if user already exists
        const existingUser = await usersCollection.findOne({ userId });

        if (existingUser) {
            // User exists - return existing treatment
            console.log(`[User Register] Existing user: ${userId}, treatment: ${existingUser.treatment}`);
            return res.json({
                success: true,
                userId: existingUser.userId,
                treatment: existingUser.treatment,
                isNewUser: false
            });
        }

        // New user - assign adaptive treatment
        const treatment = await assignRandomTreatment();
        const now = new Date();

        const newUser = {
            userId,
            treatment,
            createdAt: now,
            updatedAt: now
        };

        await usersCollection.insertOne(newUser);

        console.log(`[User Register] New user registered: ${userId}, treatment: ${treatment}`);

        res.json({
            success: true,
            userId: newUser.userId,
            treatment: newUser.treatment,
            isNewUser: true
        });

    } catch (error) {
        console.error('[User Register] ❌ Error:', error?.message || error);

        // Handle duplicate key error (race condition)
        if (error.code === 11000) {
            // User was created between check and insert - fetch existing
            try {
                const usersCollection = await getUsersCollection();
                const existingUser = await usersCollection.findOne({ userId: req.body.userId });
                if (existingUser) {
                    return res.json({
                        success: true,
                        userId: existingUser.userId,
                        treatment: existingUser.treatment,
                        isNewUser: false
                    });
                }
            } catch (fetchError) {
                console.error('[User Register] Failed to fetch existing user:', fetchError);
            }
        }

        res.status(500).json({
            success: false,
            error: 'Failed to register user',
            details: error.message
        });
    }
}

/**
 * POST /api/intro-paragraph
 */
export async function generateIntroParagraph(req, res) {
    try {
        if (!GEMINI_KEY) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

        const {
            role,
            gender,
            language,
            systemName,
            setting,
            authorityLevel,
            challengerName,
            model: modelOverride = null, // LAB MODE OVERRIDE
        } = req.body || {};

        const roleText = String(role || "").slice(0, 200).trim();
        const genderText = ["male", "female", "any"].includes(String(gender || "").toLowerCase())
            ? String(gender).toLowerCase()
            : "any";
        const languageCode = String(language || "he").toLowerCase();

        const systemNameText = String(systemName || "").slice(0, 200).trim();
        const settingText = String(setting || "").slice(0, 300).trim();
        const authorityLevelText = String(authorityLevel || "").slice(0, 50).trim();
        const challengerText = String(challengerName || "").slice(0, 200).trim();

        if (!roleText) return res.status(400).json({ error: "Missing role" });

        // Get language name for instructions
        const languageName = LANGUAGE_NAMES[languageCode] || LANGUAGE_NAMES.en;

        // Build system prompt with language instructions
        let system =
            "You are the same mysterious, amused Game Master who narrates the player's political simulation.\n" +
            "\n" +
            "Style:\n" +
            "- Welcoming, intriguing, slightly teasing\n" +
            "- Speak to the player as 'you' in second person\n" +
            "- Use clear, simple English suitable for non-native speakers (CEFR B1–B2)\n" +
            "- Prefer short sentences (about 8–18 words) and concrete wording\n" +
            "- Avoid idioms, slang, complex metaphors, and very rare or academic words\n" +
            "\n" +
            "Content rules:\n" +
            "- 2–3 sentences, 40–70 words total\n" +
            "- Present tense\n" +
            "- Vivid but not florid; no lists, no headings, no bullet points\n" +
            "- Avoid anachronisms; respect the historical setting and political system\n" +
            "- Keep names generic unless iconic to the role or setting\n" +
            "- If gender is male or female, you must use gender-appropriate grammar and verb forms. For Hebrew: use 'אתה' (you, male) with masculine verbs for male characters, and 'את' (you, female) with feminine verbs for female characters. All verbs must match the character's gender grammatically.";

        // Add language instruction if not English
        if (languageCode !== "en") {
            system += `\n\nWrite your response in ${languageName}. Use proper grammar and natural phrasing appropriate for ${languageName} speakers.`;
        }

        let user =
            `ROLE: ${roleText}\n` +
            `GENDER: ${genderText}\n` +
            `POLITICAL_SYSTEM: ${systemNameText}\n` +
            `SETTING: ${settingText}\n` +
            `AUTHORITY_LEVEL: ${authorityLevelText} (high = dictator/monarch, medium = oligarch/executive, low = citizen/weak)\n` +
            `MAIN_CHALLENGER: ${challengerText}\n` +
            "\n" +
            "TASK: Write one short paragraph that sets the scene on the player's first day in this role within this political world.\n" +
            "- Welcome them in the Game Master voice, as if you are watching their arrival.\n" +
            "- Hint at immediate tensions and power struggles around them, grounded in this system, setting, and authority level.\n" +
            "- Include one or two concrete ambient details from the setting (sounds, places, people, or objects).\n" +
            "- Use present tense. No bullet points. No headings.";

        // Add language instruction to user prompt if not English
        if (languageCode !== "en") {
            user += `\n\nWrite your response in ${languageName}.`;
            // Add specific Hebrew gender grammar instructions
            if (languageCode === "he" && (genderText === "male" || genderText === "female")) {
                if (genderText === "male") {
                    user += `\n\nIMPORTANT: Use masculine forms throughout: "אתה" (you), masculine verbs (נכנס, מרגיש, עומד, etc.). All verbs must be in masculine form.`;
                } else if (genderText === "female") {
                    user += `\n\nIMPORTANT: Use feminine forms throughout: "את" (you), feminine verbs (נכנסת, מרגישה, עומדת, etc.). All verbs must be in feminine form.`;
                }
            }
        }

        // tiny retry wrapper (handles occasional upstream 503s)
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        async function getParagraphOnce() {
            return (await aiTextGemini({ system, user, model: modelOverride || "gemini-2.5-flash" }))?.trim() || "";
        }

        let paragraph = "";
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                console.log(
                    `[server] intro-paragraph attempt ${attempt} starting for role: ${roleText.slice(0, 40)}...`
                );
                paragraph = await getParagraphOnce();
                console.log(
                    `[server] intro-paragraph attempt ${attempt} completed: got ${paragraph.length} chars`
                );
                if (paragraph) break;
                console.log(
                    `[server] intro-paragraph attempt ${attempt} returned empty, will retry`
                );
            } catch (err) {
                console.warn(
                    `[server] intro-paragraph attempt ${attempt} failed:`,
                    err?.message || err
                );
            }
            if (attempt === 1) await sleep(600); // simple backoff before the second try
        }

        if (!paragraph) {
            console.error("[server] intro-paragraph: ALL attempts exhausted, returning 503");
            return res.status(503).json({ error: "No content returned" });
        }
        console.log("[server] intro-paragraph: SUCCESS, sending response");
        return res.json({ paragraph });
    } catch (e) {
        console.error("Error in /api/intro-paragraph:", e?.message || e);
        return res.status(500).json({ error: "Intro generation failed" });
    }
}

/**
 * POST /api/validate-role
 */
export async function validateRole(req, res) {
    const {
        text,
        role,
        input,
        model: modelOverride = null
    } = req.body || {};
    const raw = (text || role || input || "").toString().trim();

    const system =
        "You validate a single short line describing a player's ROLE in a game where they'll face political/social dilemmas.\n" +
        "ACCEPT if the input describes ANY plausible role with enough context to understand the setting.\n" +
        "The setting can be EXPLICIT (place/time stated) or IMPLICIT (inferred from the role itself).\n" +
        "Be PERMISSIVE: the role does NOT need to be political or leadership-oriented. " +
        "Teachers, farmers, shopkeepers, workers - all are valid as long as there's context.\n\n" +
        "Examples that SHOULD PASS:\n" +
        "- 'high school teacher in Haiti' (role + setting)\n" +
        "- 'farmer in medieval England' (role + setting)\n" +
        "- 'shopkeeper during WWII' (role + setting)\n" +
        "- 'partisan leader in WWII' (role + setting)\n" +
        "- 'Prime Minister of Israel' (role + setting)\n" +
        "- 'Mars Colony Leader' (role + implicit future setting)\n" +
        "- 'Viking Chief' (role + implicit historical setting)\n" +
        "- 'Pharaoh' (role + implicit ancient Egypt setting)\n\n" +
        "Examples that SHOULD FAIL:\n" +
        "- Too vague: 'a leader', 'someone powerful', 'a person' (no context)\n" +
        "- Not a role: 'in medieval England' (setting but no role), 'freedom' (abstract concept)\n" +
        "- Gibberish: 'asdfgh', 'xyz123'\n\n" +
        "Return STRICT JSON only as {\"valid\": true|false, \"reason\": \"short reason if invalid\"}. No extra keys, no prose.";

    const user = `Input: ${raw || ""}`;

    const out = await aiJSONGemini({ system, user, model: modelOverride || "gemini-2.5-flash", temperature: 0, fallback: null });
    if (!out || typeof out.valid !== "boolean") {
        return res.status(503).json({ error: "AI validator unavailable" });
    }
    return res.json({ valid: !!out.valid, reason: String(out.reason || "") });
}

/**
 * POST /api/extract-trait
 */
export async function extractTrait(req, res) {
    const { description, language, model: modelOverride = null } = req.body || {};

    if (!description) {
        return res.status(400).json({ error: "Description required" });
    }

    const system = `You extract a trait from a user's self-description for a magic mirror game.
The trait must fit seamlessly into the mirror sentence.

Rules:
1. The user's input language is: ${language || 'en'}
2. If language is Hebrew (he), return a Hebrew ADJECTIVE trait that fits: "מראה מראה שעל הקיר, מי ה___ מכולם?"
   The trait must be a masculine singular adjective.
   Examples: חכם, כריזמטי, צודק, עוצמתי, אמיץ, יפה, יצירתי
3. If language is English, return an English SUPERLATIVE that fits: "Mirror, mirror on the wall, who's the ___ of them all?"
   Examples: smartest, bravest, most creative
4. Return JSON: {"trait": "adjective in appropriate language"}

Examples:
- Input (en): "I'm very smart" → {"trait": "smartest"}
- Input (he): "אני רוצה להיות הכי חכם" → {"trait": "חכם"}
- Input (he): "אני אמיץ מאוד" → {"trait": "אמיץ"}
- Input (he): "אני רוצה להיות עשיר" → {"trait": "עשיר"}
- Input (en): "I'm creative and artistic" → {"trait": "most creative"}`;

    try {
        const result = await aiJSONGemini({
            system,
            user: description,
            model: modelOverride || "gemini-2.5-flash",
            temperature: 0.2,
            fallback: { trait: description }
        });

        res.json(result);
    } catch (error) {
        console.error("Error extracting trait:", error);
        res.json({ trait: description });
    }
}
