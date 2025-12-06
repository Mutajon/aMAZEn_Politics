// src/components/event/PlayerCardModal.tsx
// Modal displaying player character information and compass values
//
// Features:
// - Shows player avatar, name, role, political system in header
// - Displays top 2 values for each compass dimension (what/whence/how/whither)
// - Click outside or X button to close
// - Animated with Framer Motion
// - Reads live data from stores (compass values update in real-time)
//
// Connected to:
// - src/components/event/MirrorWithAvatar.tsx: Opened by clicking player avatar
// - src/lib/compassHelpers.ts: Extracts top compass values
// - src/data/compass-data.ts: Compass component definitions

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User } from "lucide-react";
import { PROPERTIES, PALETTE, COMPONENTS, type PropKey } from "../../data/compass-data";
import { getAllTopCompassValues, type CompassComponentValue } from "../../lib/compassHelpers";
import { useRoleStore } from "../../store/roleStore";
import { useCompassStore } from "../../store/compassStore";
import { ValueExplanationModal } from "./ValueExplanationModal";
import { useLang } from "../../i18n/lang";
import { translateCompassValue } from "../../i18n/translateGameData";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  avatarSrc?: string | null;
  // Tutorial props
  tutorialMode?: boolean;
  onTutorialValueClick?: (value: { short: string; full: string; dimension: PropKey; index: number }) => void;
  tutorialValueRef?: (element: HTMLElement | null) => void;
};

interface SelectedValueForExplanation {
  short: string;
  full: string;
  dimension: PropKey;
}

/**
 * Renders a single compass dimension box showing top values
 */
