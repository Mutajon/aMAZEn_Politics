// src/components/event/CompassPillsOverlay.tsx
import React from "react";
import type { CompassEffectPing } from "../MiniCompass";
import { COMPONENTS, PALETTE } from "../../data/compass-data";

type Props = {
  effectPills: CompassEffectPing[];
  loading: boolean;
  color?: string;
};

/** Spinner + stacked pills ABOVE the mirror card; no interaction. */
export default function CompassPillsOverlay({ effectPills, loading, color }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      {loading && (
        <div className="flex items-center justify-center" style={{ color }}>
          <span className="inline-block w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && effectPills.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          {effectPills.map((p) => {
            const label = COMPONENTS[p.prop][p.idx]?.short ?? "";
            const bg = (PALETTE as any)[p.prop]?.base ?? "#fff";
            return (
              <div
                key={p.id}
                className="rounded-full px-2 py-1 text-xs font-semibold"
                style={{
                  background: bg,
                  color: "#0b1335",
                  border: "1.5px solid rgba(255,255,255,0.9)",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
                  whiteSpace: "nowrap",
                }}
              >
                {`${p.delta > 0 ? "+" : ""}${p.delta} ${label}`}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
