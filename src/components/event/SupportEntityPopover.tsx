// src/components/event/SupportEntityPopover.tsx
// Popover that displays entity summary and expandable stance details
// Used when clicking on support bars (People/Challenger only)

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, X, Users, Swords } from "lucide-react";
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

  // Determine icon and color based on entity type
  const Icon = entityType === "people" ? Users : Swords;
  const iconColorClass = entityType === "people" ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
      {/* Backdrop - click outside to close */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Modal content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-lg mx-4 max-h-[85vh] bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/20 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-white/10">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>

          {/* Icon and Title */}
          <div className="flex items-start gap-4 pr-12">
            <div className={`rounded-2xl p-4 ${iconColorClass}`}>
              <Icon className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-white mb-1">
                {entityName}
              </h2>
              <p className="text-sm text-white/50">
                {entityType === "people"
                  ? lang("SUPPORT_ENTITY_PEOPLE_TITLE")
                  : lang("SUPPORT_ENTITY_CHALLENGER_TITLE")}
              </p>
              <div className="text-sm text-white/60 mt-1">
                {lang("SUPPORT_ENTITY_CURRENT_SUPPORT")}: <span className="font-semibold text-white/80">{currentSupport}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {/* Summary */}
            <div>
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
                {lang("SUPPORT_ENTITY_SUMMARY")}
              </h3>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white/90 leading-relaxed">
                  {supportProfile.summary}
                </p>
              </div>
            </div>

            {/* Expandable Stances */}
            {availableStances.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="
                    w-full flex items-center justify-between
                    text-sm font-semibold text-white/70 uppercase tracking-wider
                    hover:text-white/90 transition-colors
                    mb-3
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
                      <div className="space-y-3">
                        {availableStances.map((stanceKey) => {
                          const stanceValue = supportProfile.stances[stanceKey];
                          if (!stanceValue) return null;

                          return (
                            <div key={stanceKey} className="bg-white/5 rounded-xl p-4 border border-white/10">
                              <div className="text-sm font-semibold text-white/80 mb-2">
                                {stanceLabels[stanceKey]}
                              </div>
                              <div className="text-white/75 leading-relaxed">
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
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
