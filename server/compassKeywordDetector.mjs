/**
 * Compass Keyword Detector
 *
 * Pre-processes player actions to detect literal keyword matches from compass value definitions.
 * Uses fuzzy matching and context analysis to suggest compass hints before AI analysis.
 *
 * Flow:
 * 1. Extract keywords from action text (fuzzy matching with variations)
 * 2. Detect polarity context (increase/decrease, strengthen/weaken, etc.)
 * 3. Return confidence-scored hints for AI validation
 */

// ============================================================================
// KEYWORD DATABASE (parsed from COMPASS_DEFINITION_BLOCK)
// ============================================================================

const COMPASS_VALUES = {
  what: [
    {
      idx: 0,
      name: 'Truth/Trust',
      support: ['truth', 'honesty', 'transparency', 'integrity', 'credible', 'sincerity'],
      oppose: ['lies', 'deceit', 'propaganda', 'secrecy', 'misinformation']
    },
    {
      idx: 1,
      name: 'Liberty/Agency',
      support: ['freedom', 'autonomy', 'independence', 'rights', 'self-determination'],
      oppose: ['coercion', 'oppression', 'restriction', 'dictatorship', 'control']
    },
    {
      idx: 2,
      name: 'Equality/Equity',
      support: ['fairness', 'inclusion', 'justice', 'equal rights', 'diversity'],
      oppose: ['inequality', 'privilege', 'bias', 'segregation', 'hierarchy']
    },
    {
      idx: 3,
      name: 'Care/Solidarity',
      support: ['empathy', 'compassion', 'welfare', 'cooperation', 'community', 'common good'],
      oppose: ['neglect', 'cruelty', 'division', 'apathy', 'selfishness']
    },
    {
      idx: 4,
      name: 'Create/Courage',
      support: ['innovation', 'creativity', 'reform', 'bravery', 'risk-taking'],
      oppose: ['fear', 'conformity', 'stagnation', 'cowardice']
    },
    {
      idx: 5,
      name: 'Wellbeing',
      support: ['health', 'happiness', 'welfare', 'prosperity', 'comfort'],
      oppose: ['suffering', 'illness', 'deprivation', 'misery']
    },
    {
      idx: 6,
      name: 'Security/Safety',
      support: ['protection', 'defense', 'order', 'law enforcement', 'control', 'stability'],
      oppose: ['danger', 'chaos', 'insecurity', 'disorder']
    },
    {
      idx: 7,
      name: 'Freedom/Responsibility',
      support: ['duty', 'ethics', 'stewardship', 'consequence', 'integrity'],
      oppose: ['irresponsibility', 'corruption', 'recklessness']
    },
    {
      idx: 8,
      name: 'Honor/Sacrifice',
      support: ['loyalty', 'integrity', 'duty', 'sacrifice', 'moral courage'],
      oppose: ['betrayal', 'dishonor', 'cowardice', 'selfishness']
    },
    {
      idx: 9,
      name: 'Sacred/Awe',
      support: ['sacred', 'holy', 'divine', 'spiritual', 'awe', 'reverence'],
      oppose: ['desecration', 'cynicism', 'profanity', 'materialism']
    }
  ],
  whence: [
    {
      idx: 0,
      name: 'Evidence',
      support: ['data', 'proof', 'science', 'reasoning', 'verification'],
      oppose: ['superstition', 'denial', 'speculation', 'misinformation']
    },
    {
      idx: 1,
      name: 'Public Reason',
      support: ['debate', 'dialogue', 'justification', 'rational argument', 'consensus'],
      oppose: ['dogma', 'propaganda', 'unilateralism']
    },
    {
      idx: 2,
      name: 'Personal (Conscience)',
      support: ['conscience', 'intuition', 'personal belief', 'inner voice'],
      oppose: ['conformity', 'obedience', 'groupthink']
    },
    {
      idx: 3,
      name: 'Tradition',
      support: ['heritage', 'custom', 'continuity', 'elders', 'stability'],
      oppose: ['radicalism', 'rejection', 'iconoclasm']
    },
    {
      idx: 4,
      name: 'Revelation',
      support: ['faith', 'prophecy', 'divine command', 'vision', 'revelation'],
      oppose: ['skepticism', 'secularism', 'disbelief']
    },
    {
      idx: 5,
      name: 'Nature',
      support: ['natural', 'organic', 'ecological', 'balance', 'sustainability'],
      oppose: ['artificial', 'pollution', 'exploitation', 'corruption of nature']
    },
    {
      idx: 6,
      name: 'Pragmatism',
      support: ['practical', 'effective', 'functional', 'efficiency', 'results'],
      oppose: ['dogma', 'theory', 'perfectionism', 'rigidity']
    },
    {
      idx: 7,
      name: 'Aesthesis (Beauty)',
      support: ['beauty', 'harmony', 'elegance', 'grace', 'design', 'art'],
      oppose: ['ugliness', 'vulgarity', 'chaos', 'discord']
    },
    {
      idx: 8,
      name: 'Fidelity',
      support: ['loyalty', 'devotion', 'commitment', 'allegiance'],
      oppose: ['betrayal', 'infidelity', 'treachery']
    },
    {
      idx: 9,
      name: 'Law (Office/Standards)',
      support: ['legality', 'justice', 'rule of law', 'regulation', 'due process'],
      oppose: ['lawlessness', 'corruption', 'rebellion']
    }
  ],
  how: [
    {
      idx: 0,
      name: 'Law (Office/Standards)',
      support: ['legality', 'justice', 'rule of law', 'regulation', 'due process'],
      oppose: ['lawlessness', 'corruption', 'rebellion']
    },
    {
      idx: 1,
      name: 'Deliberation',
      support: ['debate', 'negotiation', 'dialogue', 'consultation', 'compromise'],
      oppose: ['suppression', 'haste', 'unilateral action', 'dogmatism']
    },
    {
      idx: 2,
      name: 'Mobilize',
      support: ['protest', 'movement', 'organizing', 'rally', 'strike'],
      oppose: ['apathy', 'passivity', 'suppression', 'complacency']
    },
    {
      idx: 3,
      name: 'Markets',
      support: ['competition', 'trade', 'profit', 'incentives', 'capitalism'],
      oppose: ['control', 'regulation', 'redistribution', 'collectivism']
    },
    {
      idx: 4,
      name: 'Mutual Aid',
      support: ['cooperation', 'solidarity', 'volunteerism', 'reciprocity'],
      oppose: ['selfishness', 'exploitation', 'neglect']
    },
    {
      idx: 5,
      name: 'Ritual',
      support: ['ceremony', 'rite', 'observance', 'holiday', 'prayer'],
      oppose: ['irreverence', 'disruption', 'informality']
    },
    {
      idx: 6,
      name: 'Enforce',
      support: ['enforcement', 'policing', 'punishment', 'discipline', 'authority', 'military', 'troops', 'martial law', 'ban', 'prohibit', 'mandate', 'compel'],
      oppose: ['disobedience', 'impunity', 'anarchy']
    },
    {
      idx: 7,
      name: 'Design/UX',
      support: ['design', 'architecture', 'nudging', 'policy', 'influence', 'default', 'opt-out', 'interface', 'system design'],
      oppose: ['randomness', 'neglect', 'chaos']
    },
    {
      idx: 8,
      name: 'Civic Culture',
      support: ['citizenship', 'education', 'journalism', 'civic duty', 'culture'],
      oppose: ['ignorance', 'propaganda', 'alienation', 'apathy']
    },
    {
      idx: 9,
      name: 'Philanthropy',
      support: ['charity', 'donation', 'altruism', 'benefactor', 'generosity'],
      oppose: ['greed', 'selfishness', 'exploitation']
    }
  ],
  whither: [
    {
      idx: 0,
      name: 'Self',
      support: ['self-interest', 'ambition', 'self-reliance', 'ego', 'competition'],
      oppose: ['selflessness', 'humility', 'collectivism']
    },
    {
      idx: 1,
      name: 'Family',
      support: ['family', 'parent', 'child', 'kin', 'household', 'lineage'],
      oppose: ['neglect', 'abandonment', 'alienation']
    },
    {
      idx: 2,
      name: 'Friends',
      support: ['friendship', 'camaraderie', 'alliance', 'trust', 'loyalty'],
      oppose: ['betrayal', 'rivalry', 'isolation']
    },
    {
      idx: 3,
      name: 'In-Group',
      support: ['us', 'loyalty', 'insiders', 'unity', 'belonging'],
      oppose: ['outsiders', 'betrayal', 'disloyalty', 'globalism']
    },
    {
      idx: 4,
      name: 'Nation',
      support: ['patriotism', 'homeland', 'sovereignty', 'national interest'],
      oppose: ['treason', 'cosmopolitanism', 'separatism']
    },
    {
      idx: 5,
      name: 'Civilization',
      support: ['culture', 'enlightenment', 'progress', 'heritage', 'civil order'],
      oppose: ['barbarism', 'decay', 'ignorance', 'regression']
    },
    {
      idx: 6,
      name: 'Humanity',
      support: ['compassion', 'human rights', 'dignity', 'equality', 'empathy'],
      oppose: ['cruelty', 'exclusion', 'dehumanization', 'nationalism']
    },
    {
      idx: 7,
      name: 'Earth',
      support: ['ecology', 'sustainability', 'environment', 'conservation', 'green'],
      oppose: ['pollution', 'exploitation', 'destruction']
    },
    {
      idx: 8,
      name: 'Cosmos',
      support: ['universe', 'cosmos', 'exploration', 'space', 'cosmic life'],
      oppose: ['isolationism', 'nihilism', 'indifference']
    },
    {
      idx: 9,
      name: 'God',
      support: ['God', 'divine will', 'faith', 'piety', 'worship', 'obedience'],
      oppose: ['atheism', 'blasphemy', 'defiance', 'secularism']
    }
  ]
};

