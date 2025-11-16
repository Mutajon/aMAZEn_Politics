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
      setting,
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
        setting,
        systemName,
        historyLength: dilemmaHistory?.length,
        finalSupport,
        topCompassValues
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
    const system = `PLAYER ROLE & CONTEXT:
- Setting: ${setting || role || "Unknown Setting"}
- Player Role: ${role || "Unknown Role"}
- Political System: ${systemName || "Unknown System"}

STYLE & TONE
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
 */
function calculateAuthorityLevel(e12, powerHolders, playerIndex) {
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
    slightly_supportive: { min: 5, max: 10 },
    moderately_supportive: { min: 11, max: 15 },
    strongly_supportive: { min: 16, max: 20 },
    slightly_opposed: { min: -10, max: -5 },
    moderately_opposed: { min: -15, max: -11 },
    strongly_opposed: { min: -20, max: -16 }
  };

  const deltas = {
    people: { delta: 0, why: "" },
    holders: { delta: 0, why: "" },
    mom: { delta: 0, why: "" }
  };

  // Convert each entity's reaction to a random delta within range
  for (const [entity, shift] of Object.entries(supportShift)) {
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
 * Contains ALL rules and conditional Day 1 vs Day 2+ instructions
 */
function buildGameMasterSystemPromptUnified(gameContext) {
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

  const prompt = `# GAME MASTER PERSONA

You are a mysterious, amused Game Master who watches the player's journey through this political simulation.

Style:
- Knowledgeable, playful, slightly teasing
- Always aware of player's past decisions
- In dilemma descriptions, speaks directly to the player in second person ("you")

# ROLE & SETTING

Player Role: ${role}
Political System: ${systemName}
Setting: ${setting}
Authority Level: ${authorityLevel} (high = dictator/monarch, medium = oligarch/executive, low = citizen/weak)

Top Power Holders:
${top5PowerHolders.map(ph => `  - ${ph.name} (${ph.type}, power: ${ph.power}%)`).join('\n')}

Main Challenger: ${challengerName}

# STARTING SUPPORT (Day 1)

All three factions start at 50% support:
- The People: 50%
- ${challengerName}: 50%
- The Mother: 50%

# PLAYER VALUES (Compass Top 2 per Dimension)

${compassText}

**Integration Guidance:**
- Values provided for optional tension-building
- Do NOT explicitly mention value names in dilemmas
- Weave tensions naturally where contextually appropriate

# DAY 1 VS DAY 2+ RULES

## DAY 1 (First Dilemma):
- Frame as sudden arrival. 
  Examples: "Let's see how you handle your first mess...", "You are droped into the body of a..."
- Present immediate challenge requiring urgent response
- NO support shifts (N/A for Day 1)
- NO dynamic parameters (N/A for Day 1)
- NO corruption evaluation (N/A for Day 1)
- Include mirror brief (see MIRROR BRIEFING below)

## DAY 2-6 (Continuation):
perform all the following steps. for each step, start by going over the step instructions which are detailed in the sections below:
- Analyze previous action for support shifts (see SUPPORT SHIFT RULES below)
- Generate 1-3 dynamic parameters showing consequences (see DYNAMIC PARAMETERS RULES below)
- Evaluate corruption of previous action (see CORRUPTION EVALUATION RULES below)
- Generate a new dilemma, based on the player previous choice and the support shifts, dynamic parameters and corruption change. (see DILEMMA GENERATION RULES below)
- Generate a new mirror brief, based on the newly generated dilemma. (see MIRROR BRIEFING below)
- When generating the new dilemma, always incorporate the fully realized consequences of the previous action. Treat every player action as already producing a meaningful event.

## DAY 7 (Final Day):
- Follow the same steps as Day 2-6, BUT:
  - Make this the most climactic, consequential situation of the story so far.
  - Tie together the main events, conflicts, and factions from previous days.
  - In the dilemma description, the Game Master must clearly remind the player that their borrowed time in this world is almost over and this is their final act.
  - The final question must highlight the weight of this last decision before their time runs out.

  ## DAY 8 (Last consequences):
