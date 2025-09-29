// server/index.mjs
import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

// -------------------- Model & API config --------------------
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const IMAGE_URL = "https://api.openai.com/v1/images/generations";

// One default text model + per-task overrides from .env
const CHAT_MODEL_DEFAULT = process.env.CHAT_MODEL || "gpt-5-mini";
const MODEL_VALIDATE = process.env.MODEL_VALIDATE || CHAT_MODEL_DEFAULT;
const MODEL_NAMES    = process.env.MODEL_NAMES    || CHAT_MODEL_DEFAULT;
const MODEL_ANALYZE  = process.env.MODEL_ANALYZE  || CHAT_MODEL_DEFAULT;
const MODEL_MIRROR   = process.env.MODEL_MIRROR   || CHAT_MODEL_DEFAULT;
// Dilemma models (no generation here yet — just configuration)
// Cheap default now; premium can be used later on demand.
const MODEL_DILEMMA = process.env.MODEL_DILEMMA || CHAT_MODEL_DEFAULT;
const MODEL_DILEMMA_PREMIUM = process.env.MODEL_DILEMMA_PREMIUM || "gpt-5";


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
async function aiJSON({ system, user, model = CHAT_MODEL_DEFAULT, temperature = undefined, fallback = null }) {
  try {
    // Build payload WITHOUT temperature by default.
    const payload = {
      model,
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
  } catch (e) {
    console.error("[server] aiJSON error:", e?.message || e);
    return fallback;
  }
}


async function aiText({ system, user, model = CHAT_MODEL_DEFAULT, temperature }) {
  try {
    const body = {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };
  // Only include temperature if it is exactly 1; otherwise omit entirely.
if (typeof temperature === "number" && temperature === 1) {
  body.temperature = 1;
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
  } catch (e) {
    console.error("[server] aiText error:", e?.message || e);
    return "";
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
      image: IMAGE_MODEL,
      tts: TTS_MODEL,
      ttsVoice: TTS_VOICE,
      dilemma: MODEL_DILEMMA,
      dilemmaPremium: MODEL_DILEMMA_PREMIUM,
 
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
    "Examples that SHOULD pass: 'a king in medieval England', 'a partisan leader during World War II', " +
    "'a Mars colony governor in 2300', 'a unicorn king in a fantasy land'. " +
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
    const topWhat    = Array.isArray(req.body?.topWhat)    ? req.body.topWhat    : [];
    const topWhence  = Array.isArray(req.body?.topWhence)  ? req.body.topWhence  : [];
    const topOverall = Array.isArray(req.body?.topOverall) ? req.body.topOverall : [];

    const system =
      "You are a witty, magical mirror. Respond ONLY with 1–2 short sentences (max ~45 words). " +
      "No lists, no headers, no labels. Avoid jargon and gamey terms. Natural, playful tone.";

    const user =
      "Given the player's value signals, craft an amusing 1–2 sentence appraisal. " +
      "Tell them WHAT seems to drive them and HOW they mainly justify it (paraphrase labels). " +
      "Top WHAT: " + JSON.stringify(topWhat) + "\n" +
      "Top WHENCE: " + JSON.stringify(topWhence) + "\n" +
      "Overall: " + JSON.stringify(topOverall);

    const text = await aiText({ system, user, model: MODEL_MIRROR });
    const summary = (text || "").trim() || "The mirror squints… and offers a knowing smile.";
    res.json({ summary });
  } catch (e) {
    console.error("Error in /api/mirror-summary:", e?.message || e);
    res.status(500).json({ summary: "The mirror is foggy—try again in a moment." });
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
    const cues = String(req.body?.cues || "").slice(0, 20000);
    if (!text) return res.status(400).json({ error: "Missing 'text'." });

    const system =
      "You map sentences to a moral–political compass.\n" +
      "Return STRICT JSON ONLY: an array of items like " +
      '[{"prop":"whence","idx":0,"polarity":"positive","strength":"mild"}].\n' +
      "- prop: one of what|whence|how|whither.\n" +
      "- idx: 0..9 component index for that prop.\n" +
      "- polarity: positive|negative.\n" +
      "- strength: mild|strong.\n" +
      "- Max 6 items. No extra prose.";

    const user =
      `TEXT: """${text}"""\n\n` +
      `COMPONENTS & CUES:\n${cues}\n\n` +
      "TASK:\n" +
      "- Identify components supported/opposed by the text.\n" +
      "- Multi-component hits allowed.\n" +
      "- JSON ARRAY ONLY.";

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
      "You are a wry newsroom for a political satire game. " +
      "Write **3 VERY amusing, satirical** ticker chips reacting to events. " +
      "Return STRICT JSON ARRAY ONLY (length 3). " +
      'Each item: {"id":"str","kind":"news|social","tone":"up|down|neutral","text":"<=160 chars"}. ' +
      "Be punchy, one-liners, no hashtags/emojis.";

    const user = [
      `MODE: ${mode}`,                                  // onboarding | reaction
      `EPOCH: ${epoch}`,                                // modern | ancient | futuristic
      `ROLE: ${role || "unknown role"}`,
      `SYSTEM: ${systemName || "unknown system"}`,
      last
        ? `LAST CHOICE: ${String(last.title || "")}. ${String(last.summary || "")}. COST=${Number(last.cost || 0)}.`
        : "LAST CHOICE: n/a",
      "",
      "STYLE & SOURCES by EPOCH:",
      "- modern → TV/newspapers/social: State TV, The Daily Ledger, @CivicWatch.",
      "- ancient → town crier, market gossip, palace scribe, temple notices, neighbors’ whispers.",
      "- futuristic → Orbital Wire, HoloForum, Neuralfeed, Corporate Feeds.",
      "",
      "ONBOARDING (day 1): 3 items welcoming/covering the player's rise to power.",
      "REACTION (day ≥2): 3 items reacting directly to LAST CHOICE.",
      "",
      "RULES:",
      "- Mix sources (at least one ‘news’ and one ‘social’).",
      "- Each text must be a single sentence, **satirical and witty**, ≤160 chars.",
      "- Encode the source naturally in the line (e.g., 'Town Crier:', 'The Daily Ledger:', '@CivicWatch:').",
      "- JSON ARRAY ONLY; no prose outside the array.",
    ].join("\n");

    const items = await aiJSON({
      system,
      user,
      model: MODEL_ANALYZE, // reuse your lightweight JSON-capable model
      fallback: [
        { id: "fallback-1", kind: "news",   tone: "neutral", text: "The Daily Ledger: New ruler arrives; promises change, audits the cutlery." },
        { id: "fallback-2", kind: "news",   tone: "up",      text: "State Bulletin: Transition smooth—flags ironed, egos pending." },
        { id: "fallback-3", kind: "social", tone: "neutral", text: "@CivicWatch: We’ll clap when policy lands, not just planes." },
      ],
    });

    // Sanitize minimally
    const coerce = (x, i) => {
      const id = String(x?.id || `news-${i}`);
      const kind = String(x?.kind).toLowerCase() === "social" ? "social" : "news";
      const tone0 = String(x?.tone || "neutral").toLowerCase();
      const tone = tone0 === "up" || tone0 === "down" ? tone0 : "neutral";
      const text = String(x?.text || "").slice(0, 160);
      return { id, kind, tone, text };
    };

    const out = Array.isArray(items) ? items.slice(0, 3).map(coerce) : [];
    if (!out.length) return res.json({ items: [] });
    return res.json({ items: out });
  } catch (e) {
    console.error("Error in /api/news-ticker:", e?.message || e);
    return res.status(502).json({ items: [] });
  }
});

// -------------------- Dilemma (AI, minimal prompt) ---------------------------
app.post("/api/dilemma", async (req, res) => {
  try {
    const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
    if (!OPENAI_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const debug = !!req.body?.debug;
    if (debug) console.log("[/api/dilemma] snapshot:", req.body);

    const roleRaw = req.body?.role;
    const systemRaw = req.body?.systemName;
    
    const role = (typeof roleRaw === "string" && roleRaw.trim())
      ? roleRaw.trim()
      : "Unicorn King";
    
    const systemName = (typeof systemRaw === "string" && systemRaw.trim())
      ? systemRaw.trim()
      : "Divine Right Monarchy";
    const settings    = req.body?.settings || {};
    const day         = Number(req.body?.day || 1);
    const totalDays   = Number(req.body?.totalDays || 7);
    const isFirst     = !!req.body?.previous?.isFirst;
    const isLast      = !!req.body?.previous?.isLast;
    const compassFlat = req.body?.compassValues || {};

    // Best-effort nudge only
    const topCompass = Object.entries(compassFlat)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 3)
      .map(([k]) => k);

    const focusLine =
      settings?.dilemmasSubjectEnabled && settings?.dilemmasSubject
        ? `Focus topic: ${String(settings.dilemmasSubject)}.`
        : "";

    
  const system =
    "You write **short, punchy political situations** for a choice-based mobile game.\n" +
    "\n" +
    "STYLE & TONE\n" +
    "- Do NOT use the word 'dilemma'.\n" +
    "- Keep title ≤ 60 chars; description 2–3 sentences, mature and engaging.\n" +
    "- Natural language (no bullet points), feels like in-world events, demands, questions or follow-ups from real actors.\n" +
    "\n" +
    "WORLD FIT & CONTEXT\n" +
    "- Reflect the CURRENT POLITICAL SYSTEM’s feel. If Absolute Monarchy: decisions are swift and intimidating; if Citizens' Assembly: the player casts a vote and must live with the aggregate outcome.\n" +
    "- If a focus topic is provided, center the situation on it.\n" +
    "- If DAY is first, prefer a challenge that arises immediately from the leadership change. If DAY is last, create an especially high-stakes climax that pays off recent tensions.\n" +
    "- When the setting is real (historic/current), prefer tensions that actually characterize it; when fictional, invent plausible tensions consistent with it.\n" +
    "- Consider the player’s **top Compass components** (list provided) and, when elegant, expose tensions between them (e.g., high freedom vs. high law/order).\n" +
    "- When power-holders beyond the player are relevant, let them be the source of pressure.\n" +
    "- Broadly, many situations can live along autonomy↔heteronomy and liberalism↔totalism axes.\n" +
    "\n" +
    "OUTPUT SHAPE (STRICT JSON)\n" +
    '{"title":"","description":"","actions":[{"id":"a","title":"","summary":"","cost":0,"iconHint":"security|speech|diplomacy|money|tech|heart|scale"},' +
    '{"id":"b","title":"","summary":"","cost":0,"iconHint":"security|speech|diplomacy|money|tech|heart|scale"},' +
    '{"id":"c","title":"","summary":"","cost":0,"iconHint":"security|speech|diplomacy|money|tech|heart|scale"}]}\n' +
    "\n" +
    "ACTIONS\n" +
    "- Each action should be a distinct approach (e.g., assertive/security, conciliatory/diplomacy, communicative/speech, fiscal/money, technical/tech, humanitarian/heart, legal/scale).\n" +
    "- **iconHint** must be one of: security|speech|diplomacy|money|tech|heart|scale (choose the best single fit).\n" +
    "\n" +
    "COSTS (SIGN & MAGNITUDE)\n" +
    "- **SIGN RULE:** Negative = spending/outflow. Positive = revenue/inflow (e.g., taxes/fees/fines, profitable trade, asset sale/privatization, grants/aid/donations, bribe income, bond/loan proceeds).\n" +
    "- Default to **negative** unless the action clearly creates new inflow.\n" +
    "- Use whole integers with these magnitudes: 0, ±50, ±100, ±150, ±200, ±250.\n" +
    "- Reserve +300..+500 ONLY for broad system-wide inflows (tax hikes, grants/aid, windfalls), used sparingly.\n" +
    "- Keep the three choices **comparable** overall; if one should be cheaper in reality, its cost should reflect that.\n";
  

    const user =
    `ROLE: ${role}\n` +
    `POLITICAL SYSTEM: ${systemName}\n` +
    `${focusLine}\n` +
    `DAY: ${day} of ${totalDays} (${isFirst ? "first" : isLast ? "last" : "mid-campaign"})\n` +
    `TOP COMPASS COMPONENTS (0..10): ${topCompass.join(", ") || "n/a"}\n` +
    "TASK: Produce exactly one short situation with exactly three conflicting ways to respond.\n" +
    "Return STRICT JSON ONLY in the shape specified.";
  

    // Call model (uses aiJSON guard + fallback)
    const out = await aiJSON({
      system,
      user,
      model: MODEL_DILEMMA,   // from .env (we'll set to gpt-5-mini)
      temperature: 0.9,
      fallback: {
        title: day === 1 ? "First Night in the Palace" : "Crowds Swell Outside the Palace",
        description:
          day === 1
            ? "As the seals change hands, a restless city watches. Advisors split: display resolve now, or earn trust with patience."
            : "Rumors spiral as barricades appear along the market roads. Decide whether to project strength or show empathy before things harden.",
        actions: [
          { id: "a", title: "Impose Curfew",      summary: "Restrict movement after dusk with visible patrols.", cost: -150, iconHint: "security"  },
          { id: "b", title: "Address the Nation", summary: "Speak live tonight to calm fears and set the tone.", cost:  -50, iconHint: "speech"    },
          { id: "c", title: "Open Negotiations",  summary: "Invite opposition figures for mediated talks.",      cost:   50, iconHint: "diplomacy" },
        ],
      },
    });
// Snap an arbitrary integer cost to our game bands.
// - Default ladder: 0, 50, 100, 150, 200, 250 (negatives mirrored).
// - Allow +300..+500 only for broad “money windfall / tax raise” type actions.
//   We infer that by keywords in the action’s text.
const MONEY_RE = /(tax|levy|tariff|duty|raise|grant|stipend|subsid|windfall|donation|aid|surplus|treasury|budget|bond|fee|fine|privatiz|sale)/i;

function snapCost(raw, text) {
  const sign = raw >= 0 ? 1 : -1;
  const abs  = Math.abs(Math.round(Number(raw) || 0));

  // Default ladder steps
  const ladder = [0, 50, 100, 150, 200, 250];

  // pick closest from ladder
  const nearest = ladder.reduce((best, v) => (
    Math.abs(abs - v) < Math.abs(abs - best) ? v : best
  ), 0);

  let snapped = sign * nearest;

  // Optionally allow bigger positive gains when it *looks* like a windfall/tax move.
  if (sign > 0 && MONEY_RE.test(text || "")) {
    // If model tried to go big, let it; otherwise bump modestly above 250.
    // (Choose from 300, 400, 500.)
    if (abs >= 480) snapped = 500;
    else if (abs >= 380) snapped = 400;
    else if (abs >= 260) snapped = 300;
    // If it was smaller, keep snapped as-is (≤ 250) to avoid abuse.
  }

  // Clamp absolute bounds we support overall.
  return clampInt(snapped, -250, 500);
}
// Heuristics to decide if an action text implies *revenue/inflow* or *spending/outflow*.
const REVENUE_RE = /(tax|levy|raise|tariff|duty|fee|fine|toll|bribe|payoff|donation|grant|aid|bailout|surplus|windfall|royalt|dividend|profit|revenue|sale|auction|privatiz|license|concession|permit fee|export|trade|loan|bond issue|issue bonds)/i;
const OUTLAY_RE  = /(build|construct|hire|wage|salary|subsid|invest|fund|spend|pay|purchase|buy|equip|deploy|expand program|contract|maintenance|relief|stipend|campaign|patrol|station|send troops|guard|operate)/i;

function expectedSignFor(text = "", iconHint = "") {
  const t = String(text).toLowerCase();
  if (OUTLAY_RE.test(t)) return -1;     // clear spend
  if (REVENUE_RE.test(t)) return 1;     // clear inflow
  if (String(iconHint).toLowerCase() === "money") return 1; // bias money → inflow when unsure
  return 0; // unknown
}

    // Normalize + guard shape
    const clampInt = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

    const title = String(out?.title || "").slice(0, 120) || "A Difficult Choice";
    const description = String(out?.description || "").slice(0, 500);

    const allowedHints = new Set([
      "security","speech","diplomacy","money","tech","heart","scale",
    ]);

    let actions = Array.isArray(out?.actions) ? out.actions.slice(0, 3) : [];
    actions = actions.map((a, idx) => {
      const id = (["a","b","c"][idx] || "a");
      const title = String(a?.title || `Option ${idx + 1}`).slice(0, 80);
      const summary = String(a?.summary || "").slice(0, 180);
      const iconHint = allowedHints.has(String(a?.iconHint)) ? String(a?.iconHint) : "speech";
    
      // 1) snap magnitude
      const raw = clampInt(a?.cost, -250, 500);
      let cost = snapCost(raw, `${title} ${summary}`);
    
      // 2) correct sign based on text/icon when the intent is clear
      const expected = expectedSignFor(`${title} ${summary}`, iconHint);
      if (expected === 1 && cost < 0) cost = Math.abs(cost);       // revenue should be +
      if (expected === -1 && cost > 0) cost = -Math.abs(cost);     // outlay should be -
    
      return { id, title, summary, cost, iconHint };
    });
    
    // Ensure we don't end up with all-positive costs.
    // Prefer to flip the least "revenue-like" option (or the smallest magnitude).
    {
      const posCount = actions.filter(a => a.cost > 0).length;
      if (posCount === actions.length) {
        let idx = actions.findIndex(a =>
          a.iconHint !== "money" && !REVENUE_RE.test(`${a.title} ${a.summary}`)
        );
        if (idx === -1) {
          idx = actions.reduce((best, a, i, arr) =>
            Math.abs(a.cost) < Math.abs(arr[best].cost) ? i : best, 0);
        }
        actions[idx].cost = -Math.max(50, Math.abs(actions[idx].cost)); // make it a modest spend
      }
    }
    
    // If magnitudes all coincide, spread to 50/150/250 while preserving each action’s sign.
    {
      const mags = actions.map(a => Math.abs(a.cost));
      const uniq = new Set(mags);
      if (uniq.size <= 1) {
        const targets = [50, 150, 250];
        actions = actions.map((a, i) => {
          const sign = a.cost >= 0 ? 1 : -1;
          return { ...a, cost: sign * targets[i] };
        });
      }
    }
    


    while (actions.length < 3) {
      const i = actions.length;
      actions.push({
        id: ["a","b","c"][i] || "a",
        title: `Option ${i + 1}`,
        summary: "A reasonable alternative.",
        cost: 0,
        iconHint: "speech",
      });
    }

    const result = { title, description, actions };
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


// -------------------- Start server ---------------------------
const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});