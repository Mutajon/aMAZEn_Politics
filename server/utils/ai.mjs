import {
    OPENAI_KEY,
    GEMINI_KEY,
    CHAT_URL,
    CHAT_MODEL_DEFAULT,
    GEMINI_CHAT_URL,
    GEMINI_IMAGE_URL,
    MODEL_VALIDATE_GEMINI,
    MODEL_DILEMMA_GEMINI,
    anthropic,
    XAI_KEY,
    XAI_CHAT_URL,
    MODEL_DILEMMA_ANTHROPIC,
    MODEL_DILEMMA_XAI
} from "../config/config.mjs";

/**
 * Strip markdown code block markers from text
 * Handles: ```json, ```, and variations with trailing whitespace/newlines
 */
export function stripMarkdownCodeBlocks(text) {
    if (typeof text !== "string") return text;

    // Method 1: Extract content BETWEEN markdown blocks using capture group
    const betweenMatch = text.match(/```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```[\s\S]*$/i);
    if (betweenMatch && betweenMatch[1]) {
        return betweenMatch[1].trim();
    }

    // Method 2: Fallback - strip leading/trailing markers more aggressively
    let result = text.trim();
    result = result.replace(/^```(?:json|javascript|js)?\s*\n?/i, '');
    result = result.replace(/\n?```[\s\S]*$/i, '');

    return result.trim();
}

/**
 * Strip line (//) and block (/* ... *\/) style comments from a JSON-like string without touching quoted content
 */
export function stripJsonComments(text) {
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
 */
export function normalizeControlCharacters(text) {
    if (typeof text !== "string") return text;

    let result = '';
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const charCode = text.charCodeAt(i);

        if (inString) {
            if (escapeNext) {
                result += char;
                escapeNext = false;
            } else if (char === '\\') {
                result += char;
                escapeNext = true;
            } else if (char === '"') {
                result += char;
                inString = false;
            } else if (charCode >= 0x00 && charCode <= 0x1F && char !== '\n' && char !== '\r' && char !== '\t') {
                continue;
            } else if (char === '\n' || char === '\r' || char === '\t') {
                result += ' ';
            } else {
                result += char;
            }
        } else {
            result += char;
            if (char === '"') {
                inString = true;
            }
        }
    }

    return result;
}

/**
 * Remove trailing commas before closing brackets/braces
 */
export function removeTrailingCommas(text) {
    if (typeof text !== "string") return text;
    return text.replace(/,(\s*[\]\}])/g, '$1');
}

/**
 * Safely parse JSON with fallback extraction
 */
