// src/i18n/translateGameData.ts
import type { DemocracyLevel } from "../data/highscores-default";

/**
 * Translates democracy level values to translation keys
 */
export function translateDemocracyLevel(level: DemocracyLevel, lang: (key: string) => string): string {
  const keyMap: Record<DemocracyLevel, string> = {
    "Very Low": "DEMOCRACY_LEVEL_VERY_LOW",
    "Low": "DEMOCRACY_LEVEL_LOW",
    "Medium": "DEMOCRACY_LEVEL_MEDIUM",
    "High": "DEMOCRACY_LEVEL_HIGH",
    "Very High": "DEMOCRACY_LEVEL_VERY_HIGH",
  };
  
  const key = keyMap[level];
  return key ? lang(key) : level;
}

/**
 * Translates political system names to translation keys
 */
export function translatePoliticalSystem(systemName: string, lang: (key: string) => string): string {
  // Normalize the system name to a key format
  const normalizedKey = systemName
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[—–-]/g, "_")
    .replace(/\//g, "_")
    .replace(/_+/g, "_")
    .replace(/[()]/g, "");

  const key = `POLITICAL_SYSTEM_${normalizedKey}`;
  const translated = lang(key);
  
  // If the translation returns the key itself (not found), return original name
  return translated !== key ? translated : systemName;
}

/**
 * Translates compass values to translation keys
 */
export function translateCompassValue(value: string, lang: (key: string) => string): string {
  // Normalize the compass value to a key format
  const normalizedKey = value
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/\//g, "_")
    .replace(/[()]/g, "")
    .replace(/\./g, "");
  
  const key = `COMPASS_VALUE_${normalizedKey}`;
  const translated = lang(key);
  
  // If the translation returns the key itself (not found), return original value
  return translated !== key ? translated : value;
}

/**
 * Translates leader description based on leader name
 */
export function translateLeaderDescription(leaderName: string, description: string, lang: (key: string) => string): string {
  // Create a key from the leader name
  const normalizedKey = leaderName
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[.']/g, "");
  
  const key = `LEADER_DESC_${normalizedKey}`;
  const translated = lang(key);
  
  // If the translation returns the key itself (not found), return original description
  return translated !== key ? translated : description;
}

/**
 * Translates quiz question based on quiz ID with gender awareness
 */
export function translateQuizQuestion(
  quizId: string, 
  question: string, 
  lang: (key: string) => string,
  gender?: "male" | "female" | "any"
): string {
  // Try gender-specific key first
  if (gender === "female") {
    const femaleKey = `${quizId}_Q_FEMALE`;
    const femaleTranslated = lang(femaleKey);
    if (femaleTranslated !== femaleKey) return femaleTranslated;
  } else if (gender === "male") {
    const maleKey = `${quizId}_Q_MALE`;
    const maleTranslated = lang(maleKey);
    if (maleTranslated !== maleKey) return maleTranslated;
  }
  
  // Fall back to base key
  const key = `${quizId}_Q`;
  const translated = lang(key);
  return translated !== key ? translated : question;
}

/**
 * Translates quiz answer based on quiz ID and answer index
 */
export function translateQuizAnswer(quizId: string, answerIndex: number, answer: string, lang: (key: string) => string): string {
  const key = `${quizId}_A${answerIndex + 1}`;
  const translated = lang(key);
  return translated !== key ? translated : answer;
}

