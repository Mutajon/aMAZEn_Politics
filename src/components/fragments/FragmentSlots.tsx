/**
 * src/components/fragments/FragmentSlots.tsx
 *
 * Displays 3 fragment collection slots at the top of IntroScreen
 * Shows empty puzzle pieces or collected avatar fragments
 * Features fall-in animation and bob animation for newly earned fragments
 */

import { motion, useAnimation } from "framer-motion";
import { Puzzle } from "lucide-react";
import { useFragmentsStore } from "../../store/fragmentsStore";
import { usePastGamesStore } from "../../store/pastGamesStore";
import type { PastGameEntry } from "../../lib/types/pastGames";
import { useEffect, useState } from "react";

interface FragmentSlotsProps {
  onFragmentClick?: (fragment: PastGameEntry, index: number) => void;
  onAnimationComplete?: () => void;
}

export default function FragmentSlots({
  onFragmentClick,
  onAnimationComplete,
}: FragmentSlotsProps) {
  const fragmentGameIds = useFragmentsStore((s) => s.fragmentGameIds);
  const pastGames = usePastGamesStore((s) => s.getGames());
  const [animationPhase, setAnimationPhase] = useState<
    "initial" | "falling" | "bobbing" | "complete"
  >("initial");

  // Get fragment data for each slot (max 3 slots)
  const slots = [0, 1, 2].map((index) => {
    const gameId = fragmentGameIds[index];
    if (!gameId) {
      return { index, isEmpty: true, game: null };
    }

    // Find the past game data
    const game = pastGames.find((g) => g.gameId === gameId);
    return { index, isEmpty: false, game: game || null };
  });

  // Find newest fragment (highest index with data)
  const newestFragmentIndex = slots
    .filter((s) => !s.isEmpty)
    .reduce((max, s) => Math.max(max, s.index), -1);

  // Trigger fall-in animation on mount
  useEffect(() => {
    // Start falling animation after brief delay
    const fallTimer = setTimeout(() => {
      setAnimationPhase("falling");
    }, 100);

    return () => clearTimeout(fallTimer);
  }, []);

  // After fall-in completes, trigger bob animation
  const handleFallInComplete = () => {
    if (animationPhase === "falling" && newestFragmentIndex >= 0) {
      setAnimationPhase("bobbing");
    } else if (animationPhase === "falling") {
      setAnimationPhase("complete");
      onAnimationComplete?.();
    }
  };

  // After bob completes
  const handleBobComplete = () => {
    if (animationPhase === "bobbing") {
      setAnimationPhase("complete");
      onAnimationComplete?.();
    }
  };

  return (
    <div className="absolute top-[232px] left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-6 md:gap-8">
        {slots.map((slot, idx) => (
          <FragmentSlot
            key={slot.index}
            index={slot.index}
            isEmpty={slot.isEmpty}
            game={slot.game}
            isNewest={slot.index === newestFragmentIndex}
            animationPhase={animationPhase}
            staggerDelay={idx * 150}
            onFallInComplete={idx === 2 ? handleFallInComplete : undefined}
            onBobComplete={
              slot.index === newestFragmentIndex
                ? handleBobComplete
                : undefined
            }
            onClick={() => {
              if (slot.game && onFragmentClick) {
                onFragmentClick(slot.game, slot.index);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface FragmentSlotProps {
  index: number;
  isEmpty: boolean;
  game: PastGameEntry | null;
  isNewest: boolean;
  animationPhase: "initial" | "falling" | "bobbing" | "complete";
  staggerDelay: number;
  onFallInComplete?: () => void;
  onBobComplete?: () => void;
  onClick: () => void;
}

function FragmentSlot({
  isEmpty,
  game,
  isNewest,
  animationPhase,
  staggerDelay,
  onFallInComplete,
  onBobComplete,
  onClick,
}: FragmentSlotProps) {
  const label = isEmpty ? "Missing Fragment" : "Fragment Collected";
  const controls = useAnimation();

  // Fall-in animation
  useEffect(() => {
    if (animationPhase === "falling" && !isEmpty) {
      controls.start({
        y: 0,
        opacity: 1,
        transition: {
          type: "spring",
          damping: 20,
          stiffness: 300,
          delay: staggerDelay / 1000,
        },
      });
    }
  }, [animationPhase, isEmpty, controls, staggerDelay]);

  // Bob animation (only for newest fragment)
  useEffect(() => {
    if (animationPhase === "bobbing" && isNewest && !isEmpty) {
      const bobSequence = async () => {
        // Bob 3 times
        for (let i = 0; i < 3; i++) {
          await controls.start({
            scale: 1.15,
            transition: { duration: 0.3, ease: "easeOut" },
          });
          await controls.start({
            scale: 1.0,
            transition: { duration: 0.3, ease: "easeIn" },
          });
          // Pause between bobs
          if (i < 2) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
        onBobComplete?.();
      };

      bobSequence();
    }
  }, [animationPhase, isNewest, isEmpty, controls, onBobComplete]);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Fragment Icon/Avatar */}
      <motion.div
        className={`
          w-[70px] h-[70px] md:w-[100px] md:h-[100px]
          rounded-lg
          flex items-center justify-center
          transition-all duration-300
          ${
            isEmpty
              ? "bg-gray-700/50 opacity-50"
              : "bg-gray-800/80 opacity-100 cursor-pointer hover:scale-110 hover:opacity-100"
          }
        `}
        onClick={isEmpty ? undefined : onClick}
        whileHover={isEmpty ? {} : { scale: 1.1 }}
        whileTap={isEmpty ? {} : { scale: 0.95 }}
        initial={isEmpty ? { opacity: 0.5 } : { y: -200, opacity: 0 }}
        animate={controls}
        onAnimationComplete={
          !isEmpty && onFallInComplete ? onFallInComplete : undefined
        }
      >
        {isEmpty ? (
          // Empty slot: Show puzzle piece icon
          <Puzzle className="w-10 h-10 md:w-14 md:h-14 text-gray-400" />
        ) : game?.avatarUrl ? (
          // Filled slot: Show avatar image
          <img
            src={game.avatarUrl}
            alt={game.playerName || "Fragment avatar"}
            className="w-full h-full object-cover rounded-lg"
            onError={(e) => {
              console.error("Fragment avatar failed to load:", game.gameId);
              // Hide broken image, show fallback
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          // Fallback if avatar missing
          <Puzzle className="w-10 h-10 md:w-14 md:h-14 text-gray-300" />
        )}
      </motion.div>

      {/* Label */}
      <motion.p
        className="text-[20px] md:text-2xl text-white/70 text-center font-medium max-w-[120px] md:max-w-[160px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {label}
      </motion.p>
    </div>
  );
}