function CompassBox({
  title,
  subtitle,
  color,
  topValues,
  propKey: _propKey,
  tutorialMode = false,
  highlightedIndex = -1,
  onValueClick,
  valueRef,
}: {
  title: string;
  subtitle: string;
  color: string;
  topValues: CompassComponentValue[];
  propKey: PropKey;
  tutorialMode?: boolean;
  highlightedIndex?: number;
  onValueClick?: (value: CompassComponentValue, idx: number) => void;
  valueRef?: (element: HTMLElement | null) => void;
}) {
  const lang = useLang();
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
          <p className="text-sm text-white/50 italic">{lang("COMPASS_VALUES_YET_TO_BE_DETERMINED")}</p>
        ) : (
          topValues.map((component, idx) => {
            const isHighlighted = tutorialMode && highlightedIndex === idx;

            return (
              <button
                key={idx}
                ref={isHighlighted && valueRef ? valueRef : undefined}
                onClick={() => onValueClick && onValueClick(component, idx)}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 cursor-pointer hover:opacity-80 transition-opacity ${
                  isHighlighted
                    ? 'ring-2 ring-yellow-400 animate-pulse hover:ring-yellow-300 transition-all transform scale-105'
                    : ''
                }`}
                style={{ backgroundColor: `${color}10` }}
              >
                <span className="text-sm text-white/90 font-medium">
                  {translateCompassValue(component.short, lang)}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div
                    className="h-2 rounded-full min-w-[40px] max-w-[80px]"
                    style={{
                      backgroundColor: `${color}40`,
                      width: `${Math.max(40, component.value * 8)}px`,
                    }}
                  />
                  <span className="text-xs text-white/60 w-4 text-right">
                    {component.value}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function PlayerCardModal({
  isOpen,
  onClose,
  avatarSrc,
  tutorialMode = false,
  onTutorialValueClick,
  tutorialValueRef,
}: Props) {
  // Avatar error handling
  const [imgError, setImgError] = useState(false);

  // Value explanation modal (permanent feature - works outside tutorial too)
  const [selectedValueForExplanation, setSelectedValueForExplanation] = useState<SelectedValueForExplanation | null>(null);

  // Read live data from stores
  const lang = useLang();
  const character = useRoleStore((s) => s.character);
  const analysis = useRoleStore((s) => s.analysis);
  const roleTitle = useRoleStore((s) => s.roleTitle);
  const roleYear = useRoleStore((s) => s.roleYear);
  const roleDescription = useRoleStore((s) => s.roleDescription);
  const compassValues = useCompassStore((s) => s.values); // Live compass values

  // Tutorial: select a random value to highlight
  const [tutorialTarget, setTutorialTarget] = useState<{ propKey: PropKey; index: number } | null>(null);

  useEffect(() => {
    if (tutorialMode && isOpen) {
      const topValues = getAllTopCompassValues(compassValues, 2);

      // Collect all available values from all dimensions
      const availableValues: { propKey: PropKey; index: number }[] = [];
      PROPERTIES.forEach((prop) => {
        const values = topValues[prop.key];
        values.forEach((_, idx) => {
          availableValues.push({ propKey: prop.key, index: idx });
        });
      });

      // Pick a random value
      if (availableValues.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableValues.length);
        const selected = availableValues[randomIndex];
        setTutorialTarget(selected);
        console.log('[PlayerCardModal] Tutorial target selected:', selected);
      }
    } else {
      setTutorialTarget(null);
    }
  }, [tutorialMode, isOpen]);

  if (!isOpen) return null;

  // Compute derived values
  const playerName = character?.name || lang("PLAYER_CARD_UNKNOWN_LEADER");
  const systemName = analysis?.systemName || lang("PLAYER_CARD_UNKNOWN_SYSTEM");
  const topValues = getAllTopCompassValues(compassValues, 2);

  // Handle value click (works in both tutorial and normal mode)
  const handleValueClick = (value: CompassComponentValue, propKey: PropKey, idx: number) => {
    // Get the full explanation from COMPONENTS
    const componentData = COMPONENTS[propKey].find((c) => c.short === value.short);
    if (componentData) {
      // Always show explanation modal (permanent feature)
      setSelectedValueForExplanation({
        short: componentData.short,
        full: componentData.full,
        dimension: propKey,
      });

      // Also trigger tutorial callback if in tutorial mode
      if (tutorialMode && onTutorialValueClick) {
        onTutorialValueClick({
          short: componentData.short,
          full: componentData.full,
          dimension: propKey,
          index: idx,
        });
      }
    }
  };

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
              className="absolute top-4 right-4 p-2 rounded-lg transition-colors z-20 hover:bg-white/10"
              aria-label={lang("CLOSE")}
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
                <h2 className="text-lg font-bold text-white/80 mb-1">{lang("PLAYER_CARD_WHO_ARE_YOU")}</h2>
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
                {lang("YOUR_CURRENT_MAIN_VALUES")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PROPERTIES.map((prop) => {
                  const dimensionName = {
                    what: lang("COMPASS_WHAT"),
                    whence: lang("COMPASS_WHENCE"),
                    how: lang("COMPASS_HOW"),
                    whither: lang("COMPASS_WHITHER")
                  }[prop.key];

                  const dimensionSubtitle = {
                    what: lang("COMPASS_WHAT_SUBTITLE"),
                    whence: lang("COMPASS_WHENCE_SUBTITLE"),
                    how: lang("COMPASS_HOW_SUBTITLE"),
                    whither: lang("COMPASS_WHITHER_SUBTITLE")
                  }[prop.key];

                  return (
                    <CompassBox
                      key={prop.key}
                      propKey={prop.key}
                      title={dimensionName}
                      subtitle={dimensionSubtitle}
                      color={PALETTE[prop.key].base}
                    topValues={topValues[prop.key]}
                    tutorialMode={tutorialMode}
                    highlightedIndex={
                      tutorialMode && tutorialTarget?.propKey === prop.key
                        ? tutorialTarget.index
                        : -1
                    }
                    onValueClick={(value, idx) => handleValueClick(value, prop.key, idx)}
                    valueRef={
                      tutorialMode && tutorialTarget?.propKey === prop.key
                        ? tutorialValueRef
                        : undefined
                    }
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Value Explanation Modal - Permanent feature (works outside tutorial) */}
      {selectedValueForExplanation && (
        <ValueExplanationModal
          value={selectedValueForExplanation}
          onClose={() => {
            setSelectedValueForExplanation(null);
            // If in tutorial mode, the tutorial callback was already triggered
          }}
        />
      )}
    </AnimatePresence>
  );
}