export function safeParseJSON(text, { debugTag = "safeParseJSON", maxLogLength = 400 } = {}) {
    if (typeof text !== "string") {
        // console.warn(`[${debugTag}] Non-string input provided to JSON parser (type=${typeof text}).`);
        return null;
    }

    const stripped = stripMarkdownCodeBlocks(text);
    if (stripped !== text) {
        text = stripped;
    }

    const logFailure = (stage, error, sample) => {
        // Logging suppressed to reduce noise
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

    const direct = tryParse(text, "1-direct");
    if (direct) return direct;

    const cleaned = stripJsonComments(text);
    if (cleaned && cleaned !== text) {
        const parsedClean = tryParse(cleaned, "2-strip-comments");
        if (parsedClean) return parsedClean;
    }

    const noTrailing = removeTrailingCommas(text);
    if (noTrailing !== text) {
        const parsedNoTrailing = tryParse(noTrailing, "3-remove-trailing-commas");
        if (parsedNoTrailing) return parsedNoTrailing;
    }

    const cleanedNoTrailing = removeTrailingCommas(cleaned || text);
    if (cleanedNoTrailing !== (cleaned || text)) {
        const parsedCleanNoTrailing = tryParse(cleanedNoTrailing, "4-comments+trailing");
        if (parsedCleanNoTrailing) return parsedCleanNoTrailing;
    }

    const normalized = normalizeControlCharacters(cleanedNoTrailing || cleaned || text);
    if (normalized !== (cleanedNoTrailing || cleaned || text)) {
        const parsedNormalized = tryParse(normalized, "5-normalized-control-chars");
        if (parsedNormalized) return parsedNormalized;
    }

    const fullyRepaired = normalizeControlCharacters(removeTrailingCommas(stripJsonComments(text)));
    if (fullyRepaired !== text && fullyRepaired !== normalized) {
        const parsedFully = tryParse(fullyRepaired, "6-all-repairs-combined");
        if (parsedFully) return parsedFully;
    }

    const fallbackSource = normalized || cleanedNoTrailing || cleaned || text;
    const match = typeof fallbackSource === "string" ? fallbackSource.match(/\{[\s\S]*\}/) : null;
    if (match) {
        const parsedFallback = tryParse(match[0], "7-fallback-braces");
        if (parsedFallback) return parsedFallback;
    }

    if (match) {
        const candidate = stripJsonComments(match[0]);
        const candidateNoTrailing = removeTrailingCommas(candidate);
        const candidateNormalized = normalizeControlCharacters(candidateNoTrailing);
        const parsedFallbackRepaired = tryParse(candidateNormalized, "8-fallback+all-repairs");
        if (parsedFallbackRepaired) return parsedFallbackRepaired;
    }

    return null;
}

/**
 * Helper: call Chat Completions and try to parse JSON from the reply
 */
export async function aiJSON({ system, user, model = CHAT_MODEL_DEFAULT, temperature = undefined, fallback = null }) {
    const FALLBACK_MODEL = "gpt-4o";

    async function makeRequest(modelToUse) {
        const payload = {
            model: modelToUse,
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
        };
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
        return await makeRequest(model);
    } catch (e) {
        console.error(`[server] aiJSON error with model ${model}:`, e?.message || e);

        // Check quota error
        const isQuotaError =
            e?.message?.includes("429") ||
            e?.message?.includes("insufficient_quota") ||
            e?.message?.includes("quota");

        if (isQuotaError && model !== FALLBACK_MODEL) {
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

        return fallback;
    }
}

/**
 * aiJSONGemini: Call Gemini API and parse JSON from the response
 */
export async function aiJSONGemini({ system, user, model = MODEL_VALIDATE_GEMINI, temperature = 0, fallback = null }) {
    try {
        console.log(`[GEMINI-JSON] Calling Gemini API with model: ${model}`);

        const messages = [
            { role: "system", content: system },
            { role: "user", content: user }
        ];

        const response = await fetch(GEMINI_CHAT_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GEMINI_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: temperature,
                max_tokens: 1024,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[GEMINI-JSON] API error ${response.status}: ${errorText}`);
            return fallback;
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content ?? "";

        console.log(`[GEMINI-JSON] Raw response: ${text.substring(0, 200)}...`);

        const parsed = safeParseJSON(text, { debugTag: "aiJSONGemini" });
        if (parsed) {
            return parsed;
        }

        console.warn("[GEMINI-JSON] Failed to parse JSON from response, using fallback");
        return fallback;
    } catch (err) {
        console.error("[GEMINI-JSON] Error:", err?.message || err);
        return fallback;
    }
}

/**
 * Call Gemini (Google) Chat API for game-turn endpoint
 * Uses OpenAI-compatible endpoint format
 */
export async function callGeminiChat(messages, model) {
    const maxRetries = 5;
    const retryDelayMs = 2000;
    const retryableStatuses = [429, 500, 502, 503, 504];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[GEMINI] Calling Gemini API (attempt ${attempt}/${maxRetries}) with key: ${GEMINI_KEY ? 'Yes (' + GEMINI_KEY.substring(0, 8) + '...)' : 'NO KEY!'}`);

        const response = await fetch(GEMINI_CHAT_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GEMINI_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model || MODEL_DILEMMA_GEMINI,
                messages: messages,
                temperature: 1,
                max_tokens: 6144,
                stream: false
            })
        });

        if (response.ok) {
            const data = await response.json();
            return {
                content: data?.choices?.[0]?.message?.content || "",
                finishReason: data?.choices?.[0]?.finish_reason
            };
        }

        // Check if we should retry
        if (retryableStatuses.includes(response.status) && attempt < maxRetries) {
            const errorText = await response.text();
            console.log(`[GEMINI] ⚠️ Retryable error ${response.status}, waiting ${retryDelayMs}ms before retry ${attempt + 1}/${maxRetries}...`);
            console.log(`[GEMINI] Error details: ${errorText.substring(0, 200)}`);
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            continue;
        }

        // Non-retryable error or max retries reached
        const errorText = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }
}

