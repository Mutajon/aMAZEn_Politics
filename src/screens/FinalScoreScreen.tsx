// src/screens/FinalScoreScreen.tsx
// Final score screen showing comprehensive score breakdown with animations
//
// Features:
// - Cumulative progress bar (0 → final score)
// - Category cards (Support, Budget, Ideology, Goals, Bonus, Difficulty)
// - Animated counters revealing score sequentially
// - Automatic highscore submission after animation
// - Hall of Fame rank check (Top 20)
// - Navigation to Play Again or Visit Hall of Fame
//
// Connected to:
// - src/hooks/useScoreCalculation.ts: Calculates score breakdown
// - src/lib/scoring.ts: Score formulas, types, and highscore helpers
// - src/store/highscoreStore.ts: Automatic submission
// - src/screens/AftermathScreen.tsx: Navigates here after epilogue
// - src/screens/HighscoreScreen.tsx: Navigates here to view Hall of Fame

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  DollarSign,
  Gauge,
  Target,
  Rocket,
  Trophy,
} from "lucide-react";
import { bgStyle } from "../lib/ui";
import { useScoreCalculation } from "../hooks/useScoreCalculation";
import {
  formatRating,
  buildHighscoreEntry,
  type AftermathRating,
} from "../lib/scoring";
import {
  loadAftermathScreenSnapshot,
  clearAftermathScreenSnapshot,
  hasAftermathScreenSnapshot,
  clearAllSnapshots,
} from "../lib/eventScreenSnapshot";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { useCompassStore } from "../store/compassStore";
import { useHighscoreStore } from "../store/highscoreStore";
import { useSettingsStore } from "../store/settingsStore";
import { useMirrorTop3 } from "../hooks/useMirrorTop3";
import { useAudioManager } from "../hooks/useAudioManager";
import { useLogger } from "../hooks/useLogger";
import { loggingService } from "../lib/loggingService";
import type { PushFn } from "../lib/router";

type Props = {
  push: PushFn;
};

/**
 * Helper: Ease-out cubic for smooth counter animation
 */
function easeNumber(from: number, to: number, t: number): number {
  const u = 1 - Math.pow(1 - t, 3);
  return from + (to - from) * u;
}

/**
 * Component: Dotted leader row (table of contents style)
 */
function TocRow({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="shrink-0 text-white/70">{left}</span>
      <span className="flex-1 border-b border-dotted border-white/20" />
      <span className="shrink-0 tabular-nums font-semibold text-white/90">
        {right}
      </span>
    </div>
  );
}

type CategoryPiece = {
  key: string;
  label: string;
  value: number;
  icon: React.ReactNode;
  tint: string; // Tailwind background color
};

/**
 * Map difficulty IDs to display names (matches DifficultyScreen titles)
 */
const difficultyDisplayMap: Record<string, string> = {
  "baby-boss": "Baby Boss (Easy)",
  "freshman": "Freshman (Normal)",
  "tactician": "Tactician (Hard)",
  "old-fox": "Old Fox (Very Hard)",
};