// ============================================================================
// POLARITY DETECTION
// ============================================================================

// Words that indicate positive support for a value
const POSITIVE_MODIFIERS = [
  'increase', 'strengthen', 'enhance', 'boost', 'expand', 'improve',
  'raise', 'elevate', 'advance', 'promote', 'support', 'encourage',
  'establish', 'build', 'create', 'implement', 'introduce', 'invest',
  'prioritize', 'emphasize', 'defend', 'protect', 'preserve'
];

// Words that indicate opposition to a value
const NEGATIVE_MODIFIERS = [
  'decrease', 'weaken', 'reduce', 'lower', 'cut', 'slash',
  'restrict', 'limit', 'curtail', 'suppress', 'ban', 'prohibit',
  'eliminate', 'remove', 'dismantle', 'abandon', 'neglect',
  'undermine', 'threaten', 'attack', 'oppose', 'reject'
];

// Special case: coercive action keywords that should map to Enforce (how:6) NOT Design/UX (how:7)
const COERCIVE_KEYWORDS = [
  'martial law', 'military action', 'troops', 'deploy forces',
  'ban', 'prohibit', 'mandate', 'compel', 'force', 'impose',
  'arrest', 'imprison', 'detention', 'police action', 'crack down',
  'curfew', 'lockdown', 'enforce by law'
];

