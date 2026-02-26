import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
    id: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    delay: number;
}

export default function SupportToLegacyParticles({
    active,
    sourceIds
}: {
    active: boolean;
    sourceIds: string[]
}) {
    const [particles, setParticles] = useState<Particle[]>([]);

    useEffect(() => {
        if (!active) {
            setParticles([]);
            return;
        }

        const targetEl = document.getElementById('legacy-bar-edge');
        if (!targetEl) return;

        const targetRect = targetEl.getBoundingClientRect();
        const tX = targetRect.right; // Aim for the growing edge
        const tY = targetRect.top + targetRect.height / 2;

        const newParticles: Particle[] = [];

        sourceIds.forEach((sid, sourceIdx) => {
            const sourceEl = document.getElementById(sid);
            if (!sourceEl) return;

            const sourceRect = sourceEl.getBoundingClientRect();
            const sX = sourceRect.left + sourceRect.width / 2;
            const sY = sourceRect.top + sourceRect.height / 2;

            // Spawn 10-15 particles per source
            for (let i = 0; i < 12; i++) {
                newParticles.push({
                    id: `${sid}-${i}-${Math.random()}`,
                    x: sX,
                    y: sY,
                    targetX: tX,
                    targetY: tY,
                    delay: sourceIdx * 0.2 + (i * 0.05),
                });
            }
        });

        setParticles(newParticles);
    }, [active, sourceIds]);

    return (
        <div className="fixed inset-0 pointer-events-none z-[100]">
            <AnimatePresence>
                {particles.map((p) => (
                    <motion.div
                        key={p.id}
                        initial={{
                            x: p.x,
                            y: p.y,
                            scale: 0,
                            opacity: 0,
                            filter: "blur(0px)"
                        }}
                        animate={{
                            // 1. Burst around the number
                            x: [p.x, p.x + (Math.random() - 0.5) * 60, p.targetX],
                            y: [p.y, p.y + (Math.random() - 0.5) * 60, p.targetY],
                            scale: [0, 1.2, 0.4],
                            opacity: [0, 1, 0.8, 0],
                            filter: ["blur(0px)", "blur(1px)", "blur(0px)"]
                        }}
                        transition={{
                            duration: 1.2,
                            delay: p.delay,
                            ease: [0.16, 1, 0.3, 1]
                        }}
                        className="absolute top-0 left-0 w-2 h-2 rounded-full bg-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.8)]"
                    />
                ))}
            </AnimatePresence>
        </div>
    );
}