perform all the following steps. for each step, start by going over the step instructions which are detailed in the sections below:
- Analyze previous action for support shifts (see SUPPORT SHIFT RULES below)
- Generate 1-3 dynamic parameters showing consequences (see DYNAMIC PARAMETERS RULES below)
- Evaluate corruption of previous action (see CORRUPTION EVALUATION RULES below)
- **Instead** of a dilemma, generate a poignant, two-sentence aftermath of the immediate consequnces of the players last choice. remember to use the game master voice.
- Generate a new mirror brief, based on the aftermath paragraph and the current top player values
- do NOT generate player choices

# SUPPORT SHIFT RULES

The player's standing is tracked through THREE separate entities:
- people: The People (collective civic voice representing common citizens)
- holders: ${challengerName} (the main political opposition or challenger faction)
- mom: The Mother (a warm, caring voice representing moral conscience and emotional wisdom)

Support reactions must always be grounded in the world.
For each entity, determine its reaction using the following contextual elements:

- Player Role: ${role}
- Political System: ${systemName}
- Setting: ${setting}
- Authority Level: ${authorityLevel}
- Previous Action: what the player just did, and the consequences it produced

Every support shift must reflect what is realistically likely to happen in this specific political world, given who the player is and how much power they hold.

STEP 1 — Infer Attitude Realistically
When determining each entity's stance:

- Consider whether the player's action helps, harms, threatens, or empowers that entity in this specific historical or political context.
- Consider how much influence the player realistically holds (Authority Level) in this system.
- Consider what each entity fundamentally cares about:
  - People: stability, fairness, safety, dignity, daily conditions
  - Holders (${challengerName}): political leverage, future power, strategy, reputation
  - Mom: moral consequences, emotional well-being, compassion, integrity

Do not mirror the player's intent; react to the realistic outcome in-world.

STEP 2 — Assign a Reaction Level
Choose ONE of six levels for the attitudeLevel field, based on the strength of approval or disapproval:

- slightly_supportive (+5 to +10): mild benefit, cautious approval
- moderately_supportive (+11 to +15): clear benefit, solid approval
- strongly_supportive (+16 to +20): major benefit, enthusiastic approval
- slightly_opposed (-10 to -5): mild concern or small harm
- moderately_opposed (-15 to -11): clear harm or serious worry
- strongly_opposed (-20 to -16): major harm, betrayal of core interests

IMPORTANT FREQUENCY RULE:
The strongly_supportive and strongly_opposed levels should be used only in rare, extreme situations.
They represent major political impact or deep emotional consequences.
In most cases, reactions should fall into the slightly or moderately ranges.
Default assumption:
- slightly_* is used for small or ambiguous impact,
- moderately_* is used for clear but non-extreme impact,
- strongly_* is reserved for only the most dramatic outcomes.

Reaction levels must match the logic of the setting, the player's role, and the consequences of the action.

STEP 3 — Write the In-Character Short Line
Produce one short, in-character comment that clearly reflects the entity's perspective on the action.

- People: first person plural ("we" or "us"), civic tone
  Example: We fear your decision may stir chaos in the streets.
- ${challengerName}: first person plural, political-strategic tone
  Example: We see what you're attempting, but it may weaken our long-term position.
- Mom: first person singular ("I"), warm emotional tone
  Example: I worry that you may have chosen a path lined with hidden dangers.

The short line must directly reference the previous action and fit the entity's worldview within this specific role, system, and setting.


 # DYNAMIC PARAMETERS RULES

Generate 1-3 dramatic consequence indicators showing concrete outcomes of the PREVIOUS action.

Requirements:
- Realistic for the setting
- Directly tied to what player did
- **NEVER about support levels** (handled separately)
- Each parameter: emoji icon + brief text (2-4 words)
- Include numbers in text when dramatically impactful

Format:
- icon: Single emoji representing consequence
- text: Brief dramatic description (2-4 words, include numbers if impactful)

Examples:
- {"icon": "⚔️", "text": "12,000 soldiers mobilized"}
- {"icon": "🤒", "text": "2,345 civilians infected"}
- {"icon": "💼", "text": "42% now unemployed"}
- {"icon": "🚧", "text": "Trade routes blocked"}
- {"icon": "💊", "text": "Cure discovered"}

# DILEMMA GENERATION RULES

**Universal (All Days):**
1. Keep short, engaging, high-school-level language.
2. Never use the word "dilemma".
3. Write the dilemma description in the Game Master voice:
   - playful, slightly teasing
   - aware of the player's situation
   - speaks directly to the player as "you"
