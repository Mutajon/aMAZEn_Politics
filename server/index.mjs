// server/index.mjs
import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import { fileURLToPath } from "url";
import loggingRouter from "./api/logging.mjs";

const app = express();
app.use(bodyParser.json());

// -------------------- Data Logging Routes --------------------
// Mount logging API endpoints (for research data collection)
app.use("/api/log", loggingRouter);
// --------------------------------------------------------------

// -------------------- Model & API config --------------------
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const IMAGE_URL = "https://api.openai.com/v1/images/generations";

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


// Image model
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-1";
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
`.trim();
// ----------------------------------------------------------------

// Canonical political systems (must match the client table)
const ALLOWED_SYSTEMS = [
  "Absolute Monarchy",
  "Constitutional Monarchy",
  "Elective Monarchy",
  "Direct Democracy",
  "Representative Democracy",
  "Parliamentary Democracy",
  "Presidential Democracy",
  "Federal Republic",
  "Unitary Republic",
  "People’s Republic",
  "Banana Republic",
  "Dictatorship",
  "Military Junta",
  "One-Party State",
  "Clerical Theocracy",
  "Divine Right Monarchy",
  "Anarchy",
  "Oligarchy",
  "Plutocracy",
  "Technocracy",
  "Timocracy",
  "Kleptocracy",
  "Stratocracy",
  "Gerontocracy",
  "Kakistocracy",
];
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

    try {
      return JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      return fallback;
    }
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
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`OpenAI chat error ${resp.status}: ${t}`);
    }
    const data = await resp.json();
    const choice = data?.choices?.[0];
    const content = choice?.message?.content ?? "";
    const finishReason = choice?.finish_reason;

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
      tts: TTS_MODEL,
      ttsVoice: TTS_VOICE,
      dilemma: MODEL_DILEMMA,
      dilemmaPremium: MODEL_DILEMMA_PREMIUM,
      dilemmaAnthropic: MODEL_DILEMMA_ANTHROPIC,
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
        paragraph = await getParagraphOnce();
        if (paragraph) break;
      } catch (err) {
        console.warn(`[server] intro-paragraph attempt ${attempt} failed:`, err?.message || err);
      }
      if (attempt === 1) await sleep(600); // simple backoff before the second try
    }

    if (!paragraph) return res.status(503).json({ error: "No content returned" });
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

// -------------------- Power analysis (uses AI) ---------------
app.post("/api/analyze-role", async (req, res) => {
  try {
    const role = String(req.body?.role || "").trim();

    const fallback = {
      systemName: "Generic Mixed Republic",
      systemDesc: "A plausible balance of powers for a mixed system.",
      flavor: "A tenuous balance binds factions together.",
      holders: [
        { name: "Executive", percent: 30, icon: "👑", note: "Leads day-to-day rule" },
        { name: "Legislature", percent: 35, icon: "🏛️", note: "Makes laws and budgets" },
        { name: "Judiciary", percent: 15, icon: "⚖️", note: "Interprets and constrains" },
        { name: "Elites & Factions", percent: 20, icon: "🦅", note: "Informal yet crucial power" },
      ],
      playerIndex: null,
    };

    const system =
  "You analyze a player's ROLE+SETTING into a political power breakdown **and** choose a canonical political system.\n" +
  "Return STRICT JSON only as:\n" +
  "{\n" +
  '  "systemName": "<one of ALLOWED>",\n' +
  '  "systemDesc": "<short, neutral explanation>",\n' +
  '  "flavor": "<short flavor> ",\n' +
  '  "holders": [{"name":"", "percent":0, "icon":"", "note":""}],\n' +
  '  "playerIndex": null|number\n' +
  "}\n" +
  "- IMPORTANT: systemName MUST be exactly one of the supplied ALLOWED names. Do NOT invent new names.\n" +
  "- holders: 4–5 concise entities whose percents sum to 100 (±1 rounding).\n" +
  "- Keep labels short and game-friendly; avoid country-specific system names.";

const user =
  `ROLE: ${role}\n` +
  `ALLOWED SYSTEMS: ${JSON.stringify(ALLOWED_SYSTEMS)}\n` +
  "Pick the closest political system from ALLOWED (exact string). If borderline, choose the most broadly recognized match from ALLOWED.\n" +
  "JSON ONLY.";


    const out = await aiJSON({ system, user, model: MODEL_ANALYZE, temperature: 0.4, fallback });
    // Coerce & normalize
    let sum = 0;
    const holders = (Array.isArray(out?.holders) ? out.holders : fallback.holders)
      .slice(0, 8)
      .map((h) => {
        const p = Math.max(0, Math.min(100, Number(h?.percent) || 0));
        sum += p;
        return {
          name: String(h?.name || "").slice(0, 40) || "Group",
          percent: p,
          icon: String(h?.icon || "").slice(0, 2) || undefined,
          note: String(h?.note || "").slice(0, 80) || undefined,
        };
      });

    if (sum > 0 && Math.abs(100 - sum) > 1) {
      holders.forEach((h) => (h.percent = Math.round((h.percent / sum) * 100)));
      const diff = 100 - holders.reduce((a, b) => a + b.percent, 0);
      if (diff) holders[0].percent += diff;
    }

    const result = {
      systemName: String(out?.systemName || fallback.systemName),
      systemDesc: String(out?.systemDesc || fallback.systemDesc),
      flavor: String(out?.flavor || fallback.flavor),
      holders,
      playerIndex:
        out?.playerIndex === null || out?.playerIndex === undefined
          ? null
          : Number(out.playerIndex),
    };
    result.systemName = coerceSystemName(result.systemName, role + " " + (result.systemDesc || ""));
    if (!ALLOWED_SYSTEMS.includes(result.systemName)) {
      // fallback description/flavor from the canonical list
      const canon = ALLOWED_SYSTEMS.find(n => n === result.systemName);
    }
    res.json(result);
  } catch (e) {
    console.error("Error in /api/analyze-role:", e?.message || e);
    res.status(500).json({ error: "analyze-role failed" });
  }
});
// Ensure systemName is in the canonical list; if not, coerce with a light heuristic
function coerceSystemName(name, text) {
  if (ALLOWED_SYSTEMS.includes(name)) return name;
  const t = (name + " " + (text || "")).toLowerCase();
  if (/(king|queen|monarch|emperor|sultan|tsar)/.test(t)) return "Absolute Monarchy";
  if (/(divine|holy|god)/.test(t)) return "Divine Right Monarchy";
  if (/(priest|temple|church|cleric|theocrat)/.test(t)) return "Clerical Theocracy";
  if (/(army|general|legion|junta|military)/.test(t)) return "Military Junta";
  if (/(parliament|pm|coalition)/.test(t)) return "Parliamentary Democracy";
  if (/(president).*(congress|legislature)/.test(t)) return "Presidential Democracy";
  if (/(referendum|plebiscite|vote directly)/.test(t)) return "Direct Democracy";
  if (/(representative|senate|assembly|congress|consul)/.test(t)) return "Representative Democracy";
  if (/(federal|province|state|regional)/.test(t)) return "Federal Republic";
  if (/(unitary|central)/.test(t)) return "Unitary Republic";
  if (/(party).*(only|single|sole|one)/.test(t)) return "One-Party State";
  if (/(oligarch|elite|patrician)/.test(t)) return "Oligarchy";
  if (/(wealth|merchant|bank|commerce)/.test(t)) return "Plutocracy";
  if (/(technocrat|engineer|scientist|expert)/.test(t)) return "Technocracy";
  if (/(elder|old)/.test(t)) return "Gerontocracy";
  if (/(anarchy|no government)/.test(t)) return "Anarchy";
  if (/(steal|corrupt|klepto|graft)/.test(t)) return "Kleptocracy";
  if (/(banana|puppet)/.test(t)) return "Banana Republic";
  return "Representative Democracy";
}




// -------------------- Avatar generation ----------------------
app.post("/api/generate-avatar", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const body = {
      model: IMAGE_MODEL,
      prompt,
      size: IMAGE_SIZE,
      quality: IMAGE_QUALITY,
    };

    const r = await fetch(IMAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`OpenAI image error ${r.status}: ${t}`);
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
// Response: ONE sentence, ~20–25 words, playful mirror voice (no labels/numbers)

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

    // === System prompt: playful, but no literal label dump, no numbers, no "values doing actions" ===
    const system =
      "You are a magical mirror sidekick bound to the player's soul. You reflect their inner values with warmth, speed, and theatrical charm.\n\n" +
      "VOICE:\n" +
      "- Lively, affectionate, wise-cracking; think genie/impresario energy, but grounded and not cartoonish.\n" +
      "- Use vivid comparisons and fresh metaphors; avoid slapstick choreography.\n" +
      "- Be exuberant without chaos; playful, not mocking.\n\n" +
      "HARD RULES (ALWAYS APPLY):\n" +
      "- Output EXACTLY ONE sentence. 20–25 words total.\n" +
      "- NEVER reveal numbers, scores, scales, or ranges.\n" +
      "- NEVER repeat the value labels verbatim; do not quote, uppercase, or mirror slashes.\n" +
      "- Paraphrase technical labels into friendly, everyday phrases (e.g., ‘Truth/Trust’ → ‘truth you can lean on’).\n" +
      "- Do NOT stage literal actions for values (no “X is doing push-ups”, “baking cookies”, etc.).\n" +
      "- No lists, no colons introducing items, no parenthetical asides.\n" +
      "- Keep it positive, curious, and a touch mischievous; zero cynicism.\n";

    // === User prompt: pass names only (no strengths), ask for paraphrased synthesis ===
    const user =
      `PLAYER TOP VALUES (names only):\n` +
      `GOALS: ${what1.name}, ${what2.name}\n` +
      `JUSTIFICATIONS: ${whence1.name}, ${whence2.name}\n\n` +
      `TASK:\n` +
      `Write ONE sentence (20–25 words) in the mirror's voice that playfully captures how these goals blend with these justifications.\n` +
      `Do not show numbers. Do not repeat labels verbatim; paraphrase them into natural language. No lists or colon-led structures.\n`;

    const text = useAnthropic
      ? await aiTextAnthropic({ system, user, model: MODEL_MIRROR_ANTHROPIC })
      : await aiText({ system, user, model: MODEL_MIRROR });

    // === Last-mile sanitizer: keep one sentence and clamp word count ===
    const raw = (text || "The mirror squints… then grins mischievously.").trim();

    // take first sentence-ish chunk
    let one = raw.split(/[.!?]+/).map(s => s.trim()).filter(Boolean)[0] || raw;

    // strip digits just in case
    one = one.replace(/\d+/g, "");

    // trim to ~25 words max (preserve readability)
    const words = one.split(/\s+/).filter(Boolean);
    if (words.length > 25) {
      one = words.slice(0, 25).join(" ").replace(/[,\-–—;:]$/, "") + ".";
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
- Title ≤ 60 chars. Description 2–3 sentences. Mature, gripping, in-world.
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

  if (obj.title.length > 60) return { valid: false, reason: "Title too long" };

  // Check action summaries (just one sentence, no word count)
  for (const a of obj.actions) {
    if (!a?.summary) return { valid: false, reason: "Missing action summary" };

    // One sentence = exactly one period at end (split should give ["content", ""])
    const parts = a.summary.split('.');
    if (parts.length !== 2 || parts[1].trim() !== '') {
      return { valid: false, reason: `Action summary not exactly one sentence: "${a.summary}"` };
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
 * Safely parse JSON with fallback
 */
function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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
- Slightly cynical: dry wit and side-eye, not sneering or mean. One wink, not a roast.
- Avoid jargon and bureaucratese. Describe what roles do, not rare titles (e.g., “regional governor (jiedushi)” instead of “jiedushi”).
- Never say “dilemma” or refer to game mechanics.
- Title ≤ 60 chars. Description: 2–3 sentences, real and concrete.
- Favor human stakes and visible consequences over technical phrasing.

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

IMPORTANT: No numbers, no meta language, no bureaucratese. Sound like a sharp political advisor, not a policy memo.

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
  parts.push('TASK: Write one concrete situation anchored in ROLE+SETTING with three system-appropriate responses.');

  return parts.join('\n');
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

    const userPrompt = buildLightUserPrompt({ role, system, day, daysLeft, subjectStreak, previous, topWhatValues, thematicGuidance, scopeGuidance, recentTopics, recentDilemmaTitles });

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
    const { text, title, description } = req.body || {};
    if (typeof text !== "string" || typeof title !== "string" || typeof description !== "string") {
      return res.status(400).json({ error: "Missing text/title/description" });
    }

    // Use the same chat helper you already have in this server
    // Falls back to CHAT_MODEL / MODEL_VALIDATE envs
    const model =
      process.env.MODEL_VALIDATE ||
      process.env.CHAT_MODEL ||
      "gpt-5-mini";

    const system = [
      "You are a PERMISSIVE validator for a strategy game.",
      "Given a DILEMMA (title + description) and a SUGGESTION from the player, your job is to accept anything that shows reasonable engagement.",
      "",
      "ACCEPT the suggestion if it:",
      "- Shows ANY attempt to engage with the dilemma (even if tangentially related)",
      "- Contains actual words/sentences (not random keyboard mashing)",
      "- Suggests any kind of action, policy, or response",
      "",
      "REJECT only if:",
      "- Empty or whitespace-only input",
      "- Pure gibberish (random characters like 'asdfgh', 'xyz123')",
      "- Completely irrelevant to politics/governance (e.g., 'I like pizza', 'random thoughts')",
      "",
      "DEFAULT STANCE: If in doubt, ACCEPT the suggestion.",
      "Only return compact JSON: { \"valid\": boolean, \"reason\": string }.",
    ].join("\n");

    const user = JSON.stringify(
      {
        dilemma: { title, description },
        suggestion: text,
      },
      null,
      2
    );

    // aiText is assumed to exist in this file per your current API layer
    const raw = await aiText({ system, user, model, temperature: 0 });

    // Extract JSON payload safely
    let json = null;
    try {
      // try as-is
      json = JSON.parse(raw.trim());
    } catch {
      // try to pull first {...} block
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        json = JSON.parse(m[0]);
      }
    }

    if (!json || typeof json.valid !== "boolean") {
      return res.status(200).json({ valid: false, reason: "Malformed validator output" });
    }
    const reason = typeof json.reason === "string" ? json.reason : "";
    return res.json({ valid: !!json.valid, reason });
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

Generate 1-3 contextually relevant dynamic parameters that show the immediate consequences of the player's political decision. These parameters must be:
- ULTRA-SHORT: Maximum 4-5 words each
- NO explanations or descriptions
- Pure factual outcomes with numbers
- Specific, measurable results only

${ANTI_JARGON_RULES}

CRITICAL RESTRICTIONS (ABSOLUTELY ENFORCED):

1. NEVER mention support levels or approval:
   - NO "People support rising" or "Public approval up"
   - NO "Middle entity support" or "Legislature backing"
   - NO "Allies satisfied" or "Mom proud"
   - Support is shown separately - avoid 100% redundancy

2. NEVER mention budget, money, or treasury:
   - NO "Budget decreased" or "Treasury depleted"
   - NO "Funds low" or "Revenue increased"
   - Budget is shown separately - avoid 100% redundancy

3. NEVER mention trivial or vague events:
   - NO "Scene at plaza" or "Mood shifts"
   - NO "Atmosphere tense" or "Feelings mixed"
   - Each parameter must be CONCRETE and SIGNIFICANT

4. FOCUS ON these engaging, game-changing consequences:
   ✅ Casualties: "40 militia fighters neutralized", "14 civilians dead"
   ✅ International reactions: "12 countries condemn action", "UN resolution pending"
   ✅ Political changes: "5 ministers resign", "Opposition calls vote"
   ✅ Protests: "3,000 protesters arrested", "Riots in 4 cities"
   ✅ Economic indicators: "Inflation up 15%", "Unemployment hits 18%"
   ✅ Policy outcomes: "Treaty signed with 3 nations", "Law passes 65-35"
   ✅ Infrastructure: "3 hospitals under construction", "Dam project halted"
   ✅ Military: "Territory gained in north", "2 bases captured"

5. Each parameter must be:
   - Specific (numbers, locations, entities)
   - Interesting (player wants to know this)
   - Non-redundant (not shown elsewhere)
   - Consequences-focused (what happened due to action)

GOOD EXAMPLES (follow this exact format):
- "40 militia fighters neutralized"
- "14 civilians dead"
- "12 countries issue condemnation"
- "3,000 protesters arrested"
- "Inflation up 15%"
- "5 ministers resign"
- "3 hospitals under construction"

BAD EXAMPLES (NEVER generate these):
- "3 coalition MPs appeased" (support-related, redundant)
- "1 judicial review filed" (trivial, not engaging)
- "People support rising" (support-related, redundant)
- "Budget decreased" (budget-related, redundant)
- "Scene at plaza" (vague, trivial)
- "Mood shifts positive" (vague, not specific)

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
      "text": "Specific consequence with numbers",
      "tone": "up|down|neutral"
    }
  ]
}`;

    const result = await aiJSON({
      system,
      user,
      model: MODEL_DILEMMA, // Use same model as dilemmas
      temperature: 0.8,
      fallback: { parameters: [] }
    });

    // Validate and clean the response
    const parameters = Array.isArray(result.parameters)
      ? result.parameters.slice(0, 3).map((param, index) => ({
          id: param.id || `param_${index}`,
          icon: param.icon || "AlertTriangle",
          text: param.text || "Unknown effect",
          tone: ["up", "down", "neutral"].includes(param.tone) ? param.tone : "neutral"
        }))
      : [];

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
        playerName,
        role,
        systemName,
        historyLength: dilemmaHistory?.length,
        finalSupport,
        topCompassValues
      });
    }

    // Fallback response if API fails
    const fallback = {
      intro: "After many years of rule, the leader passed into history.",
      remembrance: "They will be remembered for their decisions, both bold and cautious. Time will tell how history judges their reign.",
      rank: "The Leader",
      decisions: (dilemmaHistory || []).map((entry, i) => ({
        title: entry.choiceTitle || `Decision ${i + 1}`,
        reflection: "A choice was made, consequences followed."
      })),
      ratings: {
        autonomy: "medium",
        liberalism: "medium"
      },
      valuesSummary: "A leader who navigated complex political terrain with determination.",
      haiku: "Power came and went\nDecisions echo through time\nHistory records"
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

Remembrance: 3-4 sentences on legacy—personal vs people's benefit, autonomy vs obedience, reformer or tyrant.

Rank: short, amusing fictional title based on Remembrance part above.

Decisions: for each decision, provide:
- title: ≤12-word summary of the action taken
- reflection: one SHORT sentence (~15-25 words) that EXPLAINS WHY this specific decision demonstrates support for or opposition to autonomy/heteronomy AND liberalism/totalism. Be concrete and educational—describe what aspect of the decision shows the ideological position rather than just stating the rating.

Examples of good reflections:
- "Tightly controlled ceremony reflects heteronomy (state choreography) and liberalism (order without suppressing dissent)"
- "Consulting citizens shows autonomy (empowering individual choice) and moderate liberalism (deliberative, slower process)"
- "Forceful crackdown demonstrates heteronomy (external control) and totalism (prioritizing order over individual freedoms)"

Ratings:

Autonomy: very-low|low|medium|high|very-high
Liberalism: very-low|low|medium|high|very-high

Values Summary: one sentence capturing main motivations, justifications, means, and who benefited.

Haiku: a 3-line poetic summary of their reign.

OUTPUT (STRICT JSON)
Return only:

{
  "intro": "",
  "remembrance": "",
  "rank": "",
  "decisions": [{"title": "", "reflection": ""}],
  "ratings": {"autonomy": "", "liberalism": ""},
  "valuesSummary": "",
  "haiku": ""
}`;

    // Build user prompt with game data
    const compassSummary = (topCompassValues || [])
      .map(cv => `${cv.dimension}:${cv.componentName}(${cv.value})`)
      .join(", ");

    const historySummary = (dilemmaHistory || [])
      .map(entry =>
        `Day ${entry.day}: "${entry.dilemmaTitle}" → chose "${entry.choiceTitle}" (${entry.choiceSummary}). ` +
        `Support after: people=${entry.supportPeople}, middle=${entry.supportMiddle}, mom=${entry.supportMom}.`
      )
      .join("\n");

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
${historySummary || "No decisions recorded"}

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
    const response = {
      intro: String(result?.intro || fallback.intro).slice(0, 500),
      remembrance: String(result?.remembrance || fallback.remembrance).slice(0, 1000),
      rank: String(result?.rank || fallback.rank).slice(0, 100),
      decisions: Array.isArray(result?.decisions)
        ? result.decisions.map(d => ({
            title: String(d?.title || "").slice(0, 120),
            reflection: String(d?.reflection || "").slice(0, 300)
          }))
        : fallback.decisions,
      ratings: {
        autonomy: ["very-low", "low", "medium", "high", "very-high"].includes(result?.ratings?.autonomy)
          ? result.ratings.autonomy
          : fallback.ratings.autonomy,
        liberalism: ["very-low", "low", "medium", "high", "very-high"].includes(result?.ratings?.liberalism)
          ? result.ratings.liberalism
          : fallback.ratings.liberalism
      },
      valuesSummary: String(result?.valuesSummary || fallback.valuesSummary).slice(0, 500),
      haiku: String(result?.haiku || fallback.haiku).slice(0, 300)
    };

    return res.json(response);

  } catch (e) {
    console.error("Error in /api/aftermath:", e?.message || e);
    return res.status(502).json({
      intro: "After many years of rule, the leader passed into history.",
      remembrance: "They will be remembered for their decisions. Time will tell how history judges their reign.",
      rank: "The Leader",
      decisions: [],
      ratings: { autonomy: "medium", liberalism: "medium" },
      valuesSummary: "A leader who navigated complex political terrain.",
      haiku: "Power came and went\nDecisions echo through time\nHistory records"
    });
  }
});

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
});