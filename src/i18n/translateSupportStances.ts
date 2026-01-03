// src/i18n/translateSupportStances.ts
import type { SupportProfile, IssueKey } from "../data/supportProfiles";

// Map role IDs to translation key prefixes
const ROLE_PREFIX_MAP: Record<string, string> = {
  athens_431: "ATHENS",
  railroad_1877: "RAILROAD",
  telaviv_2025: "TELAVIV",
  alexandria_48: "ALEXANDRIA",
  florence_1494: "FLORENCE",
  north_america_1607: "NORTH_AMERICA",
  japan_1600: "JAPAN",
  haiti_1791: "HAITI",
  russia_1917: "RUSSIA",
  india_1947: "INDIA",
  south_africa_1990: "SOUTH_AFRICA",
  mars_2179: "MARS",
  namek_2099: "NAMEK",
};

// Map stance keys to their translation suffixes
const STANCE_KEY_MAP: Record<IssueKey, string> = {
  governance: "GOVERNANCE",
  order: "ORDER",
  economy: "ECONOMY",
  justice: "JUSTICE",
  foreign: "FOREIGN",
  culture: "CULTURE",
};

/**
 * Translates support profile summary
 */
export function translateSupportSummary(
  roleId: string,
  entityType: "people" | "challenger",
  summaryValue: string,
  lang: (key: string) => string
): string {
  const rolePrefix = ROLE_PREFIX_MAP[roleId];
  if (!rolePrefix) {
    return summaryValue;
  }

  const entityPrefix = entityType === "people" ? "PEOPLE" : "CHALLENGER";
  const translationKey = `SUPPORT_${rolePrefix}_${entityPrefix}_SUMMARY`;

  const translated = lang(translationKey);
  return translated !== translationKey ? translated : summaryValue;
}

/**
 * Translates all stances in a support profile
 */
export function translateSupportStances(
  roleId: string,
  entityType: "people" | "challenger",
  stances: Partial<Record<IssueKey, string>>,
  lang: (key: string) => string
): Partial<Record<IssueKey, string>> {
  const rolePrefix = ROLE_PREFIX_MAP[roleId];
  if (!rolePrefix) {
    return stances;
  }

  const entityPrefix = entityType === "people" ? "PEOPLE" : "CHALLENGER";
  const translatedStances: Partial<Record<IssueKey, string>> = {};

  for (const [key, value] of Object.entries(stances)) {
    const issueKey = key as IssueKey;
    const stanceKey = STANCE_KEY_MAP[issueKey];
    
    if (!stanceKey || !value) {
      translatedStances[issueKey] = value;
      continue;
    }

    const translationKey = `SUPPORT_${rolePrefix}_${entityPrefix}_STANCE_${stanceKey}`;
    const translated = lang(translationKey);
    translatedStances[issueKey] = translated !== translationKey ? translated : value;
  }

  return translatedStances;
}

/**
 * Translates entire support profile (summary + stances)
 */
export function translateSupportProfile(
  roleId: string,
  entityType: "people" | "challenger",
  profile: SupportProfile,
  lang: (key: string) => string
): SupportProfile {
  return {
    ...profile,
    summary: translateSupportSummary(roleId, entityType, profile.summary, lang),
    stances: translateSupportStances(roleId, entityType, profile.stances, lang),
  };
}
