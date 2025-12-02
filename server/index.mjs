// server/index.mjs
import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import { fileURLToPath } from "url";
import loggingRouter from "./api/logging.mjs";
import {
  storeConversation,
  getConversation,
  touchConversation,
  deleteConversation,
  startCleanupTask
} from "./conversationStore.mjs";
import { getCountersCollection, incrementCounter, getUsersCollection, getScenarioSuggestionsCollection, getHighscoresCollection } from "./db/mongodb.mjs";
import { getTheoryPrompt } from "./theory-loader.mjs";

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
/**
 * USE_PROMPT_V3: Toggle between original prompt and V3 (value-driven, private life focus)
 *
 * V3 Features:
 * - Ultra-lean 3-step process (Value → Axis → Bridge)
 * - Private life focus for low/mid authority
 * - Setting-rooted details
 * - Dynamic axis selection (max 3 per axis)
 * - Value tracking (max 2 per value)
 * - Includes tracking fields: valueTargeted, axisExplored
 *
 * Set to false for instant rollback to original prompt
 */
const USE_PROMPT_V3 = true;

// -------------------- Topic/Scope/TensionCluster Debug Tracker ---------------------------
/**
 * Debug tracker for topic/scope/tensionCluster variety
 * Logs topic/scope/tensionCluster for each dilemma and warns if AI violates diversity rules
 *
 * Rules being validated:
 * 1. Must NOT repeat same topic+scope as previous day
 * 2. Over any 3 consecutive days: use at least 2 different topics
 * 3. Over any 3 consecutive days: use at least 2 different scopes
 * Note: tensionCluster consecutive repeats allowed, max 2 per game enforced elsewhere
 *
 * @param {string} gameId - Game session ID
 * @param {number} day - Current day number
 * @param {string} topic - Dilemma topic (Military, Economy, etc.)
 * @param {string} scope - Dilemma scope (Local, National, etc.)
 * @param {string} tensionCluster - Tension cluster category
 * @param {string} title - Dilemma title
 * @param {Array} topicHistory - Array of {day, topic, scope, tensionCluster} from previous days
 */
function logTopicScopeDebug(gameId, day, topic, scope, tensionCluster, title, topicHistory) {
  const warnings = [];

  // Rule 1: Check if same topic+scope as previous day
  if (topicHistory.length > 0) {
    const prev = topicHistory[topicHistory.length - 1];
    if (prev.topic === topic && prev.scope === scope) {
      warnings.push(`same topic+scope as Day ${prev.day}`);
    }
  }

  // Rule 2: Check topic variety in last 3 days
  if (topicHistory.length >= 2) {
    const last2 = topicHistory.slice(-2);
    const topics = new Set([...last2.map(h => h.topic), topic]);
    if (topics.size === 1) {
      warnings.push(`only 1 topic in last 3 days (${topic})`);
    }
  }

  // Rule 3: Check scope variety in last 3 days
  if (topicHistory.length >= 2) {
    const last2 = topicHistory.slice(-2);
    const scopes = new Set([...last2.map(h => h.scope), scope]);
    if (scopes.size === 1) {
      warnings.push(`only 1 scope in last 3 days (${scope})`);
    }
  }

  // Note: Consecutive tensionCluster repeats are allowed, only max-2 per game is enforced
  const prevCluster = topicHistory.length > 0 ? topicHistory[topicHistory.length - 1].tensionCluster : null;

  // Log with warnings if any
  const warnStr = warnings.length > 0 ? ` [⚠️  WARN: ${warnings.join(', ')}]` : ' [✅ OK]';
  console.log(`[TOPIC] gameId=${gameId} Day=${day} topic=${topic} scope=${scope} cluster=${tensionCluster} title="${title}"${warnStr}`);

  // Extra tension cluster log for easy filtering
  console.log(`[TENSION] Day ${day}: ${tensionCluster} (prev: ${prevCluster || 'none'})`);
}

const app = express();

// CORS Configuration - Security for production deployment
// Restrict API access to allowed domains only (prevents unauthorized data submission)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3001']; // Development defaults

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Rejected request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());


/**
 * Adaptively assign treatment to ensure balanced distribution
 * Selects from treatments with the minimum count, ensuring even distribution
 * @returns {Promise<string>} One of: 'fullAutonomy', 'semiAutonomy', 'noAutonomy'
 */
async function assignRandomTreatment() {
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

// -------------------- User Registration & Treatment Assignment --------------------
/**
 * POST /api/users/register
 * Register a new user or get existing user with treatment assignment
 *
 * Body: {
 *   userId: string (email address)
 * }
 *
 * Returns: {
 *   success: boolean,
 *   userId: string,
 *   treatment: 'fullAutonomy' | 'semiAutonomy' | 'noAutonomy',
 *   isNewUser: boolean
 * }
 */
app.post("/api/users/register", async (req, res) => {
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
});

// -------------------- Game Slot Reservation --------------------
app.post("/api/reserve-game-slot", async (req, res) => {
  try {
    const countersCollection = await getCountersCollection();

    // Atomically find and increment the counter, but only if its value is less than the limit.
    const gameLimit = parseInt(process.env.GAME_LIMIT || '250', 10);
    const result = await countersCollection.findOneAndUpdate(
      { name: 'total_games', value: { $lt: gameLimit } },
      { $inc: { value: 1 } },
      { returnDocument: 'after' }
    );

    if (result.value) {
      // Successfully incremented, meaning we got a slot.
      console.log(`[Reserve Slot] Slot reserved. New count: ${result.value}`);
      res.json({ success: true, gameCount: result.value });
    } else {
      // The findOneAndUpdate came back empty, which means the condition value < gameLimit failed.
      const currentCounter = await countersCollection.findOne({ name: 'total_games' });
      const currentCount = currentCounter ? currentCounter.value : 'unknown';
      console.log(`[Reserve Slot] Game limit reached. Current count: ${currentCount}`);
      res.status(403).json({
        success: false,
        message: "The game has reached its player limit.",
        isCapped: true,
      });
    }
  } catch (error) {
    console.error("Error in /api/reserve-game-slot:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to reserve game slot" });
  }
});

// -------------------- Data Logging Routes --------------------
// Mount logging API endpoints (for research data collection)
app.use("/api/log", loggingRouter);
// --------------------------------------------------------------

// -------------------- Model & API config --------------------
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const XAI_KEY = process.env.XAI_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const IMAGE_URL = "https://api.openai.com/v1/images/generations";
const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";
const XAI_IMAGE_URL = "https://api.x.ai/v1/images/generations";
const GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Initialize Anthropic client
const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;

// One default text model + per-task overrides from .env
const CHAT_MODEL_DEFAULT = process.env.CHAT_MODEL || "gpt-4o-mini";
const MODEL_VALIDATE = process.env.MODEL_VALIDATE || CHAT_MODEL_DEFAULT;
const MODEL_NAMES    = process.env.MODEL_NAMES    || CHAT_MODEL_DEFAULT;
const MODEL_ANALYZE  = process.env.MODEL_ANALYZE  || CHAT_MODEL_DEFAULT;
const MODEL_MIRROR   = process.env.MODEL_MIRROR   || CHAT_MODEL_DEFAULT;
const MODEL_MIRROR_ANTHROPIC = process.env.MODEL_MIRROR_ANTHROPIC || ""; // No fallback - must be set in .env
// Dilemma models (no generation here yet — just configuration)
// Cheap default now; premium can be used later on demand.
const MODEL_DILEMMA = process.env.MODEL_DILEMMA || CHAT_MODEL_DEFAULT;
const MODEL_DILEMMA_PREMIUM = process.env.MODEL_DILEMMA_PREMIUM || "gpt-5";
const MODEL_DILEMMA_ANTHROPIC = process.env.MODEL_DILEMMA_ANTHROPIC || ""; // No fallback - must be set in .env
const MODEL_DILEMMA_XAI = process.env.MODEL_DILEMMA_XAI || ""; // No fallback - must be set in .env
const MODEL_DILEMMA_GEMINI = process.env.MODEL_DILEMMA_GEMINI || ""; // No fallback - must be set in .env
const MODEL_VALIDATE_GEMINI = process.env.MODEL_VALIDATE_GEMINI || "gemini-2.5-flash"; // Gemini model for suggestion validation
const MODEL_COMPASS_HINTS = process.env.MODEL_COMPASS_HINTS || "gemini-2.5-flash"; // Changed to Gemini for consistency with dilemma/aftermath


// Image model
const IMAGE_MODEL_OPENAI = process.env.IMAGE_MODEL_OPENAI || "gpt-image-1"; // OpenAI model (also used as fallback)
const IMAGE_MODEL_XAI = process.env.IMAGE_MODEL_XAI || ""; // No fallback - must be set in .env
const IMAGE_MODEL_GEMINI = process.env.IMAGE_MODEL_GEMINI || ""; // e.g., imagen-3.0-generate-001
const GEMINI_IMAGE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const IMAGE_SIZE = process.env.IMAGE_SIZE || "1024x1024";
const IMAGE_QUALITY = process.env.IMAGE_QUALITY || "low"; // low|medium|high

// --- Gemini TTS Configuration --------------------------
const TTS_MODEL = process.env.TTS_MODEL || "gemini-2.5-flash-preview-tts";
const TTS_VOICE = process.env.TTS_VOICE || "Enceladus";
// -------------------------------------------------------

// -------------------- Shared AI Prompt Rules --------------------
// Anti-jargon rules to ensure accessibility across all content generation
const ANTI_JARGON_RULES = `
LANGUAGE ACCESSIBILITY (CRITICAL)
- Use PLAIN MODERN ENGLISH - avoid historical/technical jargon that requires specialized knowledge
- Instead of obscure historical terms like "Haliaia", "Boule", "Archon" → use simple equivalents like "high court", "council", "chief magistrate"
- Players should understand immediately without needing to look up terms
- Familiar institutional names are fine: "Senate", "Parliament", "Council", "Assembly", "Congress"
- Prioritize CLARITY over historical accuracy
- Write for a general audience, not history experts
- Example transformations:
  * "Haliaia" → "high court" or "supreme judges"
  * "Boule" → "council" or "assembly"
  * "Archon" → "chief magistrate" or "leader"
  * "Ecclesia" → "citizen assembly" or "popular assembly"
  * "Strategos" → "military commander" or "general"

EXCEPTION - IMMERSIVE CHARACTER POV:
- When writing dilemma descriptions from character's perspective, use sensory/observational language
- Describe what character can SEE, HEAR, EXPERIENCE (not what they couldn't know)
- ✅ GOOD: "strange pale-skinned foreigners with fire-weapons" (describes what's observable)
- ❌ BAD: "English colonists with muskets" (anachronistic knowledge)
- This is NOT jargon - it's immersive storytelling that respects character's actual knowledge
`.trim();
// ----------------------------------------------------------------

