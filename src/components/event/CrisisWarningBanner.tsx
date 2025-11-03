// src/components/event/CrisisWarningBanner.tsx
// Displays crisis warning when support tracks drop below 20%

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, XCircle } from "lucide-react";
import { useState, useEffect } from "react";

export type CrisisInfo = {
  entity: string; // "The People", "Military", "Personal Anchor", etc.
  currentSupport: number; // Current support level (0-100)
  type: "people" | "challenger" | "caring";
};

type Props = {
  crises: CrisisInfo[]; // Array of entities in crisis
  autoDismiss?: boolean; // Auto-dismiss after 5 seconds (default: true)
  onDismiss?: () => void; // Optional callback when manually dismissed
};

export default function CrisisWarningBanner({
  crises,
  autoDismiss = true,
  onDismiss
}: Props) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissed state when crises change
  useEffect(() => {
    setIsDismissed(false);
  }, [crises]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (autoDismiss && crises.length > 0 && !isDismissed) {
      const timer = setTimeout(() => {
        setIsDismissed(true);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [autoDismiss, crises.length, isDismissed]);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Don't show if no crises or manually dismissed
  if (crises.length === 0 || isDismissed) {
    return null;
  }

  // Determine severity
  const severity = crises.length === 1 ? "warning" : "critical";

  // Severity-based styling
  const severityStyles = {
    warning: {
      bg: "bg-yellow-500/20",
      border: "border-yellow-500/60",
      text: "text-yellow-200",
      icon: "text-yellow-300",
    },
    critical: {
      bg: "bg-red-500/25",
      border: "border-red-500/70",
      text: "text-red-100",
      icon: "text-red-300",
    },
  };

  const styles = severityStyles[severity];

  // Build message
  const buildMessage = (): string => {
    if (crises.length === 1) {
      return `⚠️ WARNING: ${crises[0].entity} support has fallen to ${crises[0].currentSupport}%`;
    } else if (crises.length === 2) {
      return `🚨 CRITICAL: ${crises[0].entity} AND ${crises[1].entity} support dangerously low`;
    } else {
      // This shouldn't happen (downfall should trigger), but handle it anyway
      return `🚨 TERMINAL CRISIS: All support tracks have collapsed`;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={[
          "w-full px-4 py-3 rounded-xl border-2",
          "backdrop-blur-sm",
          "flex items-center justify-between gap-3",
          styles.bg,
          styles.border,
        ].join(" ")}
      >
        {/* Left: Icon + Message */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <AlertTriangle
            className={`w-6 h-6 shrink-0 ${styles.icon}`}
            strokeWidth={2.5}
          />
          <p className={`text-sm font-semibold ${styles.text} truncate`}>
            {buildMessage()}
          </p>
        </div>

        {/* Right: Dismiss button */}
        <button
          onClick={handleDismiss}
          className={`shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors ${styles.icon}`}
          aria-label="Dismiss warning"
        >
          <XCircle className="w-5 h-5" strokeWidth={2} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