// ============================================================================
// FUZZY MATCHING
// ============================================================================

/**
 * Generate fuzzy variations of a keyword for matching
 * @param {string} keyword - Base keyword
 * @returns {string[]} - Array of variations
 */
function generateVariations(keyword) {
  const variations = [keyword.toLowerCase()];

  // Add plural/singular variations
  if (keyword.endsWith('s')) {
    variations.push(keyword.slice(0, -1)); // Remove 's'
  } else {
    variations.push(keyword + 's'); // Add 's'
  }

  // Add verb variations (-ing, -ed, -tion)
  const base = keyword.toLowerCase();

  // -ing forms
  if (base.endsWith('e')) {
    variations.push(base.slice(0, -1) + 'ing'); // create → creating
  } else {
    variations.push(base + 'ing'); // enforce → enforcing
  }

  // -ed forms
  if (base.endsWith('e')) {
    variations.push(base + 'd'); // create → created
  } else {
    variations.push(base + 'ed'); // enforce → enforced
  }

  // -tion/-ation forms
  if (base.endsWith('e')) {
    variations.push(base.slice(0, -1) + 'ation'); // regulate → regulation
    variations.push(base.slice(0, -1) + 'ion'); // create → creation
  } else {
    variations.push(base + 'ation'); // enforce → enforcation (rare)
    variations.push(base + 'ion'); // collect → collection
  }

  // -ment forms
  variations.push(base + 'ment'); // enforce → enforcement

  // Handle compound words (e.g., "self-interest" → "self interest")
  if (keyword.includes('-')) {
    variations.push(keyword.replace('-', ' '));
    variations.push(keyword.replace('-', ''));
  }

  return [...new Set(variations)]; // Remove duplicates
}