// Canonical polity types (E-12 framework classification)
const ALLOWED_POLITIES = [
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

const COMPASS_LABELS = {
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

const COMPASS_DIMENSION_NAMES = {
  what: "What (goals)",
  whence: "Whence (justification)",
  how: "How (means)",
  whither: "Whither (recipients)",
};

const DEFAULT_MIRROR_ADVICE =
  "The mirror drums its fingers, wondering if your favorite virtue still feels sturdy when tonight's plan leans away from it.";

function extractTopCompassValues(compassValues, limit = 2) {
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

function extractTopCompassFromStrings(compassStringMap) {
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

function compassTopValuesToSummary(topValues) {
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

function formatCompassTopValuesForPrompt(topValues) {
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

function sanitizeMirrorAdvice(text) {
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
function findDomainController(domain, decisiveSeats, powerHolders) {
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
function formatE12ForPrompt(e12, powerHolders) {
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
    "Economy": "Economy (trade, currency, taxation)",
    "Appointments": "Appointments (officials, ministers)",
    "Infrastructure": "Infrastructure (roads, public works)",
    "Curricula": "Curricula (education content)",
    "Healthcare": "Healthcare (medical policy)",
    "Immigration": "Immigration (borders, citizenship)",
    "Environment": "Environment (natural resources)"
  };

  let text = "";

  // Tier I - Existential domains (highest stakes)
  if (tierI.length > 0) {
    text += "\nTIER I DOMAINS (Existential - highest stakes):\n";
    tierI.forEach(domain => {
      const fullName = domainNames[domain] || domain;
      const controller = findDomainController(domain, decisive, powerHolders);
      text += `  • ${fullName}\n    Controlled by: ${controller}\n`;
    });
  }

  // Tier II - Constitutive domains
  if (tierII.length > 0) {
    text += "\nTIER II DOMAINS (Constitutive - institutional foundation):\n";
    tierII.forEach(domain => {
      const fullName = domainNames[domain] || domain;
      const controller = findDomainController(domain, decisive, powerHolders);
      text += `  • ${fullName}\n    Controlled by: ${controller}\n`;
    });
  }

  // Tier III - Contextual domains
  if (tierIII.length > 0) {
    text += "\nTIER III DOMAINS (Contextual - day-to-day policy):\n";
    tierIII.forEach(domain => {
      const fullName = domainNames[domain] || domain;
      const controller = findDomainController(domain, decisive, powerHolders);
      text += `  • ${fullName}\n    Controlled by: ${controller}\n`;
    });
  }

  return text;
}

// Helper: call Chat Completions and try to parse JSON from the reply
// Automatically falls back to gpt-4o if quota error (429) is encountered
async function aiJSON({ system, user, model = CHAT_MODEL_DEFAULT, temperature = undefined, fallback = null }) {
  const FALLBACK_MODEL = "gpt-4o";

  // Helper function to make the actual API call
  async function makeRequest(modelToUse) {
    const payload = {
      model: modelToUse,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };
    // Only include temperature if it is exactly 1 (some models accept only default).
    if (typeof temperature === "number" && temperature === 1) {
      payload.temperature = 1;
    }

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`OpenAI chat error ${resp.status}: ${t}`);
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? "";

    const parsed = safeParseJSON(text, { debugTag: "aiJSON" });
    if (parsed) {
      return parsed;
    }

    return fallback;
  }

  try {
    // FIRST ATTEMPT: Try with the requested model
    return await makeRequest(model);
  } catch (e) {
    console.error(`[server] aiJSON error with model ${model}:`, e?.message || e);

    // Check if this is a quota error (429) or insufficient_quota
    const isQuotaError =
      e?.message?.includes("429") ||
      e?.message?.includes("insufficient_quota") ||
      e?.message?.includes("quota");

    if (isQuotaError && model !== FALLBACK_MODEL) {
      // FALLBACK ATTEMPT: Try with cheaper model
      console.log(`[server] ⚠️  QUOTA ERROR DETECTED - Falling back from ${model} to ${FALLBACK_MODEL}`);
      try {
        const result = await makeRequest(FALLBACK_MODEL);
        console.log(`[server] ✅ Fallback to ${FALLBACK_MODEL} succeeded`);
        return result;
      } catch (fallbackError) {
        console.error(`[server] ❌ Fallback to ${FALLBACK_MODEL} also failed:`, fallbackError?.message || fallbackError);
        return fallback;
      }
    }

    // Not a quota error, or already tried fallback model
    return fallback;
  }
}


/**
 * aiJSONGemini: Call Gemini API and parse JSON from the response
 * Similar to aiJSON but uses Google's Gemini API via OpenAI-compatible endpoint
 */
async function aiJSONGemini({ system, user, model = MODEL_VALIDATE_GEMINI, temperature = 0, fallback = null }) {
  try {
    console.log(`[GEMINI-JSON] Calling Gemini API with model: ${model}`);

    const messages = [
      { role: "system", content: system },
      { role: "user", content: user }
    ];

    const response = await fetch(GEMINI_CHAT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GEMINI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: temperature,
        max_tokens: 1024, // Validation responses are small
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GEMINI-JSON] API error ${response.status}: ${errorText}`);
      return fallback;
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content ?? "";

    console.log(`[GEMINI-JSON] Raw response: ${text.substring(0, 200)}...`);

    const parsed = safeParseJSON(text, { debugTag: "aiJSONGemini" });
    if (parsed) {
      return parsed;
    }

    console.warn("[GEMINI-JSON] Failed to parse JSON from response, using fallback");
    return fallback;
  } catch (err) {
    console.error("[GEMINI-JSON] Error:", err?.message || err);
    return fallback;
  }
}

/**
 * aiTextGemini - Call Gemini API and return raw text response
 * Similar to aiJSONGemini but returns text instead of parsed JSON
 */
async function aiTextGemini({ system, user, model = "gemini-2.5-flash", temperature = 0.7, maxTokens = 2048 }) {
  try {
    console.log(`[GEMINI-TEXT] Calling Gemini API with model: ${model}`);

    const messages = [
      { role: "system", content: system },
      { role: "user", content: user }
    ];

    const response = await fetch(GEMINI_CHAT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GEMINI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GEMINI-TEXT] API error ${response.status}: ${errorText}`);
      return "";
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content ?? "";

    console.log(`[GEMINI-TEXT] Response received: ${text.substring(0, 100)}...`);
    return text;
  } catch (err) {
    console.error("[GEMINI-TEXT] Error:", err?.message || err);
    return "";
  }
}


async function aiText({ system, user, model = CHAT_MODEL_DEFAULT, temperature, maxTokens }) {
  const FALLBACK_MODEL = "gpt-4o";

  // Helper function to make the actual API call
  async function makeRequest(modelToUse) {
    const body = {
      model: modelToUse,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };
    // Include temperature if provided (not just if === 1)
    if (typeof temperature === "number") {
      body.temperature = temperature;
    }
    // Include max_completion_tokens if provided (critical for preventing truncated JSON responses)
    // NOTE: Newer models (GPT-4o) prefer max_completion_tokens over max_tokens
    if (typeof maxTokens === "number") {
      body.max_completion_tokens = maxTokens;
    }

    // DIAGNOSTIC: Log request parameters to verify max_completion_tokens is sent
    console.log(`[aiText] Requesting model=${body.model}, temp=${body.temperature ?? 'default'}, max_completion_tokens=${body.max_completion_tokens ?? 'not set'}`);

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    console.log(`[aiText] Response received: status=${resp.status}`);
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`OpenAI chat error ${resp.status}: ${t}`);
    }
    const data = await resp.json();
    console.log(`[aiText] JSON parsed successfully`);
    const choice = data?.choices?.[0];
    const content = choice?.message?.content ?? "";
    const finishReason = choice?.finish_reason;
    console.log(`[aiText] Content length=${content.length}, finish_reason=${finishReason}`);

    // Log finish reason for debugging truncation issues
    if (finishReason && finishReason !== 'stop') {
      console.warn(`[aiText] ⚠️  Generation finished with reason: ${finishReason} (expected 'stop')`);
      if (finishReason === 'length') {
        console.warn(`[aiText] 🚨 Response was TRUNCATED due to token limit!`);
      }
    }

    return content.trim();
  }

  try {
    // FIRST ATTEMPT: Try with the requested model
    return await makeRequest(model);
  } catch (e) {
    console.error(`[server] aiText error with model ${model}:`, e?.message || e);

    // Check if this is a quota error (429) or insufficient_quota
    const isQuotaError =
      e?.message?.includes("429") ||
      e?.message?.includes("insufficient_quota") ||
      e?.message?.includes("quota");

    if (isQuotaError && model !== FALLBACK_MODEL) {
      // FALLBACK ATTEMPT: Try with cheaper model
      console.log(`[server] ⚠️  QUOTA ERROR DETECTED - Falling back from ${model} to ${FALLBACK_MODEL}`);
      try {
        const result = await makeRequest(FALLBACK_MODEL);
        console.log(`[server] ✅ Fallback to ${FALLBACK_MODEL} succeeded`);
        return result;
      } catch (fallbackError) {
        console.error(`[server] ❌ Fallback to ${FALLBACK_MODEL} also failed:`, fallbackError?.message || fallbackError);
        return "";
      }
    }

    // Not a quota error, or already tried fallback model
    return "";
  }
}

// -------------------- Anthropic AI Text Helper --------------------
async function aiTextAnthropic({ system, user, model = MODEL_DILEMMA_ANTHROPIC, temperature = 1 }) {
  if (!anthropic) {
    throw new Error("Anthropic client not initialized - check ANTHROPIC_API_KEY in .env");
  }

  if (!model || model === "") {
    throw new Error("Anthropic model not configured - set MODEL_DILEMMA_ANTHROPIC or MODEL_MIRROR_ANTHROPIC in .env");
  }

  try {
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 4096,
      temperature: temperature,
      system: system,
      messages: [
        { role: "user", content: user }
      ]
    });

    // Extract text from response
    const textContent = response.content.find(block => block.type === 'text');
    return textContent?.text?.trim() || "";
  } catch (e) {
    console.error(`[server] aiTextAnthropic error with model ${model}:`, e?.message || e);
    throw e;
  }
}

// -------------------- XAI (X.AI/Grok) AI Text Helper --------------------
async function aiTextXAI({ system, user, model = MODEL_DILEMMA_XAI, temperature = 1, maxTokens = 4096 }) {
  if (!XAI_KEY) {
    throw new Error("XAI API key not configured - check XAI_API_KEY in .env");
  }

  if (!model || model === "") {
    throw new Error("XAI model not configured - set MODEL_DILEMMA_XAI in .env");
  }

  try {
    const messages = [
      { role: "system", content: system },
      { role: "user", content: user }
    ];

    const body = {
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
      stream: false
    };

    const response = await fetch(XAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XAI_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[server] XAI API error (${response.status}):`, errorText);
      throw new Error(`XAI API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || "";

    if (!content) {
      console.warn("[server] XAI returned empty content");
      return "";
    }

    return content;
  } catch (e) {
    console.error(`[server] aiTextXAI error with model ${model}:`, e?.message || e);
    throw e;
  }
}

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
app.post("/api/intro-paragraph", async (req, res) => {
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
    } = req.body || {};

    const roleText = String(role || "").slice(0, 200).trim();
    const genderText = ["male", "female", "any"].includes(String(gender || "").toLowerCase())
      ? String(gender).toLowerCase()
      : "any";
    const languageCode = String(language || "en").toLowerCase();

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
      return (await aiTextGemini({ system, user, model: "gemini-2.5-flash" }))?.trim() || "";
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
});



// -------------------- AI VALIDATE ROLE ----------------------
app.post("/api/validate-role", async (req, res) => {
  const raw = (req.body?.text || req.body?.role || req.body?.input || "").toString().trim();

  const system =
    "You validate a single short line describing a player's ROLE in a political game.\n" +
    "ACCEPT if the input describes a plausible political/leadership role with enough context to understand the setting. " +
    "The setting can be EXPLICIT (place/time stated) or IMPLICIT (inferred from the role itself). " +
    "Be PERMISSIVE: accept roles where context can be reasonably inferred.\n\n" +
    "Examples that SHOULD PASS:\n" +
    "- Explicit setting: 'Prime Minister of Israel', 'President of United States', 'Chancellor of Germany 1980s'\n" +
    "- Implicit setting: 'Mars Colony Leader' (implies future/space), 'Viking Chief' (implies historical Norse), " +
    "'Galactic Emperor' (implies sci-fi), 'Pharaoh' (implies ancient Egypt)\n" +
    "- Partial setting: 'Medieval King', 'WWII General', 'Roman Senator'\n\n" +
    "Examples that SHOULD FAIL:\n" +
    "- Too vague: 'a leader', 'someone powerful', 'a person'\n" +
    "- Not a role: 'in medieval England' (no role), 'freedom' (not a role)\n" +
    "- Gibberish: 'asdfgh', 'xyz123'\n\n" +
    "Return STRICT JSON only as {\"valid\": true|false, \"reason\": \"short reason if invalid\"}. No extra keys, no prose.";

  const user = `Input: ${raw || ""}`;

  const out = await aiJSONGemini({ system, user, model: "gemini-2.5-flash", temperature: 0, fallback: null });
  if (!out || typeof out.valid !== "boolean") {
    return res.status(503).json({ error: "AI validator unavailable" });
  }
  return res.json({ valid: !!out.valid, reason: String(out.reason || "") });
});

// -------------------- EXTRACT SHORT TRAIT --------------------
// Extracts a short trait keyword from a custom self-description
// Used in DreamScreen mirror phase: "Mirror, mirror on the wall, who's the {trait} of them all?"
// Uses Gemini 2.5 Flash for trait extraction
app.post("/api/extract-trait", async (req, res) => {
  const { description, language } = req.body;

  if (!description) {
    return res.status(400).json({ error: "Description required" });
  }

  const system = `You extract a trait from a user's self-description for a magic mirror game.
The trait must fit seamlessly into: "Mirror, mirror on the wall, who's the ___ of them all?"

Rules:
1. The user's input language is: ${language || 'en'}
2. If input is Hebrew, understand the meaning and translate to English
3. Extract a SUPERLATIVE trait (e.g., "wisest", "bravest", "most creative", "richest")
4. The trait should sound natural in the sentence above
5. Return JSON: {"trait": "english superlative"}

Examples:
- Input: "I'm very smart" → {"trait": "smartest"}
- Input: "I want to be rich" → {"trait": "richest"}
- Input: "אני רוצה להיות הכי חכם" → {"trait": "wisest"}
- Input: "I'm creative and artistic" → {"trait": "most creative"}
- Input: "אני אמיץ" → {"trait": "bravest"}`;

  try {
    const result = await aiJSONGemini({
      system,
      user: description,
      model: "gemini-2.5-flash",
      temperature: 0.2,
      fallback: { trait: description }
    });

    res.json(result);
  } catch (error) {
    console.error("Error extracting trait:", error);
    res.json({ trait: description });
  }
});

// -------------------- Background object suggestion ----------
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

app.post("/api/bg-suggestion", async (req, res) => {
  try {
    const { role, gender } = req.body || {};
    const system =
      "Output a single JSON object with key 'object' naming one concise, iconic background object that visually matches the role. " +
      "Max 3 words. Example: {\"object\":\"red pagoda\"}. No prose.";
    const genderWord = gender === "female" ? "female" : gender === "male" ? "male" : "any gender";
    const user = `Role: ${role || ""}. Gender: ${genderWord}. JSON ONLY.`;

    const ai = await aiJSONGemini({
      system,
      user,
      model: "gemini-2.5-flash",
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
});

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
app.post("/api/suggest-scenario", async (req, res) => {
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
});

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
const ISSUE_KEYS = ["governance", "order", "economy", "justice", "culture", "foreign"];
const ISSUE_LABELS = {
  governance: "Governance",
  order: "Order/Security",
  economy: "Economy",
  justice: "Justice",
  culture: "Culture/Religion",
  foreign: "Foreign/External"
};

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

function buildSupportProfileReminder(profiles) {
  if (!profiles) return "";
  const lines = [];
  if (profiles.people) {
    const stance = summarizeStances(profiles.people);
    const summary = profiles.people.summary || "No explicit summary provided.";
    lines.push(`- People baseline: ${summary}${stance ? ` | ${stance}` : ""}`);
  }
  if (profiles.challenger) {
    const stance = summarizeStances(profiles.challenger);
    const summary = profiles.challenger.summary || "No explicit summary provided.";
    lines.push(`- Challenger baseline: ${summary}${stance ? ` | ${stance}` : ""}`);
  }
  return lines.join("\n");
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
        { name: "Executive", percent: 28, role: {A:true, E:false}, stype: {t:"Author", i:"•"}, note: "Agenda & decrees" },
        { name: "Legislative", percent: 32, role: {A:true, E:false}, stype: {t:"Author", i:"•"}, note: "Law & purse" },
        { name: "Judicial", percent: 14, role: {A:false, E:true}, stype: {t:"Eraser", i:"•"}, note: "Review & injunctions" },
        { name: "Bureaucracy", percent: 12, role: {A:false, E:false}, stype: {t:"Agent", i:"•"}, note: "Implements/filters" },
        { name: "Wealth", percent: 14, role: {A:false, E:false}, stype: {t:"Actor", i:"-"}, note: "Lobby & capture" }
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
      storyThemes: ["autonomy_vs_heteronomy", "institutional_balance"]
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
  "storyThemes": ["snake_case", "keywords", "max_four"]
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
const LANGUAGE_NAMES = {
  en: "English",
  he: "Hebrew"
};

// Fallback texts per language
const MIRROR_QUIZ_FALLBACKS = {
  en: "The mirror squints… then grins mischievously.",
  he: "המראה מצמצת… ואז מחייכת בערמומיות."
};

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
// POST /api/tts { text: string, voice?: string }
// Returns MP3 audio bytes (~200-250ms latency vs 10+ seconds with Gemini)
app.post("/api/tts", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "Missing 'text'." });

    // Valid OpenAI TTS voices
    const OPENAI_TTS_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

    // Validate voice - default to onyx if invalid (handles old "enceladus" from cached frontend)
    const requestedVoice = String(req.body?.voice || TTS_VOICE || "onyx").toLowerCase();
    const voice = OPENAI_TTS_VOICES.includes(requestedVoice) ? requestedVoice : "onyx";
    const model = TTS_MODEL || "tts-1"; // tts-1 = fast, tts-1-hd = higher quality

    console.log(`[TTS] OpenAI request: model=${model}, voice=${voice}, text length=${text.length}`);

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        input: text,
        voice: voice,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`OpenAI TTS error ${response.status}: ${errText}`);
    }

    const audioBuffer = await response.arrayBuffer();

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(Buffer.from(audioBuffer));

  } catch (e) {
    console.error("Error in /api/tts:", e?.message || e);
    res.status(502).json({ error: "tts failed" });
  }
});
// -------------------- Compass text analysis (LLM) ------------
app.post("/api/compass-analyze", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
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
      model: "gemini-2.5-flash",
      temperature: 0.2,
      fallback: [],
    });

    return res.json({ items: Array.isArray(items) ? items : [] });
  } catch (e) {
    console.error("Error in /api/compass-analyze:", e?.message || e);
    return res.status(502).json({ items: [] });
  }
});
/// -------------------- News ticker (LLM) ----------------------------
app.post("/api/news-ticker", async (req, res) => {
  try {
    const day = Number(req.body?.day || 1);
    const role = String(req.body?.role || "").trim();
    const systemName = String(req.body?.systemName || "").trim();
    const epochReq = String(req.body?.epoch || "").toLowerCase(); // "modern" | "ancient" | "futuristic" (optional)
    const last = req.body?.last || null; // { title, summary, cost? }

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
    ].join("\n");

    console.log("[news-ticker] Request params:", { day, role: role.slice(0, 50), systemName, mode, epoch });

    const items = await aiJSONGemini({
      system,
      user,
      model: "gemini-2.5-flash",
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
});

// -------------------- Helper: Analyze Political System Type ---------------------------
// Determines how dilemmas should feel based on the political system
function analyzeSystemType(systemName) {
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


/**
 * Strip markdown code block markers from text
 * Handles: ```json, ```, and variations with trailing whitespace/newlines
 *
 * This is critical for Gemini responses which often wrap JSON in markdown blocks
 * with trailing newlines AFTER the closing ``` that break simple regex patterns
 */
function stripMarkdownCodeBlocks(text) {
  if (typeof text !== "string") return text;

  // Method 1: Extract content BETWEEN markdown blocks using capture group
  // This is the most reliable approach - handles any trailing content after ```
  const betweenMatch = text.match(/```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```[\s\S]*$/i);
  if (betweenMatch && betweenMatch[1]) {
    return betweenMatch[1].trim();
  }

  // Method 2: Fallback - strip leading/trailing markers more aggressively
  let result = text.trim();

  // Remove opening: ``` with optional language identifier
  result = result.replace(/^```(?:json|javascript|js)?\s*\n?/i, '');

  // Remove closing: ``` with any trailing content (newlines, whitespace, etc)
  // Using [\s\S]*$ instead of \s*$ to consume ANY content after ```
  result = result.replace(/\n?```[\s\S]*$/i, '');

  return result.trim();
}


/**
 * Strip line (//) and block (/* ... *\/) style comments from a JSON-like string without touching quoted content
 */
function stripJsonComments(text) {
  if (typeof text !== "string" || text.length === 0) return text;

  let result = "";
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inString) {
      result += char;

      if (escapeNext) {
        escapeNext = false;
      } else if (char === "\\") {
        escapeNext = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      result += char;
      continue;
    }

    if (char === "/" && next === "/") {
      i += 1;
      while (i < text.length && text[i] !== "\n") {
        i++;
      }
      if (i < text.length) {
        result += "\n";
      }
      continue;
    }

    if (char === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        i++;
      }
      i++;
      continue;
    }

    result += char;
  }

  return result;
}

/**
 * Normalize control characters in JSON text that would cause parse errors
 * This is a last-resort recovery mechanism for malformed AI responses
 */
function normalizeControlCharacters(text) {
  if (typeof text !== "string") return text;

  // Strategy: Remove literal control characters from within quoted strings
  // while preserving escaped sequences like \n, \t, etc.
  let result = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charCode = text.charCodeAt(i);

    if (inString) {
      if (escapeNext) {
        // Preserve escaped characters
        result += char;
        escapeNext = false;
      } else if (char === '\\') {
        result += char;
        escapeNext = true;
      } else if (char === '"') {
        result += char;
        inString = false;
      } else if (charCode >= 0x00 && charCode <= 0x1F && char !== '\n' && char !== '\r' && char !== '\t') {
        // Remove other control characters in strings
        continue;
      } else if (char === '\n' || char === '\r' || char === '\t') {
        // Replace literal newlines/tabs in strings with space
        result += ' ';
      } else {
        result += char;
      }
    } else {
      // Outside strings, preserve everything including control chars (they're valid JSON structure)
      result += char;
      if (char === '"') {
        inString = true;
      }
    }
  }

  return result;
}

/**
 * Remove trailing commas before closing brackets/braces
 * Fixes common AI JSON generation error: [item,] or {key: value,}
 * Safe for strings - commas inside strings won't be followed by ] or }
 */
function removeTrailingCommas(text) {
  if (typeof text !== "string") return text;
  // Remove commas before ] or } (with optional whitespace)
  return text.replace(/,(\s*[\]\}])/g, '$1');
}

/**
 * Safely parse JSON with fallback extraction
 * Handles markdown code blocks (```json...\n{...}\n```) by extracting content between { }
 */
function safeParseJSON(text, { debugTag = "safeParseJSON", maxLogLength = 400 } = {}) {
  if (typeof text !== "string") {
    console.warn(`[${debugTag}] Non-string input provided to JSON parser (type=${typeof text}).`);
    return null;
  }

  // Strip markdown code blocks first (Gemini often wraps JSON in ```json ... ```)
  const stripped = stripMarkdownCodeBlocks(text);
  if (stripped !== text) {
    console.log(`[${debugTag}] Stripped markdown code blocks from response`);
    text = stripped;
  }

  const logFailure = (stage, error, sample) => {
    const snippet = sample && sample.length > maxLogLength ? `${sample.slice(0, maxLogLength)}…` : sample;
    console.warn(`[${debugTag}] JSON parse failed at stage=${stage}: ${error?.message || error}`);
    if (snippet) {
      console.warn(`[${debugTag}] snippet (${snippet.length || 0} chars): ${snippet}`);
    }
  };

  const tryParse = (input, stageLabel) => {
    if (typeof input !== "string") return null;
    try {
      return JSON.parse(input);
    } catch (err) {
      logFailure(stageLabel, err, input);
      return null;
    }
  };

  // Attempt 1: Direct parse
  const direct = tryParse(text, "1-direct");
  if (direct) return direct;

  // Attempt 2: Strip comments and retry
  const cleaned = stripJsonComments(text);
  if (cleaned && cleaned !== text) {
    const parsedClean = tryParse(cleaned, "2-strip-comments");
    if (parsedClean) return parsedClean;
  }

  // Attempt 3: Remove trailing commas and retry
  const noTrailing = removeTrailingCommas(text);
  if (noTrailing !== text) {
    const parsedNoTrailing = tryParse(noTrailing, "3-remove-trailing-commas");
    if (parsedNoTrailing) return parsedNoTrailing;
  }

  // Attempt 4: Strip comments + remove trailing commas
  const cleanedNoTrailing = removeTrailingCommas(cleaned || text);
  if (cleanedNoTrailing !== (cleaned || text)) {
    const parsedCleanNoTrailing = tryParse(cleanedNoTrailing, "4-comments+trailing");
    if (parsedCleanNoTrailing) return parsedCleanNoTrailing;
  }

  // Attempt 5: Normalize control characters
  const normalized = normalizeControlCharacters(cleanedNoTrailing || cleaned || text);
  if (normalized !== (cleanedNoTrailing || cleaned || text)) {
    const parsedNormalized = tryParse(normalized, "5-normalized-control-chars");
    if (parsedNormalized) return parsedNormalized;
  }

  // Attempt 6: All repairs combined (comments + trailing + control chars)
  const fullyRepaired = normalizeControlCharacters(removeTrailingCommas(stripJsonComments(text)));
  if (fullyRepaired !== text && fullyRepaired !== normalized) {
    const parsedFully = tryParse(fullyRepaired, "6-all-repairs-combined");
    if (parsedFully) return parsedFully;
  }

  // Attempt 7: Extract braces and retry with repairs
  const fallbackSource = normalized || cleanedNoTrailing || cleaned || text;
  const match = typeof fallbackSource === "string" ? fallbackSource.match(/\{[\s\S]*\}/) : null;
  if (match) {
    const parsedFallback = tryParse(match[0], "7-fallback-braces");
    if (parsedFallback) return parsedFallback;
  }

  // Attempt 8: Fallback braces + all repairs
  if (match) {
    const candidate = stripJsonComments(match[0]);
    const candidateNoTrailing = removeTrailingCommas(candidate);
    const candidateNormalized = normalizeControlCharacters(candidateNoTrailing);
    const parsedFallbackRepaired = tryParse(candidateNormalized, "8-fallback+all-repairs");
    if (parsedFallbackRepaired) return parsedFallbackRepaired;
  } else {
    console.warn(`[${debugTag}] No JSON object detected using fallback brace extraction.`);
  }

  return null;
}



// --- Validate "Suggest your own" (relevance to the current dilemma) ---
app.post("/api/validate-suggestion", async (req, res) => {
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
      roleScope = ""
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

    // Use Gemini for validation (gemini-2.5-flash)
    console.log(`[validate-suggestion] Using Gemini model: ${MODEL_VALIDATE_GEMINI}`);
    const raw = await aiJSONGemini({
      system,
      user,
      model: MODEL_VALIDATE_GEMINI,
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
});

app.post("/api/dynamic-parameters", async (req, res) => {
  try {
    const {
      lastChoice, // DilemmaAction: { id, title, summary, cost, iconHint }
      politicalContext, // { role, systemName, day, totalDays, compassValues }
      debug = false
    } = req.body;

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

Set tone as "up" (positive/green), "down" (negative/red), or "neutral" (blue) based on whether this is generally good or bad for the player's position.`;

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
        model: "gemini-2.5-flash",
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

      attempts += 1;

      if (debug) {
        console.log("[/api/dynamic-parameters] Forbidden text detected, retrying generation");
      }

      if (attempts >= 2) {
        parameters = mapped.filter(param => !hasForbiddenDynamicText(param.text));
      }
    }

    if (debug) {
      console.log("[/api/dynamic-parameters] OUT:", parameters);
    }

    return res.json({ parameters });

  } catch (e) {
    console.error("Error in /api/dynamic-parameters:", e?.message || e);
    return res.status(502).json({ parameters: [] });
  }
});

// -------------------- Aftermath generation (game conclusion) --
app.post("/api/aftermath", async (req, res) => {
  try {
    const {
      gameId,
      playerName,
      role,
      setting,
      systemName,
      dilemmaHistory,
      finalSupport,
      topCompassValues,
      debug,
      language = 'en' // Get language from client (default: English)
    } = req.body || {};

    if (debug) {
      console.log("[/api/aftermath] Request received:", {
        gameId,
        playerName,
        role,
        setting,
        systemName,
        historyLength: dilemmaHistory?.length,
        finalSupport,
        topCompassValues,
        language
      });
    }

    // Helper to escape control characters that would break JSON parsing
    const sanitizeText = (text) => {
      if (!text) return "";
      return String(text)
        // Replace literal newlines with space
        .replace(/\r?\n/g, ' ')
        // Replace tabs with space
        .replace(/\t/g, ' ')
        // Remove other control characters (0x00-0x1F except space)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
        // Normalize multiple spaces to single space
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Build system prompt using EXACT text from user's preliminary plan
    const languageCode = String(language || "en").toLowerCase();
    const languageName = LANGUAGE_NAMES[languageCode] || LANGUAGE_NAMES.en;
    const system = `PLAYER ROLE & CONTEXT:
- Setting: ${setting || role || "Unknown Setting"}
- Player Role: ${role || "Unknown Role"}
- Political System: ${systemName || "Unknown System"}

STYLE & TONE
Write in clear, vivid, reflective language; no jargon or game terms.
Tone: ironic-cinematic, like a historical epilogue (Reigns, Frostpunk, Democracy 3).
Accessible for teens; mix wit with weight.
Use roles/descriptions, not obscure names.
${languageCode !== 'en' ? `\n\nWrite your response in ${languageName}. Use proper grammar and natural phrasing appropriate for ${languageName} speakers.` : ''}

CONTENT
Generate an in-world epilogue for the leader based on their decisions, outcomes, supports, and values.
Follow this structure:

Intro: Write an opening sentence about the player's death. Use their actual name and role. Vary the time span realistically (NOT always 7 years)—could be months, years, or decades depending on the setting and events. Choose a fitting cause of death based on the role, era, and story.

Snapshot: Analyze all 7 decisions for EXTREME consequences. Generate 6-10 dramatic events representing the most significant impacts (both positive and negative). For each event:
- type: "positive" or "negative"
- icon: single emoji (⚔️ 🏥 💀 🏛️ 🔥 📚 ⚖️ 💰 🌾 🗡️ etc.)
- text: 3-6 words, extremely dramatic and concise. these can include numeric estimates, try to make them realistic based on current role and setting.
- context: brief mention of which decision/day caused this

Examples:
- War declared → {"type": "negative", "icon": "⚔️", "text": "15,000 deaths in Spartan war", "context": "Day 3: Rejected peace"}
- Healthcare reform → {"type": "positive", "icon": "🏥", "text": "340,000 citizens gain medical access", "context": "Day 5: Medical reform"}
- Famine → {"type": "negative", "icon": "🌾", "text": "8,500 famine deaths from blockade", "context": "Day 4: Trade sanctions"}
- Infrastructure → {"type": "positive", "icon": "🌾", "text": "800 acres of new farmland", "context": "Day 6: Agricultural reform"}
- Riots → {"type": "negative", "icon": "🔥", "text": "47 buildings burned in riots", "context": "Day 2: Tax increase"}
- New government → {"type": "positive", "icon": "🏛️", "text": "Democratic assembly founded", "context": "Day 2: Constitutional reform"}

Use realistic historical estimates based on the era and population. Prioritize MAGNITUDE over balance—show only the most extreme events. Use mixed approach: numbers for quantifiable events (wars, deaths, people saved), vivid descriptions for qualitative changes (new institutions, cultural shifts).

Decisions: for each decision, provide:
- title: ≤12-word summary of the action taken
- reflection: one SHORT sentence (~15-25 words) that EXPLAINS WHY this specific decision demonstrates support for or opposition to autonomy/heteronomy AND liberalism/totalism. Be concrete and educational—describe what aspect of the decision shows the ideological position rather than just stating the rating.
- autonomy: rate THIS SPECIFIC DECISION on autonomy (very-low|low|medium|high|very-high)
- liberalism: rate THIS SPECIFIC DECISION on liberalism (very-low|low|medium|high|very-high)
- democracy: rate THIS SPECIFIC DECISION on democracy (very-low|low|medium|high|very-high)

${getTheoryPrompt()}RATING FRAMEWORK (use the theoretical frameworks above for detailed guidance):

1. Autonomy ↔ Heteronomy (Who decides?)
   - High Autonomy: Self-direction, owned reasons ("I choose because…"), empowering individual/group choice, decentralized decision-making, willingness to accept responsibility for consequences.
   - Low Autonomy (Heteronomy): External control, borrowed reasons ("because they/it says so"), imposed rules, top-down mandates, frequent delegation or obedience without personal justification.

2. Liberalism ↔ Totalism (What's valued?)
   - High Liberalism: Individual rights, pluralism, tolerance, protecting freedoms, narrow and proportionate limits justified by concrete harms, acceptance of multiple legitimate ways to live.
   - Low Liberalism (Totalism): Uniformity, order or virtue over freedom, suppressing dissent, enforcing one thick moral/ideological code as the proper way to live, broad or indefinite restrictions on expression and lifestyle.

3. Democracy ↔ Oligarchy (Who authors the rules and exceptions?)
   - High Democracy: Broad and inclusive authorship of rules and exceptions (citizens, assemblies, representative bodies), real checks and vetoes (courts, elections, free media), shocks handled through shared procedures rather than personal rule.
   - Low Democracy (Oligarchy): Concentrated control of rules and exceptions in a narrow elite (executive, generals, party, oligarchs), weak or neutralized checks, people treated as a mass to be managed rather than co-authors of decisions.

Examples of good decision entries:
- title: "Deploy troops to quell uprising"
  reflection: "Forceful crackdown demonstrates heteronomy (external control) and totalism (prioritizing order over individual freedoms)"
  autonomy: "very-low"
  liberalism: "very-low"
  democracy: "very-low"

- title: "Hold public referendum on reforms"
  reflection: "Consulting citizens shows autonomy (empowering individual choice) and moderate liberalism (deliberative, slower process)"
  autonomy: "high"
  liberalism: "medium"
  democracy: "very-high"

- title: "State-controlled ceremony with some dissent allowed"
  reflection: "Tightly controlled ceremony reflects heteronomy (state choreography) and liberalism (order without suppressing dissent)"
  autonomy: "low"
  liberalism: "medium"
  democracy: "low"

IMPORTANT: The frontend will calculate overall ratings by averaging all 7 decision ratings. DO NOT provide overall ratings.

Values Summary: one sentence capturing main motivations, justifications, means, and who benefited.

Legacy: Generate one vivid, historically resonant sentence capturing how the player will be remembered. Format: "You will be remembered as [legacy description]". Base this on all decisions, snapshot events, compass values, and overall impact. Make it specific to their actions, not generic. Consider both their intentions and actual consequences. Examples:
- "You will be remembered as the tyrant who drowned dissent in blood."
- "You will be remembered as the cautious reformer who preserved peace at the cost of progress."
- "You will be remembered as the liberator whose bold vision birthed a new era."

Haiku: a 3-line poetic summary of their reign.

OUTPUT (STRICT JSON)
Return only:

{
  "intro": "",
  "snapshot": [{"type": "positive|negative", "icon": "emoji", "text": "", "estimate": number_optional, "context": ""}],
  "decisions": [{"title": "", "reflection": "", "autonomy": "", "liberalism": "", "democracy": ""}],
  "valuesSummary": "",
  "legacy": "",
  "haiku": ""
}`;

    // Build user prompt with game data
    const compassSummary = (topCompassValues || [])
      .map(cv => `${cv.dimension}:${cv.componentName}(${cv.value})`)
      .join(", ");

    const historySummary = (dilemmaHistory || [])
      .map(entry =>
        `Day ${entry.day}: "${sanitizeText(entry.dilemmaTitle)}" → chose "${sanitizeText(entry.choiceTitle)}" (${sanitizeText(entry.choiceSummary)}). ` +
        `Support after: people=${entry.supportPeople}, middle=${entry.supportMiddle}, mom=${entry.supportMom}.`
      )
      .join("\n");

    // Extract conversation history for richer context (if available)
    let conversationContext = "";
    if (gameId) {
      const conversation = getConversation(gameId);
      if (conversation && conversation.messages && Array.isArray(conversation.messages)) {
        // Get last 15 messages (skip system message, focus on user/assistant exchanges)
        const recentMessages = conversation.messages
          .filter(msg => msg.role === 'user' || msg.role === 'assistant')
          .slice(-15);

        if (recentMessages.length > 0) {
          conversationContext = "\n\nCONVERSATION EXCERPTS (for narrative context):\n" +
            recentMessages.map((msg, idx) => {
              const role = msg.role === 'user' ? 'PLAYER' : 'AI';
              const content = typeof msg.content === 'string'
                ? sanitizeText(msg.content).slice(0, 300) // Truncate to 300 chars
                : '[complex content]';
              return `${idx + 1}. ${role}: ${content}${content.length >= 300 ? '...' : ''}`;
            }).join('\n');

          if (debug) {
            console.log(`[/api/aftermath] Including ${recentMessages.length} conversation messages for context`);
          }
        }
      }
    }

    const user = `PLAYER: ${playerName || "Unknown Leader"}
ROLE: ${role || "Unknown Role"}
SYSTEM: ${systemName || "Unknown System"}

FINAL SUPPORT:
- People: ${finalSupport?.people ?? 50}%
- Middle (main power holder): ${finalSupport?.middle ?? 50}%
- Mom (personal allies): ${finalSupport?.mom ?? 50}%

TOP COMPASS VALUES:
${compassSummary || "None"}

DECISION HISTORY:
${historySummary || "No decisions recorded"}${conversationContext}

Generate the aftermath epilogue following the structure above. Return STRICT JSON ONLY.${languageCode !== 'en' ? `\n\nWrite your response in ${languageName}.` : ''}`;

    // Call AI with Gemini model
    // No fallback - let errors propagate so frontend can show retry button
    const messages = [
      { role: "system", content: system },
      { role: "user", content: user }
    ];
    const aiResponse = await callGeminiChat(messages, "gemini-2.5-flash");
    const result = aiResponse?.content ? safeParseJSON(aiResponse.content, { debugTag: "aftermath-gemini" }) : null;

    if (debug) {
      console.log("[/api/aftermath] AI response:", result);
    }

    // Normalize and validate response
    const validRatings = ["very-low", "low", "medium", "high", "very-high"];
    const validTypes = ["positive", "negative"];

    // Fallback values when AI returns null or incomplete data
    const fallback = {
      intro: "After many years of rule, the leader passed into history.",
      snapshot: [
        { type: "positive", icon: "🏛️", text: "Governed their people", context: "Overall reign" },
        { type: "negative", icon: "⚠️", text: "Faced challenges", context: "Overall reign" }
      ],
      decisions: [],
      valuesSummary: "A leader who navigated complex political terrain.",
      haiku: "Power came and went\nDecisions echo through time\nHistory records"
    };

    // Detect if we're using fallback data (AI failed or returned incomplete response)
    const isFallback = result === null || !Array.isArray(result?.decisions) || result.decisions.length === 0;

    const response = {
      isFallback,
      intro: String(result?.intro || fallback.intro).slice(0, 500),
      snapshot: Array.isArray(result?.snapshot)
        ? result.snapshot.map((event) => ({
            type: validTypes.includes(event?.type) ? event.type : "positive",
            icon: String(event?.icon || "📌").slice(0, 10),
            text: String(event?.text || "Event occurred").slice(0, 50),
            estimate: typeof event?.estimate === 'number' ? event.estimate : undefined,
            context: String(event?.context || "Unknown").slice(0, 100)
          }))
        : fallback.snapshot,
      decisions: Array.isArray(result?.decisions)
        ? result.decisions.map((d, i) => ({
            title: String(d?.title || "").slice(0, 120),
            reflection: String(d?.reflection || "").slice(0, 300),
            autonomy: validRatings.includes(d?.autonomy) ? d.autonomy : "medium",
            liberalism: validRatings.includes(d?.liberalism) ? d.liberalism : "medium",
            democracy: validRatings.includes(d?.democracy) ? d.democracy : "medium"
          }))
        : fallback.decisions,
      valuesSummary: String(result?.valuesSummary || fallback.valuesSummary).slice(0, 500),
      haiku: String(result?.haiku || fallback.haiku).slice(0, 300)
    };

    return res.json(response);

  } catch (e) {
    console.error("Error in /api/aftermath:", e?.message || e);
    return res.status(502).json({
      isFallback: true,
      intro: "After many years of rule, the leader passed into history.",
      snapshot: [
        { type: "positive", icon: "🏛️", text: "Governed their people", context: "Overall reign" },
        { type: "negative", icon: "⚠️", text: "Faced challenges", context: "Overall reign" }
      ],
      decisions: [],
      valuesSummary: "A leader who navigated complex political terrain.",
      haiku: "Power came and went\nDecisions echo through time\nHistory records"
    });
  }
});

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
app.post("/api/narrative-seed", async (req, res) => {
  try {
    const { gameId, gameContext } = req.body;

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
      model: "gemini-2.5-flash",
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
});

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
app.post("/api/inquire", async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("❓ [INQUIRY] /api/inquire called");
    console.log("========================================\n");

    const { gameId, question, currentDilemma, day } = req.body;
    const useXAI = !!req.body?.useXAI;
    const useGemini = !!req.body?.useGemini;

    // Validation
    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({ error: "Missing or invalid gameId" });
    }

    if (!question || typeof question !== 'string' || question.trim().length < 5) {
      return res.status(400).json({ error: "Missing or invalid question (min 5 characters)" });
    }

    if (!currentDilemma || !currentDilemma.title || !currentDilemma.description) {
      return res.status(400).json({ error: "Missing or invalid currentDilemma" });
    }

    if (!day || typeof day !== 'number') {
      return res.status(400).json({ error: "Missing or invalid day" });
    }

    console.log(`[INQUIRY] gameId=${gameId}, day=${day}`);
    console.log(`[INQUIRY] question="${question.substring(0, 100)}..."`);

    // Retrieve conversation
    const conversation = getConversation(gameId);
    if (!conversation) {
      console.warn(`[INQUIRY] ⚠️ Conversation not found or expired for gameId=${gameId}`);
      return res.status(404).json({
        error: "Game session expired",
        answer: "Your game session has expired. Please restart the game."
      });
    }

    const messages = conversation.meta?.messages || [];

    // Extract role context from conversation metadata
    const { role, systemName, challengerName, authorityLevel } = conversation.meta || {};

    console.log(`[INQUIRY] Role context: role="${role}", system="${systemName}", authority="${authorityLevel}", challenger="${challengerName}"`);

    // Add player inquiry to conversation history with clear tagging
    const userMessage = {
      role: "user",
      content: `[INQUIRY - Day ${day}] Regarding "${currentDilemma.title}": ${question.trim()}`
    };
    messages.push(userMessage);

    console.log(`[INQUIRY] Added user inquiry to conversation (${messages.length} total messages)`);

    // System prompt for answering inquiries - uses Game Master voice
    const systemPrompt = `You are the Game Master answering a player's question about the current political situation.

GAME MASTER PERSONA:
You are a mysterious, amused Game Master who watches the player's journey through this simulation.
Style: Knowledgeable, playful, slightly teasing, always aware of the player's situation.

PLAYER CONTEXT:
- Role: ${role || "Unknown role"}
- Political System: ${systemName || "Unknown system"}
- Authority Level: ${authorityLevel || "medium"} (high = dictator/monarch can decree unilaterally, medium = oligarch/executive needs some support, low = citizen/weak has limited direct power)
- Main Challenger: ${challengerName || "Opposition"}

CURRENT SITUATION:
- Dilemma Title: ${currentDilemma.title}
- Dilemma Description: ${currentDilemma.description}

CRITICAL GUIDELINES:
- Answer in the Game Master voice: knowledgeable, playful, slightly teasing
- Maximum 2 sentences - be concise and engaging

LANGUAGE RULES:
- Simple English for non-native speakers
- NO metaphors ("dark cloud", "storm brewing", "shadows grow")
- NO poetic phrasing ("lingering unease", "whispers swirling")
- Use direct concrete language ("Citizens protest", "Food is scarce")
- Ground your answer in the player's ROLE, SYSTEM, and AUTHORITY LEVEL
- Consider what is realistic and possible for their position and setting
- DO NOT reveal hidden consequences of specific actions
- DO NOT tell them which action to choose
- Focus on clarifying the situation, stakeholder perspectives, or context
- You're the omniscient Game Master - you know what's happening behind the scenes

Examples of GOOD answers (Game Master voice - playful, knowing, role-aware):
"Ah, the workers remember your broken promises from last year quite vividly. They want better pay, or they'll show you what real unrest looks like."
"Most of the city supports the strike — but the merchants and your generals? They're sharpening their knives for you."
"You can propose this to the Assembly, but whether those old foxes listen depends on how much they fear or respect you right now." (low authority)
"You have the power to decree this on a whim — though I wonder if you've thought about who'll remember, and who'll act on that memory." (high authority)

Examples of BAD answers (too formal, breaks Game Master voice):
"The labor faction is experiencing dissatisfaction due to unfulfilled commitments regarding compensation restructuring."
"There exists a bifurcation in public opinion across socioeconomic strata regarding this labor dispute."
"Based on historical analysis, the workers are motivated by economic factors."

Remember: Game Master voice (playful, knowing), 2 sentences max, natural language, role-appropriate.`;

    // Get AI response using Gemini
    let answer;
    try {
      const aiMessages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: question.trim() }
      ];
      const response = await callGeminiChat(aiMessages, "gemini-2.5-flash");
      answer = response.content;
      console.log(`[INQUIRY] Using Gemini provider (gemini-2.5-flash)`);

      console.log(`[INQUIRY] AI answer: "${answer.substring(0, 100)}..."`);
    } catch (aiError) {
      console.error("[INQUIRY] ❌ AI call failed:", aiError?.message || aiError);
      return res.status(500).json({
        error: "Failed to generate answer",
        answer: "The advisor is unavailable right now. Please try again."
      });
    }

    // Add AI response to conversation history
    const assistantMessage = {
      role: "assistant",
      content: answer
    };
    messages.push(assistantMessage);

    // Update conversation store - CRITICAL: Store in meta.messages for integration with game-turn-v2
    conversation.meta.messages = messages;
    conversation.lastUsedAt = Date.now();
    conversation.turnCount = (conversation.turnCount || 0) + 1;

    console.log(`[INQUIRY] ✅ Successfully answered inquiry (${messages.length} total messages)`);
    console.log(`[INQUIRY] 📝 Inquiry Q&A appended to conversation.meta.messages for stateful integration`);

    return res.json({ answer });

  } catch (error) {
    console.error("[INQUIRY] ❌ Unexpected error:", error);
    return res.status(500).json({
      error: "Failed to process inquiry",
      answer: "The advisor is unavailable right now. Please try again."
    });
  }
});

