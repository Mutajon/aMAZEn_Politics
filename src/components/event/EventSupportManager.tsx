// src/components/event/EventSupportManager.tsx
import { useRoleStore } from "../../store/roleStore";
import { useDilemmaStore } from "../../store/dilemmaStore";
import { analyzeSupport, type SupportEffect } from "../../lib/supportAnalysis";
import type { SupportEffectId } from "../../lib/eventConfirm";
import type { SupportDeltas, SupportTrends, SupportNotes, Trio } from "../../hooks/useEventState";

// Keep support % in [0,100] and round to int
const clampPercent = (n: number): number =>
  Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

interface EventSupportManagerProps {
  vals: Trio;
  setVals: (vals: Trio | ((prev: Trio) => Trio)) => void;
  setSupportDeltas: (deltas: SupportDeltas) => void;
  setSupportTrends: (trends: SupportTrends) => void;
  setSupportNotes: (notes: SupportNotes | ((prev: SupportNotes) => SupportNotes)) => void;
}

export function useEventSupportManager({
  vals,
  setVals,
  setSupportDeltas,
  setSupportTrends,
  setSupportNotes,
}: EventSupportManagerProps) {
  const analysis = useRoleStore((s) => s.analysis);
  const { day } = useDilemmaStore();

  // 1) Fire AI to compute support effects (people/middle/mom)
  function analyzeSupportWrapper(text: string) {
    const ctx = {
      systemName: analysis?.systemName || "",
      holders: Array.isArray(analysis?.holders)
        ? analysis!.holders.map((h) => ({ name: h.name, percent: h.percent }))
        : [],
      playerIndex: typeof analysis?.playerIndex === "number" ? analysis!.playerIndex : null,
      day: day || 1,
    };
    return analyzeSupport(text, ctx);
  }

  // 2) Apply effects locally: update percents, per-entity delta/trend
  function applySupportEffects(effects: SupportEffect[]) {
    if (!effects?.length) return;

    // 1) Update percents + per-entity delta/trend
    setVals((prev) => {
      const next = { ...prev };
      const newDeltas: SupportDeltas = {
        people: null,
        middle: null,
        mom: null,
      };
      const newTrends: SupportTrends = {
        people: null,
        middle: null,
        mom: null,
      };

      for (const e of effects) {
        const id = e.id as SupportEffectId;
        const before = next[id as keyof typeof next] as unknown as number;
        const after = clampPercent(before + e.delta);
        next[id as keyof typeof next] = after as any;

        newDeltas[id] = e.delta;
        newTrends[id] = e.delta > 0 ? "up" : e.delta < 0 ? "down" : null;
      }

      setSupportDeltas(newDeltas);
      setSupportTrends(newTrends);
      return next;
    });

    // 2) Store witty reason lines to display as SupportList "note"
    setSupportNotes((prev) => {
      const out = { ...prev };
      for (const e of effects) {
        if (e.id === "people" && e.explain) out.people = e.explain;
        if (e.id === "middle" && e.explain) out.middle = e.explain;
        if (e.id === "mom" && e.explain) out.mom = e.explain;
      }
      return out;
    });
  }

  return {
    analyzeSupportWrapper,
    applySupportEffects,
  };
}

// This is a hook component - it doesn't render anything
export default function EventSupportManager(props: EventSupportManagerProps) {
  // This component exists just to organize the support management logic
  // The actual hook is exported above
  return null;
}