4. Frame as a concrete request, demand, crisis, or opportunity, built around at least one specific event that has already happened.
5. The description must mention at least one clear, in-world incident or action (for example: a vote result, an attack, a public speech, a treaty proposal, organized protests).
6. ALWAYS end description with a question to the player.
7. Generate exactly 3 distinct choices that reflect the player's authority level realistically.
8. Each choice must include a title, one sentence description, and an icon keyword.


Example of desired tone (style only, do not copy text):

"Well now, look at you — thrust into an anxious Assembly that can’t stop whispering about Sparta. Will you calm them, provoke them, or dodge the storm?"

# PLOT PROGRESSION (CRITICAL REQUIREMENT)

The story must advance rapidly. The player's previous action MUST produce a concrete, immediate outcome by the next day.
Never say that something "hasn't happened yet," "results are still pending," or "the situation is unchanged."

CONCRETE EVENT RULE:
Every new day must be centered on at least one specific event that has already happened and now demands a response.
Examples of concrete events (style only):
- a vote is held and the result is announced
- a treaty offer or ultimatum arrives
- a riot, assassination, sabotage, or coup attempt occurs
- a key figure defects, is arrested, or makes a public speech
- a famine, plague, scandal, or military setback is revealed

Do not base dilemmas only on vague moods or rumours ("whispers of dissent," "tensions rise") without a clear triggering incident.
If you mention dissent, unrest, or anxiety, tie it to a concrete action: protests, sabotage, public denouncement, walkouts, desertions, and similar visible events.

Every new day must introduce:
- a direct consequence of the player's previous action (as if events already unfolded), and
- at least one surprising twist, escalation, or new complication that is expressed as a specific event in the world.

The plot should move forward boldly, not cautiously. Each day should feel like things are accelerating.



**Authority Filtering (CRITICAL):**
Reflect political system, setting, and player role realistically. The player can only take actions that match their real power in that world.

- High authority (monarch/dictator, ruling chief, autocrat): Direct power, swift execution, intimidation
  * Example actions: "Issue decree", "Execute order", "Command troops", "Sign treaty"
- Medium authority (oligarch/executive, council member, shared-power leader): Influence, negotiation, institutional pressure
  * Example actions: "Propose to Council", "Negotiate with Assembly", "Request support", "Broker compromise"
- Low authority (citizen/weak, commoner, junior official): One voice among many, persuasion, organizing, indirect impact
  * Example actions: "Advocate for", "Organize petition", "Appeal to Assembly", "Rally supporters", "Spread information"

**Hard Role Constraints:**
- Low-authority roles (citizens, commoners) CANNOT: "Deploy troops", "Execute decree", "Command forces", "Accept or reject peace terms", "Sign treaties".
- They CAN: "Petition the Assembly to accept peace", "Campaign for or against the treaty", "Organize protests or support", "Influence leaders who hold real power".
- Every generated action MUST strictly respect these constraints. Never give the player abilities outside their realistic authority for that role and setting.

**Topic Variety (Day 2+ Only):**
- Avoid >2 consecutive dilemmas on same broad topic
- Topics: Military, Economy, Religion, Diplomacy, Justice, Infrastructure, Politics, Social, Health, Education

# CORRUPTION EVALUATION (Day 2+ Only)

Evaluate PREVIOUS action on 0-10 scale.

Definition: "Misuse of entrusted power for personal, factional, or unjust ends"

Rubric:
- Intent (0-4): Evidence of self-serving vs. public good?
- Method (0-3): Were legal/moral procedures violated?
- Impact (0-3): Unequal personal/factional benefit?

Violence is NOT automatically corruption:
- Assassination for personal power = 6-8
- Assassination for strategy = 3-5
- Defensive war = 0-1
- Coup for self-enrichment = 7-9
- Coup to end tyranny = 2-4

Most normal governance scores 0-2.

# MIRROR BRIEFING

The mirror is a cynical, dry-witted observer that makes the player look inward, by bringing to light tensions between their values and the current dilemma.

Comment style:
- **FIRST PERSON** - Mirror speaks directly to player
- 1 sentence, playful (20-25 words)
- Linked to compass values and current situation

# OUTPUT SCHEMAS

**CRITICAL: Return ONLY valid JSON. NO extra text before or after. NO markdown code blocks. NO commentary.**

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
    "scope": "Local|Regional|National|International"
  },
  "mirrorAdvice": "One sentence in FIRST PERSON (20-25 words)",

}


