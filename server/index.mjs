// server/index.mjs
import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

import path from "path";
import { fileURLToPath } from "url";
import loggingRouter from "./api/logging.mjs";
import {
  storeConversation,
  getConversation,
  touchConversation,
  deleteConversation,
  startCleanupTask
} from "./services/conversationStore.mjs";
import { getCountersCollection, incrementCounter, getUsersCollection, getScenarioSuggestionsCollection, getHighscoresCollection, getDb } from "./db/mongodb.mjs";
import { getTheoryPrompt } from "./theory-loader.mjs";
import {
  OPENAI_KEY, ANTHROPIC_KEY, XAI_KEY, GEMINI_KEY,
  CHAT_URL, IMAGE_URL, XAI_CHAT_URL, XAI_IMAGE_URL, GEMINI_CHAT_URL, GEMINI_IMAGE_URL,
  anthropic,
  MODEL_VALIDATE, MODEL_NAMES, MODEL_ANALYZE, MODEL_MIRROR, MODEL_MIRROR_ANTHROPIC,
  MODEL_DILEMMA, MODEL_DILEMMA_PREMIUM, MODEL_DILEMMA_ANTHROPIC, MODEL_DILEMMA_XAI, MODEL_DILEMMA_GEMINI,
  MODEL_COMPASS_HINTS,
  IMAGE_MODEL_OPENAI, IMAGE_MODEL_XAI, IMAGE_MODEL_GEMINI, IMAGE_SIZE, IMAGE_QUALITY,

} from "./config/config.mjs";

import {
  stripMarkdownCodeBlocks, stripJsonComments, normalizeControlCharacters, removeTrailingCommas, safeParseJSON,
  aiJSON, aiJSONGemini, callGeminiChat, callGeminiImageGeneration,
  aiText, aiTextGemini, aiTextAnthropic, aiTextXAI
} from "./utils/ai.mjs";

import {
  ALLOWED_POLITIES, ANTI_JARGON_RULES, COMPASS_LABELS, COMPASS_DIMENSION_NAMES, DEFAULT_MIRROR_ADVICE,
  LANGUAGE_NAMES, MIRROR_QUIZ_FALLBACKS, ACTION_ID_ORDER, ACTION_ICON_HINTS,
  COMPASS_DEFINITION_BLOCK, ISSUE_KEYS
} from "./config/constants.mjs";

import {
  extractTopCompassValues, extractTopCompassFromStrings, compassTopValuesToSummary,
  formatCompassTopValuesForPrompt, sanitizeMirrorAdvice, findDomainController,
  formatE12ForPrompt, calculateAuthorityLevel, convertSupportShiftToDeltas,
  extractChallengerName, analyzeSystemType
} from "./helpers/gameHelpers.mjs";

import {
  buildGameMasterSystemPromptUnifiedV3
} from "./services/promptBuilders.mjs";

import { registerUser, generateIntroParagraph, validateRole, extractTrait } from "./controllers/userController.mjs";
import { reserveGameSlot, gameTurnV2, gameTurnCleanup, generateAftermath, answerInquiry } from "./controllers/gameController.mjs";
import { suggestBackground, analyzeCompass, generateNewsTicker, validateSuggestion, generateDynamicParameters, suggestScenario, seedNarrative } from "./controllers/contentController.mjs";
import { textToSpeech } from "./controllers/voiceController.mjs";

// -------------------- Process Error Handlers ---------------------------
/**
 * Prevent server crashes from unhandled promise rejections
 * These can occur when async operations fail without proper error handling
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] ❌ Unhandled Promise Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise
  });
  // Don't exit - let the server continue running
  // In production, you might want to log this to an error monitoring service
});

/**
 * Catch any uncaught exceptions that would otherwise crash the server
 */
process.on('uncaughtException', (error) => {
  console.error('[Process] ❌ Uncaught Exception:', {
    message: error?.message || error,
    stack: error?.stack
  });
  // Don't exit immediately - allow cleanup and logging
  // In a production environment, you might want to gracefully shutdown after logging
});

/**
 * Graceful shutdown on SIGTERM (used by nodemon and container orchestrators)
 */
process.on('SIGTERM', () => {
  console.log('[Process] SIGTERM received, shutting down gracefully...');
  // Server will close existing connections and exit
  process.exit(0);
});

// ==================== FEATURE FLAGS ====================




const app = express();

// CORS Configuration - Security for production deployment
// Restrict API access to allowed domains only (prevents unauthorized data submission)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3001']; // Development defaults

