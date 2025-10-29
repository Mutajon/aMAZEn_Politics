// src/components/DataCollectionBanner.tsx
// Consent banner for data collection
//
// Displays a simple banner asking for user consent to collect anonymous gameplay data
// Only shows if backend has ENABLE_DATA_COLLECTION=true and user hasn't consented yet

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLoggingStore } from '../store/loggingStore';
import { useSettingsStore } from '../store/settingsStore';
import { loggingService } from '../lib/loggingService';

export default function DataCollectionBanner() {
  const consented = useLoggingStore((s) => s.consented);
  const setConsented = useLoggingStore((s) => s.setConsented);

  const [show, setShow] = useState(false);
  const [backendEnabled, setBackendEnabled] = useState(false);

  // Check if backend has data collection enabled
  useEffect(() => {
    async function checkBackend() {
      try {
        const response = await fetch('/api/log/status');
        const data = await response.json();

        if (data.enabled && !consented) {
          setBackendEnabled(true);
          setShow(true);
        }
      } catch (error) {
        console.error('[DataCollectionBanner] Failed to check backend status:', error);
      }
    }

    checkBackend();
  }, [consented]);

  // Handle accept button
  const handleAccept = () => {
    setConsented(true);
    useSettingsStore.getState().setDataCollectionEnabled(true);
    setShow(false);

    // Initialize logging service
    loggingService.init();

    console.log('[DataCollectionBanner] User consented to data collection');
  };

  // Handle decline button
  const handleDecline = () => {
    setConsented(true);  // Mark as consented but keep disabled
    useSettingsStore.getState().setDataCollectionEnabled(false);
    setShow(false);

    console.log('[DataCollectionBanner] User declined data collection');
  };

  if (!show || !backendEnabled) {
    return null;
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
        >
          <div className="bg-gradient-to-r from-blue-900/95 to-purple-900/95 backdrop-blur-sm rounded-lg border border-blue-400/30 shadow-2xl p-6">
            <div className="flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="text-3xl">📊</div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">
                    Help Improve This Game
                  </h3>
                  <p className="text-sm text-gray-200 leading-relaxed">
                    This game is being used for research purposes. We'd like to collect <strong>anonymous gameplay data</strong> to
                    understand how players make decisions. This includes button clicks, choices, and game outcomes.
                  </p>
                  <p className="text-xs text-gray-300 mt-2">
                    <strong>Privacy:</strong> No personal information is collected. All data is anonymized with a random ID.
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleDecline}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700/50 hover:bg-gray-700 rounded-md transition-colors"
                >
                  No Thanks
                </button>
                <button
                  onClick={handleAccept}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-lg"
                >
                  Accept & Continue
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
