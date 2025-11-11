/**
 * Confidant/Advisor data for each predefined role
 * These confidants deliver dilemmas as trusted advisors to the player
 */

export interface Confidant {
  name: string;
  description: string;
  imageId: string; // Maps to /assets/images/advisors/{imageId}Adv.png
}

/**
 * Mapping of role IDs to their confidants
 */
export const CONFIDANTS: Record<string, Confidant> = {
  // Athens — Shadows of War (431 BCE)
  athens_431: {
    name: 'Lysandra',
    description:
      'A seasoned scribe of the Assembly. She records every speech and decision in the Ekklesia. Intelligent, calm, and trusted by citizens and generals alike — she can brief you on debates, summarize votes, and convey consequences with measured clarity.',
    imageId: 'greece',
  },

  // Alexandria — Fire over the Nile
  alexandria_48: {
    name: 'Demetrios',
    description:
      "A librarian of the Mouseion. An observant scholar with contacts among scholars, soldiers, and royal advisors. He's loyal to truth and knowledge, not politics, which makes him a credible, emotionally steady narrator of chaos.",
    imageId: 'egypt',
  },

  // Florence — The Fire and the Faith
  florence_1494: {
    name: 'Giulia di Rossi',
    description:
      "An artist's apprentice. Once an assistant in a sculptor's workshop, now forced to hide her art under the new religious regime. She moves between studios and sermons — her eyes and ears capture both sides of Florence's struggle.",
    imageId: 'italy',
  },

  // North America — The First Encounter (1607)
  north_america_1607: {
    name: 'Waniné',
    description:
      'A village interpreter and messenger. Young, bilingual, trusted by elders and curious about the newcomers. Waniné is the natural bridge between worlds, the one who brings word from the coast and asks: "What shall we do?"',
    imageId: 'northAmerica',
  },

  // Japan — The Land at War's End (1600)
  japan_1600: {
    name: 'Kenta',
    description:
      'Your loyal retainer and messenger. A low-born but educated samurai aide who has served your clan since youth. He is dutiful, precise, and quietly questioning — he reports on troop movements and murmurs from the villages.',
    imageId: 'japan',
  },

  // Haiti — The Island in Revolt (1791)
  haiti_1791: {
    name: 'Mireille',
    description:
      'A freedwoman herbalist and healer. Moves freely between the plantation camps and rebel hideouts. She brings whispered news of uprisings and betrayals. Practical and unflinching, she keeps emotion out of her reports — "Only what I saw, not what I dream."',
    imageId: 'haiti',
  },

  // Russia — The Throne Crumbles (1917)
  russia_1917: {
    name: 'Yakov',
    description:
      'An imperial secretary-turned-clerk. A bureaucrat who remains at his desk as the empire unravels. He files reports, summarizes protests, and notes troop mutinies with dry understatement — a perfect witness to crumbling power.',
    imageId: 'russia',
  },

  // India — The Midnight of Freedom (1947)
  india_1947: {
    name: 'Asha Patel',
    description:
      'A schoolteacher and relief volunteer. Deeply connected to both Hindu and Muslim communities, she travels to refugee camps delivering aid. Thoughtful and compassionate, she brings reports of violence and hope from both sides.',
    imageId: 'india',
  },

  // South Africa — The End of Apartheid (1990)
  south_africa_1990: {
    name: 'Peter Dlamini',
    description:
      'A local journalist. Calm and sharp-eyed, Peter records each protest and negotiation. He knows the police, the activists, and the ministers — his updates come like balanced headlines tinged with moral weight.',
    imageId: 'southAfrica',
  },

  // Mars Colony — The Red Frontier (2179)
  mars_2179: {
    name: 'Dr. Elara Qin',
    description:
      "A systems psychologist and AI liaison. Oversees crew well-being and logs decision impact reports for the colony council. She's analytical but subtly empathetic — the perfect 'voice' to brief the player on outcomes and probe next steps.",
    imageId: 'mars',
  },
};

/**
 * Mapping from legacy role names to role IDs
 * Allows looking up confidants using the selectedRole value from roleStore
 */
const LEGACY_KEY_TO_ROLE_ID: Record<string, string> = {
  'Athens — Shadows of War (-431)': 'athens_431',
  'Alexandria — Fire over the Nile (-48)': 'alexandria_48',
  'Florence — The Fire and the Faith (1494)': 'florence_1494',
  'North America — The First Encounter (1607)': 'north_america_1607',
  'Japan — The Land at War\'s End (1600)': 'japan_1600',
  'Haiti — The Island in Revolt (1791)': 'haiti_1791',
  'Russia — The Throne Crumbles (1917)': 'russia_1917',
  'India — The Midnight of Freedom (1947)': 'india_1947',
  'South Africa — The End of Apartheid (1990)': 'south_africa_1990',
  'Mars Colony — The Red Frontier (2179)': 'mars_2179',
};

/**
 * Get confidant data for a given role ID
 * Returns undefined if no predefined confidant exists (e.g., custom roles)
 */
export function getConfidantForRole(roleId: string): Confidant | undefined {
  return CONFIDANTS[roleId];
}

/**
 * Get confidant data using legacy role key (from roleStore.selectedRole)
 * Returns undefined if no predefined confidant exists (e.g., custom roles)
 */
export function getConfidantByLegacyKey(legacyKey: string): Confidant | undefined {
  const roleId = LEGACY_KEY_TO_ROLE_ID[legacyKey];
  return roleId ? CONFIDANTS[roleId] : undefined;
}

/**
 * Get advisor image path for a given imageId
 */
export function getAdvisorImagePath(imageId: string): string {
  return `/assets/images/advisors/${imageId}Adv.png`;
}

/**
 * Get default advisor image path for custom roles
 */
export function getDefaultAdvisorImagePath(): string {
  return '/assets/images/advisors/defaultAdv.png';
}
