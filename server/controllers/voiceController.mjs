import { OPENAI_KEY, TTS_MODEL, TTS_VOICE } from "../config/config.mjs";

/**
 * POST /api/tts { text: string, voice?: string }
 * Returns MP3 audio bytes (~200-250ms latency vs 10+ seconds with Gemini)
 */
export async function textToSpeech(req, res) {
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
}