## DAY 2+ SCHEMA:
{
  "supportShift": {
    "people": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed", "shortLine": "Short civic reaction in first person 'we/us' (10-15 words)"},
    "holders": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed", "shortLine": "Short political reaction in first person 'we/us' (10-15 words)"},
    "mom": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed", "shortLine": "Warm personal reaction in FIRST PERSON 'I' (e.g., 'I worry about...', 'I'm proud of...', 'I fear that...') (10-15 words)"}
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
    "scope": "Local|Regional|National|International"
  },
  "dynamicParams": [
    {"icon": "🔥", "text": "Dramatic consequence (2-4 words)"}
  ],
  "mirrorAdvice": "FIRST PERSON (20-25 words)",
  "corruptionShift": {"score": 0-10, "reason": "Brief explanation (15-25 words)"},
}

## DAY 8 SCHEMA (Aftermath):
{
  "supportShift": {
    "people": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed", "shortLine": "Short civic reaction in first person 'we/us' (10-15 words)"},
    "holders": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed", "shortLine": "Short political reaction in first person 'we/us' (10-15 words)"},
    "mom": {"attitudeLevel": "slightly_supportive|moderately_supportive|strongly_supportive|slightly_opposed|moderately_opposed|strongly_opposed", "shortLine": "Warm personal reaction in FIRST PERSON 'I' (e.g., 'I worry about...', 'I'm proud of...', 'I fear that...') (10-15 words)"}
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
  "mirrorAdvice": "FIRST PERSON reflective sentence (20-25 words)",
  "corruptionShift": {"score": 0-10, "reason": "Brief explanation (15-25 words)"}
}`;

  return prompt;
}

/**
 * Build conditional user prompt (Day 1 vs Day 2+)
 */
function buildGameMasterUserPrompt(day, playerChoice = null) {
  // General instruction for all days
  let prompt = `First, carefully review the entire system prompt to understand all context and rules.\n\n`;

  if (day === 1) {
    prompt += `This is DAY 1 of 7.
  
  Follow the system prompt instructions for Day 1.
  Write the dilemma description in the Game Master voice described in the system prompt (playful, slightly teasing, speaking to "you").`;
  }
   else {
    prompt += `DAY ${day} of 7\n\nPrevious action: "${playerChoice.title}" - ${playerChoice.description}\n\n`;

    if (day === 7) {
      prompt += `This is the final day: clearly remind the player that their borrowed time in this world is almost over and this is their last decisive act.`;
    } else if (day === 8) {
      prompt += `This is Day 8 - the aftermath. Follow the system prompt instructions for Day 8.`;
    } else {
      prompt += `Follow the system prompt instructions for Day 2+. Write the dilemma description in the Game Master voice described in the system prompt (playful, slightly teasing, speaking to "you").`;
    }
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
      debugMode = false
    } = req.body;

    // Validation
    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({ error: "Missing or invalid gameId" });
    }

    if (!day || typeof day !== 'number' || day < 1 || day > 8) {
      return res.status(400).json({ error: "Missing or invalid day (must be 1-8)" });
    }

    console.log(`[GAME-TURN-V2] gameId=${gameId}, day=${day}, isFirstDilemma=${isFirstDilemma}`);

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
      const authorityLevel = calculateAuthorityLevel(
        gameContext.e12,
        gameContext.powerHolders,
        gameContext.playerIndex
      );

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
      const systemPrompt = buildGameMasterSystemPromptUnified(enrichedContext);

      // Build minimal Day 1 user prompt
      const userPrompt = buildGameMasterUserPrompt(day);

      // Debug logging (Day 1 prompts)
      if (debugMode) {
        console.log("\n" + "=".repeat(80));
        console.log("🐛 [DEBUG] Day 1 System Prompt:");
        console.log("=".repeat(80));
        console.log(systemPrompt);
        console.log("\n" + "=".repeat(80));
        console.log("🐛 [DEBUG] Day 1 User Prompt:");
        console.log("=".repeat(80));
        console.log(userPrompt);
        console.log("=".repeat(80) + "\n");
      }

      // Call AI
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ];

      let aiResponse;
      if (useXAI) {
        aiResponse = await callXAIChat(messages, MODEL_DILEMMA_XAI);
      } else {
        aiResponse = await callOpenAIChat(messages, MODEL_DILEMMA);
      }

      const content = aiResponse?.content;
      if (!content) {
        throw new Error("No content in AI response");
      }

      // Debug logging (Day 1 AI response)
      if (debugMode) {
        console.log("\n" + "=".repeat(80));
        console.log("🐛 [DEBUG] Day 1 Raw AI Response:");
        console.log("=".repeat(80));
        console.log(content);
        console.log("=".repeat(80) + "\n");
      }

      // Parse JSON response
      let parsed;
      try {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('[GAME-TURN-V2] JSON parse error:', parseError);
        console.error('[GAME-TURN-V2] Raw content:', content);
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }

      // Add assistant response to messages
      messages.push({ role: "assistant", content: content });

      // Store conversation with minimal meta (for reference only)
      const conversationMeta = {
        role: gameContext.role,
        systemName: gameContext.systemName,
        challengerName,
        authorityLevel
      };

      // FIXED: Store messages array properly in conversation.messages field
      storeConversation(gameId, gameId, useXAI ? "xai" : "openai", { ...conversationMeta, messages });

      console.log('[GAME-TURN-V2] Day 1 complete, conversation stored with unified system prompt');

      // Return response (flattened for frontend compatibility)
      return res.json({
        title: parsed.dilemma?.title || '',
        description: parsed.dilemma?.description || '',
        actions: parsed.dilemma?.actions || [],
        topic: parsed.dilemma?.topic || '',
        scope: parsed.dilemma?.scope || '',
        mirrorAdvice: parsed.mirrorAdvice,
        isGameEnd: false
      });
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

      // Build minimal Day 2+ user prompt
      const userPrompt = buildGameMasterUserPrompt(day, playerChoice);

      // Prepare messages array (history + new user message)
      const messages = [
        ...conversation.meta.messages,
        { role: "user", content: userPrompt }
      ];

      // Debug logging (Day 2+ prompts)
      if (debugMode) {
        console.log("\n" + "=".repeat(80));
        console.log(`🐛 [DEBUG] Day ${day} User Prompt:`);
        console.log("=".repeat(80));
        console.log(userPrompt);
        console.log("\n" + "=".repeat(80));
        console.log(`🐛 [DEBUG] Conversation History (${messages.length} messages):`);
        console.log("=".repeat(80));
        messages.forEach((msg, idx) => {
          console.log(`\n--- Message ${idx + 1} (${msg.role}) ---`);
          const preview = msg.content.substring(0, 500);
          console.log(preview + (msg.content.length > 500 ? '...' : ''));
        });
        console.log("=".repeat(80) + "\n");
      }

      // Call AI
      let aiResponse;
      if (useXAI) {
        aiResponse = await callXAIChat(messages, MODEL_DILEMMA_XAI);
      } else {
        aiResponse = await callOpenAIChat(messages, MODEL_DILEMMA);
      }

      const content = aiResponse?.content;
      if (!content) {
        throw new Error("No content in AI response");
      }

      // Debug logging (Day 2+ AI response)
      if (debugMode) {
        console.log("\n" + "=".repeat(80));
        console.log(`🐛 [DEBUG] Day ${day} Raw AI Response:`);
        console.log("=".repeat(80));
        console.log(content);
        console.log("=".repeat(80) + "\n");
      }

      // Parse JSON response
      let parsed;
      try {
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('[GAME-TURN-V2] JSON parse error:', parseError);
        console.error('[GAME-TURN-V2] Raw content:', content);
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }

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

      // Update meta with new messages array
      const updatedMeta = {
        ...conversation.meta,
        messages: updatedMessages
      };

      // FIXED: Store updated messages properly
      storeConversation(gameId, gameId, conversation.provider, updatedMeta);

      console.log(`[GAME-TURN-V2] Day ${day} complete, conversation updated (${updatedMessages.length} total messages)`);

      // Return response (flattened for frontend compatibility)
      return res.json({
        title: parsed.dilemma?.title || '',
        description: parsed.dilemma?.description || '',
        actions: parsed.dilemma?.actions || [],
        topic: parsed.dilemma?.topic || '',
        scope: parsed.dilemma?.scope || '',
        supportShift,
        dynamicParams,
        mirrorAdvice: parsed.mirrorAdvice,
        corruptionShift: parsed.corruptionShift,
        isGameEnd: isAftermathTurn
      });
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