/**
 * Calls Google's Imagen API (via Google AI Studio) for image generation
 * @param {string} prompt - The image generation prompt
 * @param {string} model - The Imagen model (e.g., "imagen-4.0-fast-generate-001")
 * @returns {Promise<string>} Base64-encoded image data
 */
export async function callGeminiImageGeneration(prompt, model) {
    const maxRetries = 3;
    const retryDelayMs = 2000;
    const retryableStatuses = [429, 500, 502, 503, 504];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[GEMINI-IMAGE] Calling Imagen API (attempt ${attempt}/${maxRetries}) with model: ${model}`);

        // Correct endpoint format: :predict with x-goog-api-key header
        const url = `${GEMINI_IMAGE_URL}/${model}:predict`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "x-goog-api-key": GEMINI_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                instances: [
                    { prompt: prompt }
                ],
                parameters: {
                    sampleCount: 1
                }
            })
        });

        if (response.ok) {
            const data = await response.json();
            // Imagen API returns: { predictions: [{ bytesBase64Encoded: "...", mimeType: "image/png" }] }
            const imageBytes = data?.predictions?.[0]?.bytesBase64Encoded;
            if (!imageBytes) {
                throw new Error("No image data in Imagen response");
            }
            console.log(`[GEMINI-IMAGE] ✅ Image generated successfully`);
            return imageBytes;
        }

        // Check if we should retry
        if (retryableStatuses.includes(response.status) && attempt < maxRetries) {
            const errorText = await response.text();
            console.log(`[GEMINI-IMAGE] ⚠️ Retryable error ${response.status}, waiting ${retryDelayMs}ms before retry ${attempt + 1}/${maxRetries}...`);
            console.log(`[GEMINI-IMAGE] Error details: ${errorText.substring(0, 200)}`);
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            continue;
        }

        // Non-retryable error or max retries reached
        const errorText = await response.text();
        throw new Error(`Imagen API error ${response.status}: ${errorText}`);
    }
}

/**
 * aiTextGemini - Call Gemini API and return raw text response
 * Similar to aiJSONGemini but returns text instead of parsed JSON
 */
export async function aiTextGemini({ system, user, model = "gemini-2.5-flash", temperature = 0.7, maxTokens = 2048 }) {
    try {
        console.log(`[GEMINI-TEXT] Calling Gemini API with model: ${model}`);

        const messages = [
            { role: "system", content: system },
            { role: "user", content: user }
        ];

        const response = await fetch(GEMINI_CHAT_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GEMINI_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: temperature,
                max_tokens: maxTokens,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[GEMINI-TEXT] API error ${response.status}: ${errorText}`);
            return "";
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content ?? "";

        console.log(`[GEMINI-TEXT] Response received: ${text.substring(0, 100)}...`);
        return text;
    } catch (err) {
        console.error("[GEMINI-TEXT] Error:", err?.message || err);
        return "";
    }
}


export async function aiText({ system, user, model = CHAT_MODEL_DEFAULT, temperature, maxTokens }) {
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
export async function aiTextAnthropic({ system, user, model = MODEL_DILEMMA_ANTHROPIC, temperature = 1 }) {
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
export async function aiTextXAI({ system, user, model = MODEL_DILEMMA_XAI, temperature = 1, maxTokens = 4096 }) {
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
