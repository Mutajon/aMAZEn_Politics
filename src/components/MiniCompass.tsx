// src/components/MiniCompass.tsx
import { motion } from "framer-motion";
import PetalRing from "../components/PetalRing";
import type { PropKey } from "../data/compass-data";

export default function MiniCompass({
  size = 360,
  innerRadius,
  values,
  lengthScale = 0.45,
  rotate = false,
  rotationSpeedSec = 60, // one full revolution per 60s by default
}: {
  size?: number;
  innerRadius: number;
  values: Record<PropKey, number[]>;
  lengthScale?: number;
  rotate?: boolean;
  rotationSpeedSec?: number;
}) {
  const ring = (
    <PetalRing
      size={size}
      innerRadius={innerRadius}
      values={values}
      lengthScale={lengthScale}
      /* ignore PetalRing's own rotate flag; we rotate at this wrapper level */
      rotate={false}
    />
  );

  if (!rotate) return ring;

  return (
    <motion.div
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{ duration: rotationSpeedSec, repeat: Infinity, ease: "linear" }}
    >
      {ring}
    </motion.div>
  );
}
