import { motion, AnimatePresence } from "framer-motion";
import { X, Users } from "lucide-react";
import { useLang } from "../../i18n/lang";
import { useLanguage } from "../../i18n/LanguageContext";

interface CreditsPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

const CREDIT_ITEMS = [
    { nameKey: "CREDITS_UR_NAME", descKey: "CREDITS_UR_DESC" },
    { nameKey: "CREDITS_OR_NAME", descKey: "CREDITS_OR_DESC" },
    { nameKey: "CREDITS_JB_NAME", descKey: "CREDITS_JB_DESC" },
    { nameKey: "CREDITS_JM_NAME", descKey: "CREDITS_JM_DESC" },
    { nameKey: "CREDITS_IR_NAME", descKey: "CREDITS_IR_DESC" },
    { nameKey: "CREDITS_DS_NAME", descKey: "CREDITS_DS_DESC" },
    { nameKey: "CREDITS_DAR_NAME", descKey: "CREDITS_DAR_DESC" },
    { nameKey: "CREDITS_YN_NAME", descKey: "CREDITS_YN_DESC" },
];

export default function CreditsPopup({ isOpen, onClose }: CreditsPopupProps) {
    const lang = useLang();
    const { language } = useLanguage();
    const isRTL = language === 'he';

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 overflow-hidden">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="relative w-full max-w-2xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-indigo-950/30 border border-white/10 rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-8 pb-4 border-b border-white/5 flex items-center justify-between">
                            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                                    <Users className="w-6 h-6" />
                                </div>
                                <h2 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-indigo-200 via-white to-indigo-200 bg-clip-text text-transparent uppercase tracking-tight">
                                    {lang("CREDITS_TITLE")}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Body - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-8 pt-6 pb-12 space-y-8 scrollbar-hide">
                            <p className={`text-indigo-200/60 font-medium tracking-wide uppercase text-xs ${isRTL ? 'text-right' : 'text-left'}`}>
                                {lang("CREDITS_BOUGHT_TO_LIFE_BY")}
                            </p>

                            <div className="space-y-6">
                                {CREDIT_ITEMS.map((item, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, x: isRTL ? 10 : -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + idx * 0.05 }}
                                        className={`flex flex-col space-y-1 ${isRTL ? 'items-end text-right' : 'items-start text-left'}`}
                                    >
                                        <h3 className="text-lg md:text-xl font-bold text-white tracking-tight leading-snug">
                                            {lang(item.nameKey)}
                                        </h3>
                                        <p className="text-sm md:text-base font-serif italic text-indigo-300/80 leading-relaxed font-medium">
                                            {lang(item.descKey)}
                                        </p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Gradient Footer Blur */}
                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-neutral-900 to-transparent pointer-events-none" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
