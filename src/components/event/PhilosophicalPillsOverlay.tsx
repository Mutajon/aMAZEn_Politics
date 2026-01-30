import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useAudioManager } from "../../hooks/useAudioManager";
import { useLanguage } from "../../i18n/LanguageContext";
import { useDilemmaStore, type PhilosophicalPole } from "../../store/dilemmaStore";

type Props = {
    pills: PhilosophicalPole[];
    loading: boolean;
    mirrorRef: React.RefObject<HTMLImageElement | null>;
    avatarRef: React.RefObject<HTMLButtonElement | null>;
    onAvatarHit?: () => void;
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
    mirrorRef,
    avatarRef,
    onAvatarHit,
}: Props) {
    const { playSfx } = useAudioManager();
    const { language } = useLanguage();
    const isRTL = language === 'he';

    // State to track which pills are currently animating
    const [activePills, setActivePills] = useState<PhilosophicalPole[]>([]);
    const [hasStarted, setHasStarted] = useState(false);

    // Track the flight progress of each pill
    const [pillSteps, setPillSteps] = useState<Record<number, 'spawn' | 'hover' | 'fly' | 'done'>>({});

    useEffect(() => {
        if (!loading && pills.length > 0 && !hasStarted) {
            setHasStarted(true);
            setActivePills(pills);
        } else if (loading || pills.length === 0) {
            setHasStarted(false);
            setActivePills([]);
            setPillSteps({});
        }
    }, [pills, loading, hasStarted]);

    // Handle step transitions for each pill
    const advanceStep = (index: number) => {
        setPillSteps(prev => {
            const current = prev[index] || 'spawn';
            if (current === 'spawn') return { ...prev, [index]: 'hover' };
            if (current === 'hover') return { ...prev, [index]: 'fly' };
            if (current === 'fly') {
                // Update actual store value
                const pole = activePills[index];
                if (pole) {
                    useDilemmaStore.getState().applyAxisPills([pole]);
                }

                if (onAvatarHit) onAvatarHit();
                playSfx('fragment-collected'); // Subtle hit sound
                return { ...prev, [index]: 'done' };
            }
            return prev;
        });
    };

    // Calculate positions
    const getPositions = () => {
        if (typeof window === 'undefined') return { mirror: { x: 0, y: 0 }, avatar: { x: 0, y: 0 } };

        const mirrorRect = mirrorRef.current?.getBoundingClientRect() || { left: 0, top: 0, width: 0, height: 0 };
        const avatarRect = avatarRef.current?.getBoundingClientRect() || { left: 0, top: 0, width: 0, height: 0 };

        return {
            mirror: {
                x: mirrorRect.left + mirrorRect.width / 2,
                y: mirrorRect.top + mirrorRect.height / 2
            },
            avatar: {
                x: avatarRect.left + avatarRect.width / 2,
                y: avatarRect.top + avatarRect.height / 2
            }
        };
    };

    const pos = getPositions();

    return (
        <div className="fixed inset-0 pointer-events-none z-[100]">
            <AnimatePresence>
                {activePills.map((pole, index) => {
                    const step = pillSteps[index] || 'spawn';
                    if (step === 'done') return null;

                    const label = POLE_LABELS[pole];
                    const bg = POLE_COLORS[pole];

                    return (
                        <motion.div
                            key={`${pole}-${index}`}
                            className="absolute rounded-full px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-lg border border-white/40"
                            style={{
                                background: bg,
                                color: "white",
                                left: 0,
                                top: 0,
                            }}
                            initial={{
                                opacity: 0,
                                scale: 0.5,
                                x: pos.mirror.x,
                                y: pos.mirror.y,
                            }}
                            animate={{
                                opacity: 1,
                                scale: 1,
                                // Hover logic
                                x: step === 'hover' ? pos.mirror.x + (isRTL ? 40 : -40) : (step === 'fly' ? pos.avatar.x : pos.mirror.x),
                                y: step === 'hover' ? pos.mirror.y - 40 : (step === 'fly' ? pos.avatar.y : pos.mirror.y),
                            }}
                            transition={{
                                delay: index * 0.3, // Successive creation
                                duration: step === 'fly' ? 0.6 : 1.0,
                                ease: step === 'fly' ? "circIn" : "easeOut"
                            }}
                            onAnimationComplete={() => advanceStep(index)}
                        >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>+{label}</span>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
