// src/components/PersonalMotivationsContent.tsx
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X } from "lucide-react";
import { useLang } from "../i18n/lang";
import { useLanguage } from "../i18n/LanguageContext";
import { COMPONENTS } from "../data/compass-data";

type ProjectHolder = {
    id: string;
    nameKey: string;
    descKey: string;
    percent: number;
};

interface PersonalMotivationsContentProps {
    distribution: number[];
    onChange: (newValues: number[]) => void;
    onSave: () => void;
    isSubmitting?: boolean;
}

export default function PersonalMotivationsContent({
    distribution,
    onChange,
    onSave,
    isSubmitting = false,
}: PersonalMotivationsContentProps) {
    const lang = useLang();
    const { language } = useLanguage();
    const isRTL = language === "he";

    const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

    // Map the 10 motivations from COMPONENTS.what
    const motivations: ProjectHolder[] = COMPONENTS.what.map((c, i) => ({
        id: c.short,
        nameKey: `COMPASS_VALUE_${c.short.replace("/", "_").replace(".", "").toUpperCase()}`,
        descKey: `COMPASS_VALUE_${c.short.replace("/", "_").replace(".", "").toUpperCase()}_FULL`,
        percent: distribution[i] || 0,
    }));

    const total = motivations.reduce((s, m) => s + m.percent, 0);

    const handleSliderChange = useCallback(
        (idx: number, newValue: number) => {
            const clamped = Math.max(0, Math.min(100, Math.round(newValue)));
            const newValues = [...distribution];
            newValues[idx] = clamped;

            const newTotal = newValues.reduce((s, v) => s + v, 0);

            if (newTotal > 100) {
                const excess = newTotal - 100;
                const othersSum = newTotal - clamped;

                if (othersSum > 0) {
                    const factor = (othersSum - excess) / othersSum;
                    for (let i = 0; i < newValues.length; i++) {
                        if (i !== idx) {
                            newValues[i] = Math.max(0, Math.round(newValues[i] * factor));
                        }
                    }

                    // Final adjustment for rounding errors
                    const finalTotal = newValues.reduce((s, v) => s + v, 0);
                    if (finalTotal !== 100) {
                        const diff = 100 - finalTotal;
                        for (let i = 0; i < newValues.length; i++) {
                            if (i !== idx && newValues[i] + diff >= 0 && newValues[i] + diff <= 100) {
                                newValues[i] += diff;
                                break;
                            }
                        }
                    }
                }
            }

            onChange(newValues);
        },
        [distribution, onChange]
    );

    return (
        <div className="relative z-10 flex flex-col min-h-full px-4 py-6 sm:px-8 w-full md:w-1/2 md:max-auto mx-auto bg-black/40 backdrop-blur-md rounded-3xl border border-white/5 my-4 overflow-hidden">
            {/* Header */}
            <div className="text-center mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-white mb-3 leading-relaxed">
                    {lang("MOTIVATIONS_Q_HEADER")}
                </h1>
                <p className="text-sm sm:text-base text-gray-300">
                    {lang("MOTIVATIONS_Q_SUBHEADER")}
                </p>
            </div>

            {/* List */}
            <div className="flex-1 space-y-3 mb-6">
                {motivations.map((m, idx) => (
                    <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/5 hover:border-white/10 transition-colors"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-white font-medium text-sm sm:text-base">
                                    {lang(m.nameKey)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setActiveTooltip(idx)}
                                    className="text-gray-400 hover:text-white transition-colors p-1"
                                >
                                    <HelpCircle className="w-4 h-4" />
                                </button>
                            </div>
                            <span className="text-white font-bold text-lg min-w-[3rem] text-center">
                                {m.percent}%
                            </span>
                        </div>

                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={m.percent}
                            onChange={(e) => handleSliderChange(idx, Number(e.target.value))}
                            className="w-full h-2 accent-amber-400 cursor-pointer"
                            style={{ direction: "ltr" }}
                        />
                    </motion.div>
                ))}
            </div>

            {/* Footer */}
            <div className="mt-auto space-y-4">
                {/* Total display */}
                <div className="text-center">
                    <span className={`text-sm ${total === 100 ? 'text-green-400' : 'text-amber-400'}`}>
                        {lang("MOTIVATIONS_Q_TOTAL_LABEL")}: <span className="text-white font-bold">{total}%</span>
                        {total !== 100 && (
                            <span className="ml-2 font-medium">
                                ({100 - total} {lang("MOTIVATIONS_Q_REMAINING")})
                            </span>
                        )}
                    </span>
                </div>

                {/* Submit Button */}
                <motion.button
                    onClick={onSave}
                    disabled={isSubmitting || total !== 100}
                    className={`
            w-full py-4 rounded-xl font-bold text-lg
            ${total === 100
                            ? "bg-gradient-to-r from-amber-400 to-amber-600 text-slate-900 shadow-lg shadow-amber-900/20"
                            : "bg-white/10 text-white/30 cursor-not-allowed"}
            transition-all active:scale-[0.98]
          `}
                    whileHover={total === 100 ? { scale: 1.01 } : {}}
                >
                    {isSubmitting ? "..." : lang("MOTIVATIONS_Q_BUTTON_SUBMIT")}
                </motion.button>
            </div>

            {/* Tooltip Portal-like */}
            <AnimatePresence>
                {activeTooltip !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
                        onClick={() => setActiveTooltip(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative bg-slate-900 rounded-2xl p-6 border border-white/10 shadow-2xl max-w-sm w-full"
                            dir={isRTL ? "rtl" : "ltr"}
                        >
                            <button
                                onClick={() => setActiveTooltip(null)}
                                className={`absolute top-3 ${isRTL ? "left-3" : "right-3"} text-white/40 hover:text-white transition-colors`}
                            >
                                <X className="w-6 h-6" />
                            </button>
                            <h3 className="text-amber-400 font-bold text-lg mb-3">
                                {lang(motivations[activeTooltip].nameKey)}
                            </h3>
                            <p className="text-white/80 text-base leading-relaxed">
                                {lang(motivations[activeTooltip].descKey)}
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
