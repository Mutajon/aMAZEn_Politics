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
import { useEffect, useState, useRef } from "react";
import { audioManager } from "../../lib/audioManager";

interface FragmentSlotsProps {
  onFragmentClick?: (fragment: PastGameEntry, index: number) => void;
  onEmptySlotClick?: () => void;
  onAnimationComplete?: () => void;
  playAppearSound?: boolean; // Play fragmentsAppear sound when falling animation starts
}

export default function FragmentSlots({
  onFragmentClick,
  onEmptySlotClick,
  onAnimationComplete,
  playAppearSound = false,
}: FragmentSlotsProps) {
  const fragmentGameIds = useFragmentsStore((s) => s.fragmentGameIds);
  const hasClickedFragment = useFragmentsStore((s) => s.hasClickedFragment);
  const markFragmentClicked = useFragmentsStore((s) => s.markFragmentClicked);
  const pastGames = usePastGamesStore((s) => s.getGames());
  const [animationPhase, setAnimationPhase] = useState<
    "initial" | "falling" | "bobbing" | "complete"
  >("initial");
  const soundPlayedRef = useRef(false);

  // Show hint if user has fragments but hasn't clicked one yet
  const hasFragments = fragmentGameIds.length > 0;
  const showClickHint = hasFragments && !hasClickedFragment;

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
      // Play sound when fragments appear for the first time
      if (playAppearSound && !soundPlayedRef.current) {
        soundPlayedRef.current = true;
        audioManager.playSfx('fragments-appear');
      }
    }, 100);

    return () => clearTimeout(fallTimer);
  }, [playAppearSound]);

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

  // Handle case when all slots are empty - no fall animation will trigger
  useEffect(() => {
    if (animationPhase === "falling" && newestFragmentIndex === -1) {
      // No fragments to animate, complete immediately after brief delay
      const timer = setTimeout(() => {
        setAnimationPhase("complete");
        onAnimationComplete?.();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [animationPhase, newestFragmentIndex, onAnimationComplete]);

  return (
    <div className="absolute top-[232px] left-1/2 -translate-x-1/2 z-40">
      {/* Click hint for first-time users */}
      {showClickHint && (
        <motion.p
          className="text-center text-amber-300/90 text-sm mb-2 animate-pulse"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3.5, duration: 0.5 }}
        >
          Tap to learn more
        </motion.p>
      )}
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
              if (slot.isEmpty && onEmptySlotClick) {
                onEmptySlotClick();
              } else if (slot.game && onFragmentClick) {
                markFragmentClicked(); // Mark that user clicked a fragment
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
  const [showPulse, setShowPulse] = useState(false);

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

  // Enable pulse animation after intro animations complete (using timer to avoid state machine bugs)
  useEffect(() => {
    if (!isEmpty) {
      // Enable pulse after fall (~600ms) + bob (~2400ms) animations
      const timer = setTimeout(() => {
        console.log(`[FragmentSlot] Enabling pulse animation for collected fragment`);
        setShowPulse(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isEmpty]);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Fragment Icon/Avatar */}
      <motion.div
        className="w-[70px] h-[70px] md:w-[100px] md:h-[100px]"
        initial={isEmpty ? { opacity: 0.5 } : { y: -200, opacity: 0 }}
        animate={isEmpty ? { opacity: 0.5 } : controls}
        onAnimationComplete={
          !isEmpty && onFallInComplete ? onFallInComplete : undefined
        }
      >
        {/* Empty slot: motion.div with hover effects */}
        {isEmpty ? (
          <motion.div
            className="w-full h-full rounded-lg flex items-center justify-center overflow-hidden cursor-pointer bg-gray-700/50 opacity-50 hover:opacity-70"
            onClick={onClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Puzzle className="w-10 h-10 md:w-14 md:h-14 text-gray-400" />
          </motion.div>
        ) : (
          /* Collected fragment: regular div, pulse animation on image */
          <div
            className="w-full h-full rounded-lg flex items-center justify-center overflow-hidden cursor-pointer bg-gray-800/80"
            onClick={onClick}
          >
            {game?.roleImageId ? (
              <img
                src={`/assets/images/BKGs/Roles/banners/${game.roleImageId}Banner.png`}
                alt={game.roleTitle || "Fragment background"}
                className={`w-full h-full object-cover rounded-lg ${showPulse ? "animate-fragment-pulse" : ""}`}
                onError={(e) => {
                  console.error("Fragment banner failed to load:", game.roleImageId);
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : game?.avatarUrl ? (
              <img
                src={game.avatarUrl}
                alt={game.playerName || "Fragment avatar"}
                className={`w-full h-full object-cover rounded-lg ${showPulse ? "animate-fragment-pulse" : ""}`}
                onError={(e) => {
                  console.error("Fragment avatar failed to load:", game.gameId);
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <Puzzle className={`w-10 h-10 md:w-14 md:h-14 text-gray-300 ${showPulse ? "animate-fragment-pulse" : ""}`} />
            )}
          </div>
        )}
      </motion.div>

      {/* Label */}
      <motion.p
        className={`
          text-[20px] md:text-2xl text-center font-medium max-w-[120px] md:max-w-[160px]
          ${
            isEmpty
              ? "text-white/70"
              : "animate-shimmer-text"
          }
        `}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {label}
      </motion.p>
    </div>
  );
}