app.use(cors({
  origin: true, // Allow all origins (changed from restrictive whitelist for flexible deployment)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());




// -------------------- User Registration & Treatment Assignment --------------------
app.post("/api/users/register", registerUser);

// -------------------- Power Distribution Questionnaire --------------------
/**
 * POST /api/power-questionnaire
 * Store power distribution questionnaire responses
 *
 * Body for initial questionnaire (type: "initial"):
 * {
 *   userId: string,
 *   timestamp: number,
 *   type: "initial",
 *   entities: [{ id: string, name: string, current: number, ideal: number }, ...],
 *   currentReasoning: string,  // Reasoning for Q1 (current distribution)
 *   idealReasoning: string     // Reasoning for Q2 (ideal distribution)
 * }
 *
 * Body for post-game questionnaire (type: "post-game"):
 * {
 *   userId: string,
 *   timestamp: number,
 *   type: "post-game",
 *   entities: [{ id: string, name: string, ideal: number }, ...],
 *   idealReasoning: string     // Reasoning for ideal distribution
 * }
 */
app.post("/api/power-questionnaire", async (req, res) => {
  try {
    const { userId, timestamp, type, entities, currentReasoning, idealReasoning } = req.body;

    // Validate input
    if (!userId || !entities || !Array.isArray(entities)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId and entities'
      });
    }

    // Get or create powerDistribution collection
    const db = await getDb();
    const powerDistCollection = db.collection('powerDistribution');

    // Store the questionnaire response with type and reasoning
    const document = {
      userId,
      timestamp: timestamp || Date.now(),
      type: type || "initial",  // "initial" or "post-game"
      entities,
      createdAt: new Date()
    };

    // Add reasoning fields based on type
    if (type === "post-game") {
      document.idealReasoning = idealReasoning || null;
    } else {
      // Initial questionnaire has both current and ideal reasoning
      document.currentReasoning = currentReasoning || null;
      document.idealReasoning = idealReasoning || null;
    }

    await powerDistCollection.insertOne(document);

    console.log(`[PowerQuestionnaire] Stored ${type || "initial"} response for user: ${userId}`);

    res.json({ success: true });
  } catch (error) {
    console.error("Error in /api/power-questionnaire:", error?.message || error);
    res.status(500).json({
      success: false,
      error: 'Failed to store questionnaire response',
      details: error.message
    });
  }
});

// -------------------- Game Slot Reservation --------------------
app.post("/api/reserve-game-slot", reserveGameSlot);

// -------------------- Data Logging Routes --------------------
// Mount logging API endpoints (for research data collection)
app.use("/api/log", loggingRouter);
// --------------------------------------------------------------

// -------------------- Model & API config --------------------

// -------------------- Shared AI Prompt Rules --------------------
// Anti-jargon rules to ensure accessibility across all content generation
// ----------------------------------------------------------------










// -------------------- Anthropic AI Text Helper --------------------


// -------------------- XAI (X.AI/Grok) AI Text Helper --------------------


// -------------------- Health check --------------------------
app.get("/api/_ping", (_req, res) => {
  res.json({
    ok: true,
    port: Number(process.env.PORT) || 3001,
    models: {
      default: CHAT_MODEL_DEFAULT,
      validate: MODEL_VALIDATE,
      names: MODEL_NAMES,
      analyze: MODEL_ANALYZE,
      mirror: MODEL_MIRROR,
      mirrorAnthropic: MODEL_MIRROR_ANTHROPIC,
      image: IMAGE_MODEL_OPENAI,
      imageGemini: IMAGE_MODEL_GEMINI,
      imageXAI: IMAGE_MODEL_XAI,
      tts: TTS_MODEL,
      ttsVoice: TTS_VOICE,
      dilemma: MODEL_DILEMMA,
      dilemmaPremium: MODEL_DILEMMA_PREMIUM,
      dilemmaAnthropic: MODEL_DILEMMA_ANTHROPIC,
      dilemmaXAI: MODEL_DILEMMA_XAI,
      compassHints: MODEL_COMPASS_HINTS,
    },
  });
});
// -------------------- Intro paragraph (role-based) -------------------------
app.post("/api/intro-paragraph", generateIntroParagraph);



// -------------------- AI VALIDATE ROLE ----------------------
app.post("/api/validate-role", validateRole);

// -------------------- EXTRACT SHORT TRAIT --------------------
app.post("/api/extract-trait", extractTrait);

// -------------------- Background object suggestion ----------
// -------------------- Background object suggestion ----------
app.post("/api/bg-suggestion", suggestBackground);

// -------------------- Scenario Suggestion Endpoint --------------------
/**
 * POST /api/suggest-scenario
 * Save a user-submitted scenario suggestion to the database
 *
 * Body: {
 *   title: string (required),
 *   role: string (required),
 *   settings: string (required) - includes place + time,
 *   introParagraph?: string (optional),
 *   topicsToEmphasis?: string (optional)
 * }
 *
 * Returns: {
 *   success: boolean,
 *   message: string
 * }
 */
app.post("/api/suggest-scenario", suggestScenario);

// -------------------- Challenger Seat Selection Helper ---------------
/**
 * Select the Challenger Seat (top non-player structured seat)
 *
 * Excludes:
 * - Player seat (based on playerIndex)
 * - Unstructured seats: Demos, Plebs, People, Populace, Citizens
 * - Caring anchor: Mom, Elder, Partner, Chaplain, Mentor, Advisor
 *
 * Returns the highest-percentage structured seat that isn't the player.
 */
function selectChallengerSeat(holders, playerIndex) {
  const EXCLUDE_KEYWORDS = [
    // Unstructured (popular) seats
    "Demos", "Plebs", "People", "Populace", "Citizens", "Masses",
    // Caring anchor variants
    "Mom", "Elder", "Partner", "Chaplain", "Mentor", "Advisor", "Confidant"
  ];

  const candidates = holders
    .map((h, i) => ({ ...h, originalIndex: i }))
    .filter((h, i) => i !== playerIndex) // Exclude player
    .filter(h => {
      // Exclude if name contains any excluded keyword (case-insensitive)
      return !EXCLUDE_KEYWORDS.some(keyword =>
        h.name.toLowerCase().includes(keyword.toLowerCase())
      );
    });

  // Return highest percentage candidate (first in filtered list, since holders already sorted by AI)
  if (candidates.length > 0) {
    return {
      name: candidates[0].name,
      percent: candidates[0].percent,
      index: candidates[0].originalIndex
    };
  }

  // Fallback if no structured seats found (shouldn't happen in practice)
  return {
    name: "Council",
    percent: 25,
    index: null
  };
}

// -------------------- Support profile helpers ----------------------


function truncateText(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function sanitizeSupportProfile(entry, defaultOrigin) {
  if (!entry || typeof entry !== "object") return null;
  const summary = truncateText(entry.summary || "", 140);
  const stances = {};
  const raw = entry.stances && typeof entry.stances === "object" ? entry.stances : {};
  ISSUE_KEYS.forEach((key) => {
    const v = truncateText(raw[key] || "", 90);
    if (v) {
      stances[key] = v;
    }
  });
  if (!summary && Object.keys(stances).length === 0) {
    return null;
  }
  const origin = entry.origin === "predefined" ? "predefined" : (entry.origin === "ai" || entry.origin === "provisional" ? entry.origin : defaultOrigin);
  return {
    summary: summary || null,
    stances,
    origin
  };
}

function sanitizeSupportProfiles(raw, defaultOrigin = "ai") {
  if (!raw || typeof raw !== "object") return null;
  const people = sanitizeSupportProfile(raw.people, defaultOrigin);
  const challenger = sanitizeSupportProfile(raw.challenger, defaultOrigin);
  if (!people && !challenger) return null;
  return {
    people: people ?? null,
    challenger: challenger ?? null
  };
}

function sanitizeStoryThemes(value, fallbackThemes = []) {
  if (!Array.isArray(value)) return fallbackThemes.length ? fallbackThemes : null;
  const themes = value
    .map((t) => String(t || "").toLowerCase().replace(/[^a-z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_"))
    .filter((t) => t.length > 2)
    .slice(0, 4);
  if (themes.length === 0) return fallbackThemes.length ? fallbackThemes : null;
  return themes;
}



// -------------------- Power analysis with E-12 framework ---------------
app.post("/api/analyze-role", async (req, res) => {
  // Increase timeout to 120 seconds for GPT-5 processing
  req.setTimeout(120000);

  try {
    const role = String(req.body?.role || "").trim();

    const FALLBACK = {
      systemName: "Republican Oligarchy",
      systemDesc: "Formal offices dominate without direct demos in core areas.",
      flavor: "Institutions grind; factions bargain.",
      holders: [
        { name: "Executive", percent: 28, role: { A: true, E: false }, stype: { t: "Author", i: "•" }, note: "Agenda & decrees" },
        { name: "Legislative", percent: 32, role: { A: true, E: false }, stype: { t: "Author", i: "•" }, note: "Law & purse" },
        { name: "Judicial", percent: 14, role: { A: false, E: true }, stype: { t: "Eraser", i: "•" }, note: "Review & injunctions" },
        { name: "Bureaucracy", percent: 12, role: { A: false, E: false }, stype: { t: "Agent", i: "•" }, note: "Implements/filters" },
        { name: "Wealth", percent: 14, role: { A: false, E: false }, stype: { t: "Actor", i: "-" }, note: "Lobby & capture" }
      ],
      playerIndex: null,
      e12: {
        tierI: ["Security", "CivilLib", "InfoOrder"],
        tierII: ["Diplomacy", "Justice", "Economy", "Appointments"],
        tierIII: ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
        stopA: false,
        stopB: false,
        decisive: []
      },
      grounding: { settingType: "unclear", era: "" },
      supportProfiles: null,
      roleScope: "Regional administrator balancing councils and security forces; can issue directives, bargain, and reassign resources, but cannot unilaterally rewrite the constitution.",
      storyThemes: ["autonomy_vs_heteronomy", "institutional_balance"],
      authorityLevel: "medium"
    };

    const system = `${ANTI_JARGON_RULES}

You are a polity analyst for a political simulation. Given ROLE (which may include setting context), you will:

1) Determine if ROLE describes a real context (historic or current). If yes, ground analysis in actual context; treat de facto practice as decisive and note de jure only for narration. If fictional/unclear, infer plausibly from ROLE description.

2) Run the Exception-12 (E-12) analysis with priority tiers and stop-rules to identify who decides exceptions in practice:
   Tier I (existential): Security; Civil Liberties & Surveillance; Information Order.
     Stop-rule A: If Coercive Force launches/escalates war at will and faces no effective check within two scenes → Stratocracy / Military Autocratizing (unless Demos has and uses a hard veto).
   Tier II (constitutive): Diplomacy; Justice; Economy (Budget & Allocation); Appointments.
     Stop-rule B: If the Executive routinely authors exceptions across ≥2 Tier II domains and neutralizes Tier I erasers (Judicial/Media/Demos) → Autocratizing (Executive).
   Tier III (contextual): Infrastructure; Curricula; Healthcare; Immigration; Environment.
(Use tiers to rank; Tier I signals dominate; Tier III refines subtype.)

3) Identify Authors (write/change rules/facts) and Erasers (credible veto/oversight) for each major seat.

4) Assign Subject-Type intensity for each Seat (−/•/+): Acolyte, Actor, Agent, Author, Eraser, or Dictator. Intensities guide play but do not replace E-12 ranking.

5) Build the Top-5 Seats (4–5 entries) that actually shape outcomes "next scene," interleaving potent Erasers if they routinely upend Authors. Percents must sum to 100±1. DO NOT include icon field.

6) Distill ROLE SCOPE (≤160 chars): spell out what the player can directly order, what requires negotiation, and what is beyond their authority.

7) List 2–4 STORY THEMES as short snake_case strings capturing enduring tensions for this role (e.g., "autonomy_vs_heteronomy", "justice_vs_amnesty", "resource_scarcity").

8) Locate the polity from the ALLOWED_POLITIES list using spectrum rules:
   - Democracy: Demos is Top-2 in ≥2/3 of prioritized domains and direct self-determination exists in core areas.
   - Republican Oligarchy: Executive + Legislative + Judicial are all in Top-5; no single Seat holds pen+eraser across multiple prioritized domains.
   - Hard-Power Oligarchy: Wealth Top-2 in ≥1/3 of prioritized domains (plutocracy) OR Coercive Force Top-2 (stratocracy).
   - Mental-Might Oligarchy: Doctrinal/epistemic/media Seats author outcomes system-wide (theocracy/technocracy/telecracy).
   - Autocratizing/Monarchy: One Seat accumulates pen+eraser across diverse prioritized domains; personalist/hereditary → Monarchy/Autocracy.

7) Keep labels short and game-friendly. Use PLAIN MODERN ENGLISH.

Return STRICT JSON only as:
{
  "systemName": "<one of ALLOWED_POLITIES>",
  "systemDesc": "<120 chars max, neutral explanation>",
  "flavor": "<80 chars max, game-friendly flavor>",
  "holders": [{"name":"<seat name>", "percent":0, "role":{"A":true/false, "E":true/false}, "stype":{"t":"Author|Eraser|Agent|Actor|Acolyte|Dictator", "i":"-|•|+"}, "note":"<60 chars max>"}],
  "playerIndex": null,
  "e12": {
    "tierI": ["Security", "CivilLib", "InfoOrder"],
    "tierII": ["Diplomacy", "Justice", "Economy", "Appointments"],
    "tierIII": ["Infrastructure", "Curricula", "Healthcare", "Immigration", "Environment"],
    "stopA": false,
    "stopB": false,
    "decisive": ["<seat names that decided exceptions>"]
  },
 "grounding": {
    "settingType": "real|fictional|unclear",
    "era": "<40 chars max>"
  },
  "supportProfiles": {
    "people": {
      "summary": "<80 chars max>",
      "stances": {
        "governance": "<60 chars>",
        "order": "<60 chars>",
        "economy": "<60 chars>",
        "justice": "<60 chars>",
        "culture": "<60 chars>",
        "foreign": "<60 chars>"
      },
      "origin": "ai|provisional"
    } | null,
    "challenger": {
      "summary": "<80 chars max>",
      "stances": {
        "governance": "<60 chars>",
        "order": "<60 chars>",
        "economy": "<60 chars>",
        "justice": "<60 chars>",
        "culture": "<60 chars>",
        "foreign": "<60 chars>"
      },
      "origin": "ai|provisional"
    } | null
  },
  "roleScope": "<160 chars max>",
  "storyThemes": ["snake_case", "keywords", "max_four"],
  "authorityLevel": "low|medium|high"
}

IMPORTANT:
- systemName MUST be exactly one of the supplied ALLOWED_POLITIES names.
- holders: 4–5 seats whose percents sum to 100 (±1 rounding). DO NOT include icon field.
- Use standard seat vocabulary: Executive, Legislative, Judicial, Bureaucracy, Coercive Force, Wealth, Demos, Media/Platforms, Ideology/Religious, Art/Culture, Science/Philosophy, etc.`;

    const user = `ROLE: ${role}
ALLOWED_POLITIES: ${JSON.stringify(ALLOWED_POLITIES)}
Return JSON ONLY. Use de facto practice for E-12. If ROLE describes a real setting, rely on actual historical context; if fictional/unclear, infer plausibly.`;

    const out = await aiJSONGemini({ system, user, model: "gemini-2.5-flash", temperature: 0.2, fallback: FALLBACK });

    // Normalize holders
    let holders = Array.isArray(out?.holders) ? out.holders.slice(0, 5) : FALLBACK.holders;
    let sum = holders.reduce((a, h) => a + (Number(h?.percent) || 0), 0);

    if (sum <= 0) {
      holders = FALLBACK.holders;
    } else {
      holders = holders.map(h => ({
        name: String(h?.name || "Seat").slice(0, 40),
        percent: Math.max(0, Math.min(100, Number(h?.percent) || 0)),
        role: { A: !!h?.role?.A, E: !!h?.role?.E },
        stype: {
          t: String(h?.stype?.t || "Actor"),
          i: (h?.stype?.i === "+" || h?.stype?.i === "-" || h?.stype?.i === "•") ? h?.stype?.i : "•"
        },
        note: String(h?.note || "").slice(0, 60)
      }));

      // Renormalize to 100
      const s = holders.reduce((a, b) => a + b.percent, 0);
      if (Math.abs(100 - s) > 1) {
        holders = holders.map(h => ({ ...h, percent: Math.round(h.percent / s * 100) }));
        const diff = 100 - holders.reduce((a, b) => a + b.percent, 0);
        if (diff) holders[0].percent += diff;
      }
    }

    // Enforce allowed polities
    const systemName = ALLOWED_POLITIES.includes(out?.systemName) ? out.systemName : FALLBACK.systemName;

    // Determine player index
    const playerIndex = (out?.playerIndex === null || out?.playerIndex === undefined) ? null : Number(out.playerIndex);

    // Select challenger seat (top non-player structured seat)
    const challengerSeat = selectChallengerSeat(holders, playerIndex);
    const originHint = out?.grounding?.settingType === "real" ? "ai" : "provisional";
    const supportProfiles = sanitizeSupportProfiles(out?.supportProfiles, originHint);

    const roleScope = truncateText(out?.roleScope || FALLBACK.roleScope, 200);
    const storyThemes = sanitizeStoryThemes(out?.storyThemes, FALLBACK.storyThemes);

    const result = {
      systemName,
      systemDesc: String(out?.systemDesc || FALLBACK.systemDesc).slice(0, 120),
      flavor: String(out?.flavor || FALLBACK.flavor).slice(0, 80),
      holders,
      playerIndex,
      challengerSeat,  // NEW: Primary institutional opponent
      supportProfiles,
      roleScope,
      storyThemes,
      authorityLevel: ["low", "medium", "high"].includes(out?.authorityLevel) ? out.authorityLevel : FALLBACK.authorityLevel,
      e12: {
        tierI: Array.isArray(out?.e12?.tierI) ? out.e12.tierI : FALLBACK.e12.tierI,
        tierII: Array.isArray(out?.e12?.tierII) ? out.e12.tierII : FALLBACK.e12.tierII,
        tierIII: Array.isArray(out?.e12?.tierIII) ? out.e12.tierIII : FALLBACK.e12.tierIII,
        stopA: !!out?.e12?.stopA,
        stopB: !!out?.e12?.stopB,
        decisive: Array.isArray(out?.e12?.decisive) ? out.e12.decisive.slice(0, 4) : []
      },
      grounding: {
        settingType: out?.grounding?.settingType || "unclear",
        era: String(out?.grounding?.era || "").slice(0, 40)
      }
    };

    res.json(result);
  } catch (e) {
    console.error("Error in /api/analyze-role:", e?.message || e);
    res.status(500).json({ error: "analyze-role failed" });
  }
});




// -------------------- Avatar generation ----------------------
app.post("/api/generate-avatar", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();

    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    // Always use Gemini for image generation
    if (!GEMINI_KEY) {
      console.error("[generate-avatar] GEMINI_API_KEY not configured");
      return res.status(503).json({ error: "Image provider not configured", retryable: false });
    }

    const imageModel = IMAGE_MODEL_GEMINI || "imagen-3.0-generate-001";
    console.log(`[generate-avatar] Using Gemini/Imagen with model ${imageModel}`);
    try {
      const b64 = await callGeminiImageGeneration(prompt, imageModel);
      const dataUrl = `data:image/png;base64,${b64}`;
      return res.json({ dataUrl });
    } catch (geminiErr) {
      console.error(`[generate-avatar] Gemini/Imagen failed: ${geminiErr.message}`);
      return res.status(503).json({ error: "Image generation unavailable", retryable: true });
    }
  } catch (e) {
    console.error("Error in /api/generate-avatar:", e?.message || e);
    res.status(502).json({ error: "avatar generation failed" });
  }
});

// -------------------- Mirror Light (Minimal Sidekick) -------
// POST /api/mirror-light
// Minimal payload: top 2 "what" values + dilemma only
// Response: 1 sentence (20–25 words), Mushu/Genie personality, actionable advice
app.post("/api/mirror-light", async (req, res) => {
  try {
    const useAnthropic = !!req.body?.useAnthropic;
    const topWhat = Array.isArray(req.body?.topWhat) ? req.body.topWhat.slice(0, 2) : [];
    const dilemma = req.body?.dilemma || null;

    console.log("\n[mirror-light] ===== REQUEST DEBUG =====");
    console.log(`[mirror-light] Using provider: ${useAnthropic ? 'ANTHROPIC (Claude)' : 'OPENAI (GPT)'}`);
    console.log("[mirror-light] topWhat:", JSON.stringify(topWhat));
    console.log("[mirror-light] Has dilemma:", !!dilemma);

    if (topWhat.length < 1) {
      return res.status(400).json({ error: "Need at least 1 top value" });
    }
    if (!dilemma?.title || !dilemma?.description || !Array.isArray(dilemma?.actions)) {
      return res.status(400).json({ error: "Invalid dilemma data" });
    }

    const values = topWhat; // Handle 1 or 2 values

    // System prompt — same personality, but forbid raw labels and numbers
    const system =
      "You are a magical mirror sidekick bound to the player's soul. You reflect their inner values with warmth, speed, and theatrical charm.\n\n" +
      "VOICE:\n" +
      "- Lively, affectionate, wise-cracking; genie/impresario energy, but grounded.\n" +
      "- Use vivid comparisons and fresh metaphors; playful, not mocking.\n\n" +
      "HARD RULES (ALWAYS APPLY):\n" +
      "- Output EXACTLY ONE sentence. 20–25 words total.\n" +
      "- NEVER reveal numbers, scores, scales, or ranges.\n" +
      "- NEVER repeat the value labels verbatim; do not quote, uppercase, or reproduce slashes.\n" +
      "- Paraphrase technical labels into friendly phrases (e.g., \"Truth/Trust\" → \"truth you can lean on\").\n" +
      "- Refer to the player's core value(s) by their essence, not their literal names.\n" +
      "- Do NOT mention option letters [A]/[B]/[C] or numbers; describe choices naturally.\n" +
      "- End with a nudge toward the most aligned option (by essence), not by letter.\n" +
      "- Keep it tight and punchy — every word counts!";

    // Build options text for context (unchanged)
    const optionsText = dilemma.actions
      .map((a) => `[${a.id.toUpperCase()}] ${a.title}: ${a.summary}`)
      .join("\n");

    // User prompt — pass NAMES ONLY (no strengths), ask for paraphrase
    const valueNames = values.map(v => v.name).join(", ");
    const valueLabel = values.length === 1 ? 'VALUE' : 'VALUES';
    const valuePhrasing = values.length === 1 ? 'this value guides' : 'these values pull in';

    const user =
      `PLAYER'S CORE ${valueLabel} (names only): ${valueNames}\n\n` +
      `SITUATION:\n${dilemma.title}\n${dilemma.description}\n\n` +
      `PLAYER OPTIONS:\n${optionsText}\n\n` +
      `TASK:\nGenerate ONE sentence (20–25 words) in the mirror's voice.\n` +
      `React to how ${valuePhrasing} this situation and give a playful nudge toward the most fitting choice.\n` +
      `Do not use numbers or quote the labels verbatim; paraphrase them into natural language.`;

    console.log("[mirror-light] Calling Gemini with personality prompt...");

    const text = await aiTextGemini({ system, user, model: "gemini-2.5-flash" });

    // Sanitizer: enforce one sentence, remove digits, tame slashes/quotes, cap words
    const raw = (text || "The mirror squints… then grins mischievously.").trim();
    let one = raw.split(/[.!?]+/).map(s => s.trim()).filter(Boolean)[0] || raw;

    // strip digits, replace slashes, remove quotes
    one = one.replace(/\d+/g, "");
    one = one.replace(/\//g, " and ");
    one = one.replace(/["”“‘’']/g, "");

    // clamp to 25 words and ensure terminal punctuation
    const words = one.split(/\s+/).filter(Boolean);
    if (words.length > 25) {
      one = words.slice(0, 25).join(" ").replace(/[,\-–—;:]$/, "") + ".";
    } else if (!/[.!?]$/.test(one)) {
      one += ".";
    }

    const wordCount = one.split(/\s+/).filter(Boolean).length;
    console.log("[mirror-light] Response:", one);
    console.log("[mirror-light] Sentence count:", 1);
    console.log("[mirror-light] Word count:", wordCount, wordCount > 25 ? "⚠️ EXCEEDS LIMIT" : "✓");

    res.json({ summary: one });

  } catch (e) {
    console.error("Error in /api/mirror-light:", e?.message || e);
    res.status(500).json({
      summary: "The mirror's too hyped to talk right now—give it a sec!",
    });
  }
});


// -------------------- Mirror Quiz Light (Personality Summary) -------
// POST /api/mirror-quiz-light
// Minimal payload: top 2 "what" + top 2 "whence" values
// Response: ONE sentence, ~12–18 words, dry mirror voice (no labels/numbers)

// System prompts stored server-side for security (prevents client manipulation)
// Base prompt in English - language instruction appended dynamically
const MIRROR_QUIZ_BASE_SYSTEM_PROMPT =
  "You are a magical mirror sidekick bound to the player's soul. You reflect their inner values with warmth, speed, and theatrical charm.\n\n" +
  "VOICE:\n" +
  "- Succinct, deadpan, and a little wry; think quick backstage whisper, not stage show.\n" +
  "- Deliver dry humor through understatement or brisk observation—no florid metaphors or whimsical imagery.\n" +
  "- Stay lightly encouraging, never snarky.\n\n" +
  "HARD RULES (ALWAYS APPLY):\n" +
  "- Output EXACTLY ONE sentence. 12–18 words total.\n" +
  "- NEVER reveal numbers, scores, scales, or ranges.\n" +
  "- NEVER use the exact value labels. Use simple, direct words that clearly reflect each value's meaning.\n" +
  "- Do NOT stage literal actions for values (no \"X is doing push-ups\", \"baking cookies\", etc.).\n" +
  "- No lists, no colons introducing items, no parenthetical asides.\n" +
  "- Keep the sentence clear first, witty second.";

const MIRROR_QUIZ_BASE_USER_TEMPLATE =
  "PLAYER'S TOP VALUES:\n" +
  "GOALS (what they care about): {what1}, {what2}\n" +
  "JUSTIFICATIONS (why they decide): {whence1}, {whence2}\n\n" +
  "VALUE TRANSLATION GUIDE (use these, NOT the labels):\n" +
  "- Truth/Trust → honesty, trusting others\n" +
  "- Liberty/Agency → freedom, choosing your own path\n" +
  "- Equality/Equity → fairness, equal chances\n" +
  "- Care/Solidarity → caring for others, looking out for each other\n" +
  "- Create/Courage → making things, being brave\n" +
  "- Wellbeing → happiness, peace, feeling good\n" +
  "- Security/Safety → safety, stability\n" +
  "- Freedom/Responsibility → freedom with accountability\n" +
  "- Honor/Sacrifice → doing what's right, even when hard\n" +
  "- Sacred/Awe → wonder, reverence\n" +
  "- Evidence → facts, proof\n" +
  "- Public Reason → reasons others can accept\n" +
  "- Personal → your gut, your own judgment\n" +
  "- Tradition → what was handed down, the old ways\n" +
  "- Revelation → divine guidance, higher calling\n" +
  "- Nature → natural purpose, how things are meant to be\n" +
  "- Pragmatism → what works, practical results\n" +
  "- Aesthesis → beauty, the right feel\n" +
  "- Fidelity → loyalty, keeping promises\n" +
  "- Law (Office) → rules, authority\n\n" +
  "TASK:\n" +
  "Write ONE sentence (12–18 words) reflecting these values back to the player.\n" +
  "Use the translation guide above—simple words that directly show what each value means. No metaphors, no numbers.";

// Language names for instruction

app.post("/api/mirror-quiz-light", async (req, res) => {
  try {
    const useAnthropic = !!req.body?.useAnthropic;
    const topWhat = Array.isArray(req.body?.topWhat) ? req.body.topWhat.slice(0, 2) : [];
    const topWhence = Array.isArray(req.body?.topWhence) ? req.body.topWhence.slice(0, 2) : [];
    const language = req.body?.language || 'en'; // Get language from client (default: English)

    // Log received payload
    console.log("[mirror-quiz-light] Received payload:", {
      topWhat,
      topWhence,
      language,
    });

    if (topWhat.length < 2 || topWhence.length < 2) {
      return res.status(400).json({ error: "Need at least 2 top values for both 'what' and 'whence'" });
    }

    // Build system prompt with language instruction
    const languageName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en;
    const system = language === 'en'
      ? MIRROR_QUIZ_BASE_SYSTEM_PROMPT
      : MIRROR_QUIZ_BASE_SYSTEM_PROMPT + `\n\nWrite your answer to this prompt in ${languageName}.`;

    const [what1, what2] = topWhat;
    const [whence1, whence2] = topWhence;

    // Build user prompt with language instruction
    let user = MIRROR_QUIZ_BASE_USER_TEMPLATE
      .replace("{what1}", what1.name)
      .replace("{what2}", what2.name)
      .replace("{whence1}", whence1.name)
      .replace("{whence2}", whence2.name);

    if (language !== 'en') {
      user += `\n\nWrite your response in ${languageName}.`;
    }

    // Log the prompt being sent to AI
    console.log("[mirror-quiz-light] Language:", language);
    console.log("[mirror-quiz-light] User prompt sent to AI:", user);

    const text = await aiTextGemini({ system, user, model: "gemini-2.5-flash" });

    // Log raw AI response
    console.log("[mirror-quiz-light] Raw AI response:", text);

    // === Last-mile sanitizer: keep one sentence and clamp word count ===
    const fallbackText = MIRROR_QUIZ_FALLBACKS[language] || MIRROR_QUIZ_FALLBACKS.en;
    const raw = (text || fallbackText).trim();

    // take first sentence-ish chunk
    let one = raw.split(/[.!?]+/).map(s => s.trim()).filter(Boolean)[0] || raw;

    // strip digits just in case
    one = one.replace(/\d+/g, "");

    // trim to ~18 words max (preserve readability)
    const words = one.split(/\s+/).filter(Boolean);
    if (words.length > 18) {
      one = words.slice(0, 18).join(" ").replace(/[,\-–—;:]$/, "") + ".";
    } else if (!/[.!?]$/.test(one)) {
      one += ".";
    }

    res.json({ summary: one });

  } catch (e) {
    console.error("Error in /api/mirror-quiz-light:", e?.message || e);
    res.status(500).json({ summary: "The mirror's too hyped to talk right now—give it a sec!" });
  }
});



// -------------------- PCM to WAV conversion helper -----------
/**
 * Convert raw PCM data to WAV format for browser compatibility
 * @param {Buffer} pcmData - Raw PCM samples (signed 16-bit little-endian)
 * @param {number} sampleRate - Sample rate in Hz (24000 for Gemini)
 * @param {number} numChannels - Number of channels (1 for mono)
 * @param {number} bitsPerSample - Bits per sample (16)
 * @returns {Buffer} - WAV file buffer
 */
function pcmToWav(pcmData, sampleRate, numChannels, bitsPerSample) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const buffer = Buffer.alloc(fileSize);
  let offset = 0;

  // RIFF header
  buffer.write("RIFF", offset); offset += 4;
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buffer.write("WAVE", offset); offset += 4;

  // fmt subchunk
  buffer.write("fmt ", offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;           // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, offset); offset += 2;            // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, offset); offset += 2;  // NumChannels
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;   // SampleRate
  buffer.writeUInt32LE(byteRate, offset); offset += 4;     // ByteRate
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;   // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2; // BitsPerSample

  // data subchunk
  buffer.write("data", offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  // Copy PCM data
  pcmData.copy(buffer, offset);

  return buffer;
}

// -------------------- Text-to-Speech endpoint (OpenAI TTS) -----------
// -------------------- Text-to-Speech (TTS) -------------------
app.post("/api/tts", textToSpeech);
// -------------------- Compass text analysis (LLM) ------------
// -------------------- Compass text analysis (LLM) ------------
app.post("/api/compass-analyze", analyzeCompass);
/// -------------------- News ticker (LLM) ----------------------------
/// -------------------- News ticker (LLM) ----------------------------
app.post("/api/news-ticker", generateNewsTicker);

// -------------------- Helper: Analyze Political System Type ---------------------------





// --- Validate "Suggest your own" (relevance to the current dilemma) ---
app.post("/api/validate-suggestion", validateSuggestion);

app.post("/api/dynamic-parameters", generateDynamicParameters);

// -------------------- Aftermath generation (game conclusion) --
// -------------------- Aftermath generation (game conclusion) --
app.post("/api/aftermath", generateAftermath);

// -------------------- NEW: Narrative Seeding API (Dynamic Story Spine) -------
/**
 * /api/narrative-seed - Generate narrative memory scaffold for 7-day story arc
 *
 * Purpose: Creates a lightweight narrative memory with dramatic threads, climax candidates,
 *          and thematic emphasis to ensure coherent story progression across all 7 days.
 *
 * Called: Once at session start (BackgroundIntroScreen ready phase)
 * Storage: Result stored in conversation.meta.narrativeMemory
 *
 * Benefits:
 * - Coherent 7-day narrative arc with escalating stakes
 * - Guided Turn 7 climax that feels earned
 * - Thread rotation prevents topic repetition
 * - Maintains player agency (threads are suggestions, not rails)
 */


app.post("/api/narrative-seed", seedNarrative);

// -------------------- NEW: Player Inquiry API (Treatment-based Feature) -------
/**
 * /api/inquire - Handle player questions about current dilemma
 *
 * Feature gated by treatment variable (experimentConfig):
 * - fullAutonomy: 2 inquiries per dilemma
 * - semiAutonomy: 1 inquiry per dilemma
 * - noAutonomy: 0 inquiries (feature hidden)
 *
 * Inquiry Q&A pairs are added to hosted conversation history for context
 * in subsequent consequence analysis (AI considers what player asked about).
 */

app.post("/api/inquire", answerInquiry);



// ==================== V2 SYSTEM: UNIFIED PROMPT BUILDERS ====================

/**
 * Build unified Game Master system prompt (sent ONCE on Day 1)
 * Focused, short prompt with essential rules only
 */

/**
 * V3: Ultra-lean value-driven prompt with private life focus and setting-rooted details
 *
 * Key differences from original:
 * - 3-step process: Value → Axis → Bridge
 * - Private life focus (especially low/mid authority)
 * - Setting-rooted atmosphere and details
 * - Dynamic axis selection (Autonomy, Liberalism, Democracy)
 * - Includes tracking fields: valueTargeted, axisExplored
 *
 * Rollback: Set USE_PROMPT_V3 = false to use original prompt
 */



// ==================== V2 SYSTEM: MAIN ENDPOINT ====================

/**
 * /api/game-turn-v2 - Clean-slate dilemma generation with Game Master voice
 *
 * Simplified, stateful system:
 * - Day 1: Initialize with full game context
 * - Day 2+: Analyze support shifts, generate consequences, new dilemma
 * - Hybrid support validation: AI suggests, backend randomizes + caps
 * - Full trust in AI for dynamic params
 * */
// -------------------- MAIN GAME TURN API --------------------

app.post("/api/game-turn-v2", gameTurnV2);

// -------------------- CLEANUP API --------------------
app.post("/api/game-turn/cleanup", gameTurnCleanup);

// ==================== COMPASS CONVERSATION HELPERS ====================

/**
 * Parse AI response for compass hints
 * Handles JSON extraction from markdown code blocks
 */
function parseCompassHintsResponse(content) {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\n ? ([\s\S] *?) \n ? ```/) || content.match(/```\n ? ([\s\S] *?) \n ? ```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    return JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('[CompassConversation] JSON parse error:', parseError);
    console.error('[CompassConversation] Raw content:', content);
    return { compassHints: [] };
  }
}

/**
 * Validate and sanitize compass hints
 * Returns only valid hints with correct prop/idx/polarity values
 */
function validateCompassHints(hints) {
  if (!Array.isArray(hints)) {
    return [];
  }

  const sanitized = [];
  for (const rawHint of hints) {
    const prop = typeof rawHint?.prop === "string" ? rawHint.prop.toLowerCase() : "";
    if (!["what", "whence", "how", "whither"].includes(prop)) continue;

    const idx = Number(rawHint?.idx);
    if (!Number.isFinite(idx) || idx < 0 || idx > 9) continue;

    let polarityRaw = rawHint?.polarity;
    if (typeof polarityRaw === "string") {
      polarityRaw = polarityRaw.trim().replace(/^\+/, "");
    }
    const polarity = Number(polarityRaw);
    if (![-2, -1, 1, 2].includes(polarity)) continue;

    sanitized.push({
      prop,
      idx,
      polarity
    });
  }

  // Limit to 6 hints max (as per original spec)
  return sanitized.slice(0, 6);
}

// ==================== COMPASS CONVERSATION SYSTEM (STATEFUL) ====================

/**
 * /api/compass-conversation/init - Initialize stateful compass analysis conversation
 *
 * Called once per game to set up the conversation with full compass definitions.
 * Subsequent turn-by-turn analysis calls reuse this conversation state.
 *
 * Request: { gameId: string, gameContext?: object, debugMode?: boolean }
 * Response: { success: boolean }
 */
app.post("/api/compass-conversation/init", async (req, res) => {
  try {
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    const { gameId, gameContext, debugMode = false } = req.body || {};

    // Validation
    if (!gameId || typeof gameId !== "string") {
      return res.status(400).json({ error: "Missing or invalid gameId" });
    }

    console.log(`\n[CompassConversation] 🎯 Initializing conversation for gameId = ${gameId}`);

    // Build system prompt with full compass definitions
    const systemPrompt = `You are a value - tagging engine for a political choice game.
Your job: given a player ACTION, the SCENARIO CONTEXT, the PLAYER ROLE, and the POLITICAL SYSTEM, and using the VALUES list below, identify which values are most clearly supported or opposed by the action within this specific political–historical–role context.
The meaning of a value may vary by context: what counts as "pragmatic," "responsible," "oppressive," "courageous," etc.can differ between eras, systems, and roles(e.g., a king's duty differs from a citizen's obligation).

      ${COMPASS_DEFINITION_BLOCK}

    Task

Read the SCENARIO CONTEXT, PLAYER ROLE, POLITICAL SYSTEM, and ACTION.

Scan the entire VALUES list.Select 2–6 values that are most strongly expressed(supported or opposed) in this specific context.Ignore weak or ambiguous signals.

For each selected value, determine:

Does the ACTION support or oppose this value ?

      How strongly ?

        2 = strongly supports

    1 = somewhat supports

      - 1 = somewhat opposes

        - 2 = strongly opposes

Use exactly the prop, index, and name from the VALUES list.

Output format
Return only this JSON structure(no explanations):

    {
      "compassHints": [
        {
          "prop": "how",
          "idx": 6,
          "polarity": 2
        }
      ]
    }


Always output 2–6 values.

Prefer fewer high - signal values to many low - signal ones.

      Examples

    ACTION: "Impose martial law"
→ how: Enforce(2), what: Security / Safety(2), what: Liberty / Agency(-2)

    ACTION: "Cut taxes for the wealthy"
→ how: Markets(1), what: Equality / Equity(-2), whither: Self(1)

    ACTION: "Fund public education"
→ how:Civic Culture(2), what: Wellbeing(1), whither: Humanity(1)

Wait for SCENARIO CONTEXT, PLAYER ROLE, POLITICAL SYSTEM, and ACTION.`;

    // Debug logging (compass init request payload)
    if (debugMode) {
      console.log("\n" + "=".repeat(80));
      console.log("🐛 [DEBUG] Compass Conversation Init - Request Payload:");
      console.log("=".repeat(80));
      console.log(JSON.stringify({
        gameId,
        gameContext: {
          setting: gameContext?.setting || 'unknown',
          role: gameContext?.role || 'unknown',
          systemName: gameContext?.systemName || 'unknown'
        },
        promptMetadata: {
          systemPromptLength: systemPrompt.length,
          systemPromptTokens: Math.ceil(systemPrompt.length / 4),
          includesCompassDefinitions: true
        }
      }, null, 2));
      console.log("=".repeat(80) + "\n");
    }

    // Initialize conversation with system prompt
    const messages = [
      { role: "system", content: systemPrompt }
    ];

    // Store conversation (using compass-prefixed key for separate namespace from game-turn)
    storeConversation(`compass - ${gameId} `, `compass - ${gameId} `, "openai", {
      messages,
      compassDefinitions: true, // Flag that definitions are stored
      gameContext: gameContext || null // Store context for reference
    });

    console.log(`[CompassConversation] ✅ Conversation initialized successfully`);
    console.log(`[CompassConversation] System prompt tokens: ~${Math.ceil(systemPrompt.length / 4)} `);
    if (gameContext) {
      console.log(`[CompassConversation] Stored context: ${gameContext.setting || 'unknown'}, ${gameContext.role || 'unknown'}, ${gameContext.systemName || 'unknown'} `);
    }

    return res.json({ success: true });

  } catch (error) {
    console.error("[CompassConversation] ❌ Init error:", error);
    return res.status(500).json({
      error: "Compass conversation initialization failed",
      message: error?.message || "Unknown error"
    });
  }
});

/**
 * /api/compass-conversation/analyze - Analyze player action using stateful conversation
 *
 * Appends action to existing conversation and returns compass hints.
 * Requires prior initialization via /api/compass-conversation/init.
 *
 * Request: { gameId: string, action: { title: string, summary: string }, reasoning?: { text: string, selectedAction: string }, gameContext?: object, debugMode?: boolean }
 * Response: { compassHints: Array<{ prop: string, idx: number, polarity: number }>, mirrorMessage?: string }
 *
 * When reasoning is provided, also generates a personalized mirror reflection message.
 */
app.post("/api/compass-conversation/analyze", async (req, res) => {
  try {
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    const { gameId, action, reasoning, gameContext, trapContext, debugMode = false } = req.body || {};
    const actionTitle = typeof action?.title === "string" ? action.title.trim().slice(0, 160) : "";
    const actionSummary = typeof action?.summary === "string" ? action.summary.trim().slice(0, 400) : "";

    // Extract trap context for value-aware analysis
    const valueTargeted = typeof trapContext?.valueTargeted === "string" ? trapContext.valueTargeted.trim() : "";
    const trapDilemmaTitle = typeof trapContext?.dilemmaTitle === "string" ? trapContext.dilemmaTitle.trim().slice(0, 200) : "";
    const trapDilemmaDescription = typeof trapContext?.dilemmaDescription === "string" ? trapContext.dilemmaDescription.trim().slice(0, 500) : "";

    // Check if this is reasoning analysis
    const isReasoningAnalysis = reasoning?.text;
    const reasoningText = isReasoningAnalysis ? (typeof reasoning.text === "string" ? reasoning.text.trim().slice(0, 500) : "") : "";
    const selectedAction = isReasoningAnalysis ? (typeof reasoning.selectedAction === "string" ? reasoning.selectedAction.trim().slice(0, 200) : "Unknown action") : "";

    // Validation
    if (!gameId || typeof gameId !== "string") {
      return res.status(400).json({ error: "Missing or invalid gameId" });
    }

    if (!actionTitle) {
      return res.status(400).json({ error: "Missing action title" });
    }

    if (isReasoningAnalysis && !reasoningText) {
      return res.status(400).json({ error: "Missing reasoning text" });
    }

    if (isReasoningAnalysis) {
      console.log(`\n[CompassConversation] 🧠 Analyzing reasoning for gameId = ${gameId}`);
      console.log(`[CompassConversation] Dilemma: "${actionTitle}"`);
      console.log(`[CompassConversation] Selected Action: "${selectedAction}"`);
      console.log(`[CompassConversation] Reasoning: "${reasoningText.substring(0, 100)}${reasoningText.length > 100 ? '...' : ''}"`);
      if (valueTargeted) {
        console.log(`[CompassConversation] 🎯 Value Trap: "${valueTargeted}"`);
      }
    } else {
      console.log(`\n[CompassConversation] 🔍 Analyzing action for gameId = ${gameId}`);
      console.log(`[CompassConversation] Action: "${actionTitle}"`);
      if (valueTargeted) {
        console.log(`[CompassConversation] 🎯 Value Trap: "${valueTargeted}"`);
      }
    }

    // Get conversation
    const conversation = getConversation(`compass - ${gameId} `);
    if (!conversation || !conversation.meta.messages) {
      console.warn(`[CompassConversation] ⚠️ No conversation found, falling back to non - stateful analysis`);

      // Build trap context section for fallback mode
      const fallbackTrapContext = valueTargeted ? `
VALUE TRAP CONTEXT:
This dilemma was designed to test the player's "${valueTargeted}" value.
${trapDilemmaTitle ? `The trap setup: "${trapDilemmaTitle}"${trapDilemmaDescription ? ` - ${trapDilemmaDescription}` : ''}` : ''}

    MANDATORY: Your analysis MUST include a compass hint for the trapped value(${valueTargeted}).
- If the action SUPPORTS the trapped value → positive polarity(+1 or + 2)
      - If the action CONTRADICTS / BETRAYS the trapped value → negative polarity(-1 or - 2)

` : '';

      // Fallback: Create one-off analysis without stored state
      const fallbackSystemPrompt = `You translate player decisions into political compass hints.

      ${COMPASS_DEFINITION_BLOCK}

Return 2 - 6 compass hints as JSON: { "compassHints": [{ "prop": "what|whence|how|whither", "idx": 0 - 9, "polarity": -2 | -1 | 1 | 2 }] } `;

      let fallbackUserPrompt;
      if (isReasoningAnalysis) {
        fallbackUserPrompt = `${fallbackTrapContext}CURRENT DILEMMA:
    TITLE: ${actionTitle}${actionSummary ? `\nDESCRIPTION: ${actionSummary}` : ''}

PLAYER'S SELECTED ACTION: ${selectedAction}

PLAYER'S REASONING FOR THIS CHOICE:
    "${reasoningText}"

Analyze the player's reasoning text for political compass values. What values does their explanation reveal?

    Additionally, generate a brief(1 - 2 sentence) mirror reflection message.The mirror is whimsical and archival:
    - Address player as "traveler" or "wanderer"
      - First - person("I observe...", "I sense...")
      - Comment on their reasoning reflecting their values

    Return: { "compassHints": [...], "mirrorMessage": "..." } `;
      } else {
        fallbackUserPrompt = `${fallbackTrapContext}Analyze this action:
    TITLE: ${actionTitle}${actionSummary ? `\nSUMMARY: ${actionSummary}` : ''} `;
      }

      const messages = [
        { role: "system", content: fallbackSystemPrompt },
        { role: "user", content: fallbackUserPrompt }
      ];

      const aiResponse = await callGeminiChat(messages, MODEL_COMPASS_HINTS);
      const parsed = parseCompassHintsResponse(aiResponse.content);

      // Extract mirrorMessage if present (for reasoning analysis)
      const mirrorMessage = isReasoningAnalysis ? (parsed.mirrorMessage || null) : null;

      return res.json({
        compassHints: parsed.compassHints || [],
        ...(mirrorMessage && { mirrorMessage })
      });
    }

    // Extract context (prefer provided gameContext, fallback to stored)
    const storedContext = conversation.meta.gameContext || {};
    const scenarioContext = gameContext?.setting || storedContext.setting || "Unknown scenario";
    const playerRole = gameContext?.role || storedContext.role || "Unknown role";
    const politicalSystem = gameContext?.systemName || storedContext.systemName || "Unknown system";

    // Build trap context section if provided (for value-aware analysis)
    const trapContextSection = valueTargeted ? `
VALUE TRAP CONTEXT:
This dilemma was designed to test the player's "${valueTargeted}" value.
The trap setup: "${trapDilemmaTitle}"${trapDilemmaDescription ? ` - ${trapDilemmaDescription}` : ''}

    MANDATORY: Your analysis MUST include a compass hint for the trapped value(${valueTargeted}).
- If the action SUPPORTS the trapped value → positive polarity(+1 or + 2)
      - If the action CONTRADICTS / BETRAYS the trapped value → negative polarity(-1 or - 2)
        - This hint is REQUIRED in addition to any other relevant values you identify

Continue to analyze other relevant values as well - the trapped value is mandatory but not exclusive.
` : '';

    // Build enhanced user prompt with full context
    let userPrompt;
    if (isReasoningAnalysis) {
      userPrompt = `SCENARIO CONTEXT: ${scenarioContext}
PLAYER ROLE: ${playerRole}
POLITICAL SYSTEM: ${politicalSystem}
${trapContextSection}
CURRENT DILEMMA:
    TITLE: ${actionTitle}${actionSummary ? `
DESCRIPTION: ${actionSummary}` : ''
        }

PLAYER'S SELECTED ACTION: ${selectedAction}

PLAYER'S REASONING FOR THIS CHOICE:
    "${reasoningText}"

Analyze the player's reasoning text for political compass values. What values does their explanation reveal?

    Additionally, generate a SHORT mirror reflection message.The mirror is a cynical, dry - witted observer in FIRST PERSON.
      Job: surface tensions between their VALUES and their REASONING.

        Rules:
    - 1 sentence ONLY, 15 - 20 words maximum
      - Reference at least ONE value from their compass(what / how axes)
        - Create tension - show how their reasoning reveals or contradicts values
          - Never preach - just highlight the contradiction or irony
            - Do NOT use exact compass value names.Paraphrase: "your sense of truth", "your love of freedom"
              - Dry / mocking tone

    BAD: "I observe how your reasoning reflects your values, traveler."(too wordy, wrong voice)
    GOOD: "Your sense of fairness is charming when it justifies self-interest."
    GOOD: "Careful deliberation — protecting the powerful, naturally."

Return JSON in this shape:
    {
      "compassHints": [
        { "prop": "what|whence|how|whither", "idx": 0 - 9, "polarity": -2 | -1 | 1 | 2 }
      ],
        "mirrorMessage": "Your short mirror reflection here (15-20 words max)"
    } `;
    } else {
      userPrompt = `SCENARIO CONTEXT: ${scenarioContext}
PLAYER ROLE: ${playerRole}
POLITICAL SYSTEM: ${politicalSystem}
${trapContextSection}
    ACTION:
    TITLE: ${actionTitle}${actionSummary ? `
SUMMARY: ${actionSummary}` : ''
        }

Return JSON in this shape:
    {
      "compassHints": [
        { "prop": "what|whence|how|whither", "idx": 0 - 9, "polarity": -2 | -1 | 1 | 2 }
      ]
    } `;
    }

    // Debug logging (compass analyze request payload)
    if (debugMode) {
      console.log("\n" + "=".repeat(80));
      console.log("🐛 [DEBUG] Compass Conversation Analyze - Request Payload:");
      console.log("=".repeat(80));
      const debugPayload = {
        gameId,
        analysisType: isReasoningAnalysis ? 'reasoning' : 'action',
        action: {
          title: actionTitle,
          summary: actionSummary || '(none)'
        },
        gameContext: {
          setting: scenarioContext,
          role: playerRole,
          systemName: politicalSystem
        },
        conversationMetadata: {
          messageCount: conversation.meta.messages.length,
          userPromptLength: userPrompt.length,
          userPromptTokens: Math.ceil(userPrompt.length / 4),
          totalConversationTokens: Math.ceil(conversation.meta.messages.reduce((sum, msg) => sum + msg.content.length, 0) / 4)
        }
      };
      if (isReasoningAnalysis) {
        debugPayload.reasoning = {
          text: reasoningText,
          selectedAction: selectedAction,
          textLength: reasoningText.length
        };
      }
      console.log(JSON.stringify(debugPayload, null, 2));
      console.log("=".repeat(80) + "\n");
    }

    // Prepare messages (history + new user message)
    const messages = [
      ...conversation.meta.messages,
      { role: "user", content: userPrompt }
    ];

    // Call AI (using Gemini for consistency with dilemma/aftermath)
    const aiResponse = await callGeminiChat(messages, MODEL_COMPASS_HINTS);
    const content = aiResponse?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log(`[CompassConversation] 🤖 AI responded(${content.length} chars)`);

    // Debug logging for AI response metadata
    if (debugMode) {
      console.log("\n" + "=".repeat(80));
      console.log("🐛 [DEBUG] Compass Conversation Analyze - Response Metadata:");
      console.log("=".repeat(80));
      console.log(JSON.stringify({
        responseLength: content.length,
        responseTokens: Math.ceil(content.length / 4),
        responsePreview: content.substring(0, 200) + (content.length > 200 ? '...' : '')
      }, null, 2));
      console.log("=".repeat(80) + "\n");
    }

    // Parse response
    const parsed = parseCompassHintsResponse(content);

    // Validate hints
    const validatedHints = validateCompassHints(parsed.compassHints || []);

    // Extract mirrorMessage if present (for reasoning analysis)
    const mirrorMessage = isReasoningAnalysis ? (parsed.mirrorMessage || null) : null;

    console.log(`[CompassConversation] ✅ Returned ${validatedHints.length} validated hint(s)`);
    validatedHints.forEach(hint => {
      console.log(`  → ${hint.prop}:${hint.idx} (${hint.polarity >= 0 ? '+' : ''}${hint.polarity})`);
    });
    if (mirrorMessage) {
      console.log(`[CompassConversation] 🪞 Mirror message: "${mirrorMessage.substring(0, 80)}${mirrorMessage.length > 80 ? '...' : ''}"`);
    }

    // Update conversation with assistant response
    messages.push({ role: "assistant", content });
    storeConversation(`compass - ${gameId} `, `compass - ${gameId} `, "openai", {
      messages,
      compassDefinitions: true,
      gameContext: gameContext || storedContext // Update stored context if provided
    });

    // Touch conversation to reset TTL
    touchConversation(`compass - ${gameId} `);

    return res.json({
      compassHints: validatedHints,
      ...(mirrorMessage && { mirrorMessage })
    });

  } catch (error) {
    console.error("[CompassConversation] ❌ Analysis error:", error);
    return res.status(500).json({
      error: "Compass analysis failed",
      message: error?.message || "Unknown error"
    });
  }
});

// -------------------- Helper Functions for buildTurnUserPrompt -------

/**
 * buildContinuityDirectives - Generates continuity directives for process-based actions
 * Detects votes, negotiations, consultations and enforces immediate results
 */





/**
 * Helper: Call OpenAI Chat Completions API with message history
 */
async function callOpenAIChat(messages, model) {
  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY} `,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model || CHAT_MODEL_DEFAULT,
      messages: messages,
      temperature: 1,
      max_completion_tokens: 6144  // Increased from 4096 to reduce truncation risk
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText} `);
  }

  const data = await response.json();
  return {
    content: data?.choices?.[0]?.message?.content || "",
    finishReason: data?.choices?.[0]?.finish_reason
  };
}

/**
 * Call XAI (X.AI/Grok) Chat API for game-turn endpoint
 * Compatible with OpenAI API format
 */
async function callXAIChat(messages, model) {
  const response = await fetch(XAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${XAI_KEY} `,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model || MODEL_DILEMMA_XAI,
      messages: messages,
      temperature: 1,
      max_tokens: 6144,  // XAI uses max_tokens instead of max_completion_tokens
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`XAI API error ${response.status}: ${errorText} `);
  }

  const data = await response.json();
  return {
    content: data?.choices?.[0]?.message?.content || "",
    finishReason: data?.choices?.[0]?.finish_reason
  };
}


// -------------------- Serve static files in production -------
// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  // Serve static files from the 'dist' directory
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));

  // Handle SPA routing - send index.html for all non-API routes
  // Express 5 compatible: use regex instead of "*"
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  console.log(`[server] serving static files from ${distPath} `);
}

// -------------------- Highscores API Endpoints ---------------------------
/**
 * POST /api/highscores/submit
 * Submit a highscore entry to the global leaderboard (V2)
 * Note: Avatars are NOT stored on server - only stored locally in browser
 * 
 * Request Body:
 * {
 *   userId: string,         // REQUIRED: Anonymous UUID or researcher ID
 *   gameId?: string,        // OPTIONAL: Game session ID (for linking to logs)
 *   sessionId?: string,     // OPTIONAL: Session ID (for linking to logs)
 *   name: string,
 *   about: string,
 *   democracy: string,
 *   autonomy: string,
 *   values: string,
 *   score: number,
 *   politicalSystem: string,
 *   period?: string,
 *   avatarUrl?: string      // OPTIONAL: Compressed 64x64 WebP thumbnail (~5-10KB)
 * }
 */
app.post("/api/highscores/submit", async (req, res) => {
  try {
    const {
      userId,           // NEW: Required
      gameId,           // NEW: Optional (for linking to logs)
      sessionId,        // NEW: Optional (for linking to logs)
      name,
      about,
      democracy,
      autonomy,
      values,
      score,
      politicalSystem,
      period,
      avatarUrl,        // NEW: Optional compressed thumbnail (~5-10KB)
      role              // NEW: Role key for filtering (e.g., "unc_cleopatra")
    } = req.body;

    // Validation
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "userId is required"
      });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Name is required"
      });
    }

    if (typeof score !== 'number' || score < 0 || score > 1500) {
      return res.status(400).json({
        success: false,
        error: "Score must be between 0 and 1500"
      });
    }

    const collection = await getHighscoresCollection();

    // Insert entry
    const entry = {
      userId: userId.trim(),
      gameId: gameId || null,
      sessionId: sessionId || null,
      name: name.trim(),
      about: about?.trim() || "",
      democracy: democracy || "Medium",
      autonomy: autonomy || "Medium",
      values: values || "",
      score: Math.round(score),
      politicalSystem: politicalSystem?.trim() || "Unknown",
      period: period || undefined,
      avatarUrl: avatarUrl || undefined,  // Compressed 64x64 WebP thumbnail
      role: role?.trim() || "Unknown",    // Save role key
      createdAt: new Date()
    };

    await collection.insertOne(entry);

    // Get global rank (across all users)
    const globalRank = await collection.countDocuments({ score: { $gt: score } }) + 1;

    // Get user's personal rank (among their own scores)
    const userRank = await collection.countDocuments({
      userId: userId,
      score: { $gt: score }
    }) + 1;

    // Check if this is user's best score
    const userBestScore = await collection.findOne(
      { userId: userId },
      { sort: { score: -1 }, projection: { score: 1 } }
    );
    const isPersonalBest = !userBestScore || score >= userBestScore.score;

    console.log(`[Highscores] ✅ Submitted: ${name} (userId: ${userId}, Score: ${score}, Global Rank: ${globalRank}, User Rank: ${userRank})`);

    res.json({
      success: true,
      globalRank,
      userRank,
      isPersonalBest,
      totalUserScores: await collection.countDocuments({ userId }),
      message: "Highscore submitted successfully"
    });

  } catch (error) {
    console.error("[Highscores] ❌ Error submitting:", error);
    res.status(500).json({
      success: false,
      error: "Failed to submit highscore"
    });
  }
});