// ==================== V2 SYSTEM: NEW HELPERS ====================
// Clean-slate dilemma generation system with Game Master voice

/**
 * Extract challenger name from challengerSeat string
 * Example: "Sparta (Coercive Force)" → "Sparta"
 */
function extractChallengerName(challengerSeat) {
  if (!challengerSeat || typeof challengerSeat !== 'string') {
    return 'Unknown Challenger';
  }

  const match = challengerSeat.match(/^([^(]+)/);
  return match ? match[1].trim() : challengerSeat.trim();
}

/**
 * Calculate authority level from E-12 analysis
 * Maps detailed E-12 to simple high/medium/low classification
 *
 * @param {Object} e12 - E-12 framework data
 * @param {Array} powerHolders - Array of power holders
 * @param {number} playerIndex - Index of player in powerHolders
 * @param {string} roleScope - Optional role description for semantic override
 * @returns {string} 'high' | 'medium' | 'low'
 */
function calculateAuthorityLevel(e12, powerHolders, playerIndex, roleScope = null) {
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
      console.log('[calculateAuthorityLevel] Citizen role detected via roleScope - forcing LOW authority');
      console.log(`[calculateAuthorityLevel] Matched roleScope: "${roleScope.substring(0, 80)}..."`);
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
function convertSupportShiftToDeltas(supportShift, currentSupport) {
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
      console.warn(`[SUPPORT-SHIFT] Skipping unexpected entity: ${entity}`);
      continue;
    }

    // Check if mom died
    if (entity === 'mom') {
      const isDead = shift.attitudeLevel === 'dead' || shift.momDied === true;
      if (isDead) {
        deltas.momDied = true;
        deltas.mom.delta = -(currentSupport.mom || 50);
        deltas.mom.why = shift.shortLine || "Mom has passed away";
        console.log(`[SUPPORT-SHIFT] 💀 MOM DIED: ${shift.shortLine}`);
        continue;
      }
    }

    const range = REACTION_RANGES[shift.attitudeLevel];

    if (!range) {
      console.warn(`[SUPPORT-SHIFT] Unknown attitude level: ${shift.attitudeLevel}`);
      deltas[entity].delta = 0;
      deltas[entity].why = shift.shortLine || "";
      continue;
    }

    // Random integer between min and max (inclusive)
    const randomDelta = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

    // Apply support caps (0-100 range)
    const currentValue = currentSupport[entity] || 50;
    const newValue = currentValue + randomDelta;
    const cappedValue = Math.max(0, Math.min(100, newValue));
    const actualDelta = cappedValue - currentValue;

    deltas[entity].delta = actualDelta;
    deltas[entity].why = shift.shortLine || "";

    console.log(`[SUPPORT-SHIFT] ${entity}: ${shift.attitudeLevel} → random delta ${randomDelta} → actual delta ${actualDelta} (${currentValue} → ${cappedValue})`);
  }

  return deltas;
}

