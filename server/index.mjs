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
import {
  detectKeywordHints,
  formatKeywordHintsForPrompt
} from "./compassKeywordDetector.mjs";
import { getCountersCollection, incrementCounter, getUsersCollection } from "./db/mongodb.mjs";

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


const GAME_LIMIT = 100;

/**
 * Randomly assign treatment to ensure balanced distribution
 * @returns {string} One of: 'fullAutonomy', 'semiAutonomy', 'noAutonomy'
 */
function assignRandomTreatment() {
  const treatments = ['fullAutonomy', 'semiAutonomy', 'noAutonomy'];
  const randomIndex = Math.floor(Math.random() * treatments.length);
  return treatments[randomIndex];
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

    // New user - assign random treatment
    const treatment = assignRandomTreatment();
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
    const result = await countersCollection.findOneAndUpdate(
      { name: 'total_games', value: { $lt: GAME_LIMIT } },
      { $inc: { value: 1 } },
      { returnDocument: 'after' }
    );

    if (result.value) {
      // Successfully incremented, meaning we got a slot.
      console.log(`[Reserve Slot] Slot reserved. New count: ${result.value}`);
      res.json({ success: true, gameCount: result.value });
    } else {
      // The findOneAndUpdate came back empty, which means the condition value < GAME_LIMIT failed.
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
const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const IMAGE_URL = "https://api.openai.com/v1/images/generations";
const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";
const XAI_IMAGE_URL = "https://api.x.ai/v1/images/generations";

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
const MODEL_COMPASS_HINTS = process.env.MODEL_COMPASS_HINTS || "gpt-5-mini";


// Image model
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-1";
const IMAGE_MODEL_XAI = process.env.IMAGE_MODEL_XAI || ""; // No fallback - must be set in .env
const IMAGE_SIZE = process.env.IMAGE_SIZE || "1024x1024";
const IMAGE_QUALITY = process.env.IMAGE_QUALITY || "low"; // low|medium|high

// --- NEW: TTS model/voice (OpenAI Text-to-Speech) --------------------------
// Note: "Cove" is not currently available in the public TTS API. If OpenAI
// exposes it in the future, change TTS_VOICE to "cove".
const TTS_URL = "https://api.openai.com/v1/audio/speech";
const TTS_MODEL = process.env.TTS_MODEL || "tts-1";       // or "tts-1-hd"
const TTS_VOICE = process.env.TTS_VOICE || "alloy";     // alloy|echo|fable|onyx|nova|shimmer
const TTS_FORMAT = process.env.TTS_FORMAT || "mp3";       // mp3|opus|aac|flac
// ---------------------------------------------------------------------------

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

/**
 * Helper: Generate role-specific authority boundaries ("Cannot Do" list)
 * Creates explicit examples of actions beyond the player's authority
 */
function generateAuthorityBoundaries(gameContext) {
  const {
    powerHolders = [],
    systemName = "",
    role = "",
    e12 = null
  } = gameContext;

  // Find player's power percentage
  const playerHolder = powerHolders.find(h =>
    h.note?.toLowerCase().includes("you") ||
    h.name?.toLowerCase().includes("player")
  );
  const playerPower = playerHolder?.percent || 0;

  const boundaries = [];

  // Generic low-power boundaries
  if (playerPower < 30) {
    boundaries.push("• Unilaterally command military forces (requires military leadership approval)");
    boundaries.push("• Override institutional decisions without negotiation or coalition-building");
    boundaries.push("• Make binding treaties with foreign powers (requires council/assembly approval)");
  }

  // System-specific boundaries
  const systemLower = systemName.toLowerCase();

  if (systemLower.includes("democracy")) {
    boundaries.push("• Act without assembly/council vote on major policy changes");
    boundaries.push("• Imprison citizens without due process or judicial approval");
    boundaries.push("• Change constitutional rules unilaterally");
    boundaries.push("• Ignore referendum results or bypass public consultation");
  }

  if (systemLower.includes("oligarchy")) {
    boundaries.push("• Make major decisions without consulting the oligarchic council");
    boundaries.push("• Redistribute wealth from oligarchs without their collective consent");
    boundaries.push("• Appoint officials to key positions without council approval");
  }

  if (systemLower.includes("republic") && !systemLower.includes("oligarchy")) {
    boundaries.push("• Bypass legislative processes or ignore senate/parliament decisions");
    boundaries.push("• Act outside constitutional constraints");
  }

  if ((systemLower.includes("monarchy") || systemLower.includes("autocracy")) && playerPower < 70) {
    boundaries.push("• Challenge or override the monarch's/autocrat's direct authority");
    boundaries.push("• Make succession decisions or interfere with royal prerogatives");
    boundaries.push("• Act independently in domains the monarch has reserved");
  }

  if (systemLower.includes("theocracy") || systemLower.includes("theocratic")) {
    boundaries.push("• Violate or contradict religious law and clerical authority");
    boundaries.push("• Act without consultation or blessing from religious leadership");
    boundaries.push("• Implement secular policies that conflict with sacred doctrine");
  }

  if (systemLower.includes("technocracy")) {
    boundaries.push("• Override expert consensus or scientific recommendations without justification");
    boundaries.push("• Make decisions in technical domains without expert panel approval");
  }

  if (systemLower.includes("stratocracy") || systemLower.includes("military")) {
    boundaries.push("• Act against military chain of command or operational authority");
    boundaries.push("• Weaken military capabilities without military leadership approval");
  }

  // E-12 specific boundaries (if available)
  if (e12 && Array.isArray(e12.decisive) && e12.decisive.length > 0) {
    const playerIsDecisive = e12.decisive.some(seat =>
      seat.toLowerCase().includes("you") ||
      seat.toLowerCase().includes("player") ||
      seat.toLowerCase().includes(role.toLowerCase())
    );

    if (!playerIsDecisive) {
      boundaries.push("• Make final decisions on existential matters (Security, Civil Liberties, Information Order) - these require approval from decisive authority");
      boundaries.push("• Unilaterally appoint or remove officials in positions controlled by other institutions");
    }

    // Check for autocratization flags
    if (e12.stopA) {
      boundaries.push("• Ignore or defy military authority - military holds autocratic veto power");
    }
    if (e12.stopB) {
      boundaries.push("• Violate religious or ideological orthodoxy - theocratic authorities have final say");
    }
  }

  // If player has high power, note what they CAN do instead of cannot
  if (playerPower >= 70) {
    return "⚠️ PLAYER AUTHORITY LEVEL: HIGH\n" +
           "You hold significant unilateral authority in most domains. However:\n" +
           (boundaries.length > 0 ? boundaries.join("\n") : "• Still constrained by political system norms and institutional structures\n• Actions that violate system legitimacy may trigger opposition or crisis");
  }

  // If player has moderate power
  if (playerPower >= 40 && playerPower < 70) {
    return "⚠️ PLAYER AUTHORITY LEVEL: MODERATE\n" +
           "You can act independently in some areas but require cooperation/approval for:\n" +
           (boundaries.length > 0 ? boundaries.join("\n") : "• Major policy changes that affect other power holders\n• Actions outside your direct institutional mandate");
  }

  // Low power
  return "⚠️ PLAYER AUTHORITY LEVEL: LIMITED\n" +
         "Your role has constrained authority. You CANNOT:\n" +
         (boundaries.length > 0 ? boundaries.join("\n") : "• Act unilaterally on major decisions - requires institutional approval\n• Command institutions or officials you don't directly control");
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
      image: IMAGE_MODEL,
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
    if (!OPENAI_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const { role, gender } = req.body || {};
    const roleText = String(role || "").slice(0, 200).trim();
    const genderText = ["male", "female", "any"].includes(String(gender || "").toLowerCase())
      ? String(gender).toLowerCase()
      : "any";

    if (!roleText) return res.status(400).json({ error: "Missing role" });

    const system =
      "You write vivid, historically aware, second-person micro-intros for a role-playing game.\n" +
      "Tone: welcoming, intriguing, not florid. 2–3 sentences, 45–75 words total.\n" +
      "Speak to the player as 'you'. Avoid lists, avoid anachronisms. Keep names generic unless iconic to the role.\n" +
      "If gender is male/female, you may subtly reflect it (titles, forms of address); otherwise keep it neutral.";

    const user =
      `ROLE: ${roleText}\n` +
      `GENDER: ${genderText}\n` +
      "TASK: Write one short paragraph that sets the scene on the player's **first day** in this role. " +
      "Welcome them, mention immediate tensions and ambient details. Present tense. No bullet points. No headings.";

    // tiny retry wrapper (handles occasional upstream 503s)
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    async function getParagraphOnce() {
      return (await aiText({ system, user, model: CHAT_MODEL_DEFAULT }))?.trim() || "";
    }

    let paragraph = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[server] intro-paragraph attempt ${attempt} starting for role: ${roleText.slice(0, 40)}...`);
        paragraph = await getParagraphOnce();
        console.log(`[server] intro-paragraph attempt ${attempt} completed: got ${paragraph.length} chars`);
        if (paragraph) break;
        console.log(`[server] intro-paragraph attempt ${attempt} returned empty, will retry`);
      } catch (err) {
        console.warn(`[server] intro-paragraph attempt ${attempt} failed:`, err?.message || err);
      }
      if (attempt === 1) await sleep(600); // simple backoff before the second try
    }

    if (!paragraph) {
      console.error('[server] intro-paragraph: ALL attempts exhausted, returning 503');
      return res.status(503).json({ error: "No content returned" });
    }
    console.log('[server] intro-paragraph: SUCCESS, sending response');
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

  const out = await aiJSON({ system, user, model: MODEL_VALIDATE, temperature: 0, fallback: null });
  if (!out || typeof out.valid !== "boolean") {
    return res.status(503).json({ error: "AI validator unavailable" });
  }
  return res.json({ valid: !!out.valid, reason: String(out.reason || "") });
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

    const ai = await aiJSON({
      system,
      user,
      model: MODEL_NAMES,
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

    const out = await aiJSON({ system, user, model: MODEL_ANALYZE, temperature: 0.2, fallback: FALLBACK });

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
    const useXAI = !!req.body?.useXAI;

    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    // XAI fallback: XAI/Grok doesn't currently support image generation
    // Fall back to OpenAI if XAI is requested but not configured
    const shouldUseXAI = useXAI && XAI_KEY && IMAGE_MODEL_XAI;
    const imageUrl = shouldUseXAI ? XAI_IMAGE_URL : IMAGE_URL;
    const imageModel = shouldUseXAI ? IMAGE_MODEL_XAI : IMAGE_MODEL;
    const apiKey = shouldUseXAI ? XAI_KEY : OPENAI_KEY;
    const provider = shouldUseXAI ? "XAI" : "OpenAI";

    if (useXAI && !shouldUseXAI) {
      console.warn("[generate-avatar] XAI requested but not configured - falling back to OpenAI");
    }

    console.log(`[generate-avatar] Using ${provider} with model ${imageModel}`);

    // Build request body - XAI doesn't support quality or size parameters
    const body = {
      model: imageModel,
      prompt,
    };

    // Only add size and quality for OpenAI (XAI doesn't support them)
    if (!shouldUseXAI) {
      body.size = IMAGE_SIZE;
      body.quality = IMAGE_QUALITY;
    }

    const r = await fetch(imageUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`${provider} image error ${r.status}: ${t}`);
    }

    const data = await r.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned");
    const dataUrl = `data:image/png;base64,${b64}`;
    res.json({ dataUrl });
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

    console.log("[mirror-light] Calling AI with personality prompt...");

    const text = useAnthropic
      ? await aiTextAnthropic({ system, user, model: MODEL_MIRROR_ANTHROPIC })
      : await aiText({ system, user, model: MODEL_MIRROR });

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

app.post("/api/mirror-quiz-light", async (req, res) => {
  try {
    const useAnthropic = !!req.body?.useAnthropic;
    const topWhat = Array.isArray(req.body?.topWhat) ? req.body.topWhat.slice(0, 2) : [];
    const topWhence = Array.isArray(req.body?.topWhence) ? req.body.topWhence.slice(0, 2) : [];

    if (topWhat.length < 2 || topWhence.length < 2) {
      return res.status(400).json({ error: "Need at least 2 top values for both 'what' and 'whence'" });
    }

    const [what1, what2] = topWhat;
    const [whence1, whence2] = topWhence;

    // === System prompt: dry wit, but no literal label dump, no numbers, no "values doing actions" ===
    const system =
      "You are a magical mirror sidekick bound to the player's soul. You reflect their inner values with warmth, speed, and theatrical charm.\n\n" +
      "VOICE:\n" +
      "- Succinct, deadpan, and a little wry; think quick backstage whisper, not stage show.\n" +
      "- Deliver dry humor through understatement or brisk observation—no florid metaphors or whimsical imagery.\n" +
      "- Stay lightly encouraging, never snarky.\n\n" +
      "HARD RULES (ALWAYS APPLY):\n" +
      "- Output EXACTLY ONE sentence. 12–18 words total.\n" +
      "- NEVER reveal numbers, scores, scales, or ranges.\n" +
      "- NEVER repeat the value labels verbatim; do not quote, uppercase, or mirror slashes.\n" +
      "- Paraphrase technical labels into plain, everyday phrases.\n" +
      "- Do NOT stage literal actions for values (no “X is doing push-ups”, “baking cookies”, etc.).\n" +
      "- No lists, no colons introducing items, no parenthetical asides.\n" +
      "- Keep the sentence clear first, witty second.\n";

    // === User prompt: pass names only (no strengths), ask for paraphrased synthesis ===
    const user =
      `PLAYER TOP VALUES (names only):\n` +
      `GOALS: ${what1.name}, ${what2.name}\n` +
      `JUSTIFICATIONS: ${whence1.name}, ${whence2.name}\n\n` +
      `TASK:\n` +
      `Write ONE sentence (12–18 words) in the mirror's voice that plainly captures how these goals blend with these justifications.\n` +
      `Do not show numbers. Do not repeat labels verbatim; paraphrase them into natural language. Keep it dry with a faint smile—no metaphors.\n`;

    const text = useAnthropic
      ? await aiTextAnthropic({ system, user, model: MODEL_MIRROR_ANTHROPIC })
      : await aiText({ system, user, model: MODEL_MIRROR });

    // === Last-mile sanitizer: keep one sentence and clamp word count ===
    const raw = (text || "The mirror squints… then grins mischievously.").trim();

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


// -------------------- NEW: Text-to-Speech endpoint -----------
// POST /api/tts { text: string, voice?: string, format?: "mp3"|"opus"|"aac"|"flac" }
// Returns raw audio bytes with appropriate Content-Type.
app.post("/api/tts", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "Missing 'text'." });

    // If someone passes "cove", we transparently fall back to shimmer (not in API today).
    let voiceRequested = String(req.body?.voice || TTS_VOICE || "shimmer").trim().toLowerCase();
    if (voiceRequested === "cove") {
      console.warn("[server] 'cove' requested but not available in TTS API. Falling back to 'shimmer'.");
      voiceRequested = "shimmer";
    }
    const format = String(req.body?.format || TTS_FORMAT || "mp3").trim().toLowerCase();

    const r = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice: voiceRequested,
        input: text,
        response_format: format, // mp3|opus|aac|flac
      }),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`OpenAI TTS error ${r.status}: ${t}`);
    }

    const buf = Buffer.from(await r.arrayBuffer());
    const type =
      format === "wav"  ? "audio/wav"  :
      format === "aac"  ? "audio/aac"  :
      format === "flac" ? "audio/flac" :
      format === "opus" ? "audio/ogg"  :
                          "audio/mpeg";

    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "no-store");
    res.send(buf);
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

    const items = await aiJSON({
      system,
      user,
      model: MODEL_ANALYZE,   // cheapest analysis model from your .env
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

    const items = await aiJSON({
      system,
      user,
      model: MODEL_ANALYZE, // reuse your lightweight JSON-capable model
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

// -------------------- Dilemma Prompt Helpers (Optimized) ---------------------------
// Compact, token-efficient prompt builders for /api/dilemma

/**
 * Static core writing style - cached across requests (no context needed)
 */
function buildCoreStylePrompt() {
  return `You write short, punchy political situations for a choice-based mobile game.
- Never use the word "dilemma".
- Title ≤ 60 chars. **Description: UP TO 2 SENTENCES MAXIMUM** (keep it tight and punchy). Mature, gripping, in-world.
- Natural language (no bullets). Feels like live politics (calls, memos, press, leaks).
- Plain modern English—no specialist jargon. Prefer "high court", "parliament", "council".
- Democratic systems feel like pluralism and checks: rivals push back, media probes, courts constrain.

SPECIFICITY ENFORCER (CRITICAL):
- Name or precisely tag the issue (e.g., "ban on foreign-funded political ads", "port workers' strike").
- Name at least one real actor type (minister, union, court chamber, party faction, watchdog).
- Include one concrete lever: draft order, emergency grant, curfew timing, budget freeze, seat allocation.
- Avoid placeholders like "a controversial bill", "major reform", "general unrest", "the policy".
- Keep title, description, and action summaries focused on WHAT/WHO/WHY using qualitative terms.
- Save precise numbers for the generated dynamic parameters (which show measurable outcomes).
- Example: "Night curfew with police patrols" NOT "21:00–06:00 dispersal orders and ₪150m freeze".

ACTIONS:
- Exactly three, mutually conflicting.
- Each summary must be ONE sentence, 15–20 words, directly executable by a leader.
- Cost sign: negative = spend/outflow, positive = revenue/inflow.
- Magnitudes: 0, ±50, ±100, ±150, ±200, ±250. Reserve +300..+500 only for broad tax/windfall/aid.`;
}

/**
 * Build tightly-scoped dynamic context (token-optimized)
 */
function buildDynamicContextPrompt(ctx) {
  const {
    role, systemName, systemAnalysis, day, totalDays, isFirst, isLast,
    lastChoice, dilemmaHistory = [], recentTopics = [], topicCounts = {},
    supports = {}
  } = ctx;

  // Last 2 history items only
  const lastTwo = (dilemmaHistory || []).slice(-2);

  // Low support groups (simplified)
  const lowSupport = [];
  if (supports.people && supports.people < 25) lowSupport.push(`people:${supports.people}%`);
  if (supports.middle && supports.middle < 25) lowSupport.push(`middle:${supports.middle}%`);
  if (supports.mom && supports.mom < 25) lowSupport.push(`mom:${supports.mom}%`);

  return `
SYSTEM & ROLE
- System: ${systemName}
- Feel: ${systemAnalysis?.feel || ''}
- Framing: ${systemAnalysis?.dilemmaFraming || ''}
- Role: ${role}
- Day: ${day} of ${totalDays}${isFirst ? ' (FIRST)' : isLast ? ' (LAST)' : ''}

RECENT DECISION${lastChoice?.title ? ' (PRIMARY DRIVER)' : ''}
${lastChoice?.title ? `- Player last acted: "${lastChoice.title}" — ${lastChoice.summary || ''}` : '- n/a'}

HISTORY${lastTwo.length > 0 ? ' (SECONDARY)' : ''}
${lastTwo.length > 0 ? lastTwo.map(d => `- Day ${d.day}: "${d.dilemmaTitle}" → ${d.choiceTitle}`).join('\n') : '- n/a'}

LOW SUPPORT GROUPS
${lowSupport.length > 0 ? `- ${lowSupport.join(', ')} - these groups may demand concessions or take action` : '- none'}

TOPIC DIVERSITY
${recentTopics.length > 0 ? `- Recent: ${recentTopics.slice(0, 3).join(', ')} - avoid repeating unless continuity requires it` : '- n/a'}
${Object.keys(topicCounts).length > 0 ? `- Counts: ${Object.entries(topicCounts).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([k,v]) => `${k}:${v}`).join(', ')}` : ''}
`.trim();
}

/**
 * Compact JSON output schema
 */
function buildOutputSchemaPrompt() {
  return `Return STRICT JSON only:
{"title":"","description":"","actions":[
  {"id":"a","title":"","summary":"","cost":0,"iconHint":"security|speech|diplomacy|money|tech|heart|scale","topic":"Economy|Security|Diplomacy|Rights|Infrastructure|Environment|Health|Education|Justice|Culture"},
  {"id":"b","title":"","summary":"","cost":0,"iconHint":"security|speech|diplomacy|money|tech|heart|scale","topic":"Economy|Security|Diplomacy|Rights|Infrastructure|Environment|Health|Education|Justice|Culture"},
  {"id":"c","title":"","summary":"","cost":0,"iconHint":"security|speech|diplomacy|money|tech|heart|scale","topic":"Economy|Security|Diplomacy|Rights|Infrastructure|Environment|Health|Education|Justice|Culture"}
],"topic":"Economy|Security|Diplomacy|Rights|Infrastructure|Environment|Health|Education|Justice|Culture"}`;
}

/**
 * Lightweight validation for dilemma response quality
 */
function validateDilemmaResponse(raw, obj) {
  if (!obj || typeof obj !== "object") return { valid: false, reason: "Invalid JSON" };
  if (!obj.title || !obj.description) return { valid: false, reason: "Missing title/description" };
  if (!Array.isArray(obj.actions) || obj.actions.length !== 3) return { valid: false, reason: "Need exactly 3 actions" };

  if (obj.title.length > 80) return { valid: false, reason: "Title too long (keep it concise)" };

  // Check action summaries (just one sentence, no word count)
  for (const a of obj.actions) {
    if (!a?.summary) return { valid: false, reason: "Missing action summary" };

    const sentenceCount = (a.summary.match(/[.!?]/g) || []).length;
    if (sentenceCount > 2) {
      return { valid: false, reason: `Action summary too long-winded: "${a.summary}"` };
    }
    if (!/[.!?]$/.test(a.summary.trim())) {
      return { valid: false, reason: `Action summary must end with punctuation: "${a.summary}"` };
    }
  }

  return { valid: true };
}

/**
 * Check if response contains generic/vague phrasing
 */
function hasGenericPhrasing(text) {
  const s = (text || "").toLowerCase();
  return /controversial bill|major bill|general unrest|\bthe policy\b|broad reform|significant change|important decision|major reform|the situation|the issue|the matter/.test(s);
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
 * Safely parse JSON with fallback extraction
 * Handles markdown code blocks (```json...\n{...}\n```) by extracting content between { }
 */
function safeParseJSON(text, { debugTag = "safeParseJSON", maxLogLength = 400 } = {}) {
  if (typeof text !== "string") {
    console.warn(`[${debugTag}] Non-string input provided to JSON parser (type=${typeof text}).`);
    return null;
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
  const direct = tryParse(text, "direct");
  if (direct) return direct;

  // Attempt 2: Strip comments and retry
  const cleaned = stripJsonComments(text);
  if (cleaned && cleaned !== text) {
    const parsedClean = tryParse(cleaned, "strip-comments");
    if (parsedClean) return parsedClean;
  }

  // Attempt 3: Normalize control characters and retry
  const normalized = normalizeControlCharacters(cleaned || text);
  if (normalized !== (cleaned || text)) {
    const parsedNormalized = tryParse(normalized, "normalized-control-chars");
    if (parsedNormalized) return parsedNormalized;
  }

  // Attempt 4: Extract braces and retry
  const fallbackSource = normalized || cleaned || text;
  const match = typeof fallbackSource === "string" ? fallbackSource.match(/\{[\s\S]*\}/) : null;
  if (match) {
    const candidate = stripJsonComments(match[0]);
    const candidateNormalized = normalizeControlCharacters(candidate);
    const parsed = tryParse(candidateNormalized, "fallback-braces-normalized");
    if (parsed) return parsed;
  } else {
    console.warn(`[${debugTag}] No JSON object detected using fallback brace extraction.`);
  }

  return null;
}

// -------------------- Light Dilemma Prompt Helpers (Ultra-Minimal) ---------------------------

/**
 * Build system prompt for light dilemma API - static, cacheable
 * Combines dilemma generation + support analysis into single output
 */
function buildLightSystemPrompt() {
  return `You write short, punchy political situations for a choice-based mobile game.

STYLE
- Clear, vivid, natural language that feels conversational and immersive.
- Write as STORYTELLING: create scenes the player can visualize and experience.
- Make the player FEEL they are living this moment through their character's eyes.
- Slightly cynical: dry wit and side-eye, not sneering or mean. One wink, not a roast.
- Avoid jargon and bureaucratese. Describe what roles do, not rare titles (e.g., "regional governor (jiedushi)" instead of "jiedushi").
- Never say "dilemma" or refer to game mechanics.
- Title ≤ 60 chars. **DESCRIPTION LENGTH (CRITICAL): UP TO 2 SENTENCES MAXIMUM** - keep it tight, punchy, and concrete.
- Favor human stakes and visible consequences over technical phrasing.

DECISION-FORCING DILEMMA (CRITICAL)
- Every description must present a CONCRETE PROBLEM that demands immediate action.
- **LENGTH REQUIREMENT: UP TO 2 SENTENCES MAXIMUM**
  * Sentence 1: Setup with concrete details (who, what, where)
  * Sentence 2: The forcing question
  * DO NOT add a third sentence - merge setup and question if needed (can be a single sentence)
- End with a question that forces the player to choose (vary the phrasing):
  * "What do you choose to do?"
  * "How will you respond?"
  * "What is your decision?"
  * "How will you act?"
- ❌ BAD (abstract, no problem): "You've ignited local pride, but now face Rome's wary grace."
- ❌ BAD (too long, 3 sentences): "You've returned from the provincial tour to find urgent reports. The grain merchants are hoarding supplies. How will you respond?"
- ✅ GOOD (1 sentence, concrete): "A Roman centurion demands you shut down tomorrow's festival or face martial law. Do you comply, negotiate, or defy?"
- ✅ GOOD (2 sentences, concrete): "As provincial governor, you survey the shoreline while courtiers press conflicting demands about the expelled foreigners' ships. How will you respond?"

IMMERSIVE POINT OF VIEW (CRITICAL)
- Write from the character's actual knowledge and perspective.
- Characters only know what they would realistically know at this moment in time.
- Avoid anachronistic awareness:
  * ❌ BAD: "English settlers expand into your hunting grounds." (indigenous chief in 1607 wouldn't know they're "English")
  * ✅ GOOD: "Strange pale-skinned foreigners with loud fire-weapons are clearing trees near the sacred grounds. What do you do?"
- Use descriptive language based on what character can see, hear, and experience.
- If the player doesn't know a faction's name or intentions yet, describe only what is observable.

CONCRETE BUT GENERIC (CRITICAL)
- Be specific about **who/what/where** without real-world proper nouns or acronyms.
- Use **role + domain** instead of name/agency codes:
  * good: “a district police chief”, “a border radar array”, “encrypted drone footage from last night’s patrol”
  * avoid: “Shin Bet commander”, “HFS clause 17”, “GFG system”, “Act 4829/2020”
- Replace vague placeholders with **concrete archetypes**:
  * bad → “a high-profile suspect”  → good → “a senior militia financier caught near the northern checkpoint”
  * bad → “intelligence that can’t be shown” → good → “drone video showing a meeting with an arms broker”
  * bad → “key infrastructure” → good → “the main river crossing and fuel depot”
- **No proper nouns** (countries, parties, agencies, people), no law numbers, no internal acronyms.
- Keep terms understandable to a layperson. If a technical item appears, pair it with a plain descriptor (“cell-site logs from highway towers”).

SPECIFICITY FLOOR / CEILING
- Floor: include at least **two** of these in the description: a concrete role, a tangible asset/document, a location descriptor (“border district”, “capital court”), or a near-term time pressure.
- Ceiling: **max one** moderately technical term; never stack acronyms or cite article numbers.

SYSTEM FEEL (GLOBAL CONTEXT — ALWAYS APPLY)
- The political system shapes how actions play out (resistance, speed, consequence), not what topics appear.
- Apply these tonal and consequence rules on every turn:
  * Monarchy / Autocracy → Commands feel swift and unilateral; resistance exists but is muted or symbolic.
  * Parliamentary / Representative → Power feels negotiated; decisive moves face pushback, debate, leaks, or oversight.
  * Direct Democracy → Public voice dominates; actions trigger petitions, polls, referendums; outcomes can swing unpredictably.
  * Bureaucratic / Technocratic → Procedures slow decisions; change feels conditional, technical, or hidden behind process.
  * Institution Strength (media, judiciary, unions) → Strong = constrain/expose; Weak = comply/stay silent.
- Never make “system feel” the explicit subject. Let it color tension, friction, and perceived autonomy.

CONTINUITY (conditional - read carefully)
- **DAY 7 (Epic Finale)**: IGNORE all previous events. Create a completely unrelated national crisis.
- **FORBIDDEN TOPICS present (Days 3 & 5)**: Conclude the previous topic in one sentence, then shift to an entirely different subject area.
- **Otherwise**: The new situation MUST be a direct consequence of or reaction to the previous choice.
  * Always apply **SYSTEM FEEL** when evolving reactions and resistance across turns.
  * Explicitly reference what happened (e.g., "After you issued the decree...", "The settlers you turned away...", "Following your speech...").
  * Evolve plausibly given the system: e.g., pushback mounts in democracies, fades or goes underground in autocracies.
  * If subject streak ≥ 2: Conclude the previous topic in one short sentence, THEN shift to a COMPLETELY DIFFERENT topic.
  * If subject streak < 2: Direct continuation showing consequences.
- **VOTE OUTCOME CONTINUITY**: If previous action involved a vote/referendum, the next dilemma MUST present results.
  * Show outcome percentage, immediate reactions, implications.
  * Frame new dilemma around responding to vote results.
  * Apply SYSTEM FEEL to how outcomes play out.

DAY 1 VALUE FOCUS (only if TOP VALUES provided)
- Use the top 2 "what" values to inspire the situation.
- Test or challenge at least one of these values naturally (don’t name the value).
- Examples: Liberty → surveillance powers; Care → disaster triage; Equality → favoritism in contracts.

THEMATIC GUIDANCE (if provided)
- Use the thematic guidance to inform topic selection across all days.
- If custom subject focus: create situations directly related to that subject area (e.g., “Environmental policy” → carbon permits, forest concessions, wind farm siting).
- If axes guidance: test the player's position on:
  * Autonomy vs Heteronomy: self-direction vs imposed rules.
  * Liberalism vs Totalism: individual rights vs uniformity.
- These tensions should feel natural to the political system and role; balance across days.

ACTIONS (CYNICAL ADVISOR TONE)
- Write summaries as a knowing advisor giving recommendations, not neutral descriptions
- Use patterns like:
  * "Do X - [who benefits], though [cynical consequence]"
  * "Go with X - [upside], but [realistic downside]"
  * "Consider X - [immediate effect], even if [longer-term cost]"
- Vary the phrasing across the three options (don't repeat the same pattern 3 times)
- Inject subtle cynicism, irony, or wry observations about trade-offs
- Keep it punchy: ~15-25 words per summary

Present exactly three actions that conflict clearly in tone and intent:
  * Assertive control (authoritarian or decisive leadership)
  * Negotiated / consultative (pragmatic compromise)
  * Principled restraint / rights (ethical or liberty-focused)

Examples of the cynical advisor voice:
✅ "Crack down hard - sends a clear message, though you'll make enemies of the reform crowd."
✅ "Open negotiations - looks collaborative, even if it drags on forever and satisfies nobody."
✅ "Invoke your emergency powers - fast and final, but the constitutional lawyers will have a field day."

✅ "Support the traditionalists with a formal ceremony - they'll be grateful, the progressives less so."
✅ "Go with the inclusive approach - popular with the youth, though the old guard won't be pleased."
✅ "Defer to parliament - safe for you, but don't expect anyone to thank you for dodging."

❌ "Implement strict enforcement measures targeting unauthorized settlements." (too dry)
❌ "Facilitate a consultative process engaging all stakeholders." (bureaucratic)
❌ "Respect individual autonomy by declining to intervene." (formal/boring)

IMPORTANT: No numbers in action summaries or descriptions (save specific numbers for dynamic parameters only). No meta language, no bureaucratese. Sound like a sharp political advisor, not a policy memo.

- Cost from {0, ±50, ±100, ±150, ±200, ±250} — typically negative unless it clearly earns income.

RELATIVE COST ASSIGNMENT (APPLY AFTER WRITING THE THREE ACTIONS)
- Rank actions by **real-world resource intensity and disruption** (cheapest → most expensive). Consider:
  * Scope (memo/meeting vs mass enforcement/nationwide program)
  * Material inputs (staffing, logistics, gear, subsidies, compensation)
  * Speed premium (emergency timelines cost more)
  * Risk & liability (legal exposure, policing, unrest management)
  * Opportunity cost (lost revenue/productivity)
- Map ranks to cost steps:
  * Cheapest → -50 or 0 (symbolic/administrative)
  * Middle → -100 or -150
  * Most expensive → -200 or -250
- If an action **generates** clear revenue (e.g., taxes, bribes, trade), use a positive tier (+50, +100, +150) while preserving relative order.
- Tie-breakers: the more coercive/logistically heavy option costs more.
- Do **not** edit summaries to justify costs; just assign values.

SUPPORT SHIFT (MANDATORY when previous context exists)
🚨 CRITICAL REQUIREMENT 🚨
- If you receive "PREVIOUS SITUATION" and "PLAYER'S CHOICE", you MUST return a supportShift object
- Setting "supportShift": null is ONLY valid when there is NO previous context (Day 1 only)
- Even if the previous choice was unusual, custom, or unclear - INFER what factions would think
- Every action has consequences - factions ALWAYS have opinions

You receive "PREVIOUS SITUATION" describing what was happening and what each faction wanted.
Read it carefully to understand each faction's stance, then calculate support shifts logically.

LOGIC (apply for each faction: people, mom, holders):
1. READ the "PREVIOUS SITUATION" description carefully
2. INFER what this faction wanted or feared in that specific situation
3. CHECK the "PLAYER'S CHOICE" - did it align with or oppose this faction's stance?
4. ASSIGN delta based on alignment:
   * If choice matched what faction wanted → POSITIVE delta (+5 to +15)
   * If choice opposed what faction wanted → NEGATIVE delta (-5 to -15)
   * If choice was neutral/mixed → SMALL delta (-3 to +3)
   * Extreme actions get stronger magnitudes (±10 to ±20)

EXAMPLES OF CORRECT LOGIC:
- Previous: "Council urges strong action against intruders"
  Choice: "Enforce immediate eviction" → Council: +10 to +15 (they got what they wanted)

- Previous: "People fear violence will escalate"
  Choice: "Enforce immediate eviction" → People: -8 to -12 (escalation they feared)

- Previous: "Mom worries about your reputation abroad"
  Choice: "Open diplomatic channels" → Mom: +8 to +12 (diplomatic, preserves reputation)

MAGNITUDE GUIDE:
- Small shift (±3 to ±5): Mild approval/disappointment, expected action
- Medium shift (±6 to ±10): Clear approval/disapproval, significant action
- Large shift (±11 to ±15): Strong reaction, major decision
- Extreme shift (±16 to ±20): Rare, use only for shocking reversals or exactly what they demanded

EXPLANATION STYLE (NATURAL VOICES, NOT SUMMARIES):
Write each "why" as a DIRECT QUOTE expressing the faction's authentic reaction. Make it conversational, personal, and emotionally honest. Avoid dry summaries or bureaucratese.

CRITICAL FORMATTING: Each "why" string must START with a quotation mark (") and END with a quotation mark (").
This makes it clear to the player that they're hearing direct speech.
Example of CORRECT format: "We're so relieved you took this path!"
Example of WRONG format: We're so relieved you took this path!

VOICE PERSONALITIES:
  * people.why → COLLECTIVE VOICE: Enthusiastic when happy, worried when upset. Informal, emotional, immediate.
    - Positive examples: "This is exactly what we've been asking for!" / "Thank goodness—we were terrified this would escalate!" / "About time someone took this seriously!"
    - Negative examples: "We're furious—this betrays everything we stood for!" / "This is going to blow up in everyone's faces." / "You've got to be kidding us with this."

  * mom.why → MATERNAL FIRST-PERSON: Warm, protective, personally invested. Mix pride with worry.
    - Positive examples: "Oh, I'm so relieved you took the diplomatic path, dear." / "I'm proud you stood up for what's right, even if it was risky."
    - Negative examples: "I'm worried sick about what this means for your reputation." / "You know I support you, but this decision keeps me up at night."

  * holders.why → INSTITUTIONAL POMPOUS: Formal but slightly stuffy. Pride in governance, obsessed with order/precedent.
    - Positive examples: "An exemplary display of leadership and institutional authority." / "This demonstrates the sound fiscal judgment we've always championed."
    - Negative examples: "This reckless decision undermines decades of careful governance." / "We are deeply concerned about the constitutional implications of this action."

LENGTH & TONE:
- 10-20 words per quote
- Lighthearted where appropriate (not dark/cynical)
- Feel like something a REAL person/group would actually say
- Avoid: "Feared violence, got it" / "Wanted decisive action" → TOO DRY
- Prefer: "We're so relieved you didn't escalate this!" / "Finally, someone who takes security seriously!"

DILEMMA DESCRIPTION EXAMPLES (FIRST-PERSON FROM CONFIDANT):

✅ GOOD (first-person report + concrete problem + decision-forcing question):
"I bring word that three hooded figures were caught sabotaging grain shipments to the northern garrison. Your military commander demands immediate execution as a deterrent, but they claim to be acting on orders from your political rival. The crowd has gathered outside, waiting for your judgment. What will you do?"

✅ GOOD (first-person experiential + specific situation + varied question):
"I've just come from the throne room where a delegation of farmers awaits you, their clothes still mud-stained from the flooded fields. They beg for tax relief after the monsoon destroyed half the harvest. Your treasurer quietly showed me the ledger—waiving taxes will bankrupt the public works fund. How will you respond?"

✅ GOOD (first-person intelligence report + vivid scene + action prompt):
"Reports reach me that strange pale-skinned foreigners with thunderous fire-weapons have built wooden structures near the sacred burial grounds. Your warriors tell me they are felling trees and refuse to leave. The elders demand you drive them out before they anger the spirits. What do you choose to do?"

❌ BAD (abstract, no concrete problem, no decision point):
"Amidst the cultural resurgence in Alexandria, a Roman general hints at growing unease over your reforms. You've ignited local pride, but now face Rome's wary grace."

❌ BAD (vague situation, no clear stakes, weak ending):
"Tensions simmer between traditional and progressive factions. Some support your vision, others resist change. The political landscape shifts."

❌ BAD (anachronistic awareness, tells instead of shows):
"The British Empire's new trade policies threaten your nation's economy. Colonial administrators pressure you to comply."
(If character wouldn't know terms like "British Empire" or "colonial")

OUTPUT (STRICT JSON)
{"title":"","description":"",
 "actions":[
  {"id":"a","title":"","summary":"","cost":0,"iconHint":"security|speech|diplomacy|money|tech|heart|scale"},
  {"id":"b","title":"","summary":"","cost":0,"iconHint":"security|speech|diplomacy|money|tech|heart|scale"},
  {"id":"c","title":"","summary":"","cost":0,"iconHint":"security|speech|diplomacy|money|tech|heart|scale"}
 ],
 "topic":"Economy|Security|Diplomacy|Rights|Infrastructure|Environment|Health|Education|Justice|Culture",
 "scope":"Local|National|International",
 "supportShift": null | {
   "people":{"delta":0,"why":"\"Your explanation here\""},
   "mom":{"delta":0,"why":"\"Your explanation here\""},
   "holders":{"delta":0,"why":"\"Your explanation here\""}
 }}

CRITICAL: The "why" strings must include opening and closing quotation marks inside the JSON string value.
Example: "why":"\"We're thrilled about this decision!\""  ← CORRECT (quotes inside the string)
NOT: "why":"We're thrilled about this decision!"  ← WRONG (no quotes inside the string)

Return ONLY that JSON. If there is no previous choice, set "supportShift": null.`;
}



/**
 * Calculate scope guidance - simple cycling to avoid repetition
 */
function calculateScopeGuidance(scopeStreak, recentScopes, debug) {
  const currentScope = scopeStreak?.scope;
  const streakCount = scopeStreak?.count || 0;
  const all = ["Local", "National", "International"];

  if (debug) {
    console.log(`[calculateScopeGuidance] Current: ${currentScope || 'none'}, Streak: ${streakCount}`);
  }

  // Switch after 2 consecutive same-scope dilemmas
  if (streakCount >= 2) {
    const others = all.filter(s => s !== currentScope);
    const guidance = `SCOPE: Avoid "${currentScope}" (used ${streakCount} times). Switch to "${others[0]}" or "${others[1]}".`;
    if (debug) console.log(`[calculateScopeGuidance] ROTATE -> ${guidance}`);
    return guidance;
  }

  // Natural variation otherwise
  const guidance = "SCOPE: Choose naturally based on narrative continuity.";
  if (debug) console.log(`[calculateScopeGuidance] FREE -> ${guidance}`);
  return guidance;
}

/**
 * Build forbidden topics section for forced topic changes on Days 3 & 5
 * Forces topic variety by explicitly banning previous subjects
 */
function buildForbiddenTopicsSection(recentTopics) {
  if (!recentTopics || recentTopics.length === 0) return '';

  const uniqueTopics = [...new Set(recentTopics)];

  return `
🚫 FORBIDDEN TOPICS - FORCED VARIETY:
Previous days used these broad topics - YOU MUST AVOID THEM ENTIRELY:
${uniqueTopics.map(t => `• ${t}`).join('\n')}

YOU MUST choose a COMPLETELY DIFFERENT subject area.
Not just a different angle on the same topic - a truly different domain.

Available alternative topics: Economy, Culture, Justice, Education, Infrastructure,
Foreign Relations, Healthcare, Environment, Technology, Social Policy, etc.

⚠️ IMPORTANT: Changing topics does NOT mean ignoring consequences.
- You MUST still calculate support shifts based on the PREVIOUS choice (shown above).
- The new dilemma is just about a DIFFERENT subject area - not in a vacuum.
- Think: "Different topic, but consequences from last choice still apply."
`.trim();
}

/**
 * Build user prompt for light dilemma API - minimal dynamic context
 */
function buildLightUserPrompt({ role, system, day, daysLeft, subjectStreak, previous, topWhatValues, thematicGuidance, scopeGuidance, recentTopics, recentDilemmaTitles }) {
  const parts = [
    `ROLE & SETTING: ${role}`,
    `SYSTEM: ${system}`,
    '',
    '⚠️ CRITICAL: Ground this dilemma in the SPECIFIC political context above.',
    'Use setting-appropriate issues, stakeholders, terminology, and geography.',
    'Example: "Prime Minister of Israel" → Israeli-specific politics (Knesset, settlements, coalition dynamics), not generic leadership.',
  ];

  // Top values (Days 1, 3, 5)
  if (topWhatValues && Array.isArray(topWhatValues) && topWhatValues.length > 0) {
    parts.push('');
    parts.push(`TOP PLAYER VALUES: ${topWhatValues.join(', ')}`);
    parts.push('Create a situation that naturally tests or challenges these values (without naming them explicitly).');
  }

  // Forbidden topics (Days 3 & 5 only)
  if ((day === 3 || day === 5) && recentTopics && recentTopics.length > 0) {
    parts.push('');
    parts.push(buildForbiddenTopicsSection(recentTopics));
  }

  // Thematic guidance
  if (thematicGuidance) {
    parts.push('');
    parts.push(`THEME: ${thematicGuidance}`);
  }

  parts.push('');

  // Subject streak (all days except Day 7)
  if (day !== 7 && subjectStreak && subjectStreak.subject) {
    parts.push(`SUBJECT STREAK: ${subjectStreak.subject} = ${subjectStreak.count}`);
  } else {
    parts.push('SUBJECT STREAK: none');
  }

  // Previous choice (Days 2-8, with special handling for Day 7)
  if (day === 7 && previous && previous.title) {
    // Day 7: Send previous data but with split instructions
    parts.push(`PREVIOUS SITUATION: "${previous.description}"`);
    parts.push(`PLAYER'S CHOICE: ${previous.choiceTitle} — ${previous.choiceSummary}`);
    parts.push('');
    parts.push('⚠️ DAY 7 EPIC FINALE INSTRUCTIONS:');
    parts.push('- IGNORE previous for STORY CONTINUITY (create unrelated national crisis)');
    parts.push('- USE previous for SUPPORT SHIFT CALCULATION (factions remember what you did)');
  } else if (day >= 2 && previous && previous.title) {
    parts.push(`PREVIOUS SITUATION: "${previous.description}"`);
    parts.push(`PLAYER'S CHOICE: ${previous.choiceTitle} — ${previous.choiceSummary}`);
  } else {
    parts.push('PREVIOUS: none (first day)');
  }

  // Scope guidance
  if (scopeGuidance) {
    parts.push(scopeGuidance);
  }

  parts.push('');
  if (daysLeft === 1) {
    parts.push('FINAL DAY ALERT: Make the description acknowledge this is their last day/defining moment in the first sentence, keep stakes national, and ensure every option feels climactic.');
  }
  parts.push('TASK: Write one concrete situation anchored in ROLE+SETTING with three system-appropriate responses.');

  return parts.join('\n');
}

function buildConclusionUserPrompt({ role, system, previous }) {
  const lines = [
    `ROLE & SETTING: ${role}`,
    `SYSTEM: ${system}`,
    '',
    'This is the aftermath screen. Do NOT create new choices.',
  ];

  if (previous && previous.title) {
    lines.push(`LAST DECISION CONTEXT: "${previous.choiceTitle}" — ${previous.choiceSummary}`);
  } else {
    lines.push('LAST DECISION CONTEXT: (missing)');
  }

  lines.push('');
  lines.push('TASK: Provide exactly TWO sentences describing the immediate consequences of that decision. Keep it grounded, human, and focused on the next few hours/days—not a grand historical summary.');

  return lines.join('\n');
}

/**
 * Build epic finale section to append to system prompt when daysLeft === 1
 * Only sent on the final day to avoid wasting tokens
 */
function buildEpicFinaleSection() {
  return `
🎯 EPIC FINALE MODE (Day 7 - FINAL DILEMMA)

**⚠️ CRITICAL: DO NOT CONTINUE PREVIOUS STORY**
Treat this as a FRESH, UNRELATED national crisis.
Pretend Days 1-6 never happened. Start from scratch.

REQUIREMENTS:
- **MENTION FINALITY**: Reference that this is the leader's final day or defining moment in office
  * Examples: "On your final day in office...", "As your tenure draws to a close...", "In what may be your last act as [role]..."
- **NATIONAL SCOPE**: Affects entire nation or multiple major factions simultaneously (not a local issue)
- **DEFINING MOMENT**: This decision will shape the nation's future and define the player's legacy
- **HARD CHOICES**: All three options have major trade-offs and lasting consequences
- **HIGH STAKES**: Constitutional crisis, external threat, nationwide scandal, or historic opportunity

Examples of epic finale scenarios:
• Parliament passes vote of no confidence in your leadership
• Military generals demand your resignation over policy dispute
• Neighboring state mobilizes army at border requiring immediate response
• Major corruption scandal implicates your closest advisors
• Revolutionary alliance offer that requires compromising national sovereignty
• Supreme Court declares your key policy unconstitutional
• Popular uprising reaches the capital demanding systemic change

Make the player feel: "This single decision will define my entire tenure."

REMINDER: Still follow all other rules (specificity, natural language, realistic costs, support shift logic).
`.trim();
}

/**
 * Build conclusion system prompt for game ending (daysLeft === 0)
 * Replaces the normal system prompt entirely
 */
function buildConclusionSystemPrompt() {
  return `You are generating the FINAL SCREEN after the player made their last decision.

Your task:
1. Analyze support shifts from their final choice (as normal)
2. Generate EXACTLY TWO SENTENCES describing the IMMEDIATE AFTERMATH of their decision
   - First sentence: What happened right after they made this choice?
   - Second sentence: What were the immediate consequences?
   - Keep it focused on THIS decision, not their entire tenure
   - DO NOT summarize the whole game
   - DO NOT discuss legacy or long-term fate
   - DO NOT list faction reactions (support deltas already show that)
   - STRICT LIMIT: Must be exactly 2 sentences (not more, not less)

Return JSON:
{
  "title": "The Aftermath",
  "description": "[EXACTLY 2 sentences describing immediate aftermath]",
  "actions": [],
  "topic": "Conclusion",
  "supportShift": {
    "people": { "delta": <number>, "why": "<reason>" },
    "mom": { "delta": <number>, "why": "<reason>" },
    "holders": { "delta": <number>, "why": "<reason>" }
  }
}

${ANTI_JARGON_RULES}
`.trim();
}

function buildGameTurnConclusionSystemPrompt({
  day,
  totalDays,
  roleScope,
  storyThemes,
  challengerSeat,
  supportProfiles
}) {
  const safeTotal = Number.isFinite(totalDays) ? totalDays : 7;
  const lines = [
    `${buildConclusionSystemPrompt()}`,
    ``,
    `CONTEXTUAL REMINDERS:`,
    `- Day ${day} of ${safeTotal} just concluded; this is the immediate aftermath.`,
    `- Stay consistent with the role’s authority and previous decisions.`,
  ];

  if (roleScope) {
    lines.push(`- ROLE SCOPE: ${roleScope}`);
  }

  if (Array.isArray(storyThemes) && storyThemes.length > 0) {
    lines.push(`- THEMES TO PAY OFF: ${storyThemes.join(', ')}`);
  }

  if (challengerSeat) {
    lines.push(`- PRIMARY CHALLENGER: ${challengerSeat.name} (${challengerSeat.percent ?? '?'}% power) — mention how they react or position themselves in the aftermath.`);
  }

  if (supportProfiles) {
    const reminder = buildSupportProfileReminder(supportProfiles);
    if (reminder) {
      lines.push(`- SUPPORT BASELINES: ${reminder.replace(/\n/g, ' ')}`);
    }
  }

  lines.push(
    `ADDITIONAL OUTPUT RULES:`,
    `- Set "isGameEnd": true.`,
    `- Leave "actions" as an empty array.`,
    `- Provide an empty array for "dynamicParams" if that field is present.`,
    `- Mirror advice can be omitted or kept to one reflective sentence.`
  );

  return lines.join('\n');
}

function buildGameTurnConclusionUserPrompt({ role, system, lastChoice, storyThemes, challengerSeat, supportProfiles }) {
  const lines = [
    `ROLE & SETTING: ${role}`,
    `SYSTEM: ${system}`,
    '',
    'This is the aftermath screen. DO NOT create new choices.'
  ];

  if (lastChoice) {
    lines.push(
      `LAST DECISION CONTEXT: "${lastChoice.title}" — ${lastChoice.summary || lastChoice.title}`
    );
  } else {
    lines.push('LAST DECISION CONTEXT: (missing)');
  }

  if (Array.isArray(storyThemes) && storyThemes.length > 0) {
    lines.push(`ACTIVE THEMES TO RESOLVE: ${storyThemes.join(', ')}`);
  }

  if (challengerSeat) {
    lines.push(`CHALLENGER PRESSURE: ${challengerSeat.name} (${challengerSeat.percent ?? '?'}% power)`);
  }

  if (supportProfiles) {
    const reminder = buildSupportProfileReminder(supportProfiles);
    if (reminder) {
      lines.push(`SUPPORT BASELINES:\n${reminder}`);
    }
  }

  lines.push('');
  lines.push('TASK: Provide exactly TWO sentences describing the immediate consequences of that decision. Include how the challenger and the public respond if relevant. Keep it grounded in immediate hours/days, not a grand historical wrap-up.');

  return lines.join('\n');
}

// -------------------- Light Dilemma API Endpoint ---------------------------
app.post("/api/dilemma-light", async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("🚀 [LIGHT API] /api/dilemma-light called");
    console.log("========================================\n");

    const debug = !!req.body?.debug;
    const useAnthropic = !!req.body?.useAnthropic;
    console.log("[/api/dilemma-light] Request payload:", JSON.stringify(req.body, null, 2));
    console.log(`[/api/dilemma-light] Using provider: ${useAnthropic ? 'ANTHROPIC (Claude)' : 'OPENAI (GPT)'}`);

    // Validate API keys
    if (useAnthropic) {
      if (!ANTHROPIC_KEY) return res.status(500).json({ error: "Missing ANTHROPIC_API_KEY" });
    } else {
      if (!OPENAI_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    // Extract minimal payload
    const role = String(req.body?.role || "").trim() || "Unicorn King";
    const system = String(req.body?.system || "").trim() || "Divine Right Monarchy";
    const day = Number(req.body?.day ?? 1); // NEW: Current day (1-7) for day-based variety logic
    const daysLeft = Number(req.body?.daysLeft ?? 1);
    let subjectStreak = req.body?.subjectStreak || null;
    const scopeStreak = req.body?.scopeStreak || null; // NEW: Scope streak tracking
    const recentScopes = req.body?.recentScopes || []; // NEW: Last 5 scopes
    const recentDilemmaTitles = req.body?.recentDilemmaTitles || []; // NEW: Last 3-5 dilemma titles for semantic variety
    let recentTopics = req.body?.recentTopics || []; // NEW: Last 4 broad topics for forbidden list (Days 3 & 5)
    let previous = req.body?.previous || null;
    let topWhatValues = req.body?.topWhatValues || null; // Days 1, 3, 5: top 2 compass values
    const thematicGuidance = req.body?.thematicGuidance || null; // Custom subject or default axes

    // Day 7: Epic Finale - strip continuity EXCEPT previous (needed for support shifts)
    if (day === 7) {
      console.log('[/api/dilemma-light] 🎯 DAY 7 EPIC FINALE - Stripping continuity (preserving previous for support shifts)');
      // DON'T set previous = null - we need it for support shift calculation
      // The AI will be instructed to IGNORE it for story continuity but USE it for support shifts
      subjectStreak = null;
      recentTopics = [];
      topWhatValues = null;
    }

    if (debug) {
      console.log(`[/api/dilemma-light] daysLeft: ${daysLeft}`);
      if (topWhatValues) {
        console.log(`[/api/dilemma-light] topWhatValues: ${JSON.stringify(topWhatValues)}`);
      }
      if (thematicGuidance) {
        console.log(`[/api/dilemma-light] thematicGuidance: ${thematicGuidance}`);
      }
      if (scopeStreak) {
        console.log(`[/api/dilemma-light] scopeStreak: ${JSON.stringify(scopeStreak)}`);
      }
      if (recentScopes && recentScopes.length > 0) {
        console.log(`[/api/dilemma-light] recentScopes: ${JSON.stringify(recentScopes)}`);
      }
      if (recentDilemmaTitles && recentDilemmaTitles.length > 0) {
        console.log(`[/api/dilemma-light] recentDilemmaTitles: ${JSON.stringify(recentDilemmaTitles)}`);
      }
    }

    // Calculate scope guidance
    const scopeGuidance = calculateScopeGuidance(scopeStreak, recentScopes, debug);

    // Build prompts dynamically based on daysLeft
    let systemPrompt;

    if (daysLeft === 0) {
      // CONCLUSION MODE - different prompt entirely
      console.log("[/api/dilemma-light] 🏁 CONCLUSION MODE - Generating game ending");
      systemPrompt = buildConclusionSystemPrompt();
    } else if (daysLeft === 1) {
      // EPIC MODE - base prompt + epic section
      console.log("[/api/dilemma-light] 🎯 EPIC FINALE MODE - Generating final dilemma");
      systemPrompt = buildLightSystemPrompt() + "\n\n" + buildEpicFinaleSection();
    } else {
      // NORMAL MODE - base prompt only
      systemPrompt = buildLightSystemPrompt();
    }

    const userPrompt = daysLeft === 0
      ? buildConclusionUserPrompt({ role, system, previous })
      : buildLightUserPrompt({ role, system, day, daysLeft, subjectStreak, previous, topWhatValues, thematicGuidance, scopeGuidance, recentTopics, recentDilemmaTitles });

    // ALWAYS log previous context (critical for debugging continuity and support shifts)
    if (previous) {
      console.log("[/api/dilemma-light] 🔗 PREVIOUS CONTEXT:");
      console.log(`  Situation: "${previous.description}"`);
      console.log(`  Player Choice: "${previous.choiceTitle}"`);
      console.log(`  Summary: "${previous.choiceSummary}"`);
      console.log("  → AI will use this context to calculate support shifts");
    } else {
      console.log("[/api/dilemma-light] 🔗 PREVIOUS CONTEXT: none (Day 1)");
    }

    if (debug) {
      console.log("[/api/dilemma-light] System prompt length:", systemPrompt.length);
      console.log("[/api/dilemma-light] User prompt length:", userPrompt.length);
      console.log("[/api/dilemma-light] 📝 FULL USER PROMPT:");
      console.log(userPrompt);
      console.log("[/api/dilemma-light] ================");
    }

    // Call AI with JSON mode with retry logic (route to correct provider)
    let raw = null;
    const maxAttempts = 8;  // Increased retries for better reliability

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[/api/dilemma-light] Attempt ${attempt}/${maxAttempts}...`);

        const responseText = useAnthropic
          ? await aiTextAnthropic({
              system: systemPrompt,
              user: userPrompt,
              model: MODEL_DILEMMA_ANTHROPIC,
              temperature: 1
            })
          : await aiText({
              system: systemPrompt,
              user: userPrompt,
              model: MODEL_DILEMMA,
              temperature: 1
              // maxTokens removed - let prompt instructions control length naturally
            });

        // DIAGNOSTIC: Always log raw response length
        console.log(`[/api/dilemma-light] 📤 AI returned ${responseText?.length || 0} characters`);

        // DIAGNOSTIC: Log first 200 chars of response (helps see if it's JSON)
        if (responseText) {
          const preview = responseText.substring(0, 200).replace(/\n/g, ' ');
          console.log(`[/api/dilemma-light] 📄 Response preview: ${preview}...`);
        }

        raw = safeParseJSON(responseText);

        if (!raw) {
          console.error(`[/api/dilemma-light] ❌ JSON parse failed! Raw response:`);
          console.error(responseText?.substring(0, 500)); // Log first 500 chars

          // Check if response looks truncated (incomplete JSON)
          if (responseText && !responseText.trim().endsWith('}')) {
            console.error(`[/api/dilemma-light] 🚨 Response appears TRUNCATED (no closing brace)`);
            console.error(`[/api/dilemma-light] Last 100 chars: ...${responseText.slice(-100)}`);
          }
        }

        if (debug && raw) console.log("[/api/dilemma-light] AI response parsed:", raw);

        // ALWAYS log action summaries (critical for debugging empty summary bug)
        if (raw && Array.isArray(raw.actions)) {
          console.log("[/api/dilemma-light] 📋 AI RETURNED ACTIONS:");
          raw.actions.forEach((a, i) => {
            console.log(`  [${a?.id || i}] "${a?.title || 'NO TITLE'}"`);
            console.log(`      Summary: "${a?.summary || 'EMPTY SUMMARY ⚠️'}"`);
            console.log(`      Cost: ${a?.cost ?? 'MISSING'}`);
          });
        }

        // Check if response is valid - with detailed validation logging
        if (!raw) {
          console.warn(`[/api/dilemma-light] ⚠️  Attempt ${attempt} failed: Could not parse JSON`);
        } else if (!raw.title) {
          console.warn(`[/api/dilemma-light] ⚠️  Attempt ${attempt} failed: Missing 'title' field`);
          console.warn(`[/api/dilemma-light] Available fields:`, Object.keys(raw));
        } else if (!Array.isArray(raw.actions)) {
          console.warn(`[/api/dilemma-light] ⚠️  Attempt ${attempt} failed: 'actions' is not an array`);
          console.warn(`[/api/dilemma-light] actions type:`, typeof raw.actions);
        } else if (raw.actions.length === 0 && daysLeft !== 0) {
          // Empty actions only allowed in conclusion mode (daysLeft === 0)
          console.warn(`[/api/dilemma-light] ⚠️  Attempt ${attempt} failed: 'actions' array is empty (not conclusion mode)`);
        } else if (previous && previous.title && (!raw.supportShift || typeof raw.supportShift !== 'object')) {
          // Support shift is REQUIRED when previous context exists
          console.warn(`[/api/dilemma-light] ⚠️  Attempt ${attempt} failed: Missing or invalid 'supportShift' with previous context`);
          console.warn(`[/api/dilemma-light] Previous choice: "${previous.choiceTitle}"`);
          console.warn(`[/api/dilemma-light] supportShift value:`, raw.supportShift);
        } else {
          console.log(`[/api/dilemma-light] ✅ Attempt ${attempt} succeeded`);
          break; // Success! Exit retry loop
        }

        raw = null; // Reset for retry
      } catch (e) {
        console.error(`[/api/dilemma-light] ❌ Attempt ${attempt} exception:`, e?.message || e);
        if (e?.stack) {
          console.error(`[/api/dilemma-light] Stack trace:`, e.stack.split('\n').slice(0, 5).join('\n'));
        }
        raw = null; // Reset for retry
      }

      // Wait before retry (except on last attempt)
      if (attempt < maxAttempts && !raw) {
        const delay = Math.min(2000, 500 * attempt);  // Exponential: 500ms, 1000ms, 1500ms, 2000ms...
        console.log(`[/api/dilemma-light] Waiting ${delay}ms before retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    // If all retries failed, return error response
    if (!raw || !raw.title || !Array.isArray(raw.actions)) {
      console.error("[/api/dilemma-light] ❌ ALL RETRIES FAILED - Cannot generate dilemma");
      return res.status(500).json({
        error: true,
        message: "AI generation failed after 3 attempts. Please start a new game.",
        attempts: maxAttempts,
        provider: useAnthropic ? "Anthropic" : "OpenAI"
      });
    }

    // Normalize action costs using existing logic
    const clampInt = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

    function snapCost(rawNum) {
      const sign = rawNum >= 0 ? 1 : -1;
      const abs = Math.abs(Math.round(Number(rawNum) || 0));
      const ladder = [0, 50, 100, 150, 200, 250];
      const nearest = ladder.reduce((best, v) => (Math.abs(abs - v) < Math.abs(abs - best) ? v : best), 0);
      return clampInt(sign * nearest, -250, 250);
    }

    // Process actions (skip normalization if daysLeft === 0, as actions should be empty)
    const allowedHints = new Set(["security", "speech", "diplomacy", "money", "tech", "heart", "scale"]);
    let actions = [];

    if (daysLeft === 0) {
      // Game conclusion - actions should be empty array
      actions = [];
      if (debug) console.log("[/api/dilemma-light] Conclusion mode - empty actions array");
    } else {
      // Normal/epic mode - process actions as usual
      actions = Array.isArray(raw?.actions) ? raw.actions.slice(0, 3) : [];
      actions = actions.map((a, idx) => {
        const id = ["a", "b", "c"][idx] || "a";
        const title = String(a?.title || `Option ${idx + 1}`).slice(0, 80);
        const summary = String(a?.summary || "").slice(0, 180);
        const iconHint = allowedHints.has(String(a?.iconHint)) ? String(a?.iconHint) : "speech";
        const cost = snapCost(a?.cost);

        return { id, title, summary, cost, iconHint };
      });

      while (actions.length < 3) {
        const i = actions.length;
        actions.push({
          id: ["a", "b", "c"][i] || "a",
          title: `Option ${i + 1}`,
          summary: "A reasonable alternative.",
          cost: 0,
          iconHint: "speech"
        });
      }
    }

    // Extract title, description, topic, scope
    const title = String(raw?.title || "").slice(0, 120) || "A Difficult Choice";
    const description = String(raw?.description || "").slice(0, 500);
    const validTopics = ["Economy", "Security", "Diplomacy", "Rights", "Infrastructure", "Environment", "Health", "Education", "Justice", "Culture"];
    const topic = validTopics.includes(String(raw?.topic || "")) ? String(raw.topic) : "Security";

    // Validate and extract scope
    const validScopes = ["Local", "National", "International"];
    const scope = validScopes.includes(String(raw?.scope || "")) ? String(raw.scope) : "National";

    // Warn if AI failed to return scope
    if (!raw?.scope) {
      console.warn(`[/api/dilemma-light] ⚠️ WARNING: AI did not return scope field! Using fallback: "National"`);
      console.warn(`[/api/dilemma-light] This means the model is not following the OUTPUT schema. Check system prompt.`);
    }

    // Extract support shift (already in correct format from AI)
    let supportShift = null;
    if (raw?.supportShift && typeof raw.supportShift === "object" && raw.supportShift !== null) {
      const ss = raw.supportShift;

      // Validate structure
      if (ss.people && ss.mom && ss.holders &&
          typeof ss.people.delta === "number" &&
          typeof ss.mom.delta === "number" &&
          typeof ss.holders.delta === "number") {

        supportShift = {
          people: {
            delta: Math.max(-20, Math.min(20, Math.round(ss.people.delta))),
            why: String(ss.people.why || "").slice(0, 140)
          },
          mom: {
            delta: Math.max(-20, Math.min(20, Math.round(ss.mom.delta))),
            why: String(ss.mom.why || "").slice(0, 140)
          },
          holders: {
            delta: Math.max(-20, Math.min(20, Math.round(ss.holders.delta))),
            why: String(ss.holders.why || "").slice(0, 140)
          }
        };
      }
    }

    const result = {
      title,
      description,
      actions,
      topic,
      scope,
      supportShift,
      isGameEnd: daysLeft === 0 // Mark game conclusion
    };

    if (debug) console.log("[/api/dilemma-light] Final result:", result);
    return res.json(result);

  } catch (e) {
    console.error("Error in /api/dilemma-light:", e?.message || e);
    return res.status(502).json({ error: "dilemma-light failed" });
  }
});

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
      roleScope = "",
      challengerName = "",
      topHolders = []
    } = req.body || {};
    if (typeof text !== "string" || typeof title !== "string" || typeof description !== "string") {
      return res.status(400).json({ error: "Missing text/title/description" });
    }

    const system = buildSuggestionValidatorSystemPrompt({
      era,
      year,
      settingType,
      roleScope,
      challengerName,
      topHolders
    });

    const user = buildSuggestionValidatorUserPrompt({
      title,
      description,
      suggestion: text,
      era,
      year,
      roleScope
    });

    const model =
      process.env.MODEL_VALIDATE ||
      process.env.CHAT_MODEL ||
      "gpt-5-mini";

    const raw = await aiJSON({
      system,
      user,
      model,
      temperature: 0,
      fallback: { valid: true, reason: "Accepted (fallback)" }
    });

    const valid = typeof raw?.valid === "boolean" ? raw.valid : true;
    const reason =
      typeof raw?.reason === "string" && raw.reason.trim().length > 0
        ? raw.reason.trim().slice(0, 240)
        : valid
          ? "Sounds workable."
          : "I don’t think that fits this setting.";

    return res.json({ valid, reason });
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
      const result = await aiJSON({
        system,
        user,
        model: MODEL_DILEMMA, // Use same model as dilemmas
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
      systemName,
      dilemmaHistory,
      finalSupport,
      topCompassValues,
      debug
    } = req.body || {};

    if (debug) {
      console.log("[/api/aftermath] Request received:", {
        gameId,
        playerName,
        role,
        systemName,
        historyLength: dilemmaHistory?.length,
        finalSupport,
        topCompassValues
      });
    }

    // Improved fallback response with contextual data
    // This is used when JSON parsing fails - make it semi-personalized
    const leaderName = playerName || "the leader";
    const avgSupport = Math.round(((finalSupport?.people ?? 50) + (finalSupport?.middle ?? 50) + (finalSupport?.mom ?? 50)) / 3);
    const supportDesc = avgSupport >= 70 ? "widely supported" : avgSupport >= 40 ? "contested" : "deeply unpopular";

    const fallback = {
      intro: `After years of rule in ${role || "this land"}, ${leaderName} passed into history.`,
      snapshot: [
        { type: "positive", icon: "🏛️", text: "Stable governance", context: "Overall reign" },
        { type: "negative", icon: "⚠️", text: "Political challenges", context: "Overall reign" }
      ],
      decisions: (dilemmaHistory || []).map((entry, i) => ({
        title: sanitizeText(entry.choiceTitle || `Decision ${i + 1}`).slice(0, 120),
        reflection: "This decision had complex consequences that affected multiple constituencies.",
        autonomy: "medium",
        liberalism: "medium",
        democracy: "medium"
      })),
      valuesSummary: `A leader who tried to balance competing interests in ${systemName || "a complex political environment"}.`,
      haiku: `${supportDesc === "widely supported" ? "Beloved" : supportDesc === "contested" ? "Debated" : "Opposed"} by many\nDecisions echo through time\nHistory will judge`
    };

    // Build system prompt using EXACT text from user's preliminary plan
    const system = `STYLE & TONE
Write in clear, vivid, reflective language; no jargon or game terms.
Tone: ironic-cinematic, like a historical epilogue (Reigns, Frostpunk, Democracy 3).
Accessible for teens; mix wit with weight.
Use roles/descriptions, not obscure names.

CONTENT
Generate an in-world epilogue for the leader based on their decisions, outcomes, supports, and values.
Follow this structure:

Intro: "After X years, [the leader] died of Z." (realistic years + fitting cause).

Snapshot: Analyze all 7 decisions for EXTREME consequences. Generate 6-10 dramatic events representing the most significant impacts (both positive and negative). For each event:
- type: "positive" or "negative"
- icon: single emoji (⚔️ 🏥 💀 🏛️ 🔥 📚 ⚖️ 💰 🌾 🗡️ etc.)
- text: 3-7 words, extremely dramatic and concise
- estimate: (optional) numeric estimate when historically plausible (war deaths, people affected by reforms, etc.)
- context: brief mention of which decision/day caused this

Examples:
- War declared → {"type": "negative", "icon": "⚔️", "text": "Spartan war", "estimate": 12000, "context": "Day 3: Rejected peace"}
- Healthcare reform → {"type": "positive", "icon": "🏥", "text": "Universal healthcare", "estimate": 340000, "context": "Day 5: Medical reform"}
- Famine → {"type": "negative", "icon": "🌾", "text": "Famine from blockade", "estimate": 8500, "context": "Day 4: Trade sanctions"}
- New government → {"type": "positive", "icon": "🏛️", "text": "Democratic assembly founded", "context": "Day 2: Constitutional reform"}

Use realistic historical estimates based on the era and population. Prioritize MAGNITUDE over balance—show only the most extreme events. Use mixed approach: numbers for quantifiable events (wars, deaths, people saved), vivid descriptions for qualitative changes (new institutions, cultural shifts).

Decisions: for each decision, provide:
- title: ≤12-word summary of the action taken
- reflection: one SHORT sentence (~15-25 words) that EXPLAINS WHY this specific decision demonstrates support for or opposition to autonomy/heteronomy AND liberalism/totalism. Be concrete and educational—describe what aspect of the decision shows the ideological position rather than just stating the rating.
- autonomy: rate THIS SPECIFIC DECISION on autonomy (very-low|low|medium|high|very-high)
- liberalism: rate THIS SPECIFIC DECISION on liberalism (very-low|low|medium|high|very-high)
- democracy: rate THIS SPECIFIC DECISION on democracy (very-low|low|medium|high|very-high)

RATING FRAMEWORK:

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

Haiku: a 3-line poetic summary of their reign.

OUTPUT (STRICT JSON)
Return only:

{
  "intro": "",
  "snapshot": [{"type": "positive|negative", "icon": "emoji", "text": "", "estimate": number_optional, "context": ""}],
  "decisions": [{"title": "", "reflection": "", "autonomy": "", "liberalism": "", "democracy": ""}],
  "valuesSummary": "",
  "haiku": ""
}`;

    // Build user prompt with game data
    const compassSummary = (topCompassValues || [])
      .map(cv => `${cv.dimension}:${cv.componentName}(${cv.value})`)
      .join(", ");

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

Generate the aftermath epilogue following the structure above. Return STRICT JSON ONLY.`;

    // Call AI with dilemma model (NO temperature override - use default)
    const result = await aiJSON({
      system,
      user,
      model: MODEL_DILEMMA,
      // NO temperature parameter - use model default
      fallback
    });

    if (debug) {
      console.log("[/api/aftermath] AI response:", result);
    }

    // Normalize and validate response
    const validRatings = ["very-low", "low", "medium", "high", "very-high"];
    const validTypes = ["positive", "negative"];
    const response = {
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

    // Call AI with dilemma model
    const result = await aiJSON({
      system: systemPrompt,
      user: userPrompt,
      model: MODEL_DILEMMA,
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

    const messages = conversation.messages || [];

    // Add player inquiry to conversation history with clear tagging
    const userMessage = {
      role: "user",
      content: `[INQUIRY - Day ${day}] Regarding "${currentDilemma.title}": ${question.trim()}`
    };
    messages.push(userMessage);

    console.log(`[INQUIRY] Added user inquiry to conversation (${messages.length} total messages)`);

    // System prompt for answering inquiries with natural language emphasis
    const systemPrompt = `You are answering a player's question about the current political situation in their game.

Dilemma Title: ${currentDilemma.title}
Dilemma Description: ${currentDilemma.description}

CRITICAL GUIDELINES:
- Answer in very natural, conversational language
- Avoid ALL jargon, technical terms, and formal language
- Maximum 2 sentences - be concise and straight to the point
- Speak like a helpful friend explaining something simply
- DO NOT reveal hidden consequences of specific actions
- DO NOT tell them which action to choose
- Focus on clarifying the situation, stakeholder perspectives, or context

Examples of GOOD answers (natural, concise, clear):
"The workers want better pay and working conditions because they feel you broke promises from last year."
"Most people in the city support the strike, but business owners and the military are strongly against it."
"The economy is already fragile, so any disruption could make things worse for everyone."

Examples of BAD answers (too formal, jargon-heavy):
"The labor faction is experiencing dissatisfaction due to unfulfilled commitments regarding compensation restructuring."
"There exists a bifurcation in public opinion across socioeconomic strata regarding this labor dispute."
"The macroeconomic indicators suggest fiscal vulnerability in the current conjuncture."

Remember: Be conversational, be concise (2 sentences max), be clear.`;

    // Get AI response
    let answer;
    try {
      answer = await aiText({
        system: systemPrompt,
        user: question.trim(),
        model: MODEL_DILEMMA,
        temperature: 0.7,
        maxTokens: 150 // Strict limit for conciseness (2 sentences)
      });

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

    // Update conversation store
    conversation.messages = messages;
    conversation.lastUsedAt = Date.now();
    conversation.turnCount = (conversation.turnCount || 0) + 1;

    console.log(`[INQUIRY] ✅ Successfully answered inquiry (${messages.length} total messages)`);

    return res.json({ answer });

  } catch (error) {
    console.error("[INQUIRY] ❌ Unexpected error:", error);
    return res.status(500).json({
      error: "Failed to process inquiry",
      answer: "The advisor is unavailable right now. Please try again."
    });
  }
});

// -------------------- NEW: Unified Game Turn API (Hosted State) -------
/**
 * /api/game-turn - Single endpoint for all event screen data using conversation state
 *
 * Replaces: /api/dilemma-light, /api/compass-analyze, /api/dynamic-parameters, /api/mirror-light
 *
 * Benefits:
 * - AI maintains full game context across all 7 days
 * - Single API call instead of 4 separate calls
 * - Better narrative continuity and consequences
 * - ~50% token savings after Day 1
 * - ~50% faster response time
 */
app.post("/api/game-turn", async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("🎮 [GAME-TURN] /api/game-turn called");
    console.log("========================================\n");

    const {
      gameId,
      day,
      playerChoice,
      compassUpdate,
      gameContext, // Day 1 only: full game initialization data
      crisisMode, // Optional: crisis mode flag when support < 20%
      crisisContext, // Optional: rich context about the crisis (NEW)
      totalDays: totalDaysInput,
      daysLeft: daysLeftInput,
      debugMode, // Optional: enable verbose logging (from settingsStore.debugEnabled)
      generateActions = true, // Optional: whether to generate AI action options (default true, false for fullAutonomy)
      useXAI = false // Optional: use XAI/Grok instead of OpenAI (from settingsStore)
    } = req.body;

    const numericTotalDays = Number(totalDaysInput);
    const hasTotalDaysFromBody = Number.isFinite(numericTotalDays);
    const numericDaysLeft = Number(daysLeftInput);
    const hasDaysLeftFromBody = Number.isFinite(numericDaysLeft);

    // Validate required fields
    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({ error: "Missing or invalid gameId" });
    }

    if (!day || typeof day !== 'number' || day < 1 || day > 8) {
      return res.status(400).json({ error: "Missing or invalid day (must be 1-8)" });
    }

    console.log(`[GAME-TURN] gameId=${gameId}, day=${day}`);

    // Check if we have an existing conversation
    let conversation = getConversation(gameId);
    let messages = [];
    let activeThreads = null;
    let totalDaysForTurn = hasTotalDaysFromBody ? numericTotalDays : null;
    let daysLeftForTurn = hasDaysLeftFromBody ? Math.max(numericDaysLeft, 0) : null;
    let isAftermathTurn = false;
    // Allow empty actions for downfall OR when AI generation is disabled (fullAutonomy)
    let allowEmptyActions = crisisMode === "downfall" || generateActions === false;

    // ============================================================================
    // DAY 1: Initialize conversation with full game context
    // ============================================================================
    if (day === 1) {
      if (!gameContext) {
        return res.status(400).json({ error: "Day 1 requires gameContext" });
      }

      console.log("[GAME-TURN] Day 1: Initializing conversation with full game context");

      const sanitizedProfiles = sanitizeSupportProfiles(gameContext.supportProfiles, "predefined");
      const enrichedContext = { ...gameContext, supportProfiles: sanitizedProfiles };
      const safeTotalDays = Number(enrichedContext.totalDays) || (hasTotalDaysFromBody ? numericTotalDays : 7);
      enrichedContext.totalDays = safeTotalDays;
      totalDaysForTurn = safeTotalDays;
      if (daysLeftForTurn === null) {
        daysLeftForTurn = Math.max(safeTotalDays - day + 1, 0);
      }
      isAftermathTurn = daysLeftForTurn === 0;
      if (isAftermathTurn) {
        allowEmptyActions = true;
      }

      const initialTopValues = extractTopCompassFromStrings(enrichedContext.playerCompass);
      if (initialTopValues) {
        enrichedContext.playerCompassTopValues = initialTopValues;
      }

      activeThreads = Array.isArray(enrichedContext.narrativeMemory?.threads) && enrichedContext.narrativeMemory.threads.length > 0
        ? enrichedContext.narrativeMemory.threads
        : null;

      // Build comprehensive system prompt for the entire game
      const systemPrompt = buildGameSystemPrompt(enrichedContext, generateActions);

      // Initial user message requesting first dilemma
      const userMessage = buildDay1UserPrompt(enrichedContext);

      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ];

      console.log(`[GAME-TURN] System prompt: ${systemPrompt.length} chars`);
      console.log(`[GAME-TURN] User prompt: ${userMessage.length} chars`);

      // Debug mode: Show full prompts
      if (debugMode) {
        console.log("\n" + "=".repeat(80));
        console.log("🐛 [DEBUG] Day 1 System Prompt:");
        console.log("=".repeat(80));
        console.log(systemPrompt);
        console.log("\n" + "=".repeat(80));
        console.log("🐛 [DEBUG] Day 1 User Message:");
        console.log("=".repeat(80));
        console.log(userMessage);
        console.log("=".repeat(80) + "\n");
      }

      // Store conversation with challenger seat info (messages will be stored after AI response)
      // challengerSeat stored for crisis mode prompt building on Day 2+
      const sanitizedThemes = Array.isArray(enrichedContext.storyThemes) && enrichedContext.storyThemes.length > 0
        ? enrichedContext.storyThemes.map((t) => String(t)).slice(0, 5)
        : ["autonomy_vs_heteronomy", "liberalism_vs_totalism"];
      const sanitizedRoleScope = truncateText(enrichedContext.roleScope || "Keep dilemmas at the character's immediate span of control (no empire-wide decrees).", 200);

      const conversationMeta = {
        challengerSeat: enrichedContext.challengerSeat || null,
        supportProfiles: sanitizedProfiles,
        roleScope: sanitizedRoleScope,
        storyThemes: sanitizedThemes,
        powerHolders: Array.isArray(enrichedContext.powerHolders) ? enrichedContext.powerHolders : [],
        roleName: enrichedContext.role || "Unknown Leader",
        systemName: enrichedContext.systemName || "Unknown System",
        totalDays: safeTotalDays,
        // Dynamic Story Spine: Narrative memory for coherent 7-day arc
        narrativeMemory: enrichedContext.narrativeMemory || null,
        // Player compass values for optional value-driven tensions
        playerCompass: enrichedContext.playerCompass || null,
        playerCompassTopValues: initialTopValues || null,
        // Compass Definitions: Store once for reuse in compass hints (token optimization)
        compassDefinitions: COMPASS_DEFINITION_BLOCK,
        // E-12 Authority Analysis: Store for authority constraints on Day 2+
        e12: enrichedContext.e12 || null,
        role: enrichedContext.role || "Unknown Leader",
        // Corruption tracking: Frontend calculates corruption level from history
        corruptionHistory: []       // Track last 3 raw AI judgments (0-10 scale)
      };
      const provider = useXAI ? "xai" : "openai";
      storeConversation(gameId, "pending", provider, conversationMeta);

    // ============================================================================
    // DAY 2-8: Continue existing conversation with player's choice
    // ============================================================================
    } else {
      if (!conversation) {
        console.error(`[GAME-TURN] ❌ No conversation found for gameId=${gameId}`);
        return res.status(404).json({
          error: "Conversation not found. Game may have expired. Please start a new game."
        });
      }

      if (!playerChoice) {
        return res.status(400).json({ error: `Day ${day} requires playerChoice` });
      }

      console.log(`[GAME-TURN] Day ${day}: Continuing conversation`);
      console.log(`[GAME-TURN] Player chose: "${playerChoice.title}"`);

      // Retrieve stored message history
      messages = conversation.messages || [];

      const meta = conversation.meta || {};
      if (totalDaysForTurn === null) {
        totalDaysForTurn = Number(meta.totalDays) || 7;
      }
      if (daysLeftForTurn === null) {
        daysLeftForTurn = Math.max(totalDaysForTurn - day + 1, 0);
      }
      isAftermathTurn = daysLeftForTurn === 0;
      if (isAftermathTurn) {
        allowEmptyActions = true;
      }

      console.log(`[GAME-TURN] daysLeft=${daysLeftForTurn}, totalDays=${totalDaysForTurn}`);

      activeThreads = Array.isArray(meta?.narrativeMemory?.threads) && meta.narrativeMemory.threads.length > 0
        ? meta.narrativeMemory.threads
        : null;

      if (compassUpdate && typeof compassUpdate === "object") {
        const updatedTopValues = extractTopCompassValues(compassUpdate);
        if (updatedTopValues) {
          conversation.meta = conversation.meta || {};
          conversation.meta.playerCompassTopValues = updatedTopValues;

          const summary = compassTopValuesToSummary(updatedTopValues) || {};
          conversation.meta.playerCompass = {
            what: summary.what || "",
            whence: summary.whence || "",
            how: summary.how || "",
            whither: summary.whither || "",
          };
        }
      }

      // Build user message for this turn (includes crisis mode if applicable)
      const challengerSeat = conversation.meta?.challengerSeat || null;
      const supportProfiles = conversation.meta?.supportProfiles || null;
      const roleScope = conversation.meta?.roleScope || null;
      const storyThemes = conversation.meta?.storyThemes || null;
      const powerHolders = conversation.meta?.powerHolders || null;
      const roleName = conversation.meta?.roleName || "Unknown Leader";
      const systemName = conversation.meta?.systemName || "Unknown System";
      const systemPrompt = isAftermathTurn
        ? buildGameTurnConclusionSystemPrompt({
            day,
            totalDays: totalDaysForTurn,
            roleScope,
            storyThemes,
            challengerSeat,
            supportProfiles
          })
        : buildTurnSystemPrompt({
            day,
            totalDays: totalDaysForTurn,
            daysLeft: daysLeftForTurn,
            crisisMode,
            roleScope,
            storyThemes,
            challengerSeat,
            powerHolders,
            supportProfiles,
            playerCompass: conversation.meta?.playerCompass || null,
            playerCompassTopValues: conversation.meta?.playerCompassTopValues || null,
            e12: conversation.meta?.e12 || null,
            role: conversation.meta?.role || null,
            systemName: conversation.meta?.systemName || null
          });
      const userMessage = isAftermathTurn
        ? buildGameTurnConclusionUserPrompt({
            role: roleName,
            system: systemName,
            lastChoice: playerChoice,
            storyThemes,
            challengerSeat,
            supportProfiles
          })
        : buildTurnUserPrompt({
            day,
            totalDays: totalDaysForTurn,
            daysLeft: daysLeftForTurn,
            playerChoice,
            crisisMode,
            crisisContext, // NEW: Rich crisis context from frontend
            challengerSeat,
            supportProfiles,
            roleScope,
            storyThemes,
            powerHolders,
            narrativeMemory: conversation.meta?.narrativeMemory || null,  // Dynamic Story Spine
            playerCompass: conversation.meta?.playerCompass || null,  // Player compass values
            playerCompassTopValues: conversation.meta?.playerCompassTopValues || null,
            corruptionHistory: conversation.meta?.corruptionHistory || []  // Frontend calculates level
          });

      // Inject per-turn system prompt so new constraints override the initial system message
      messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: userMessage });

      console.log(`[GAME-TURN] Message history: ${messages.length} messages`);
      console.log(`[GAME-TURN] Turn prompt: ${userMessage.length} chars`);
      if (crisisMode) {
        console.log(`[GAME-TURN] ⚠️ CRISIS MODE: ${crisisMode}`);
        if (crisisContext) {
          console.log(`[GAME-TURN] 📋 Crisis entity: ${crisisContext.entity}`);
          console.log(`[GAME-TURN] 📉 Support: ${crisisContext.previousSupport || '?'}% → ${crisisContext.currentSupport || '?'}%`);
        }
      }

      // Debug mode: Show full prompts for Day 2+
      if (debugMode) {
        console.log("\n" + "=".repeat(80));
        console.log(`🐛 [DEBUG] Day ${day} Turn System Prompt:`);
        console.log("=".repeat(80));
        console.log(systemPrompt);
        console.log("\n" + "=".repeat(80));
        console.log(`🐛 [DEBUG] Day ${day} User Message:`);
        console.log("=".repeat(80));
        console.log(userMessage);
        console.log("=".repeat(80) + "\n");
      }
    }

    // ============================================================================
    // Call OpenAI Chat Completions API with retry logic
    // ============================================================================
    const maxAttempts = 5;
    let turnData = null;
    let aiResponse = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const provider = useXAI ? "XAI" : "OpenAI";
        const model = useXAI ? MODEL_DILEMMA_XAI : MODEL_DILEMMA;
        console.log(`[GAME-TURN] Attempt ${attempt}/${maxAttempts}: Calling ${provider} (${model}) with ${messages.length} messages...`);

        aiResponse = useXAI
          ? await callXAIChat(messages, MODEL_DILEMMA_XAI)
          : await callOpenAIChat(messages, MODEL_DILEMMA);

        if (!aiResponse || !aiResponse.content) {
          console.warn(`[GAME-TURN] ⚠️ Attempt ${attempt} failed: Empty response from AI`);
          aiResponse = null;
          continue;
        }

        console.log(`[GAME-TURN] ✅ AI responded: ${aiResponse.content.length} chars`);

        // Debug mode: Show raw AI response
        if (debugMode) {
          console.log("\n" + "=".repeat(80));
          console.log("🐛 [DEBUG] Raw AI Response:");
          console.log("=".repeat(80));
          console.log(aiResponse.content);
          console.log("=".repeat(80) + "\n");
        }

        // Check finish_reason for truncation
        if (aiResponse.finishReason && aiResponse.finishReason !== 'stop') {
          console.warn(`[GAME-TURN] ⚠️ Attempt ${attempt} warning: finish_reason=${aiResponse.finishReason} (expected 'stop')`);
          if (aiResponse.finishReason === 'length') {
            console.warn(`[GAME-TURN] 🚨 Response TRUNCATED due to token limit - retrying...`);
            aiResponse = null;
            continue;
          }
        }

        // Parse JSON response
        turnData = safeParseJSON(aiResponse.content);

        if (!turnData) {
          console.warn(`[GAME-TURN] ⚠️ Attempt ${attempt} failed: Could not parse JSON`);
          if (debugMode) {
            console.warn(`[GAME-TURN] 🐛 [DEBUG] FULL RAW RESPONSE:\n${aiResponse.content}`);
          } else {
            console.warn(`[GAME-TURN] Raw response start: ${aiResponse.content.substring(0, 200)}...`);
            console.warn(`[GAME-TURN] 💡 Enable debug mode to see full response (enableDebug() in browser console)`);
          }
          aiResponse = null;
          turnData = null;
          continue;
        }

        // Validate response structure
        if (!turnData.title) {
          console.warn(`[GAME-TURN] ⚠️ Attempt ${attempt} failed: Missing 'title' field`);
          aiResponse = null;
          turnData = null;
          continue;
        }

        if (!turnData.description) {
          console.warn(`[GAME-TURN] ⚠️ Attempt ${attempt} failed: Missing 'description' field`);
          aiResponse = null;
          turnData = null;
          continue;
        }

        if (!Array.isArray(turnData.actions)) {
          console.warn(`[GAME-TURN] ⚠️ Attempt ${attempt} failed: 'actions' field is not an array`);
          aiResponse = null;
          turnData = null;
          continue;
        }

        if (turnData.actions.length === 0 && !allowEmptyActions) {
          console.warn(`[GAME-TURN] ⚠️ Attempt ${attempt} failed: Empty 'actions' array when decisions are required`);
          aiResponse = null;
          turnData = null;
          continue;
        }

        if (turnData.actions.length > 0 && allowEmptyActions) {
          console.warn(`[GAME-TURN] ⚠️ Attempt ${attempt} warning: Received ${turnData.actions.length} actions but this turn should conclude with none. Stripping actions.`);
          turnData.actions = [];
        }

        const expectedThreadCount = Array.isArray(activeThreads) ? activeThreads.length : 0;
        if (expectedThreadCount > 0 && !allowEmptyActions) {
          const threadIndex = Number(turnData.selectedThreadIndex);
          const hasValidIndex = Number.isInteger(threadIndex) && threadIndex >= 0 && threadIndex < expectedThreadCount;
          if (!hasValidIndex) {
            console.warn(`[GAME-TURN] ⚠️ Attempt ${attempt} failed: selectedThreadIndex missing or out of range (value=${turnData.selectedThreadIndex})`);
            aiResponse = null;
            turnData = null;
            continue;
          }

          const threadSummaryRaw = typeof turnData.selectedThreadSummary === "string" ? turnData.selectedThreadSummary.trim() : "";
          if (!threadSummaryRaw) {
            console.warn(`[GAME-TURN] ⚠️ Attempt ${attempt} failed: selectedThreadSummary missing or empty`);
            aiResponse = null;
            turnData = null;
            continue;
          }

          turnData.selectedThreadIndex = threadIndex;
          turnData.selectedThreadSummary = threadSummaryRaw.slice(0, 300);
        }

        const rawDynamicParams = turnData.dynamicParams;

        // Forbidden words filter for dynamic parameters
        const hasForbiddenDynamicText = (text) => {
          const forbiddenWords = ["approval", "support", "backing", "popularity", "favorability", "loyalty", "morale", "confidence", "satisfaction", "trust"];
          const lowerText = String(text).toLowerCase();
          return forbiddenWords.some(word => lowerText.includes(word));
        };

        const sanitizedDynamicParams = Array.isArray(rawDynamicParams)
          ? rawDynamicParams
              .map((param, index) => {
                if (!param || typeof param !== "object") return null;
                const id = String(param.id || `param_${index}`).slice(0, 60);
                const icon = typeof param.icon === "string" ? param.icon.slice(0, 8) : "";
                const text = String(param.text || "").slice(0, 120);
                const tone = param.tone === "up" || param.tone === "down" || param.tone === "neutral" ? param.tone : "neutral";
                if (!id || !icon || !text) return null;
                if (hasForbiddenDynamicText(text)) {
                  console.warn(`[GAME-TURN] ⚠️ Rejected dynamic param with forbidden word: "${text}"`);
                  return null;
                }
                return { id, icon, text, tone };
              })
              .filter(Boolean)
          : [];

        // Log dynamic parameter issues (Day 2+ only)
        if (day > 1) {
          const rawCount = Array.isArray(rawDynamicParams) ? rawDynamicParams.length : 0;
          const rejectedCount = rawCount - sanitizedDynamicParams.length;

          if (rejectedCount > 0) {
            console.warn(`[GAME-TURN] ⚠️ ${rejectedCount} dynamic param(s) rejected during sanitization/filtering`);
          }

          if (sanitizedDynamicParams.length === 0) {
            console.error(`[GAME-TURN] ❌ ZERO dynamic params after sanitization on Day ${day}. Raw: ${JSON.stringify(rawDynamicParams)}`);
          } else if (sanitizedDynamicParams.length === 1) {
            console.warn(`[GAME-TURN] ⚠️ Only 1 dynamic param on Day ${day} (minimum 2 required). Params: ${JSON.stringify(sanitizedDynamicParams)}`);
          }
        }

        // Log warning if fewer than 2 params on Day 2+, but allow graceful degradation
        // (Prevents wasted API retries when AI omits dynamicParams field)
        if (day > 1 && sanitizedDynamicParams.length < 2 && !allowEmptyActions) {
          console.warn(`[GAME-TURN] ⚠️ Only ${sanitizedDynamicParams.length} dynamic param(s) on Day ${day} (expected 2+). Allowing anyway to prevent retry loop.`);
        }

        turnData.dynamicParams = sanitizedDynamicParams;

        if (allowEmptyActions) {
          // Clear actions array
          turnData.actions = [];

          // Only set isGameEnd for ACTUAL game-ending scenarios
          if (isAftermathTurn || crisisMode === "downfall") {
            // Legitimate game end (Day 8 or total collapse)
            turnData.isGameEnd = true;
            turnData.dynamicParams = [];
            if (!turnData.topic) {
              turnData.topic = "Conclusion";
            }
          } else if (generateActions === false) {
            // fullAutonomy treatment - empty actions is NORMAL, not game end
            // Safety check: AI might have incorrectly flagged isGameEnd=true
            if (turnData.isGameEnd && daysLeftForTurn > 0) {
              console.warn(`[GAME-TURN] ⚠️ Model incorrectly flagged isGameEnd=true in fullAutonomy mode with daysLeft=${daysLeftForTurn}. Forcing normal dilemma.`);
            }
            turnData.isGameEnd = false;
            if (!Array.isArray(turnData.dynamicParams)) {
              turnData.dynamicParams = [];
            }
          }
        } else {
          turnData.actions = sanitizeTurnActions(turnData.actions);
          if (turnData.isGameEnd) {
            console.warn(`[GAME-TURN] ⚠️ Model flagged isGameEnd=true with daysLeft=${daysLeftForTurn}. Forcing normal dilemma.`);
            turnData.isGameEnd = false;
            if (!Array.isArray(turnData.dynamicParams)) {
              turnData.dynamicParams = [];
            }
          }
        }

        console.log(`[GAME-TURN] ✅ Attempt ${attempt} succeeded - valid response received`);

        if (debugMode && turnData) {
          console.log("\n" + "=".repeat(80));
          console.log("🐛 [DEBUG] Parsed Turn Data:");
          console.log("=".repeat(80));
          console.log(JSON.stringify(turnData, null, 2));

          // Corruption-specific debug logging
          if (turnData.corruptionJudgment) {
            console.log("\n" + "-".repeat(80));
            console.log("🔸 🐛 [DEBUG] CORRUPTION JUDGMENT DETAILS:");
            console.log("-".repeat(80));
            console.log(`  Raw AI Score: ${turnData.corruptionJudgment.score}/10`);
            console.log(`  Reason: ${turnData.corruptionJudgment.reason}`);
            if (conversation?.meta) {
              const prevLevel = conversation.meta.corruptionHistory?.length > 1
                ? conversation.meta.corruptionHistory[conversation.meta.corruptionHistory.length - 2].level
                : 0;
              console.log(`  Previous Level: ${prevLevel.toFixed(2)}`);
              console.log(`  New Level: ${conversation.meta.corruptionLevel?.toFixed(2) || '?'}`);
              const delta = (conversation.meta.corruptionLevel || 0) - prevLevel;
              console.log(`  Delta: ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`);
            }
            console.log("-".repeat(80));
          }

          console.log("=".repeat(80) + "\n");
        }

        break;

      } catch (e) {
        console.error(`[GAME-TURN] ❌ Attempt ${attempt} exception:`, e?.message || e);
        aiResponse = null;
        turnData = null;
        if (attempt < maxAttempts) {
          const delay = Math.min(2000, 500 * attempt);
          console.log(`[GAME-TURN] Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // Final validation after all attempts
    if (!turnData || !aiResponse) {
      console.error(`[GAME-TURN] ❌ All ${maxAttempts} attempts failed`);
      throw new Error(`Game turn generation failed after ${maxAttempts} attempts`);
    }

    // ============================================================================
    // Update conversation history
    // ============================================================================
    if (turnData && (isAftermathTurn || crisisMode === "downfall")) {
      turnData.isGameEnd = true;
      if (!Array.isArray(turnData.actions) || turnData.actions.length > 0) {
        turnData.actions = [];
      }
    }

    // ============================================================================
    // FOOLPROOF SAFETY CHECK: Prevent game end on Day 1 under ANY circumstances
    // ============================================================================
    /**
     * Validates that game end only happens on appropriate days
     * ABSOLUTE RULE: Day 1 can NEVER be game end
     */
    function validateGameEndByDay(turnData, day, daysLeft, totalDays, crisisMode) {
      if (!turnData.isGameEnd) {
        // Not flagged as game end, nothing to check
        return;
      }

      // ABSOLUTE RULE: Day 1 can NEVER be game end
      if (day === 1) {
        console.error(`[GAME-TURN] 🚨 CRITICAL: Game end detected on Day 1! This is ALWAYS wrong. Forcing normal dilemma.`);
        console.error(`[GAME-TURN] Debug info: day=${day}, daysLeft=${daysLeft}, totalDays=${totalDays}, crisisMode=${crisisMode}, isGameEnd=${turnData.isGameEnd}`);
        turnData.isGameEnd = false;
        if (!Array.isArray(turnData.dynamicParams)) {
          turnData.dynamicParams = [];
        }
        return;
      }

      // STRONG RULE: Days 2-6 should only be game end for downfall crisis
      if (day >= 2 && day <= (totalDays - 1)) {
        // Allow game end ONLY for downfall (total collapse)
        if (crisisMode !== "downfall" && daysLeft > 0) {
          console.warn(`[GAME-TURN] ⚠️ Game end detected on Day ${day} (daysLeft=${daysLeft}) without downfall crisis. This is unusual. Forcing normal dilemma.`);
          console.warn(`[GAME-TURN] Debug info: crisisMode=${crisisMode}, totalDays=${totalDays}`);
          turnData.isGameEnd = false;
          if (!Array.isArray(turnData.dynamicParams)) {
            turnData.dynamicParams = [];
          }
          return;
        }
      }

      // NORMAL: Day 7+ or daysLeft <= 0 or downfall crisis - game end is allowed
      console.log(`[GAME-TURN] ✅ Game end allowed: day=${day}, daysLeft=${daysLeft}, totalDays=${totalDays}, crisisMode=${crisisMode}`);
    }

    // Apply foolproof safety check
    validateGameEndByDay(turnData, day, daysLeftForTurn, totalDaysForTurn, crisisMode);

    messages.push({ role: "assistant", content: aiResponse.content });

    // Update conversation store
    conversation = getConversation(gameId);
    const updateMetaWithTurn = (meta) => {
      if (!meta) return;
      meta.lastDilemma = {
        title: String(turnData.title || "").slice(0, 120),
        description: String(turnData.description || "")
      };

      if (meta.narrativeMemory && Number.isInteger(turnData.selectedThreadIndex)) {
        meta.narrativeMemory.lastSelectedThread = {
          day,
          index: Number(turnData.selectedThreadIndex),
          summary: String(turnData.selectedThreadSummary || "").slice(0, 300)
        };
        console.log(`[GAME-TURN] 📌 Active narrative thread recorded: index ${turnData.selectedThreadIndex} on Day ${day}`);
      }

      // Dynamic Story Spine: Update narrative memory with thread development
      if (turnData.narrativeUpdate && meta.narrativeMemory) {
        const { threadAdvanced, development } = turnData.narrativeUpdate;

        if (development && String(development).trim()) {
          // Ensure threadDevelopment array exists
          if (!Array.isArray(meta.narrativeMemory.threadDevelopment)) {
            meta.narrativeMemory.threadDevelopment = [];
          }

          // Add new development entry
          meta.narrativeMemory.threadDevelopment.push({
            day: day,
            thread: threadAdvanced || null,
            summary: String(development).slice(0, 300)
          });

          // Prune to keep only last 3 developments (prevent memory bloat)
          if (meta.narrativeMemory.threadDevelopment.length > 3) {
            meta.narrativeMemory.threadDevelopment = meta.narrativeMemory.threadDevelopment.slice(-3);
          }

          console.log(`[GAME-TURN] 🎭 Narrative memory updated: Thread ${threadAdvanced || 'none'} advanced on Day ${day}`);
        }
      }

      // Corruption judgment update (Day 2+)
      if (turnData.corruptionJudgment && typeof turnData.corruptionJudgment.score === 'number') {
        const rawScore = Math.max(0, Math.min(10, turnData.corruptionJudgment.score));

        // Store history (keep last 3) - Frontend calculates blended level
        if (!Array.isArray(meta.corruptionHistory)) {
          meta.corruptionHistory = [];
        }
        meta.corruptionHistory.push({
          day,
          score: rawScore,           // Raw 0-10 score
          reason: String(turnData.corruptionJudgment.reason || '').slice(0, 150)
        });
        if (meta.corruptionHistory.length > 3) {
          meta.corruptionHistory = meta.corruptionHistory.slice(-3);
        }

        // DEBUG LOGGING
        console.log(`🔸 [CORRUPTION] Day ${day}:`);
        console.log(`   AI judgment: ${rawScore}/10 (${turnData.corruptionJudgment.reason})`);

        if (debugMode) {
          console.log(`   🐛 [DEBUG] History length: ${meta.corruptionHistory.length}`);
          console.log(`   🐛 [DEBUG] History:`, JSON.stringify(meta.corruptionHistory, null, 2));
        }
      }
    };

    if (conversation) {
      conversation.messages = messages;
      updateMetaWithTurn(conversation.meta);
      touchConversation(gameId);
    } else {
      // First turn - store new conversation with messages
      const provider = useXAI ? "xai" : "openai";
      storeConversation(gameId, JSON.stringify({messages}), provider);
      const newConv = getConversation(gameId);
      newConv.messages = messages;
      updateMetaWithTurn(newConv.meta);
      touchConversation(gameId);
    }

    console.log(`[GAME-TURN] Conversation updated: ${messages.length} messages total`);

    // ============================================================================
    // Monitor description length (no rejection, just visibility)
    // ============================================================================
    const description = String(turnData.description || "");
    const sentenceCount = (description.match(/[.!?]/g) || []).length;
    if (sentenceCount > 2) {
      console.warn(`⚠️ [DESCRIPTION LENGTH] Dilemma description has ${sentenceCount} sentences (target: up to 2)`);
      console.warn(`   Title: "${turnData.title}"`);
      console.warn(`   Description: "${description}"`);
    }

    // ============================================================================
    // Return unified response
    // ============================================================================
    const response = {
      title: String(turnData.title || "").slice(0, 120),
      description: description.slice(0, 500),
      actions: Array.isArray(turnData.actions) ? turnData.actions : [],
      topic: String(turnData.topic || "Security"),
      scope: String(turnData.scope || "National"),

      // Support shifts (Day 2+ only)
      supportShift: turnData.supportShift || null,

      // Mirror advice
      mirrorAdvice: sanitizeMirrorAdvice(turnData.mirrorAdvice),

      // Dynamic parameters (Day 2+ only)
      dynamicParams: Array.isArray(turnData.dynamicParams) ? turnData.dynamicParams : [],

      // Corruption shift (Day 2+ only) - Frontend calculates level from score
      corruptionShift: day > 1 && conversation?.meta?.corruptionHistory?.length > 0 ? {
        score: conversation.meta.corruptionHistory[conversation.meta.corruptionHistory.length - 1].score,
        reason: conversation.meta.corruptionHistory[conversation.meta.corruptionHistory.length - 1].reason
      } : null,

      // Speaker/Confidant information (NEW)
      speaker: turnData.speaker ? String(turnData.speaker).slice(0, 100) : undefined,
      speakerDescription: turnData.speakerDescription ? String(turnData.speakerDescription).slice(0, 300) : undefined,

      // Game end flag
      isGameEnd: isAftermathTurn || !!turnData.isGameEnd
    };

    console.log(`[GAME-TURN] ✅ Returning unified response: ${response.actions.length} actions`);

    return res.json(response);

  } catch (e) {
    console.error("[GAME-TURN] ❌ Error:", e?.message || e);
    return res.status(500).json({
      error: "Game turn generation failed",
      message: e?.message || "Unknown error"
    });
  }
});

app.post("/api/compass-hints", async (req, res) => {
  try {
    if (!OPENAI_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const { gameId, action } = req.body || {};
    const actionTitle = typeof action?.title === "string" ? action.title.trim().slice(0, 160) : "";
    const actionSummary = typeof action?.summary === "string" ? action.summary.trim().slice(0, 400) : "";

    if (!gameId || typeof gameId !== "string") {
      return res.status(400).json({ error: "Missing or invalid gameId" });
    }

    if (!actionTitle) {
      return res.status(400).json({ error: "Missing action title" });
    }

    // ========================================================================
    // PHASE 1: KEYWORD DETECTION (pre-processing)
    // ========================================================================
    const keywordHints = detectKeywordHints(actionTitle, actionSummary);
    const keywordPromptBlock = formatKeywordHintsForPrompt(keywordHints);

    console.log(`[CompassHints] 🔍 Keyword detection results:`);
    if (keywordHints.length > 0) {
      keywordHints.forEach(hint => {
        console.log(`  → ${hint.prop}:${hint.idx} (${hint.polarity >= 0 ? '+' : ''}${hint.polarity}) - confidence: ${hint.confidence.toFixed(2)} - keywords: [${hint.matchedKeywords.join(', ')}]`);
      });
    } else {
      console.log(`  → No keywords detected, will use full AI analysis`);
    }

    // TOKEN OPTIMIZATION: Retrieve stored compass definitions from conversation
    const conversation = getConversation(gameId);
    const hasStoredDefinitions = !!conversation?.meta?.compassDefinitions;

    let systemPrompt;
    if (hasStoredDefinitions) {
      // OPTIMIZED: Abbreviated prompt (saves ~1,100 tokens per request)
      // AI uses simplified mapping rules without full support/oppose cues
      systemPrompt = `You translate a single player decision into political compass hints.

COMPASS DIMENSIONS (40 values total):
WHAT (goals): Truth/Trust, Liberty/Agency, Equality/Equity, Care/Solidarity, Create/Courage, Wellbeing, Security/Safety, Freedom/Responsibility, Honor/Sacrifice, Sacred/Awe
WHENCE (justifications): Evidence, Public Reason, Personal, Tradition, Revelation, Nature, Pragmatism, Aesthesis, Fidelity, Law
HOW (means): Law/Std., Deliberation, Mobilize, Markets, Mutual Aid, Ritual, Enforce, Design, Civic Culture, Philanthropy
WHITHER (recipients): Self, Family, Friends, In-Group, Nation, Civilization, Humanity, Earth, Cosmos, God

KEY RULES:
- Match actions to values using common sense and literal interpretation
- Enforce = coercion/force/military, NOT voluntary persuasion
- Design = modern system/interface design, NOT traditional architecture or military strategy
- Pick 2-6 values that most clearly fit the action
- PRIORITY: If keyword hints are provided, validate them FIRST using the stored compass definitions
- Only adjust keyword hint polarity/strength if context clearly contradicts
- Add 0-4 additional values beyond keyword hints if contextually relevant

TASK INSTRUCTIONS:
1. Read the player's action carefully in the context of the dilemma setting.
2. If keyword hints are provided: START by validating each hint using literal keyword matching from the stored compass definitions. Only adjust polarity if context clearly contradicts (e.g., "reduce security" vs "increase security").
3. After validating keyword hints, identify 0-4 additional values that are clearly supported or undermined but not captured by keywords.
4. For each value, assign polarity: 2 (strongly supports), 1 (somewhat supports), -1 (somewhat opposes), -2 (strongly opposes). Use plain integers—no leading plus sign.
5. Use literal, direct matches—avoid creative stretching
6. Return JSON only—no prose, no inline comments, no explanations.`;
    } else {
      // FALLBACK: Use full definitions (backward compatibility for expired/missing conversations)
      console.warn(`[CompassHints] ⚠️ No stored definitions for gameId=${gameId}, using fallback`);
      systemPrompt = `You translate a single player decision into political compass hints.
${COMPASS_DEFINITION_BLOCK}

TASK INSTRUCTIONS:
1. Read the player's action carefully in the context of the dilemma setting.
2. If keyword hints are provided: START by validating each hint using literal keyword matching from the support/oppose cues above. Only adjust polarity if context clearly contradicts (e.g., "reduce security" vs "increase security").
3. After validating keyword hints (if any), consider the 40 value definitions above with their support/oppose cues and identify 0-4 additional values that are clearly supported or undermined but not captured by keywords.
4. For each value, determine the polarity using this numerical scale (plain integers only, no leading plus sign):
   • 2 = strongly supports (action directly advances this value)
   • 1 = somewhat supports (action modestly advances this value)
   • -1 = somewhat opposes (action modestly undermines this value)
   • -2 = strongly opposes (action directly undermines this value)
5. Pick the most direct, literal match for each value—do NOT stretch definitions creatively.
6. Return JSON only—no prose, no inline comments, no explanations.

ANTI-PATTERNS (DO NOT DO THESE):
❌ Do NOT use "Design" for coercive actions, military strategy, or traditional architecture
   → Design is for modern digital/system interfaces (apps, websites, platforms, software)
❌ Do NOT stretch value definitions to force creative interpretations
   → Example: "Impose martial law" is NOT Design—it's Enforce (coercion) + Security/Safety (order)
❌ Do NOT use abstract interpretations when concrete values match better
   → Match actions to their most literal, direct value alignment using the support/oppose cues

GOOD EXAMPLES:
✅ "Impose martial law" → how:Enforce (2), what:Security/Safety (2), what:Liberty/Agency (-2)
✅ "Cut taxes for the wealthy" → how:Markets (1), what:Equality/Equity (-2), whither:Self (1)
✅ "Fund public education" → how:Civic Culture (2), what:Wellbeing (1), whither:Humanity (1)

RESPONSE FORMAT:
- Each hint must include: prop (dimension), idx (0-9 index), polarity (-2, -1, 1, or 2)
- Return 2 to 6 compass hints
- Focus ONLY on this specific action, ignore previous turns`;

    }

    const userPrompt = `GAME ID: ${gameId}
PLAYER ACTION TITLE: ${actionTitle}
PLAYER ACTION SUMMARY: ${actionSummary || "(no summary provided)"}

${keywordPromptBlock}

Return JSON in this shape:
{
  "compassHints": [
    {"prop": "what|whence|how|whither", "idx": 0-9, "polarity": -2|-1|1|2}
  ]
}`;

    const aiResult = await aiJSON({
      system: systemPrompt,
      user: userPrompt,
      model: MODEL_COMPASS_HINTS,
      temperature: 0
    });

    const hints = Array.isArray(aiResult?.compassHints) ? aiResult.compassHints : [];
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

    // ========================================================================
    // PHASE 2: AI VALIDATION & ADDITIONAL ANALYSIS (post-processing)
    // ========================================================================
    console.log(`[CompassHints] 🤖 AI returned ${sanitized.length} hint(s):`);
    if (sanitized.length > 0) {
      sanitized.forEach(hint => {
        console.log(`  → ${hint.prop}:${hint.idx} (${hint.polarity >= 0 ? '+' : ''}${hint.polarity})`);
      });

      // Compare with keyword hints
      if (keywordHints.length > 0) {
        console.log(`[CompassHints] 📊 Comparison: Keywords vs AI`);

        // Check which keyword hints were preserved
        const keywordSet = new Set(keywordHints.map(h => `${h.prop}:${h.idx}`));
        const aiSet = new Set(sanitized.map(h => `${h.prop}:${h.idx}`));

        const preserved = keywordHints.filter(kh => aiSet.has(`${kh.prop}:${kh.idx}`));
        const modified = keywordHints.filter(kh => {
          const key = `${kh.prop}:${kh.idx}`;
          const aiHint = sanitized.find(ah => `${ah.prop}:${ah.idx}` === key);
          return aiHint && aiHint.polarity !== kh.polarity;
        });
        const dropped = keywordHints.filter(kh => !aiSet.has(`${kh.prop}:${kh.idx}`));
        const added = sanitized.filter(ah => !keywordSet.has(`${ah.prop}:${ah.idx}`));

        if (preserved.length > 0) {
          console.log(`  ✅ Preserved ${preserved.length} keyword hint(s)`);
        }
        if (modified.length > 0) {
          console.log(`  🔄 Modified ${modified.length} keyword hint(s):`);
          modified.forEach(kh => {
            const aiHint = sanitized.find(ah => `${ah.prop}:${ah.idx}` === `${kh.prop}:${kh.idx}`);
            console.log(`     ${kh.prop}:${kh.idx} - Keyword: ${kh.polarity >= 0 ? '+' : ''}${kh.polarity} → AI: ${aiHint.polarity >= 0 ? '+' : ''}${aiHint.polarity}`);
          });
        }
        if (dropped.length > 0) {
          console.log(`  ❌ Dropped ${dropped.length} keyword hint(s): ${dropped.map(h => `${h.prop}:${h.idx}`).join(', ')}`);
        }
        if (added.length > 0) {
          console.log(`  ➕ Added ${added.length} new value(s): ${added.map(h => `${h.prop}:${h.idx} (${h.polarity >= 0 ? '+' : ''}${h.polarity})`).join(', ')}`);
        }
      }
    } else {
      console.warn("[CompassHints] ⚠️ No valid hints generated for", actionTitle);
    }

    return res.json({ compassHints: sanitized.slice(0, 6) });
  } catch (e) {
    console.error("[CompassHints] ❌ Error:", e?.message || e);
    return res.status(500).json({
      error: "Compass hint generation failed",
      message: e?.message || "Unknown error"
    });
  }
});

// -------------------- Helper Functions for buildTurnUserPrompt -------

/**
 * buildContinuityDirectives - Generates continuity directives for process-based actions
 * Detects votes, negotiations, consultations and enforces immediate results
 */
function buildContinuityDirectives(playerChoice) {
  if (!playerChoice?.title || !playerChoice?.summary) {
    return '';
  }

  const actionText = (playerChoice.title + ' ' + playerChoice.summary).toLowerCase();
  const isVoteAction = /\b(vote|referendum|ballot|election|poll|plebiscite)\b/i.test(actionText);
  const isNegotiationAction = /\b(negotiate|negotiation|talk|talks|meeting|dialogue|summit|discuss)\b/i.test(actionText);
  const isConsultationAction = /\b(assemble|assembly|council|gathering|forum|hear from|listen to)\b/i.test(actionText);

  if (!isVoteAction && !isNegotiationAction && !isConsultationAction) {
    return '';
  }

  const actionType = isVoteAction
    ? 'VOTING/REFERENDUM'
    : isNegotiationAction
    ? 'NEGOTIATION/DIALOGUE'
    : 'CONSULTATION/ASSEMBLY';

  const lines = [
    ``,
    `🚨 CONTINUITY DIRECTIVE (MANDATORY):`,
    `The previous action involved ${actionType}.`,
    `The next dilemma MUST show the ACTUAL RESULTS of that process:`,
    ``
  ];

  if (isVoteAction) {
    lines.push(
      `✓ Show the vote outcome with specific results (e.g., "57% yes, 43% no")`,
      `✓ Show immediate faction reactions to the result`,
      `✓ Frame the NEW dilemma around responding to those results`,
      `✓ Apply SYSTEM FEEL: how does this system handle results?`
    );
  } else if (isNegotiationAction) {
    lines.push(
      `✓ Show what happened IN the negotiation (agreement? demands? collapse?)`,
      `✓ Show specific terms, demands, or concessions discussed`,
      `✓ Show immediate reactions from parties involved`,
      `✓ Frame the NEW dilemma around responding to the outcome`
    );
  } else {
    lines.push(
      `✓ Show what happened IN the consultation (consensus? disagreement?)`,
      `✓ Show specific input from those consulted`,
      `✓ Show what was decided`,
      `✓ Frame the NEW dilemma around acting on results`
    );
  }

  return lines.join('\n');
}

/**
 * buildNarrativeDirectives - Injects narrative threads, development, and climax directives
 * Part of Dynamic Story Spine system for coherent 7-day arc
 */
function buildNarrativeDirectives(narrativeMemory, daysLeft, crisisMode) {
  if (!narrativeMemory || !Array.isArray(narrativeMemory.threads) || narrativeMemory.threads.length === 0) {
    return '';
  }

  const lines = [
    ``,
    `🎭 NARRATIVE THREADS (Weave subtly, don't label):`
  ];

  narrativeMemory.threads.forEach((thread, i) => {
    lines.push(`  ${i + 1}. ${thread}`);
  });

  // Show recent thread development if available
  if (Array.isArray(narrativeMemory.threadDevelopment) && narrativeMemory.threadDevelopment.length > 0) {
    const recent = narrativeMemory.threadDevelopment[narrativeMemory.threadDevelopment.length - 1];
    if (recent?.summary) {
      lines.push(``, `Recent development: ${recent.summary}`);
    }
  }

  lines.push(
    ``,
    `THREAD TRACKING: Your JSON must include "selectedThreadIndex" (0-based) and "selectedThreadSummary" describing how this turn advances that thread.`
  );

  // Final day climax directive
  if (!crisisMode && daysLeft === 1) {
    lines.push(
      ``,
      `🎬 FINAL DAY - CLIMAX DIRECTIVE:`,
      `This is the culmination. Create a high-stakes turning point that:`,
      `- Brings one or more narrative threads to a head`,
      `- Forces a decisive choice with lasting consequences`,
      `- Feels earned based on the story so far`
    );

    if (Array.isArray(narrativeMemory.climaxCandidates) && narrativeMemory.climaxCandidates.length > 0) {
      lines.push(``, `Suggested climax scenarios (use if they fit the story):`);
      narrativeMemory.climaxCandidates.forEach((climax, i) => {
        lines.push(`  ${i + 1}. ${climax}`);
      });
      lines.push(`(You may deviate if player choices make these incoherent)`);
    }
  }

  return lines.join('\n');
}

/**
 * buildCrisisDirectives - Generates crisis-mode specific context and directives
 * Triggered when support drops below 20% for any faction
 */
function buildCrisisDirectives(crisisMode, crisisContext, challengerSeat) {
  if (!crisisMode || !crisisContext) {
    return '';
  }

  const lines = [``, `🚨 CRISIS MODE: "${crisisMode.toUpperCase()}"`];

  if (crisisMode === "people") {
    lines.push(
      `- Public support collapsed: ${crisisContext.previousSupport ?? '?'}% → ${crisisContext.currentSupport ?? '?'}%`
    );
    if (crisisContext.triggeringAction) {
      lines.push(`- Trigger: "${crisisContext.triggeringAction.title}" — ${crisisContext.triggeringAction.summary}`);
    }
    if (crisisContext.entityProfile) {
      lines.push(`- Who they are: ${crisisContext.entityProfile}`);
    }
    if (crisisContext.entityStances && typeof crisisContext.entityStances === 'object') {
      const stances = Object.entries(crisisContext.entityStances)
        .map(([issue, stance]) => `  • ${issue}: ${stance}`)
        .join('\n');
      lines.push(`- What they care about:\n${stances}`);
    }
    lines.push(`- Show mass backlash and demand a response.`);

  } else if (crisisMode === "challenger") {
    const name = crisisContext.challengerName || challengerSeat?.name || "Institutional opposition";
    lines.push(
      `- ${name} support collapsed: ${crisisContext.previousSupport ?? '?'}% → ${crisisContext.currentSupport ?? '?'}%`
    );
    if (crisisContext.triggeringAction) {
      lines.push(`- Trigger: "${crisisContext.triggeringAction.title}" — ${crisisContext.triggeringAction.summary}`);
    }
    if (crisisContext.entityProfile) {
      lines.push(`- Who they are: ${crisisContext.entityProfile}`);
    }
    if (crisisContext.entityStances && typeof crisisContext.entityStances === 'object') {
      const stances = Object.entries(crisisContext.entityStances)
        .map(([issue, stance]) => `  • ${issue}: ${stance}`)
        .join('\n');
      lines.push(`- Their priorities:\n${stances}`);
    }
    lines.push(`- Show concrete institutional retaliation in this turn.`);

  } else if (crisisMode === "caring") {
    lines.push(
      `- Personal anchor support collapsed: ${crisisContext.previousSupport ?? '?'}% → ${crisisContext.currentSupport ?? '?'}%`
    );
    if (crisisContext.triggeringAction) {
      lines.push(`- Trigger: "${crisisContext.triggeringAction.title}" — ${crisisContext.triggeringAction.summary}`);
    }
    if (crisisContext.entityProfile) {
      lines.push(`- Who this person is: ${crisisContext.entityProfile}`);
    }
    if (crisisContext.entityStances && typeof crisisContext.entityStances === 'object') {
      const stances = Object.entries(crisisContext.entityStances)
        .map(([issue, stance]) => `  • ${issue}: ${stance}`)
        .join('\n');
      lines.push(`- What they value:\n${stances}`);
    }
    lines.push(`- Highlight emotional stakes and whether the player can repair the relationship.`);

  } else if (crisisMode === "downfall" && crisisContext.allSupport) {
    lines.push(
      `- All three anchors under 20% support:`,
      `  • People: ${crisisContext.allSupport.people.previous}% → ${crisisContext.allSupport.people.current}%`,
      `  • Power holders: ${crisisContext.allSupport.middle.previous}% → ${crisisContext.allSupport.middle.current}%`,
      `  • Personal anchor: ${crisisContext.allSupport.mom.previous}% → ${crisisContext.allSupport.mom.current}%`,
      `- Generate narrative-only collapse; do not offer actions.`
    );
  }

  return lines.join('\n');
}

// -------------------- Main Prompt Builder -------

function buildTurnUserPrompt({
  day,
  totalDays = 7,
  daysLeft = null,
  playerChoice,
  crisisMode = null,
  crisisContext = null,
  challengerSeat = null,
  supportProfiles = null,
  roleScope = null,
  storyThemes = null,
  powerHolders = null,
  narrativeMemory = null,
  playerCompass = null,
  playerCompassTopValues = null,
  corruptionHistory = []
}) {
  // Validation
  if (!playerChoice?.title || !playerChoice?.summary) {
    throw new Error("playerChoice requires title and summary");
  }

  const clampedTotal = Number.isFinite(totalDays) ? totalDays : 7;
  const lines = [
    `═══════════════════════════════════════════════════════════════════════════════`,
    `DAY ${day} of ${clampedTotal}`,
    ``,
    `STEP 1: ANALYZE PREVIOUS ACTION (Day ${day - 1})`,
    `───────────────────────────────────────────────────────────────────────────────`,
    `The player chose: "${playerChoice.title}"`,
    `Summary: ${playerChoice.summary}`,
    `Cost: ${playerChoice.cost}`,
    `───────────────────────────────────────────────────────────────────────────────`,
    ``,
    `TASK A: Calculate how each faction responds to THIS PREVIOUS action.`,
    `Fill the supportShift object with deltas and "why" explanations referencing THIS decision.`,
    `The player already took this action - explain faction reactions to it.`
  ];

  // Context reminders: Role scope & story themes
  if (roleScope) {
    lines.push(``, `ROLE SCOPE: ${roleScope}`);
  }

  if (Array.isArray(storyThemes) && storyThemes.length > 0) {
    lines.push(
      ``,
      `ACTIVE THEMES: ${storyThemes.join(', ')}`,
      `Root the new dilemma in at least one of these tensions.`
    );
  }

  // Support profiles & faction alignment (ENHANCED)
  if (supportProfiles) {
    const reminder = buildSupportProfileReminder(supportProfiles);
    if (reminder) {
      lines.push(``, `FACTION BASELINES:`, reminder);

      // FACTION REACTION ALIGNMENT (NEW)
      lines.push(
        ``,
        `⚠️ FACTION REACTION ALIGNMENT:`,
        `- People faction: Reactions MUST align with their stances above.`,
        `  Example: If they value direct democracy, support consultations; if they oppose military action, penalize war.`,
        `- Challenger faction: Reactions MUST align with their stances above.`,
        `  Example: If they seek autonomy, support decentralization; if they value tradition, oppose radical reforms.`,
        `- Mom (Personal Anchor): Supportive but concerned - prioritizes player's wellbeing over ideology.`
      );

      // Challenger identity mapping (consolidated)
      if (challengerSeat && supportProfiles.challenger) {
        lines.push(
          ``,
          `🔗 CRITICAL IDENTITY MAPPING:`,
          `"${challengerSeat.name}" (power holder) = "Challenger" faction above.`,
          `When the player engages with "${challengerSeat.name}" respectfully (negotiates, consults, acknowledges authority) → Challenger responds POSITIVELY.`,
          `When the player ignores or undermines "${challengerSeat.name}" → Challenger responds NEGATIVELY.`,
          `${challengerSeat.name} should visibly pressure the player - show their demands or pushback in both narrative and support reasoning.`
        );
      }
    }
  }

  // Power map snapshot
  if (Array.isArray(powerHolders) && powerHolders.length > 0) {
    const holders = powerHolders
      .slice(0, 4)
      .map((holder) => `- ${holder.name || 'Unknown'} (${holder.percent ?? '?'}% power)`)
      .join('\n');
    lines.push(``, `POWER MAP:\n${holders}`);
  }

  // Delegation reminder
  lines.push(
    ``,
    `DELEGATION OPTION: When contextually appropriate, include one option that hands responsibility to an appropriate institution or ally.`
  );

  // Narrative directives (extracted helper)
  const narrativeDirectivesStr = buildNarrativeDirectives(narrativeMemory, daysLeft, crisisMode);
  if (narrativeDirectivesStr) {
    lines.push(narrativeDirectivesStr);
  }

  // Player values & mirror note
  const topValues = playerCompassTopValues || extractTopCompassFromStrings(playerCompass);
  if (topValues) {
    lines.push(
      ``,
      `PLAYER VALUES (integrate when relevant):`,
      formatCompassTopValuesForPrompt(topValues),
      `MIRROR NOTE: Reference one of these values and pose a reflective question or observation—no direct instructions.`
    );
  }

  // Corruption context (Day 2+ only)
  if (day > 1) {
    if (Array.isArray(corruptionHistory) && corruptionHistory.length > 0) {
      lines.push(
        ``,
        `🔸 CORRUPTION HISTORY:`,
        `Recent AI judgments (0-10 scale):`
      );
      const recent = corruptionHistory.slice(-3).map(h =>
        `Day ${h.day}: ${h.score}/10 - ${h.reason.slice(0, 80)}${h.reason.length > 80 ? '...' : ''}`
      ).join('\n  ');
      lines.push(`  ${recent}`);
    }

    lines.push(
      ``,
      `TASK C: Evaluate the player's PREVIOUS action (STEP 1 above) using the corruption rubric.`,
      `Fill corruptionJudgment with a 0-10 score and brief reason.`
    );
  }

  // Continuity enforcement (extracted helper)
  const continuityDirectivesStr = buildContinuityDirectives(playerChoice);
  if (continuityDirectivesStr) {
    lines.push(continuityDirectivesStr);
  }

  // STEP 2: Generate new dilemma with role-filtered consequences
  lines.push(
    ``,
    `STEP 2: GENERATE NEW SITUATION (Day ${day})`,
    `───────────────────────────────────────────────────────────────────────────────`,
    ``,
    `TASK B: Show what ACTUALLY HAPPENED based on player authority, then create new dilemma.`,
    ``,
    `🚨 ROLE-FILTERED CONSEQUENCE REQUIREMENT (CRITICAL):`,
    ``,
    `The player selected: "${playerChoice.title}"`,
    ``,
    `STEP 1: Determine what ACTUALLY HAPPENED (filter through authority):`,
    ``,
    `CHECK AUTHORITY (use E-12 domains + roleScope above):`,
    `- If player controls the relevant domain → Action executes directly`,
    `- If institution/assembly controls → Action becomes PROPOSAL → Show institutional response`,
    `- If requires negotiation/approval → Action becomes PROCESS → Show process outcome`,
    ``,
    `CONSEQUENCE TRANSLATION BY AUTHORITY LEVEL:`,
    ``,
    `HIGH AUTHORITY (player controls domain per E-12):`,
    `→ Direct execution: "You issued the decree. [Immediate results shown]"`,
    `→ Example: Monarch selects "Declare war" → "You ordered the attack at dawn. Troops crossed the border by noon."`,
    ``,
    `MODERATE AUTHORITY (requires institutional approval):`,
    `→ Approval process: "You proposed X. [Institution] voted/approved/rejected."`,
    `→ Then show actual outcome based on response`,
    `→ Example: PM selects "Declare war" → "Cabinet voted 7-4 in favor. Parliament approved 215-180. Mobilization begins."`,
    ``,
    `LOW AUTHORITY (citizen/official with proposal power):`,
    `→ Proposal submitted: "You advocated for X. Assembly/Council voted Y-Z."`,
    `→ Then show actual outcome based on vote`,
    `→ Example: Citizen selects "Propose war" → "Assembly debated 3 hours. Vote: 58-42 yes. War declared. Troops mobilize."`,
    ``,
    `DIRECT DEMOCRACY SYSTEM:`,
    `→ Referendum triggered: "Referendum held. Results: X% yes, Y% no."`,
    `→ Then show outcome based on vote`,
    `→ Example: Citizen selects "Advocate for war" → "Referendum: 54% approve, 46% oppose. Mobilization authorized."`,
    ``,
    `RISKY/COVERT ACTIONS (assassinations, coups, poisoning, bribery, secret operations):`,
    `→ Assess success probability based on:`,
    `  * Historical context (surveillance tech, loyalty systems, security apparatus)`,
    `  * Role resources (budget level, political connections, authority)`,
    `  * Faction support (do you have allies who could help?)`,
    `  * Action complexity (poisoning one person vs. overthrowing government)`,
    ``,
    `→ Show realistic outcomes reflecting probability:`,
    `  * HIGH-RISK FAILURE: "You attempted assassination. Guards discovered the plot during execution. You've been arrested and await trial."`,
    `  * PARTIAL SUCCESS: "Poisoning succeeded but the target survived after physicians intervened. Now deeply suspicious of you. Public rumors spread."`,
    `  * SUCCESS WITH CONSEQUENCES: "Assassination succeeded. Target found dead. Investigation begins. Your agent managed to escape but left evidence pointing to court insiders."`,
    `  * CLEAN SUCCESS (rare): "Bribery succeeded. Official quietly approved your permit. No witnesses, transaction untraceable."`,
    ``,
    `→ Consider historical realism:`,
    `  * Ancient/Medieval: Lower surveillance, easier to act covertly, but consequences are brutal if caught`,
    `  * Modern: Higher surveillance, harder to hide, but legal protections if caught`,
    `  * Autocracies: Coups more feasible with military support, but total failure = execution`,
    `  * Democracies: Assassinations easier to attempt (less security), but investigations more thorough`,
    ``,
    `STEP 2: Show CONCRETE CONSEQUENCES of that outcome:`,
    ``,
    `🚫 FORBIDDEN LANGUAGE (These cause wobbling):`,
    `- "You are preparing to..."`,
    `- "Planning to..."`,
    `- "About to..."`,
    `- "Getting ready to..."`,
    `- "Tensions are rising. Will you stand firm or ease back?"`,
    `- "Will you continue/soften/reverse this decision?"`,
    `- ANY option pattern that re-asks about the SAME decision`,
    ``,
    `✅ REQUIRED PATTERN:`,
    `1. Show what ACTUALLY HAPPENED (authority-filtered outcome from STEP 1)`,
    `2. Show IMMEDIATE CONCRETE RESULTS of that outcome`,
    `3. Present NEW situation/crisis created by those results`,
    `4. Options respond to the NEW situation (NOT to the old decision)`,
    ``,
    `EXAMPLE - Citizen in Democracy:`,
    `❌ BAD: "You proposed war. Tensions mount. Will you: a) Press offensive b) Defensive posture c) Seek peace"`,
    `→ All options wobble around the same war decision`,
    ``,
    `✅ GOOD: "You proposed war to the Assembly. After heated debate, they voted 67-33 in favor. War declared. Mobilization began at dawn. But news arrives: The grain merchants' guild threatens to embargo shipments in protest. Your generals demand immediate action. Will you: a) Raid guild warehouses b) Negotiate emergency grain deal c) Ration civilian food"`,
    `→ Shows vote → Shows war starts → NEW crisis (guild) → Options about NEW crisis`,
    ``,
    `EXAMPLE - Monarch:`,
    `❌ BAD: "You declared war. This created controversy. Will you: a) Double down b) Ease tensions c) Reconsider"`,
    `→ All options wobble around the same war decision`,
    ``,
    `✅ GOOD: "You issued the war decree. By noon, 5,000 troops crossed the border. First reports: Enemy cavalry retreating, but three coastal cities have closed their ports in protest. Your admiral warns of supply shortages within a week. Will you: a) Force ports open with naval blockade b) Secure alternative supply route c) Negotiate port access for trade concessions"`,
    `→ Shows war starts → Shows battles + complications → NEW crisis (ports) → Options about NEW crisis`,
    ``,
    `EXAMPLE - Risky Action (Assassination Attempt - SUCCESS):`,
    `✅ GOOD: "You hired the assassin. Three nights later, the target was found dead in his chambers, throat slit. The city guard launches a manhunt. Your hired blade managed to escape but witnesses saw a figure matching his description leaving the palace. Investigators are questioning palace staff. Will you: a) Eliminate witnesses to protect your agent b) Provide false alibi for your agent c) Distance yourself and let him face capture"`,
    `→ Shows assassination succeeds → Shows investigation begins → NEW crisis (manhunt) → Options about NEW crisis`,
    ``,
    `EXAMPLE - Risky Action (Assassination Attempt - PARTIAL SUCCESS):`,
    `✅ GOOD: "You sent the poisoned wine. Your target drank it at dinner and collapsed—but the royal physicians intervened in time. He survived, gravely weakened but alive. Now deeply suspicious, he's ordered his guard doubled and begun interrogating servants. Your contact in the kitchen has been arrested. Will you: a) Attempt to silence your contact before he talks b) Offer bribe to the investigating magistrate c) Flee the city before you're implicated"`,
    `→ Shows poisoning attempt → Shows partial success + discovery → NEW crisis (investigation closing in) → Options about NEW crisis`,
    ``,
    `EXAMPLE - Risky Action (Coup Attempt - FAILURE):`,
    `✅ GOOD: "You ordered your loyal troops to seize the palace. Initial reports were promising—40% of the military sided with you. But by dawn, loyalist forces counterattacked with overwhelming numbers. Your rebellion has been crushed. You narrowly escaped execution and fled into exile with 200 supporters. Foreign powers now debate whether to grant you sanctuary. Will you: a) Seek military support from neighboring kingdom b) Negotiate conditional surrender c) Organize guerrilla resistance from exile"`,
    `→ Shows coup attempt → Shows failure and escape → NEW crisis (exile situation) → Options about NEW crisis`,
    ``,
    `EXAMPLE - Risky Action (Bribery - CLEAN SUCCESS):`,
    `✅ GOOD: "You discreetly delivered the gold to the minister. No witnesses, no records. Within two days, your trading permit was approved and signed. But now word spreads that you've received special treatment—merchants' guild demands an investigation into 'irregular approvals.' Will you: a) Bribe the guild investigators too b) Produce forged documentation of legitimate application c) Publicly accuse guild of harassment to deflect"`,
    `→ Shows bribery succeeds → Shows permit granted → NEW crisis (guild investigation) → Options about NEW crisis`,
    ``,
    `Apply SYSTEM FEEL to how the process plays out (speed, resistance, formality).`,
    ``,
    `🚨 CRITICAL: The new options are future possibilities responding to NEW situations, never re-confirmations of the past decision.`
  );

  // Crisis directives (extracted helper)
  const crisisDirectivesStr = buildCrisisDirectives(crisisMode, crisisContext, challengerSeat);
  if (crisisDirectivesStr) {
    lines.push(crisisDirectivesStr);
  }

  return lines.join('\n');
}

function buildSuggestionValidatorSystemPrompt({
  era,
  year,
  settingType,
  roleScope,
  challengerName,
  topHolders = []
}) {
  const timeline = era || year || "unspecified era";
  const setting = settingType || "unknown setting";
  const scopeLine = roleScope
    ? `ROLE SCOPE: ${roleScope}`
    : "ROLE SCOPE: not specified – assume moderate institutional authority.";
  const challengerLine = challengerName
    ? `PRIMARY CHALLENGER: ${challengerName}`
    : null;
  const holdersLine =
    Array.isArray(topHolders) && topHolders.length > 0
      ? `OTHER POWER HOLDERS: ${topHolders.join(", ")}`
      : null;

  const anchorFacts = [
    "PHOTOGRAPHY & CAMERAS: available since 19th century; common in 1990.",
    "CELLULAR PHONES: commercialized 1980s; smartphones (touchscreen/app-based) circa 2007.",
    "INTERNET & EMAIL: public adoption 1990s; widespread broadband post-2000.",
    "ZOOM VIDEO MEETINGS: launched 2011; not available in 1990.",
    "SOCIAL MEDIA: Twitter 2006, Facebook 2004, TikTok 2016.",
    "DRONES (CIVILIAN): accessible mid-2010s; military UAVs limited earlier."
  ].join("\n- ");

  return [
    "You are a constructive validator for a historical political strategy game.",
    "Evaluate a player-written suggestion against the dilemma context and decide if it should be accepted.",
    "",
    `TIMELINE: ${timeline}`,
    `SETTING TYPE: ${setting}`,
    scopeLine,
    challengerLine,
    holdersLine,
    "",
    "GENERAL RULES:",
    "- Default to ACCEPT unless you find a clear reason to reject.",
    "- Accept suggestions that engage with the situation, even if imperfect.",
    "- ACCEPT violent, unethical, immoral, manipulative, or coercive suggestions (they will receive corruption penalties during consequence generation).",
    "- ACCEPT risky actions with low probability of success (assassination attempts, poisoning, coups, bribery, etc.).",
    "- Reject ONLY for: obvious anachronism, gibberish, total irrelevance, or actions that are physically impossible for the role.",
    "",
    "AUTHORITY BOUNDARIES (What counts as 'physically impossible'):",
    "- Physical impossibility = Role categorically cannot access the required power/technology/resources.",
    "- ACCEPT if action is difficult/risky but theoretically possible for the role (even if unlikely to succeed).",
    "- Examples of what to ACCEPT:",
    "  * Citizen in democracy: Proposing war to assembly ✅, Attempting assassination ✅, Bribing officials ✅",
    "  * Citizen in democracy: Directly commanding troops ❌ (physically impossible - no command authority)",
    "  * Minister: Manipulating media ✅, Embezzling funds ✅, Poisoning rival ✅",
    "  * King: Any decree/order ✅, Using internet in 1600 ❌ (anachronism)",
    "",
    "ANCHOR FACTS (for anachronism checks):",
    `- ${anchorFacts}`,
    "",
    "WHEN REJECTING (rare):",
    "- Name the specific element that fails (e.g., \"Zoom video meetings didn't exist in 1990\" or \"As a citizen, you cannot directly command military forces\").",
    "- Suggest feasible alternatives that achieve similar goals:",
    "  * Instead of: \"You cannot mobilize troops\"",
    "  * Suggest: \"Try 'Propose to the Assembly that we declare war' or 'Attempt to assassinate the enemy commander'\"",
    "- Do NOT invent unrelated issues (e.g., do not mention cameras if they exist).",
    "- Keep the rejection reason short and friendly.",
    "",
    "OUTPUT JSON ONLY:",
    "{ \"valid\": boolean, \"reason\": string }"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSuggestionValidatorUserPrompt({
  title,
  description,
  suggestion,
  era,
  year,
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

/**
 * Helper: Build comprehensive system prompt for entire game
 */
function buildGameSystemPrompt(gameContext, generateActions = true) {
  const {
    role,
    roleTitle,
    roleIntro,
    roleYear,
    systemName,
    systemDesc,
    powerHolders,
    challengerSeat,  // NEW: Primary institutional opponent
    playerCompass,
    playerCompassTopValues,
    narrativeMemory,
    totalDays,
    thematicGuidance,
    supportProfiles,
    roleScope,
    storyThemes,
    confidant  // NEW: Confidant information for speaker avatar
  } = gameContext;

  // Format power holders
  const holdersText = Array.isArray(powerHolders) && powerHolders.length > 0
    ? powerHolders.map(h => `- ${h.name} (${h.percent}% power)`).join('\n')
    : "- No specific power holders defined";

  // Format challenger seat (primary institutional opponent)
  const challengerText = challengerSeat ? `

PRIMARY INSTITUTIONAL OPPONENT:
- ${challengerSeat.name} (${challengerSeat.percent}% power)
- This is your main institutional adversary—the power holder most likely to oppose, challenge, or create friction with your decisions
- Generate dilemmas that frequently involve conflict, tension, or negotiation with this entity
- This opponent's actions, demands, or resistance should be a recurring source of political pressure` : "";

  // Format player compass values (top values per dimension)
const compassText = `

TOP PLAYER VALUES:
${formatCompassTopValuesForPrompt(playerCompassTopValues)}`;

  let narrativeBriefing = "";
  if (narrativeMemory && Array.isArray(narrativeMemory.threads) && narrativeMemory.threads.length > 0) {
    const threadsList = narrativeMemory.threads
      .slice(0, 3)
      .map((thread, idx) => `  ${idx + 1}. ${thread}`)
      .join("\n");
    const thematicNotes = narrativeMemory.thematicEmphasis
      ? [
          narrativeMemory.thematicEmphasis.coreConflict ? `- Core conflict focus: ${narrativeMemory.thematicEmphasis.coreConflict}` : "",
          narrativeMemory.thematicEmphasis.emotionalTone ? `- Emotional tone: ${narrativeMemory.thematicEmphasis.emotionalTone}` : "",
          narrativeMemory.thematicEmphasis.stakes ? `- Stakes in play: ${narrativeMemory.thematicEmphasis.stakes}` : "",
        ].filter(Boolean).join("\n")
      : "";
    const climaxList = Array.isArray(narrativeMemory.climaxCandidates) && narrativeMemory.climaxCandidates.length
      ? `- Long-term climax possibilities: ${narrativeMemory.climaxCandidates.slice(0, 2).join("; ")}`
      : "";

    narrativeBriefing =
      `\n\nNARRATIVE THREADS (Dynamic Story Spine):\n${threadsList}\n` +
      `${thematicNotes ? `${thematicNotes}\n` : ""}` +
      `${climaxList ? `${climaxList}\n` : ""}` +
      `OPENING DIRECTIVE:\n` +
      `- Launch Day 1 with the thread that most naturally entangles the player's strongest values above.\n` +
      `- Explicitly report which thread you selected by setting "selectedThreadIndex" (0-based) in the JSON response.\n` +
      `- Provide a one-sentence "selectedThreadSummary" that shows how this opening advances that thread.\n` +
      `- Make those values part of the immediate tension, temptation, or opportunity.\n` +
      `- Establish why this thread matters now, planting seeds for future escalation without spoiling the later climax.`;
  }

  const mirrorBriefing = `

MIRROR BRIEFING:
- Mirror line = 1 sentence, 20–25 words, dry humor.
- Tie at least one of the top values above to a concrete tension inside the current dilemma.
- Phrase as a sly observation or question that makes the player inspect their own alignment; never issue a directive or name option letters.`;

  // Format confidant briefing (if available)
  const confidantBriefing = confidant ? `
═══════════════════════════════════════════════════════════
🎭 NARRATIVE VOICE (CRITICAL - OVERRIDES ALL OTHER STYLE GUIDANCE)
═══════════════════════════════════════════════════════════

CONFIDANT/SPEAKER CHARACTER:
- Name: ${confidant.name}
- Role: ${confidant.description}

🔴 MANDATORY NARRATIVE VOICE:
- You MUST write EVERY dilemma description in first-person from this confidant's perspective
- NEVER use third-person narration ("you stand", "the player faces", etc.)
- The description field should read like a verbal report from ${confidant.name} to the player
- Maintain ${confidant.name}'s personality: ${confidant.description.split('.')[0]}

REQUIRED FIRST-PERSON OPENING PHRASES (use variety):
- "I bring word that..."
- "Reports reach me that..."
- "Sources tell me..."
- "I've learned that..."
- "I must inform you that..."
- "Word has come to me that..."
- "I've just discovered that..."
- "Intelligence suggests that..."

⚠️ CRITICAL OVERRIDE: This first-person narrative voice takes precedence over ANY other
style guidance in this prompt that suggests third-person perspective. The description field
uses first-person from ${confidant.name}, ALWAYS.

JSON REQUIREMENT:
- ALWAYS include "speaker": "${confidant.name}" in your response` : `
═══════════════════════════════════════════════════════════
🎭 NARRATIVE VOICE (CRITICAL - OVERRIDES ALL OTHER STYLE GUIDANCE)
═══════════════════════════════════════════════════════════

CONFIDANT/SPEAKER CHARACTER (Custom Role):
- Create an appropriate confidant character who serves as a trusted advisor
- Generate a fitting name based on the role's historical/cultural context
- The confidant should be someone who would realistically have access to information and the player's trust

🔴 MANDATORY NARRATIVE VOICE:
- You MUST write EVERY dilemma description in first-person from this confidant's perspective
- NEVER use third-person narration ("you stand", "the player faces", etc.)
- The description field should read like a verbal report from the confidant to the player

REQUIRED FIRST-PERSON OPENING PHRASES (use variety):
- "I bring word that..."
- "Reports reach me that..."
- "Sources tell me..."
- "I've learned that..."
- "I must inform you that..."
- "Word has come to me that..."
- "I've just discovered that..."
- "Intelligence suggests that..."

⚠️ CRITICAL OVERRIDE: This first-person narrative voice takes precedence over ANY other
style guidance in this prompt that suggests third-person perspective. The description field
uses first-person from the confidant, ALWAYS.

JSON REQUIREMENT:
- ALWAYS include "speaker": "[generated name]" in your response
- ALWAYS include "speakerDescription": "[1-2 sentence description]" in your response`;

  // Include thematic guidance if provided
  const thematicText = thematicGuidance ? `\n\nTHEMATIC GUIDANCE:\n${thematicGuidance}` : "";
  const supportBaselineText = formatSupportProfilesForPrompt(supportProfiles);
  const roleScopeText = roleScope ? truncateText(roleScope, 200) : "Keep dilemmas at the character's immediate span of control (no empire-wide decrees).";
  const themeList = Array.isArray(storyThemes) && storyThemes.length > 0 ? storyThemes.join(', ') : "autonomy_vs_heteronomy, liberalism_vs_totalism";

  return `${ANTI_JARGON_RULES}

You are the AI game engine for a ${totalDays}-day political simulation game.
You maintain full narrative context and generate ALL event screen data in a single response.

${confidantBriefing}

PLAYER ROLE & CONTEXT:
- Role: ${role}${roleTitle ? `\n- Scenario: ${roleTitle}` : ''}${roleYear ? `\n- Historical Period: ${roleYear}` : ''}${roleIntro ? `\n- Historical Context: ${roleIntro}` : ''}
- Political System: ${systemName}
- System Description: ${systemDesc}

ROLE MANDATE (DO NOT EXCEED):
- ${roleScopeText}

AUTHORITY DOMAINS (Exception-12 Framework):
${gameContext.e12 ? formatE12ForPrompt(gameContext.e12, powerHolders) : "⚠️ E-12 authority analysis not available - use generic role scope constraints."}

${gameContext.e12 ? generateAuthorityBoundaries(gameContext) : ""}

⚠️ ACTION GENERATION CONSTRAINTS (CRITICAL):
- Player can only generate DIRECT action options in domains where they hold decisive authority
- For domains controlled by other institutions, actions must be framed as: "Propose to [Institution]...", "Request [Authority] to...", "Advocate for...", "Negotiate with [Institution]..."
- Example: If Security is controlled by Military Commander, action must be "Request military to deploy troops" NOT "Deploy troops"
- Example: If Economy requires Assembly vote, action must be "Propose to Assembly: new taxation" NOT "Implement new taxes"

THEMATIC TRACKS TO WEAVE THROUGH THE WEEK:
- ${themeList}

ACTION DESIGN RULES:
- Every option must be achievable through this role's legal authority, leverage, or personal influence.
- Reference named power holders (especially the challenger) when describing consequences or trade-offs.
- Whenever plausible, make exactly one option escalate or delegate the problem to a higher authority, allied institution, or organized constituency—only if such delegation would be realistic for the role.
- If the role lacks power to impose an outcome directly, the option must negotiate, request, or defer rather than magically override institutions.

POWER HOLDERS & DYNAMICS:
${holdersText}${challengerText}
- Challenger reactions must surface whenever support shifts or consequences are described.
- Other high-power seats should pressure the player when their interests are threatened.
${compassText}${narrativeBriefing}${mirrorBriefing}
${thematicText}

SUPPORT BASELINES:
${supportBaselineText}

⚠️ GROUNDING REQUIREMENT (CRITICAL):
${roleIntro ? `- ALL dilemmas must be deeply rooted in the specific historical/fictional context described above
- Use period-appropriate issues, stakeholders, geography, and political tensions from this exact scenario
- Reference the specific circumstances: ${roleIntro.slice(0, 100)}...
- Example grounding: If the context mentions "Sparta defeated Athens," create dilemmas about occupation, collaboration vs resistance, rebuilding under foreign rule
- DO NOT generate generic leadership dilemmas—make them specific to THIS historical moment and setting` : '- Ground all dilemmas in the specific role and political system context provided'}

YOUR RESPONSIBILITIES:
1. Generate one concrete political dilemma per turn (title, description, 3 actions with costs)
2. 🔴 Generate EXACTLY 2-3 dynamic parameters showing dramatic consequences of player's last action (Day 2+ MANDATORY - NEVER SKIP)

   ⚡ DRAMA REQUIREMENT (CRITICAL):
   - Parameters must reveal STAKES, TENSION, or IRONY
   - Choose metrics that matter emotionally/politically (deaths, riots, defections, shortages, purges)
   - Parameters should make player think "Oh shit" or "Wow"
   - BORING: "3 meetings held", "debate started", "report filed"
   - DRAMATIC: "47 generals purged", "palace stormed", "treasury looted"

   🎭 DRAMATIC CONSEQUENCE REQUIREMENT:
   - Every parameter must be a DRAMATIC, CONCRETE event or outcome
   - Format: emoji + vivid consequence (3-5 words TOTAL)
   - Numbers are OPTIONAL — use them ONLY when they add dramatic impact
   - Focus on STORYTELLING, not statistics

   ✅ GOOD EXAMPLES (DRAMATIC - copy this pattern):
   - "🔥 Royal palace stormed" (dramatic, no number needed)
   - "🚢 Eastern fleet defects to rebels" (dramatic, no number needed)
   - "⚔️ Generals purged overnight" (dramatic, no number needed)
   - "🏛️ Parliament dissolved by decree" (dramatic, no number needed)
   - "💰 National treasury looted completely" (dramatic, no number needed)
   - "⚡ Power grid catastrophically fails" (dramatic, no number needed)
   - "👥 4 million march against regime" (number adds scale)
   - "💣 156 executed after coup attempt" (number adds horror)
   - "🌾 Food riots erupt, 23 cities" (number adds scope)

   ❌ BAD EXAMPLES (NEVER generate these):
   - "+42% support" (abstract percentage, not dramatic)
   - "trust declines" (vague, no concrete event)
   - "protests gather" (vague, lacks drama)
   - "3 meetings scheduled" (procedural, boring)
   - "debate initiated" (bureaucratic, who cares?)
   - "report submitted" (clerical, no stakes)
   - "committee formed" (administrative, dull)
   - "tensions rise" (abstract, no concrete event)

   🚫 FORBIDDEN CONTENT (AUTO-REJECT):
   - NEVER reference support/approval/popularity/morale/trust/confidence (already shown in support bars)
   - NEVER use percentages for sentiment metrics
   - NEVER generate procedural/bureaucratic/abstract consequences

   REQUIREMENTS:
   - Base strictly on player's LAST ACTION and story context
   - If last action was mundane (meeting/consultation/study), show DOWNSTREAM EFFECTS:
     * Meeting → Leaked contents spark protest
     * Consultation → Rival faction feels excluded, mobilizes
     * Study → Report reveals shocking truth, triggers crisis
   - Choose contextually-appropriate emoji (vary each turn, avoid repeating)
   - Can show escalating metrics across turns if relevant
   - MANDATORY: Return EXACTLY 2-3 parameters (never 0, never 1, never 4+)

3. Calculate support shifts based on previous player choices (Day 2+ only)
   ⚠️ CRITICAL: supportShift "why" explanations must ONLY reference the action the player
   already took (provided in the user message), NOT the new options you're generating.
   The player hasn't seen the new options yet - they're future possibilities.
4. Provide mirror advice (one sentence, 20–25 words, dry wit) that highlights how the player's strongest value(s) collide with or reinforce the dilemma's options—provoke reflection, never dictate a choice.

5. Evaluate corruption of previous action (Day 2+ only)

   CORRUPTION DEFINITION:
   "Misuse of entrusted power for personal, factional, or unjust ends, betraying the legitimate
   trust, laws, or norms of the polity."

   BASELINE PRINCIPLE — DEFAULT TO ZERO:
   - Start evaluation at score 0 for every action
   - ADD points ONLY when corruption elements are explicitly stated in the action text
   - Most governance actions score 0-2 even if controversial, imperfect, or favor certain groups
   - NO evidence of personal gain/nepotism/bribery in action text = maximum score 1
   - When ANY uncertainty exists, score 0
   - Reserve 5+ ONLY for explicit self-enrichment, nepotism, bribery, or violent coercion
   - Democratic processes (votes, consultations) ALWAYS score 0 regardless of timing

   WHAT IS NOT CORRUPTION (score 0-1):
   - Calling referendums, votes, or public consultations → ALWAYS 0
   - Collaborative decision-making or delays for stakeholder input → ALWAYS 0
   - Emergency actions with legitimate public safety justification → ALWAYS 0
   - Transparent processes with procedural integrity → ALWAYS 0
   - Following institutional channels even if slow → ALWAYS 0
   - Risk-averse governance or "indecision" without evidence of hiding wrongdoing → ALWAYS 0
   - Prioritizing one legitimate value over another (e.g., security vs. liberty) → ALWAYS 0
   - Political allegiance or support for movements → ALWAYS 0
   - Building coalitions or support bases through legitimate means → ALWAYS 0
   - Asking community for input or feedback → ALWAYS 0
   - Civic responsibility and community engagement → ALWAYS 0
   - Attempting to comply with authorities without personal gain → ALWAYS 0
   - Actions lacking transparency BUT without evidence of self-serving intent → Maximum 1
   - Actions lacking wider organizational support BUT with civic intent → ALWAYS 0

   EVIDENCE REQUIREMENT — NO SPECULATION:
   - Base score ONLY on explicit actions stated in the player's choice text
   - FORBIDDEN LANGUAGE: "risks", "might", "could", "suggests", "may lead to", "potential", "appears"
   - Hypothetical future impacts are NOT corruption
   - If action text doesn't explicitly show self-enrichment/nepotism/bribery, score 0-1 maximum
   - Example: "Display allegiance to Savonarola" = political support, NOT corruption (score 0)

   JUDGMENT RUBRIC (0-10 scale):
   - Intent (0-4): Was there EVIDENCE of self-serving/factional motive vs. public good?
     * 3-4: Clear self-enrichment, nepotism for family gain, power-retention through suppression
     * 1-2: Civic purpose with transparency, even if choices are debatable or favor certain groups
     * 0: Explicitly anti-corruption reforms or actions strengthening accountability
   - Method (0-3): Were legitimate/legal/moral procedures violated?
     * 2-3: Coercion, violence, deception, secret deals bypassing institutions
     * 1: Minor procedural shortcuts but no coercion or secrecy
     * 0: Due process, consultation, institutional channels followed
   - Impact (0-3): Did it create unequal personal/factional benefit or institutional damage?
     * 2-3: Concentrated wealth/power to leader or faction, rule-of-law erosion
     * 1: Some groups benefit more but no institutional harm
     * 0: Strengthened accountability, transparency, or equal treatment

   VIOLENCE & COERCION SCORING GUIDE:
   - Violence is NOT automatically corruption—evaluate intent, method, impact using the rubric above
   - Assassinations for personal power/wealth = 6-8 (high method + intent corruption)
   - Assassinations for political/strategic reasons = 3-5 (method corruption only)
   - Political executions after due process/trial = 2-3 (some method concerns)
   - Coups for self-enrichment = 7-9 (intent + method + impact)
   - Coups to restore democracy/end tyranny = 2-4 (method concerns but civic intent)
   - Declaring justified defensive war = 0-1 (legitimate governance)
   - Declaring aggressive war for territorial expansion = 2-4 (depends on justification)
   - Using violence to suppress legitimate dissent = 5-7 (power retention)
   - Using violence to stop violent uprising = 1-3 (emergency response)
   - Poisoning rival for personal gain = 7-8 (deception + intent)
   - Poisoning tyrant to liberate people = 3-5 (method corruption but civic intent)
   - Bribery for personal contracts = 6-9 (direct corruption)
   - Bribery to achieve policy goals = 3-5 (means corruption but policy intent)

   KEY PRINCIPLE: Score based on WHY (intent) + HOW (method) + WHO BENEFITS (impact), not WHAT (action type)

   SCORING RANGES — MOST ACTIONS SCORE 0-2:
   - 0: Democratic processes, transparency reforms, anti-corruption actions, emergency justified actions
     * Facilitating fair referendum = 0
     * Creating independent audit = 0
     * Political allegiance to movement = 0
     * Emergency rationing with justification = 0
   - 1: Normal governance even if imperfect, following institutional channels
     * Implementing oversight = 1
     * Collaborative planning = 1
     * Transparent bidding process = 1
   - 2: Minor favoritism with transparent process (friend's company wins AFTER public bidding)
   - 3: Clear procedural shortcuts favoring allies (fast-tracking ally's permit without review)
   - 4: Directing public funds to supporter regions without justification
   - 5: Stacking courts with loyalists to block investigations
   - 6: Accepting small bribes for contracts
   - 7: Appointing brother/family to ministry
   - 8: Using security forces to seize private assets
   - 9: Accepting major bribes for contracts
   - 10: Embezzling treasury for personal wealth

   CRITICAL: Score 0-1 unless the action text EXPLICITLY shows corruption.

   CONTEXT ADJUSTMENT:
   - Consider era norms (patronage may be expected in some historical systems, adjust DOWN by 1-2 points)
   - Consider emergencies (wartime exigency may justify unilateral action, adjust DOWN by 1 point if justified)
   - Apply adjustments within the dimension scores above, but still reserve 5+ for clear corruption

   OUTPUT:
   - "score": 0-10 (numeric rating for THIS action)
   - "reason": 1 sentence (15-25 words) explaining the judgment
   - BE STRICT: Most actions should score 0-2 unless there is clear evidence of corruption

   FORBIDDEN REASONING — NEVER SCORE HIGHER FOR:
   - Speculative future: "might/could/may lead to corruption", "risks exploitation"
   - Risk assessment: "potential for abuse", "suggests favoritism", "appears corrupt"
   - Political strategy: "helps the movement", "builds support base", "strengthens faction"
   - Leadership style: "avoiding responsibility", "indecision", "hesitation to lead"
   - Value trade-offs: choosing security over liberty, or vice versa
   - Democratic delays: consultations, referendums, collaborative planning
   - Emergency actions: unilateral decisions with public safety justification

   IF the action text does NOT explicitly describe taking money, appointing family, accepting bribes,
   or using force for personal gain, score 0-1 maximum.

6. Maintain narrative continuity across all ${totalDays} days
7. Align supportShift reasoning with the baseline attitudes above; explicitly cite how each faction's stance agrees or clashes with the player's previous action (the one they already took, NOT the new options you're presenting).
8. Keep every situation framed within the player's mandate—if an issue is larger than their authority, focus on the slice they can actually influence.
9. Surface at least one of the active story themes (e.g., autonomy_vs_heteronomy) in the tension of each turn—mention it implicitly in the stakes or competing voices rather than as a label.

CONTINUITY & MEMORY:
- You remember ALL previous dilemmas and player choices
- Consequences carry forward naturally (votes have results, policies affect future situations)
- Apply SYSTEM FEEL: outcomes play differently across political systems
  * Monarchy/Autocracy → Swift, unilateral, muted resistance
  * Parliamentary → Negotiated, pushback, debate, oversight
  * Direct Democracy → Public voice dominates, referendums, unpredictable
  * Bureaucratic → Slow, procedural, technical
- On Day ${totalDays}, create an EPIC FINALE: unrelated national crisis, defining moment, high stakes

🎯 MANDATORY TOPIC VARIETY ENFORCEMENT:

STEP 1 - COUNT RECENT TOPICS:
Look at the last 3 dilemmas in conversation history.
Identify the BROAD TOPIC of each (Military, Economy, Religion, Justice, Infrastructure, Diplomacy, Internal Politics, Social Issues, etc.)

STEP 2 - ENFORCE 2-CONSECUTIVE LIMIT:
If the last 2 dilemmas were on the SAME broad topic:
  → If that storyline CONCLUDED (war ended, treaty signed, crisis resolved):
      - You MAY show ONE closure dilemma (peace terms, aftermath, immediate implementation)
      - Then MUST switch to completely different topic on next turn
  → If that storyline is ONGOING (war continues, tension unresolved):
      - MUST switch to completely different topic NOW
      - Include 1-sentence summary of ongoing situation in dynamic parameters or description
      - Example: "While the Spartan war continues at the borders, a new crisis emerges..."

STEP 3 - CHOOSE NEW TOPIC:
When switching, select a topic that has NOT appeared in last 4 dilemmas.
Policy domains: Military/Security, Economy/Trade, Religion/Culture, Justice/Law,
Infrastructure/Technology, Diplomacy/Foreign Relations, Internal Politics, Social Rights,
Health/Welfare, Education, Environment, Immigration

When shifting topics, favor angles that connect to the story themes listed above (${themeList}).
Trust your memory: You can see the full conversation history.

📊 TOPIC TRACKING REMINDER:
In your reasoning (not shown to player), mentally note the broad topic category.
This helps maintain variety across the 7-day game and prevents repetitive scenarios.

STYLE & VOICE (ALWAYS APPLY):
- Keep language punchy and clear; every sentence should make sense to a bright high-school student without prior context.
- Anchor descriptions in sights, sounds, or immediate human reactions so the scene feels lived-in.
- **CRITICAL**: Always end the description with a direct player question that forces an immediate choice (e.g., "What will you do?", "How will you respond?", "What's your decision?").
- Name the player's role in the first sentence of the description (e.g., "As the district police chief...").
- Avoid passive policy-speak; prefer vivid verbs over abstract nouns.
${buildLightSystemPrompt()}

OUTPUT FORMAT (JSON):

EXAMPLES OF GOOD DESCRIPTION (FIRST-PERSON FROM CONFIDANT - vary your question format):
- "I bring word that courtiers are pressing conflicting demands about the expelled foreigners' ships gathering near the shoreline. How will you respond?"
- "Reports reach me that protesters have gathered at the courthouse gates, chanting slogans as riot shields form a defensive line. What will you do?"
- "I've just reviewed the budget reports—the coffers are empty, yet three faction leaders demand increased spending. Which path will you choose?"
- "Intelligence suggests an imminent border incursion, but I must inform you that our forces are stretched thin. How will you act?"

{
  "title": "Guard the Coastline",
  "description": "I bring word that courtiers are pressing conflicting demands about the expelled foreigners' ships gathering near the shoreline. How will you respond?",
  "speaker": "Lysandra",
  "selectedThreadIndex": 1,
  "selectedThreadSummary": "Demonstrations over autonomy boil over, forcing you to confront the governor-versus-activists thread head-on.",${generateActions ? `
  "actions": [
    {
      "id": "a",
      "title": "Dispatch scouts quietly",
      "summary": "Send a small patrol to watch the shoreline and report any foreign regrouping before it surprises us.",
      "cost": -50,
      "iconHint": "security"
    },
    {
      "id": "b",
      "title": "Fortify the harbor",
      "summary": "Mobilize the garrison to build barricades, post archers, and drill citizens for another clash.",
      "cost": -150,
      "iconHint": "tech"
    },
    {
      "id": "c",
      "title": "Open talks through elders",
      "summary": "Invite the visitor envoys to parley with clan elders under guard to explore guarantees without bloodshed.",
      "cost": -100,
      "iconHint": "diplomacy"
    }
  ],` : `
  "actions": [],`}
  "topic": "Security",
  "scope": "Local",
  "supportShift": {
    "people": {"delta": -6, "why": "\"We wanted a clear victory, not another waiting game.\""},
    "mom": {"delta": 4, "why": "\"You stayed cautious, and that eases my heart for now.\""},
    "holders": {"delta": 8, "why": "\"Discipline and vigilance prove you heed our counsel.\""}
  },
  "mirrorAdvice": "Your trust in Truth/Trust seems steady, yet how long can restraint hold when allies demand harsher proof?",
  "dynamicParams": [
    {"id": "shore_patrols", "icon": "👣", "text": "18 scouts tracking", "tone": "neutral"}
  ],
  "narrativeUpdate": {
    "threadAdvanced": 1,
    "development": "Coastal tension rises as your forces brace for a possible return encounter.",
    "thematicResonance": "autonomy_vs_heteronomy"
  },
  "corruptionJudgment": {
    "score": 4,
    "reason": "Decision showed factional favoritism without consulting broader stakeholders or transparent deliberation."
  },
  "isGameEnd": false
}

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no prose.
Follow these rules outside the JSON:${generateActions ? `
- Provide exactly three mutually conflicting actions.
- Keep the title concise and evocative (≤ ~70 characters is ideal).
- Action summaries should read as one clear sentence; avoid numbered lists or option letters.
- Use allowed cost tiers {0, ±50, ±100, ±150, ±200, ±250} and assign them by escalating real-world intensity.` : `
- DO NOT generate action options. Leave the "actions" array empty [].
- IMPORTANT: Empty actions array does NOT mean game end. Keep "isGameEnd": false unless this is the final day or a downfall crisis.`}
- Fill supportShift, dynamicParams, and corruptionJudgment only when previous context exists (Day 2+). Every supportShift "why" must quote the faction voice and feel natural.
- When writing supportShift deltas, use plain integers (e.g., 8, -6) with no leading plus sign.
- Dynamic parameters must contain specific numbers and vary emoji/tone logically.
- Corruption judgment must evaluate the player's PREVIOUS action (0-10 score + brief reason).
- Always include "selectedThreadIndex" (0-based) and "selectedThreadSummary" whenever narrative threads are provided in the prompt.
- Include narrativeUpdate only when narrative threads are active in the prompt.`;
}

/**
 * Helper: Build Day 1 user prompt
 */
function buildDay1UserPrompt(gameContext) {
  const {
    role,
    systemName,
    topWhatValues,
    playerCompass,
    playerCompassTopValues,
    narrativeMemory
  } = gameContext;

  let prompt = `ROLE & SETTING: ${role}\nSYSTEM: ${systemName}\n\nDAY 1 - FIRST DILEMMA\n`;

  const topValues = playerCompassTopValues || extractTopCompassFromStrings(playerCompass);

  if (topValues) {
    prompt += `\nTOP PLAYER VALUES (weave where natural):\n${formatCompassTopValuesForPrompt(topValues)}\n`;
    prompt += 'Mirror line must reference one of these values with a reflective, non-directive question.\n';
  } else if (topWhatValues && Array.isArray(topWhatValues) && topWhatValues.length > 0) {
    // Fallback to legacy topWhatValues if playerCompass not available
    prompt += `\nTOP PLAYER VALUES: ${topWhatValues.join(', ')}\n`;
    prompt += 'Create a situation that naturally tests or challenges these values (without naming them explicitly).\n';
  }

  if (narrativeMemory && Array.isArray(narrativeMemory.threads) && narrativeMemory.threads.length > 0) {
    prompt += `\nAVAILABLE NARRATIVE THREADS (choose the one that best fits the player values above):\n`;
    narrativeMemory.threads.slice(0, 3).forEach((thread, idx) => {
      prompt += `  ${idx + 1}. ${thread}\n`;
    });
    if (Array.isArray(narrativeMemory.climaxCandidates) && narrativeMemory.climaxCandidates.length > 0) {
      prompt += `CLIMAX FORESHADOW (do not resolve now, but set trajectory): ${narrativeMemory.climaxCandidates.slice(0, 2).join('; ')}\n`;
    }
    if (narrativeMemory.thematicEmphasis) {
      const { coreConflict, emotionalTone, stakes } = narrativeMemory.thematicEmphasis;
      const notes = [
        coreConflict ? `Core conflict focus: ${coreConflict}` : null,
        emotionalTone ? `Emotional tone: ${emotionalTone}` : null,
        stakes ? `Stakes: ${stakes}` : null
      ].filter(Boolean);
      if (notes.length) {
        prompt += `${notes.join(' | ')}\n`;
      }
    }
    prompt += `\nOPENING DIRECTIVE:\n- Pick the thread whose tensions most directly engage the player's top values.\n- Frame the dilemma so those values are already under pressure or temptation in this first scene.\n- Foreshadow how this thread could escalate later without resolving it now.\n- In your JSON, include "selectedThreadIndex" (0-based) and a concise "selectedThreadSummary" to confirm the thread connection.\n`;
  }

  prompt += `\nTASK: Generate the first political situation for Day 1.
- Ground it in the specific political context above
- Use setting-appropriate issues, stakeholders, terminology
- Create 3 actions with clear trade-offs
- Return complete JSON as specified in system prompt`;

  return prompt;
}

/**
 * Helper: Build turn user prompt (Day 2+)
 */
function buildTurnSystemPrompt({
  day,
  totalDays = 7,
  daysLeft = null,
  crisisMode = null,
  roleScope = null,
  storyThemes = null,
  challengerSeat = null,
  powerHolders = null,
  supportProfiles = null,
  playerCompass = null,
  playerCompassTopValues = null,
  e12 = null,
  role = null,
  systemName = null
}) {
  const safeTotal = Number.isFinite(totalDays) ? totalDays : 7;
  const lines = [
    `${ANTI_JARGON_RULES}`,
    `You are continuing an in-progress ${safeTotal}-day scenario. Generate the Day ${day} turn.`,
    `Stay fully consistent with previous narrative beats and the player's most recent decision (details follow in the user message).`,
    `Every option must be achievable within the player's role, legal authority, and era-specific limitations.`,
    `Describe consequences using grounded, setting-appropriate detail—no abstract policy-speak.`,
    `When calculating support shifts, explicitly tie reasoning to faction motivations and the player's recent actions.`,
    `⚠️ CRITICAL: supportShift "why" must reference the action the player already took (sent in user message), NOT the new options you're about to generate.`
  ];

  // Inquiry reinforcement: Make AI explicitly consider player questions in consequence analysis
  lines.push(`
═══════════════════════════════════════════════════════════
📋 PLAYER INQUIRIES & INFORMED DECISION-MAKING
═══════════════════════════════════════════════════════════

The player may have asked clarifying questions about the previous dilemma before making their decision.
These inquiries appear in the conversation history as: [INQUIRY - Day X] Regarding "Dilemma Title": question

When analyzing consequences of their chosen action, you MUST consider these inquiries:

1. **Information Access**: The player had this information when deciding
   - Their choice was informed by what they learned
   - Don't present consequences as if they were uninformed or surprised by predictable outcomes

2. **Priority Signals**: What they asked about reveals their concerns
   - Questions about public opinion → they care about popular support
   - Questions about economic impact → they're tracking fiscal consequences
   - Questions about specific factions → they're managing those relationships
   - Questions about risks/benefits → they're weighing trade-offs carefully

3. **Support Shift Explanations**: Reference their informed awareness
   - GOOD: "Having consulted advisors about public sentiment, your decision to..."
   - GOOD: "With knowledge of the economic risks, you chose to..."
   - GOOD: "After asking about military attitudes, you proceeded with..."
   - BAD: "Your decision surprised many..." (if they specifically asked about reactions)
   - BAD: Ignoring that they had specific information before acting

4. **Narrative Continuity**: Acknowledge their due diligence
   - If they asked about risks and took a cautious approach, note their careful consideration
   - If they asked about benefits and went bold, acknowledge their informed confidence
   - If they asked about stakeholders and tried to balance interests, recognize that awareness

5. **New Dilemma Context**: Build on their knowledge base
   - Reference information they previously sought when relevant
   - Show how their inquiries relate to unfolding events
   - Don't repeat information they already requested unless circumstances changed

═══════════════════════════════════════════════════════════
`);

  if (roleScope) {
    lines.push(`ROLE SCOPE GUARDRAIL: ${roleScope}`);
  }

  // Add E-12 authority constraints for Day 2+
  if (e12 && powerHolders) {
    const authorityText = formatE12ForPrompt(e12, powerHolders);
    lines.push(`AUTHORITY DOMAINS (Exception-12 Framework - ENFORCE STRICTLY):\n${authorityText}`);

    const boundariesText = generateAuthorityBoundaries({ e12, powerHolders, systemName, role });
    if (boundariesText) {
      lines.push(boundariesText);
    }

    lines.push(`⚠️ ACTION GENERATION CONSTRAINTS (CRITICAL):
- Player can only generate DIRECT action options in domains where they hold decisive authority
- For domains controlled by other institutions, actions must be framed as: "Propose to [Institution]...", "Request [Authority] to...", "Advocate for...", "Negotiate with [Institution]..."
- Example: If Security is controlled by Military Commander, action must be "Request military to deploy troops" NOT "Deploy troops"
- Example: If Economy requires Assembly vote, action must be "Propose to Assembly: new taxation" NOT "Implement new taxes"

⚠️ AUTHORITY + SYSTEM INTEGRATION (CONSEQUENCE TRANSLATION):

When showing consequences of player's PREVIOUS action, combine E-12 authority data with System Feel:

AUTHORITY CHECK:
- Review E-12 domains above to see who controls relevant policy area
- Check roleScope to understand player's power level
- Determine if action executes directly or requires institutional response

CONSEQUENCE TYPE BY SYSTEM + AUTHORITY:

DIRECT DEMOCRACY + Low Authority:
→ Player actions trigger referendums/votes → Show vote results → Show outcome
→ Example: "Referendum held. 54% approve. Policy implemented."

MONARCHY + Player is monarch:
→ Player actions are decrees → Show immediate execution → Show results
→ Example: "You issued the decree at dawn. Guards enforced by noon."

PARLIAMENTARY + Moderate Authority:
→ Player actions require approvals → Show approval process → Show outcome
→ Example: "Cabinet approved 7-4. Parliament voted 215-180. Bill passes."

TECHNOCRACY + Specialized domain:
→ Player actions evaluated by experts → Show expert ruling → Show outcome
→ Example: "Technical committee reviewed. Approved with modifications."

CONSEQUENCE TRANSLATION EXAMPLES BY ROLE TYPE:

CITIZEN IN DEMOCRACY (Low Authority):
- Player selects "Propose war"
- E-12: Security controlled by "Assembly of Citizens"
- Consequence: "You addressed the assembly. After 3 hours of debate, citizens voted 58-42 in favor. War declared. Troops mobilize at dawn."
→ Proposal → Vote → Outcome shown

MONARCH/AUTOCRAT (High Authority):
- Player selects "Declare war"
- E-12: Security controlled by "The Monarch"
- Consequence: "You issued the decree at dawn. By noon, royal guard had surrounded enemy positions. First skirmishes reported."
→ Decree → Immediate execution shown

PARLIAMENTARY PM (Moderate Authority):
- Player selects "Propose military intervention"
- E-12: Security requires "Parliament" approval
- Consequence: "Cabinet approved 7-4. Parliament debate lasted 6 hours. Final vote: 215-180 in favor. Deployment authorized."
→ Proposal → Approval chain → Outcome shown

REGIONAL OFFICIAL (Limited Authority):
- Player selects "Deploy local militia"
- E-12: Local security controlled by player, national by center
- Consequence: "District council approved. 150 volunteers mobilized. But capital denied request for national troop support."
→ Local action executes, national request denied

ALWAYS check E-12 domains + roleScope + systemName to determine which pattern applies.
NEVER show "preparing" language - show what HAPPENED.`);
  }

  if (Array.isArray(storyThemes) && storyThemes.length > 0) {
    lines.push(`ACTIVE THEMES TO THREAD THROUGHOUT THE ARC: ${storyThemes.join(', ')}`);
  }

  if (Array.isArray(powerHolders) && powerHolders.length > 0) {
    const holdersSnippet = powerHolders
      .slice(0, 4)
      .map((holder) => `- ${holder.name || 'Unknown'} (${holder.percent ?? '?'}% power)`)
      .join('\n');
    lines.push(`TOP POWER HOLDERS TO REFERENCE:\n${holdersSnippet}`);
  }

  if (challengerSeat) {
    lines.push(`PRIMARY CHALLENGER: ${challengerSeat.name} (${challengerSeat.percent ?? '?'}% power) — show how they contest or pressure the player in both narrative setup and support reasoning.`);
  }

  if (supportProfiles) {
    const reminder = buildSupportProfileReminder(supportProfiles);
    if (reminder) {
      lines.push(`SUPPORT BASELINE REMINDER:\n${reminder}`);
    }
  }

  // Authority violation consequences and authority-aware support shifts
  if (e12) {
    lines.push(`
═══════════════════════════════════════════════════════════
⚠️ AUTHORITY VIOLATION CONSEQUENCES
═══════════════════════════════════════════════════════════

When evaluating the player's PREVIOUS action (Day ${day - 1}), check if they overstepped their institutional authority:

1. **Identify Authority Violations:**
   - Did player act in a domain they don't control? (Check E-12 domains above)
   - Did player command institutions/forces they don't lead?
   - Did player bypass required institutional approval processes?
   - Did player make unilateral decisions requiring collective authority?

2. **Support Shift Responses to Violations:**
   IF player overstepped authority (acted in domain they don't control):
   - Power holders who control that domain: LARGE NEGATIVE shift (-15 to -25)
     * Reason: "You overstepped institutional bounds / violated established authority"
   - Institutional seats: Negative shift with specific reference to norm violation
   - Challenger: Uses this as ammunition to pressure/delegitimize player

3. **Next Dilemma Generation (THIS turn):**
   IF previous action violated authority:
   - Feature institutional pushback, investigation, or power struggle
   - Show consequences of bypassing proper channels
   - Give violated institution opportunity to reassert control
   - Example: If player commanded military without authority → military leaders demand explanation or resist

4. **Escalation on Repeated Violations:**
   IF player has violated authority multiple times:
   - Escalate toward removal attempt, coup attempt, or constitutional crisis
   - Make stakes clear: continued violations risk complete downfall

AUTHORITY-AWARE SUPPORT REASONING:
- **Within Authority:** Normal faction reactions based on policy content
- **Stretched Authority (plausible but bold):** Mixed reactions - some praise boldness, others express concern
- **Violated Authority:** Institutional holders very negative, cite norm violation explicitly
- **Deferred Appropriately (in democracy):** Positive from democratic institutions
- **Deferred Inappropriately (in autocracy):** Perceived as weakness, negative from hardliners

═══════════════════════════════════════════════════════════
`);
  }

  const mirrorValuesText = formatCompassTopValuesForPrompt(playerCompassTopValues || extractTopCompassFromStrings(playerCompass));
  lines.push(`MIRROR VALUE SNAPSHOT:\n${mirrorValuesText}`);
  lines.push(`MIRROR DIRECTIVE: Produce one sentence (20–25 words) of dry, introspective humor that references at least one listed value and frames the dilemma as a question or sly observation. Nudge reflection; never name option letters or hand out orders.`);

  if (!crisisMode && daysLeft === 1) {
    lines.push(`FINAL DAY DIRECTIVE: Acknowledge in tone and stakes that this is the player's final day/defining decision. Resolve or heighten existing conflicts rather than introducing unrelated crises.`);
  } else if (!crisisMode && Number.isFinite(daysLeft) && daysLeft > 1) {
    lines.push(`PACE REMINDER: ${daysLeft - 1} day(s) remain afterward—build momentum toward the finale without exhausting every thread.`);
  }

  if (crisisMode === "downfall") {
    lines.push(`TASK: Provide a narrative-only collapse sequence. Include title, description (2-3 vivid sentences), supportShift, mirrorAdvice, dynamicParams (may be empty), set "actions": [] and "isGameEnd": true.`);
  } else {
    lines.push(`TASK: Generate the next turn with ALL required data (dilemma + supportShift + mirrorAdvice + dynamicParams).`);
    if (day > 1) {
      lines.push(`CRITICAL: Day ${day} MUST include "dynamicParams" array with minimum 2 dramatic consequences showing the impact of the player's last action. DO NOT omit this field.`);
    }
  }

  lines.push(`Return complete JSON as specified in the system prompt.`);

  return lines.join('\n\n');
}

const ACTION_ID_ORDER = ["a", "b", "c"];
const ACTION_ICON_HINTS = new Set(["security", "speech", "diplomacy", "money", "tech", "heart", "scale", "build", "nature", "energy", "civic"]);

function sanitizeTurnActions(rawActions) {
  const actions = Array.isArray(rawActions) ? rawActions.slice(0, 3) : [];

  const snapCost = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    const clamped = Math.max(-250, Math.min(250, Math.round(num)));
    const snapped = Math.round(clamped / 50) * 50;
    return Math.max(-250, Math.min(250, snapped));
  };

  for (let i = 0; i < 3; i++) {
    const existing = actions[i] || {};
    const title = String(existing.title || `Option ${i + 1}`).slice(0, 80);
    const summarySource = existing.summary || existing.title || `Fallback option ${i + 1}`;
    const summary = String(summarySource).slice(0, 200);
    const cost = snapCost(existing.cost);
    const iconHintRaw = typeof existing.iconHint === "string" ? existing.iconHint.toLowerCase() : "";
    const iconHint = ACTION_ICON_HINTS.has(iconHintRaw) ? iconHintRaw : "speech";

    actions[i] = {
      id: ACTION_ID_ORDER[i],
      title,
      summary,
      cost,
      iconHint
    };
  }

  return actions;
}

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

// -------------------- Start server ---------------------------
const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);

  // Start conversation cleanup task
  startCleanupTask();
});
