// src/screens/FinalScoreScreen.tsx
// Simplified final score screen aligned with the live scoring schema.
// Shows four animated components (People, Power Holders, Personal Anchor, Corruption)
// followed by the total score, hall-of-fame handling, and end-of-run actions.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Building2,
  Heart,
  ShieldCheck,
  Trophy,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { bgStyleWithRoleImage } from "../lib/ui";
import { useScoreCalculation } from "../hooks/useScoreCalculation";
import {
  buildHighscoreEntry,
  type AftermathRating,
  type ScoreBreakdown,
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
import { useMirrorQuizStore } from "../store/mirrorQuizStore";
import { useHighscoreStore } from "../store/highscoreStore";
import { useRoleProgressStore } from "../store/roleProgressStore";
import { useMirrorTop3 } from "../hooks/useMirrorTop3";
import { useAudioManager } from "../hooks/useAudioManager";
import { useLogger } from "../hooks/useLogger";
import { useNavigationGuard } from "../hooks/useNavigationGuard";
import { loggingService } from "../lib/loggingService";
import type { PushFn } from "../lib/router";
import { useLang } from "../i18n/lang";
import { audioManager } from "../lib/audioManager";

type Props = {
  push: PushFn;
};

type CategoryKey = "people" | "middle" | "mom" | "corruption";

type CategoryRenderInfo = {
  key: CategoryKey;
  label: string;
  detail: string;
  points: number;
  maxPoints: number;
  icon: React.ReactNode;
};

function easeNumber(from: number, to: number, t: number): number {
  const u = 1 - Math.pow(1 - t, 3);
  return from + (to - from) * u;
}

const formatNumber = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

export default function FinalScoreScreen({ push }: Props) {
  const lang = useLang();
  const liveBreakdown = useScoreCalculation();

  const finalScoreCalculated = useDilemmaStore((s) => s.finalScoreCalculated);
  const savedBreakdown = useDilemmaStore((s) => s.finalScoreBreakdown);
  const finalScoreSubmitted = useDilemmaStore((s) => s.finalScoreSubmitted);
  const markScoreSubmitted = useDilemmaStore((s) => s.markScoreSubmitted);
  const saveFinalScore = useDilemmaStore((s) => s.saveFinalScore);
  const clearFinalScore = useDilemmaStore((s) => s.clearFinalScore);

  const character = useRoleStore((s) => s.character);
  const analysis = useRoleStore((s) => s.analysis);
  const roleBackgroundImage = useRoleStore((s) => s.roleBackgroundImage);
  const selectedRoleKey = useRoleStore((s) => s.selectedRole);
  const roleBgStyle = useMemo(
    () => bgStyleWithRoleImage(roleBackgroundImage),
    [roleBackgroundImage]
  );

  const top3ByDimension = useMirrorTop3();
  const addHighscoreEntry = useHighscoreStore((s) => s.addEntry);
  const roleProgress = useRoleProgressStore((s) =>
    selectedRoleKey ? s.goals[selectedRoleKey] ?? null : null
  );
  const setRoleGoalStatus = useRoleProgressStore((s) => s.setRoleGoalStatus);
  const setRoleBestScore = useRoleProgressStore((s) => s.setRoleBestScore);
  const previousBestScoreRef = useRef<number | null>(roleProgress?.bestScore ?? null);
  const { playSfx } = useAudioManager();
  const logger = useLogger();

  // Navigation guard disabled - game is complete, no progress to protect
  useNavigationGuard({
    enabled: false,
    screenName: "final_score_screen"
  });

  const breakdown: ScoreBreakdown =
    finalScoreCalculated && savedBreakdown ? savedBreakdown : liveBreakdown;

  const midLabel =
    analysis?.challengerSeat?.name || lang("FINAL_SCORE_POWER_HOLDERS_SUPPORT");

  const sequence: CategoryRenderInfo[] = useMemo(
    () => [
      {
        key: "people",
        label: lang("FINAL_SCORE_PUBLIC_SUPPORT"),
        detail: `${breakdown.support.people.percent}%`,
        points: breakdown.support.people.points,
        maxPoints: breakdown.support.people.maxPoints,
        icon: <Users className="h-6 w-6" />,
      },
      {
        key: "middle",
        label: midLabel,
        detail: `${breakdown.support.middle.percent}%`,
        points: breakdown.support.middle.points,
        maxPoints: breakdown.support.middle.maxPoints,
        icon: <Building2 className="h-6 w-6" />,
      },
      {
        key: "mom",
        label: lang("FINAL_SCORE_MOM_SUPPORT"),
        detail: `${breakdown.support.mom.percent}%`,
        points: breakdown.support.mom.points,
        maxPoints: breakdown.support.mom.maxPoints,
        icon: <Heart className="h-6 w-6" />,
      },
      {
        key: "corruption",
        label: lang("FINAL_SCORE_CORRUPTION"),
        detail: `${breakdown.corruption.normalizedLevel.toFixed(1)}/10`,
        points: breakdown.corruption.points,
        maxPoints: breakdown.corruption.maxPoints,
        icon: <ShieldCheck className="h-6 w-6" />,
      },
    ],
    [
      breakdown.support.people.points,
      breakdown.support.people.percent,
      breakdown.support.middle.points,
      breakdown.support.middle.percent,
      breakdown.support.mom.points,
      breakdown.support.mom.percent,
      breakdown.corruption.points,
      breakdown.corruption.normalizedLevel,
      breakdown.corruption.maxPoints,
      lang,
      midLabel,
    ]
  );

  const [displayValues, setDisplayValues] = useState<number[]>(
    () => new Array(sequence.length + 1).fill(0)
  );
  const displayValuesRef = useRef(displayValues);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(true);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  const [ratings, setRatings] = useState<{
    liberalism: AftermathRating;
    autonomy: AftermathRating;
  } | null>(null);

  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [isHallOfFame, setIsHallOfFame] = useState(false);

  const canGoBack = hasAftermathScreenSnapshot();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

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

  useEffect(() => {
    if (finalScoreCalculated && savedBreakdown) {
      const values = sequence.map((item) => item.points);
      setDisplayValues([...values, savedBreakdown.final]);
      setStep(sequence.length + 1);
      setRunning(false);
    } else {
      setDisplayValues(new Array(sequence.length + 1).fill(0));
      setStep(0);
      setRunning(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence.length, finalScoreCalculated]);

  useEffect(() => {
    displayValuesRef.current = displayValues;
  }, [displayValues]);

  useEffect(() => {
    if (previousBestScoreRef.current === null && roleProgress) {
      previousBestScoreRef.current = roleProgress.bestScore;
    }
  }, [roleProgress]);

  useEffect(() => {
    if (!running || step > sequence.length) return;

    const isFinalStep = step === sequence.length;
    const duration = isFinalStep ? 1200 : 900;
    const target = isFinalStep ? breakdown.final : sequence[step].points;
    const from =
      displayValuesRef.current[isFinalStep ? sequence.length : step] ?? 0;

    if (isFinalStep) {
      playSfx("drumroll");
    }

    const tick = (timestamp: number) => {
      if (startTimeRef.current === 0) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(1, elapsed / duration);
      const value = Math.round(easeNumber(from, target, progress));

      setDisplayValues((prev) => {
        const next = [...prev];
        next[isFinalStep ? sequence.length : step] = value;
        return next;
      });

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        startTimeRef.current = 0;
        requestAnimationFrame(() => setStep((prev) => prev + 1));
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, step, sequence, breakdown.final, playSfx]);

  useEffect(() => {
    if (step === sequence.length + 1) {
      setRunning(false);
    }
  }, [step, sequence.length]);

  useEffect(() => {
    if (step === sequence.length + 1 && !finalScoreCalculated) {
      saveFinalScore(breakdown);
    }
  }, [step, sequence.length, finalScoreCalculated, saveFinalScore, breakdown]);

  useEffect(() => {
    if (step !== sequence.length + 1 || !selectedRoleKey || !roleProgress) {
      return;
    }

    if (
      breakdown.final >= roleProgress.goal &&
      roleProgress.status !== "completed"
    ) {
      setRoleGoalStatus(selectedRoleKey, "completed");
    }

    setRoleBestScore(selectedRoleKey, breakdown.final);
  }, [
    step,
    sequence.length,
    selectedRoleKey,
    roleProgress,
    breakdown.final,
    setRoleGoalStatus,
    setRoleBestScore,
  ]);

  useEffect(() => {
    if (step === sequence.length + 1 && !finalScoreSubmitted && ratings) {
      const entry = buildHighscoreEntry(
        breakdown,
        character,
        analysis,
        ratings,
        top3ByDimension
      );

      addHighscoreEntry(entry);
      markScoreSubmitted();

      const freshEntries = useHighscoreStore.getState().entries;
      const rank = findPlayerRank(entry.name, breakdown.final, freshEntries);
      setPlayerRank(rank > 0 ? rank : null);
      setIsHallOfFame(rank > 0 && rank <= 20);

      loggingService.endSession();
      logger.log(
        "final_score_complete",
        {
          finalScore: breakdown.final,
          rank,
          isHallOfFame: rank > 0 && rank <= 20,
        },
        `Game completed - Final score: ${breakdown.final}, Rank: ${rank}`
      );
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

  useEffect(() => {
    if (finalScoreSubmitted && breakdown && character && playerRank === null) {
      const entries = useHighscoreStore.getState().entries;
      const rank = findPlayerRank(character.name, breakdown.final, entries);
      setPlayerRank(rank > 0 ? rank : null);
      setIsHallOfFame(rank > 0 && rank <= 20);
    }
  }, [finalScoreSubmitted, breakdown, character, playerRank]);

  const handleReplayAnimation = () => {
    clearFinalScore();
    setDisplayValues(new Array(sequence.length + 1).fill(0));
    setStep(0);
    setRunning(true);
    startTimeRef.current = 0;
  };

  const handleBackToAftermath = () => {
    audioManager.playSfx('click-soft');
    logger.log(
      "button_click_back_to_aftermath",
      {},
      "User clicked back to Aftermath"
    );
    push("/aftermath");
  };

  const handlePlayAgain = () => {
    audioManager.playSfx('click-soft');
    logger.log(
      "button_click_play_again",
      {
        previousScore: breakdown.final,
        previousRank: playerRank,
      },
      "User clicked Play Again"
    );
    useDilemmaStore.getState().reset();
    useRoleStore.getState().reset();
    useCompassStore.getState().reset();
    useMirrorQuizStore.getState().resetAll();
    clearAllSnapshots();
    push("/intro"); // Route to intro screen (to show fragment collection)
  };

  const handleVisitHallOfFame = () => {
    audioManager.playSfx('click-soft');
    logger.log(
      "button_click_visit_hall_of_fame",
      {
        playerScore: breakdown.final,
        playerRank,
      },
      "User clicked Visit Hall of Fame"
    );
    const playerName = character?.name || lang("FINAL_SCORE_UNKNOWN_LEADER");
    push(`/highscores?highlight=${encodeURIComponent(playerName)}`);
  };

  const finalScoreDisplay = displayValues[sequence.length];
  const previousHighScore = previousBestScoreRef.current ?? 0;
  const newHighScoreAchieved =
    step === sequence.length + 1 &&
    previousBestScoreRef.current !== null &&
    breakdown.final > previousBestScoreRef.current;
  const displayedHighScore = newHighScoreAchieved
    ? Math.max(breakdown.final, roleProgress?.bestScore ?? breakdown.final)
    : Math.max(roleProgress?.bestScore ?? 0, previousHighScore);

  return (
    <div className="min-h-screen px-5 py-8" style={roleBgStyle}>
      <div className="w-full max-w-3xl mx-auto space-y-6">
        {canGoBack && (
          <button
            onClick={handleBackToAftermath}
            className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20 text-white/90 transition-colors"
          >
            ← {lang("FINAL_SCORE_BACK_TO_AFTERMATH")}
          </button>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-white">
            {lang("FINAL_SCORE_TITLE")}
          </h1>
        </div>

        <ul className="space-y-4">
          {sequence.map((item, idx) => (
            <li key={item.key}>
              <CategoryCard
                icon={item.icon}
                label={item.label}
                detail={item.detail}
                points={displayValues[idx]}
                target={item.points}
                maxPoints={item.maxPoints}
                active={running && step === idx}
              />
            </li>
          ))}
        </ul>

        <motion.div
          layout
          className="rounded-2xl border border-yellow-400/40 bg-yellow-500/15 backdrop-blur-sm p-5 text-yellow-100 shadow-lg"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-300" />
              <div>
                <div className="text-xs uppercase tracking-wide text-yellow-200/70">
                  {lang("FINAL_SCORE")}
                </div>
                <div className="text-3xl font-extrabold tabular-nums">
                  {formatNumber.format(finalScoreDisplay)}
                </div>
                <div className="text-xs text-yellow-100/70">
                  / {formatNumber.format(breakdown.maxFinal)}
                </div>
              </div>
            </div>
            {selectedRoleKey && roleProgress ? (
              <HighScoreSummary
                label={lang("FINAL_SCORE_HIGH_SCORE")}
                newLabel={lang("FINAL_SCORE_NEW_HIGH_SCORE")}
                value={displayedHighScore}
                isNew={newHighScoreAchieved}
              />
            ) : null}
          </div>
        </motion.div>

        {playerRank && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 p-4 text-emerald-100 shadow">
            {isHallOfFame
              ? lang("FINAL_SCORE_HALL_OF_FAME_MESSAGE").replace(
                  "{rank}",
                  String(playerRank)
                )
              : lang("FINAL_SCORE_NOT_HALL_OF_FAME_MESSAGE")}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleReplayAnimation}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white/80 hover:bg-white/20 transition"
            disabled={running}
          >
            <RotateCcw className="h-4 w-4" />
            {lang("FINAL_SCORE_REPLAY_ANIMATION")}
          </button>
          <button
            onClick={handlePlayAgain}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-2 font-semibold text-white shadow-lg hover:from-amber-400 hover:to-orange-300 transition"
          >
            <ArrowRight className="h-4 w-4" />
            {lang("FINAL_SCORE_PLAY_AGAIN")}
          </button>
          <button
            onClick={handleVisitHallOfFame}
            className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-4 py-2 text-white/80 hover:bg-white/15 transition"
          >
            {lang("FINAL_SCORE_VISIT_HALL_OF_FAME")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({
  icon,
  label,
  detail,
  points,
  target,
  maxPoints,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  points: number;
  target: number;
  maxPoints: number;
  active: boolean;
}) {
  const progress = (() => {
    if (maxPoints <= 0) return 0;
    if (target < 0 || points < 0) {
      return Math.min(1, Math.abs(points) / maxPoints);
    }
    return Math.min(1, points / maxPoints);
  })();
  const maxPointsDisplay = target < 0 ? -maxPoints : maxPoints;
  return (
    <motion.div
      layout
      className={[
        "rounded-2xl border border-white/10 bg-white/10 backdrop-blur-sm p-4 shadow",
        active ? "ring-2 ring-white/30" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-white/15 p-3 text-white">{icon}</div>
        <div className="flex-1">
          <div className="text-base font-semibold text-white">{label}</div>
          <div className="text-xs text-white/60">{detail}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold tabular-nums text-white">
            {formatNumber.format(points)}
          </div>
          <div className="text-xs text-white/50">
            / {formatNumber.format(maxPointsDisplay)}
          </div>
        </div>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-300 via-amber-200 to-yellow-200 transition-all"
          style={{ width: `${Math.max(4, progress * 100)}%` }}
        />
      </div>
    </motion.div>
  );
}

function HighScoreSummary({
  label,
  newLabel,
  value,
  isNew,
}: {
  label: string;
  newLabel: string;
  value: number;
  isNew: boolean;
}) {
  return (
    <div className="text-right">
      <div className="text-xs uppercase tracking-wide text-yellow-200/70">{label}</div>
      <div className="text-2xl font-bold tabular-nums text-yellow-50">
        {value > 0 ? formatNumber.format(value) : "—"}
      </div>
      {isNew && (
        <div className="text-[11px] font-semibold text-emerald-200">{newLabel}</div>
      )}
    </div>
  );
}

function findPlayerRank(
  playerName: string,
  playerScore: number,
  entries: ReturnType<typeof useHighscoreStore.getState>["entries"]
): number {
  const playerIndex = entries.findIndex(
    (entry) => entry.name === playerName && entry.score === playerScore
  );
  return playerIndex >= 0 ? playerIndex + 1 : -1;
}