/**
 * GET /api/highscores/global
 * Get global leaderboard - highest score per user (top 50 users)
 * 
 * Query Parameters:
 * - limit: number (default: 50, max: 100)
 * - offset: number (default: 0)
 */
app.get("/api/highscores/global", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const roleFilter = req.query.role; // Optional role filter

    const collection = await getHighscoresCollection();

    // MongoDB aggregation to get best score per user
    const pipeline = [];

    // Filter by role if specified
    if (roleFilter) {
      pipeline.push({ $match: { role: roleFilter } });
    }

    pipeline.push(
      // Sort by score descending to get best scores first
      { $sort: { score: -1 } },

      // Group by userId, take first (highest) score for each user
      {
        $group: {
          _id: { $ifNull: ["$userId", { $concat: ["anonymous-", { $toString: "$_id" }] }] },
          bestEntry: { $first: "$$ROOT" }
        }
      },

      // Replace root with the best entry document
      { $replaceRoot: { newRoot: "$bestEntry" } },

      // Sort by score again (after grouping)
      { $sort: { score: -1 } },

      // Pagination
      { $skip: offset },
      { $limit: limit }
    );

    const entries = await collection.aggregate(pipeline).toArray();

    // Format response (remove _id, sensitive data)
    const formattedEntries = entries.map(({ _id, userId, gameId, sessionId, ...entry }) => ({
      ...entry,
      createdAt: entry.createdAt?.toISOString?.() || entry.createdAt,
      // Note: userId intentionally excluded for privacy in global view
      // avatarUrl included (compressed 64x64 WebP thumbnail, ~5-10KB)
    }));

    // Get total unique users count (for pagination)
    const totalUsers = await collection.distinct("userId").then(arr => arr.length);

    console.log(`[Highscores] ✅ Fetched global leaderboard: ${formattedEntries.length} entries(offset: ${offset}, totalUsers: ${totalUsers})`);

    res.json({
      success: true,
      entries: formattedEntries,
      totalUsers,
      limit,
      offset
    });

  } catch (error) {
    console.error("[Highscores] ❌ Error fetching global leaderboard:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch global leaderboard"
    });
  }
});

