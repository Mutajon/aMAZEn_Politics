import { callGeminiTTS } from "../utils/ai.mjs";

/**
 * POST /api/tts { text: string, voice?: string }
 * Returns audio bytes (Gemini native audio)
 */
export async function textToSpeech(req, res) {
    try {
        const text = String(req.body?.text || "").trim();
        if (!text) return res.status(400).json({ error: "Missing 'text'." });

        const voice = String(req.body?.voice || "").trim();

        console.log(`[TTS] Gemini request: voice=${voice || 'default'}, text length=${text.length}`);

        const audioBuffer = await callGeminiTTS(text, voice);

        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Cache-Control", "no-store");
        res.send(audioBuffer);

    } catch (e) {
        console.error("Error in /api/tts:", e?.message || e);
        res.status(502).json({ error: "tts failed" });
    }
}
