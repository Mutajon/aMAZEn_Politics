// src/i18n/translateSupportStances.ts
// Helper function to translate support profile stance descriptions

import { useRoleStore } from "../store/roleStore";
import { getPredefinedRole } from "../data/predefinedRoles";

/**
 * Translates a stance description based on the current role and entity type
 * @param stanceValue - The English stance description to translate
 * @param entityType - "people" or "challenger"
 * @param stanceKey - The stance key (governance, order, economy, etc.)
 * @param lang - The translation function
 * @returns Translated stance description or original if translation not found
 */
export function translateSupportStance(
  stanceValue: string,
  entityType: "people" | "challenger",
  stanceKey: string,
  lang: (key: string) => string
): string {
  // Get the current role
  const selectedRole = useRoleStore.getState().selectedRole;
  if (!selectedRole) {
    // Fallback: return original value if no role is selected
    return stanceValue;
  }

  // Get the predefined role data to find the role ID
  const roleData = getPredefinedRole(selectedRole);
  if (!roleData) {
    // Fallback: return original value if role not found
    return stanceValue;
  }

  // Map role ID to translation key prefix
  const rolePrefixMap: Record<string, string> = {
    "athens_431": "ATHENS",
    "alexandria_48": "ALEXANDRIA",
    "florence_1494": "FLORENCE",
    "north_america_1607": "NORTH_AMERICA",
    "japan_1600": "JAPAN",
    "haiti_1791": "HAITI",
    "russia_1917": "RUSSIA",
    "india_1947": "INDIA",
    "south_africa_1990": "SOUTH_AFRICA",
    "mars_2179": "MARS",
  };

  const rolePrefix = rolePrefixMap[roleData.id];
  if (!rolePrefix) {
    // Fallback: return original value if role ID not in map
    return stanceValue;
  }

  // Build translation key: SUPPORT_{ROLE}_{ENTITY}_STANCE_{STANCE_KEY}
  const entityPrefix = entityType === "people" ? "PEOPLE" : "CHALLENGER";
  const stanceKeyUpper = stanceKey.toUpperCase();
  const translationKey = `SUPPORT_${rolePrefix}_${entityPrefix}_STANCE_${stanceKeyUpper}`;

  const translated = lang(translationKey);
  
  // If translation returns the key itself (not found), return original value
  return translated !== translationKey ? translated : stanceValue;
}

