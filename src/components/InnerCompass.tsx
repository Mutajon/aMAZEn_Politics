// src/components/InnerCompass.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { COMPONENTS, PROPERTIES, PALETTE, type PropKey } from "../data/compass-data";

/* public image path (Vite serves /public at the root): put your file at public/assets/images/mirror.png */
const MIRROR_SRC = "/assets/images/mirror.png";

/* ------------------ demo values: 0..10 each (no normalization) ----------- */
function generateValues(seed = Math.random()) {
  const rand = mulberry32(Math.floor(seed * 1e9));
  const values: Record<PropKey, number[]> = { what: [], whence: [], how: [], whither: [] };
  (Object.keys(values) as PropKey[]).forEach((k) => {
    for (let i = 0; i < 10; i++) {
      const x = Math.pow(rand(), 1.3) * 10; // 0..10 with occasional spikes
      values[k].push(Math.max(0, Math.min(10, x)));
    }
  });
  return values;
}
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --------------------------- SVG helpers --------------------------------- */
const TAU = Math.PI * 2;
function polar(cx: number, cy: number, r: number, ang: number) {
  return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)] as const;
}
function petalPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  a1: number,
  a2: number
) {
  const [x1, y1] = polar(cx, cy, rOuter, a1);
  const [x2, y2] = polar(cx, cy, rOuter, a2);
  const [ix1, iy1] = polar(cx, cy, rInner, a2);
  const [ix2, iy2] = polar(cx, cy, rInner, a1);
  return `M ${ix2} ${iy2} L ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} L ${ix1} ${iy1} A ${rInner} ${rInner} 0 0 0 ${ix2} ${iy2} Z`;
}

/* --------------------- Visual constants (compact) ------------------------ */
const SIZE = 320;
const PADDING = 10;
const R_MAX = SIZE / 2 - PADDING;
const R_INNER = 36;       // invisible inner circle (donut anchor)
const GAP_RADIAL = 6;
const QUAD_SWEEP = TAU / 4;
const PETALS_PER_QUAD = 10;
const GAP_ANG = (3 * Math.PI) / 180;

/* scale down max petal length by ~50% */
const LENGTH_SCALE = 0.5; // ⬅️ this halves the maximum extent

const propTitle = (k: PropKey) => PROPERTIES.find((p) => p.key === k)!.title;
const propSubtitle = (k: PropKey) => PROPERTIES.find((p) => p.key === k)!.subtitle;
function generateExplanation(prop: PropKey, idx: number) {
  const c = COMPONENTS[prop][idx];
  return `${c.short} — ${c.full}`;
}

