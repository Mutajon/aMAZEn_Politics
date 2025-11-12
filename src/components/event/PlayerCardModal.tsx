// src/components/event/PlayerCardModal.tsx
// Modal displaying player character information, compass values, and corruption level
//
// Features:
// - Shows player avatar, name, role, political system in header
// - Displays top 2 values for each compass dimension (what/whence/how/whither)
// - Shows current corruption level with flavor text
// - Click outside or X button to close
// - Animated with Framer Motion
// - Reads live data from stores (compass values update in real-time)
//
// Connected to:
// - src/components/event/MirrorWithAvatar.tsx: Opened by clicking player avatar
// - src/lib/compassHelpers.ts: Extracts top compass values
// - src/lib/corruptionLevels.ts: Maps corruption scores to tiers
// - src/data/compass-data.ts: Compass component definitions

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User } from "lucide-react";
import { PROPERTIES, PALETTE } from "../../data/compass-data";
import { getAllTopCompassValues, type CompassComponentValue } from "../../lib/compassHelpers";
import { getCorruptionInfo } from "../../lib/corruptionLevels";
import { useRoleStore } from "../../store/roleStore";
import { useCompassStore } from "../../store/compassStore";
import { useDilemmaStore } from "../../store/dilemmaStore";
import { normalizeCorruptionLevel } from "../../lib/scoring";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  avatarSrc?: string | null;
};

/**
 * Renders a single compass dimension box showing top values
 */
function CompassBox({
  title,
  subtitle,
  color,
  topValues,
}: {
  title: string;
  subtitle: string;
  color: string;
  topValues: CompassComponentValue[];
}) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}30`,
      }}
    >
      {/* Header */}
      <div className="mb-3">
        <h3 className="font-bold text-white" style={{ color }}>
          {title}
        </h3>
        <p className="text-xs text-white/60">{subtitle}</p>
      </div>

      {/* Values */}
      <div className="space-y-2">
        {topValues.length === 0 ? (
          <p className="text-sm text-white/50 italic">Yet to be determined...</p>
        ) : (
          topValues.map((component, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
              style={{ backgroundColor: `${color}10` }}
            >
              <span className="text-sm text-white/90 font-medium">
                {component.short}
              </span>
              <div
                className="h-2 rounded-full min-w-[40px] max-w-[80px] flex-shrink-0"
                style={{
                  backgroundColor: `${color}40`,
                  width: `${Math.max(40, component.value * 8)}px`,
                }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function PlayerCardModal({
  isOpen,
  onClose,
  avatarSrc,
}: Props) {
  // Avatar error handling
  const [imgError, setImgError] = useState(false);

  // Read live data from stores
  const character = useRoleStore((s) => s.character);
  const analysis = useRoleStore((s) => s.analysis);
  const roleTitle = useRoleStore((s) => s.roleTitle);
  const roleYear = useRoleStore((s) => s.roleYear);
  const roleDescription = useRoleStore((s) => s.roleDescription);
  const compassValues = useCompassStore((s) => s.values); // Live compass values
  const rawCorruptionLevel = useDilemmaStore((s) => s.corruptionLevel);

  if (!isOpen) return null;

  // Compute derived values
  const playerName = character?.name || "Unknown Leader";
  const systemName = analysis?.systemName || "Unknown System";
  const normalizedCorruption = normalizeCorruptionLevel(rawCorruptionLevel);
  const topValues = getAllTopCompassValues(compassValues, 2);
  const corruptionInfo = getCorruptionInfo(normalizedCorruption);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/20 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-b from-slate-900/95 to-transparent backdrop-blur-sm px-6 pt-6 pb-4 border-b border-white/10">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors z-20"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white/70" />
            </button>

            {/* Header Layout: Avatar (left) + Info (right) */}
            <div className="flex items-start gap-4 pr-12">
              {/* Avatar */}
              <div
                className="shrink-0 rounded-xl overflow-hidden ring-2 ring-white/20 bg-white/5"
                style={{ width: 100, height: 100, minWidth: 100 }}
              >
                {avatarSrc && !imgError ? (
                  <img
                    src={avatarSrc}
                    alt={playerName}
                    className="w-full h-full object-cover"
                    width={100}
                    height={100}
                    loading="lazy"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-8 h-8 text-white/80" strokeWidth={2.2} />
                  </div>
                )}
              </div>

              {/* Info Stack */}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white/80 mb-1">Who are you?</h2>
                <p className="text-2xl font-bold text-white mb-1 truncate">
                  {playerName}
                </p>
                <p className="text-sm text-white/60 mb-0.5 truncate">
                  {systemName}
                </p>
                {roleDescription && (
                  <p className="text-base text-white/80 truncate">
                    {roleDescription}
                  </p>
                )}
                {roleTitle && roleYear && (
                  <p className="text-sm text-white/50 mt-1 truncate">
                    {roleTitle.split(' — ')[0]}, {roleYear}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-6 pt-4 space-y-6">
            {/* Compass Values Grid */}
            <div>
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
                Your Main Values
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PROPERTIES.map((prop) => (
                  <CompassBox
                    key={prop.key}
                    title={prop.title}
                    subtitle={prop.subtitle}
                    color={PALETTE[prop.key].base}
                    topValues={topValues[prop.key]}
                  />
                ))}
              </div>
            </div>

            {/* Corruption Section */}
            <div>
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
                Corruption Level
              </h3>
              <div
                className="rounded-xl p-5 border-2"
                style={{
                  backgroundColor: `${corruptionInfo.color}10`,
                  borderColor: `${corruptionInfo.color}40`,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: corruptionInfo.color }}
                    />
                    <span
                      className="text-lg font-bold"
                      style={{ color: corruptionInfo.color }}
                    >
                      {corruptionInfo.label}
                    </span>
                  </div>
                  <div className="text-sm text-white/60">
                    {normalizedCorruption.toFixed(1)} / 10
                  </div>
                </div>
                <p className="text-white/80 italic leading-relaxed">
                  {corruptionInfo.flavor}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
