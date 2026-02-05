import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

// -------------------- Model & API config --------------------
export const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
export const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
export const XAI_KEY = process.env.XAI_API_KEY || "";
export const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

export const CHAT_URL = "https://api.openai.com/v1/chat/completions";
export const IMAGE_URL = "https://api.openai.com/v1/images/generations";
export const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";
export const XAI_IMAGE_URL = "https://api.x.ai/v1/images/generations";
export const GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const GEMINI_IMAGE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Initialize Anthropic client
export const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;

// One default text model + per-task overrides from .env
export const CHAT_MODEL_DEFAULT = process.env.CHAT_MODEL || "gpt-4o-mini";
export const MODEL_VALIDATE = process.env.MODEL_VALIDATE || CHAT_MODEL_DEFAULT;
export const MODEL_NAMES = process.env.MODEL_NAMES || CHAT_MODEL_DEFAULT;
export const MODEL_ANALYZE = process.env.MODEL_ANALYZE || CHAT_MODEL_DEFAULT;
export const MODEL_MIRROR = process.env.MODEL_MIRROR || CHAT_MODEL_DEFAULT;
export const MODEL_MIRROR_ANTHROPIC = process.env.MODEL_MIRROR_ANTHROPIC || "";
export const MODEL_DILEMMA = process.env.MODEL_DILEMMA || CHAT_MODEL_DEFAULT;
export const MODEL_DILEMMA_PREMIUM = process.env.MODEL_DILEMMA_PREMIUM || "gpt-5";
export const MODEL_DILEMMA_ANTHROPIC = process.env.MODEL_DILEMMA_ANTHROPIC || "";
export const MODEL_DILEMMA_XAI = process.env.MODEL_DILEMMA_XAI || "";
export const MODEL_DILEMMA_GEMINI = process.env.MODEL_DILEMMA_GEMINI || "";
export const MODEL_VALIDATE_GEMINI = process.env.MODEL_VALIDATE_GEMINI || "gemini-3-flash-preview";
export const MODEL_COMPASS_HINTS = process.env.MODEL_COMPASS_HINTS || "gemini-3-flash-preview";

// Image model
export const IMAGE_MODEL_OPENAI = process.env.IMAGE_MODEL_OPENAI || "gpt-image-1";
export const IMAGE_MODEL_XAI = process.env.IMAGE_MODEL_XAI || "";
export const IMAGE_MODEL_GEMINI = process.env.IMAGE_MODEL_GEMINI || "";
export const IMAGE_SIZE = process.env.IMAGE_SIZE || "1024x1024";
export const IMAGE_QUALITY = process.env.IMAGE_QUALITY || "low";

// --- Gemini TTS Configuration --------------------------
export const TTS_MODEL = process.env.TTS_MODEL || "gemini-3-flash-preview-preview-tts";
export const TTS_VOICE = process.env.TTS_VOICE || "Enceladus";
