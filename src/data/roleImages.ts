// src/data/roleImages.ts
// Centralized configuration for role images
// Makes it easy to add new roles in the future

/**
 * Role image configuration mapping
 * Maps role keys to their image identifiers
 * Image naming convention: {imageId}Banner.png and {imageId}Full.jpg
 */
export const ROLE_IMAGE_CONFIG: Record<string, string> = {
  "Athens — The Day Democracy Died (-404)": "greece",
  "Alexandria — Fire over the Nile (-48)": "alexandria",
  "Florence — The Fire and the Faith (1494)": "florence",
  "North America — The First Encounter (1607)": "northAmerica",
  "Japan — The Land at War's End (1600)": "japan",
  "Haiti — The Island in Revolt (1791)": "haiti",
  "Russia — The Throne Crumbles (1917)": "russia",
  "India — The Midnight of Freedom (1947)": "india",
  "South Africa — The End of Apartheid (1990)": "southAfrica",
  "Mars Colony — The Red Frontier (2179)": "mars",
};

/**
 * Helper function to get role image paths
 * @param roleKey - The unique role key (e.g., "Athens — The Day Democracy Died (-404)")
 * @returns Object with banner and full image paths, or null if no images for this role
 */
export function getRoleImages(roleKey: string): { banner: string; full: string } | null {
  const imageId = ROLE_IMAGE_CONFIG[roleKey];

  if (!imageId) {
    return null;
  }

  return {
    banner: `/assets/images/BKGs/Roles/banners/${imageId}Banner.png`,
    full: `/assets/images/BKGs/Roles/${imageId}Full.jpg`,
  };
}
