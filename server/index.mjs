// server/index.mjs
import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(bodyParser.json());

// -------------------- Model & API config --------------------
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const IMAGE_URL = "https://api.openai.com/v1/images/generations";

// Initialize Anthropic client
const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;

// One default text model + per-task overrides from .env
const CHAT_MODEL_DEFAULT = process.env.CHAT_MODEL || "gpt-5-mini";
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


async function aiText({ system, user, model = CHAT_MODEL_DEFAULT, temperature }) {
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
    return (data?.choices?.[0]?.message?.content ?? "").trim();
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
    "You validate a single short line describing a player's ROLE together with a SETTING.\n" +
    "ACCEPT if it clearly has (1) a role (the 'who') and (2) a setting (place and/or time). " +
    "A PLACE alone is a valid setting (e.g., country names, regions, fictional locations). " +
    "A TIME alone is a valid setting (e.g., historical periods, dates, eras). " +
    "Examples that SHOULD pass: 'Prime Minister of Israel', 'President of United States', " +
    "'a king in medieval England', 'a partisan leader during World War II', " +
    "'a Mars colony governor in 2300', 'Chancellor of Germany', 'Senator of California'. " +
    "Examples that SHOULD fail: 'a king' (no setting), 'in medieval England' (no role), 'freedom' (neither).\n" +
    "Return STRICT JSON only as {\"valid\": true|false, \"reason\": \"short reason if invalid\"}. No extra keys, no prose.";

  const user = `Input: ${raw || ""}`;

  const out = await aiJSON({ system, user, model: MODEL_VALIDATE, temperature: 0, fallback: null });
  if (!out || typeof out.valid !== "boolean") {
    return res.status(503).json({ error: "AI validator unavailable" });
  }
  return res.json({ valid: !!out.valid, reason: String(out.reason || "") });
});

