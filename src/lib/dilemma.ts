// src/lib/dilemma.ts
export type DilemmaAction = {
  id: string;
  title: string;
  summary: string;
  cost: number;        // -250..+500
  iconHint?: string;   // semantic hint for client-side icon mapping
};

export type Dilemma = {
  title: string;
  description: string;
  actions: [DilemmaAction, DilemmaAction, DilemmaAction];
  topic?: string;
  source?: string;
  supportEffects?: any; // Added dynamically by light API for Day 2+ support shifts
};

export type DilemmaHistoryEntry = {
  day: number;
  dilemmaTitle: string;        // Full title as generated
  dilemmaDescription: string;  // Full description as generated
  choiceId: string;            // "a", "b", or "c"
  choiceTitle: string;         // Full action title
  choiceSummary: string;       // Full action summary
  supportPeople: number;       // Support values AFTER this choice (0-100)
  supportMiddle: number;
  supportMom: number;
};

export type DilemmaRequest = {
  role: string | null;
  systemName: string | null;
  holders: Array<{ name: string; weight?: number }>;
  playerIndex: number | null;
  compassValues: Record<string, number>; // 0..10 scale
  settings: {
    dilemmasSubjectEnabled: boolean;
    dilemmasSubject?: string;
  };
  day: number;
  totalDays: number;
  previous?: {
    isFirst: boolean;
    isLast: boolean;
    priorTopic?: string;
    lastChoiceId?: "a" | "b" | "c";
    lastDilemmaTitle?: string;
  };
  supports?: { people?: number; mom?: number; middle?: number };
  dilemmaHistory?: DilemmaHistoryEntry[];  // Full game history for context

  // NEW: let the server log only when your Debug mode is ON
  debug?: boolean;
};

// -------------------- Light Dilemma API Types --------------------

export type SubjectStreak = {
  subject: string;
  count: number;
};

export type LightDilemmaRequest = {
  role: string;
  system: string;
  subjectStreak: SubjectStreak | null;
  previous?: {
    title: string;
    choiceTitle: string;
    choiceSummary: string;
  };
  debug?: boolean;
};

export type SupportShift = {
  people: { delta: number; why: string };
  mom: { delta: number; why: string };
  holders: { delta: number; why: string };
};

export type LightDilemmaResponse = {
  title: string;
  description: string;
  actions: [DilemmaAction, DilemmaAction, DilemmaAction];
  topic: string;
  supportShift: SupportShift | null;
  isFallback?: boolean;
};
