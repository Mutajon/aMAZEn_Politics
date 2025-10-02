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

  // NEW: let the server log only when your Debug mode is ON
  debug?: boolean;
};