// -------------------- Name suggestions ----------------------
app.post("/api/name-suggestions", async (req, res) => {
  try {
    const { role } = req.body || {};
    const system =
      "Generate three name+prompt pairs for a game avatar. " +
      "Return STRICT JSON {\"male\":{\"name\":\"\",\"prompt\":\"\"},\"female\":{...},\"any\":{...}}. " +
      "The 'prompt' MUST start with a comma and include ONLY physical features (no role, no style). " +
      "Keep neutral and respectful.";
    const user = `Role: ${role || ""}`;
    const parsed = await aiJSON({ system, user, model: MODEL_NAMES, temperature: 0.6, fallback: {} });

    const out = ["male", "female", "any"].reduce((acc, k) => {
      const v = parsed?.[k] || {};
      acc[k] = {
        name: String(v?.name || "").slice(0, 80),
        prompt: String(v?.prompt || "").slice(0, 1200),
      };
      return acc;
    }, {});

    return res.json(out);
  } catch (err) {
    console.error("Error in /api/name-suggestions:", err);
    return res.status(500).json({ error: "Failed to generate name suggestions" });
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

// -------------------- Mirror summary (uses AI) ---------------
app.post("/api/mirror-summary", async (req, res) => {
  try {
    const useAnthropic = !!req.body?.useAnthropic;
    const topWhat    = Array.isArray(req.body?.topWhat)    ? req.body.topWhat    : [];
    const topWhence  = Array.isArray(req.body?.topWhence)  ? req.body.topWhence  : [];
    const topOverall = Array.isArray(req.body?.topOverall) ? req.body.topOverall : [];
    const dilemma    = req.body?.dilemma || null;

    // DEBUG LOGGING
    console.log("\n[mirror-summary] ===== REQUEST DEBUG =====");
    console.log(`[mirror-summary] Using provider: ${useAnthropic ? 'ANTHROPIC (Claude)' : 'OPENAI (GPT)'}`);
    console.log("[mirror-summary] topWhat:", JSON.stringify(topWhat));
    console.log("[mirror-summary] topWhence:", JSON.stringify(topWhence));
    console.log("[mirror-summary] topOverall:", JSON.stringify(topOverall));
    console.log("[mirror-summary] Has dilemma:", !!dilemma);

    // NEW: Game context for holistic reflection
    const dilemmaHistory = Array.isArray(req.body?.dilemmaHistory) ? req.body.dilemmaHistory : [];
    const supportPeople = Number(req.body?.supportPeople ?? 50);
    const supportMiddle = Number(req.body?.supportMiddle ?? 50);
    const supportMom = Number(req.body?.supportMom ?? 50);
    const middleName = String(req.body?.middleName || "the establishment");
    const day = Number(req.body?.day || 1);
    const totalDays = Number(req.body?.totalDays || 7);

    // Support status helpers - vivid descriptions, NO percentages
    function getSupportStatus(value) {
      if (value >= 60) return "adores you";
      if (value >= 45) return "tolerates your antics";
      if (value >= 30) return "grows restless";
      if (value >= 20) return "whispers plots";
      return "sharpens their knives";
    }

    function getSupportTrend(history, entityKey) {
      if (history.length < 2) return "stable";
      const recent = history.slice(-3);
      const deltas = [];
      for (let i = 1; i < recent.length; i++) {
        deltas.push(recent[i][entityKey] - recent[i-1][entityKey]);
      }
      const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      if (avgDelta > 5) return "rising";
      if (avgDelta < -5) return "falling";
      return "stable";
    }

    // Pattern analysis - identify governing style from history
    function analyzeGoverningPattern(history, topValues) {
      if (history.length === 0) return "Journey just beginning";

      // Count themes in choices
      const themes = {
        care: 0, liberty: 0, equality: 0, tradition: 0,
        security: 0, pragmatism: 0, truth: 0
      };

      history.forEach(entry => {
        const text = `${entry.choiceTitle} ${entry.choiceSummary}`.toLowerCase();
        if (/care|compassion|help|support|welfare/.test(text)) themes.care++;
        if (/liberty|freedom|rights|autonomy/.test(text)) themes.liberty++;
        if (/equal|fair|justice/.test(text)) themes.equality++;
        if (/tradition|heritage|custom/.test(text)) themes.tradition++;
        if (/security|order|patrol|enforce/.test(text)) themes.security++;
        if (/pragmatic|practical|compromise/.test(text)) themes.pragmatism++;
        if (/truth|transparent|honest/.test(text)) themes.truth++;
      });

      const dominant = Object.entries(themes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .filter(([_, count]) => count > 0);

      if (dominant.length === 0) return "Eclectic choices defy categorization";

      const pattern = dominant.map(([theme, count]) =>
        `${count} ${count === 1 ? 'choice' : 'choices'} favoring ${theme}`
      ).join(', ');

      // Check alignment with values
      const topValueNames = topValues.map(v => v.name.toLowerCase());
      const aligned = dominant.some(([theme]) =>
        topValueNames.some(val => val.includes(theme))
      );

      return aligned
        ? `${pattern} (aligned with stated values)`
        : `${pattern} (curiously divergent from stated values)`;
    }

    const peopleStatus = getSupportStatus(supportPeople);
    const middleStatus = getSupportStatus(supportMiddle);
    const momStatus = getSupportStatus(supportMom);

    const peopleTrend = getSupportTrend(dilemmaHistory, 'supportPeople');
    const middleTrend = getSupportTrend(dilemmaHistory, 'supportMiddle');
    const momTrend = getSupportTrend(dilemmaHistory, 'supportMom');

    const governingPattern = analyzeGoverningPattern(dilemmaHistory, topOverall);

    const system =
      "You are a cynically witty magical mirror—part wise mentor, part dark jester—reflecting on the player's political journey with sardonic humor.\n\n" +
      "OUTPUT REQUIREMENTS:\n" +
      "- Maximum 25-30 words (STRICT)\n" +
      "- Single sentence only\n" +
      "- Cynically amusing, darkly funny, mischievously insightful\n" +
      "- Educational despite the snark\n\n" +
      "YOUR ROLE:\n" +
      "Synthesize the player's journey into ONE wickedly witty sentence that:\n" +
      "1. Observes their governing pattern with ironic wit\n" +
      "2. Notes support health using VIVID LANGUAGE (never percentages)\n" +
      "3. Reflects on value alignment with dark humor\n" +
      "4. Offers wisdom wrapped in cynicism\n" +
      "5. Optionally references current dilemma with sardonic flair\n\n" +
      "CRITICAL: NEVER mention support percentages - they're shown elsewhere\n" +
      "Instead use vivid descriptions: \"adores you\", \"sharpens knives\", \"whispers plots\", \"grumbles darkly\"\n\n" +
      "TONE EXAMPLES:\n" +
      "- Sardonic: \"Six days of idealism, and the treasury's belly grumbles while your allies applaud—principles fill hearts, not coffers.\"\n" +
      "- Dark humor: \"Your devotion to liberty shines bright, though the Council sharpens knives in shadowed corners; freedom's price comes due.\"\n" +
      "- Mischievous: \"Three days championing care, and the people adore you—pity compassion can't pay soldiers when the bills arrive.\"\n" +
      "- Cynical wisdom: \"Tradition guides you well, yet your mother wonders if her child remembers roots or just plays at revolution for the crowd.\"\n" +
      "- Ironic: \"Pragmatism served you brilliantly thus far—though one wonders if you'll recognize your values when you finally look in this mirror.\"";

    let user;
    if (dilemmaHistory.length > 0 && dilemma) {
      // Context-rich reflection with full game journey
      const valuesList = topOverall.map(v => `- ${v.name}: ${v.strength}/10`).join('\n');

      const historyFormatted = dilemmaHistory.map(e =>
        `Day ${e.day}: "${e.dilemmaTitle}" → Chose: "${e.choiceTitle}"`
      ).join('\n');

      user =
        "PLAYER'S JOURNEY ANALYSIS:\n\n" +
        "STRONGEST VALUES:\n" +
        valuesList + "\n\n" +
        "GAME PROGRESS:\n" +
        `- Day ${day} of ${totalDays}\n` +
        "- Support Health (use these vivid descriptions, NOT percentages):\n" +
        `  * People: ${peopleStatus} (${peopleTrend})\n` +
        `  * ${middleName}: ${middleStatus} (${middleTrend})\n` +
        `  * Personal Allies: ${momStatus} (${momTrend})\n\n` +
        "GOVERNING PATTERN FROM HISTORY:\n" +
        governingPattern + "\n\n" +
        `DECISION HISTORY (${dilemmaHistory.length} choices made):\n` +
        historyFormatted + "\n\n" +
        "CURRENT DILEMMA:\n" +
        `Title: ${dilemma.title}\n` +
        `Situation: ${dilemma.description}\n\n` +
        "TASK:\n" +
        "Craft ONE cynically witty sentence that:\n" +
        "- Observes overall journey with dark humor\n" +
        "- NEVER mentions support percentages (use vivid descriptions instead)\n" +
        "- Notes critical support issues with sardonic wit\n" +
        "- Reflects on value alignment ironically\n" +
        "- Offers wisdom through cynical observations\n" +
        "- Optionally references current dilemma if it fits\n\n" +
        "STYLE GUIDELINES:\n" +
        "- Think: Oscar Wilde meets Machiavelli\n" +
        "- Wit over sentiment, irony over earnestness\n" +
        "- Educational wisdom hidden in cynical humor\n" +
        "- Mischievous, sardonic, darkly amusing";
    } else if (dilemma) {
      // Dilemma-specific recommendations (original logic for early game)
      const valuesList = topWhat.length > 0
        ? topWhat.map(v => `- ${v.name}: ${v.strength}/10`).join("\n")
        : topOverall.map(v => `- ${v.name}: ${v.strength}/10`).join("\n");

      user =
        "PLAYER'S STRONGEST VALUES:\n" +
        valuesList + "\n\n" +
        "CURRENT DILEMMA:\n" +
        "Title: " + dilemma.title + "\n" +
        "Situation: " + dilemma.description + "\n\n" +
        "OPTIONS (do NOT mention these letters):\n" +
        dilemma.actions.map((a, i) => `- Option ${i+1}: ${a.title} - ${a.summary}`).join("\n") + "\n\n" +
        "TASK:\n" +
        "Given their values, hint at which direction might suit them OR warn against a poor fit.\n" +
        "Use cynical wit, dark humor, and sardonic observations.\n" +
        "Keep it under 30 words, wickedly witty and engaging.";
    } else {
      // Fallback: Original personality appraisal (Quiz screen)
      const valuesList = topWhat.length > 0
        ? topWhat.map(v => `${v.name} (${v.strength}/10)`).join(", ")
        : topOverall.map(v => `${v.name} (${v.strength}/10)`).join(", ");

      console.log("[mirror-summary] QUIZ SCREEN PATH - valuesList:", valuesList);

      user =
        "PLAYER'S STRONGEST VALUES:\n" +
        valuesList + "\n\n" +
        "TASK:\n" +
        "Craft a brief personality appraisal (under 30 words) that is short, engaging, and cynically amusing:\n" +
        "- ACCURATELY reflects their TOP values (these are what they value MOST)\n" +
        "- Describes what drives them WITH dark humor, not AGAINST their values\n" +
        "- If they value Truth, describe them as truth-seeking (not lie-spreading)\n" +
        "- If they value Liberty, describe them as freedom-loving (not authoritarian)\n" +
        "- Add sardonic wit about HOW they pursue these values, not mockery of the values themselves\n\n" +
        "EXAMPLE (if values were Care + Pragmatism):\n" +
        "\"You champion compassion with ruthless efficiency—hearts warmed, ledgers balanced, and no one quite sure if you're saint or accountant.\"\n\n" +
        "Now craft your appraisal:";

      console.log("[mirror-summary] USER PROMPT:\n" + user);
    }

    // tiny retry wrapper
    const tryOnce = () => useAnthropic
      ? aiTextAnthropic({ system, user, model: MODEL_MIRROR_ANTHROPIC })
      : aiText({ system, user, model: MODEL_MIRROR });
    let text = await tryOnce();
    let isFallback = false;

    if (!text) {
      await new Promise(r => setTimeout(r, 500));
      text = await tryOnce();
    }
    if (!text) {
      text = "The mirror squints… and offers a knowing smile.";
      isFallback = true;
    }

    const summary = text.trim();
    res.json({ summary, isFallback });
  } catch (e) {
    console.error("Error in /api/mirror-summary:", e?.message || e);
    res.status(500).json({
      summary: "The mirror is foggy—try again in a moment.",
      isFallback: true,
    });
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

    if (topWhat.length < 2) {
      return res.status(400).json({ error: "Need at least 2 top values" });
    }
    if (!dilemma?.title || !dilemma?.description || !Array.isArray(dilemma?.actions)) {
      return res.status(400).json({ error: "Invalid dilemma data" });
    }

    const [value1, value2] = topWhat;

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
      "- Paraphrase technical labels into friendly phrases (e.g., “Truth/Trust” → “truth you can lean on”).\n" +
      "- Refer to the two values by their essence, not their literal names.\n" +
      "- Do NOT mention option letters [A]/[B]/[C] or numbers; describe choices naturally.\n" +
      "- End with a nudge toward the most aligned option (by essence), not by letter.\n" +
      "- Keep it tight and punchy — every word counts!";

    // Build options text for context (unchanged)
    const optionsText = dilemma.actions
      .map((a) => `[${a.id.toUpperCase()}] ${a.title}: ${a.summary}`)
      .join("\n");

    // User prompt — pass NAMES ONLY (no strengths), ask for paraphrase
    const user =
      `PLAYER'S TOP VALUES (names only): ${value1.name}, ${value2.name}\n\n` +
      `SITUATION:\n${dilemma.title}\n${dilemma.description}\n\n` +
      `PLAYER OPTIONS:\n${optionsText}\n\n` +
      `TASK:\nGenerate ONE sentence (20–25 words) in the mirror's voice.\n` +
      `React to how these two values pull in this situation and give a playful nudge toward the most fitting choice.\n` +
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

CONTINUITY (CRITICAL - ALWAYS FOLLOW THIS)
- Always apply **SYSTEM FEEL** when evolving reactions and resistance across turns.
- If subject streak ≥ 3: Conclude the previous topic in one short sentence, THEN shift to a new topic.
- If subject streak < 3: The new situation MUST be a direct consequence of or reaction to the previous choice. Explicitly reference what happened (e.g., "After you issued the decree...", "The settlers you turned away...", "Following your speech...").
- Evolve plausibly given the system: e.g., pushback mounts in democracies, fades or goes underground in autocracies.
- NEVER generate a random unrelated event when there is a PREVIOUS choice. Every turn must feel causally connected to the last.

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

ACTIONS
- Present exactly three actions that conflict clearly in tone and intent:
  * Assertive control (authoritarian or decisive leadership)
  * Negotiated / consultative (pragmatic compromise)
  * Principled restraint / rights (ethical or liberty-focused)
- Each action: one sentence (~15–20 words). No numbers or meta language.
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
- If an action **generates** clear revenue, use a positive tier (+50, +100, +150) while preserving relative order.
- Tie-breakers: the more coercive/logistically heavy option costs more.
- Do **not** edit summaries to justify costs; just assign values.

SUPPORT SHIFT (only if previous choice exists)
CRITICAL: You receive "PREVIOUS SITUATION" describing what was happening and what each faction wanted.
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

EXPLANATION STYLE:
  * people.why → Civic/social reasoning (e.g., "Feared violence, got it")
  * mom.why → Personal voice, first person ("I hoped you'd find another way")
  * holders.why → Institutional logic (e.g., "Wanted decisive show of authority")

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
   "people":{"delta":0,"why":""},
   "mom":{"delta":0,"why":""},
   "holders":{"delta":0,"why":""}
 }}
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
 * Build user prompt for light dilemma API - minimal dynamic context
 */
function buildLightUserPrompt({ role, system, subjectStreak, previous, topWhatValues, thematicGuidance, scopeGuidance }) {
  const parts = [
    `ROLE & SETTING: ${role}`,
    `SYSTEM: ${system}`,
  ];

  // Top values (Day 1 only)
  if (topWhatValues && Array.isArray(topWhatValues) && topWhatValues.length > 0) {
    parts.push(`TOP VALUES: ${topWhatValues.join(', ')}`);
  }

  // Thematic guidance (custom subject or default axes)
  if (thematicGuidance) {
    parts.push(`THEME: ${thematicGuidance}`);
  }

  parts.push('');

  // Subject streak
  if (subjectStreak && subjectStreak.subject) {
    parts.push(`SUBJECT STREAK: ${subjectStreak.subject} = ${subjectStreak.count}`);
  } else {
    parts.push('SUBJECT STREAK: none');
  }

  // Previous choice (only if exists)
  if (previous && previous.title) {
    parts.push(`PREVIOUS SITUATION: "${previous.description}"`);
    parts.push(`PLAYER'S CHOICE: ${previous.choiceTitle} — ${previous.choiceSummary}`);
  } else {
    parts.push('PREVIOUS: none (first day)');
  }

  // Scope guidance (always included)
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
🎯 EPIC FINALE MODE:
This is the player's FINAL dilemma (last day before game ends).
- Make it HIGH STAKES with lasting consequences
- Make it CLIMACTIC and game-changing
- This should feel like the CULMINATION of their tenure
- Still follow all other rules (specificity, brevity, realistic)
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
    const daysLeft = Number(req.body?.daysLeft ?? 1);
    const subjectStreak = req.body?.subjectStreak || null;
    const scopeStreak = req.body?.scopeStreak || null; // NEW: Scope streak tracking
    const recentScopes = req.body?.recentScopes || []; // NEW: Last 5 scopes
    const previous = req.body?.previous || null;
    const topWhatValues = req.body?.topWhatValues || null; // Day 1 only: top 2 compass values
    const thematicGuidance = req.body?.thematicGuidance || null; // Custom subject or default axes

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

    const userPrompt = buildLightUserPrompt({ role, system, subjectStreak, previous, topWhatValues, thematicGuidance, scopeGuidance });

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

    // Call AI with JSON mode (route to correct provider)
    let raw = null;
    try {
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
          });

      raw = safeParseJSON(responseText);

      if (debug) console.log("[/api/dilemma-light] AI response parsed:", raw);

      // ALWAYS log action summaries (critical for debugging empty summary bug)
      if (raw && Array.isArray(raw.actions)) {
        console.log("[/api/dilemma-light] 📋 AI RETURNED ACTIONS:");
        raw.actions.forEach((a, i) => {
          console.log(`  [${a?.id || i}] "${a?.title || 'NO TITLE'}"`);
          console.log(`      Summary: "${a?.summary || 'EMPTY SUMMARY ⚠️'}"`);
          console.log(`      Cost: ${a?.cost ?? 'MISSING'}`);
        });
      }
    } catch (e) {
      console.error("[/api/dilemma-light] AI call failed:", e?.message || e);
    }

    // Fallback if AI fails
    let usedFallback = false;
    if (!raw || !raw.title || !Array.isArray(raw.actions)) {
      console.log("[/api/dilemma-light] Using fallback dilemma");
      raw = {
        title: "First Night in the Palace",
        description: "As the seals change hands, a restless city watches. Advisors split: display resolve now, or earn trust with patience.",
        actions: [
          { id: "a", title: "Impose Curfew", summary: "Restrict movement after dusk with visible patrols.", cost: -150, iconHint: "security" },
          { id: "b", title: "Address the Nation", summary: "Speak live tonight to calm fears and set the tone.", cost: -50, iconHint: "speech" },
          { id: "c", title: "Open Negotiations", summary: "Invite opposition figures for mediated talks.", cost: 50, iconHint: "diplomacy" }
        ],
        topic: "Security",
        scope: "National", // Default fallback
        supportShift: null
      };
      usedFallback = true;
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
      isFallback: usedFallback,
      isGameEnd: daysLeft === 0 // Mark game conclusion
    };

    if (debug) console.log("[/api/dilemma-light] Final result:", result);
    return res.json(result);

  } catch (e) {
    console.error("Error in /api/dilemma-light:", e?.message || e);
    return res.status(502).json({ error: "dilemma-light failed" });
  }
});

// -------------------- Dilemma (AI, minimal prompt) ---------------------------
app.post("/api/dilemma", async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("⚠️  [HEAVY API] /api/dilemma called (old version)");
    console.log("========================================\n");

    const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
    if (!OPENAI_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const debug = !!req.body?.debug;
    if (debug) console.log("[/api/dilemma] snapshot:", req.body);

    const roleRaw = req.body?.role;
    const systemRaw = req.body?.systemName;

    const role = (roleRaw && typeof roleRaw === "string" && roleRaw.trim()) ? roleRaw.trim() : "Unicorn King";
    const systemName = (systemRaw && typeof systemRaw === "string" && systemRaw.trim()) ? systemRaw.trim() : "Divine Right Monarchy";
    const settings    = req.body?.settings || {};
    const day         = Number(req.body?.day || 1);
    const totalDays   = Number(req.body?.totalDays || 7);
    const daysLeft    = Number(req.body?.daysLeft ?? (totalDays - day + 1));
    const isFirst     = !!req.body?.previous?.isFirst;
    const isLast      = !!req.body?.previous?.isLast;
    const compassFlat = req.body?.compassValues || {};

    // Enhanced context for intelligent dilemma generation
    const enhancedContext = req.body?.enhancedContext || null;
    const lastChoice = req.body?.lastChoice || null;
    const recentTopics = req.body?.recentTopics || [];
    const topicCounts = req.body?.topicCounts || {};
    const supports = req.body?.supports || {};
    const dilemmaHistory = req.body?.dilemmaHistory || [];

    if (debug) {
      const compassKeys = compassFlat ? Object.keys(compassFlat).length : 0;
      console.log("[/api/dilemma] IN:", {
        role, systemName, day, totalDays, daysLeft, compassKeys,
        hasEnhancedContext: !!enhancedContext,
        hasLastChoice: !!lastChoice,
        recentTopicsCount: recentTopics.length,
        topicCountsKeys: Object.keys(topicCounts).length,
        dilemmaHistoryCount: dilemmaHistory.length
      });
    }

    // Log mode based on daysLeft
    if (daysLeft === 0) {
      console.log("[/api/dilemma] 🏁 CONCLUSION MODE - Generating game ending");
    } else if (daysLeft === 1) {
      console.log("[/api/dilemma] 🎯 EPIC FINALE MODE - Generating final dilemma");
    }
    
    // Best-effort nudge only
    const topCompass = Object.entries(compassFlat)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 3)
      .map(([k]) => k);

    const focusLine =
      settings?.dilemmasSubjectEnabled && settings?.dilemmasSubject
        ? `Focus topic: ${String(settings.dilemmasSubject)}.`
        : "";

    // Analyze political system type for appropriate feel
    const systemAnalysis = analyzeSystemType(systemName);

        // ===================================================================
        // DYNAMIC PROMPT BUILDING based on daysLeft
        // Token reduction: ~50% (2000-2500 → 1000-1200 tokens)
        // ===================================================================
        let system;

        if (daysLeft === 0) {
          // CONCLUSION MODE - use conclusion prompt (like light API)
          system = buildConclusionSystemPrompt();
        } else if (daysLeft === 1) {
          // EPIC MODE - base prompt + epic section
          system = buildCoreStylePrompt() + "\n\n" + buildDynamicContextPrompt({
            role,
            systemName,
            systemAnalysis,
            day,
            totalDays,
            isFirst,
            isLast,
            lastChoice,
            dilemmaHistory: dilemmaHistory?.slice(-2), // Last 2 only
            recentTopics: recentTopics?.slice(0, 3), // Top 3 only
            topicCounts,
            enhancedContext,
            supports,
            settings
          }) + "\n\n" + buildEpicFinaleSection() + "\n\n" + buildOutputSchemaPrompt();
        } else {
          // NORMAL MODE - base prompt only
          system = buildCoreStylePrompt() + "\n\n" + buildDynamicContextPrompt({
            role,
            systemName,
            systemAnalysis,
            day,
            totalDays,
            isFirst,
            isLast,
            lastChoice,
            dilemmaHistory: dilemmaHistory?.slice(-2), // Last 2 only
            recentTopics: recentTopics?.slice(0, 3), // Top 3 only
            topicCounts,
            enhancedContext,
            supports,
            settings
          }) + "\n\n" + buildOutputSchemaPrompt();
        }

    // Build compact user prompt
    const user = [
      `ROLE: ${role}`,
      `SYSTEM: ${systemName}`,
      focusLine,
      `DAY: ${day}/${totalDays}${isFirst ? " (FIRST)" : isLast ? " (LAST)" : ""}`,
      `TOP COMPASS: ${topCompass.join(", ") || "n/a"}`,
      "",
      "Return STRICT JSON only."
    ].filter(part => part.trim()).join("\n");

    // ----- Call AI with premium model + quality validation -----
    let raw = null;
    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts && !raw) {
      attempt++;

      try {
        const responseText = await aiText({
          system,
          user,
          model: MODEL_DILEMMA,
          temperature: 1  // gpt-5 only supports temperature = 1
        });

        const parsed = safeParseJSON(responseText);
        const validation = validateDilemmaResponse(responseText, parsed);

        if (!validation.valid) {
          console.log(`[/api/dilemma] ⚠️  Attempt ${attempt} validation failed: ${validation.reason}`);

          if (attempt < maxAttempts) {
            // Single-pass repair attempt
            const repairPrompt = `Previous response was invalid: ${validation.reason}\n\nFix ONLY that issue. Return complete JSON.`;
            const repaired = await aiText({
              system,
              user: user + "\n\n" + repairPrompt,
              model: MODEL_DILEMMA,
              temperature: 1  // gpt-5 only supports temperature = 1
            });

            const reparsed = safeParseJSON(repaired);
            const revalidation = validateDilemmaResponse(repaired, reparsed);

            if (revalidation.valid && !hasGenericPhrasing(repaired)) {
              raw = reparsed;
              console.log(`[/api/dilemma] ✅ Repair successful on attempt ${attempt}`);
            }
          }
        } else if (hasGenericPhrasing(responseText)) {
          console.log(`[/api/dilemma] ⚠️  Attempt ${attempt} has generic phrasing`);

          if (attempt < maxAttempts) {
            // Specificity repair
            const repairPrompt = `Response contains vague placeholders like "controversial bill" or "major reform".\n\nREPLACE with specific details: exact bill name, concrete numbers, named actors, precise levers.\n\nReturn complete JSON with specificity fixes.`;
            const repaired = await aiText({
              system,
              user: user + "\n\n" + repairPrompt,
              model: MODEL_DILEMMA,
              temperature: 1  // gpt-5 only supports temperature = 1
            });

            const reparsed = safeParseJSON(repaired);
            if (validateDilemmaResponse(repaired, reparsed).valid && !hasGenericPhrasing(repaired)) {
              raw = reparsed;
              console.log(`[/api/dilemma] ✅ Specificity repair successful on attempt ${attempt}`);
            }
          }
        } else {
          // Success!
          raw = parsed;
          console.log(`[/api/dilemma] ✅ Valid response on attempt ${attempt}`);
        }
      } catch (e) {
        console.error(`[/api/dilemma] ❌ Attempt ${attempt} error:`, e?.message || e);
      }

      if (!raw && attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 500)); // Brief pause before retry
      }
    }

    let usedFallback = false;
    function buildFallback(d) {
      return {
        title: d === 1 ? "First Night in the Palace" : "Crowds Swell Outside the Palace",
        description:
          d === 1
            ? "As the seals change hands, a restless city watches. Advisors split: display resolve now, or earn trust with patience."
            : "Rumors spiral as barricades appear along the market roads. Decide whether to project strength or show empathy before things harden.",
        actions: [
          { id: "a", title: "Impose Curfew",      summary: "Restrict movement after dusk with visible patrols.", cost: -150, iconHint: "security"  },
          { id: "b", title: "Address the Nation", summary: "Speak live tonight to calm fears and set the tone.", cost:  -50, iconHint: "speech"    },
          { id: "c", title: "Open Negotiations",  summary: "Invite opposition figures for mediated talks.",      cost:   50, iconHint: "diplomacy" },
        ],
        topic: "Security"  // Fallback dilemmas get Security topic
      };
    }

    if (!raw || !raw.title || !Array.isArray(raw.actions)) {
      raw = buildFallback(day);
      usedFallback = true;
    }

    // ----- Normalization / cost logic (unchanged logic, but fed from `raw`)
    const clampInt = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

    const MONEY_RE   = /(tax|levy|tariff|duty|raise|grant|stipend|subsid|windfall|donation|aid|surplus|treasury|budget|bond|fee|fine|privatiz|sale)/i;
    const REVENUE_RE = /(tax|levy|raise|tariff|duty|fee|fine|toll|bribe|payoff|donation|grant|aid|bailout|surplus|windfall|royalt|dividend|profit|revenue|sale|auction|privatiz|license|concession|permit fee|export|trade|loan|bond issue|issue bonds)/i;
    const OUTLAY_RE  = /(build|construct|hire|wage|salary|subsid|invest|fund|spend|pay|purchase|buy|equip|deploy|expand program|contract|maintenance|relief|stipend|campaign|patrol|station|send troops|guard|operate)/i;

    function snapCost(rawNum, text) {
      const sign = rawNum >= 0 ? 1 : -1;
      const abs  = Math.abs(Math.round(Number(rawNum) || 0));
      const ladder = [0, 50, 100, 150, 200, 250];
      const nearest = ladder.reduce((best, v) => (Math.abs(abs - v) < Math.abs(abs - best) ? v : best), 0);
      let snapped = sign * nearest;
      if (sign > 0 && MONEY_RE.test(text || "")) {
        if (abs >= 480) snapped = 500;
        else if (abs >= 380) snapped = 400;
        else if (abs >= 260) snapped = 300;
      }
      return clampInt(snapped, -250, 500);
    }

    function expectedSignFor(text = "", iconHint = "") {
      const t = String(text).toLowerCase();
      if (OUTLAY_RE.test(t)) return -1;
      if (REVENUE_RE.test(t)) return 1;
      if (String(iconHint).toLowerCase() === "money") return 1;
      return 0;
    }

    const title = String(raw?.title || "").slice(0, 120) || "A Difficult Choice";
    const description = String(raw?.description || "").slice(0, 500);

    const allowedHints = new Set(["security","speech","diplomacy","money","tech","heart","scale"]);

    let actions = [];

    // Skip action processing if daysLeft === 0 (game conclusion)
    if (daysLeft === 0) {
      actions = [];
      if (debug) console.log("[/api/dilemma] Conclusion mode - empty actions array");
    } else {
      actions = Array.isArray(raw?.actions) ? raw.actions.slice(0, 3) : [];
    }

    // Only process actions if not in conclusion mode
    if (daysLeft > 0) {
    actions = actions.map((a, idx) => {
      const id = (["a","b","c"][idx] || "a");
      const t  = String(a?.title || `Option ${idx + 1}`).slice(0, 80);
      const s  = String(a?.summary || "").slice(0, 180);
      const hint = allowedHints.has(String(a?.iconHint)) ? String(a?.iconHint) : "speech";

      const rawCost = clampInt(a?.cost, -250, 500);
      let cost = snapCost(rawCost, `${t} ${s}`);

      const expected = expectedSignFor(`${t} ${s}`, hint);
      if (expected === 1 && cost < 0) cost = Math.abs(cost);
      if (expected === -1 && cost > 0) cost = -Math.abs(cost);

      return { id, title: t, summary: s, cost, iconHint: hint };
    });

    // Make sure not all costs are positive
    {
      const posCount = actions.filter(a => a.cost > 0).length;
      if (posCount === actions.length && actions.length) {
        let idx = actions.findIndex(a => a.iconHint !== "money" && !REVENUE_RE.test(`${a.title} ${a.summary}`));
        if (idx === -1) {
          idx = actions.reduce((best, a, i, arr) => (Math.abs(a.cost) < Math.abs(arr[best].cost) ? i : best), 0);
        }
        actions[idx].cost = -Math.max(50, Math.abs(actions[idx].cost));
      }
    }

    // Spread magnitudes if they all coincide
    {
      const mags = actions.map(a => Math.abs(a.cost));
      const uniq = new Set(mags);
      if (uniq.size <= 1 && actions.length === 3) {
        const targets = [50, 150, 250];
        actions = actions.map((a, i) => ({ ...a, cost: (a.cost >= 0 ? 1 : -1) * targets[i] }));
      }
    }

    while (actions.length < 3) {
      const i = actions.length;
      actions.push({ id: ["a","b","c"][i] || "a", title: `Option ${i + 1}`, summary: "A reasonable alternative.", cost: 0, iconHint: "speech" });
    }
    } // End of daysLeft > 0 check

    // Ensure topic is always returned (NewDilemmaLogic.md Rule #9)
    const validTopics = ["Economy", "Security", "Diplomacy", "Rights", "Infrastructure", "Environment", "Health", "Education", "Justice", "Culture"];
    let topic = String(raw?.topic || "").trim();
    if (!validTopics.includes(topic)) {
      // Fallback to "General" if topic is missing or invalid
      topic = "General";
    }

    // ===================================================================
    // Day 2+: Generate support effects based on BOTH lastChoice AND new dilemma
    // This ensures support changes align with how the story actually developed
    // ===================================================================
    let supportEffects = null;

    // Debug logging to diagnose missing support effects
    console.log("[/api/dilemma] Support check - day:", day, "lastChoice:", lastChoice ? "EXISTS" : "NULL", "lastChoice.title:", lastChoice?.title || "MISSING");

    if (day > 1 && lastChoice && lastChoice.title) {
      console.log("[/api/dilemma] ✅ Generating support effects...");
      try {
        if (debug) console.log("[/api/dilemma] Day 2+ - generating support effects aligned with story...");

        // Derive "middleName" = strongest non-player holder
        const holders = Array.isArray(req.body?.holders) ? req.body.holders : [];
        const pIndex = typeof req.body?.playerIndex === "number" ? req.body.playerIndex : null;

        const withIdx = holders.map((h, i) => ({ ...h, i }));
        const candidates = pIndex == null ? withIdx : withIdx.filter((h) => h.i !== pIndex);
        const top = candidates.length > 0
          ? candidates.reduce((a, b) => (b.percent > a.percent ? b : a), candidates[0])
          : null;
        const middleName = String(top?.name || "the establishment");

        const supportSystem = [
          "You assess how political events shift short-term support among three groups:",
          "- 'people' (general public / the street),",
          "- 'middle' (the main non-player power holder),",
          "- 'mom' (the player's MOTHER - literal parent who raised them, caring but judgmental).",
          "",
          "OUTPUT: STRICT JSON ARRAY ONLY (ALWAYS exactly 3 items - one for each group).",
          "Each item: { id: 'people|middle|mom', level: 'low|medium|large|extreme', polarity: 'positive|negative', explain: 'ONE SHORT SENTENCE' }",
          "",
          "CRITICAL EVALUATION APPROACH:",
          "Evaluate the PREVIOUS ACTION's impact on each group's interests and values:",
          "",
          "1. MATERIAL INTERESTS: Did the action help or harm this group economically/materially?",
          "   - Spending on public services → positive for people",
          "   - Saving money, pragmatic choices → often positive for middle (fiscal responsibility)",
          "   - Actions showing competence → positive for mom (proud of capable child)",
          "",
          "2. VALUES ALIGNMENT: Did it align with or contradict their priorities?",
          "   - Freedom/participation → positive for people",
          "   - Stability/order → positive for middle (establishment)",
          "   - Safety/wisdom → positive for mom (protective parent)",
          "",
          "3. RESPECT & ENGAGEMENT: Did it show respect or disregard for their concerns?",
          "   - Addressing people directly → positive for people",
          "   - Working with institutions → positive for middle",
          "   - Showing caution/care → positive for mom",
          "",
          "The NEW SITUATION may describe reactions, but these should CONFIRM your analysis of the action's merit, not replace it.",
          "Most actions have MIXED results (some groups benefit, others lose).",
          "",
          "BALANCED OUTCOMES - IMPORTANT:",
          "- Most choices produce MIXED results (some groups up, some down)",
          "- All negative is RARE (only for universally harmful choices)",
          "- All positive is RARE (only for brilliant or popular moves)",
          "- Typical patterns:",
          "  * Populist action: +10 people, -5 middle, +5 mom",
          "  * Pragmatic action: +5 people, +10 middle, +5 mom",
          "  * Bold action: +5 people, -10 middle, -5 mom (mom worried)",
          "  * Cautious action: -5 people (boring), +5 middle (stable), +10 mom (safe)",
          "",
          "STYLE RULES for `explain`:",
          "- Keep it vivid and specific; 8–18 words; no hashtags/emojis.",
          "- people → speak as a crowd reaction.",
          "- middle → reference or speak as " + middleName + ".",
          "- mom → MATERNAL voice speaking directly to her child using 'you' (proud, worried, disappointed, or gently scolding like a concerned mother).",
          "",
          "MAGNITUDE:",
          "- Use plausibility: low=5, medium=10, large=15, extreme=20.",
          "- ALWAYS include all 3 groups. Mom ALWAYS has an opinion about her child's choices, even if subtle (use 'low' for minor reactions).",
          "- Never omit any group - if truly neutral, use level='low' with slight positive or negative lean.",
        ].join("\n");

        const supportUser = [
          `PREVIOUS ACTION: "${lastChoice.title}" - ${lastChoice.summary}`,
          "",
          `NEW SITUATION: """${description}"""`,
          "",
          "CONTEXT:",
          `- systemName: ${systemName}`,
          `- holders: ${JSON.stringify(holders)}`,
          `- middleName: ${middleName}`,
          `- day: ${day}`,
          "",
          "TASK:",
          "Analyze how support changes based on BOTH the previous action AND how the new situation describes reactions.",
          "Return JSON ARRAY with EXACTLY 3 items (people, middle, mom). Example:",
          `[{"id":"people","level":"medium","polarity":"positive","explain":"Crowds welcome the curfew easing tonight."},{"id":"middle","level":"low","polarity":"negative","explain":"Council grumbles about lost control."},{"id":"mom","level":"low","polarity":"positive","explain":"I'm proud you're trying to help people, dear."}]`,
        ].join("\n");

        const supportItems = await aiJSON({
          system: supportSystem,
          user: supportUser,
          model: MODEL_ANALYZE,
          temperature: 0.25,
          fallback: [],
        });

        // Convert level -> absolute delta
        const SCALE = { low: 5, medium: 10, large: 15, extreme: 20 };

        supportEffects = Array.isArray(supportItems)
          ? supportItems
              .map((x) => {
                const rawId = String(x?.id || "").toLowerCase();
                const id = rawId === "people" || rawId === "middle" || rawId === "mom" ? rawId : null;
                if (!id) return null;

                const level = String(x?.level || "").toLowerCase();
                const base = SCALE[level] ?? 0;
                if (!base) return null;

                const pol = String(x?.polarity || "").toLowerCase();
                const sign = pol === "negative" ? -1 : 1;

                const explain = String(x?.explain || "").trim().slice(0, 140);
                const delta = Math.max(-20, Math.min(20, sign * base));

                return { id, delta, explain };
              })
              .filter(Boolean)
          : [];

        console.log("[/api/dilemma] ✅ Support effects generated:", supportEffects.length, "effects");
        if (debug) console.log("[/api/dilemma] Support effects details:", supportEffects);
      } catch (supportError) {
        console.error("[/api/dilemma] ❌ Support effects FAILED:", supportError?.message || supportError);
        // Continue without support effects rather than failing the whole request
        supportEffects = [];
      }
    } else {
      console.log("[/api/dilemma] ⏭️ Skipping support effects - condition not met (day > 1 && lastChoice && lastChoice.title)");
    }

    // Build result - include supportEffects for Day 2+
    const result = {
      title,
      description,
      actions,
      topic,
      isFallback: usedFallback,
      isGameEnd: daysLeft === 0, // Mark game conclusion
      ...(supportEffects !== null && { supportEffects }) // Only include if Day 2+
    };

    console.log("[/api/dilemma] 📦 Final result has supportEffects:", supportEffects !== null, "length:", supportEffects?.length || 0);
    if (debug) console.log("[/api/dilemma] result:", result);
    return res.json(result);
  } catch (e) {
    console.error("Error in /api/dilemma:", e?.message || e);
    return res.status(502).json({ error: "dilemma failed" });
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
      "You are a strict validator for a strategy game.",
      "Given a DILEMMA (title + description) and a SUGGESTION, decide if the suggestion is:",
      "- meaningful (not gibberish),",
      "- relevant/connected to the dilemma’s situation, and",
      "- actionable in spirit (a plausible policy or action, not random text).",
      "Only return compact JSON: { \"valid\": boolean, \"reason\": string }.",
      "Be conservative: if in doubt, mark valid=false with a short reason.",
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

// -------------------- Support change analysis (LLM) ------------------------
app.post("/api/support-analyze", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const ctx = req.body?.ctx || {};
    if (!text) return res.status(400).json({ error: "Missing 'text'." });

    // Derive "middleName" = strongest non-player holder
    const holders = Array.isArray(ctx?.holders) ? ctx.holders : [];
    const pIndex =
      typeof ctx?.playerIndex === "number" && Number.isFinite(ctx.playerIndex)
        ? ctx.playerIndex
        : null;

    const withIdx = holders.map((h, i) => ({ ...h, i }));
    const candidates =
      pIndex == null ? withIdx : withIdx.filter((h) => h.i !== pIndex);
    const top =
      candidates.length > 0
        ? candidates.reduce((a, b) => (b.percent > a.percent ? b : a), candidates[0])
        : null;
    const middleName = String(top?.name || "the establishment");

    const system = [
      "You assess how a political move shifts short-term support among three blocs:",
      "- 'people' (general public / the street),",
      "- 'middle' (the main non-player power holder),",
      "- 'mom' (the leader’s intimate/personal constituency).",
      "",
      "OUTPUT: STRICT JSON ARRAY ONLY (max 3 items).",
      "Each item: { id: 'people|middle|mom', level: 'low|medium|large|extreme', polarity: 'positive|negative', explain: 'ONE SHORT SENTENCE' }",
      "",
      "STYLE RULES for `explain`:",
      "- Tailor it to the decision (TEXT) and the context (system, blocs).",
      "- Keep it vivid and specific; 8–18 words; no hashtags/emojis.",
      "- people → speak as a crowd reaction to the move.",
      "- middle → reference or speak as " + middleName + " (committees, generals, bankers, etc.).",
      "- mom → direct speech to the player using 'you' (proud or scolding).",
      "- Avoid boilerplate like 'mixed reactions'; pick the dominant feel.",
      "",
      "MAGNITUDE:",
      "- Use plausibility: low=5, medium=10, large=15, extreme=20 (we map levels to these deltas).",
      "- Omit blocs that stay neutral.",
    ].join("\n");

    const user = [
      `TEXT: """${text}"""`,
      "",
      "CONTEXT:",
      `- systemName: ${ctx?.systemName || "unknown"}`,
      `- holders: ${JSON.stringify(holders)}`,
      `- playerIndex: ${pIndex === null ? "null" : pIndex}`,
      `- middleName: ${middleName}`,
      `- day: ${ctx?.day ?? "?"}`,
      "",
      "TASK:",
      "Return JSON ARRAY only. Example:",
      `[{"id":"people","level":"medium","polarity":"positive","explain":"Crowds welcome the curfew easing tonight."}]`,
    ].join("\n");

    const items = await aiJSON({
      system,
      user,
      model: MODEL_ANALYZE,   // keep your existing model setting
      temperature: 0.25,      // slightly tighter for punchy lines
      fallback: [],
    });

    // Convert level -> absolute delta (authoritative mapping)
    const SCALE = { low: 5, medium: 10, large: 15, extreme: 20 };

    const out = Array.isArray(items)
      ? items
          .map((x) => {
            const rawId = String(x?.id || "").toLowerCase();
            const id = rawId === "people" || rawId === "middle" || rawId === "mom" ? rawId : null;
            if (!id) return null;

            const level = String(x?.level || "").toLowerCase();
            const base = SCALE[level] ?? 0;
            if (!base) return null;

            const pol = String(x?.polarity || "").toLowerCase();
            const sign = pol === "negative" ? -1 : 1;

            const explain = String(x?.explain || "").trim().slice(0, 140); // allow a full sentence
            const delta = Math.max(-20, Math.min(20, sign * base));

            return { id, delta, explain };
          })
          .filter(Boolean)
      : [];

    return res.json({ items: out });
  } catch (e) {
    console.error("Error in /api/support-analyze:", e?.message || e);
    return res.status(502).json({ items: [] });
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

Decisions: for each decision, ≤12-word title + one line judging autonomy/heteronomy & liberalism/totalism.

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

// -------------------- Start server ---------------------------
const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});