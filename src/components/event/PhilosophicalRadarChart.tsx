import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { PhilosophicalPole } from '../../store/dilemmaStore';
import { useLanguage } from '../../i18n/LanguageContext';

interface PhilosophicalRadarChartProps {
    values: Record<PhilosophicalPole, number>;
    size?: number;
}

const PhilosophicalRadarChart: React.FC<PhilosophicalRadarChartProps> = ({
    values,
    size = 400
}) => {
    const [selectedPole, setSelectedPole] = useState<PhilosophicalPole | null>(null);
    const [hoveredPole, setHoveredPole] = useState<PhilosophicalPole | null>(null);
    const { lang, language } = useLanguage();
    const isHe = language === 'he';

    const poles: PhilosophicalPole[] = [
        'democracy',
        'autonomy',
        'totalism',
        'oligarchy',
        'heteronomy',
        'liberalism'
    ];

    const colors: Record<PhilosophicalPole, string> = {
        democracy: '#c084fc', // purple-400
        autonomy: '#22d3ee', // cyan-400
        totalism: '#fb7185', // rose-400
        oligarchy: '#818cf8', // indigo-400
        heteronomy: '#34d399', // emerald-400
        liberalism: '#f472b6'  // pink-400
    };

    const getPoleTitle = (pole: PhilosophicalPole) => {
        const key = `PHILOSOPHICAL_POLE_${pole.toUpperCase()}_TITLE`;
        return lang(key);
    };

    const getPoleDesc = (pole: PhilosophicalPole) => {
        const key = `PHILOSOPHICAL_POLE_${pole.toUpperCase()}_DESC`;
        return lang(key);
    };

    const center = size / 2;
    const radius = size * 0.32; // Balanced hexagon size
    const labelRadius = radius + 35;
    const maxVal = 7;

    const getPoint = (index: number, value: number, rOverride?: number) => {
        const val = typeof value === 'number' && !isNaN(value) ? value : 0;
        const angle = (index * 60 - 90) * (Math.PI / 180);
        const r = rOverride !== undefined ? rOverride : (Math.max(0, val) / maxVal) * radius;
        return {
            x: center + r * Math.cos(angle),
            y: center + r * Math.sin(angle)
        };
    };

    // Animated values state
    const [animatedValues, setAnimatedValues] = useState<Record<PhilosophicalPole, number>>(() => {
        const zeroValues = {} as Record<PhilosophicalPole, number>;
        poles.forEach(pole => zeroValues[pole] = 0);
        return zeroValues;
    });

    useEffect(() => {
        // Small delay to allow the modal opening animation to start/complete a bit
        const timer = setTimeout(() => {
            setAnimatedValues(values);
        }, 150);
        return () => clearTimeout(timer);
    }, [values]);

    // Safe value extractor to ensure and clamp values
    const getSafeValue = (pole: PhilosophicalPole) => {
        const val = animatedValues[pole];
        if (typeof val !== 'number' || isNaN(val)) return 0;
        return Math.max(0, Math.min(maxVal, val));
    };

    const dataPoints = poles.map((pole, i) => getPoint(i, getSafeValue(pole)));
    const polygonPoints = dataPoints.map(p => {
        const x = typeof p.x === 'number' && !isNaN(p.x) ? p.x : center;
        const y = typeof p.y === 'number' && !isNaN(p.y) ? p.y : center;
        return `${x},${y}`;
    }).join(' ');

    // Grid levels
    const gridLevels = [1, 2, 3, 4, 5, 6, 7];

    return (
        <div className="relative flex flex-col items-center justify-center p-12 bg-black/40 rounded-[2.5rem] border border-white/10 backdrop-blur-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] overflow-hidden" style={{ width: size + 140, height: size + 100 }}>
            {/* Background Glows */}
            <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-1/2 h-1/2 bg-rose-500/10 blur-[100px] rounded-full pointer-events-none" />

            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible relative z-0">
                {/* Helper glow filter */}
                <defs>
                    <filter id="chart-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="5" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Grid levels */}
                {gridLevels.map(level => {
                    const points = poles.map((_, i) => {
                        const p = getPoint(i, level);
                        return `${p.x},${p.y}`;
                    }).join(' ');
                    return (
                        <polygon
                            key={level}
                            points={points}
                            fill="none"
                            stroke="white"
                            strokeOpacity={level === 7 ? 0.4 : 0.12}
                            strokeWidth={level === 7 ? 2 : 1}
                        />
                    );
                })}

                {/* Axis lines */}
                {poles.map((_, i) => {
                    const p = getPoint(i, maxVal);
                    return (
                        <line
                            key={i}
                            x1={center}
                            y1={center}
                            x2={p.x}
                            y2={p.y}
                            stroke="white"
                            strokeOpacity={0.15}
                            strokeWidth={1.5}
                        />
                    );
                })}

                {/* Data polygon */}
                <motion.polygon
                    points={polygonPoints}
                    fill="rgba(255, 255, 255, 0.1)"
                    stroke="white"
                    strokeWidth={4}
                    strokeLinejoin="round"
                    filter="url(#chart-glow)"
                    animate={{ points: polygonPoints }}
                    transition={{
                        duration: 1.5,
                        ease: [0.34, 1.56, 0.64, 1]
                    }}
                />

                {/* Value points */}
                {dataPoints.map((p, i) => {
                    const pole = poles[i];
                    const x = typeof p.x === 'number' && !isNaN(p.x) ? p.x : center;
                    const y = typeof p.y === 'number' && !isNaN(p.y) ? p.y : center;
                    const isHovered = hoveredPole === pole;

                    return (
                        <g key={pole}>
                            {/* Larger invisible hit area for easier interactions */}
                            <circle
                                cx={x} cy={y} r={15}
                                fill="transparent"
                                className="cursor-pointer"
                                onMouseEnter={() => setHoveredPole(pole)}
                                onMouseLeave={() => setHoveredPole(null)}
                                onClick={() => setSelectedPole(pole)}
                            />
                            {/* The actual visible dot */}
                            <motion.circle
                                cx={x}
                                cy={y}
                                r={isHovered ? 8 : 6}
                                fill={colors[pole]}
                                stroke="white"
                                strokeWidth={2}
                                filter="url(#chart-glow)"
                                animate={{ cx: x, cy: y, r: isHovered ? 8 : 6 }}
                                transition={{
                                    duration: 1.5,
                                    ease: [0.34, 1.56, 0.64, 1]
                                }}
                                className="pointer-events-none"
                            />
                        </g>
                    );
                })}
            </svg>

            {/* Hover Tooltip Pill */}
            <AnimatePresence>
                {hoveredPole && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -10 }}
                        className="absolute z-50 px-3 py-1 rounded-full bg-white/95 text-slate-900 text-[11px] font-bold shadow-xl border border-white pointer-events-none whitespace-nowrap"
                        style={{
                            left: `calc(50% + ${dataPoints[poles.indexOf(hoveredPole)].x - center}px)`,
                            top: `calc(50% + ${dataPoints[poles.indexOf(hoveredPole)].y - center}px - 28px)`,
                            transform: 'translateX(-50%)'
                        }}
                    >
                        {getPoleTitle(hoveredPole)} {getSafeValue(hoveredPole)}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Absolute positioned HTML Pills for better interactivity */}
            {poles.map((pole, i) => {
                const spreadBoost = (i === 0 || i === 3) ? 0 : 25; // Space out the diagonal axes
                const p = getPoint(i, maxVal, labelRadius + spreadBoost);

                return (
                    <motion.button
                        key={pole}
                        onClick={() => setSelectedPole(pole)}
                        onMouseEnter={() => setHoveredPole(pole)}
                        onMouseLeave={() => setHoveredPole(null)}
                        className="absolute z-10 px-3 py-1.5 rounded-full border border-white/5 bg-white/5 hover:bg-white/10 flex items-center gap-2 group transition-all"
                        style={{
                            left: `calc(50% + ${p.x - center}px)`,
                            top: `calc(50% + ${p.y - center}px)`,
                            borderColor: `${colors[pole]}20`,
                        }}
                        initial={{ x: "-50%", y: "-50%" }}
                    >
                        <span
                            className="text-[11px] font-black tracking-widest uppercase transition-colors"
                            style={{ color: colors[pole] }}
                        >
                            {getPoleTitle(pole)}
                        </span>
                        <span className="text-[11px] font-bold opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: colors[pole] }}>
                            {getSafeValue(pole)}
                        </span>
                    </motion.button>
                );
            })}

            {/* Definition Overlay */}
            <AnimatePresence>
                {selectedPole && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className={`absolute inset-x-6 bottom-6 z-20 p-5 rounded-2xl bg-slate-900/95 border border-white/20 shadow-2xl backdrop-blur-xl ${isHe ? 'text-right' : 'text-left'}`}
                        dir={isHe ? 'rtl' : 'ltr'}
                    >
                        <button
                            onClick={() => setSelectedPole(null)}
                            className={`absolute top-2 p-1 rounded-lg hover:bg-white/10 transition-colors ${isHe ? 'left-2' : 'right-2'}`}
                        >
                            <X className="w-4 h-4 text-white/50" />
                        </button>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: colors[selectedPole] }}>
                                {getPoleTitle(selectedPole)}
                            </span>
                            <p className="text-sm text-white/90 leading-relaxed font-medium">
                                {getPoleDesc(selectedPole)}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PhilosophicalRadarChart;
