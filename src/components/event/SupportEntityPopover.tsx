// src/components/event/SupportEntityPopover.tsx
// Popover that displays entity summary and expandable stance details
// Used when clicking on support bars (People/Challenger only)

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SupportProfile } from "../../data/supportProfiles";
import { useLang } from "../../i18n/lang";

type Props = {
  entityType: "people" | "challenger";
  entityName: string;
  supportProfile: SupportProfile;
  currentSupport: number;
  onClose: () => void;
};

// Map stance keys to i18n keys
const STANCE_KEYS = ["governance", "order", "economy", "justice", "culture", "foreign"] as const;

export default function SupportEntityPopover({
  entityType,
  entityName,
  supportProfile,
  currentSupport,
  onClose,
}: Props) {
  const lang = useLang();
  const [expanded, setExpanded] = useState(false);

  // Get i18n translations for stance labels
  const stanceLabels = {
    governance: lang("SUPPORT_ENTITY_STANCE_GOVERNANCE"),
    order: lang("SUPPORT_ENTITY_STANCE_ORDER"),
    economy: lang("SUPPORT_ENTITY_STANCE_ECONOMY"),
    justice: lang("SUPPORT_ENTITY_STANCE_JUSTICE"),
    culture: lang("SUPPORT_ENTITY_STANCE_CULTURE"),
    foreign: lang("SUPPORT_ENTITY_STANCE_FOREIGN"),
  };

  // Filter stances that exist in the profile
  const availableStances = STANCE_KEYS.filter(
    (key) => supportProfile.stances[key] !== undefined
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="
        absolute left-0 top-full mt-2
        w-80 rounded-xl
        border border-white/20
        bg-slate-900/95 backdrop-blur-sm
        p-4 text-white shadow-xl
        z-[100]
      "
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-white/50 mb-1">
            {entityType === "people"
              ? lang("SUPPORT_ENTITY_PEOPLE_TITLE")
              : lang("SUPPORT_ENTITY_CHALLENGER_TITLE")}
          </div>
          <div className="text-base font-semibold">{entityName}</div>
          <div className="text-sm text-white/60 mt-0.5">
            {lang("SUPPORT_ENTITY_CURRENT_SUPPORT")}: <span className="font-semibold text-white/80">{currentSupport}%</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-white/60 hover:text-white text-xl leading-none -mt-1 -mr-1 w-6 h-6 flex items-center justify-center"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Summary */}
      <div className="mb-3 pb-3 border-b border-white/10">
        <div className="text-xs uppercase tracking-wide text-white/40 mb-1.5">
          {lang("SUPPORT_ENTITY_SUMMARY")}
        </div>
        <p className="text-sm text-white/80 leading-relaxed">
          {supportProfile.summary}
        </p>
      </div>

      {/* Expandable Stances */}
      {availableStances.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="
              w-full flex items-center justify-between
              text-xs uppercase tracking-wide text-white/60
              hover:text-white/80 transition-colors
              mb-2
            "
          >
            <span>{expanded ? lang("SUPPORT_ENTITY_HIDE_STANCES") : lang("SUPPORT_ENTITY_SHOW_STANCES")}</span>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-2.5 pt-1">
                  {availableStances.map((stanceKey) => {
                    const stanceValue = supportProfile.stances[stanceKey];
                    if (!stanceValue) return null;

                    return (
                      <div key={stanceKey} className="text-sm">
                        <div className="text-xs font-semibold text-white/70 mb-0.5">
                          {stanceLabels[stanceKey]}
                        </div>
                        <div className="text-white/75 leading-snug">
                          {stanceValue}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