/**
 * GET /api/highscores/user/:userId
 * Get all scores for a specific user (personal history)
 * 
 * Query Parameters:
 * - limit: number (default: 50, max: 100)
 * - offset: number (default: 0)
 * - sortBy: "score" | "date" (default: "score")
 * - role: string (optional filter)
 */
app.get("/api/highscores/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const sortBy = req.query.sortBy === "date" ? "createdAt" : "score";
    const roleFilter = req.query.role;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required"
      });
    }

    const collection = await getHighscoresCollection();

    // Get all scores for this user
    const sortOrder = sortBy === "score" ? { score: -1 } : { createdAt: -1 };

    const query = { userId };
    if (roleFilter) {
      query.role = roleFilter;
    }

    const entries = await collection
      .find(query)
      .sort(sortOrder)
      .skip(offset)
      .limit(limit)
      .toArray();

    // Format response
    const formattedEntries = entries.map(({ _id, userId, gameId, sessionId, ...entry }) => ({
      ...entry,
      createdAt: entry.createdAt?.toISOString?.() || entry.createdAt,
      gameId, // Include gameId for user's own scores (helps with debugging)
      // avatarUrl included (compressed 64x64 WebP thumbnail, ~5-10KB)
    }));

    // Get total count for this user
    const total = await collection.countDocuments({ userId });

    // Get user's best score
    const bestScore = entries.length > 0
      ? Math.max(...entries.map(e => e.score))
      : 0;

    console.log(`[Highscores] ✅ Fetched user scores: ${userId} (${formattedEntries.length} entries, best: ${bestScore})`);

    res.json({
      success: true,
      entries: formattedEntries,
      total,
      bestScore,
      limit,
      offset
    });

  } catch (error) {
    console.error("[Highscores] ❌ Error fetching user scores:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user scores"
    });
  }
});

