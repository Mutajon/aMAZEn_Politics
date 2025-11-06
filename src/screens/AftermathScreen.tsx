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

import { useEffect, useMemo, useState } from "react";
import { useAftermathData } from "../hooks/useAftermathData";
import { useRoleStore } from "../store/roleStore";
import { useLoadingProgress } from "../hooks/useLoadingProgress";
import CollectorLoadingOverlay from "../components/event/CollectorLoadingOverlay";
import { bgStyleWithRoleImage } from "../lib/ui";
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
import { useLang } from "../i18n/lang";
import { useLoggingStore } from "../store/loggingStore";
import { EXPERIMENT_PREDEFINED_ROLE_KEYS } from "../data/predefinedRoles";
import { useSessionLogger } from "../hooks/useSessionLogger";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useLogger } from "../hooks/useLogger";

type Props = {
  push: PushFn;
};

const EXPERIMENT_ROLE_KEY_SET = new Set(EXPERIMENT_PREDEFINED_ROLE_KEYS);

export default function AftermathScreen({ push }: Props) {
  const lang = useLang();
  const { loading, error, data, fetchAftermathData, restoreData } = useAftermathData();
  const { character, roleBackgroundImage } = useRoleStore();
  const { progress, start: startProgress, notifyReady } = useLoadingProgress();
  const top3ByDimension = useMirrorTop3();
  const experimentActiveRoleKey = useLoggingStore((s) => s.experimentProgress.activeRoleKey);
  const experimentCompletedRoles = useLoggingStore((s) => s.experimentProgress.completedRoles);
  const markExperimentRoleCompleted = useLoggingStore((s) => s.markExperimentRoleCompleted);
  const roleBgStyle = useMemo(() => bgStyleWithRoleImage(roleBackgroundImage), [roleBackgroundImage]);

  // Logging hooks for session summary
  const sessionLogger = useSessionLogger();
  const logger = useLogger();
  const inquiryHistory = useDilemmaStore((s) => s.inquiryHistory);
  const customActionCount = useDilemmaStore((s) => s.customActionCount);
  const selectedRole = useRoleStore((s) => s.selectedRole);
  const day = useDilemmaStore((s) => s.day);
  const score = useDilemmaStore((s) => s.score);

  // ========================================================================
  // SNAPSHOT RESTORATION (synchronous, before first render)
  // ========================================================================
  // Check for snapshot and restore immediately to prevent race condition
  // with fetch effect. Must happen synchronously before any effects run.
  const [initializedFromSnapshot] = useState(() => {
    const snapshot = loadAftermathScreenSnapshot();
    if (snapshot) {
      console.log('[AftermathScreen] 🔄 Restoring from snapshot');
      restoreData(snapshot.data);
      clearAftermathScreenSnapshot();
      return true;
    }
    return false;
  });

  // Detect if this is first visit (no snapshot = first visit, snapshot exists = return visit)
  const isFirstVisit = !initializedFromSnapshot;

  console.log('[AftermathScreen] isFirstVisit:', isFirstVisit, 'initializedFromSnapshot:', initializedFromSnapshot);

  // Initialize sequence orchestration
  const sequence = useAftermathSequence(data, isFirstVisit);

  // ========================================================================
  // EFFECT: FETCH DATA (only if not restored from snapshot)
  // ========================================================================
  useEffect(() => {
    if (!initializedFromSnapshot && !data && !loading) {
      console.log('[AftermathScreen] Fetching aftermath data...');
      startProgress(); // Start progress animation
      fetchAftermathData();
    }
  }, [initializedFromSnapshot, data, loading, fetchAftermathData, startProgress]);

  // ========================================================================
  // EFFECT: NOTIFY PROGRESS (only if not restored from snapshot)
  // ========================================================================
  useEffect(() => {
    if (data && !initializedFromSnapshot) {
      notifyReady();
    }
  }, [data, notifyReady, initializedFromSnapshot]);

  useEffect(() => {
    if (!data) return;
    if (!experimentActiveRoleKey) return;
    if (!EXPERIMENT_ROLE_KEY_SET.has(experimentActiveRoleKey)) return;
    if (experimentCompletedRoles?.[experimentActiveRoleKey]) return;

    markExperimentRoleCompleted(experimentActiveRoleKey);
  }, [
    data,
    experimentActiveRoleKey,
    experimentCompletedRoles,
    markExperimentRoleCompleted
  ]);

  // ========================================================================
  // EFFECT: LOG SESSION SUMMARY (only on first visit, not on restoration)
  // ========================================================================
  useEffect(() => {
    // Only log on first visit (when data first loads, not when restored from snapshot)
    if (!data || !isFirstVisit) return;

    // Calculate total inquiries across all days
    let totalInquiries = 0;
    inquiryHistory.forEach((dayInquiries) => {
      totalInquiries += dayInquiries.length;
    });

    // Calculate session duration (if available)
    const sessionDuration = sessionLogger.getSessionDuration();

    // Log session reached aftermath
    logger.logSystem(
      'session_aftermath_reached',
      {
        totalInquiries,
        totalCustomActions: customActionCount,
        totalDays: day,
        role: selectedRole,
        finalScore: score,
        sessionDuration,
        hasIdeologyRatings: !!data.ideologyRatings
      },
      `Session reached aftermath: ${totalInquiries} inquiries, ${customActionCount} custom actions, ${day} days completed`
    );

    // End session with summary data
    sessionLogger.end({
      totalInquiries,
      totalCustomActions: customActionCount,
      totalDays: day,
      role: selectedRole,
      finalScore: score,
      hasIdeologyRatings: !!data.ideologyRatings,
      completedSuccessfully: true
    });

    console.log('[AftermathScreen] 📊 Session summary logged:', {
      totalInquiries,
      customActionCount,
      totalDays: day,
      sessionDuration: sessionDuration ? `${Math.round(sessionDuration / 1000)}s` : 'unknown'
    });
  }, [data, isFirstVisit, inquiryHistory, customActionCount, selectedRole, day, score, sessionLogger, logger]);

  // ========================================================================
  // RENDER: Loading State
  // ========================================================================
  if (loading && !data && !initializedFromSnapshot) {
    return (
      <CollectorLoadingOverlay
        progress={progress}
        message={lang("AFTERMATH_PENDING")}
      />
    );
  }

  // ========================================================================
  // RENDER: Error State
  // ========================================================================
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={roleBgStyle}>
        <div className="max-w-md w-full bg-red-900/20 border border-red-500/50 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-400 mb-3">{lang("FAILED_TO_LOAD_AFTERMATH")}</h2>
          <p className="text-white/80 mb-4">{error}</p>
          <button
            onClick={() => {
              startProgress();
              fetchAftermathData();
            }}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors"
          >
            {lang("RETRY")}
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
    <div className="min-h-screen px-5 py-8" style={roleBgStyle}>
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
        onRevealScoreClick={() => {
          // Save snapshot with ratings before navigating to FinalScoreScreen
          // This ensures ideology ratings persist when navigating back
          if (data) {
            saveAftermathScreenSnapshot({
              data,
              timestamp: Date.now()
            });
          }
          push("/final-score");
        }}
      />
    </div>
  );
}