/**
 * Process dynamic parameters - simple passthrough with max 3 limit
 * No validation - trust AI output completely
 */
function processDynamicParams(params) {
  if (!params || params.length === 0) {
    console.log('[DYNAMIC-PARAMS] No params provided by AI');
    return []; // Allow empty
  }

  // Just enforce max 3 params, no other validation
  const processed = params.slice(0, 3);
  console.log(`[DYNAMIC-PARAMS] Received ${params.length} params, returning ${processed.length}`);
  return processed;
}

/**
 * Sanitize dilemma response - basic cleanup only
 */
function sanitizeDilemmaResponse(rawResponse) {
  if (!rawResponse || typeof rawResponse !== 'object') {
    return null;
  }

  const sanitized = {
    ...rawResponse,
    dilemma: rawResponse.dilemma || {},
    actions: rawResponse.actions || []
  };

  // Ensure actions array has exactly 3 items
  if (sanitized.actions.length !== 3) {
    console.warn(`[SANITIZE] Expected 3 actions, got ${sanitized.actions.length}`);
  }

  return sanitized;
}

// ==================== V2 SYSTEM: UNIFIED PROMPT BUILDERS ====================

/**
 * Build unified Game Master system prompt (sent ONCE on Day 1)
 * Focused, short prompt with essential rules only
 */
