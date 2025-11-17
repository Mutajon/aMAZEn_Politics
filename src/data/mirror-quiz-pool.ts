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
      { a: "No, let's keep the mystery alive — life is funnier that way", mappings: ["Wellbeing", "Personal"] },
      { a: "Only if I can first form a proper committee and write a report", mappings: ["Security/Safety", "Public Reason"] }
    ],
  },
  {
    id: "QUIZ_ISLAND_DECORATION",
    q: "You're on a deserted island, and you can decorate your shelter with either a sturdy lock, a colorful mural, or a bookshelf of old dusty rules. Which do you choose?",
    options: [
      { a: "The sturdy lock — safety first!", mappings: ["Security/Safety", "Law"] },
      { a: "The mural — art is life, even if crabs don't appreciate it", mappings: ["Create/Courage", "Aesthesis"] },
      { a: "The rules — tradition keeps even coconuts in line", mappings: ["Honor/Sacrifice", "Tradition"] }
    ],
  },
  {
    id: "QUIZ_WORLDWIDE_FESTIVAL",
    q: "Imagine you're given the power to instantly start one worldwide festival. What do people celebrate?",
    options: [
      { a: "A Festival of Fairness — free pie slices for everyone", mappings: ["Equality/Equity", "Public Reason"] },
      { a: "A Festival of Freedom — everyone does what they want, preferably loudly", mappings: ["Liberty/Agency", "Personal"] },
      { a: "A Festival of Faith — songs, rituals, and a little awe", mappings: ["Sacred/Awe", "Revelation"] }
    ],
  },
  {
    id: "QUIZ_RED_TRAFFIC_LIGHT",
    q: "At midnight you see a red traffic light, but not a single soul around. What do you do?",
    options: [
      { a: "Stop. Even rules deserve respect when no one is watching", mappings: ["Security/Safety", "Law"] },
      { a: "Go! Why wait for a robot lamp to tell me how to live?", mappings: ["Liberty/Agency", "Personal"] },
      { a: "Stay and ponder: who decides when the light turns green?", mappings: ["Truth/Trust", "Public Reason"] }
    ],
  },
  {
    id: "QUIZ_MYSTERIOUS_BOX",
    q: "A traveler hands you a mysterious box labeled: \"Open for happiness, ignore for wisdom.\" What do you do?",
    options: [
      { a: "Open it — happiness now beats wisdom later", mappings: ["Wellbeing", "Personal"] },
      { a: "Ignore it — wisdom might be boring, but it's reliable", mappings: ["Truth/Trust", "Evidence"] },
      { a: "Negotiate with the box — maybe it can do both", mappings: ["Equality/Equity", "Pragmatism"] }
    ],
  },
  {
    id: "QUIZ_TOWN_STATUE",
    q: "You've been asked to build a statue in the town square. What should it represent?",
    options: [
      { a: "A hero holding the scales of justice", mappings: ["Equality/Equity", "Public Reason"] },
      { a: "A wild jester juggling pineapples", mappings: ["Wellbeing", "Aesthesis"] },
      { a: "A wise elder pointing to the stars", mappings: ["Sacred/Awe", "Tradition"] }
    ],
  },
  {
    id: "QUIZ_VAST_FORTUNE",
    q: "You inherit a vast fortune. What's your first move?",
    options: [
      { a: "Invest in building a safe, orderly city", mappings: ["Security/Safety", "Pragmatism"] },
      { a: "Throw a massive festival for everyone — joy shared is joy doubled", mappings: ["Wellbeing", "Aesthesis"] },
      { a: "Fund an expedition to finally discover the truth of Atlantis", mappings: ["Truth/Trust", "Evidence"] }
    ],
  },
  {
    id: "QUIZ_WHISPERING_TREES",
    q: "You stumble into a forest where the trees whisper advice. One says: \"Follow the rules.\" Another: \"Follow your heart.\" The third: \"Follow the stars.\" Which do you trust?",
    options: [
      { a: "The rule tree — it's stood tall for centuries", mappings: ["Security/Safety", "Tradition"] },
      { a: "The heart tree — it knows me better than anyone", mappings: ["Liberty/Agency", "Personal"] },
      { a: "The star tree — truth shines above us all", mappings: ["Truth/Trust", "Revelation"] }
    ],
  },
  {
    id: "QUIZ_NEW_KINGDOM",
    q: "You are designing a new kingdom. You can only pick one founding principle: fairness, safety, or adventure. Which do you pick?",
    options: [
      { a: "Fairness — all citizens get equal pie", mappings: ["Equality/Equity", "Public Reason"] },
      { a: "Safety — pies are locked in vaults, but safe vaults", mappings: ["Security/Safety", "Law"] },
      { a: "Adventure — citizens are free to invent pie catapults", mappings: ["Create/Courage", "Personal"] }
    ],
  },
  {
    id: "QUIZ_FREEZING_LAKE",
    q: "A friend dares you to jump into a lake at dawn. The water's freezing. Do you…?",
    options: [
      { a: "Jump in — courage over comfort", mappings: ["Create/Courage", "Personal"] },
      { a: "Decline politely — health is more important", mappings: ["Security/Safety", "Pragmatism"] },
      { a: "Start a group chant first, to make it legendary", mappings: ["Honor/Sacrifice", "Tradition"] }
    ],
  },
  {
    id: "QUIZ_ANCIENT_BOOK",
    q: "You discover an ancient book with missing pages. Do you…?",
    options: [
      { a: "Try to reconstruct it with hard evidence", mappings: ["Truth/Trust", "Evidence"] },
      { a: "Add your own wild stories to complete it", mappings: ["Create/Courage", "Aesthesis"] },
      { a: "Treat it as sacred — missing pages are part of the mystery", mappings: ["Sacred/Awe", "Revelation"] }
    ],
  },
  {
    id: "QUIZ_OUTLAW_BOREDOM",
    q: "You are mayor of a small town, and someone suggests outlawing boredom. How do you respond?",
    options: [
      { a: "Impossible, but let's fund some joyful events anyway", mappings: ["Wellbeing", "Pragmatism"] },
      { a: "Outlawing boredom sounds oppressive — liberty first!", mappings: ["Liberty/Agency", "Public Reason"] },
      { a: "Boredom is part of life's dignity — don't ban it", mappings: ["Honor/Sacrifice", "Tradition"] }
    ],
  },
  {
    id: "QUIZ_DRAGON_GIFT",
    q: "A dragon offers to grant you one gift: endless wealth, endless safety, or endless friendship. Which do you take?",
    options: [
      { a: "Wealth — prosperity builds everything else", mappings: ["Wellbeing", "Pragmatism"] },
      { a: "Safety — better a safe world than a rich one", mappings: ["Security/Safety", "Law"] },
      { a: "Friendship — solidarity is worth more than gold", mappings: ["Care/Solidarity", "Personal"] }
    ],
  },
  {
    id: "QUIZ_LAW_FOR_FUTURE",
    q: "You are writing a law for future generations. Which law do you write?",
    options: [
      { a: "Always double-check the facts", mappings: ["Truth/Trust", "Evidence"] },
      { a: "Always dance when the music plays", mappings: ["Wellbeing", "Aesthesis"] },
      { a: "Always protect the vulnerable", mappings: ["Care/Solidarity", "Public Reason"] }
    ],
  },
  {
    id: "QUIZ_ORACLE_ANSWER",
    q: "A wise oracle offers you one answer: \"life is about truth,\" \"life is about safety,\" or \"life is about joy.\" Which do you choose?",
    options: [
      { a: "Truth — clarity is worth any cost", mappings: ["Truth/Trust", "Revelation"] },
      { a: "Safety — without order, nothing else survives", mappings: ["Security/Safety", "Law"] },
      { a: "Joy — because what's the point otherwise?", mappings: ["Wellbeing", "Personal"] }
    ],
  },
  // NEW QUESTIONS BELOW
  {
    id: "QUIZ_BROKEN_PROMISE",
    q: "You promised your neighbor you'd water their plants, but a once-in-a-lifetime concert just got announced for tonight. What do you do?",
    options: [
      { a: "Keep the promise — my word is sacred", mappings: ["Honor/Sacrifice", "Fidelity"] },
      { a: "Go to the concert — life is short, and plants are resilient", mappings: ["Liberty/Agency", "Personal"] },
      { a: "Ask someone else to water them — find a practical solution", mappings: ["Freedom/Responsibility", "Pragmatism"] }
    ],
  },
  {
    id: "QUIZ_VILLAGE_DISPUTE",
    q: "Two families in your village are feuding over land. One claims ancestral rights, the other has a legal deed. How do you settle this?",
    options: [
      { a: "Honor the ancestral claim — history matters", mappings: ["Honor/Sacrifice", "Tradition"] },
      { a: "Follow the legal deed — law provides clarity", mappings: ["Equality/Equity", "Law"] },
      { a: "Split the land equally — fairness above all", mappings: ["Care/Solidarity", "Public Reason"] }
    ],
  },
  {
    id: "QUIZ_POLLUTED_RIVER",
    q: "A factory is polluting the river, but it employs half the town. What's your stance?",
    options: [
      { a: "Shut it down — nature must be protected", mappings: ["Wellbeing", "Nature"] },
      { a: "Demand they clean up but keep operating — practical compromise", mappings: ["Freedom/Responsibility", "Pragmatism"] },
      { a: "Let the people decide through open debate", mappings: ["Liberty/Agency", "Public Reason"] }
    ],
  },
  {
    id: "QUIZ_UGLY_MONUMENT",
    q: "The city council wants to tear down an ugly old monument to build a modern art piece. You must cast the deciding vote.",
    options: [
      { a: "Keep it — it represents our shared history", mappings: ["Honor/Sacrifice", "Tradition"] },
      { a: "Replace it — beauty enriches everyone's lives", mappings: ["Create/Courage", "Aesthesis"] },
      { a: "Study what the community truly wants first", mappings: ["Equality/Equity", "Public Reason"] }
    ],
  },
  {
    id: "QUIZ_EXPERIMENTAL_CURE",
    q: "Scientists offer you an experimental cure for a disease, but it's barely tested. Do you take it?",
    options: [
      { a: "Yes — brave pioneers advance medicine", mappings: ["Create/Courage", "Evidence"] },
      { a: "No — wait for more data and proper verification", mappings: ["Security/Safety", "Evidence"] },
      { a: "Ask what my gut tells me in meditation", mappings: ["Wellbeing", "Personal"] }
    ],
  },
  {
    id: "QUIZ_SHARED_SECRET",
    q: "Your best friend confides a harmful secret about themselves. They beg you not to tell anyone, but you think others should know for safety reasons.",
    options: [
      { a: "Keep the secret — loyalty to friends is absolute", mappings: ["Honor/Sacrifice", "Fidelity"] },
      { a: "Tell the truth — people deserve to know", mappings: ["Truth/Trust", "Evidence"] },
      { a: "Help them face it together — compassion finds a way", mappings: ["Care/Solidarity", "Personal"] }
    ],
  },
  {
    id: "QUIZ_SACRED_GROVE",
    q: "Developers want to build affordable housing on land considered sacred by indigenous people. What should happen?",
    options: [
      { a: "Protect the sacred land — some things are beyond economics", mappings: ["Sacred/Awe", "Revelation"] },
      { a: "Build the housing — people need homes now", mappings: ["Care/Solidarity", "Pragmatism"] },
      { a: "Find another site that respects both needs", mappings: ["Freedom/Responsibility", "Public Reason"] }
    ],
  },
  {
    id: "QUIZ_REBEL_ARTIST",
    q: "An artist creates a controversial piece that offends many but sparks important conversations. Should it be displayed publicly?",
    options: [
      { a: "Yes — free expression must be protected", mappings: ["Liberty/Agency", "Personal"] },
      { a: "No — community harmony matters more", mappings: ["Care/Solidarity", "Tradition"] },
      { a: "Display it with context that educates viewers", mappings: ["Truth/Trust", "Public Reason"] }
    ],
  },
  {
    id: "QUIZ_INEFFICIENT_RITUAL",
    q: "Your community has a beautiful but time-consuming ritual that accomplishes nothing practical. Modernizers want to abolish it.",
    options: [
      { a: "Keep it — rituals bind us together beyond utility", mappings: ["Sacred/Awe", "Tradition"] },
      { a: "Drop it — time is precious, use it wisely", mappings: ["Freedom/Responsibility", "Pragmatism"] },
      { a: "Transform it into something both meaningful and efficient", mappings: ["Create/Courage", "Aesthesis"] }
    ],
  },
  {
    id: "QUIZ_WHISTLEBLOWER_DILEMMA",
    q: "You discover your employer is breaking safety rules, but exposing them will cost hundreds of jobs including yours. What do you do?",
    options: [
      { a: "Expose it — truth and safety come first", mappings: ["Truth/Trust", "Evidence"] },
      { a: "Try to fix it internally — protect both workers and principles", mappings: ["Freedom/Responsibility", "Pragmatism"] },
      { a: "Stay silent — loyalty to coworkers matters most", mappings: ["Care/Solidarity", "Fidelity"] }
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
