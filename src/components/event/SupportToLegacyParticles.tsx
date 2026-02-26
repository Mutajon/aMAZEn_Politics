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
    sourceIds,
    lpChange,
}: {
    active: boolean;
    sourceIds: string[];
    lpChange?: number;
}) {
    const [particles, setParticles] = useState<Particle[]>([]);
    const [centerStartPoint, setCenterStartPoint] = useState<{ x: number, y: number } | null>(null);
    const [targetPoint, setTargetPoint] = useState<{ x: number, y: number } | null>(null);

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

        setTargetPoint({ x: tX, y: tY });

        const newParticles: Particle[] = [];
        let sumX = 0, sumY = 0, sourceCount = 0;

        sourceIds.forEach((sid, sourceIdx) => {
            const sourceEl = document.getElementById(sid);
            if (!sourceEl) return;

            const sourceRect = sourceEl.getBoundingClientRect();
            const sX = sourceRect.left + sourceRect.width / 2;
            const sY = sourceRect.top + sourceRect.height / 2;

            sumX += sX; sumY += sY; sourceCount++;

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

        if (sourceCount > 0) {
            setCenterStartPoint({ x: sumX / sourceCount, y: sumY / sourceCount - 40 }); // slightly above center
        }

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

                {/* Animated Number Flowing to Bar */}
                {lpChange !== undefined && lpChange !== 0 && centerStartPoint && targetPoint && (
                    <motion.div
                        key="lp-change-text"
                        initial={{
                            x: centerStartPoint.x,
                            y: centerStartPoint.y,
                            scale: 0.5,
                            opacity: 0
                        }}
                        animate={{
                            x: [centerStartPoint.x, centerStartPoint.x + (targetPoint.x - centerStartPoint.x) * 0.5, targetPoint.x],
                            y: [centerStartPoint.y, centerStartPoint.y - 60, targetPoint.y],
                            scale: [0.5, 1.4, 1.0],
                            opacity: [0, 1, 1, 0]
                        }}
                        transition={{
                            duration: 1.8,
                            delay: 0.3, // slight delay to align with particle flight
                            ease: [0.25, 1, 0.5, 1] // smooth easeOut
                        }}
                        className={`absolute top-0 left-0 text-xl md:text-2xl font-black drop-shadow-md z-10 
                            ${lpChange > 0 ? "text-purple-300" : "text-gray-300"}`}
                        style={{ marginLeft: '-15px', marginTop: '-15px' }} // center alignment
                    >
                        {lpChange > 0 ? `+${lpChange}` : lpChange}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
