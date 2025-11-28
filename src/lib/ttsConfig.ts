// Centralized TTS configuration - voice name from environment variable
// This ensures voice name is never hardcoded across the codebase

export const TTS_VOICE = import.meta.env.VITE_TTS_VOICE || "enceladus";
