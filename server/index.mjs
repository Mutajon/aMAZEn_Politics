// server/index.mjs — AI-STRICT
import express from "express";
import cors from "cors";
import { config as loadEnv } from "dotenv";
import OpenAI from "openai";

loadEnv();

process.on("unhandledRejection", (e) => console.error("[server] UnhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("[server] UncaughtException:", e));

const PORT = process.env.PORT || 8787;
const app = express();
app.use(cors());
app.use(express.json());

const hasKey = !!process.env.OPENAI_API_KEY;
console.log("[server] booting… OPENAI_API_KEY:", hasKey ? "present" : "missing");

const openai = hasKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const SYSTEMS = {
  "Absolute Monarchy": { description: "Monarch holds full power, unchecked.", flavor: "One person makes all the rules because God said so (or so they claim)." },
  "Constitutional Monarchy": { description: "Monarch limited by a constitution and parliament.", flavor: "The king/queen waves politely while politicians argue about taxes." },
  "Elective Monarchy": { description: "Monarch chosen by vote rather than inheritance.", flavor: "Royals audition for the throne like it’s Monarch Idol." },
  "Direct Democracy": { description: "Citizens vote directly on laws and policies.", flavor: "Everyone votes on everything, all the time. Great in theory, chaos in practice." },
  "Representative Democracy": { description: "Citizens elect officials to make decisions for them.", flavor: "You pick someone to argue on your behalf… and hope they remember you exist." },
  "Parliamentary Democracy": { description: "Legislature elects the executive branch leader (PM).", flavor: "Where politicians yell at each other in fancy accents." },
  "Presidential Democracy": { description: "Citizens elect both legislature and president separately.", flavor: "One person is CEO of the country, hopefully without the stock options." },
  "Federal Republic": { description: "Power shared between central and regional governments.", flavor: "Like Russian nesting dolls but with paperwork." },
  "Unitary Republic": { description: "Central government holds most of the power.", flavor: "One government to rule them all, preferably without dark lords." },
  "People’s Republic": { description: "Republic in name, often single-party authoritarian in reality.", flavor: "Usually means ‘Not much republic, not many people deciding.’" },
  "Banana Republic": { description: "Corrupt government propped up by foreign interests or elites.", flavor: "Not about fruit—just corruption with a tropical flair." },
  "Dictatorship": { description: "One leader holds total power, often seized.", flavor: "One person hogs the remote control of the state and never gives it back." },
  "Military Junta": { description: "Military leaders rule after seizing power.", flavor: "When generals say ‘fine, we’ll do it ourselves.’" },
  "One-Party State": { description: "Only one political party is legally allowed.", flavor: "Democracy, but with only one brand on the ballot." },
  "Clerical Theocracy": { description: "Religious leaders hold supreme authority.", flavor: "Sermons double as laws." },
  "Divine Right Monarchy": { description: "Monarch claims authority from divine will.", flavor: "Like absolute monarchy, but with extra holy glitter." },
  "Anarchy": { description: "Absence of structured government.", flavor: "Everyone’s free! (to do whatever they want… until things get messy)." },
  "Oligarchy": { description: "Rule by a small elite group.", flavor: "The ‘rich and powerful friends’ club runs the show." },
  "Plutocracy": { description: "Rule by the wealthy.", flavor: "Money votes, people don’t." },
  "Technocracy": { description: "Rule by technical experts and specialists.", flavor: "Expect more acronyms than laws." },
  "Timocracy": { description: "Rule by property owners.", flavor: "No house, no say." },
  "Kleptocracy": { description: "Rule by thieves and corrupt officials.", flavor: "The government is basically a giant five-finger discount." },
  "Stratocracy": { description: "Rule by the military as an institution.", flavor: "The country is one big barracks." },
  "Gerontocracy": { description: "Rule by the elderly.", flavor: "Wise or just cranky, depends on the day." },
  "Kakistocracy": { description: "Rule by the least qualified or most corrupt.", flavor: "Literally rule by the worst. Enough said." },
};

function normalizeHolders(list) {
  let out = Array.isArray(list) ? list.slice(0, 5) : [];
  out = out
    .filter((h) => h && typeof h.name === "string")
    .map((h) => ({
      name: String(h.name).trim(),
      percent: Math.max(0, Number(h.percent) || 0),
      note: String(h.reason || h.note || ""),
      icon: String(h.icon || "").slice(0, 4),
    }));
  while (out.length < 5) out.push({ name: `Other actors ${out.length + 1}`, percent: 0, note: "", icon: "" });

  let sum = out.reduce((s, h) => s + h.percent, 0);
  if (sum <= 0) {
    const defaults = [40, 30, 15, 10, 5];
    out = out.map((h, i) => ({ ...h, percent: defaults[i] || 0 }));
  } else {
    const factor = 100 / sum;
    out = out.map((h) => ({ ...h, percent: Math.round(h.percent * factor) }));
    let diff = 100 - out.reduce((s, h) => s + h.percent, 0);
    for (let i = 0; diff !== 0 && i < out.length; i++) {
      out[i].percent += diff > 0 ? 1 : -1;
      diff += diff > 0 ? -1 : 1;
    }
  }
  return out;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, openaiKey: hasKey });
});

