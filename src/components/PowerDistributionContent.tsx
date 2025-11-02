/**
 * PowerDistributionContent.tsx
 *
 * Main UI rendering component for the PowerDistributionScreen.
 * Handles the power holder list, sliders, political system modal, and all interactive elements.
 *
 * Used by: PowerDistributionScreen.tsx
 * Uses: PowerDistributionIcons.tsx, framer-motion for animations
 */

import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { HelpCircle, Cog } from "lucide-react";
import { IconFromKey, getRankColor } from "./PowerDistributionIcons";
import type { EnhancedPowerHolder, FetchState } from "../hooks/usePowerDistributionState";
import { useRoleStore } from "../store/roleStore";
import { useLogger } from "../hooks/useLogger";

interface PowerDistributionContentProps {
  // State
  state: FetchState;
  error: string | null;
  holders: EnhancedPowerHolder[];
  playerHolderId: string | null;
  challengerSeatIndex: number | null; // NEW: Index of the primary institutional opponent
  systemName: string;
  systemDesc: string;
  systemFlavor: string;
  showSystemModal: boolean;
  groundingData?: {
    settingType: "real" | "fictional" | "unclear";
    era: string;
  };

  // Handlers
  onRetry: () => void;
  onChangePercent: (idx: number, value: number) => void;
  onChangeName: (id: string, name: string) => void;
  onReset: () => void;
  onLooksGood: () => void;
  onShowSystemModal: () => void;
  onHideSystemModal: () => void;
}