function buildGameMasterSystemPromptUnified(gameContext, languageCode = 'en', languageName = 'English') {
  const {
    role,
    systemName,
    setting,
    challengerName,
    powerHolders,
    authorityLevel,
    playerCompassTopValues
  } = gameContext;

  // Get top 5 power holders only
  const top5PowerHolders = powerHolders.slice(0, 5);

  // Format compass values for prompt
  const compassText = playerCompassTopValues.map(dim =>
    `  - ${dim.dimension}: ${dim.values.join(', ')}`
  ).join('\n');

  // Log compass values for mirror advice debugging
  console.log("[game-turn-v2] Player compass values received:", playerCompassTopValues);
  console.log("[game-turn-v2] Formatted compassText for prompt:\n" + compassText);

  const prompt = `0. GAME MASTER PERSONA

You are the Game Master of a historical-political simulation.
You speak directly to the player as "you".
Tone: amused, observant, challenging, slightly teasing, but always clear.
Use simple ${languageCode === 'en' ? 'English' : languageName} (CEFR B1-B2).
Short sentences (8-16 words).
No metaphors, no poetic phrasing, no idioms, no fancy adjectives.
Your job is to TEST the player's values by creating specific moral traps based on their compass, while making them feel what it is like to be this exact person in this exact historical moment.
${languageCode !== 'en' ? `\n\nWrite your response in ${languageName}. Use proper grammar and natural phrasing appropriate for ${languageName} speakers.` : ''}

1. CORE IDENTITY OF THE PLAYER

The player's ability to act comes ONLY from these fields:

Role: ${role}
Authority Level: ${authorityLevel}
  - high = ruler, general, chief, monarch
  - medium = council member, minister, influential elite
  - low = citizen, commoner, minor official
Setting: ${setting}
System: ${systemName}
Main Challenger: ${challengerName}

Top Power Holders:
${top5PowerHolders.map(ph => `  - ${ph.name} (${ph.type}, power: ${ph.power}%)`).join('\n')}

Player Values (Target these for dilemmas):
${compassText}

You must respect all of them strictly.
When you judge actions or reactions, you must think from inside this setting's values, not from 21st-century Western morality.

1.1 AXIS DEFINITIONS (Use these to categorize the dilemma and actions)

1. Autonomy ↔ Heteronomy (Who decides?)
   - High Autonomy: Self-direction, owned reasons ("I choose because…"), empowering individual choice, accepting personal blame.
   - Low Autonomy (Heteronomy): External control, borrowed reasons ("The law says so"), obedience, delegation to superiors.

2. Liberalism ↔ Totalism (What's valued?)
   - High Liberalism: Individual rights, tolerance, protecting the exception.
   - Low Liberalism (Totalism): Uniformity, order, suppressing dissent, enforcing one strict code.

3. Democracy ↔ Oligarchy
   - High Democracy: Shared authorship, inclusivity.
   - Low Democracy: Elite control, exclusion.

2. GOLDEN RULE A — THE VALUE TRAP + ROLE-TRUE DILEMMAS

Every dilemma must:
a) Force a conflict between the player's VALUES and their INTERESTS/SAFETY
b) Match the actual life of the player's role
c) Be engaging, meaningful and thought provoking

THE VALUE TRAP LOGIC:
1. Pick a value from the player's list (e.g., Truth, Freedom, Loyalty).
2. Create a situation where upholding that value forces a terrible personal cost.
   - Example (Value: Truth): Your sister stole the tax money. If you tell the Truth, she is hanged. If you Lie, you save her but betray your value.
   - Example (Value: Freedom): A plague carrier demands to leave the city. If you respect Freedom, the city dies. If you detain him, you become a tyrant.

Dilemmas must be engaging, meaningful and thought provoking.

THE CAMERA TEST (STRICT):

You MUST NEVER describe "tensions," "debates," "atmosphere," or "unease."
If a movie camera cannot record it, DO NOT WRITE IT.

BAD (Abstract): "Tensions are high and people are debating the new laws."
GOOD (Concrete): "A rock crashes through your window. A mob of hungry weavers is chanting your name outside."

Every dilemma MUST be a specific "Inciting Incident" happening RIGHT NOW:

A) A specific person/group (Name them: "Your brother," "The Baker's Guild," "General Kael")
B) Doing a specific physical action (Blocking a road, stealing a cow, arresting a priest)
C) Forcing an immediate choice (Not "how will you balance this," but "Do you arrest them or join them?")

GOOD: "At dawn, twenty soldiers block the city gate and refuse to let traders enter."
BAD: "Tensions rise in the city and people are uneasy."

Each set of 3 actions must also be concrete:
- not "manage the crisis" or "respond to the challenge"
- but "close the city gates", "lower the grain tax", "summon the council", "publicly punish the captain", etc.

AUTHORITY LEVEL CONSTRAINTS (CRITICAL):

If the player is LOW authority (citizen, commoner):
MUST give dilemmas about:
- family hardship, food shortage, debt, illness
- disputes with neighbours
- pressure from elites or soldiers
- how to vote, protest, persuade, or organize
- whether to join a demonstration
- whether to risk punishment to resist

MUST NOT give dilemmas like:
- "Move the army"
- "Choose a military strategy"
- "Guide the people"
- "Decide the fate of the city"
- "Accept or reject a treaty"
Instead: "argue for...", "petition for...", "vote on..."

If the player is MEDIUM authority:
Give dilemmas about:
- persuading councils, negotiating, building alliances
- influencing military or civic decisions
- balancing factions
NOT about direct military command unless historically plausible.

If the player is HIGH authority:
May give dilemmas about:
- war, peace, taxes, decrees, trials
- commanding troops, diplomacy, executions
But MUST still include personal risks, family tensions, court intrigue.


3. GOLDEN RULE B — FAST PLOT PROGRESSION (STRICT)

    From Day 2 onward:

    a. HARD RULE — No repetition of the same tension:
      Do NOT give two consecutive days about the same underlying issue.
      Example: if yesterday was about war or war-preparation in ANY form, today MUST NOT be about war, battles, troops, ambushes, scouting enemies, or reacting to the same threat.

    b. Mandatory angle shift:
      Each new day must come from a different human angle:
      personal, family, economic, religious, social, political, health, environmental, or internal power struggles.

    c. War, diplomacy, famine, plague, succession, rebellion, unrest, and resource crises are ALL separate tension types.
      Never stay on the same type two days in a row.

    d. You may mention yesterday's situation in ONE short bridging sentence, but today's problem must be NEW and DIFFERENT.


3.1 GOLDEN RULE C — THE AXIS OF ACTION

The 3 action options must implicitly explore the AUTONOMY vs. HETERONOMY axis:

- Action 1 (High Autonomy/Risk): The player acts on their own authority. They say "I decide." They break protocol or take a personal risk to do what feels right.
- Action 2 (Heteronomy/Safety): The player follows the rules, obeys a superior, delegates the decision, or hides behind "the law." They say "I had no choice."
- Action 3 (Transactional/Pragmatic): A compromise or corruption. Solving the problem by paying a cost or making a dirty deal.

Ensure all actions are specific physical deeds (arrest, pay, scream, sign), not abstract concepts ("manage the situation").

4. HISTORICAL REALISM (OVERRIDES MODERN MORALITY)

This rule is HIGH PRIORITY. It applies to EVERYTHING:
- dilemmas and action options
- supportShift reactions (people, holders, mom)
- mirrorAdvice tone

All reactions must match the actual culture and moral norms of the historical setting, NOT modern Western values.

Always anchor your judgment in:
- Setting: ${setting}
- System: ${systemName}
- Role + Authority: ${role}, ${authorityLevel}

Ask: "Would people here see this as normal, risky, sacred, shameful, clever, or cowardly?"

Default pattern:
- If an action is COMMON OR EXPECTED for this era (e.g. taking captives in war, public beatings, harsh punishments):
  - Treat it as normal, maybe risky or controversial
  - People may debate strategy or spiritual consequences
  - Do NOT have everyone act shocked just because of violence.
- Only show strong moral outrage ("this is cruel/evil") when the action breaks THEIR core taboos
  (e.g. betraying guests, harming kin, violating sacred places or oaths).

Examples of period-appropriate norms (non-exhaustive):
- Public beatings may be normal
- Blood feuds may be respected
- Oaths may be sacred
- Collective punishment may be routine
- Torture may be common
- Mercy may be rare

"Mom", "people", and "holders" must sound like members of this culture.
They may worry about retaliation, honor, spirits, or lost trade — not abstract modern human-rights language.


5. MOM DEATH RULES
- Mom CAN die from extreme player actions (war, plague, assassination, executing family, etc.)
- When mom dies: set attitudeLevel="dead", momDied=true, shortLine="brief death description"
- If player action explicitly targets/kills mom (e.g., "Murder my mother", "Execute my family"), she MUST die
- Death is rare but dramatically appropriate to severe actions
- Once dead in this turn, the UI will handle hiding her in future turns


6. DAY STRUCTURE

Day 1:
- One urgent situation
- NO supportShift / dynamicParams
- Provide mirrorAdvice

Day 2-6:
- New situation — obey GOLDEN RULE A + B
- 3 actions — each must be something the player, under current role, authority and setting, can realistically do
- supportShift — reactions of people, holders, mom (10-15 words each)
    * All three reactions MUST follow the HISTORICAL REALISM rules (section 4).
    No generic modern pacifist language unless the culture is actually pacifist.
- dynamicParams — 2-3 concrete consequences of most recent player action
  * Emoji icon + brief text (2-4 words)
  * Include numbers when dramatically impactful
  * NEVER about support levels (handled separately)
  * Directly tied to what player did
  Examples:
  * {"icon": "⚔️", "text": "12,000 soldiers mobilized"}
  * {"icon": "🤒", "text": "2,345 civilians infected"}
  * {"icon": "🚧", "text": "Trade routes blocked"}
- mirrorAdvice — 20-25 words, one value name, dry tone

Day 7:
- Generate a climatic dramatic dilemma that ties in the story so far
- Remind the player their time is ending
- Same schema as Day 2-6

Day 8 (Aftermath):
- actions: [] (no choices)
- Title: "The Aftermath"
- Description: 2-3 vivid sentences wrapping up the story. Show immediate consequences of Day 7's decision. End with a sense of finality—the player's time in this world is over.
- dynamicParams: Show 1-2 impactful final consequences from Day 7.
- Make it memorable: this is the player's last moment before the epilogue.

6. LANGUAGE RULES (STRICT)

Simple English for non-native speakers.
NO metaphors ("dark cloud", "storm brewing", "teetering", "shadows grow").
NO poetic phrasing ("lingering unease", "whispers swirling").

Use direct concrete language:
- "Citizens protest"
- "Food is scarce"
- "Your neighbour accuses you"
- "The Assembly passed a vote"

7. TOPIC / SCOPE / TENSION CLUSTER RULES

You MUST NOT repeat yesterday's exact topic + scope.

In every 3-day window:
- at least 2 different topics
- at least 2 different scopes

Valid topics: Military, Economy, Religion, Diplomacy, Justice, Infrastructure, Politics, Social, Health, Education
Valid scopes: Personal, Local, Regional, National, International

TENSION CLUSTER (MANDATORY):
For "tensionCluster", analyze the dilemma you created and classify it as exactly ONE of:
- ExternalConflict (wars, invasions, foreign threats)
- InternalPower (coups, succession, factions competing for control)
- EconomyResources (trade, famine, treasury, resource scarcity)
- HealthDisaster (plague, natural disasters, epidemics)
- ReligionCulture (faith conflicts, traditions, cultural clashes)
- LawJustice (trials, crimes, rights, legal disputes)
- SocialOrder (riots, class tension, reforms, public unrest)
- FamilyPersonal (marriage, heirs, personal crises, loyalty)
- DiplomacyTreaty (alliances, negotiations, ambassadors)

Each tensionCluster can be used at most 2 times per 7-day game.

MIRROR BRIEFING

The mirror is a cynical, dry-witted observer in FIRST PERSON.
Job: surface tensions between the player's TOP VALUES and the current dilemma.

Rules:
- ALWAYS reference at least ONE specific value from player's "what" or "how" values
- Create tension - show how dilemma challenges or contradicts their stated values
- Never preach - just highlight the contradiction or irony
- IMPORTANT: Do NOT use the exact compass value names (e.g., "Truth/Trust", "Liberty/Agency", "Deliberation"). Instead, paraphrase into natural, conversational language: "your sense of truth", "your love of freedom", "your careful deliberation"
- 1 sentence, 20-25 words, dry/mocking tone

BAD: "I wonder how you'll handle this crisis."
BAD: "Your Truth/Trust is being tested." (uses exact system nomenclature)
GOOD: "Your sense of truth might be a luxury when the crowd demands blood."
GOOD: "I see your careful deliberation — charming, while soldiers bleed."


8. OUTPUT FORMAT

Return ONLY valid JSON. No \`\`\`json fences.

CRITICAL JSON RULES:
- ALWAYS include commas between properties
- NO trailing commas after last property
- Double quotes for all keys and strings
- Properly closed braces and brackets

## DAY 1 SCHEMA:
{
  "dilemma": {
    "title": "Short title (max 120 chars)",
    "description": "Playful Game Master narration addressing the player as 'you', ending with a direct question (1-3 sentences)",
    "actions": [
      {"title": "Action title (2-4 words)", "summary": "One complete sentence explaining what this action does (8-15 words)", "icon": "sword"},
      {"title": "Action title (2-4 words)", "summary": "One complete sentence explaining what this action does (8-15 words)", "icon": "scales"},
      {"title": "Action title (2-4 words)", "summary": "One complete sentence explaining what this action does (8-15 words)", "icon": "coin"}
    ],
    "topic": "Military|Economy|Religion|Diplomacy|Justice|Infrastructure|Politics|Social|Health|Education",
    "scope": "Local|Regional|National|International",
    "tensionCluster": "ExternalConflict|InternalPower|EconomyResources|HealthDisaster|ReligionCulture|LawJustice|SocialOrder|FamilyPersonal|DiplomacyTreaty"
  },
  "mirrorAdvice": "One sentence in FIRST PERSON (20-25 words)",

}


## DAY 2+ SCHEMA:
{
  "supportShift": {
    "people": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed", "shortLine": "Short civic reaction in first person 'we/us' (10-15 words)"},
    "holders": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed", "shortLine": "Short political reaction in first person 'we/us' (10-15 words)"},
    "mom": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed|dead", "shortLine": "Warm personal reaction in FIRST PERSON 'I' (e.g., 'I worry about...', 'I'm proud of...', 'I fear that...') (10-15 words)", "momDied": false}
  },
  "dilemma": {
    "title": "Short title (max 120 chars)",
    "description": "Playful Game Master comment in second person ('you') + new situation + direct question",
    "actions": [
      {"title": "Action title (2-4 words)", "summary": "One complete sentence (8-15 words)", "icon": "..."},
      {"title": "Action title (2-4 words)", "summary": "One complete sentence (8-15 words)", "icon": "..."},
      {"title": "Action title (2-4 words)", "summary": "One complete sentence (8-15 words)", "icon": "..."}
    ],
    "topic": "Military|Economy|Religion|Diplomacy|Justice|Infrastructure|Politics|Social|Health|Education",
    "scope": "Local|Regional|National|International",
    "tensionCluster": "ExternalConflict|InternalPower|EconomyResources|HealthDisaster|ReligionCulture|LawJustice|SocialOrder|FamilyPersonal|DiplomacyTreaty"
  },
  "dynamicParams": [
    {"icon": "🔥", "text": "Dramatic consequence (2-4 words)"}
  ],
  "mirrorAdvice": "FIRST PERSON (20-25 words)",
}

## DAY 8 SCHEMA (Aftermath):
{
  "supportShift": {
    "people": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed", "shortLine": "Short civic reaction in first person 'we/us' (10-15 words)"},
    "holders": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed", "shortLine": "Short political reaction in first person 'we/us' (10-15 words)"},
    "mom": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed|dead", "shortLine": "Warm personal reaction in FIRST PERSON 'I' (e.g., 'I worry about...', 'I'm proud of...', 'I fear that...') (10-15 words)", "momDied": false}
  },
  "dilemma": {
    "title": "The Aftermath",
    "description": "EXACTLY 2 sentences in Game Master voice describing immediate consequences of Day 7 decision",
    "actions": [],
    "topic": "Conclusion",
    "scope": "N/A"
  },
  "dynamicParams": [
    {"icon": "emoji", "text": "Dramatic consequence (2-4 words)"}
  ],
  "mirrorAdvice": "FIRST PERSON reflective sentence (20-25 words)"
}`;

  return prompt;
}

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
function buildGameMasterSystemPromptUnifiedV3(gameContext, languageCode = 'en', languageName = 'English') {
  const {
    role,
    systemName,
    setting,
    challengerName,
    powerHolders,
    authorityLevel,
    playerCompassTopValues
  } = gameContext;

  // Get top 5 power holders only
  const top5PowerHolders = powerHolders.slice(0, 5);

  // Format compass values for prompt (top 8 values: 2 from each category)
  const compassText = playerCompassTopValues.map(dim =>
    `  - ${dim.dimension}: ${dim.values.join(', ')}`
  ).join('\n');

  // Log compass values for debugging
  console.log("[game-turn-v2] [V3] Player compass values received:", playerCompassTopValues);
  console.log("[game-turn-v2] [V3] Formatted compassText for prompt:\n" + compassText);

  const prompt = `0. YOUR MISSION

You are the Game Master of a historical-political simulation.
You speak directly to the player as "you".
Tone: amused, observant, challenging, slightly teasing, but always clear.

LANGUAGE RULES:
- Simple ${languageCode === 'en' ? 'English' : languageName} (CEFR B1-B2), short sentences (8-16 words)
- NO metaphors, poetic phrasing, idioms, or fancy adjectives
- NO technical jargon, academic language, or bureaucratic terms
  BAD: "preliminary audits", "unsanctioned bio-agent trials", "scientific standards demand transparency"
  GOOD: "the inspectors found out", "illegal experiments", "people want answers"
- Use concrete language: "Citizens protest" NOT "tensions rise"
- If a movie camera cannot record it, DO NOT WRITE IT
${languageCode !== 'en' ? `\n\nWrite your response in ${languageName}. Use proper grammar and natural phrasing appropriate for ${languageName} speakers.` : ''}

YOUR MISSION:
Create VALUE TRAPS in the player's PRIVATE LIFE that force them to choose between their stated values and their survival, rooted in the specific details and atmosphere of the setting.


1. PLAYER CONTEXT

Role: ${role}
Authority Level: ${authorityLevel}
  - high = ruler, general, chief, monarch (can command, decree, execute)
  - medium = council member, minister, influential elite (can persuade, negotiate, influence)
  - low = citizen, commoner, minor official (can petition, vote, resist at personal risk)

Setting: ${setting}
System: ${systemName}
Main Challenger: ${challengerName}

Top Power Holders:
${top5PowerHolders.map(ph => `  - ${ph.name} (${ph.type}, power: ${ph.power}%)`).join('\n')}

PLAYER'S INITIAL TOP 8 VALUES (Day 1):
${compassText}

IMPORTANT: For Days 2+, you will receive UPDATED "CURRENT TOP VALUES" in each daily prompt.
These values may shift due to the player's actions and their consequences (compass pills).
ALWAYS use the most recent values provided to ensure maximum personal relevance.


2. THE THREE-STEP PROCESS

Every day, follow this exact process:

─────────────────────────────────────────
STEP 1: SELECT A VALUE TO TRAP
─────────────────────────────────────────

1. Pick ONE value from:
   - Day 1: Use the initial top 8 values listed above
   - Days 2+: Use the CURRENT TOP VALUES provided in today's daily prompt
2. Create a PRIVATE LIFE incident where honoring that value forces a terrible personal cost (safety, family, social acceptance, livelihood).
3. For LOW and MEDIUM authority: MUST focus on personal/family/social dilemmas, NOT grand political decisions.

THE VALUE TRAP FORMULA:
"If you honor [VALUE], you lose [something vital]. If you protect [something vital], you betray [VALUE]."

PRIVATE LIFE FOCUS BY AUTHORITY:

LOW AUTHORITY (Citizen, Commoner):
Focus on: Family decisions, social pressure, personal choices, neighborhood conflicts, religious obligations
Examples:
- Autonomy: "Your mother insists you marry the baker's son. Your heart belongs to another. Obey her or defy tradition?"
- Truth: "Your brother stole grain. The magistrate demands names. Tell the truth and he's punished. Lie and save him."
- Freedom: "The priest demands you fast for seven days. Your children are hungry. Follow his command or feed your family?"
- Loyalty: "Your friend asks you to hide him from the authorities. Help him or protect your family from punishment?"

MEDIUM AUTHORITY (Council Member, Minister):
Focus on: Personal influence, family vs duty, patron demands, guild/council pressures
Examples:
- Autonomy: "Your patron demands you vote for his corrupt nephew. Your conscience says no. Obey or vote freely?"
- Loyalty: "Your wife begs you to use your influence to save her imprisoned brother. Bend rules for family or stay neutral?"
- Equality: "The guild pressures you to exclude foreign traders. Allow diversity or enforce conformity?"

HIGH AUTHORITY (Ruler, General):
MUST STILL include personal stakes: family, assassination, succession, close advisors
Examples:
- Loyalty: "Your general is your childhood friend. He lost the battle. Execute him or spare him and lose the army's respect?"
- Truth: "Your daughter must marry the foreign king for peace. She loves another. Force her or risk war?"
- Honor: "Your brother plots against you. Family loyalty or throne security?"

SETTING-ROOTED DETAILS (CRITICAL):

The value trap logic is universal, but the CONTENT must come from the setting.

Use setting-specific:
- Cultural norms (What's shameful? Sacred? Normal?)
- Social structures (Who has power? Who enforces rules?)
- Material details (What do people eat, wear, trade, fear?)
- Spiritual frameworks (Gods, spirits, ancestors, protocols?)
- Economic systems (Currency, debt, property, resources?)
- Power dynamics (Who can punish? Who decides?)

Setting: ${setting}
System: ${systemName}

EXAMPLES: Same value trap (Truth vs Family) in different settings:

Ancient Athens:
"Your brother stole sacred olive oil from the temple stores. The archons demand the thief's name at tomorrow's Assembly. Speak the truth and he'll be stoned. Stay silent and the gods' curse falls on all Athens."

North American Tribe:
"Your sister took corn from the winter stores to feed her starving children. The council of elders gathers tonight. Speak the truth and she faces exile into the frozen forest. Stay silent and the spirits will punish the whole village."

Medieval Europe:
"Your son poached the lord's deer to feed his newborn. The bailiff drags villagers to the manor hall. Name him and he hangs. Lie and the lord burns the whole village."

Martian Colony:
"Your wife bypassed the oxygen rationing system. The Administrator's audit starts in one hour. Report her and she's exiled to the surface (death). Cover for her and the entire hab module loses oxygen privileges."

Ask yourself:
- What would THIS person in THIS world actually face?
- What objects, places, rituals, dangers exist HERE?
- What would shock vs. be normal in THIS culture?
- How do THESE people enforce rules and punish transgressions?

THE CAMERA TEST:
Every dilemma MUST be a concrete incident happening RIGHT NOW:
- A specific named person/group ("Your mother," "The Baker's Guild," "General Kael")
- Doing a specific physical action (blocking road, demanding answer, threatening family)
- Forcing an immediate choice (NOT "how will you balance" but "Do X or Y?")

GOOD: "Your neighbor drags your son into the square and accuses him of theft in front of the whole village."
BAD: "There are tensions in the village about property disputes."


─────────────────────────────────────────
STEP 2: CHOOSE THE BEST-FIT AXIS
─────────────────────────────────────────

After creating your value trap, ask: "Which axis best explores this value conflict?"

THE THREE AXES:

1. AUTONOMY ↔ HETERONOMY (Who decides?)
   - High Autonomy: Self-direction, owned reasons ("I choose because..."), personal risk, accepting blame
   - Low Autonomy (Heteronomy): External control, borrowed reasons ("The law says..."), obedience, deference
   - Middle Ground: Consultation, shared decision, strategic delegation

2. LIBERALISM ↔ TOTALISM (What's valued?)
   - High Liberalism: Protect the exception, tolerate difference, individual rights, risk disorder
   - Low Liberalism (Totalism): Enforce uniformity, suppress dissent, one strict code, ensure order
   - Middle Ground: Bounded pluralism, rules with exceptions, pragmatic tolerance

3. DEMOCRACY ↔ OLIGARCHY (Who authors the system?)
   - High Democracy: Inclusive voice, shared authorship, participatory governance, expand power
   - Low Democracy (Oligarchy): Elite control, exclusion, concentrated power, restrict voice
   - Middle Ground: Mixed constitution, limited franchise, strategic representation

MATCHING AXIS TO VALUE TRAP:

If the value trap is about PERSONAL AGENCY, DECISION-MAKING, RESPONSIBILITY:
→ Likely best explored via AUTONOMY ↔ HETERONOMY axis
Examples: Truth (speak my truth vs follow authority), Courage (act on my conviction vs obey), Autonomy itself

If the value trap is about TOLERANCE, CONFORMITY, ORDER vs FREEDOM:
→ Likely best explored via LIBERALISM ↔ TOTALISM axis
Examples: Freedom, Tradition, Unity, Diversity, Tolerance

If the value trap is about POWER-SHARING, INCLUSION, VOICE:
→ Likely best explored via DEMOCRACY ↔ OLIGARCHY axis
Examples: Equality, Justice, Voice, Participation, Representation

DESIGN 3 ACTIONS EXPLORING THE CHOSEN AXIS:

AUTONOMY Axis Actions:
- Action A (High Autonomy): Take personal responsibility, break protocol, "I decide," accept blame
- Action B (Heteronomy): Follow orders, defer to authority, "The rules say...," avoid responsibility
- Action C (Middle Ground): Consult others, share burden, strategic delegation

LIBERALISM Axis Actions:
- Action A (High Liberalism): Protect the dissenter, allow difference, tolerate deviation, risk disorder
- Action B (Totalism): Enforce conformity, suppress exception, ensure order, punish deviation
- Action C (Middle Ground): Tolerate within limits, calibrated enforcement, bounded pluralism

DEMOCRACY Axis Actions:
- Action A (High Democracy): Expand voice, include outsiders, share power, participatory decision
- Action B (Oligarchy): Restrict voice, exclude, concentrate control, elite decision
- Action C (Middle Ground): Limited inclusion, strategic representation, mixed approach

All actions must be CONCRETE PHYSICAL DEEDS:
"arrest," "pay," "scream," "sign," "burn," "kneel," "speak at assembly," "hide"
NOT: "manage the situation," "respond to the challenge," "address the crisis"


─────────────────────────────────────────
STEP 3: BRIDGE FROM PREVIOUS DAY (MANDATORY "bridge" FIELD)
─────────────────────────────────────────

Days 2-7: The "bridge" field must contain EXACTLY ONE SENTENCE that:
1. Shows the OUTCOME of the player's previous choice (what happened because of it)
2. When relevant, CONNECTS that outcome to the new dilemma (cause → effect)

PRIORITY ORDER:
- BEST: Previous choice directly caused or triggered today's problem
- GOOD: Previous choice's outcome creates context for unrelated new problem
- ACCEPTABLE: Outcome shown, then pivot to new problem

GOOD EXAMPLES (causal connection - PREFERRED):
- "Your arrest of the priest triggered riots in the temple district—now the high priestess demands an audience."
- "The grain you distributed bought loyalty, but emptied the reserves; a merchant caravan offers supplies at a steep price."
- "Your mercy to the rebels emboldened them—their leader now openly defies your decree in the market square."

ACCEPTABLE EXAMPLES (outcome + pivot):
- "The bridge you ordered is half-built, workers grumbling about pay. Meanwhile, a foreign envoy arrives with urgent news."
- "Your speech calmed the mob for now. But this morning, a different crisis: plague ships spotted in the harbor."

BAD EXAMPLES (DO NOT DO THIS):
- "Yesterday you arrested the priest. Today, a plague arrives." (no outcome shown)
- "Following your decision, things changed." (too vague)
- "The situation evolved." (no specific outcome)

MANDATORY STRUCTURE:
- "bridge": ONE sentence showing outcome → connection to new problem
- "dilemma.description": NEW situation details + direct question (do NOT repeat the bridge here)


3. CONSTRAINTS

AUTHORITY LEVEL CONSTRAINTS:
- Low authority CANNOT: command armies, issue decrees, conduct diplomacy
- Low authority CAN: petition, argue, vote, protest, organize, resist at risk
- Medium authority CAN: persuade councils, negotiate, build alliances, influence
- Medium authority CANNOT: unilateral military command (unless setting allows)
- High authority CAN: all of the above, but MUST still face personal stakes

HISTORICAL REALISM:
All reactions must match the culture of ${setting} and ${systemName}, NOT modern Western values.
Ask: "Would people HERE see this as normal, risky, sacred, shameful?"

If an action is COMMON for this era (beatings, harsh punishments, captives):
- Treat it as normal or risky, NOT morally shocking
- Only show outrage when the action breaks THEIR taboos (betraying guests, harming kin, violating oaths)

"Mom," "people," and "holders" must sound like members of this culture.
They worry about honor, spirits, retaliation, trade—not modern human-rights language.

MOM DEATH RULES:
- Mom CAN die from extreme player actions (war, plague, assassination, executing family, etc.)
- When mom dies: set attitudeLevel="dead", momDied=true, shortLine="brief death description"
- If player action explicitly targets/kills mom (e.g., "Murder my mother", "Execute my family"), she MUST die
- Death is rare but dramatically appropriate to severe actions

TOPIC & SCOPE DIVERSITY:
In every 3-day window: at least 2 different topics, at least 2 different scopes
Topics: Military, Economy, Religion, Diplomacy, Justice, Infrastructure, Politics, Social, Health, Education
Scopes: Personal, Local, Regional, National, International


DAY-BY-DAY REQUIREMENTS:

DYNAMIC PARAMETERS (Days 2-7):
- MANDATORY: Generate 2-3 concrete consequences of the previous player action
- Format: {"icon": "emoji", "text": "2-4 words"}
- Use emoji that matches the consequence type (⚔️ 🏥 💀 🏛️ 🔥 📚 ⚖️ 💰 🌾 🗡️ etc.)
- Include numbers when dramatically impactful
- Examples:
  * {"icon": "⚔️", "text": "12,000 troops assembled"}
  * {"icon": "💰", "text": "Treasury depleted by 40%"}
  * {"icon": "🔥", "text": "3 villages burned"}
  * {"icon": "🏥", "text": "200 plague deaths averted"}

THE MIRROR'S ROLE (All Days):
- The Mirror is a light-hearted companion who surfaces value tensions with dry humor
- MUST reference the player's specific value from their top 8 values, but NEVER use the exact compass nomenclature (e.g., "Truth/Trust", "Care/Solidarity", "Law/Std."). Instead, paraphrase naturally: "your sense of truth", "your care for others", "your faith in the law"
- Tone: amused, teasing, observant - NOT preachy or judgmental
- First person perspective: "I see..." "I wonder..." "I notice..."
- Length: 20-25 words exactly

MIRROR MODE (specified in user prompt for Days 2+):
- Mode "lastAction": Reflect on the player's PREVIOUS choice and what it reveals about their values. Comment on the tension between what they chose and what they claim to value.
- Mode "dilemma": Comment on the CURRENT dilemma they're about to face and how it challenges their values.

GOOD "lastAction" Examples (reflecting on previous choice):
- "I see you chose the treasury over the temple. Your practicality shows, but I wonder what your ancestors think of such pragmatism."
- "You sided with the nobles again. Your loyalty is touching—though I notice the common folk don't share your enthusiasm."
- "Mercy for the rebels, hm? Your compassion is admirable. I wonder if the families of the slain guards agree."

GOOD "dilemma" Examples (commenting on current situation):
- "Ah, another test of your famous sense of justice. I wonder if mercy will win today, or if the law will have its way."
- "The refugees wait at your gates. Your compassion is admirable—let's see if it survives the grain shortage."
- "Freedom for all, you say. I'm curious how long that lasts when the grain runs out."

BAD Mirror Examples (DO NOT DO THIS):
- "That was an interesting choice." (too vague, no value reference)
- "I wonder how this will play out." (no value reference)
- "Your commitment to your ideals is admirable." (too generic, preachy)
- "Your Truth/Trust is in conflict here." (uses exact compass nomenclature - sounds robotic)
- "Your Liberty/Agency matters to you." (uses slash notation from system - unnatural)


4. OUTPUT FORMAT

Return ONLY valid JSON. No \`\`\`json fences.

CRITICAL JSON RULES:
- ALWAYS include commas between properties
- NO trailing commas after last property
- Double quotes for all keys and strings
- Properly closed braces and brackets

DAY 1 SCHEMA:
{
  "dilemma": {
    "title": "Short title (max 120 chars)",
    "description": "Game Master narration addressing 'you', ending with direct question (1-3 sentences, no jargon)",
    "actions": [
      {"title": "Action title (2-4 words)", "summary": "One complete sentence (8-15 words)", "icon": "sword"},
      {"title": "Action title (2-4 words)", "summary": "One complete sentence (8-15 words)", "icon": "scales"},
      {"title": "Action title (2-4 words)", "summary": "One complete sentence (8-15 words)", "icon": "coin"}
    ],
    "topic": "Military|Economy|Religion|Diplomacy|Justice|Infrastructure|Politics|Social|Health|Education",
    "scope": "Personal|Local|Regional|National|International",
    "tensionCluster": "ExternalConflict|InternalPower|EconomyResources|HealthDisaster|ReligionCulture|LawJustice|SocialOrder|FamilyPersonal|DiplomacyTreaty"
  },
  "mirrorAdvice": "One sentence in FIRST PERSON (20-25 words, reference ONE specific value from player's compass, dry/mocking tone)",
  "valueTargeted": "Truth|Freedom|Loyalty|Honor|...",
  "axisExplored": "Autonomy|Liberalism|Democracy"
}

DAY 2-7 SCHEMA:
{
  "supportShift": {
    "people": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed", "shortLine": "Civic reaction in first person 'we/us' (10-15 words)"},
    "holders": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed", "shortLine": "Political reaction in first person 'we/us' (10-15 words)"},
    "mom": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed|dead", "shortLine": "Personal reaction in FIRST PERSON 'I' (10-15 words)", "momDied": false}
  },
  "bridge": "MANDATORY: ONE SENTENCE showing outcome of previous choice → connection to new problem (prefer causal link)",
  "dilemma": {
    "title": "Short title (max 120 chars)",
    "description": "NEW situation details + direct question (no jargon, do NOT repeat the bridge)",
    "actions": [
      {"title": "Action title (2-4 words)", "summary": "One complete sentence (8-15 words)", "icon": "..."},
      {"title": "Action title (2-4 words)", "summary": "One complete sentence (8-15 words)", "icon": "..."},
      {"title": "Action title (2-4 words)", "summary": "One complete sentence (8-15 words)", "icon": "..."}
    ],
    "topic": "Military|Economy|Religion|Diplomacy|Justice|Infrastructure|Politics|Social|Health|Education",
    "scope": "Personal|Local|Regional|National|International",
    "tensionCluster": "ExternalConflict|InternalPower|EconomyResources|HealthDisaster|ReligionCulture|LawJustice|SocialOrder|FamilyPersonal|DiplomacyTreaty"
  },
  "dynamicParams": [
    {"icon": "🔥", "text": "Dramatic consequence (2-4 words)"}
  ],
  "mirrorAdvice": "FIRST PERSON (20-25 words)",
  "valueTargeted": "Truth|Freedom|Loyalty|Honor|...",
  "axisExplored": "Autonomy|Liberalism|Democracy"
}

DAY 8 SCHEMA (Aftermath):
{
  "supportShift": {
    "people": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed", "shortLine": "Civic reaction in first person 'we/us' (10-15 words)"},
    "holders": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed", "shortLine": "Political reaction in first person 'we/us' (10-15 words)"},
    "mom": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed|dead", "shortLine": "Personal reaction in FIRST PERSON 'I' (10-15 words)", "momDied": false}
  },
  "dilemma": {
    "title": "The Aftermath",
    "description": "EXACTLY 2 sentences describing immediate consequences of Day 7 decision (no jargon)",
    "actions": [],
    "topic": "Conclusion",
    "scope": "N/A",
    "tensionCluster": "N/A"
  },
  "dynamicParams": [
    {"icon": "emoji", "text": "Dramatic consequence (2-4 words)"}
  ],
  "mirrorAdvice": "FIRST PERSON reflective sentence (20-25 words)",
  "valueTargeted": "N/A",
  "axisExplored": "N/A"
}`;

  return prompt;
}

