// server/index.mjs
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import mammoth from "mammoth";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -------------------------------------------------------
   Load Authority Guide (docx) once at boot
------------------------------------------------------- */
const GUIDE_PATH = path.resolve(process.cwd(), "Authority_Instructions_E12_v6_4.docx");
let AUTHORITY_GUIDE = "";

async function loadGuide() {
  try {
    if (fs.existsSync(GUIDE_PATH)) {
      const buf = fs.readFileSync(GUIDE_PATH);
      const { value } = await mammoth.extractRawText({ buffer: buf });
      AUTHORITY_GUIDE = String(value || "")
        .replace(/\r/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .trim();
      console.log("[server] Authority guide loaded. chars:", AUTHORITY_GUIDE.length);
    } else {
      console.warn("[server] Guide file not found at:", GUIDE_PATH);
    }
  } catch (err) {
    console.error("[server] Failed to load guide:", err);
  }
}
await loadGuide();

/* -------------------------------------------------------
   Health
------------------------------------------------------- */
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, guide: AUTHORITY_GUIDE ? "loaded" : "missing" })
);

/* -------------------------------------------------------
   Analyze Role → Top-5 power holders
------------------------------------------------------- */
app.post("/api/analyze-role", async (req, res) => {
  try {
    const role = String(req.body?.role || "").slice(0, 400).trim();
    if (!role) return res.status(400).json({ error: "Missing role" });

    const systemMsg = [
      "You are a political-systems analyst.",
      "Use the framework text below (Authority Instructions — Ranking Seats, v6.4) as PRIMARY guidance.",
      "It defines Exception-12 (E-12) domains, stop-rules, tie-breakers, and how to rank Seats of Authority.",
      "Output a concise analysis as JSON matching this TypeScript type:",
      "type PowerHolder = { name: string; percent: number; icon?: string; note?: string };",
      "type AnalysisResult = { systemName: string; systemDesc: string; flavor: string; holders: PowerHolder[]; playerIndex: number | null };",
      "",
      "Rules:",
      "- First decide if the setting is real/historic; if yes, use factual signals.",
      "- If fictional, use common sense and be coherent.",
      "- Pick the best-fitting system label (from monarchy/democracy/oligarchy families, etc.).",
      "- Create EXACTLY five power holders with percentages adding to ~100.",
      "- Include a short amusing description (note) for each holder.",
      "- Include a small emoji-like icon for each holder (e.g., ⚖️, 🛡️, 💰, 📰).",
      "- Identify which holder corresponds to the PLAYER role and set playerIndex to its index; else null.",
      "",
      "Framework excerpt (use it to reason, do not echo it):",
      AUTHORITY_GUIDE || "(Guide missing at runtime.)",
    ].join("\n");

    const userMsg = [
      `ROLE (player-selected): ${role}`,
      "Return ONLY valid JSON (no markdown fences).",
    ].join("\n");

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: userMsg },
      ],
      temperature: 0.4,
    });

    const text = resp.choices[0]?.message?.content?.trim() || "{}";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const fix = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Fix this into strict JSON matching the specified TS type. Return only JSON." },
          { role: "user", content: text },
        ],
        temperature: 0,
      });
      parsed = JSON.parse(fix.choices[0]?.message?.content || "{}");
    }

    if (!Array.isArray(parsed?.holders) || parsed.holders.length !== 5) {
      return res.status(422).json({ error: "Invalid AI response (holders)" });
    }

    parsed.holders = parsed.holders.map((h) => ({
      name: String(h?.name || "Unknown"),
      percent: Math.max(0, Math.min(100, Math.round(Number(h?.percent || 0)))),
      icon: h?.icon ? String(h.icon) : undefined,
      note: h?.note ? String(h.note) : undefined,
    }));

    // normalize total to 100
    const sum = parsed.holders.reduce((s, h) => s + h.percent, 0);
    if (sum !== 100 && sum > 0) {
      const diff = 100 - sum;
      parsed.holders[0].percent = Math.max(0, Math.min(100, parsed.holders[0].percent + diff));
    }

    parsed.playerIndex =
      Number.isInteger(parsed?.playerIndex) && parsed.playerIndex >= 0 && parsed.playerIndex < 5
        ? parsed.playerIndex
        : null;

    return res.json(parsed);
  } catch (err) {
    console.error("[/api/analyze-role] error:", err);
    return res.status(502).json({ error: "AI analysis failed" });
  }
});

/* -------------------------------------------------------
   Name suggestions (male/female/any) + face prompts
   Accepts { setting } or { role }
------------------------------------------------------- */
app.post("/api/name-suggestions", async (req, res) => {
  try {
    const settingRaw =
      (typeof req.body?.setting === "string" && req.body.setting) ||
      (typeof req.body?.role === "string" && req.body.role) ||
      "";

    const setting = String(settingRaw).slice(0, 600).trim();
    if (!setting) return res.status(400).json({ error: "Missing setting" });

    const sys =
      "Generate culturally/period-appropriate character names and a one-sentence avatar-face prompt for each.\n" +
      "Return STRICT JSON with keys male, female, any; each is { name: string, prompt: string }.\n" +
      "The prompt MUST begin with: 'a game avatar of the face of ' then include the role and setting, then a brief facial description.";

    const user = `Setting: ${setting}\nReturn only JSON.`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.6,
    });

    let text = resp.choices[0]?.message?.content?.trim() || "{}";
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      const fix = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Fix to strict JSON with keys male, female, any; each { name, prompt }. Return only JSON." },
          { role: "user", content: text },
        ],
        temperature: 0,
      });
      text = fix.choices[0]?.message?.content?.trim() || "{}";
      parsed = JSON.parse(text);
    }

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
    console.error("[/api/name-suggestions] error:", err);
    return res.status(502).json({ error: "Name generation failed" });
  }
});

/* -------------------------------------------------------
   Avatar generation (image)
------------------------------------------------------- */
app.post("/api/generate-avatar", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").slice(0, 2000).trim();
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const image = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024", // supported sizes: 1024x1024, 1024x1792, 1792x1024
    });

    const b64 = image.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error: "Image generation failed" });

    return res.json({ dataUrl: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error("[/api/generate-avatar] error:", err);
    return res.status(502).json({ error: "Avatar generation failed" });
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
