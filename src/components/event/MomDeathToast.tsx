// MomDeathToast.tsx - Shows a brief toast notification when mom dies
// Listens for the 'mom-died' CustomEvent dispatched from useEventDataCollector

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skull } from "lucide-react";
import { lang } from "../../i18n/lang";

export default function MomDeathToast() {
  const [visible, setVisible] = useState(false);
  const [deathMessage, setDeathMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleMomDied = (event: Event) => {
      const customEvent = event as CustomEvent<{ shortLine?: string }>;
      console.log("[MomDeathToast] 💀 Mom died event received:", customEvent.detail);

      setDeathMessage(customEvent.detail?.shortLine || null);
      setVisible(true);

      // Auto-dismiss after 4 seconds
      setTimeout(() => {
        setVisible(false);
      }, 4000);
    };

    window.addEventListener("mom-died", handleMomDied);
    return () => {
      window.removeEventListener("mom-died", handleMomDied);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed top-20 left-1/2 z-[100] -translate-x-1/2"
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="bg-gray-900/95 border border-gray-600/50 rounded-xl px-5 py-4 shadow-2xl backdrop-blur-sm max-w-[90vw] md:max-w-md">
            <div className="flex items-center gap-3">
              {/* Skull icon */}
              <div className="shrink-0 p-2 bg-gray-700/50 rounded-lg">
                <Skull className="w-6 h-6 text-gray-400" strokeWidth={2} />
              </div>

              {/* Message */}
              <div>
                <div className="text-gray-200 font-semibold text-base">
                  {lang("SUPPORT_MOM_DIED")}
                </div>
                {deathMessage && (
                  <div className="text-gray-400 text-sm mt-1 italic">
                    "{deathMessage}"
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
