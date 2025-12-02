/**
 * src/components/fragments/ThreeShardComparison.tsx
 *
 * Side-by-side comparison popup showing all 3 completed game fragments.
 * Displayed when:
 * - Player completes 3rd shard and grandpa asks which version they prefer
 * - Returning player clicks any shard after collecting all 3
 *
 * Each card shows:
 * - Avatar thumbnail
 * - Character name
 * - Final score
 * - Top compass values
 * - Optional "I prefer this version" button
 */

import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Heart, Users, Building2 } from "lucide-react";
import type { PastGameEntry } from "../../lib/types/pastGames";
import { useLang } from "../../i18n/lang";
import { PROPERTIES, PALETTE, type PropKey } from "../../data/compass-data";
import { useFragmentsStore, type Fragment } from "../../store/fragmentsStore";

interface ThreeShardComparisonProps {
  /** All 3 completed game entries */
  games: PastGameEntry[];
  /** Close the popup */
  onClose: () => void;
  /** Show "I prefer this version" buttons (true after completing 3rd shard) */
  showPreferenceButtons: boolean;
  /** Callback when player selects their preferred version */
  onPreferenceSelected?: (gameId: string) => void;
}

export function ThreeShardComparison({
  games,
  onClose,
  showPreferenceButtons,
  onPreferenceSelected,
}: ThreeShardComparisonProps) {
  const lang = useLang();
  const fragments = useFragmentsStore((state) => state.fragments);

  // Ensure we have 1-3 games
  if (games.length < 1 || games.length > 3) {
    console.warn("[ThreeShardComparison] Expected 1-3 games, got", games.length);
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Content container */}
        <motion.div
          className="relative z-10 w-full max-w-5xl mx-auto"
          initial={{ y: 30, scale: 0.95, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 20, scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          {/* Header with title and close button */}
          <div className="flex items-center justify-center mb-6">
            <motion.h2
              className="text-white text-2xl sm:text-3xl font-serif italic"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}
            >
              {lang("THREE_SHARD_TITLE")}
            </motion.h2>
            <button
              onClick={onClose}
              className="ml-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Three cards side by side - always show all 3 slots */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {[0, 1, 2].map((slotIndex) => {
              const game = games[slotIndex];
              if (game) {
                return (
                  <GameCard
                    key={game.gameId}
                    game={game}
                    index={slotIndex}
                    fragments={fragments}
                    showPreferenceButton={showPreferenceButtons}
                    onPreferenceSelected={onPreferenceSelected}
                  />
                );
              }
              return <PlaceholderCard key={slotIndex} index={slotIndex} />;
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

interface GameCardProps {
  game: PastGameEntry;
  index: number;
  fragments: Fragment[];
  showPreferenceButton: boolean;
  onPreferenceSelected?: (gameId: string) => void;
}

function GameCard({
  game,
  index,
  fragments,
  showPreferenceButton,
  onPreferenceSelected,
}: GameCardProps) {
  const lang = useLang();

  // Find matching fragment for avatar thumbnail
  const matchingFragment = fragments.find(f => f.gameId === game.gameId);
  const avatarToShow = matchingFragment?.avatarThumbnail || game.avatarUrl;

  // Shard labels: Athens, North America, Mars
  const SHARD_LABELS = ["SHARD_LABEL_ATHENS", "SHARD_LABEL_NORTH_AMERICA", "SHARD_LABEL_MARS"];

  return (
    <motion.div
      className="rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 border border-white/10 backdrop-blur-md overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.1 }}
    >
      {/* Header with shard label */}
      <div className="px-4 py-2 bg-gradient-to-r from-amber-600/30 to-amber-500/20 border-b border-white/10">
        <h3 className="text-amber-200 text-sm font-medium text-center">
          {lang(SHARD_LABELS[index])}
        </h3>
      </div>

      {/* Circular avatar */}
      <div className="flex justify-center py-4">
        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 shadow-lg">
          {avatarToShow ? (
            <img
              src={avatarToShow}
              alt={game.playerName}
              className="w-full h-full object-cover"
            />
          ) : game.roleImageId ? (
            <img
              src={`/assets/images/BKGs/Roles/banners/${game.roleImageId}Banner.png`}
              alt={game.roleTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
          )}
        </div>
      </div>

      {/* Character name */}
      <h4 className="text-white text-lg font-semibold text-center px-3 truncate">
        {game.playerName}
      </h4>

      {/* Role title */}
      <p className="text-white/60 text-xs text-center px-3 mt-1 truncate">
        {game.roleTitle}
      </p>

      {/* Score */}
      <div className="flex items-center justify-center gap-2 mt-3">
        <Star className="w-5 h-5 text-amber-400" />
        <span className="text-white/60 text-sm">{lang("SCORE")}</span>
        <span className="text-amber-300 text-xl font-bold">
          {game.finalScore.toLocaleString()}
        </span>
      </div>

      {/* Support bars */}
      <div className="px-4 mt-4 space-y-2">
        <p className="text-white/50 text-xs mb-1">{lang("SUPPORT_VALUES")}</p>
        <SupportBar
          icon={<Users className="w-4 h-4 text-blue-400" />}
          value={game.supportPeople}
          color="bg-blue-500"
        />
        <SupportBar
          icon={<Building2 className="w-4 h-4 text-purple-400" />}
          value={game.supportMiddle}
          color="bg-purple-500"
        />
        <SupportBar
          icon={<Heart className="w-4 h-4 text-rose-400" />}
          value={game.supportMom}
          color="bg-rose-500"
        />
      </div>

      {/* Highlight pills */}
      {game.snapshotHighlights && game.snapshotHighlights.length > 0 && (
        <div className="px-4 mt-4">
          <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto pr-1">
            {game.snapshotHighlights.map((highlight, i) => (
              <span
                key={i}
                className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                  highlight.type === "positive"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                }`}
              >
                <span className="flex-shrink-0">{highlight.icon}</span>
                <span>{highlight.text}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top values by dimension */}
      {game.topCompassValues && game.topCompassValues.length > 0 && (
        <div className="px-4 mt-4 space-y-2">
          <p className="text-white/50 text-xs mb-2">{lang("TOP_VALUES")}</p>
          {PROPERTIES.map((prop) => {
            const valuesForDim = game.topCompassValues!.filter(
              (cv) => cv.dimension === prop.key
            );
            if (valuesForDim.length === 0) return null;
            const color = PALETTE[prop.key as PropKey].base;
            return (
              <div
                key={prop.key}
                className="rounded-lg px-2 py-1.5"
                style={{ backgroundColor: `${color}15`, borderLeft: `3px solid ${color}` }}
              >
                <p className="text-xs font-medium mb-1" style={{ color }}>
                  {prop.title}
                </p>
                <div className="flex flex-wrap gap-1">
                  {valuesForDim.map((cv, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded text-xs text-white/80"
                      style={{ backgroundColor: `${color}25` }}
                    >
                      {cv.componentName}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legacy text preview */}
      {game.legacy && (
        <p className="px-4 mt-3 text-white/50 text-xs italic line-clamp-2">
          "{game.legacy}"
        </p>
      )}

      {/* Self-evaluation */}
      {game.selfJudgment && (
        <div className="px-4 mt-3">
          <p className="text-white/50 text-xs mb-1">{lang("SELF_EVALUATION")}</p>
          <p className="text-purple-300 text-sm italic">
            "{game.selfJudgment}"
          </p>
        </div>
      )}

      {/* Preference button */}
      {showPreferenceButton && onPreferenceSelected && (
        <div className="p-4 mt-2">
          <button
            onClick={() => onPreferenceSelected(game.gameId)}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-900 font-semibold text-sm transition-all active:scale-[0.98]"
          >
            {lang("I_PREFER_THIS_VERSION")}
          </button>
        </div>
      )}

      {/* Spacing when no button */}
      {!showPreferenceButton && <div className="h-4" />}
    </motion.div>
  );
}

interface SupportBarProps {
  icon: React.ReactNode;
  value: number;
  color: string;
}

function SupportBar({ icon, value, color }: SupportBarProps) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="flex-1 h-2 rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="text-white/60 text-xs w-8 text-right">{value}%</span>
    </div>
  );
}

function PlaceholderCard({ index }: { index: number }) {
  const lang = useLang();
  const SHARD_LABELS = ["SHARD_LABEL_ATHENS", "SHARD_LABEL_NORTH_AMERICA", "SHARD_LABEL_MARS"];

  return (
    <motion.div
      className="rounded-2xl bg-gradient-to-br from-slate-900/60 via-slate-800/60 to-slate-900/60 border border-white/5 backdrop-blur-md overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.1 }}
    >
      {/* Header with shard label */}
      <div className="px-4 py-2 bg-gradient-to-r from-slate-600/30 to-slate-500/20 border-b border-white/5">
        <h3 className="text-slate-400 text-sm font-medium text-center">
          {lang(SHARD_LABELS[index])}
        </h3>
      </div>

      {/* Question mark placeholder */}
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <span className="text-4xl text-white/30">?</span>
        </div>
        <p className="mt-4 text-white/30 text-sm italic">
          {lang("SHARD_NOT_YET_EARNED")}
        </p>
      </div>
    </motion.div>
  );
}