/**
 * Check if text contains keyword or its variations
 * @param {string} text - Text to search
 * @param {string} keyword - Keyword to find
 * @returns {Object|null} - {keyword, variation, position} or null
 */
function findKeywordMatch(text, keyword) {
  const lowerText = text.toLowerCase();
  const variations = generateVariations(keyword);

  for (const variation of variations) {
    // Use word boundary regex to avoid partial matches
    const regex = new RegExp(`\\b${variation}\\b`, 'i');
    const match = lowerText.match(regex);

    if (match) {
      return {
        keyword,
        variation,
        position: match.index
      };
    }
  }

  return null;
}

/**
 * Check for multi-word phrases (e.g., "martial law")
 * @param {string} text - Text to search
 * @param {string} phrase - Phrase to find
 * @returns {Object|null} - {phrase, position} or null
 */
function findPhraseMatch(text, phrase) {
  const lowerText = text.toLowerCase();
  const lowerPhrase = phrase.toLowerCase();

  const index = lowerText.indexOf(lowerPhrase);
  if (index !== -1) {
    return { phrase, position: index };
  }

  return null;
}

// ============================================================================
// CONTEXT ANALYSIS
// ============================================================================

/**
 * Analyze context around a keyword match to determine polarity
 * @param {string} text - Full action text
 * @param {number} position - Position of keyword match
 * @param {string} matchedWord - The matched keyword/variation
 * @returns {Object} - {polarity: 1|-1, modifier: string|null, confidence: number}
 */
function analyzeContext(text, position, matchedWord) {
  // Extract context window (30 chars before match)
  const contextStart = Math.max(0, position - 30);
  const contextWindow = text.substring(contextStart, position + matchedWord.length + 10).toLowerCase();

  // Check for negative modifiers
  for (const negMod of NEGATIVE_MODIFIERS) {
    if (contextWindow.includes(negMod)) {
      return {
        polarity: -1,
        modifier: negMod,
        confidence: 0.9
      };
    }
  }

  // Check for positive modifiers
  for (const posMod of POSITIVE_MODIFIERS) {
    if (contextWindow.includes(posMod)) {
      return {
        polarity: 1,
        modifier: posMod,
        confidence: 0.9
      };
    }
  }

  // No clear modifier found - assume positive support (keyword present = value relevant)
  return {
    polarity: 1,
    modifier: null,
    confidence: 0.6
  };
}

/**
 * Determine polarity strength (1 or 2, -1 or -2)
 * @param {number} basePolarity - 1 or -1
 * @param {number} confidence - 0.0 to 1.0
 * @param {string|null} modifier - The modifier word found
 * @returns {number} - -2, -1, 1, or 2
 */
