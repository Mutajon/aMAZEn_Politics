// src/store/dilemmaStore.ts
import { create } from "zustand";
import type { Dilemma, DilemmaRequest } from "../lib/dilemma";
import { useSettingsStore } from "./settingsStore";
import { useRoleStore } from "./roleStore";
import { useCompassStore } from "./compassStore"; // <-- A) use compass values (0..10)

// gated debug logger
function dlog(...args: any[]) {
  if (useSettingsStore.getState().debugMode) {
    // eslint-disable-next-line no-console
    console.log("[dilemmaStore]", ...args);
  }
}

type DilemmaState = {
  day: number;
  totalDays: number;

  current: Dilemma | null;
  history: Dilemma[];
  loading: boolean;
  error: string | null;

  loadNext: () => Promise<void>;
  nextDay: () => void;
  setTotalDays: (n: number) => void;
  applyChoice: (id: "a" | "b" | "c") => void;
  reset: () => void;
};

export const useDilemmaStore = create<DilemmaState>((set, get) => ({
  day: 1,
  totalDays: 7,

  current: null,
  history: [],
  loading: false,
  error: null,

  async loadNext() {
    try {
      set({ loading: true, error: null });
      const snapshot = buildSnapshot();
      dlog("snapshot ->", snapshot);

      // POST to server (will be a real AI in step C; for now the stub returns a mock)
      let d: Dilemma | null = null;
      try {
        const r = await fetch("/api/dilemma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot),
        });
        if (r.ok) {
          d = (await r.json()) as Dilemma;
          dlog("server /api/dilemma ->", d);
        } else {
          const t = await r.text();
          dlog("server /api/dilemma FAILED:", r.status, t);
        }
      } catch (e: any) {
        dlog("server /api/dilemma network error:", e?.message || e);
      }

      // Fallback to local mock if server failed (keeps dev flow unblocked)
      if (!d) {
        d = localMock(snapshot.day);
        dlog("fallback mock ->", d);
      }

      const prev = get().current;
      set((s) => ({
        current: d!,
        history: prev ? [...s.history, prev] : s.history,
        loading: false,
      }));
    } catch (err: any) {
      const msg = err?.message || "Failed to load dilemma";
      set({ loading: false, error: msg });
      dlog("ERROR:", msg);
    }
  },

  nextDay() {
    const { day, totalDays } = get();
    const v = Math.min(totalDays, day + 1);
    dlog("nextDay ->", v);
    set({ day: v });
  },

  setTotalDays(n) {
    const v = Math.max(1, Math.round(Number(n) || 1));
    dlog("setTotalDays ->", v);
    set({ totalDays: v });
  },

  applyChoice(id) {
    dlog("applyChoice ->", id);
  },

  reset() {
    dlog("reset dilemmas");
    set({ day: 1, current: null, history: [], loading: false, error: null });
  },
}));

// ---- helpers ----

// flatten 0..10 arrays into a flat map like what0..what9, whence0..9, how0..9, whither0..9
function flattenCompass(vals: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of ["what", "whence", "how", "whither"] as const) {
    const arr = Array.isArray(vals?.[k]) ? vals[k] : [];
    for (let i = 0; i < 10; i++) {
      const v = Math.max(0, Math.min(10, Math.round(arr[i] ?? 0)));
      out[`${k}${i}`] = v;
    }
  }
  return out;
}

function buildSnapshot(): DilemmaRequest {
  const { debugMode, dilemmasSubjectEnabled, dilemmasSubject } =
    useSettingsStore.getState();
  const day = useDilemmaStore.getState().day;
  const totalDays = useDilemmaStore.getState().totalDays;

  // role/system (with your requested fallback)
  const roleState: any = useRoleStore.getState();
  const systemName =
    roleState?.analysis?.systemName ||
    "Divine Right Monarchy (fairytale dictatorship)";
  const role =
    roleState?.role?.title ||
    roleState?.character?.title ||
    "Unicorn King";

  const holders = Array.isArray(roleState?.analysis?.holders)
    ? roleState.analysis.holders.map((h: any) => ({
        name: String(h?.name || "Group"),
        weight: Number(h?.percent || h?.weight || 0),
      }))
    : [];

  const playerIndex =
    typeof roleState?.analysis?.playerIndex === "number"
      ? roleState.analysis.playerIndex
      : null;

  // A) pull compass values (0..10 per component) and flatten
  const compassRaw = useCompassStore.getState().values;
  const compassValues = flattenCompass(compassRaw);

  const snap: DilemmaRequest = {
    role,
    systemName,
    holders,
    playerIndex,
    compassValues, // now filled
    settings: { dilemmasSubjectEnabled, dilemmasSubject },
    day,
    totalDays,
    previous: { isFirst: day === 1, isLast: day === totalDays },
    supports: {}, // optional; wire later if you expose it
    debug: debugMode, // server logs only if Debug mode is ON
  };

  dlog("buildSnapshot ->", snap);
  return snap;
}

function localMock(day: number): Dilemma {
  return {
    title:
      day === 1 ? "First Night in the Palace" : "Crowds Swell Outside the Palace",
    description:
      day === 1
        ? "As the seals change hands, a restless city watches. Advisors split: display resolve now, or earn trust with patience."
        : "Rumors spiral as barricades appear along the market roads. Decide whether to project strength or show empathy before things harden.",
    actions: [
      {
        id: "a",
        title: "Impose Curfew",
        summary: "Restrict movement after dusk with visible patrols.",
        cost: -150,
        iconHint: "security",
      },
      {
        id: "b",
        title: "Address the Nation",
        summary: "Speak live tonight to calm fears and set the tone.",
        cost: -50,
        iconHint: "speech",
      },
      {
        id: "c",
        title: "Open Negotiations",
        summary: "Invite opposition figures for mediated talks.",
        cost: +50,
        iconHint: "diplomacy",
      },
    ],
  };
}
