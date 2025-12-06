// src/components/MiniCompass.tsx
import { motion, AnimatePresence } from "framer-motion";
import PetalRing from "../components/PetalRing";
import { COMPONENTS, PALETTE, type PropKey } from "../data/compass-data";
import { translateCompassValue } from "../i18n/translateGameData";
import { useLang } from "../i18n/lang";

/** transient pill shown for compass effects */
export type CompassEffectPing = {
  id: string | number;
  prop: PropKey;
  idx: number;
  delta: number;
};

export default function MiniCompass({
  size = 360,
  innerRadius,
  values,
  lengthScale = 0.5,
  rotate = false,          // ring rotates; pills do NOT rotate
  rotationSpeedSec = 60,
  effectPills = [],
}: {
  size?: number;
  innerRadius: number;
  values: Record<PropKey, number[]>;
  lengthScale?: number;
  rotate?: boolean;
  rotationSpeedSec?: number;
  effectPills?: CompassEffectPing[];
}) {
  const center = size / 2;
  const lang = useLang();

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Ring rotates internally; minLen lowered for visible micro-growth */}
      <PetalRing
        size={size}
        innerRadius={innerRadius}
        values={values}
        lengthScale={lengthScale}
        rotate={rotate ? rotationSpeedSec : false}
        minLen={2} // ⬅️ key change for the small ring
      />

      {/* Pills overlay ABOVE everything */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
        <AnimatePresence>
          {effectPills.map((p, i) => {
            const color = (PALETTE as any)[p.prop]?.base ?? "#fff";
            const englishLabel = COMPONENTS[p.prop][p.idx]?.short ?? "";
            const label = translateCompassValue(englishLabel, lang);
            const topPx = center - i * 28;   // show one above the other
            const delay = i * 0.15;          // stagger them

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 0, scale: 0.96 }}
                animate={{ opacity: 1, y: -20, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.98 }}
                transition={{ duration: 0.25, ease: "easeOut", delay }}
                className="absolute rounded-full px-2 py-1 text-xs font-semibold shadow-lg"
                style={{
                  left: center,
                  top: topPx,
                  transform: "translate(-50%, -50%)",
                  background: color,
                  color: "#0b1335",
                  border: "1.5px solid rgba(255,255,255,0.9)",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
                  whiteSpace: "nowrap",
                }}
              >
                {`${p.delta > 0 ? "+" : ""}${p.delta} ${label}`}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
