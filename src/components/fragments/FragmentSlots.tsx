/**
 * src/components/fragments/FragmentSlots.tsx
 *
 * Displays 3 fragment collection slots at the top of IntroScreen
 * Shows empty puzzle pieces or collected avatar fragments
 */

import { motion } from "framer-motion";
import { Puzzle } from "lucide-react";
import { useFragmentsStore } from "../../store/fragmentsStore";
import { usePastGamesStore } from "../../store/pastGamesStore";
import type { PastGameEntry } from "../../lib/types/pastGames";

interface FragmentSlotsProps {
  onFragmentClick?: (fragment: PastGameEntry, index: number) => void;
}

export default function FragmentSlots({ onFragmentClick }: FragmentSlotsProps) {
  const fragmentGameIds = useFragmentsStore((s) => s.fragmentGameIds);
  const pastGames = usePastGamesStore((s) => s.getGames());

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

  return (
    <div className="absolute top-[232px] left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-6 md:gap-8">
        {slots.map((slot) => (
          <FragmentSlot
            key={slot.index}
            index={slot.index}
            isEmpty={slot.isEmpty}
            game={slot.game}
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
  onClick: () => void;
}

function FragmentSlot({ isEmpty, game, onClick }: FragmentSlotProps) {
  const label = isEmpty ? "Missing Fragment" : "Fragment Collected";

  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
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
      >
        {isEmpty ? (
          // Empty slot: Show puzzle piece icon
          <Puzzle className="w-10 h-10 md:w-14 md:h-14 text-gray-400" />
        ) : game?.avatarUrl ? (
          // Filled slot: Show avatar image
          <img
            src={game.avatarUrl}
            alt={game.playerName}
            className="w-full h-full object-cover rounded-lg"
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
    </motion.div>
  );
}
