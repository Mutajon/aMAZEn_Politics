import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Crown } from "lucide-react";
import type { CarouselItem } from "../../hooks/useRoleCarousel";
import { useLang } from "../../i18n/lang";
import { useRoleStore } from "../../store/roleStore";

interface RoleListItemProps {
    item: CarouselItem;
    isExpanded: boolean;
    onToggle: () => void;
    onConfirm: () => void;
    onOpenCustomRole?: () => void;
    userBestScore?: number | null;
    globalBestScore?: number | null;
}

export default function RoleListItem({
    item,
    isExpanded,
    onToggle,
    onConfirm,
    onOpenCustomRole,
    userBestScore,
    globalBestScore,
}: RoleListItemProps) {
    const lang = useLang();
    const character = useRoleStore((s) => s.character);
    const playerName = character?.name;

    const isCustom = item.type === 'customRole';

    // Determine goal color based on score goal
    const goalColorClass = (() => {
        if (!item.scoreGoal) return "text-white";
        switch (item.scoreGoal) {
            case 200: return "text-white";
            case 212: return "text-yellow-200";
            case 225: return "text-orange-200";
            case 250: return "text-orange-300";
            case 275: return "text-rose-200";
            default: return "text-white";
        }
    })();

    const statusCompleted = item.goalStatus === "completed";
    const statusClasses = statusCompleted
        ? "bg-gradient-to-r from-emerald-400/40 via-emerald-500/40 to-emerald-400/40 text-emerald-100 border border-emerald-300/40"
        : "bg-slate-800/60 text-slate-300 border border-slate-600/60";

    if (isCustom) {
        return (
            <div className="mb-4">
                <button
                    onClick={onOpenCustomRole}
                    className="w-full rounded-2xl p-5 flex items-center justify-between gap-4 bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 hover:from-purple-900/60 hover:to-indigo-900/60 transition-all duration-300 shadow-xl"
                >
                    <div className="flex items-center gap-4">
                        <span className="text-3xl">❓</span>
                        <div className="text-left">
                            <h3 className="text-[15px] font-cinzel font-bold bg-gradient-to-r from-purple-200 via-indigo-200 to-purple-300 bg-clip-text text-transparent">
                                {lang("SUGGEST_YOUR_OWN")}
                            </h3>
                            <p className="text-[12px] text-purple-200/60">Personalized historical or fictional scenario</p>
                        </div>
                    </div>
                </button>
            </div>
        );
    }

    return (
        <div className={`mb-4 overflow-hidden rounded-2xl border transition-all duration-300 ${isExpanded
            ? "bg-black/60 border-amber-400/50 shadow-2xl shadow-amber-400/10"
            : "bg-black/30 border-white/10 hover:border-white/20"
            }`}>
            {/* Header - Always visible */}
            <button
                onClick={onToggle}
                disabled={item.isLocked}
                className={`w-full text-left p-4 sm:p-5 flex items-center gap-4 relative ${item.isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
            >
                {/* Banner Preview (when collapsed) */}
                {!isExpanded && item.bannerImage && (
                    <div className="hidden sm:block w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-white/5">
                        <img src={item.bannerImage} alt="" className="w-full h-full object-cover" />
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm sm:text-base font-cinzel font-bold text-white truncate">
                            {item.title}
                        </h3>
                        {item.year && (
                            <span className="text-[10px] text-amber-300/80 font-light border border-amber-400/20 px-1.5 py-0.5 rounded">
                                {lang("YEAR")} {item.year}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Subtitle and status moved to expanded view */}
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                    {item.isLocked && <span className="text-xl">🔒</span>}
                </div>
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                        <div className="px-5 pb-5 pt-2 border-t border-white/5">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    {/* Moved from header */}
                                    <div className="flex flex-wrap items-center gap-3 mb-4">
                                        <p className="text-sm font-medium text-amber-200/90">
                                            {item.subtitle}
                                        </p>
                                        {item.goalStatus && (
                                            <span className={`text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-full font-medium ${statusClasses}`}>
                                                {statusCompleted ? lang("ROLE_GOAL_COMPLETED") : lang("ROLE_GOAL_UNCOMPLETED")}
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-sm text-white/90 leading-relaxed mb-4">
                                        {item.intro}
                                    </p>

                                    {playerName && (
                                        <div className="flex items-center text-xs py-3 border-t border-white/5">
                                            <span className="text-white/50 mr-2">{lang("PLAYER_NAME")}:</span>
                                            <span className="font-semibold text-amber-200">{playerName}</span>
                                        </div>
                                    )}

                                    {item.scoreGoal && (
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] py-3 border-t border-white/5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-white/50">{lang("ROLE_GOAL_TARGET_LABEL")}:</span>
                                                <span className={`font-bold ${goalColorClass}`}>
                                                    {item.scoreGoal.toLocaleString()}
                                                </span>
                                            </div>

                                            {userBestScore && userBestScore > 0 && (
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-400/20">
                                                    <Trophy className="w-3 h-3 text-amber-300" />
                                                    <span className="text-amber-300/80 font-bold">{userBestScore.toLocaleString()}</span>
                                                </div>
                                            )}

                                            {globalBestScore && globalBestScore > 0 && (
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-400/20">
                                                    <Crown className="w-3 h-3 text-purple-300" />
                                                    <span className="text-purple-300/80 font-bold">{globalBestScore.toLocaleString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        onClick={onConfirm}
                                        className="w-full mt-2 rounded-xl py-3.5 font-bold text-base shadow-lg bg-gradient-to-r from-amber-400 to-amber-600 text-[#0b1335] hover:from-amber-300 hover:to-amber-500 transition-all active:scale-[0.98]"
                                    >
                                        {lang("CONFIRM_ROLE")}
                                    </button>
                                </div>

                                {/* Optional: Full Image in Expanded View */}
                                {item.backgroundImage && (
                                    <div className="hidden md:block rounded-xl overflow-hidden border border-white/10 shadow-lg h-48 sm:h-auto">
                                        <img
                                            src={item.backgroundImage}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
