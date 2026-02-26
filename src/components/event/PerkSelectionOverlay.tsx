// src/components/event/PerkSelectionOverlay.tsx
// Full-screen overlay for perk selection when a star milestone is reached.
//
// Stars 1-3: Shows 2 random perks — player picks one.
// Star 4: Shows the ultimate "Sun King" perk — auto-revealed.
//
// Premium glassmorphism card design with animated card reveal.
//
// Connected to:
// - src/store/legacyStore.ts: Reads pendingStarIndex, perkChoices; calls choosePerk()
// - src/screens/EventScreen3.tsx: Rendered conditionally

import { motion, AnimatePresence } from "framer-motion";
import { useLegacyStore } from "../../store/legacyStore";
import { useRoleStore } from "../../store/roleStore";
import { useLang } from "../../i18n/lang";
import { audioManager } from "../../lib/audioManager";
import { Star, Sparkles, Crown } from "lucide-react";

export default function PerkSelectionOverlay() {
    const lang = useLang();
    const pendingStarIndex = useLegacyStore((s) => s.pendingStarIndex);
    const perkChoices = useLegacyStore((s) => s.perkChoices);
    const choosePerk = useLegacyStore((s) => s.choosePerk);
    const analysis = useRoleStore((s) => s.analysis);

    if (pendingStarIndex === null || !perkChoices || perkChoices.length === 0) {
        return null;
    }

    const isUltimate = pendingStarIndex === 3;
    const starNumber = pendingStarIndex + 1;

    const peopleName = (analysis?.holders && analysis.holders[2])
        ? analysis.holders[2].name
        : (lang("LOBBY_ENTITY_PEOPLE") || "The People");

    const formatDesc = (descKey: string) => {
        const text = lang(descKey) || descKey;
        return text.replace("{people}", peopleName);
    };

    const handleChoose = (perkId: string) => {
        audioManager.playSfx("achievement" as any);
        choosePerk(perkId);
    };

    return (
        <AnimatePresence>
            <motion.div
                key="perk-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

                {/* Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", damping: 20, stiffness: 250, delay: 0.2 }}
                    className="relative w-full max-w-lg z-10"
                >
                    {/* Header */}
                    <div className="text-center mb-6">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: [0, 1.3, 1] }}
                            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                            className="inline-flex items-center justify-center mb-3"
                        >
                            {isUltimate ? (
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.5)]">
                                    <Crown className="w-8 h-8 text-white" />
                                </div>
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_25px_rgba(251,191,36,0.4)]">
                                    <Star className="w-7 h-7 text-white fill-white" />
                                </div>
                            )}
                        </motion.div>

                        <motion.h2
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className={`text-2xl font-black uppercase tracking-widest ${isUltimate
                                ? "bg-gradient-to-r from-purple-300 to-purple-500 bg-clip-text text-transparent"
                                : "bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent"
                                }`}
                        >
                            {isUltimate
                                ? (lang("PERK_ULTIMATE_TITLE") || "Ultimate Power")
                                : (lang("PERK_STAR_EARNED_TITLE") || `Star ${starNumber} Earned!`)}
                        </motion.h2>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7 }}
                            className="text-white/60 text-sm mt-1"
                        >
                            {isUltimate
                                ? (lang("PERK_ULTIMATE_DESC") || "You've reached the pinnacle of legacy.")
                                : (lang("PERK_CHOOSE_DESC") || "Choose a perk to enhance your legacy:")}
                        </motion.p>
                    </div>

                    {/* Perk Cards */}
                    <div className={`grid gap-4 ${perkChoices.length === 1 ? "grid-cols-1 max-w-xs mx-auto" : "grid-cols-2"}`}>
                        {perkChoices.map((perk, i) => (
                            <motion.button
                                key={perk.id}
                                initial={{ opacity: 0, y: 40, rotateY: -90 }}
                                animate={{ opacity: 1, y: 0, rotateY: 0 }}
                                transition={{
                                    delay: 0.8 + i * 0.2,
                                    type: "spring",
                                    damping: 15,
                                    stiffness: 200,
                                }}
                                onClick={() => handleChoose(perk.id)}
                                className={`group relative p-5 rounded-3xl border text-left transition-all duration-300 overflow-hidden
                  ${isUltimate
                                        ? "bg-purple-900/40 border-purple-500/40 hover:border-purple-400/80 hover:bg-purple-900/60 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                                        : "bg-slate-800/60 border-amber-500/30 hover:border-amber-400/70 hover:bg-slate-800/80 hover:shadow-[0_0_20px_rgba(251,191,36,0.2)]"
                                    }
                  hover:scale-[1.03] active:scale-[0.98]
                  backdrop-blur-sm cursor-pointer
                `}
                            >
                                {/* Glow effect on hover */}
                                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${isUltimate
                                    ? "bg-gradient-to-t from-purple-500/10 via-transparent to-purple-500/5"
                                    : "bg-gradient-to-t from-amber-500/10 via-transparent to-amber-500/5"
                                    }`} />

                                {/* Icon */}
                                <div className="text-3xl mb-3 relative z-10">{perk.icon}</div>

                                {/* Name */}
                                <h3 className={`text-base font-black uppercase tracking-wider mb-2 relative z-10 ${isUltimate ? "text-purple-300" : "text-amber-300"
                                    }`}>
                                    {lang(perk.nameKey) || perk.nameKey}
                                </h3>

                                {/* Description */}
                                <p className="text-xs text-white/70 leading-relaxed relative z-10">
                                    {formatDesc(perk.descKey)}
                                </p>

                                {/* Sparkle indicator */}
                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Sparkles className={`w-4 h-4 ${isUltimate ? "text-purple-400" : "text-amber-400"}`} />
                                </div>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