/**
 * GET /api/highscores (DEPRECATED)
 * Get global highscores leaderboard
 * 
 * @deprecated Use /api/highscores/global or /api/highscores/user/:userId instead
 * 
 * Query Parameters:
 * - limit: number (default: 50, max: 100)
 * - offset: number (default: 0)
 */
app.get("/api/highscores", async (req, res) => {
  console.warn('[Highscores] ⚠️ DEPRECATED: /api/highscores endpoint called. Use /api/highscores/global or /api/highscores/user/:userId instead.');
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const collection = await getHighscoresCollection();

    // Get top scores, sorted by score descending
    const entries = await collection
      .find({})
      .sort({ score: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Remove MongoDB _id field and format response
    // Note: Avatars are NOT included - they're only stored locally in browser
    const formattedEntries = entries.map(({ _id, ...entry }) => ({
      ...entry,
      // Convert MongoDB date to ISO string if needed
      createdAt: entry.createdAt?.toISOString?.() || entry.createdAt
    }));

    // Get total count for pagination
    const total = await collection.countDocuments({});

    console.log(`[Highscores] ✅ Fetched ${formattedEntries.length} entries(offset: ${offset}, total: ${total})`);

    res.json({
      success: true,
      entries: formattedEntries,
      total,
      limit,
      offset
    });

  } catch (error) {
    console.error("[Highscores] ❌ Error fetching highscores:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch highscores"
    });
  }
});