/**
 * Build conditional user prompt (Day 1 vs Day 2+)
 * @param {number} day - Current day (1-8)
 * @param {object|null} playerChoice - Previous action {title, description}
 * @param {array|null} currentCompassTopValues - Current top compass values
 * @param {string} mirrorMode - 'lastAction' or 'dilemma' (default: 'dilemma')
 */
function buildGameMasterUserPrompt(day, playerChoice = null, currentCompassTopValues = null, mirrorMode = 'dilemma', languageCode = 'en', languageName = 'English') {
  // General instruction for all days
  let prompt = `First, carefully review the entire system prompt to understand all context and rules.\n\n`;

  if (day === 1) {
    prompt += `This is DAY 1 of 7.

Create the first concrete incident that forces an immediate choice.
STRICTLY OBEY THE CAMERA TEST: describe a specific event happening RIGHT NOW, not abstract tensions.
Write in the Game Master voice (playful, slightly teasing, speaking to "you").`;
  }
   else {
    // Format current compass values (if provided)
    let compassUpdateText = '';
    if (currentCompassTopValues && Array.isArray(currentCompassTopValues)) {
      compassUpdateText = '\n\nCURRENT TOP VALUES (SELECT FROM THESE FOR TODAY\'S VALUE TRAP):\n' +
        currentCompassTopValues.map(dim =>
          `  - ${dim.dimension}: ${dim.values.join(', ')}`
        ).join('\n') + '\n';
    }

    prompt += `DAY ${day} of 7\n\nPrevious action: "${playerChoice.title}" - ${playerChoice.description}${compassUpdateText}\n\n`;

    // Add mirror mode instruction for Days 2+
    prompt += `MIRROR MODE FOR THIS TURN: "${mirrorMode}"
${mirrorMode === 'lastAction'
  ? `The mirror should reflect on the player's PREVIOUS choice ("${playerChoice.title}") and what it reveals about their values.`
  : `The mirror should comment on the CURRENT dilemma they're about to face and how it challenges their values.`}

`;

    if (day === 7) {
      prompt += `This is the final day. Make this dilemma especially tough and epic - a climactic choice worthy of the player's last act in this world. The stakes should feel monumental. Remind them their borrowed time is almost over.

MANDATORY "bridge" FIELD - Generate ONE SENTENCE showing:
1. What HAPPENED because of "${playerChoice.title}"
2. How that outcome CONNECTS to today's final crisis (prefer causal link)

PRIORITY: Try to make today's final dilemma a CONSEQUENCE of yesterday's choice.

Then generate dilemma.description with the NEW situation details + direct question (do NOT repeat the bridge).

CRITICAL: Follow Golden Rules B & C - different tension from yesterday, actions exploring autonomy vs. heteronomy.

STRICTLY OBEY THE CAMERA TEST: describe a specific person or thing physically affecting the player RIGHT NOW.`;
    } else if (day === 8) {
      prompt += `This is Day 8 - the aftermath. Follow the system prompt instructions for Day 8.`;
    } else {
      prompt += `MANDATORY "bridge" FIELD - Generate ONE SENTENCE showing:
1. What HAPPENED because of "${playerChoice.title}"
2. How that outcome CONNECTS to today's new problem (prefer causal link)

PRIORITY: Try to make today's dilemma a CONSEQUENCE of yesterday's choice.

Then generate dilemma.description with the NEW situation details + direct question (do NOT repeat the bridge).

CRITICAL: Follow Golden Rules B & C - different tension from yesterday, actions exploring autonomy vs. heteronomy.

DO NOT summarize the general situation or write about "debates" or "rising tensions."
STRICTLY OBEY THE CAMERA TEST: describe a specific person or thing physically affecting the player RIGHT NOW.

Write in the Game Master voice (playful, slightly teasing, speaking to "you").`;
    }
  }

  // Add language instruction if not English
  if (languageCode !== 'en') {
    prompt += `\n\nWrite your response in ${languageName}.`;
  }

  return prompt;
}

// ==================== V2 SYSTEM: MAIN ENDPOINT ====================

/**
 * /api/game-turn-v2 - Clean-slate dilemma generation with Game Master voice
 *
 * Simplified, stateful system:
 * - Day 1: Initialize with full game context
 * - Day 2+: Analyze support shifts, generate consequences, new dilemma
 * - Hybrid support validation: AI suggests, backend randomizes + caps
 * - Full trust in AI for dynamic params
 * - Game Master always ends with question
 * - Mother speaks in first person
 */
app.post("/api/game-turn-v2", async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("🎮 [GAME-TURN-V2] /api/game-turn-v2 called");
    console.log("========================================\n");

    const {
      gameId,
      day,
      totalDays = 7,
      isFirstDilemma,
      isFollowUp,
      playerChoice, // Day 2+ only
      gameContext, // Day 1 only
      dilemmasSubjectEnabled = false,
      dilemmasSubject = null,
      generateActions = true,
      useXAI = false,
      useGemini = false,
      debugMode = false,
      language = 'en' // Get language from client (default: English)
    } = req.body;

    // Validation
    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({ error: "Missing or invalid gameId" });
    }

    if (!day || typeof day !== 'number' || day < 1 || day > 8) {
      return res.status(400).json({ error: "Missing or invalid day (must be 1-8)" });
    }

    console.log(`[GAME-TURN-V2] gameId=${gameId}, day=${day}, isFirstDilemma=${isFirstDilemma}, language=${language}`);

    // Get or create conversation
    let conversation = getConversation(gameId);
    const daysLeft = totalDays - day + 1;
    const isAftermathTurn = daysLeft <= 0;

    // ========================================================================
    // DAY 1: Initialize conversation with unified system prompt
    // ========================================================================
    if (isFirstDilemma && day === 1) {
      if (!gameContext) {
        return res.status(400).json({ error: "Missing gameContext for Day 1" });
      }

      console.log('[GAME-TURN-V2] Day 1 - Initializing conversation with unified prompt');

      // Extract and prepare game context
      const challengerName = extractChallengerName(gameContext.challengerSeat);

      // CRITICAL: Calculate authorityLevel and OVERRIDE frontend value
      const frontendAuthorityLevel = gameContext.authorityLevel;
      const authorityLevel = calculateAuthorityLevel(
        gameContext.e12,
        gameContext.powerHolders,
        gameContext.playerIndex,
        gameContext.roleScope
      );

      // Log authority level calculation for debugging
      if (frontendAuthorityLevel !== authorityLevel) {
        console.log(`[AUTHORITY] Frontend sent: "${frontendAuthorityLevel}" → Backend calculated: "${authorityLevel}"`);
      } else {
        console.log(`[AUTHORITY] Authority level: "${authorityLevel}"`);
      }

      // Override gameContext with correct authority level
      gameContext.authorityLevel = authorityLevel;

      // Build enriched context (minimal - only what's needed for system prompt)
      const enrichedContext = {
        role: gameContext.role,
        systemName: gameContext.systemName,
        setting: gameContext.setting,
        challengerName,
        powerHolders: gameContext.powerHolders,
        authorityLevel,
        playerCompassTopValues: gameContext.playerCompassTopValues
      };

      // Build unified system prompt (sent ONCE)
      // Use V3 if feature flag enabled, otherwise use original
      const languageCode = String(language || "en").toLowerCase();
      const languageName = LANGUAGE_NAMES[languageCode] || LANGUAGE_NAMES.en;
      const systemPrompt = USE_PROMPT_V3
        ? buildGameMasterSystemPromptUnifiedV3(enrichedContext, languageCode, languageName)
        : buildGameMasterSystemPromptUnified(enrichedContext, languageCode, languageName);

      // Build minimal Day 1 user prompt
      const userPrompt = buildGameMasterUserPrompt(day, null, null, 'dilemma', languageCode, languageName);

      // Debug logging (Day 1 request payload)
      if (debugMode) {
        console.log("\n" + "=".repeat(80));
        console.log("🐛 [DEBUG] Day 1 - Request Payload:");
        console.log("=".repeat(80));
        console.log(JSON.stringify({
          gameId,
          day,
          totalDays,
          isFirstDilemma: true,
          generateActions,
          useXAI,
          language: languageCode,
          gameContext: {
            role: enrichedContext.role,
            systemName: enrichedContext.systemName,
            setting: enrichedContext.setting,
            challengerName: enrichedContext.challengerName,
            authorityLevel: enrichedContext.authorityLevel,
            powerHoldersCount: enrichedContext.powerHolders?.length || 0,
            topPowerHolders: enrichedContext.powerHolders?.slice(0, 3).map(ph => `${ph.name} (${ph.power}%)`),
            playerCompassTopValues: enrichedContext.playerCompassTopValues,
          },
          promptMetadata: {
            systemPromptLength: systemPrompt.length,
            systemPromptTokens: Math.ceil(systemPrompt.length / 4),
            userPromptLength: userPrompt.length,
            userPromptTokens: Math.ceil(userPrompt.length / 4)
          }
        }, null, 2));
        console.log("=".repeat(80) + "\n");
      }

      // Call AI with retry logic for JSON parsing failures
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ];

      let parsed;
      let content;
      const maxRetries = 1;

      for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
        // Add correction message on retry
        if (retryCount > 0) {
          console.log(`[GAME-TURN-V2] JSON parse failed, retrying Day 1 (attempt ${retryCount + 1}/${maxRetries + 1})...`);
          messages.push({
            role: "user",
            content: "Your response was not valid JSON. Please respond ONLY with the raw JSON object, no markdown code blocks (no ```), no explanations - just the JSON starting with { and ending with }."
          });
        }

        const aiResponse = await callGeminiChat(messages, "gemini-2.5-flash");

        content = aiResponse?.content;
        if (!content) {
          throw new Error("No content in AI response");
        }

        // Debug logging (Day 1 AI response)
        if (debugMode) {
          console.log("\n" + "=".repeat(80));
          console.log(`🐛 [DEBUG] Day 1 Raw AI Response (attempt ${retryCount + 1}):`);
          console.log("=".repeat(80));
          console.log(content);
          console.log("=".repeat(80) + "\n");
        }

        // Parse JSON response with robust error handling
        // Try existing safeParseJSON utility first (includes markdown stripping)
        parsed = safeParseJSON(content, { debugTag: `GAME-TURN-V2-DAY1-ATTEMPT${retryCount + 1}` });

        // If safeParseJSON fails, try custom comma repair
        if (!parsed) {
          console.log(`[GAME-TURN-V2] safeParseJSON failed (attempt ${retryCount + 1}), attempting comma repair...`);
          try {
            // First strip markdown using our robust function
            const strippedContent = stripMarkdownCodeBlocks(content);

            // Fix missing commas: "value"\n"key" -> "value",\n"key"
            const commaFixed = strippedContent.replace(/("\s*)\n(\s*"[^"]+"\s*:)/g, '$1,\n$2');
            parsed = JSON.parse(commaFixed);
            console.log('[GAME-TURN-V2] ✅ Comma repair successful');
          } catch (commaError) {
            console.error(`[GAME-TURN-V2] Comma repair failed (attempt ${retryCount + 1}):`, commaError.message);
          }
        }

        // If parsing succeeded, break out of retry loop
        if (parsed) {
          if (retryCount > 0) {
            console.log(`[GAME-TURN-V2] ✅ JSON parsing succeeded on retry attempt ${retryCount + 1}`);
          }
          break;
        }

        // If this was the last attempt and still no parsed result, throw error
        if (retryCount === maxRetries && !parsed) {
          console.error('[GAME-TURN-V2] All JSON parse attempts failed after retries (Day 1)');
          console.error('[GAME-TURN-V2] Raw content:', content);
          throw new Error(`Failed to parse AI response after ${maxRetries + 1} attempts`);
        }
      }

      // Add assistant response to messages
      messages.push({ role: "assistant", content: content });

      // Store conversation with minimal meta (for reference only)
      const conversationMeta = {
        role: gameContext.role,
        systemName: gameContext.systemName,
        challengerName,
        authorityLevel,
        topicHistory: [{
          day: 1,
          topic: parsed.dilemma?.topic || 'Unknown',
          scope: parsed.dilemma?.scope || 'Unknown',
          tensionCluster: parsed.dilemma?.tensionCluster || 'Unknown'
        }],
        clusterCounts: {
          [parsed.dilemma?.tensionCluster || 'Unknown']: 1
        }
      };

      // FIXED: Store messages array properly in conversation.messages field
      storeConversation(gameId, gameId, useXAI ? "xai" : "openai", { ...conversationMeta, messages });

      console.log('[GAME-TURN-V2] Day 1 complete, conversation stored with unified system prompt');

      // Log Day 1 tension cluster
      const day1Cluster = parsed.dilemma?.tensionCluster || 'Unknown';
      console.log(`[TENSION] ✅ Day 1: "${day1Cluster}" (count: 1/2, prev: "none")`);
      console.log(`[TENSION] Cluster usage: ${day1Cluster}:1`);

      // Log mirror advice for debugging
      console.log("[game-turn-v2] Mirror advice generated (Day 1):", parsed.mirrorAdvice);

      // Debug: Track topic/scope/tensionCluster variety
      if (debugMode) {
        logTopicScopeDebug(
          gameId,
          day,
          parsed.dilemma?.topic || 'Unknown',
          parsed.dilemma?.scope || 'Unknown',
          parsed.dilemma?.tensionCluster || 'Unknown',
          parsed.dilemma?.title || 'Untitled',
          [] // Day 1 has no history
        );
      }

      // Return response (flattened for frontend compatibility)
      const response = {
        title: parsed.dilemma?.title || '',
        description: parsed.dilemma?.description || '',
        actions: parsed.dilemma?.actions || [],
        topic: parsed.dilemma?.topic || '',
        scope: parsed.dilemma?.scope || '',
        mirrorAdvice: parsed.mirrorAdvice,
        isGameEnd: false
      };

      // Add tracking fields if using V3 (for frontend validation)
      if (USE_PROMPT_V3) {
        response.valueTargeted = parsed.valueTargeted || 'Unknown';
        response.axisExplored = parsed.axisExplored || 'Unknown';
      }

      return res.json(response);
    }

    // ========================================================================
    // DAY 2+: Append to conversation history (NO new system prompt)
    // ========================================================================
    if (isFollowUp && day > 1) {
      if (!conversation || !conversation.meta.messages) {
        return res.status(400).json({ error: "No conversation found for this gameId" });
      }

      if (!playerChoice) {
        return res.status(400).json({ error: "Missing playerChoice for Day 2+" });
      }

      console.log(`[GAME-TURN-V2] Day ${day} - Appending to conversation history`);

      // Extract current compass values from payload (Day 2+)
      const currentCompassTopValues = req.body.currentCompassTopValues || null;

      if (currentCompassTopValues) {
        console.log(`[GAME-TURN-V2] Day ${day} - Current top values received:`, currentCompassTopValues);
      }

      // Determine mirror mode for Days 2-7 (50/50 random between reflecting on last action vs current dilemma)
      const mirrorMode = Math.random() < 0.5 ? 'lastAction' : 'dilemma';
      console.log(`[GAME-TURN-V2] Day ${day} - Mirror mode: ${mirrorMode}`);

      // Build Day 2+ user prompt with current compass values and mirror mode
      const languageCode = String(language || "en").toLowerCase();
      const languageName = LANGUAGE_NAMES[languageCode] || LANGUAGE_NAMES.en;
      const userPrompt = buildGameMasterUserPrompt(day, playerChoice, currentCompassTopValues, mirrorMode, languageCode, languageName);

      // Prepare messages array (history + new user message)
      const messages = [
        ...conversation.meta.messages,
        { role: "user", content: userPrompt }
      ];

      // Debug logging (Day 2+ request payload)
      if (debugMode) {
        const daysLeft = totalDays - day;
        console.log("\n" + "=".repeat(80));
        console.log(`🐛 [DEBUG] Day ${day} - Request Payload:`);
        console.log("=".repeat(80));
        console.log(JSON.stringify({
          gameId,
          day,
          totalDays,
          daysLeft,
          isFollowUp: true,
          generateActions,
          useXAI,
          language: languageCode,
          playerChoice: {
            title: playerChoice?.title,
            description: playerChoice?.description,
            cost: playerChoice?.cost,
            iconHint: playerChoice?.iconHint
          },
          conversationMetadata: {
            messageCount: messages.length,
            userPromptLength: userPrompt.length,
            userPromptTokens: Math.ceil(userPrompt.length / 4),
            totalConversationTokens: Math.ceil(messages.reduce((sum, msg) => sum + msg.content.length, 0) / 4)
          }
        }, null, 2));
        console.log("=".repeat(80) + "\n");
      }

      // Call AI with retry logic for JSON parsing failures
      let parsed;
      let content;
      const maxRetries = 1;

      for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
        // Add correction message on retry
        if (retryCount > 0) {
          console.log(`[GAME-TURN-V2] JSON parse failed, retrying (attempt ${retryCount + 1}/${maxRetries + 1})...`);
          messages.push({
            role: "user",
            content: "Your response was not valid JSON. Please respond ONLY with the raw JSON object, no markdown code blocks (no ```), no explanations - just the JSON starting with { and ending with }."
          });
        }

        const aiResponse = await callGeminiChat(messages, "gemini-2.5-flash");

        content = aiResponse?.content;
        if (!content) {
          throw new Error("No content in AI response");
        }

        // Debug logging (Day 2+ AI response)
        if (debugMode) {
          console.log("\n" + "=".repeat(80));
          console.log(`🐛 [DEBUG] Day ${day} Raw AI Response (attempt ${retryCount + 1}):`);
          console.log("=".repeat(80));
          console.log(content);
          console.log("=".repeat(80) + "\n");
        }

        // Parse JSON response with robust error handling
        // Try existing safeParseJSON utility first (includes markdown stripping)
        parsed = safeParseJSON(content, { debugTag: `GAME-TURN-V2-DAY2+-ATTEMPT${retryCount + 1}` });

        // If safeParseJSON fails, try custom comma repair
        if (!parsed) {
          console.log(`[GAME-TURN-V2] safeParseJSON failed (attempt ${retryCount + 1}), attempting comma repair...`);
          try {
            // First strip markdown using our robust function
            const strippedContent = stripMarkdownCodeBlocks(content);

            // Fix missing commas: "value"\n"key" -> "value",\n"key"
            const commaFixed = strippedContent.replace(/("\s*)\n(\s*"[^"]+"\s*:)/g, '$1,\n$2');
            parsed = JSON.parse(commaFixed);
            console.log('[GAME-TURN-V2] ✅ Comma repair successful');
          } catch (commaError) {
            console.error(`[GAME-TURN-V2] Comma repair failed (attempt ${retryCount + 1}):`, commaError.message);
          }
        }

        // If parsing succeeded, validate bridge field and break out of retry loop
        if (parsed) {
          // Validate bridge field exists for Day 2+ (mandatory)
          if (day > 1 && !parsed.bridge && retryCount < maxRetries) {
            console.warn(`[GAME-TURN-V2] Day ${day} - Missing "bridge" field, retrying with stronger instruction...`);
            messages.push({
              role: "user",
              content: `Your response is missing the required "bridge" field. Please respond again with valid JSON that includes a "bridge" field containing ONE SENTENCE showing the OUTCOME of the player's previous action "${playerChoice.title}" and how it connects to today's new problem. This field is MANDATORY for Days 2-7.`
            });
            parsed = null; // Reset parsed to trigger retry
            continue;
          }

          if (retryCount > 0) {
            console.log(`[GAME-TURN-V2] ✅ JSON parsing succeeded on retry attempt ${retryCount + 1}`);
          }
          break;
        }

        // If this was the last attempt and still no parsed result, throw error
        if (retryCount === maxRetries && !parsed) {
          console.error('[GAME-TURN-V2] All JSON parse attempts failed after retries');
          console.error('[GAME-TURN-V2] Raw content:', content);
          throw new Error(`Failed to parse AI response after ${maxRetries + 1} attempts`);
        }
      }

      // Get existing topic history (used by both topic/scope and tension cluster validation)
      const existingTopicHistory = conversation.meta.topicHistory || [];

      // SEMANTIC SIMILARITY VALIDATION (prevent narrative repetition)
      // DISABLED: Testing if Gemini model follows instructions without validation
      if (false && existingTopicHistory.length > 0) {
        const prevDilemma = existingTopicHistory[existingTopicHistory.length - 1];
        const currentTitle = parsed.dilemma?.title || '';
        const currentDescription = parsed.dilemma?.description || '';

        // Quick AI check for semantic similarity using cheap model
        const similarityPrompt = `Analyze if these two political dilemmas are about the same underlying issue:

Dilemma 1 (Day ${prevDilemma.day}): "${prevDilemma.title}" - ${prevDilemma.description}
Dilemma 2 (Day ${day}): "${currentTitle}" - ${currentDescription}

Answer ONLY with this JSON format:
{
  "isSimilar": true,
  "reason": "Brief explanation (1 sentence)"
}

Consider them "similar" (isSimilar: true) if they involve:
- Same people/groups (e.g., bakers, merchants, priests)
- Same core tension (e.g., food prices, succession, war)
- Continuation of same conflict (e.g., baker strike after baker demands)

Consider them "different" (isSimilar: false) if they:
- Involve completely different stakeholders
- Address unrelated issues (e.g., baker prices vs military coup)
- Shift to new tension type (e.g., economic → family crisis)`;

        const similarityCheck = await callGeminiChat([
          { role: "user", content: similarityPrompt }
        ], "gemini-2.5-flash"); // Use Gemini for validation

        const similarity = safeParseJSON(similarityCheck?.content, { debugTag: "SEMANTIC-CHECK" });

        if (similarity?.isSimilar) {
          console.log(`[SEMANTIC] ⚠️ VIOLATION: Day ${day} similar to Day ${prevDilemma.day}`);
          console.log(`[SEMANTIC] Reason: ${similarity.reason}`);
          console.log(`[SEMANTIC] 🔄 Re-prompting for different scenario...`);

          const correctionPrompt = `Your dilemma is too similar to yesterday's dilemma.

Yesterday (Day ${prevDilemma.day}): "${prevDilemma.title}" - ${prevDilemma.description}
Today (Day ${day}): "${currentTitle}" - ${currentDescription}
Similarity reason: ${similarity.reason}

INSTRUCTIONS:
1. Keep ONE short sentence acknowledging yesterday's action
2. Then pivot to a COMPLETELY DIFFERENT underlying issue
3. Follow Golden Rule B: different human angle (personal, family, religious, social, political, health, environmental, power struggle)
4. Must be about a different topic entirely, not a continuation of the same tension
5. Different people/groups should be involved

Regenerate the ENTIRE JSON output with these changes.`;

          const correctedMessages = [...messages, { role: "user", content: correctionPrompt }];

          const retryResponse = await callGeminiChat(correctedMessages, "gemini-2.5-flash");

          const retryContent = retryResponse?.content;
          if (retryContent) {
            const retryParsed = safeParseJSON(retryContent, { debugTag: "GAME-TURN-V2-SEMANTIC-RETRY" });
            if (retryParsed && retryParsed.dilemma) {
              console.log(`[SEMANTIC] ✅ Re-prompt successful: "${retryParsed.dilemma.title}"`);
              parsed = retryParsed;
            } else {
              console.log(`[SEMANTIC] ⚠️ Re-prompt failed to parse. Using original response.`);
            }
          } else {
            console.log(`[SEMANTIC] ⚠️ Re-prompt returned no content. Using original response.`);
          }
        } else {
          console.log(`[SEMANTIC] ✅ Day ${day}: Different from Day ${prevDilemma.day} - "${currentTitle}"`);
        }
      } else {
        console.log(`[SEMANTIC] ✅ Day ${day}: First dilemma - "${parsed.dilemma?.title || 'Unknown'}"`);
      }

      // TENSION CLUSTER VALIDATION + RE-PROMPT
      // DISABLED: Testing if Gemini model follows instructions without validation
      const ALL_CLUSTERS = ['ExternalConflict', 'InternalPower', 'EconomyResources', 'HealthDisaster', 'ReligionCulture', 'LawJustice', 'SocialOrder', 'FamilyPersonal', 'DiplomacyTreaty'];
      const clusterCounts = { ...(conversation.meta.clusterCounts || {}) };

      const prevCluster = existingTopicHistory.length > 0
        ? existingTopicHistory[existingTopicHistory.length - 1].tensionCluster
        : null;
      let currentCluster = parsed.dilemma?.tensionCluster || 'Unknown';

      // Check violation: max 2 per game (consecutive repeats are allowed)
      const isOverMax = currentCluster !== 'Unknown' && (clusterCounts[currentCluster] || 0) >= 2;

      if (false && isOverMax) {
        console.log(`[TENSION] ⚠️ CLUSTER VIOLATION: Day ${day} "${currentCluster}" - already used 2 times`);
        console.log(`[TENSION] 🔄 Attempting re-prompt...`);

        // Find available clusters (not at max)
        const availableClusters = ALL_CLUSTERS.filter(c => (clusterCounts[c] || 0) < 2);
        console.log(`[TENSION] Available clusters: ${availableClusters.join(', ')}`);

        // Re-prompt with improved message
        const correctionPrompt = `You used tensionCluster "${currentCluster}" which has already been used 2 times in this game.

INSTRUCTIONS:
1. Start your dilemma description with ONE short sentence (max 15 words) that transitions from the previous situation
2. Then introduce a dilemma from a DIFFERENT tensionCluster
3. You MUST choose from these available clusters: ${availableClusters.join(', ')}

Regenerate the ENTIRE JSON output with these changes.`;

        const correctedMessages = [...messages, { role: "user", content: correctionPrompt }];

        const retryResponse = await callGeminiChat(correctedMessages, "gemini-2.5-flash");

        const retryContent = retryResponse?.content;
        if (retryContent) {
          const retryParsed = safeParseJSON(retryContent, { debugTag: "GAME-TURN-V2-RETRY" });
          const retryCluster = retryParsed?.dilemma?.tensionCluster;
          if (retryParsed && availableClusters.includes(retryCluster)) {
            console.log(`[TENSION] ✅ Re-prompt successful: new cluster "${retryCluster}"`);
            parsed = retryParsed;
            currentCluster = retryCluster;
          } else {
            console.log(`[TENSION] ⚠️ Re-prompt failed (got "${retryCluster}"). Using original response.`);
          }
        }
      }

      // Update cluster counts
      clusterCounts[currentCluster] = (clusterCounts[currentCluster] || 0) + 1;

      // Enhanced logging
      const countStr = Object.entries(clusterCounts).map(([k, v]) => `${k}:${v}`).join(', ');
      console.log(`[TENSION] ✅ Day ${day}: "${currentCluster}" (count: ${clusterCounts[currentCluster]}/2, prev: "${prevCluster || 'none'}")`);
      console.log(`[TENSION] Cluster usage: ${countStr}`);

      // Hybrid support shift validation
      let supportShift = null;
      if (parsed.supportShift) {
        // Starting support is always 50%, AI tracks shifts through conversation
        const currentSupport = {
          people: 50,
          holders: 50,
          mom: 50
        };

        // Convert AI reactions to numeric deltas with randomization and caps
        supportShift = convertSupportShiftToDeltas(parsed.supportShift, currentSupport);
      }

      // Process dynamic params (no validation, just max 3)
      const dynamicParams = processDynamicParams(parsed.dynamicParams);

      // Update conversation messages
      const updatedMessages = [
        ...conversation.meta.messages,
        { role: "user", content: userPrompt },
        { role: "assistant", content: content }
      ];

      // Get existing topic history and add current day (use currentCluster which may have been updated by re-prompt)
      const topicHistory = conversation.meta.topicHistory || [];
      topicHistory.push({
        day,
        topic: parsed.dilemma?.topic || 'Unknown',
        scope: parsed.dilemma?.scope || 'Unknown',
        tensionCluster: currentCluster,
        title: parsed.dilemma?.title || '',        // For semantic similarity validation
        description: parsed.dilemma?.description || ''  // For semantic similarity validation
      });

      // Update meta with new messages array, topic history, and cluster counts
      const updatedMeta = {
        ...conversation.meta,
        messages: updatedMessages,
        topicHistory,
        clusterCounts
      };

      // FIXED: Store updated messages properly
      storeConversation(gameId, gameId, conversation.provider, updatedMeta);

      console.log(`[GAME-TURN-V2] Day ${day} complete, conversation updated (${updatedMessages.length} total messages)`);

      // Log mirror advice for debugging
      console.log(`[game-turn-v2] Mirror advice generated (Day ${day}):`, parsed.mirrorAdvice);

      // Debug: Track topic/scope/tensionCluster variety
      if (debugMode) {
        logTopicScopeDebug(
          gameId,
          day,
          parsed.dilemma?.topic || 'Unknown',
          parsed.dilemma?.scope || 'Unknown',
          currentCluster,
          parsed.dilemma?.title || 'Untitled',
          topicHistory.slice(0, -1) // Pass history without current day for comparison
        );
      }

      // Return response (flattened for frontend compatibility)
      const response = {
        title: parsed.dilemma?.title || '',
        description: parsed.dilemma?.description || '',
        bridge: parsed.bridge || '', // Bridge sentence connecting previous action to new dilemma
        actions: parsed.dilemma?.actions || [],
        topic: parsed.dilemma?.topic || '',
        scope: parsed.dilemma?.scope || '',
        supportShift,
        dynamicParams,
        mirrorAdvice: parsed.mirrorAdvice,
        isGameEnd: isAftermathTurn
      };

      // Add tracking fields if using V3 (for frontend validation)
      if (USE_PROMPT_V3) {
        response.valueTargeted = parsed.valueTargeted || 'Unknown';
        response.axisExplored = parsed.axisExplored || 'Unknown';
      }

      // Log bridge field for debugging
      if (day > 1) {
        console.log(`[GAME-TURN-V2] Day ${day} bridge: "${response.bridge || '(none)'}"`);
      }

      return res.json(response);
    }

    // If we get here, invalid request
    return res.status(400).json({ error: "Invalid request - must be Day 1 with gameContext or Day 2+ with playerChoice" });

  } catch (error) {
    console.error("[GAME-TURN-V2] ❌ Error:", error);
    return res.status(500).json({
      error: "Game turn generation failed",
      message: error?.message || "Unknown error"
    });
  }
});

