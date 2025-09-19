// src/components/PetalRing.tsx
import { useId } from "react";
import { motion } from "framer-motion";
import type { PropKey } from "../data/compass-data";

type Values = Record<PropKey, number[]>;

type Props = {
  size: number;                 // SVG size (px)
  innerRadius: number;          // where petals start
  values: Values;               // integers 0..10 per component
  lengthScale?: number;         // scales max radial length (0..1), default 0.5
  rotate?: boolean | number;    // false=no, true=90s, number=seconds per revolution
  className?: string;
  /** NEW: minimum visible petal length (px) beyond innerRadius; default 4 */
  minLen?: number;
};

const ORDER: PropKey[] = ["what", "whence", "how", "whither"]; // draw order
const PALETTE = {
  what:   { base: "#6366f1", lite: "#a5b4fc" }, // indigo
  whence: { base: "#10b981", lite: "#6ee7b7" }, // emerald
  how:    { base: "#f59e0b", lite: "#fcd34d" }, // amber
  whither:{ base: "#ef4444", lite: "#fca5a5" }, // rose
} as const;

const TAU = Math.PI * 2;
const PETALS_PER_QUAD = 10;
const GAP_ANG = (3 * Math.PI) / 180;

function polar(cx: number, cy: number, r: number, ang: number) {
  return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)] as const;
}
function petalPath(
  cx: number, cy: number, rInner: number, rOuter: number, a1: number, a2: number
) {
  const [x1, y1] = polar(cx, cy, rOuter, a1);
  const [x2, y2] = polar(cx, cy, rOuter, a2);
  const [ix1, iy1] = polar(cx, cy, rInner, a2);
  const [ix2, iy2] = polar(cx, cy, rInner, a1);
  return `M ${ix2} ${iy2} L ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} L ${ix1} ${iy1} A ${rInner} ${rInner} 0 0 0 ${ix2} ${iy2} Z`;
}

export default function PetalRing({
  size,
  innerRadius,
  values,
  lengthScale = 0.5,
  rotate = false,
  className,
  minLen = 4,                 // ⬅️ default as before
}: Props) {
  const uid = useId();
  const center = size / 2;
  const QUAD = TAU / 4;
  const R_MAX = size / 2 - 8;

  const rotateDuration =
    rotate === true ? 90 : typeof rotate === "number" ? Math.max(1, rotate) : 0;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <motion.g
        animate={rotate ? { rotate: 360 } : undefined}
        transition={rotate ? { repeat: Infinity, duration: rotateDuration, ease: "linear" } : undefined}
        style={{ transformOrigin: "50% 50%" }}
      >
        {ORDER.map((propKey, qi) => (
          <g key={propKey}>
            {(values[propKey] ?? Array(PETALS_PER_QUAD).fill(0)).map((raw, i) => {
              const shown = Math.round(Math.max(0, Math.min(10, raw)));
              const t = shown / 10; // 0..1
              const a1 = qi * QUAD + i * (QUAD / PETALS_PER_QUAD) + GAP_ANG / 2 - Math.PI / 2;
              const a2 = a1 + QUAD / PETALS_PER_QUAD - GAP_ANG;

              // use caller-provided minLen to avoid clamping-away small growth
              const rOut = innerRadius + Math.max(minLen, (R_MAX - innerRadius) * t * lengthScale);

              const d = petalPath(center, center, innerRadius, rOut, a1, a2);
              const cols = (PALETTE as any)[propKey];
              const gradId = `ring-grad-${propKey}-${i}-${uid}`;
              return (
                <g key={i}>
                  <defs>
                    <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={cols.lite} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={cols.base} stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <motion.path
                    d={d}
                    fill={`url(#${gradId})`}
                    stroke={cols.base}
                    strokeWidth={1}
                    initial={false}
                    animate={{ d }}
                    transition={{ type: "spring", stiffness: 160, damping: 24 }}
                  />
                </g>
              );
            })}
          </g>
        ))}
      </motion.g>
    </svg>
  );
}
