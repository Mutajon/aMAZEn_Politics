/**
 * E12AnalysisModal.tsx
 *
 * Displays detailed E-12 (Exception-12) political analysis in a modal overlay.
 * Shows tier breakdown, decisive seats, stop rules, and historical grounding.
 *
 * Used by: PowerDistributionContent.tsx
 */

import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Info } from "lucide-react";

interface E12AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemName: string;
  e12Data: {
    tierI: string[];
    tierII: string[];
    tierIII: string[];
    stopA: boolean;
    stopB: boolean;
    decisive: string[];
  };
  groundingData?: {
    settingType: "real" | "fictional" | "unclear";
    era: string;
  };
}

export default function E12AnalysisModal({
  isOpen,
  onClose,
  systemName,
  e12Data,
  groundingData,
}: E12AnalysisModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />

          {/* Modal Content */}
          <motion.div
            className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-purple-400/20 bg-gradient-to-b from-[#1b1f3b] to-[#261c4a] p-6 shadow-2xl"
            initial={{ scale: 0.94, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: 6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="e12-title"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 id="e12-title" className="text-2xl font-extrabold bg-gradient-to-r from-purple-200 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                  Political Analysis (E-12)
                </h2>
                <p className="text-sm text-white/60 mt-1">{systemName}</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl p-2 bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grounding Context */}
            {groundingData && (
              <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-cyan-300" />
                  <h3 className="font-semibold text-white/90">Historical Context</h3>
                </div>
                <div className="text-sm space-y-1">
                  <p className="text-white/70">
                    <span className="text-white/90 font-medium">Type:</span>{" "}
                    {groundingData.settingType === "real" ? "Historical/Real" :
                     groundingData.settingType === "fictional" ? "Fictional" : "Unclear"}
                  </p>
                  {groundingData.era && (
                    <p className="text-white/70">
                      <span className="text-white/90 font-medium">Era:</span> {groundingData.era}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Decisive Seats */}
            {e12Data.decisive && e12Data.decisive.length > 0 && (
              <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-400/20">
                <h3 className="font-semibold text-amber-200 mb-2">🎯 Decisive Seats</h3>
                <p className="text-sm text-white/70 mb-2">
                  These seats hold the power to decide exceptions in practice:
                </p>
                <ul className="space-y-1">
                  {e12Data.decisive.map((seat, idx) => (
                    <li key={idx} className="text-white/85 text-sm flex items-center gap-2">
                      <span className="text-amber-300">•</span>
                      <span className="font-medium">{seat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Stop Rules */}
            {(e12Data.stopA || e12Data.stopB) && (
              <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-400/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-300" />
                  <h3 className="font-semibold text-red-200">Stop Rules Triggered</h3>
                </div>
                <ul className="space-y-2 text-sm">
                  {e12Data.stopA && (
                    <li className="text-white/85">
                      <span className="font-semibold text-red-300">Stop-rule A:</span>{" "}
                      Coercive force launches/escalates war at will without effective checks → Stratocracy / Military Autocratizing
                    </li>
                  )}
                  {e12Data.stopB && (
                    <li className="text-white/85">
                      <span className="font-semibold text-red-300">Stop-rule B:</span>{" "}
                      Executive routinely authors exceptions across multiple domains and neutralizes erasers → Autocratizing (Executive)
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Tier Breakdown */}
            <div className="space-y-3">
              <h3 className="font-semibold text-white/90 text-lg">Exception-12 Domains</h3>

              {/* Tier I: Existential */}
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-400/20">
                <h4 className="font-semibold text-purple-200 mb-2">Tier I: Existential</h4>
                <p className="text-xs text-white/60 mb-2">
                  Control over these domains typically determines the polity type
                </p>
                <div className="flex flex-wrap gap-2">
                  {e12Data.tierI.map((domain, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded bg-purple-500/20 border border-purple-400/30 text-purple-100 text-sm"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tier II: Constitutive */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-400/20">
                <h4 className="font-semibold text-blue-200 mb-2">Tier II: Constitutive</h4>
                <p className="text-xs text-white/60 mb-2">
                  Core domains that shape the political order
                </p>
                <div className="flex flex-wrap gap-2">
                  {e12Data.tierII.map((domain, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded bg-blue-500/20 border border-blue-400/30 text-blue-100 text-sm"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tier III: Contextual */}
              <div className="p-4 rounded-xl bg-gray-500/10 border border-gray-400/20">
                <h4 className="font-semibold text-gray-200 mb-2">Tier III: Contextual</h4>
                <p className="text-xs text-white/60 mb-2">
                  Policy areas that refine the polity subtype
                </p>
                <div className="flex flex-wrap gap-2">
                  {e12Data.tierIII.map((domain, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded bg-gray-500/20 border border-gray-400/30 text-gray-100 text-sm"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Info */}
            <div className="mt-6 pt-4 border-t border-white/10">
              <p className="text-xs text-white/50 text-center">
                The E-12 framework analyzes political systems by identifying who decides exceptions across 12 critical domains.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