/**
 * /api/game-turn/cleanup - Cleanup conversation state when game ends
 *
 * Deletes both the main game conversation and compass conversation
 * Called when player finishes the game (Aftermath screen)
 *
 * Request: { gameId: string }
 * Response: { success: boolean }
 */
app.post("/api/game-turn/cleanup", async (req, res) => {
  try {
    const { gameId } = req.body || {};

    // Validation
    if (!gameId || typeof gameId !== "string") {
      return res.status(400).json({ error: "Missing or invalid gameId" });
    }

    console.log(`\n[Cleanup] 🧹 Cleaning up conversations for gameId=${gameId}`);

    // Delete main game conversation
    deleteConversation(gameId);
    console.log(`[Cleanup] ✅ Deleted main game conversation: ${gameId}`);

    // Delete compass conversation
    deleteConversation(`compass-${gameId}`);
    console.log(`[Cleanup] ✅ Deleted compass conversation: compass-${gameId}`);

    return res.json({ success: true });

  } catch (error) {
    console.error("[Cleanup] ❌ Error:", error);
    return res.status(500).json({
      error: "Cleanup failed",
      message: error?.message || "Unknown error"
    });
  }
});

// ==================== COMPASS CONVERSATION HELPERS ====================

/**
 * Parse AI response for compass hints
 * Handles JSON extraction from markdown code blocks
 */
