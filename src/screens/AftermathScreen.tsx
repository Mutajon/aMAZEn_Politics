// src/screens/AftermathScreen.tsx
// Aftermath screen showing game epilogue after final day with sequential presentation
//
// Shows (in sequence):
// - Typewriter intro
// - Remembrance section with narration
// - Decision breakdown (one by one)
// - Final ratings pills
// - Reflection (mirror-styled)
// - Tombstone with haiku
// - "Reveal Final Score" button
//
// Connects to:
// - src/hooks/useAftermathData.ts: fetches data from API
// - src/hooks/useAftermathSequence.ts: orchestrates presentation
// - src/components/aftermath/AftermathContent.tsx: main content renderer
// - server/index.mjs: POST /api/aftermath

import { useEffect, useState, useMemo } from "react";
import { useAftermathData } from "../hooks/useAftermathData";
import { useRoleStore } from "../store/roleStore";
import { useLoadingProgress } from "../hooks/useLoadingProgress";
import CollectorLoadingOverlay from "../components/event/CollectorLoadingOverlay";
import { bgStyle } from "../lib/ui";
import type { PushFn } from "../lib/router";
import { useMirrorTop3 } from "../hooks/useMirrorTop3";
import {
  saveAftermathReturnRoute,
  loadAftermathScreenSnapshot,
  saveAftermathScreenSnapshot,
  clearAftermathScreenSnapshot
} from "../lib/eventScreenSnapshot";
import { useAftermathSequence } from "../hooks/useAftermathSequence";
import AftermathContent from "../components/aftermath/AftermathContent";

type Props = {
  push: PushFn;
};

export default function AftermathScreen({ push }: Props) {
  const { loading, error, data, fetchAftermathData, restoreData } = useAftermathData();
  const { character } = useRoleStore();
  const { progress, start: startProgress, notifyReady } = useLoadingProgress();
  const top3ByDimension = useMirrorTop3();
  const [restoredFromSnapshot, setRestoredFromSnapshot] = useState(false);

  // Detect if this is first visit (no snapshot = first visit, snapshot exists = return visit)
  const isFirstVisit = useMemo(() => {
    const snapshot = loadAftermathScreenSnapshot();
    return !snapshot;
  }, []);

  console.log('[AftermathScreen] isFirstVisit:', isFirstVisit);

  // Initialize sequence orchestration
  const sequence = useAftermathSequence(data, isFirstVisit);

  // ========================================================================
  // EFFECT 0A: RESTORATION FROM SNAPSHOT (on mount)
  // ========================================================================
  useEffect(() => {
    const snapshot = loadAftermathScreenSnapshot();
    if (snapshot) {
      console.log('[AftermathScreen] 🔄 Restoring from snapshot');
      restoreData(snapshot.data);
      setRestoredFromSnapshot(true);
      // Clear snapshot after successful restoration
      clearAftermathScreenSnapshot();
    }
  }, [restoreData]);

  // Fetch data on mount (only if not restored)
  useEffect(() => {
    if (!restoredFromSnapshot && !data) {
      startProgress(); // Start progress animation
      fetchAftermathData();
    }
  }, [fetchAftermathData, startProgress, restoredFromSnapshot, data]);

  // Notify progress when data ready (only if not restored)
  useEffect(() => {
    if (data && !restoredFromSnapshot) {
      notifyReady();
    }
  }, [data, notifyReady, restoredFromSnapshot]);

  // ========================================================================
  // RENDER: Loading State
  // ========================================================================
  if (loading && !data && !restoredFromSnapshot) {
    return (
      <CollectorLoadingOverlay
        progress={progress}
        message="Aftermath pending..."
      />
    );
  }

  // ========================================================================
  // RENDER: Error State
  // ========================================================================
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={bgStyle}>
        <div className="max-w-md w-full bg-red-900/20 border border-red-500/50 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-400 mb-3">Failed to Load Aftermath</h2>
          <p className="text-white/80 mb-4">{error}</p>
          <button
            onClick={() => {
              startProgress();
              fetchAftermathData();
            }}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ========================================================================
  // RENDER: Main Content
  // ========================================================================
  if (!data) {
    return null; // Should not happen
  }

  return (
    <div className="min-h-screen px-5 py-8" style={bgStyle}>
      <AftermathContent
        data={data}
        avatarUrl={character?.avatarUrl}
        top3ByDimension={top3ByDimension}
        counter={sequence.counter}
        steps={sequence.steps}
        isSkipped={sequence.isSkipped}
        hasReached={sequence.hasReached}
        isAtStep={sequence.isAtStep}
        advanceToNext={sequence.advanceToNext}
        skipToEnd={sequence.skipToEnd}
        showSkipButton={sequence.showSkipButton}
        registerRef={sequence.registerRef}
        onExploreClick={() => {
          // Save snapshot before navigating
          if (data) {
            saveAftermathScreenSnapshot({
              data,
              timestamp: Date.now()
            });
          }
          // Save return route
          saveAftermathReturnRoute('/aftermath');
          push('/mirror');
        }}
        onRevealScoreClick={() => push("/final-score")}
      />
    </div>
  );
}
