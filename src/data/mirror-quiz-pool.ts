// src/data/mirror-quiz-pool.ts
export type MirrorQA = {
  id: string; // Unique ID for translation lookup
  q: string;
  options: Array<{ a: string; mappings: string[] }>;
};

/**
 * Add as many questions as you like; the screen samples exactly 3 each time.
 * "mappings" may use canonical labels (e.g., "Wellbeing") or friendly aliases
 * (e.g., "Flourish/Joy") — resolveLabel() in compass-data handles both.
 */
export const MIRROR_QUIZ_POOL: MirrorQA[] = [
  {
    id: "QUIZ_BUTTON_IN_PARK",
    q: "Suppose you find a shiny button in the middle of the park. Pressing it might reveal the deepest secret of the universe, or it might just turn on the sprinklers. Do you press it?",
    options: [
      { a: "Yes, truth at any cost — secrets must be uncovered", mappings: ["Truth/Trust", "Evidence"] },
      { a: "No, let's keep the mystery alive — life is funnier that way", mappings: ["Flourish/Joy", "Personal"] },
      { a: "Only if I can first form a proper committee and write a report", mappings: ["Security/Order", "Public Reason"] }
    ],
  },
  {
    id: "QUIZ_ISLAND_DECORATION",
    q: "You're on a deserted island, and you can decorate your shelter with either a sturdy lock, a colorful mural, or a bookshelf of old dusty rules. Which do you choose?",
    options: [
      { a: "The sturdy lock — safety first!", mappings: ["Security/Order", "Authority"] },
      { a: "The mural — art is life, even if crabs don't appreciate it", mappings: ["Create/Courage", "Aesthetic"] },
      { a: "The rules — tradition keeps even coconuts in line", mappings: ["Honor/Dignity", "Tradition"] }
    ],
  },
  {
    id: "QUIZ_WORLDWIDE_FESTIVAL",
    q: "Imagine you're given the power to instantly start one worldwide festival. What do people celebrate?",
    options: [
      { a: "A Festival of Fairness — free pie slices for everyone", mappings: ["Equality/Equity", "Contract"] },
      { a: "A Festival of Freedom — everyone does what they want, preferably loudly", mappings: ["Liberty/Agency", "Personal"] },
      { a: "A Festival of Faith — songs, rituals, and a little awe", mappings: ["Transcendence/Spiritual", "Revelation"] }
    ],
  },
  {
    id: "QUIZ_RED_TRAFFIC_LIGHT",
    q: "At midnight you see a red traffic light, but not a single soul around. What do you do?",
    options: [
      { a: "Stop. Even rules deserve respect when no one is watching", mappings: ["Security/Order", "Authority"] },
      { a: "Go! Why wait for a robot lamp to tell me how to live?", mappings: ["Liberty/Agency", "Personal"] },
      { a: "Stay and ponder: who decides when the light turns green?", mappings: ["Truth/Trust", "Public Reason"] }
    ],
  },
  {
    id: "QUIZ_MYSTERIOUS_BOX",
    q: "A traveler hands you a mysterious box labeled: \"Open for happiness, ignore for wisdom.\" What do you do?",
    options: [
      { a: "Open it — happiness now beats wisdom later", mappings: ["Flourish/Joy", "Personal"] },
      { a: "Ignore it — wisdom might be boring, but it's reliable", mappings: ["Truth/Trust", "Evidence"] },
      { a: "Negotiate with the box — maybe it can do both", mappings: ["Equality/Equity", "Contract"] }
    ],
  },
  {
    id: "QUIZ_TOWN_STATUE",
    q: "You've been asked to build a statue in the town square. What should it represent?",
    options: [
      { a: "A hero holding the scales of justice", mappings: ["Equality/Equity", "Public Reason"] },
      { a: "A wild jester juggling pineapples", mappings: ["Flourish/Joy", "Aesthetic"] },
      { a: "A wise elder pointing to the stars", mappings: ["Transcendence/Spiritual", "Tradition"] }
    ],
  },
  {
    id: "QUIZ_VAST_FORTUNE",
    q: "You inherit a vast fortune. What's your first move?",
    options: [
      { a: "Invest in building a safe, orderly city", mappings: ["Security/Order", "Utility"] },
      { a: "Throw a massive festival for everyone — joy shared is joy doubled", mappings: ["Flourish/Joy", "Aesthetic"] },
      { a: "Fund an expedition to finally discover the truth of Atlantis", mappings: ["Truth/Trust", "Evidence"] }
    ],
  },
  {
    id: "QUIZ_WHISPERING_TREES",
    q: "You stumble into a forest where the trees whisper advice. One says: \"Follow the rules.\" Another: \"Follow your heart.\" The third: \"Follow the stars.\" Which do you trust?",
    options: [
      { a: "The rule tree — it's stood tall for centuries", mappings: ["Security/Order", "Tradition"] },
      { a: "The heart tree — it knows me better than anyone", mappings: ["Liberty/Agency", "Personal"] },
      { a: "The star tree — truth shines above us all", mappings: ["Truth/Trust", "Revelation"] }
    ],
  },
  {
    id: "QUIZ_NEW_KINGDOM",
    q: "You are designing a new kingdom. You can only pick one founding principle: fairness, safety, or adventure. Which do you pick?",
    options: [
      { a: "Fairness — all citizens get equal pie", mappings: ["Equality/Equity", "Contract"] },
      { a: "Safety — pies are locked in vaults, but safe vaults", mappings: ["Security/Order", "Authority"] },
      { a: "Adventure — citizens are free to invent pie catapults", mappings: ["Create/Courage", "Personal"] }
    ],
  },
  {
    id: "QUIZ_FREEZING_LAKE",
    q: "A friend dares you to jump into a lake at dawn. The water's freezing. Do you…?",
    options: [
      { a: "Jump in — courage over comfort", mappings: ["Create/Courage", "Personal"] },
      { a: "Decline politely — health is more important", mappings: ["Security/Order", "Utility"] },
      { a: "Start a group chant first, to make it legendary", mappings: ["Honor/Dignity", "Tradition"] }
    ],
  },
  {
    id: "QUIZ_ANCIENT_BOOK",
    q: "You discover an ancient book with missing pages. Do you…?",
    options: [
      { a: "Try to reconstruct it with hard evidence", mappings: ["Truth/Trust", "Evidence"] },
      { a: "Add your own wild stories to complete it", mappings: ["Create/Courage", "Aesthetic"] },
      { a: "Treat it as sacred — missing pages are part of the mystery", mappings: ["Transcendence/Spiritual", "Revelation"] }
    ],
  },
  {
    id: "QUIZ_OUTLAW_BOREDOM",
    q: "You are mayor of a small town, and someone suggests outlawing boredom. How do you respond?",
    options: [
      { a: "Impossible, but let's fund some joyful events anyway", mappings: ["Flourish/Joy", "Utility"] },
      { a: "Outlawing boredom sounds oppressive — liberty first!", mappings: ["Liberty/Agency", "Public Reason"] },
      { a: "Boredom is part of life's dignity — don't ban it", mappings: ["Honor/Dignity", "Tradition"] }
    ],
  },
  {
    id: "QUIZ_DRAGON_GIFT",
    q: "A dragon offers to grant you one gift: endless wealth, endless safety, or endless friendship. Which do you take?",
    options: [
      { a: "Wealth — prosperity builds everything else", mappings: ["Wealth/Prosperity", "Utility"] },
      { a: "Safety — better a safe world than a rich one", mappings: ["Security/Order", "Authority"] },
      { a: "Friendship — solidarity is worth more than gold", mappings: ["Care/Solidarity", "Personal"] }
    ],
  },
  {
    id: "QUIZ_LAW_FOR_FUTURE",
    q: "You are writing a law for future generations. Which law do you write?",
    options: [
      { a: "Always double-check the facts", mappings: ["Truth/Trust", "Evidence"] },
      { a: "Always dance when the music plays", mappings: ["Flourish/Joy", "Aesthetic"] },
      { a: "Always protect the vulnerable", mappings: ["Care/Solidarity", "Public Reason"] }
    ],
  },
  {
    id: "QUIZ_ORACLE_ANSWER",
    q: "A wise oracle offers you one answer: \"life is about truth,\" \"life is about safety,\" or \"life is about joy.\" Which do you choose?",
    options: [
      { a: "Truth — clarity is worth any cost", mappings: ["Truth/Trust", "Revelation"] },
      { a: "Safety — without order, nothing else survives", mappings: ["Security/Order", "Authority"] },
      { a: "Joy — because what's the point otherwise?", mappings: ["Flourish/Joy", "Personal"] }
    ],
  }
];

/** Utility: pick N items uniformly at random. */
export function pickQuiz(n = 3): MirrorQA[] {
  const arr = [...MIRROR_QUIZ_POOL];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.max(0, Math.min(n, arr.length)));
}
