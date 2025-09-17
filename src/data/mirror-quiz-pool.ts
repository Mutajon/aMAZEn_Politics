// src/data/mirror-quiz-pool.ts
export type MirrorQA = {
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
      q: "Suppose you find a shiny button in the park. Do you press it?",
      options: [
        { a: "Yes, secrets must be uncovered", mappings: ["Truth/Trust", "Evidence"] },
        { a: "No, mysteries are fun", mappings: ["Flourish/Joy", "Personal"] },
        { a: "Only if we form a committee first", mappings: ["Security/Order", "Public Reason"] },
      ],
    },
    {
      q: "An oracle gives you one answer: truth, safety, or joy. Which?",
      options: [
        { a: "Life is about truth", mappings: ["Truth/Trust", "Revelation"] },
        { a: "Life is about safety", mappings: ["Security/Order", "Authority"] },
        { a: "Life is about joy", mappings: ["Flourish/Joy", "Personal"] },
      ],
    },
    {
      q: "You can save one: a library, a hospital, or a festival. Which?",
      options: [
        { a: "The library", mappings: ["Truth/Trust", "Public Reason"] },
        { a: "The hospital", mappings: ["Care/Solidarity", "Fidelity"] },
        { a: "The festival", mappings: ["Wellbeing", "Personal"] },
      ],
    },
    {
      q: "A law is unjust but stabilizes society. Do you keep it?",
      options: [
        { a: "Change it — justice first", mappings: ["Equality/Equity", "Evidence"] },
        { a: "Keep it — order first", mappings: ["Security/Order", "Law (Office)"] },
        { a: "Pilot alternatives", mappings: ["Create/Courage", "Pragmatism"] },
      ],
    },
    {
      q: "A sacred tradition conflicts with new data. Your move?",
      options: [
        { a: "Honor the sacred", mappings: ["Sacred/Awe", "Tradition"] },
        { a: "Follow the data", mappings: ["Truth/Trust", "Evidence"] },
        { a: "Blend respectfully", mappings: ["Freedom/Responsibility", "Public Reason"] },
      ],
    },
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
  