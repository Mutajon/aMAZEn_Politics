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
  actions: [DilemmaAction, DilemmaAction, DilemmaAction] | []; // Empty array when isGameEnd
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
  topic?: string;              // NEW: Broad subject category (Security, Economy, etc.)
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
  daysLeft: number; // totalDays - day + 1 (used for epic finale and game conclusion)
  previous?: {
    isFirst: boolean;
    isLast: boolean;
    priorTopic?: string;
    lastChoiceId?: "a" | "b" | "c";
    lastDilemmaTitle?: string;
  };
  supports?: { people?: number; mom?: number; middle?: number };
  dilemmaHistory?: DilemmaHistoryEntry[];  // Full game history for context
  lastChoice?: { title: string; summary: string }; // Previous choice (trimmed for token efficiency)

  // NEW: let the server log only when your Debug mode is ON
  debug?: boolean;
};

// -------------------- Light Dilemma API Types --------------------

export type SubjectStreak = {
  subject: string;
  count: number;
};

export type DilemmaScope = "Local" | "National" | "International";

export type ScopeStreak = {
  scope: DilemmaScope;
  count: number;
};

export type LightDilemmaRequest = {
  role: string;
  system: string;
  day?: number; // NEW: Current day (1-7) for day-based variety logic
  daysLeft: number; // totalDays - day + 1 (used for epic finale and game conclusion)
  subjectStreak: SubjectStreak | null;
  scopeStreak: ScopeStreak | null; // NEW: Scope rotation tracking
  recentScopes?: DilemmaScope[]; // NEW: Last 5 scopes for diversity checking
  recentDilemmaTitles?: string[]; // NEW: Last 3-5 dilemma titles for semantic variety checking
  recentTopics?: string[]; // NEW: Last 4 broad topics for forbidden list (Days 3 & 5)
  previous?: {
    title: string;
    description: string; // CRITICAL: Full dilemma description (shows what each faction wanted)
    choiceTitle: string;
    choiceSummary: string;
  };
  topWhatValues?: string[]; // Days 1, 3, 5: Top 2 "what" compass values for personalized dilemma
  thematicGuidance?: string; // Optional subject/theme guidance (custom subject or default axes)
  scopeGuidance?: string; // NEW: Server-calculated scope rotation guidance
  debug?: boolean;
  useAnthropic?: boolean;
};

export type SupportShift = {
  people: { delta: number; why: string };
  mom: { delta: number; why: string };
  holders: { delta: number; why: string };
};

export type LightDilemmaResponse = {
  title: string;
  description: string;
  actions: [DilemmaAction, DilemmaAction, DilemmaAction] | []; // Empty array when isGameEnd
  topic: string;
  scope: DilemmaScope; // NEW: AI-classified scope level
  supportShift: SupportShift | null;
  isFallback?: boolean;
  isGameEnd?: boolean; // True when daysLeft was 0 (game conclusion)
};
