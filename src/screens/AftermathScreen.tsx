// src/screens/AftermathScreen.tsx
// Aftermath screen showing game epilogue after final day
//
// Shows:
// - Title
// - Snapshot section (avatar + death text + event pills)
// - Final ratings (democracy/autonomy/liberalism)
// - Decision breakdown (collapsible)
// - Reflection (mirror-styled)
// - Tombstone with haiku
// - "Reveal Final Score" button
//
// Connects to:
// - src/hooks/useAftermathData.ts: fetches data from API
// - src/components/aftermath/AftermathContent.tsx: main content renderer
// - server/index.mjs: POST /api/aftermath

import { useEffect, useMemo, useRef, useState } from "react";
import { useAftermathData } from "../hooks/useAftermathData";
import { useRoleStore } from "../store/roleStore";
import { useLoadingProgress } from "../hooks/useLoadingProgress";
import CollectorLoadingOverlay from "../components/event/CollectorLoadingOverlay";
import { bgStyleWithRoleImage } from "../lib/ui";
import type { PushFn } from "../lib/router";
import { useMirrorTop3 } from "../hooks/useMirrorTop3";
import {
  loadAftermathScreenSnapshot,
  saveAftermathScreenSnapshot,
  clearAftermathScreenSnapshot
} from "../lib/eventScreenSnapshot";
import AftermathContent from "../components/aftermath/AftermathContent";
import { useLang } from "../i18n/lang";
import { useLoggingStore } from "../store/loggingStore";
import { EXPERIMENT_PREDEFINED_ROLE_KEYS } from "../data/predefinedRoles";
import { useSessionLogger } from "../hooks/useSessionLogger";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useLogger } from "../hooks/useLogger";
import { useNavigationGuard } from "../hooks/useNavigationGuard";
import { usePastGamesStore } from "../store/pastGamesStore";
import { buildPastGameEntry } from "../lib/pastGamesService";
import { useFragmentsStore } from "../store/fragmentsStore";
import { audioManager } from "../lib/audioManager";
import FallbackNotification from "../components/aftermath/FallbackNotification";

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

  // Past games store for saving completed game data
  const addPastGame = usePastGamesStore((s) => s.addGame);

  // Fragments store for fragment collection
  const addFragment = useFragmentsStore((s) => s.addFragment);
  const fragmentCount = useFragmentsStore((s) => s.getFragmentCount());

  // Retry progress state (for showing "Attempt 2/3" in loading overlay)
  const [retryAttempt, setRetryAttempt] = useState<{ current: number; max: number } | null>(null);

  // Fallback notification state (shown when isFallback is true)
  const [showFallbackNotification, setShowFallbackNotification] = useState(false);

  // Navigation guard - prevent back button during aftermath
  useNavigationGuard({
    enabled: true,
    confirmationMessage: lang("CONFIRM_EXIT_AFTERMATH"),
    screenName: "aftermath_screen"
  });

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

  // ========================================================================
  // EFFECT: FETCH DATA (only if not restored from snapshot)
  // ========================================================================
  useEffect(() => {
    if (!initializedFromSnapshot && !data && !loading) {
      console.log('[AftermathScreen] Fetching aftermath data...');
      startProgress(); // Start progress animation
      fetchAftermathData((attempt, maxAttempts) => {
        setRetryAttempt({ current: attempt, max: maxAttempts });
      });
    }
  }, [initializedFromSnapshot, data, loading, fetchAftermathData, startProgress]);

  // ========================================================================
  // EFFECT: NOTIFY PROGRESS (only if not restored from snapshot)
  // ========================================================================
  const hasNotifiedReadyRef = useRef(false);

  useEffect(() => {
    if (data && !initializedFromSnapshot && !hasNotifiedReadyRef.current) {
      hasNotifiedReadyRef.current = true;
      notifyReady();
      setRetryAttempt(null); // Clear retry progress

      // Show fallback notification if data is fallback
      if (data.isFallback) {
        setShowFallbackNotification(true);
        console.log('[AftermathScreen] ⚠️ Showing fallback notification - AI generation failed');
      }
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
  // Guard ref to prevent duplicate logging (fixes 81x duplication bug)
  const hasLoggedAftermathRef = useRef(false);

  useEffect(() => {
    // Only log on first visit (when data first loads, not when restored from snapshot)
    // AND only if we haven't already logged (prevent re-fires from dependency changes)
    if (!data || !isFirstVisit || hasLoggedAftermathRef.current) return;

    // Mark as logged immediately to prevent any re-fires
    hasLoggedAftermathRef.current = true;

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
        hasIdeologyRatings: !!data.ratings
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
      hasIdeologyRatings: !!data.ratings,
      completedSuccessfully: true
    });

    console.log('[AftermathScreen] 📊 Session summary logged:', {
      totalInquiries,
      customActionCount,
      totalDays: day,
      sessionDuration: sessionDuration ? `${Math.round(sessionDuration / 1000)}s` : 'unknown'
    });

    // Collect and send session summary to MongoDB summary collection
    (async () => {
      try {
        const { collectSessionSummary, sendSessionSummary } = await import('../hooks/useSessionSummary');
        const summary = collectSessionSummary(data, false, sessionDuration); // Pass session duration
        await sendSessionSummary(summary);
        console.log('[AftermathScreen] ✅ Session summary sent to MongoDB');
      } catch (error) {
        console.error('[AftermathScreen] ❌ Failed to send session summary:', error);
        // Don't throw - logging should never block user experience
      }
    })();

    // Extract gameId early - needed even if past game save fails
    const currentGameId = useDilemmaStore.getState().gameId || `game-${Date.now()}`;

    // TRY BLOCK 1: Save past game to localStorage (non-critical, allowed to fail)
    try {
      const pastGameEntry = buildPastGameEntry(data);
      addPastGame(pastGameEntry);

      // Log that we saved the game
      logger.logSystem(
        'past_game_saved',
        {
          gameId: pastGameEntry.gameId,
          playerName: pastGameEntry.playerName,
          roleTitle: pastGameEntry.roleTitle,
          finalScore: pastGameEntry.finalScore,
          timestamp: pastGameEntry.timestamp
        },
        `Past game saved: ${pastGameEntry.playerName} in ${pastGameEntry.roleTitle} (Score: ${pastGameEntry.finalScore})`
      );

      console.log('[AftermathScreen] 💾 Past game saved to localStorage');
    } catch (error) {
      console.error('[AftermathScreen] ❌ Failed to save past game:', error);
      logger.logSystem(
        'past_game_save_failed',
        {
          gameId: currentGameId,
          error: error instanceof Error ? error.message : String(error)
        },
        'Failed to save past game (localStorage quota or other error)'
      );
      // Continue to fragment collection - past games are non-critical
    }

    // TRY BLOCK 2: Collect fragment (CRITICAL, must succeed even if past game failed)
    if (fragmentCount < 3) {
      try {
        // Get the pending avatar thumbnail from roleStore
        const pendingThumbnail = useRoleStore.getState().pendingAvatarThumbnail;
        addFragment(currentGameId, pendingThumbnail);

        // Clear the pending thumbnail after use
        useRoleStore.getState().setPendingAvatarThumbnail(null);

        // CRITICAL FIX: Force immediate localStorage write to prevent race condition
        // Zustand persist middleware is async and can fail silently if tab loses focus
        try {
          const fragmentsState = useFragmentsStore.getState();
          const persistData = {
            state: {
              firstIntro: fragmentsState.firstIntro,
              fragments: fragmentsState.fragments.slice(0, 3),
              hasClickedFragment: fragmentsState.hasClickedFragment,
              preferredFragmentId: fragmentsState.preferredFragmentId
            },
            version: 2
          };
          localStorage.setItem('amaze-politics-fragments-v2', JSON.stringify(persistData));
          console.log('[AftermathScreen] ✅ Fragment manually persisted to localStorage (with avatar)');
        } catch (persistError) {
          console.error('[AftermathScreen] ❌ Failed to persist fragment to localStorage:', persistError);
          logger.logSystem(
            'fragment_persist_failed',
            {
              gameId: currentGameId,
              error: persistError instanceof Error ? persistError.message : String(persistError)
            },
            'Failed to persist fragment to localStorage'
          );
        }

        // Verify fragment was actually added by re-reading from store
        const updatedFragmentCount = useFragmentsStore.getState().getFragmentCount();
        const fragmentWasAdded = updatedFragmentCount > fragmentCount;

        if (!fragmentWasAdded) {
          console.error('[AftermathScreen] ⚠️ WARNING: Fragment was not added to store!');
          logger.logSystem(
            'fragment_addition_failed',
            {
              gameId: currentGameId,
              expectedCount: fragmentCount + 1,
              actualCount: updatedFragmentCount
            },
            'Fragment was not added to store'
          );
        } else {
          // Play fragment collected sound
          audioManager.playSfx('fragment-collected');
          // Get player info for logging (may not have past game if that save failed)
          const roleStore = useRoleStore.getState();
          const playerName = roleStore.character?.name || 'Leader';
          const roleTitle = roleStore.roleTitle || roleStore.selectedRole || 'Unknown';

          logger.logSystem(
            'fragment_collected',
            {
              gameId: currentGameId,
              fragmentIndex: fragmentCount,
              totalFragments: updatedFragmentCount,
              playerName,
              roleTitle
            },
            `Fragment ${updatedFragmentCount}/3 collected: ${playerName} in ${roleTitle}`
          );

          console.log(`[AftermathScreen] 🧩 Fragment ${updatedFragmentCount}/3 collected (verified)`);

          // Log if all 3 fragments now collected
          if (updatedFragmentCount === 3) {
            logger.logSystem(
              'fragments_all_collected',
              { totalFragments: 3 },
              'All 3 fragments collected!'
            );
            console.log('[AftermathScreen] 🎉 All 3 fragments collected!');
          }
        }
      } catch (fragmentError) {
        console.error('[AftermathScreen] ❌ CRITICAL: Failed to collect fragment:', fragmentError);
        logger.logSystem(
          'fragment_collection_failed',
          {
            gameId: currentGameId,
            error: fragmentError instanceof Error ? fragmentError.message : String(fragmentError)
          },
          'Critical failure: Fragment collection failed'
        );
      }
    }
  }, [data, isFirstVisit, inquiryHistory, customActionCount, selectedRole, day, score, addPastGame, addFragment, logger]);

  // ========================================================================
  // RENDER: Loading State
  // ========================================================================
  if (loading && !data && !initializedFromSnapshot) {
    // Build loading message with retry progress if applicable
    const loadingMessage = retryAttempt
      ? lang("AFTERMATH_RETRY_ATTEMPT")
          .replace("{current}", String(retryAttempt.current))
          .replace("{max}", String(retryAttempt.max))
      : lang("AFTERMATH_PENDING");

    return (
      <CollectorLoadingOverlay
        progress={progress}
        message={loadingMessage}
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
      {/* Fallback notification banner (dismissable) */}
      {showFallbackNotification && (
        <div className="max-w-3xl mx-auto">
          <FallbackNotification onDismiss={() => setShowFallbackNotification(false)} />
        </div>
      )}

      <AftermathContent
        data={data}
        avatarUrl={character?.avatarUrl}
        top3ByDimension={top3ByDimension}
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