app.post("/api/validate-role", async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ error: "OPENAI_API_KEY not set on server." });
    const { text } = req.body || {};
    const input = (text || "").trim();
    if (!input) return res.status(400).json({ error: "Missing 'text' body" });

    const prompt = `
Return strict JSON ONLY with keys: valid (boolean), reason (string).
Determine if the input clearly expresses BOTH (1) a role and (2) a setting (time/place).
Examples valid: "a senator in ancient Rome", "leader of a Martian colony in 2199".
Examples invalid: "wizard", "in the city", "a leader".
Input: "${input}"
`;
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [{ role: "system", content: "Return ONLY JSON. No prose." }, { role: "user", content: prompt }],
    });

    const raw = resp.choices?.[0]?.message?.content || "";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }
    if (!parsed || typeof parsed.valid !== "boolean") return res.status(502).json({ error: "Validator response malformed", raw });

    res.json({ valid: !!parsed.valid, reason: typeof parsed.reason === "string" ? parsed.reason : "" });
  } catch (err) {
    console.error("[/api/validate-role] error:", err);
    res.status(502).json({ error: "AI validator failed" });
  }
});

app.post("/api/analyze-role", async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ error: "OPENAI_API_KEY not set on server." });
    const { role } = req.body || {};
    const input = (role || "").trim();
    if (!input) return res.status(400).json({ error: "Missing 'role' body" });

    const systemNames = Object.keys(SYSTEMS).join(" | ");
    const userPrompt = `
You are a political analyst. Given a user-selected role/setting:
1) Decide if this is a real/historic setting or fictional => isRealOrHistoric (boolean).
2) Choose the SINGLE best-fitting political system from this list (use exact name): ${systemNames}.
3) Identify exactly 5 key power-holder entities for that setting and estimate their percentage share of power (sum to 100).
4) For each holder include a short, witty one-liner description (reason) and a representative icon as a SINGLE emoji (icon).
5) Also pick which holder best represents the player's role => playerIndex (0-4). If none clearly matches, use -1.

Return STRICT JSON ONLY with:
{ "isRealOrHistoric": boolean, "systemName": string, "playerIndex": number, "holders": [ { "name": string, "percent": number, "reason": string, "icon": string }, ... (5 total) ] }
Role: "${input}"
`;
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [{ role: "system", content: "Return ONLY JSON." }, { role: "user", content: userPrompt }],
    });

    const raw = resp.choices?.[0]?.message?.content || "";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }
    if (!parsed) return res.status(502).json({ error: "AI analysis malformed", raw });

    const systemName =
      Object.keys(SYSTEMS).find((k) => k.toLowerCase() === String(parsed.systemName || "").toLowerCase()) || "Oligarchy";
    const system = { name: systemName, ...SYSTEMS[systemName] };
    const holders = normalizeHolders(parsed.holders);
    let playerIndex = Number.isInteger(parsed.playerIndex) ? Number(parsed.playerIndex) : -1;
    if (playerIndex < 0 || playerIndex > 4) playerIndex = 0;

    res.json({ isRealOrHistoric: !!parsed.isRealOrHistoric, system, holders, playerIndex });
  } catch (err) {
    console.error("[/api/analyze-role] error:", err);
    res.status(502).json({ error: "AI analysis failed" });
  }
});

app.post("/api/name-suggestions", async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ error: "OPENAI_API_KEY not set on server." });
    const { role, systemName } = req.body || {};
    const input = (role || "").trim();
    const sys = (systemName || "").trim();
    if (!input) return res.status(400).json({ error: "Missing 'role' body" });

    const prompt = `
Return ONLY JSON with:
{
  "male":   {"name": string, "description": string},
  "female": {"name": string, "description": string},
  "neutral":{"name": string, "description": string}
}
Guidelines:
- Names must fit the setting implied by: "${input}"${sys ? ` (system: ${sys})` : ""}.
- Each description MUST START with: "a game avatar of the face of ${input}," then a concise facial description.
- Keep it 1–2 sentences, neutral background, no text.
`;
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [{ role: "system", content: "Return ONLY JSON." }, { role: "user", content: prompt }],
    });

    const raw = resp.choices?.[0]?.message?.content || "";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }
    if (!parsed || !parsed.male || !parsed.female || !parsed.neutral) {
      return res.status(502).json({ error: "Name suggestions malformed", raw });
    }

    res.json(parsed);
  } catch (err) {
    console.error("[/api/name-suggestions] error:", err);
    res.status(502).json({ error: "Name suggestion failed" });
  }
});

app.post("/api/generate-avatar", async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ error: "OPENAI_API_KEY not set on server." });
    const { prompt } = req.body || {};
    const p = (prompt || "").trim();
    if (!p) return res.status(400).json({ error: "Missing 'prompt' body" });

    async function tryModel(model) {
      const result = await openai.images.generate({
        model,
        prompt: p + ". square portrait, headshot, clean background, high detail, no text.",
        size: "1024x1024",
        response_format: "b64_json",
      });
      const b64 = result.data?.[0]?.b64_json;
      if (!b64) throw new Error("Empty image b64");
      return `data:image/png;base64,${b64}`;
    }

    try {
      const dataUrl = await tryModel("gpt-image-1");
      res.json({ dataUrl });
    } catch {
      const dataUrl = await tryModel("dall-e-3");
      res.json({ dataUrl });
    }
  } catch (err) {
    console.error("[/api/generate-avatar] error:", err);
    res.status(502).json({ error: "Avatar generation failed" });
  }
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