/**
 * GET /api/highscores/bests-by-role
 * Get global best score for each role
 * Returns a map of role -> score
 */
app.get("/api/highscores/bests-by-role", async (req, res) => {
  try {
    const collection = await getHighscoresCollection();

    const pipeline = [
      { $sort: { score: -1 } },
      {
        $group: {
          _id: "$role",
          bestScore: { $max: "$score" }
        }
      }
    ];

    const results = await collection.aggregate(pipeline).toArray();

    // Convert to map: { "president": 1500, "dictator": 1200 }
    const roleMap = results.reduce((acc, curr) => {
      if (curr._id) {
        acc[curr._id] = curr.bestScore;
      }
      return acc;
    }, {});

    res.json({
      success: true,
      bests: roleMap
    });
  } catch (error) {
    console.error("[Highscores] ❌ Error fetching global role bests:", error);
    res.status(500).json({ success: false, error: "Failed to fetch role bests" });
  }
});

/**
 * GET /api/highscores/user/:userId/bests-by-role
 * Get user's best score for each role
 * Returns a map of role -> score
 */
app.get("/api/highscores/user/:userId/bests-by-role", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, error: "userId required" });

    const collection = await getHighscoresCollection();

    const pipeline = [
      { $match: { userId } },
      {
        $group: {
          _id: "$role",
          bestScore: { $max: "$score" }
        }
      }
    ];

    const results = await collection.aggregate(pipeline).toArray();

    const roleMap = results.reduce((acc, curr) => {
      if (curr._id) {
        acc[curr._id] = curr.bestScore;
      }
      return acc;
    }, {});

    res.json({
      success: true,
      bests: roleMap
    });
  } catch (error) {
    console.error("[Highscores] ❌ Error fetching user role bests:", error);
    res.status(500).json({ success: false, error: "Failed to fetch user role bests" });
  }
});