export default function FinalScoreScreen({ push }: Props) {
  // Load aftermath ratings from snapshot (saved by AftermathScreen)
  const [ratings, setRatings] = useState<{
    liberalism: AftermathRating;
    autonomy: AftermathRating;
  } | null>(null);

  // Submission state (persistent to prevent duplicates on revisit)
  const finalScoreSubmitted = useDilemmaStore((s) => s.finalScoreSubmitted);
  const markScoreSubmitted = useDilemmaStore((s) => s.markScoreSubmitted);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [isHallOfFame, setIsHallOfFame] = useState(false);

  // Store access
  const character = useRoleStore((s) => s.character);
  const analysis = useRoleStore((s) => s.analysis);
  const addHighscoreEntry = useHighscoreStore((s) => s.addEntry);
  const top3ByDimension = useMirrorTop3();
  const selectedGoals = useDilemmaStore((s) => s.selectedGoals);
  const enableModifiers = useSettingsStore((s) => s.enableModifiers);
  const showBudget = useSettingsStore((s) => s.showBudget);
  const { playSfx } = useAudioManager();
  const logger = useLogger();

  // Score persistence (prevents recalculation on revisit)
  const saveFinalScore = useDilemmaStore((s) => s.saveFinalScore);
  const finalScoreCalculated = useDilemmaStore((s) => s.finalScoreCalculated);
  const savedBreakdown = useDilemmaStore((s) => s.finalScoreBreakdown);

  // Check if we can navigate back to Aftermath
  const canGoBack = hasAftermathScreenSnapshot();

  // Auto-scroll to top on mount (user may have scrolled Aftermath before coming here)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Load aftermath ratings
  useEffect(() => {
    const snapshot = loadAftermathScreenSnapshot();
    if (snapshot?.data?.ratings) {
      setRatings({
        liberalism: snapshot.data.ratings.liberalism as AftermathRating,
        autonomy: snapshot.data.ratings.autonomy as AftermathRating,
      });
      clearAftermathScreenSnapshot();
    } else {
      setRatings({ liberalism: "medium", autonomy: "medium" });
    }
  }, []);

  // Calculate score breakdown (or use saved if available)
  const freshBreakdown = useScoreCalculation({
    liberalismRating: ratings?.liberalism,
    autonomyRating: ratings?.autonomy,
  });

  // Use saved breakdown if score already calculated, otherwise use fresh
  const breakdown = savedBreakdown && finalScoreCalculated ? savedBreakdown : freshBreakdown;

  // Build category sequence for animation (4-5 categories depending on enableModifiers, final score bar added separately)
  const sequence: CategoryPiece[] = useMemo(
    () => {
      const allCategories: CategoryPiece[] = [
        {
          key: "support",
          label: "Final Support",
          value: breakdown.support.total,
          icon: <Users className="h-5 w-5" />,
          tint: "bg-blue-500/10",
        },
        {
          key: "budget",
          label: "Budget",
          value: breakdown.budget.points,
          icon: <DollarSign className="h-5 w-5" />,
          tint: "bg-emerald-500/10",
        },
        {
          key: "ideology",
          label: "Ideology",
          value: breakdown.ideology.total,
          icon: <Gauge className="h-5 w-5" />,
          tint: "bg-purple-500/10",
        },
        {
          key: "goals",
          label: "Goals",
          value: breakdown.goals.total,
          icon: <Target className="h-5 w-5" />,
          tint: "bg-orange-500/10",
        },
        {
          key: "difficulty",
          label: "Difficulty",
          value: breakdown.difficulty.points,
          icon: <Rocket className="h-5 w-5" />,
          tint: "bg-yellow-500/10",
        },
      ];

      // Filter out categories based on settings
      let filtered = allCategories;
      // Filter budget if disabled
      if (!showBudget) {
        filtered = filtered.filter(c => c.key !== 'budget');
      }
      // Filter goals & difficulty if modifiers disabled
      if (!enableModifiers) {
        filtered = filtered.filter(c => c.key !== 'goals' && c.key !== 'difficulty');
      }
      return filtered;
    },
    [breakdown, enableModifiers, showBudget]
  );

  // Animation state (3-5 categories + 1 final score = 4-6 total steps, depending on enableModifiers)
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(true);
  const [displayValues, setDisplayValues] = useState<number[]>(() =>
    [...sequence.map(() => 0), 0] // N categories + final score
  );
  const [finalScoreDisplay, setFinalScoreDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Refs for auto-scrolling category cards
  const categoryRefs = useRef<(HTMLLIElement | null)[]>([]);
  const finalScoreRef = useRef<HTMLDivElement | null>(null);

  // Restore animation state if score already calculated (runs once on mount)
  useEffect(() => {
    if (finalScoreCalculated && savedBreakdown && ratings) {
      console.log("[FinalScoreScreen] Score already calculated - skipping animation");
      // Jump to completed state immediately with saved values (sequence.length categories + final score)
      // Build array matching current sequence (filtered by enableModifiers)
      const categoryValues = sequence.map(piece => {
        switch (piece.key) {
          case 'support': return savedBreakdown.support.total;
          case 'budget': return savedBreakdown.budget.points;
          case 'ideology': return savedBreakdown.ideology.total;
          case 'goals': return savedBreakdown.goals.total;
          case 'difficulty': return savedBreakdown.difficulty.points;
          default: return 0;
        }
      });
      const finalSequence = [...categoryValues, savedBreakdown.final];
      setDisplayValues(finalSequence);
      setFinalScoreDisplay(savedBreakdown.final);
      setStep(sequence.length + 1); // sequence.length categories + 1 final score
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Reset animation when breakdown changes (only if not restored)
  useEffect(() => {
    if (!finalScoreCalculated) {
      setStep(0);
      setRunning(true);
      setDisplayValues([...sequence.map(() => 0), 0]); // 5 categories + final score
      setFinalScoreDisplay(0);
    }
  }, [sequence, finalScoreCalculated]);

  // Calculate rank on mount if already submitted (for revisits after navigation)
  useEffect(() => {
    if (finalScoreSubmitted && savedBreakdown && character && ratings && playerRank === null) {
      console.log("[FinalScoreScreen] Already submitted - calculating rank on revisit");
      const freshEntries = useHighscoreStore.getState().entries;
      const rank = findPlayerRank(character.name, savedBreakdown.final, freshEntries);
      console.log("[FinalScoreScreen] Recalculated rank on revisit:", rank);
      setPlayerRank(rank);
      setIsHallOfFame(rank > 0 && rank <= 20);
    }
  }, [finalScoreSubmitted, savedBreakdown, character, ratings, playerRank]);

  // Auto-scroll to active category card
  useEffect(() => {
    if (step >= 0 && step < sequence.length) {
      // Steps 0-(N-1): category cards
      const element = categoryRefs.current[step];
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else if (step === sequence.length) {
      // Step N: final score bar
      if (finalScoreRef.current) {
        finalScoreRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [step, sequence.length]);

  // Animate current step
  useEffect(() => {
    if (!running || step > sequence.length) return; // N+1 steps total (0-N)

    // Step N is the final score bar animation
    if (step === sequence.length) {
      // Play drumroll sound effect
      playSfx('drumroll');

      const duration = 1200;
      const from = 0;
      const to = breakdown.final;

      const tick = (t: number) => {
        if (startTimeRef.current === 0) startTimeRef.current = t;
        const elapsed = t - startTimeRef.current;
        const progress = Math.min(1, elapsed / duration);
        const val = Math.round(easeNumber(from, to, progress));

        setFinalScoreDisplay(val);
        setDisplayValues((prev) => prev.map((v, i) => (i === sequence.length ? val : v)));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          startTimeRef.current = 0;
          setRunning(false); // Animation complete
          setTimeout(() => setStep((s) => s + 1), 200);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    // Steps 0-4: category animations
    const duration = 800;
    const from = 0;
    const to = sequence[step].value;

    const tick = (t: number) => {
      if (startTimeRef.current === 0) startTimeRef.current = t;
      const elapsed = t - startTimeRef.current;
      const progress = Math.min(1, elapsed / duration);
      const val = Math.round(easeNumber(from, to, progress));

      setDisplayValues((prev) => prev.map((v, i) => (i === step ? val : v)));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        startTimeRef.current = 0;
        setTimeout(() => setStep((s) => s + 1), 200);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, step, sequence, breakdown.final, playSfx]);

  // On animation complete: submit to highscores (only once, tracked in persisted store)
  useEffect(() => {
    if (step === sequence.length + 1 && !finalScoreSubmitted && ratings) {
      console.log("[FinalScoreScreen] Animation complete - submitting to highscores");

      // Submit to highscores (AUTOMATIC FOR ALL PLAYERS)
      const entry = buildHighscoreEntry(
        breakdown,
        character,
        analysis,
        ratings,
        top3ByDimension
      );

      console.log("[FinalScoreScreen] Submitting highscore entry:", entry);
      addHighscoreEntry(entry);

      // Mark as submitted in persistent store (prevents duplicates on revisit)
      markScoreSubmitted();

      // Get FRESH entries from store after adding (hook value is stale)
      const freshEntries = useHighscoreStore.getState().entries;
      const rank = findPlayerRank(entry.name, breakdown.final, freshEntries);
      console.log("[FinalScoreScreen] Player rank:", rank);
      setPlayerRank(rank);
      setIsHallOfFame(rank > 0 && rank <= 20);

      // End logging session (game complete)
      loggingService.endSession();
      logger.log('game_completed', {
        finalScore: breakdown.final,
        rank: rank,
        isHallOfFame: rank > 0 && rank <= 20,
        scoreBreakdown: {
          support: breakdown.support.total,
          budget: breakdown.budget.points,
          ideology: breakdown.ideology.total,
          goals: breakdown.goals.total,
          difficulty: breakdown.difficulty.points
        }
      }, `Game completed - Final score: ${breakdown.final}, Rank: ${rank}`);
    }
  }, [
    step,
    sequence.length,
    finalScoreSubmitted,
    ratings,
    breakdown,
    character,
    analysis,
    top3ByDimension,
    addHighscoreEntry,
    markScoreSubmitted,
    logger,
  ]);

  // Save score to store after animation completes (prevents recalculation on revisit)
  useEffect(() => {
    if (step === sequence.length + 1 && !finalScoreCalculated && breakdown && ratings) {
      console.log("[FinalScoreScreen] Saving score to store (final score:", breakdown.final, ")");
      saveFinalScore(breakdown);
    }
  }, [step, sequence.length, finalScoreCalculated, breakdown, ratings, saveFinalScore]);

  // Helper: Find player rank in sorted highscores (takes entries as param to avoid stale closure)
  function findPlayerRank(
    playerName: string,
    playerScore: number,
    entries: ReturnType<typeof useHighscoreStore.getState>["entries"]
  ): number {
    // Highscores are already sorted by score (descending) by the store
    const playerIndex = entries.findIndex(
      (e) => e.name === playerName && e.score === playerScore
    );
    return playerIndex >= 0 ? playerIndex + 1 : -1; // 1-indexed
  }

  // User controls
  const restart = () => {
    console.log("[FinalScoreScreen] Restarting animation");
    setStep(0);
    setRunning(true);
    setDisplayValues([...sequence.map(() => 0), 0]); // 5 categories + final score
    setFinalScoreDisplay(0);
    startTimeRef.current = 0;
    // Clear saved score so animation can replay fully
    if (finalScoreCalculated) {
      useDilemmaStore.getState().clearFinalScore();
    }
  };

  // Skip function (not currently used in UI, but available for future)
  // const skip = () => {
  //   setRunning(false);
  //   setDisplayValues(sequence.map((p) => p.value));
  //   setStep(sequence.length);
  // };

  // Navigation handlers
  const handleBackToAftermath = () => {
    logger.log('button_click_back_to_aftermath', {}, 'User clicked back to Aftermath');
    // Navigate back to Aftermath (will restore from snapshot, no reload)
    push("/aftermath");
  };

  const handlePlayAgain = () => {
    logger.log('button_click_play_again', {
      previousScore: breakdown.final,
      previousRank: playerRank
    }, 'User clicked Play Again');

    // Reset all stores for new game
    useDilemmaStore.getState().reset();
    useRoleStore.getState().reset();
    useCompassStore.getState().reset();

    // Clear all snapshots from sessionStorage
    clearAllSnapshots();

    // Navigate to role selection (start new game)
    push("/role");
  };

  const handleVisitHallOfFame = () => {
    logger.log('button_click_visit_hall_of_fame', {
      playerScore: breakdown.final,
      playerRank: playerRank
    }, 'User clicked Visit Hall of Fame');

    // Navigate to highscores with player name for highlighting
    const playerName = character?.name || "Unknown Leader";
    push(`/highscores?highlight=${encodeURIComponent(playerName)}`);
  };

  return (
    <div className="min-h-screen px-5 py-8" style={bgStyle}>
      <div className="w-full max-w-3xl mx-auto space-y-6">
        {/* Back button (conditional) */}
        {canGoBack && (
          <div className="mb-4">
            <button
              onClick={handleBackToAftermath}
              className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20 text-white/90 transition-colors"
            >
              ← Back to Aftermath
            </button>
          </div>
        )}

        {/* Title */}
        <h1 className="text-4xl font-extrabold text-center bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent mb-8">
          Final Score
        </h1>

        {/* Category Cards */}
        <ul className="space-y-4">
          {sequence.map((piece, idx) => (
            <li
              key={piece.key}
              ref={(el) => {
                categoryRefs.current[idx] = el;
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: idx <= step ? 1 : 0.4, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`rounded-xl border border-white/10 p-5 ${piece.tint} backdrop-blur-sm`}
              >
                {/* Category Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-white/10 p-2.5 text-white">
                      {piece.icon}
                    </div>
                    <div className="font-semibold text-lg text-white">
                      {piece.label}
                    </div>
                  </div>
                  <div
                    className={`text-2xl tabular-nums font-bold ${
                      piece.key === "final" ? "text-amber-400" : "text-white"
                    }`}
                  >
                    {piece.key === "final"
                      ? displayValues[idx]
                      : displayValues[idx] >= 0
                      ? `+${displayValues[idx]}`
                      : displayValues[idx]}
                  </div>
                </div>

                {/* Category Breakdown */}
                {piece.key === "support" && (
                  <div className="space-y-2">
                    <TocRow
                      left={
                        <span>
                          Public support{" "}
                          <span className="font-semibold">
                            {breakdown.support.people > 0
                              ? Math.round((breakdown.support.people / 600) * 100)
                              : 0}
                            %
                          </span>
                        </span>
                      }
                      right={<span>{breakdown.support.people}</span>}
                    />
                    <TocRow
                      left={
                        <span>
                          Power holders support{" "}
                          <span className="font-semibold">
                            {breakdown.support.middle > 0
                              ? Math.round((breakdown.support.middle / 600) * 100)
                              : 0}
                            %
                          </span>
                        </span>
                      }
                      right={<span>{breakdown.support.middle}</span>}
                    />
                    <TocRow
                      left={
                        <span>
                          Mom support{" "}
                          <span className="font-semibold">
                            {breakdown.support.mom > 0
                              ? Math.round((breakdown.support.mom / 600) * 100)
                              : 0}
                            %
                          </span>
                        </span>
                      }
                      right={<span>{breakdown.support.mom}</span>}
                    />
                  </div>
                )}

                {piece.key === "budget" && (
                  <div className="space-y-2">
                    <TocRow
                      left={
                        <span>
                          Budget:{" "}
                          <span className="font-semibold">
                            {breakdown.budget.budgetAmount}
                          </span>
                        </span>
                      }
                      right={<span>{breakdown.budget.points}</span>}
                    />
                  </div>
                )}

                {piece.key === "ideology" && (
                  <div className="space-y-2">
                    <TocRow
                      left={
                        <span>
                          Liberalism:{" "}
                          <span className="font-semibold">
                            {formatRating(breakdown.ideology.liberalism.rating)}
                          </span>
                        </span>
                      }
                      right={<span>{breakdown.ideology.liberalism.points}</span>}
                    />
                    <TocRow
                      left={
                        <span>
                          Autonomy:{" "}
                          <span className="font-semibold">
                            {formatRating(breakdown.ideology.autonomy.rating)}
                          </span>
                        </span>
                      }
                      right={<span>{breakdown.ideology.autonomy.points}</span>}
                    />
                  </div>
                )}

                {piece.key === "goals" && (
                  <div className="space-y-2">
                    {selectedGoals.length > 0 ? (
                      <>
                        {/* Summary line: Only show if at least one goal completed */}
                        {breakdown.goals.completed > 0 && (
                          <TocRow
                            left={
                              <span>
                                Goals completed:{" "}
                                <span className="font-semibold">
                                  {breakdown.goals.completed} / 2
                                </span>
                              </span>
                            }
                            right={<span>{breakdown.goals.bonusPoints}</span>}
                          />
                        )}

                        {/* Goal list: ALWAYS show with status icons */}
                        {selectedGoals.map(goal => (
                          <div key={goal.id} className="text-xs text-white/60 flex items-center gap-2 ml-4">
                            <span>{goal.status === 'met' ? '✅' : goal.status === 'failed' ? '❌' : '⏳'}</span>
                            <span className={goal.status === 'met' ? 'text-green-400' : goal.status === 'failed' ? 'text-red-400' : ''}>{goal.title}</span>
                            {goal.status === 'met' && <span className="text-green-400">+{goal.scoreBonusOnCompletion}</span>}
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="text-sm text-white/60 italic">
                        No goals selected
                      </div>
                    )}
                  </div>
                )}

                {piece.key === "difficulty" && breakdown.difficulty.level && (
                  <div className="space-y-2">
                    <TocRow
                      left={
                        <span>
                          Level:{" "}
                          <span className="font-semibold">
                            {difficultyDisplayMap[breakdown.difficulty.level] || breakdown.difficulty.level}
                          </span>
                        </span>
                      }
                      right={
                        <span
                          className={
                            breakdown.difficulty.points >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {breakdown.difficulty.points >= 0
                            ? `+${breakdown.difficulty.points}`
                            : breakdown.difficulty.points}
                        </span>
                      }
                    />
                  </div>
                )}
              </motion.div>
            </li>
          ))}
        </ul>

        {/* Final Score Bar (appears after all categories complete) */}
        {step >= sequence.length && (
          <motion.div
            ref={finalScoreRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-amber-500/10 backdrop-blur-sm border border-amber-400/30 rounded-xl p-6"
          >
            {/* Header with Trophy Icon */}
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-amber-500/20 p-2.5 text-amber-400">
                <Trophy className="h-6 w-6" />
              </div>
              <div className="font-bold text-2xl text-amber-400">
                Final Score
              </div>
            </div>

            {/* Animated Progress Bar */}
            <div className="relative h-12 w-full overflow-hidden rounded-xl bg-white/5 border border-white/10">
              <motion.div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-amber-400 to-amber-600"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round((Math.max(0, Math.min(3600, finalScoreDisplay)) / 3600) * 100)}%` }}
                transition={{ type: "tween", duration: 0.3 }}
              />
              <div className="relative z-10 flex h-full items-center justify-center text-2xl font-bold tabular-nums text-white">
                {finalScoreDisplay}
              </div>
            </div>

            {/* Hall of Fame Status Message (appears below bar after animation) */}
            {playerRank !== null && step === sequence.length + 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="mt-4 text-center"
              >
                {isHallOfFame ? (
                  <motion.div
                    className="text-lg font-semibold text-amber-300"
                    animate={{
                      opacity: [1, 0.6, 1],
                      scale: [1, 1.02, 1],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    🎉 You made it to the Hall of Fame! Your current rank: <span className="text-amber-400">#{playerRank}</span>
                  </motion.div>
                ) : (
                  <div className="text-lg text-white/70">
                    You did not make it to the Hall of Fame... maybe next time 😊
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Navigation Buttons */}
        <div className="space-y-3 pt-4">
          <div className="flex gap-3">
            <button
              onClick={handlePlayAgain}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-amber-500/50"
            >
              ↻ Play Again
            </button>
            <button
              onClick={handleVisitHallOfFame}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all"
            >
              🏆 Visit Hall of Fame
            </button>
          </div>

          {/* Small replay link */}
          <div className="text-center">
            <button
              onClick={restart}
              className="text-sm text-white/60 hover:text-white/90 underline"
            >
              Replay Animation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