/* ------------------------------- Component ------------------------------- */
export default function InnerCompass() {
  const [values] = useState(generateValues(0.42)); // 0..10 demo values
  const [activeProp, setActiveProp] = useState<PropKey | null>(null); // panel closed initially
  const [activeComponent, setActiveComponent] = useState<number | null>(null);
  const center = SIZE / 2;
  const hasPanel = !!activeProp;

  return (
    <div className="w-full grid md:grid-cols-[330px_minmax(0,1fr)] gap-4 md:gap-6 items-start">
      {/* LEFT: chart (spans full width until panel opened) */}
      <div className={`relative ${hasPanel ? "" : "md:col-span-2"}`}>
        <style>{`
          @keyframes hueCycle { 
            0% { filter: hue-rotate(0deg) drop-shadow(0 0 10px rgba(255,255,255,0.35)); } 
            100% { filter: hue-rotate(360deg) drop-shadow(0 0 10px rgba(255,255,255,0.35)); } 
          }
          .hue-anim { animation: hueCycle 4s linear infinite; }
        `}</style>

        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-[320px] h-[320px]">
          {/* slowly rotating petals */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 90, ease: "linear" }}
            style={{ transformOrigin: "50% 50%" }}
          >
            {PROPERTIES.map((prop, qi) => (
              <g key={prop.key}>
                {values[prop.key].map((rawVal, i) => {
                  /* use the displayed integer (rounded) for both label and geometries
                     so "10" truly fills the bar and reaches max petal length */
                  const shown = Math.round(rawVal);           // 0..10 integer
                  const weight01 = shown / 10;                // 0..1 normalized
                  const aStart =
                    qi * QUAD_SWEEP + i * (QUAD_SWEEP / PETALS_PER_QUAD) + GAP_ANG / 2 - Math.PI / 2;
                  const aEnd = aStart + QUAD_SWEEP / PETALS_PER_QUAD - GAP_ANG;
                  const baseInner = R_INNER + GAP_RADIAL;
                  const rInner = baseInner;
                  const rOuter =
                    baseInner +
                    Math.max(3, (R_MAX - baseInner) * weight01 * LENGTH_SCALE); // ⬅️ half size
                  const path = petalPath(center, center, rInner, rOuter, aStart, aEnd);
                  const fill = `url(#grad-${prop.key}-${i})`;
                  const edge = (PALETTE as any)[prop.key].base;
                  const isDimmed = !!activeProp && activeProp !== prop.key;
                  const isSelected = activeProp === prop.key && activeComponent === i;

                  return (
                    <g key={i}>
                      <defs>
                        <linearGradient id={`grad-${prop.key}-${i}`} x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor={(PALETTE as any)[prop.key].lite} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={(PALETTE as any)[prop.key].base} stopOpacity={0.9} />
                        </linearGradient>
                      </defs>
                      <motion.path
                        d={path}
                        initial={false}
                        animate={{ d: path, opacity: isDimmed ? 0.35 : 0.95 }}
                        transition={{ type: "spring", stiffness: 140, damping: 22, mass: 0.6 }}
                        fill={fill}
                        stroke={edge}
                        strokeWidth={isSelected ? 3 : 1}
                        className={isSelected ? "hue-anim" : ""}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setActiveProp(prop.key as PropKey);
                          setActiveComponent(i);
                        }}
                      />
                    </g>
                  );
                })}
              </g>
            ))}
          </motion.g>

       {/* center image: fill the entire inner hole (cropped to a circle) */}
{MIRROR_SRC && (
  (() => {
    const holeR = R_INNER + GAP_RADIAL;         // full empty circle inside the petals
    const imgR = holeR - 1;                     // slight padding so it doesn’t clip
    const imgSize = imgR * 2;
    const x = center - imgR;
    const y = center - imgR;
    const clipId = "centerClip";

    return (
      <>
        <defs>
          <clipPath id={clipId}>
            <circle cx={center} cy={center} r={imgR} />
          </clipPath>
        </defs>
        <image
          href={MIRROR_SRC}
          x={x}
          y={y}
          width={imgSize}
          height={imgSize}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      </>
    );
  })()
)}

        </svg>

        {/* EXPLANATION BELOW the compass (no overlap) */}
        <AnimatePresence>
          {hasPanel && activeComponent !== null && (
            <motion.div
              key="explain"
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="mt-3 w-[320px] rounded-2xl border-2 border-white/90 bg-black/25 backdrop-blur p-4"
              style={{ WebkitBackdropFilter: "blur(6px)" }}
            >
              <div
                className="text-xl font-semibold mb-1"
                style={{ color: activeProp ? (PALETTE as any)[activeProp].base : "#fff" }}
              >
                {activeProp !== null && activeComponent !== null
                  ? COMPONENTS[activeProp][activeComponent]?.short
                  : ""}
              </div>
              <div className="text-white/90 text-sm leading-relaxed">
                {activeProp !== null && activeComponent !== null
                  ? generateExplanation(activeProp, activeComponent)
                  : ""}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* RIGHT: subcomponents table (hidden until first interaction) */}
      {hasPanel && (
        <div className="rounded-2xl bg-black/20 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="text-lg font-semibold">{propTitle(activeProp!)}</div>
              <div className="text-xs text-white/70">{propSubtitle(activeProp!)}</div>
            </div>
            <button
              onClick={() => {
                setActiveProp(null);
                setActiveComponent(null);
              }}
              className="text-xs px-2 py-1 rounded-md bg-white/15 hover:bg-white/25"
              title="Close"
            >
              × Close
            </button>
          </div>

          <div className="mt-2 space-y-2">
            {COMPONENTS[activeProp!].map((c, i) => {
              const raw = values[activeProp!][i] ?? 0;     // 0..10 (float)
              const shown = Math.round(raw);               // ⬅️ integer we display
              const selected = activeComponent === i;
              const widthPct = (shown / 10) * 100;         // ⬅️ bar fills fully at 10

              return (
                <button
                  key={i}
                  onClick={() => setActiveComponent(i)}
                  className="w-full text-left rounded-xl p-2 bg-white/5 hover:bg-white/10 focus:outline-none"
                  style={{
                    border: selected ? "1.5px solid rgba(255,255,255,0.9)" : "1px solid transparent",
                  }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/90" title={c.full}>
                      {c.short}
                    </span>
                    <span className="text-white/70 tabular-nums">{shown}</span>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden mt-1">
                    <motion.div
                      className="h-full"
                      style={{ background: (PALETTE as any)[activeProp!].base }}
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ type: "spring", stiffness: 150, damping: 24, mass: 0.5 }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* BOTTOM: property pills (selected pill = solid quadrant color) */}
      <div className={`md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3 ${hasPanel ? "mt-1" : "mt-4"}`}>
        {PROPERTIES.map((p) => {
          const selected = activeProp === p.key;
          return (
            <button
              key={p.key}
              onClick={() => {
                setActiveProp(p.key);
                setActiveComponent(null);
              }}
              className="text-left rounded-2xl p-3 border-2 transition"
              style={{
                borderColor: "white",
                background: selected ? (PALETTE as any)[p.key].base : "transparent",
                boxShadow: selected ? "0 0 0 2px rgba(255,255,255,0.95) inset" : undefined,
              }}
            >
              <div
                className="text-lg font-semibold"
                style={{ color: selected ? "#111" : (PALETTE as any)[p.key].base }}
              >
                {p.title}
              </div>
              <div className="text-sm" style={{ color: selected ? "#111" : "rgba(255,255,255,0.9)" }}>
                {p.subtitle}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
