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
  Gift,
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
import { useMirrorTop3 } from "../hooks/useMirrorTop3";
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

export default function FinalScoreScreen({ push }: Props) {
  // Load aftermath ratings from snapshot (saved by AftermathScreen)
  const [ratings, setRatings] = useState<{
    liberalism: AftermathRating;
    autonomy: AftermathRating;
  } | null>(null);

  // Submission state
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [isHallOfFame, setIsHallOfFame] = useState(false);

  // Store access
  const character = useRoleStore((s) => s.character);
  const analysis = useRoleStore((s) => s.analysis);
  const addHighscoreEntry = useHighscoreStore((s) => s.addEntry);
  const highscoreEntries = useHighscoreStore((s) => s.entries);
  const top3ByDimension = useMirrorTop3();

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

  // Build category sequence for animation
  const sequence: CategoryPiece[] = useMemo(
    () => [
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
        key: "bonus",
        label: "Bonus",
        value: breakdown.bonus.points,
        icon: <Gift className="h-5 w-5" />,
        tint: "bg-pink-500/10",
      },
      {
        key: "difficulty",
        label: "Difficulty",
        value: breakdown.difficulty.points,
        icon: <Rocket className="h-5 w-5" />,
        tint: "bg-yellow-500/10",
      },
      {
        key: "final",
        label: "Final Score",
        value: breakdown.final,
        icon: <Trophy className="h-5 w-5" />,
        tint: "bg-amber-500/10",
      },
    ],
    [breakdown]
  );

  // Animation state
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(true);
  const [displayValues, setDisplayValues] = useState<number[]>(() =>
    sequence.map(() => 0)
  );
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Restore animation state if score already calculated (runs once on mount)
  useEffect(() => {
    if (finalScoreCalculated && savedBreakdown && ratings) {
      console.log("[FinalScoreScreen] Score already calculated - skipping animation");
      // Jump to completed state immediately with saved values
      const finalSequence = [
        savedBreakdown.support.total,
        savedBreakdown.budget.points,
        savedBreakdown.ideology.total,
        savedBreakdown.goals.total,
        savedBreakdown.bonus.points,
        savedBreakdown.difficulty.points,
        savedBreakdown.final,
      ];
      setDisplayValues(finalSequence);
      setStep(finalSequence.length);
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Reset animation when breakdown changes (only if not restored)
  useEffect(() => {
    if (!finalScoreCalculated) {
      setStep(0);
      setRunning(true);
      setDisplayValues(sequence.map(() => 0));
    }
  }, [sequence, finalScoreCalculated]);

  // Animate current step
  useEffect(() => {
    if (!running || step >= sequence.length) return;

    const duration = step === sequence.length - 1 ? 1200 : 800;
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
  }, [running, step, sequence]);

  // On animation complete: submit to highscores
  useEffect(() => {
    if (step === sequence.length && !isSubmitted && ratings) {
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
      setIsSubmitted(true);

      // Check player's rank in sorted list
      const rank = findPlayerRank(entry.name, breakdown.final);
      console.log("[FinalScoreScreen] Player rank:", rank);
      setPlayerRank(rank);
      setIsHallOfFame(rank > 0 && rank <= 20);
    }
  }, [
    step,
    sequence.length,
    isSubmitted,
    ratings,
    breakdown,
    character,
    analysis,
    top3ByDimension,
    addHighscoreEntry,
  ]);

  // Save score to store after animation completes (prevents recalculation on revisit)
  useEffect(() => {
    if (step === sequence.length && !finalScoreCalculated && breakdown && ratings) {
      console.log("[FinalScoreScreen] Saving score to store (final score:", breakdown.final, ")");
      saveFinalScore(breakdown);
    }
  }, [step, sequence.length, finalScoreCalculated, breakdown, ratings, saveFinalScore]);

  // Helper: Find player rank in sorted highscores
  function findPlayerRank(playerName: string, playerScore: number): number {
    // Highscores are already sorted by score (descending) by the store
    const playerIndex = highscoreEntries.findIndex(
      (e) => e.name === playerName && e.score === playerScore
    );
    return playerIndex >= 0 ? playerIndex + 1 : -1; // 1-indexed
  }

  // User controls
  const restart = () => {
    console.log("[FinalScoreScreen] Restarting animation");
    setStep(0);
    setRunning(true);
    setDisplayValues(sequence.map(() => 0));
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
    // Navigate back to Aftermath (will restore from snapshot, no reload)
    push("/aftermath");
  };

  const handlePlayAgain = () => {
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
    // Navigate to highscores with player name for highlighting
    const playerName = character?.name || "Unknown Leader";
    push(`/highscores?highlight=${encodeURIComponent(playerName)}`);
  };

  // Progress for cumulative bar
  const isFinalStep = step >= sequence.length - 1;

  const currentScore = isFinalStep
    ? displayValues[sequence.length - 1]
    : displayValues.slice(0, sequence.length - 1).reduce((a, b) => a + b, 0);

  const maxScore = 3000;
  const currentPct = Math.round(
    (Math.max(0, Math.min(maxScore, currentScore)) / maxScore) * 100
  );

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

        {/* Cumulative Progress Bar */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="mb-3 flex items-baseline justify-between">
            <div className="text-sm text-white/70">Current Score</div>
            <div className="text-sm text-white/70">Max {maxScore}</div>
          </div>
          <div className="relative h-10 w-full overflow-hidden rounded-xl bg-white/5 border border-white/10">
            <motion.div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-amber-400 to-amber-600"
              initial={{ width: 0 }}
              animate={{ width: `${currentPct}%` }}
              transition={{ type: "tween", duration: 0.3 }}
            />
            <div className="relative z-10 flex h-full items-center justify-center text-xl font-bold tabular-nums text-white">
              {currentScore}
            </div>
          </div>
          {isFinalStep && (
            <div className="mt-2 text-center text-sm text-white/80">
              Final score:{" "}
              <span className="font-semibold text-white">
                {displayValues[sequence.length - 1]}
              </span>
            </div>
          )}
        </div>

        {/* Category Cards */}
        <ul className="space-y-4">
          {sequence.map((piece, idx) => (
            <li key={piece.key}>
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
                              ? Math.round((breakdown.support.people / 500) * 100)
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
                              ? Math.round((breakdown.support.middle / 500) * 100)
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
                              ? Math.round((breakdown.support.mom / 500) * 100)
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
                    <div className="text-sm text-white/60 italic">Coming Soon</div>
                  </div>
                )}

                {piece.key === "bonus" && (
                  <div className="space-y-2">
                    <div className="text-sm text-white/60 italic">Coming Soon</div>
                  </div>
                )}

                {piece.key === "difficulty" && breakdown.difficulty.level && (
                  <div className="space-y-2">
                    <TocRow
                      left={
                        <span>
                          Level:{" "}
                          <span className="font-semibold capitalize">
                            {breakdown.difficulty.level.replace("-", " ")}
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

        {/* Hall of Fame Banner / Rank Acknowledgment */}
        {isSubmitted && playerRank && playerRank > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={
              isHallOfFame
                ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-2 border-amber-400 rounded-xl p-6"
                : "bg-white/5 border border-white/10 rounded-xl p-4"
            }
          >
            {isHallOfFame ? (
              <>
                <div className="text-center text-3xl font-bold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent mb-2">
                  🎉 YOU MADE THE HALL OF FAME! 🎉
                </div>
                <div className="text-center text-xl text-white font-semibold">
                  Rank #{playerRank}
                </div>
              </>
            ) : (
              <div className="text-center text-white/80">
                Your rank: <span className="font-semibold">#{playerRank}</span>
              </div>
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
