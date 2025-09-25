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
async function aiJSON({ system, user, model = CHAT_MODEL_DEFAULT, temperature = 0.6, fallback = null }) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature,
      }),
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
    if (typeof temperature === "number" && temperature !== 1) {
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
    const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
    if (!OPENAI_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const CHAT_URL = "https://api.openai.com/v1/chat/completions";
    const CHAT_MODEL_DEFAULT = process.env.CHAT_MODEL || "gpt-4o-mini";

    const { role, gender } = req.body || {};
    const roleText = String(role || "").slice(0, 200);
    const genderText = ["male", "female", "any"].includes((gender || "").toLowerCase())
      ? gender.toLowerCase()
      : "any";

    // Guardrail: role must exist
    if (!roleText) {
      return res.status(400).json({ error: "Missing role" });
    }

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

    const r = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL_DEFAULT,
        temperature: 0.9,
        max_tokens: 220,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return res.status(502).json({ error: "OpenAI error", detail });
    }
    const data = await r.json();
    const paragraph = (data?.choices?.[0]?.message?.content || "").trim();

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

// -------------------- Dilemma (AI, minimal prompt) ---------------------------
app.post("/api/dilemma", async (req, res) => {
  try {
    const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
    if (!OPENAI_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const debug = !!req.body?.debug;
    if (debug) console.log("[/api/dilemma] snapshot:", req.body);

    // Snapshot fields (all optional-safe)
    const role        = String(req.body?.role || "Unicorn King");
    const systemName  = String(req.body?.systemName || "Divine Right Monarchy");
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
      "- Do NOT use the word 'dilemma'.\n" +
      "- Title ≤ 60 chars; description 2–3 sentences, mature and engaging.\n" +
      '- Return STRICT JSON ONLY: {"title":"","description":"","actions":[{...},{...},{...}]}\n' +
      '- Each action: {"id":"a|b|c","title":"","summary":"","cost":int,"iconHint":"security|speech|diplomacy|money|tech|heart|scale"}\n' +
      "- Costs are integers in [-250..500]. Keep choices comparable. Use +200..+500 only when broadly generous (e.g., taxes/windfalls).";

    const user =
      `ROLE: ${role}\n` +
      `POLITICAL SYSTEM: ${systemName}\n` +
      `${focusLine}\n` +
      `DAY: ${day} of ${totalDays} (${isFirst ? "first" : isLast ? "last" : "mid-campaign"})\n` +
      `TOP COMPASS COMPONENTS (0..10): ${topCompass.join(", ") || "n/a"}\n` +
      "TASK: Write one short situation with exactly three conflicting ways to respond.\n" +
      "JSON ONLY.";

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

    // Normalize + guard shape
    const clampInt = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

    const title = String(out?.title || "").slice(0, 120) || "A Difficult Choice";
    const description = String(out?.description || "").slice(0, 500);

    const allowedHints = new Set([
      "security","speech","diplomacy","money","tech","heart","scale",
    ]);

    let actions = Array.isArray(out?.actions) ? out.actions.slice(0, 3) : [];
    actions = actions.map((a, idx) => ({
      id: (["a","b","c"][idx] || "a"),
      title: String(a?.title || `Option ${idx + 1}`).slice(0, 80),
      summary: String(a?.summary || "").slice(0, 180),
      cost: clampInt(a?.cost, -250, 500),
      iconHint: allowedHints.has(String(a?.iconHint)) ? String(a?.iconHint) : "speech",
    }));

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


// -------------------- Start server ---------------------------
const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