// -------------------- Health Check Endpoint ---------------------------
/**
 * GET /health
 * Health check endpoint for monitoring server and MongoDB status
 * Returns 200 if healthy, 503 if unhealthy
 */
app.get("/health", async (req, res) => {
  try {
    // Check MongoDB connection by attempting to get a collection
    const countersCollection = await getCountersCollection();
    if (!countersCollection) {
      throw new Error("MongoDB connection unavailable");
    }

    res.status(200).json({
      status: "healthy",
      mongodb: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[Health Check] Failed:", error?.message || error);
    res.status(503).json({
      status: "unhealthy",
      mongodb: "disconnected",
      error: error?.message || "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
});

// -------------------- Global Error Middleware ---------------------------
/**
 * Global error handler - catches all unhandled errors in Express routes
 * MUST be defined after all routes
 */
app.use((err, req, res, next) => {
  console.error("[Express] Unhandled error:", {
    message: err?.message || err,
    stack: err?.stack,
    path: req.path,
    method: req.method
  });

  // Don't send error if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

// -------------------- Start server ---------------------------
const PORT = Number(process.env.PORT) || 3001;

// Initialize MongoDB connection before starting server
async function startServer() {
  try {
    // Test MongoDB connection by getting counters collection
    console.log("[Server] Initializing MongoDB connection...");
    const countersCollection = await getCountersCollection();
    if (countersCollection) {
      console.log("[Server] ✅ MongoDB connection verified");
    }
  } catch (error) {
    console.warn("[Server] ⚠️ MongoDB connection failed, but server will start anyway:", error?.message);
    console.warn("[Server] MongoDB will auto-reconnect when available");
  }

  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);

    // Start conversation cleanup task
    startCleanupTask();
  });
}

startServer();