function calculatePolarityStrength(basePolarity, confidence, modifier) {
  // Strong modifiers suggest magnitude 2
  const strongModifiers = [
    'drastically', 'significantly', 'completely', 'entirely', 'fully',
    'eliminate', 'ban', 'prohibit', 'mandate', 'compel', 'impose'
  ];

  const isStrong = modifier && strongModifiers.some(sm =>
    modifier.includes(sm) || sm.includes(modifier)
  );

  if (isStrong || confidence >= 0.85) {
    return basePolarity * 2;
  } else {
    return basePolarity * 1;
  }
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect keyword-based compass hints from player action
 * @param {string} actionTitle - Action title
 * @param {string} actionSummary - Action summary
 * @returns {Object[]} - Array of {prop, idx, polarity, confidence, matchedKeywords, reasoning}
 */
export function detectKeywordHints(actionTitle, actionSummary) {
  const fullText = `${actionTitle}. ${actionSummary || ''}`;
  const hints = [];
  const detectedValues = new Set(); // Prevent duplicates

  console.log(`[CompassKeywordDetector] Analyzing: "${actionTitle}"`);

  // SPECIAL CASE 1: Check for coercive keywords → Enforce (how:6)
  for (const coercivePhrase of COERCIVE_KEYWORDS) {
    const phraseMatch = findPhraseMatch(fullText, coercivePhrase);
    if (phraseMatch) {
      const valueKey = 'how:6'; // Enforce
      if (!detectedValues.has(valueKey)) {
        hints.push({
          prop: 'how',
          idx: 6,
          polarity: 2, // Strong support for coercive means
          confidence: 0.95,
          matchedKeywords: [coercivePhrase],
          reasoning: `Coercive action detected: "${coercivePhrase}" → Enforce (how:6)`
        });
        detectedValues.add(valueKey);
        console.log(`  ✓ Coercive keyword: "${coercivePhrase}" → how:6 Enforce (+2)`);
      }
    }
  }

  // MAIN SCAN: Search all compass values for keyword matches
  for (const [prop, values] of Object.entries(COMPASS_VALUES)) {
    for (const value of values) {
      const valueKey = `${prop}:${value.idx}`;
      if (detectedValues.has(valueKey)) continue; // Already detected

      const matchedKeywords = [];
      let bestMatch = null;

      // Check support keywords
      for (const keyword of value.support) {
        const keywordMatch = findKeywordMatch(fullText, keyword);
        if (keywordMatch) {
          matchedKeywords.push(`+${keyword}`);
          const context = analyzeContext(fullText, keywordMatch.position, keywordMatch.variation);

          if (!bestMatch || context.confidence > bestMatch.confidence) {
            bestMatch = {
              ...context,
              type: 'support',
              keyword
            };
          }
        }
      }

      // Check oppose keywords
      for (const keyword of value.oppose) {
        const keywordMatch = findKeywordMatch(fullText, keyword);
        if (keywordMatch) {
          matchedKeywords.push(`-${keyword}`);
          const context = analyzeContext(fullText, keywordMatch.position, keywordMatch.variation);

          // Oppose keyword present = negative for this value
          const opposedContext = {
            polarity: context.polarity * -1, // Flip polarity
            modifier: context.modifier,
            confidence: context.confidence
          };

          if (!bestMatch || opposedContext.confidence > bestMatch.confidence) {
            bestMatch = {
              ...opposedContext,
              type: 'oppose',
              keyword
            };
          }
        }
      }

      // If we found matches, create hint
      if (bestMatch && matchedKeywords.length > 0) {
        const polarity = calculatePolarityStrength(
          bestMatch.polarity,
          bestMatch.confidence,
          bestMatch.modifier
        );

        hints.push({
          prop,
          idx: value.idx,
          polarity,
          confidence: bestMatch.confidence,
          matchedKeywords,
          reasoning: `${bestMatch.type === 'support' ? 'Support' : 'Oppose'} keyword "${bestMatch.keyword}" detected${bestMatch.modifier ? ` with modifier "${bestMatch.modifier}"` : ''} → ${value.name} (${prop}:${value.idx})`
        });

        detectedValues.add(valueKey);
        console.log(`  ✓ ${matchedKeywords.join(', ')} → ${prop}:${value.idx} ${value.name} (${polarity >= 0 ? '+' : ''}${polarity})`);
      }
    }
  }

  // Sort by confidence (highest first)
  hints.sort((a, b) => b.confidence - a.confidence);

  // Limit to top 6 hints
  const topHints = hints.slice(0, 6);

  console.log(`[CompassKeywordDetector] Detected ${topHints.length} keyword hints (from ${hints.length} total matches)`);

  return topHints;
}

/**
 * Format keyword hints for AI prompt injection
 * @param {Object[]} hints - Array of hint objects
 * @returns {string} - Formatted string for prompt
 */
export function formatKeywordHintsForPrompt(hints) {
  if (hints.length === 0) {
    return 'KEYWORD HINTS: None detected. Proceed with full analysis.';
  }

  const formatted = hints.map(h => {
    const sign = h.polarity >= 0 ? '+' : '';
    const keywords = h.matchedKeywords.join(', ');
    return `  - ${h.prop}:${h.idx} (polarity: ${sign}${h.polarity}, confidence: ${h.confidence.toFixed(2)}, keywords: ${keywords})`;
  }).join('\n');

  return `KEYWORD HINTS DETECTED (validate these first, then add additional values if needed):\n${formatted}`;
}
