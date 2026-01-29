import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck } from "lucide-react";
import { useAudioManager } from "../../hooks/useAudioManager";
import { useLanguage } from "../../i18n/LanguageContext";
import type { PhilosophicalPole } from "../../store/dilemmaStore";

type Props = {
    pills: PhilosophicalPole[];
    loading: boolean;
};

const POLE_LABELS: Record<PhilosophicalPole, string> = {
    democracy: 'Democracy',
    autonomy: 'Autonomy',
    totalism: 'Totalism',
    oligarchy: 'Oligarchy',
    heteronomy: 'Heteronomy',
    liberalism: 'Liberalism'
};

const POLE_COLORS: Record<PhilosophicalPole, string> = {
    democracy: '#8b5cf6', // purple
    autonomy: '#06b6d4', // cyan-500
    totalism: '#ec4899', // pink-500
    oligarchy: '#6366f1', // indigo-500
    heteronomy: '#2dd4bf', // teal-400
    liberalism: '#f43f5e'  // rose-500
};

export default function PhilosophicalPillsOverlay({
    pills,
    loading,
}: Props) {
    const { playSfx } = useAudioManager();
    const { language } = useLanguage();
    const isRTL = language === 'he';

    const [expanded, setExpanded] = useState<boolean>(true);

    const batchKey = useMemo(() => pills.join("|"), [pills]);

    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (loading || pills.length === 0) {
            setExpanded(false);
            if (timerRef.current) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        setExpanded(true);
        playSfx('achievement');

        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
            setExpanded(false);
            timerRef.current = null;
        }, 2500) as unknown as number;

        return () => {
            if (timerRef.current) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [batchKey, loading, pills.length, playSfx]);

    const hasPills = pills.length > 0;

    const buttonPosition = {
        x: isRTL ? 190 : -190,
        y: 0
    };

    return (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-30">
            {loading && (
                <div className="flex items-center justify-center text-white/50">
                    <span className="inline-block w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                </div>
            )}

            {!loading && hasPills && (
                <AnimatePresence mode="popLayout">
                    {expanded ? (
                        <motion.div
                            key="pills-expanded"
                            className="pointer-events-auto absolute flex flex-col items-center gap-2"
                            style={{
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                            }}
                        >
                            <motion.button
                                type="button"
                                onClick={() => setExpanded(false)}
                                className="
                  absolute -top-1 -left-20 z-10
                  w-8 h-8 rounded-full
                  bg-white/20 hover:bg-white/30
                  backdrop-blur-sm border border-white/40
                  flex items-center justify-center
                  transition-colors cursor-pointer
                  focus:outline-none
                "
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                transition={{ duration: 0.2 }}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <X className="w-5 h-5 text-white" />
                            </motion.button>

                            {pills.map((pole, index) => {
                                const label = POLE_LABELS[pole];
                                const bg = POLE_COLORS[pole];
                                const stackOffset = (index - pills.length / 2 + 0.5) * 36;

                                return (
                                    <motion.button
                                        key={`${pole}-${index}`}
                                        type="button"
                                        onClick={() => setExpanded(false)}
                                        className="rounded-full px-3 py-1.5 text-xs font-bold focus:outline-none absolute flex items-center gap-1.5"
                                        style={{
                                            background: bg,
                                            color: "white",
                                            border: "1.5px solid rgba(255,255,255,0.9)",
                                            boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
                                            whiteSpace: "nowrap",
                                            top: "50%",
                                            left: "50%",
                                        }}
                                        initial={{
                                            opacity: 0,
                                            scale: 0.1,
                                            x: buttonPosition.x,
                                            y: buttonPosition.y,
                                        }}
                                        animate={{
                                            opacity: 1,
                                            scale: 1,
                                            x: -60,
                                            y: stackOffset - 15,
                                        }}
                                        exit={{
                                            opacity: 0,
                                            scale: 0.1,
                                            x: buttonPosition.x,
                                            y: buttonPosition.y,
                                        }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 25,
                                            delay: index * 0.08,
                                        }}
                                    >
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span>+{label}</span>
                                    </motion.button>
                                );
                            })}
                        </motion.div>
                    ) : (
                        <motion.button
                            key="pills-collapsed"
                            type="button"
                            onClick={() => setExpanded(true)}
                            className="
                pointer-events-auto
                absolute top-1/2 -translate-y-1/2
                inline-flex items-center justify-center
                w-9 h-9 rounded-full
                text-white text-base font-bold
                focus:outline-none
                border border-white/30
              "
                            style={{
                                left: isRTL ? 'auto' : '0px',
                                right: isRTL ? '0px' : 'auto',
                                transform: `translateY(-50%) ${isRTL ? 'translateX(130%)' : 'translateX(-130%)'}`,
                                background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                                boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                            }}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{
                                opacity: 1,
                                scale: [0.5, 1.15, 1],
                            }}
                            exit={{
                                opacity: 0,
                                scale: [1, 1.2, 0.5],
                            }}
                            transition={{
                                duration: 0.4,
                                times: [0, 0.5, 1],
                                ease: "easeOut",
                            }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            +
                        </motion.button>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
}