export default function PowerDistributionContent({
  state,
  error,
  holders,
  playerHolderId,
  challengerSeatIndex,
  systemName,
  systemDesc,
  systemFlavor,
  showSystemModal,
  groundingData,
  onRetry,
  onChangePercent,
  onChangeName,
  onReset,
  onLooksGood,
  onShowSystemModal,
  onHideSystemModal,
}: PowerDistributionContentProps) {
  const logger = useLogger();
  const character = useRoleStore((s) => s.character);

  // Determine if editing is enabled based on setting type
  const isRealSetting = groundingData?.settingType === "real";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* Error State */}
      {state === "error" && (
        <div className="bg-red-900/30 text-red-100 border border-red-700/40 rounded-xl p-4 flex items-start gap-3">
          <span className="mt-0.5">⚠️</span>
          <div className="flex-1">
            <p className="font-semibold">We couldn't analyze that setting.</p>
            <p className="text-sm opacity-90 mt-0.5">{error}</p>
          </div>
          <button
            onClick={onRetry}
            className="ml-2 rounded-lg bg-red-100/10 px-3 py-1.5 text-sm hover:bg-red-100/20"
          >
            Try again
          </button>
        </div>
      )}

      {/* Main Content */}
      <AnimatePresence>
        {state === "done" && (
          <motion.div
            key="results"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } }
            }}
            className="mt-2"
          >
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl font-extrabold text-center tracking-tight bg-gradient-to-r from-yellow-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                Top Power Holders In This Game
              </h1>
              {!isRealSetting && (
                <p className="text-center text-white/75 mt-1">
                  Not satisfied? Use sliders to adjust influence, or click names to edit.
                </p>
              )}

              {/* Political System row */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-white/85">
                <span className="font-semibold">Political system:</span>
                <button
                  onClick={() => {
                    logger.log('button_click_show_political_system', {
                      systemName
                    }, `User clicked to view political system: ${systemName}`);
                    onShowSystemModal();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10"
                  aria-label="Show political system details"
                >
                  <span className="font-semibold">{systemName || "—"}</span>
                  <HelpCircle className="w-4 h-4 text-amber-300" />
                </button>
              </div>
            </motion.div>

            {/* Power Holders List */}
            <LayoutGroup id="power-list">
              <div className="mt-6 space-y-4">
                {holders.map((h, i) => {
                  const rank = i + 1;
                  const isPlayer = playerHolderId != null && h._id === playerHolderId;
                  const isChallenger = challengerSeatIndex != null && i === challengerSeatIndex;

                  return (
                    <motion.div
                      key={h._id}
                      layout
                      layoutId={h._id}
                      transition={{ type: "spring", stiffness: 450, damping: 38 }}
                      className="border-slate-700/50 bg-black/60 backdrop-blur-sm ring-1 ring-amber-400/40 rounded-3xl p-4 relative"
                    >
                      <div className="flex items-center gap-3">
                        {/* Rank Badge */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white/95 text-sm font-semibold shrink-0"
                          style={{ backgroundColor: getRankColor(rank) }}
                        >
                          {rank}
                        </div>

                        {/* Icon or Avatar */}
                        <div className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                          {isPlayer && character?.avatarUrl ? (
                            <img
                              src={character.avatarUrl}
                              alt="Your avatar"
                              className="w-full h-full rounded-xl object-cover"
                            />
                          ) : (
                            <IconFromKey keyName={h.icon ?? undefined} className="w-5 h-5 text-amber-300" />
                          )}
                        </div>

                        {/* Name and Note */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              value={h.name}
                              onChange={(e) => {
                                logger.log('power_holder_name_change', {
                                  holderRank: rank,
                                  isPlayer,
                                  oldName: h.name,
                                  newName: e.target.value
                                }, `User changed power holder #${rank} name from "${h.name}" to "${e.target.value}"`);
                                onChangeName(h._id, e.target.value);
                              }}
                              disabled={isRealSetting}
                              className={`bg-transparent font-semibold outline-none flex-auto min-w-0 ${
                                isRealSetting ? 'text-white/60 cursor-not-allowed' : 'text-white/95'
                              }`}
                              placeholder="Enter a name…"
                              aria-label="Power holder name"
                            />

                            {isPlayer && (
                              <span className="text-amber-300 text-sm font-semibold whitespace-nowrap">
                                (That's you!)
                              </span>
                            )}

                            {isChallenger && (
                              <span className="text-rose-400 text-sm font-semibold whitespace-nowrap">
                                (Major Challenger)
                              </span>
                            )}
                          </div>
                          {h.note && <p className="text-sm text-white/60 mt-0.5 line-clamp-2">{h.note}</p>}
                        </div>

                        {/* Percentage Badge */}
                        <div className="shrink-0 ml-2">
                          <div className="px-2.5 py-1 rounded-xl bg-white/8 border border-white/10 text-white/90 text-sm font-semibold">
                            {h.percent}%
                          </div>
                        </div>
                      </div>

                      {/* Slider */}
                      <div className="mt-4">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={h.percent}
                          onChange={(e) => {
                            const newValue = Number(e.target.value);
                            logger.log('power_holder_percent_change', {
                              holderRank: rank,
                              holderName: h.name,
                              isPlayer,
                              oldPercent: h.percent,
                              newPercent: newValue
                            }, `User adjusted power holder #${rank} (${h.name}) from ${h.percent}% to ${newValue}%`);
                            onChangePercent(i, newValue);
                          }}
                          disabled={isRealSetting}
                          className={`w-full ${isRealSetting ? 'opacity-50 cursor-not-allowed' : 'accent-violet-500'}`}
                          aria-label={`Adjust ${h.name || "this holder"}'s influence`}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </LayoutGroup>

            {/* Action Buttons */}
            <div className={`flex items-center mt-6 ${isRealSetting ? 'justify-end' : 'justify-between'}`}>
              {!isRealSetting && (
                <button
                  onClick={() => {
                    logger.log('button_click_power_reset', {
                      currentHolders: holders.map(h => ({ name: h.name, percent: h.percent }))
                    }, 'User clicked Reset button on power distribution screen');
                    onReset();
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/7 active:scale-[.99] text-white/70"
                >
                  <Cog className="w-4 h-4" />
                  Reset
                </button>
              )}

              <button
                onClick={() => {
                  logger.log('button_click_power_looks_good', {
                    finalHolders: holders.map(h => ({ name: h.name, percent: h.percent }))
                  }, 'User confirmed power distribution and clicked "Looks good"');
                  onLooksGood();
                }}
                className="rounded-2xl px-5 py-3 font-semibold bg-yellow-300 hover:bg-yellow-200 text-[#0b1335] shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              >
                Looks good →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Political System Modal */}
      <AnimatePresence>
        {showSystemModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/55" onClick={onHideSystemModal} />
            <motion.div
              className="relative z-10 w-full max-w-lg rounded-3xl border border-white/10 bg-gradient-to-b from-[#1b1f3b] to-[#261c4a] p-5 shadow-2xl"
              initial={{ scale: 0.94, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.97, y: 6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="psys-title"
            >
              <div className="flex items-center justify-between">
                <h2 id="psys-title" className="text-2xl font-extrabold bg-gradient-to-r from-yellow-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                  {systemName}
                </h2>
                <button
                  onClick={() => {
                    logger.log('button_click_close_political_system_modal', {
                      systemName
                    }, 'User closed political system modal');
                    onHideSystemModal();
                  }}
                  className="rounded-xl px-2 py-1 bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                >
                  Close
                </button>
              </div>
              <p className="mt-3 text-white/85">{systemDesc}</p>
              {systemFlavor && (
                <p className="mt-3 italic text-amber-200/90">"{systemFlavor.replace(/^"|"$/g, "")}"</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
