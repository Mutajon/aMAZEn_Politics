/**
 * Theory Document Loader for Aftermath API
 *
 * Loads theory documents (autonomy, liberalism, democracy) that explain
 * how to properly calculate/rate each dimension. These are injected into
 * the AI system prompt for the /api/aftermath endpoint.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let theoryCache = null;

/**
 * Safely read a file, returning null if it doesn't exist
 */
function safeReadFile(filePath) {
  if (existsSync(filePath)) {
    return readFileSync(filePath, 'utf-8');
  }
  return null;
}

/**
 * Load all theory documents (cached after first load)
 */
export function loadTheory() {
  if (theoryCache) return theoryCache;

  const basePath = join(__dirname, '../src/data/theory');

  theoryCache = {
    autonomy: safeReadFile(join(basePath, 'autonomy.md')),
    liberalism: safeReadFile(join(basePath, 'liberalism.md')),
    democracy: safeReadFile(join(basePath, 'democracy.md')),
  };

  // Log which theory docs are available
  const available = Object.entries(theoryCache)
    .filter(([, content]) => content !== null)
    .map(([name]) => name);
  console.log(`[Theory Loader] Loaded ${available.length} theory documents: ${available.join(', ') || 'none'}`);

  return theoryCache;
}

/**
 * Generate the theory prompt section to be injected into the AI system prompt
 */
export function getTheoryPrompt() {
  const theory = loadTheory();

  // Build sections only for documents that exist
  const sections = [];

  if (theory.autonomy) {
    sections.push(`--- AUTONOMY THEORY (A0-A5 Scale) ---\n${theory.autonomy}`);
  }
  if (theory.liberalism) {
    sections.push(`--- LIBERALISM THEORY (L0-L5 Scale) ---\n${theory.liberalism}`);
  }
  if (theory.democracy) {
    sections.push(`--- DEMOCRACY THEORY ---\n${theory.democracy}`);
  }

  if (sections.length === 0) {
    return ''; // No theory docs available
  }

  return `
=== THEORETICAL FRAMEWORKS FOR RATING DECISIONS ===

Before rating each decision, carefully study these theoretical frameworks.
They define how to interpret player choices on each dimension.

${sections.join('\n\n')}

=== END OF THEORETICAL FRAMEWORKS ===

`;
}