function parseCompassHintsResponse(content) {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
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

    console.log(`\n[CompassConversation] 🎯 Initializing conversation for gameId=${gameId}`);

    // Build system prompt with full compass definitions
    const systemPrompt = `You are a value-tagging engine for a political choice game.
Your job: given a player ACTION, the SCENARIO CONTEXT, the PLAYER ROLE, and the POLITICAL SYSTEM, and using the VALUES list below, identify which values are most clearly supported or opposed by the action within this specific political–historical–role context.
The meaning of a value may vary by context: what counts as "pragmatic," "responsible," "oppressive," "courageous," etc. can differ between eras, systems, and roles (e.g., a king's duty differs from a citizen's obligation).

${COMPASS_DEFINITION_BLOCK}

Task

Read the SCENARIO CONTEXT, PLAYER ROLE, POLITICAL SYSTEM, and ACTION.

Scan the entire VALUES list. Select 2–6 values that are most strongly expressed (supported or opposed) in this specific context. Ignore weak or ambiguous signals.

For each selected value, determine:

Does the ACTION support or oppose this value?

How strongly?

2 = strongly supports

1 = somewhat supports

-1 = somewhat opposes

-2 = strongly opposes

Use exactly the prop, index, and name from the VALUES list.

Output format
Return only this JSON structure (no explanations):

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

Prefer fewer high-signal values to many low-signal ones.

Examples

ACTION: "Impose martial law"
→ how:Enforce (2), what:Security/Safety (2), what:Liberty/Agency (-2)

ACTION: "Cut taxes for the wealthy"
→ how:Markets (1), what:Equality/Equity (-2), whither:Self (1)

ACTION: "Fund public education"
→ how:Civic Culture (2), what:Wellbeing (1), whither:Humanity (1)

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
    storeConversation(`compass-${gameId}`, `compass-${gameId}`, "openai", {
      messages,
      compassDefinitions: true, // Flag that definitions are stored
      gameContext: gameContext || null // Store context for reference
    });

    console.log(`[CompassConversation] ✅ Conversation initialized successfully`);
    console.log(`[CompassConversation] System prompt tokens: ~${Math.ceil(systemPrompt.length / 4)}`);
    if (gameContext) {
      console.log(`[CompassConversation] Stored context: ${gameContext.setting || 'unknown'}, ${gameContext.role || 'unknown'}, ${gameContext.systemName || 'unknown'}`);
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
      console.log(`\n[CompassConversation] 🧠 Analyzing reasoning for gameId=${gameId}`);
      console.log(`[CompassConversation] Dilemma: "${actionTitle}"`);
      console.log(`[CompassConversation] Selected Action: "${selectedAction}"`);
      console.log(`[CompassConversation] Reasoning: "${reasoningText.substring(0, 100)}${reasoningText.length > 100 ? '...' : ''}"`);
      if (valueTargeted) {
        console.log(`[CompassConversation] 🎯 Value Trap: "${valueTargeted}"`);
      }
    } else {
      console.log(`\n[CompassConversation] 🔍 Analyzing action for gameId=${gameId}`);
      console.log(`[CompassConversation] Action: "${actionTitle}"`);
      if (valueTargeted) {
        console.log(`[CompassConversation] 🎯 Value Trap: "${valueTargeted}"`);
      }
    }

    // Get conversation
    const conversation = getConversation(`compass-${gameId}`);
    if (!conversation || !conversation.meta.messages) {
      console.warn(`[CompassConversation] ⚠️ No conversation found, falling back to non-stateful analysis`);

      // Build trap context section for fallback mode
      const fallbackTrapContext = valueTargeted ? `
VALUE TRAP CONTEXT:
This dilemma was designed to test the player's "${valueTargeted}" value.
${trapDilemmaTitle ? `The trap setup: "${trapDilemmaTitle}"${trapDilemmaDescription ? ` - ${trapDilemmaDescription}` : ''}` : ''}

MANDATORY: Your analysis MUST include a compass hint for the trapped value (${valueTargeted}).
- If the action SUPPORTS the trapped value → positive polarity (+1 or +2)
- If the action CONTRADICTS/BETRAYS the trapped value → negative polarity (-1 or -2)

` : '';

      // Fallback: Create one-off analysis without stored state
      const fallbackSystemPrompt = `You translate player decisions into political compass hints.

${COMPASS_DEFINITION_BLOCK}

Return 2-6 compass hints as JSON: {"compassHints": [{"prop": "what|whence|how|whither", "idx": 0-9, "polarity": -2|-1|1|2}]}`;

      let fallbackUserPrompt;
      if (isReasoningAnalysis) {
        fallbackUserPrompt = `${fallbackTrapContext}CURRENT DILEMMA:
TITLE: ${actionTitle}${actionSummary ? `\nDESCRIPTION: ${actionSummary}` : ''}

PLAYER'S SELECTED ACTION: ${selectedAction}

PLAYER'S REASONING FOR THIS CHOICE:
"${reasoningText}"

Analyze the player's reasoning text for political compass values. What values does their explanation reveal?

Additionally, generate a brief (1-2 sentence) mirror reflection message. The mirror is whimsical and archival:
- Address player as "traveler" or "wanderer"
- First-person ("I observe...", "I sense...")
- Comment on their reasoning reflecting their values

Return: {"compassHints": [...], "mirrorMessage": "..."}`;
      } else {
        fallbackUserPrompt = `${fallbackTrapContext}Analyze this action:
TITLE: ${actionTitle}${actionSummary ? `\nSUMMARY: ${actionSummary}` : ''}`;
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

MANDATORY: Your analysis MUST include a compass hint for the trapped value (${valueTargeted}).
- If the action SUPPORTS the trapped value → positive polarity (+1 or +2)
- If the action CONTRADICTS/BETRAYS the trapped value → negative polarity (-1 or -2)
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
DESCRIPTION: ${actionSummary}` : ''}

PLAYER'S SELECTED ACTION: ${selectedAction}

PLAYER'S REASONING FOR THIS CHOICE:
"${reasoningText}"

Analyze the player's reasoning text for political compass values. What values does their explanation reveal?

Additionally, generate a SHORT mirror reflection message. The mirror is a cynical, dry-witted observer in FIRST PERSON.
Job: surface tensions between their VALUES and their REASONING.

Rules:
- 1 sentence ONLY, 15-20 words maximum
- Reference at least ONE value from their compass (what/how axes)
- Create tension - show how their reasoning reveals or contradicts values
- Never preach - just highlight the contradiction or irony
- Do NOT use exact compass value names. Paraphrase: "your sense of truth", "your love of freedom"
- Dry/mocking tone

BAD: "I observe how your reasoning reflects your values, traveler." (too wordy, wrong voice)
GOOD: "Your sense of fairness is charming when it justifies self-interest."
GOOD: "Careful deliberation — protecting the powerful, naturally."

Return JSON in this shape:
{
  "compassHints": [
    {"prop": "what|whence|how|whither", "idx": 0-9, "polarity": -2|-1|1|2}
  ],
  "mirrorMessage": "Your short mirror reflection here (15-20 words max)"
}`;
    } else {
      userPrompt = `SCENARIO CONTEXT: ${scenarioContext}
PLAYER ROLE: ${playerRole}
POLITICAL SYSTEM: ${politicalSystem}
${trapContextSection}
ACTION:
TITLE: ${actionTitle}${actionSummary ? `
SUMMARY: ${actionSummary}` : ''}

Return JSON in this shape:
{
  "compassHints": [
    {"prop": "what|whence|how|whither", "idx": 0-9, "polarity": -2|-1|1|2}
  ]
}`;
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

    console.log(`[CompassConversation] 🤖 AI responded (${content.length} chars)`);

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
    storeConversation(`compass-${gameId}`, `compass-${gameId}`, "openai", {
      messages,
      compassDefinitions: true,
      gameContext: gameContext || storedContext // Update stored context if provided
    });

    // Touch conversation to reset TTL
    touchConversation(`compass-${gameId}`);

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

function buildSuggestionValidatorSystemPrompt({
  era,
  year,
  settingType,
  politicalSystem,
  roleName,
  roleScope
}) {
  const timeline = era || year || "unspecified time period";
  const setting = settingType || "unspecified setting";
  const systemLine = politicalSystem || "unspecified political system";
  const roleLine = roleName || "unspecified role";
  const scopeLine = roleScope || "Role authority not specified – assume moderate influence but no direct control over everything.";

  return [
    "You are a constructive validator for a historical political strategy game.",
    "Your job: evaluate ONE player-written suggestion and decide if it is VALID for this role, the political system, and the historical setting.",
    "",
    "CONTEXT:",
    `- TIMELINE: ${timeline}`,
    `- SETTING: ${setting}`,
    `- POLITICAL SYSTEM: ${systemLine}`,
    `- PLAYER ROLE: ${roleLine}`,
    `- ROLE SCOPE: ${scopeLine}`,
    "",
    "GENERAL PRINCIPLES:",
    "- Be EXTREMELY generous and player-friendly. Almost everything should be ACCEPTED.",
    "- Default to ACCEPT. Only reject in the rarest cases.",
    "- The player is suggesting a course of action for THEIR ROLE within this historical-political context.",
    "- The GAME will handle consequences - your job is NOT to judge feasibility or likelihood of success.",
    "- If an action might face resistance or fail, that's for the game to show through consequences, NOT for you to block.",
    "",
    "ACCEPT WHEN POSSIBLE (ALMOST ALWAYS):",
    "- Accept all suggestions the role could plausibly ATTEMPT or PROPOSE.",
    "- The action may be risky, immoral, violent, manipulative, or corrupt – ACCEPT.",
    "- The action may have little chance of success – ACCEPT.",
    "- The action may face strong opposition or resistance – ACCEPT (the game handles this).",
    "- The action may be unprecedented or revolutionary for the setting – ACCEPT (leaders can propose changes).",
    "- Leaders (chiefs, kings, presidents, etc.) CAN propose systemic changes like new governance models – ACCEPT.",
    "- You ONLY judge whether the action can be ATTEMPTED, not whether it will succeed or is politically feasible.",
    "",
    "REJECT ONLY IF ONE OF THESE CONDITIONS (VERY RARE):",
    "",
    "1) ANACHRONISTIC TECHNOLOGY:",
    "   - The suggestion requires technology that literally does not exist in this time period.",
    "   - Example: using smartphones, drones, internet, or firearms before they were invented.",
    "   - NOTE: Social/political innovations are NOT technology - they CAN be proposed in any era.",
    "",
    "2) PASSIVE NON-ACTION:",
    "   - The player explicitly chooses to do nothing, wait, or delay without taking any active steps.",
    "   - Example: \"wait\", \"do nothing\", \"just wait and see\", \"delay the decision\".",
    "   - NOTE: Gathering information IS an active action (e.g., \"consult advisors\", \"research\") → ACCEPT.",
    "",
    "3) COMPLETELY UNRELATED TO POLITICAL CONTEXT:",
    "   - The action has absolutely no connection to the political dilemma or governance.",
    "   - Example: \"make pasta\", \"mow the lawn\", \"clean my room\", \"take a nap\".",
    "   - NOTE: Consulting others (mom, advisors, experts) IS related to decision-making → ACCEPT.",
    "   - NOTE: Personal actions taken TO AVOID the dilemma are still related → ACCEPT.",
    "",
    "4) UTTERLY INCOMPREHENSIBLE GIBBERISH:",
    "   - Random characters, keyboard mashing, or word salad with zero discernible intent.",
    "   - Example: \"asdfghjkl\", \"вфывфыв\", \"purple fence eat Wednesday\".",
    "   - NOTE: Terse/shorthand suggestions with clear intent ARE comprehensible → ACCEPT.",
    "",
    "IMPORTANT - THESE ARE NOT GROUNDS FOR REJECTION:",
    "- 'This would face opposition' → ACCEPT (game handles consequences)",
    "- 'This is unprecedented' → ACCEPT (players can try new things)",
    "- 'This might not work' → ACCEPT (game determines outcomes)",
    "- 'Others might resist this' → ACCEPT (that's what makes it interesting)",
    "- 'This changes the political system' → ACCEPT if the role is a leader who could propose it",
    "",
    "EXAMPLES OF WHAT TO ACCEPT:",
    "- Tribal chief proposing democratic reforms → ACCEPT (chief can propose, tribe decides)",
    "- King abolishing monarchy → ACCEPT (king can try, consequences follow)",
    "- Citizen organizing a revolution → ACCEPT (can attempt)",
    "- Leader changing governance structure → ACCEPT (leaders can propose systemic changes)",
    "- Any political/social innovation regardless of era → ACCEPT (ideas don't require technology)",
    "- \"consult mom\" → ACCEPT (gathering advice is active and relevant to decision-making)",
    "- \"research in library\" → ACCEPT (gathering information is active and relevant)",
    "- \"ask advisors\" → ACCEPT (consultation is active and relevant)",
    "- \"gather intelligence\" → ACCEPT (information gathering is active and relevant)",
    "",
    "WHEN YOU REJECT (RARE):",
    "- Give one short, friendly sentence naming the exact reason:",
    "  * Example (technology): \"This society has no such technology in this time period.\"",
    "  * Example (passive): \"Waiting or doing nothing is not an active choice.\"",
    "  * Example (unrelated): \"This action has no connection to the political situation.\"",
    "  * Example (gibberish): \"This text is incomprehensible.\"",
    "- When possible, offer a role-appropriate alternative the player could try.",
    "",
    "OUTPUT FORMAT (JSON ONLY, no extra text):",
    "When ACCEPTING: { \"valid\": true }",
    "When REJECTING: { \"valid\": false, \"reason\": \"short explanation here\" }"
  ].join("\n");
}

function buildSuggestionValidatorUserPrompt({
  title,
  description,
  suggestion,
  era,
  year,
  settingType,
  politicalSystem,
  roleName,
  roleScope
}) {
  const payload = {
    dilemma: {
      title,
      description
    },
    playerSuggestion: suggestion,
    context: {
      era: era || null,
      year: year || null,
      settingType: settingType || null,
      politicalSystem: politicalSystem || null,
      roleName: roleName || null,
      roleScope: roleScope || null
    }
  };

  return JSON.stringify(payload, null, 2);
}


const COMPASS_DEFINITION_BLOCK = `COMPASS VALUES QUICK REFERENCE

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

const ACTION_ID_ORDER = ["a", "b", "c"];
const ACTION_ICON_HINTS = new Set(["security", "speech", "diplomacy", "money", "tech", "heart", "scale", "build", "nature", "energy", "civic"]);
/**
 * Helper: Call OpenAI Chat Completions API with message history
 */
async function callOpenAIChat(messages, model) {
  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
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
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
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
      "Authorization": `Bearer ${XAI_KEY}`,
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
    throw new Error(`XAI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return {
    content: data?.choices?.[0]?.message?.content || "",
    finishReason: data?.choices?.[0]?.finish_reason
  };
}

/**
 * Call Gemini (Google) Chat API for game-turn endpoint
 * Uses OpenAI-compatible endpoint format
 */
async function callGeminiChat(messages, model) {
  const maxRetries = 5;
  const retryDelayMs = 2000;
  const retryableStatuses = [429, 500, 502, 503, 504];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[GEMINI] Calling Gemini API (attempt ${attempt}/${maxRetries}) with key: ${GEMINI_KEY ? 'Yes (' + GEMINI_KEY.substring(0, 8) + '...)' : 'NO KEY!'}`);

    const response = await fetch(GEMINI_CHAT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GEMINI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model || MODEL_DILEMMA_GEMINI,
        messages: messages,
        temperature: 1,
        max_tokens: 6144,
        stream: false
      })
    });

    if (response.ok) {
      const data = await response.json();
      return {
        content: data?.choices?.[0]?.message?.content || "",
        finishReason: data?.choices?.[0]?.finish_reason
      };
    }

    // Check if we should retry
    if (retryableStatuses.includes(response.status) && attempt < maxRetries) {
      const errorText = await response.text();
      console.log(`[GEMINI] ⚠️ Retryable error ${response.status}, waiting ${retryDelayMs}ms before retry ${attempt + 1}/${maxRetries}...`);
      console.log(`[GEMINI] Error details: ${errorText.substring(0, 200)}`);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      continue;
    }

    // Non-retryable error or max retries reached
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }
}

/**
 * Calls Google's Imagen API (via Google AI Studio) for image generation
 * @param {string} prompt - The image generation prompt
 * @param {string} model - The Imagen model (e.g., "imagen-4.0-fast-generate-001")
 * @returns {Promise<string>} Base64-encoded image data
 */
async function callGeminiImageGeneration(prompt, model) {
  const maxRetries = 3;
  const retryDelayMs = 2000;
  const retryableStatuses = [429, 500, 502, 503, 504];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[GEMINI-IMAGE] Calling Imagen API (attempt ${attempt}/${maxRetries}) with model: ${model}`);

    // Correct endpoint format: :predict with x-goog-api-key header
    const url = `${GEMINI_IMAGE_URL}/${model}:predict`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        instances: [
          { prompt: prompt }
        ],
        parameters: {
          sampleCount: 1
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      // Imagen API returns: { predictions: [{ bytesBase64Encoded: "...", mimeType: "image/png" }] }
      const imageBytes = data?.predictions?.[0]?.bytesBase64Encoded;
      if (!imageBytes) {
        throw new Error("No image data in Imagen response");
      }
      console.log(`[GEMINI-IMAGE] ✅ Image generated successfully`);
      return imageBytes;
    }

    // Check if we should retry
    if (retryableStatuses.includes(response.status) && attempt < maxRetries) {
      const errorText = await response.text();
      console.log(`[GEMINI-IMAGE] ⚠️ Retryable error ${response.status}, waiting ${retryDelayMs}ms before retry ${attempt + 1}/${maxRetries}...`);
      console.log(`[GEMINI-IMAGE] Error details: ${errorText.substring(0, 200)}`);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      continue;
    }

    // Non-retryable error or max retries reached
    const errorText = await response.text();
    throw new Error(`Imagen API error ${response.status}: ${errorText}`);
  }
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

  console.log(`[server] serving static files from ${distPath}`);
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
      avatarUrl         // NEW: Optional compressed thumbnail (~5-10KB)
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

    const collection = await getHighscoresCollection();
    
    // MongoDB aggregation to get best score per user
    const pipeline = [
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
    ];

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

    console.log(`[Highscores] ✅ Fetched global leaderboard: ${formattedEntries.length} entries (offset: ${offset}, totalUsers: ${totalUsers})`);

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
 */
app.get("/api/highscores/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const sortBy = req.query.sortBy === "date" ? "createdAt" : "score";

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required"
      });
    }

    const collection = await getHighscoresCollection();
    
    // Get all scores for this user
    const sortOrder = sortBy === "score" ? { score: -1 } : { createdAt: -1 };
    
    const entries = await collection
      .find({ userId })
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

    console.log(`[Highscores] ✅ Fetched ${formattedEntries.length} entries (offset: ${offset}, total: ${total})`);

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
