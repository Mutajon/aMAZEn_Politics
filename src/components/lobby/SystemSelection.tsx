import React from 'react';
import { motion } from 'framer-motion';
import { FREE_PLAY_SYSTEMS } from '../../data/freePlaySystems';
import type { FreePlaySystem } from '../../data/freePlaySystems';

interface SystemSelectionProps {
    onSelect: (system: FreePlaySystem) => void;
    onSuggestOwn: () => void;
    disabled?: boolean;
}

const SystemSelection: React.FC<SystemSelectionProps> = ({ onSelect, onSuggestOwn, disabled }) => {
    return (
        <div className={`fixed inset-0 flex flex-col items-center w-full px-4 pt-[24vh] pb-12 space-y-10 overflow-y-auto scrollbar-hide z-10 transition-all duration-500 ${disabled ? 'blur-sm pointer-events-none opacity-40' : 'opacity-100'}`}>
            {/* Background Decorative Glow (subtle) */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/5 blur-[120px] rounded-full -z-10" />

            {/* List of systems in a responsive grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl relative z-10">
                {FREE_PLAY_SYSTEMS.map((system, index) => (
                    <motion.div
                        key={system.governanceSystem}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={disabled ? {} : { scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.08)" }}
                        whileTap={disabled ? {} : { scale: 0.98 }}
                        onClick={() => !disabled && onSelect(system)}
                        className={`flex items-center gap-5 bg-white/5 border border-white/10 p-4 sm:p-5 rounded-[24px] transition-all group backdrop-blur-sm ${disabled ? 'cursor-default' : 'cursor-pointer hover:border-amber-400/40'}`}
                    >
                        {/* Circle Image */}
                        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-amber-400/60 transition-colors shadow-2xl shrink-0">
                            <img
                                src={system.image}
                                alt={system.governanceSystem}
                                className="w-full h-full object-cover scale-110 grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500"
                                onError={(e: any) => {
                                    console.error("Image failed to load:", system.image);
                                }}
                            />
                            {/* Inner Highlight for depth */}
                            <div className="absolute inset-0 border-[3px] border-white/5 rounded-full pointer-events-none" />
                            <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent pointer-events-none" />
                        </div>

                        {/* Name and Setting info */}
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-amber-400 font-black uppercase tracking-[0.2em] text-[11px] sm:text-xs group-hover:text-amber-300 transition-colors truncate">
                                {system.governanceSystem}
                            </span>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-white/40 text-[9px] uppercase tracking-widest font-bold">
                                    {system.scenario}
                                </span>
                                <span className="text-white/20 text-[9px] font-bold">•</span>
                                <span className="text-white/40 text-[9px] uppercase tracking-widest font-bold">
                                    {system.year}
                                </span>
                            </div>
                        </div>

                        {/* Arrow hint */}
                        <div className="pr-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0">
                            <svg className="w-4 h-4 text-amber-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Suggest Your Own - at the bottom center */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="pt-2 pb-6"
            >
                <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 0 50px rgba(139, 92, 246, 0.4)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onSuggestOwn}
                    className="px-14 py-5 rounded-3xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white font-black uppercase tracking-[0.3em] text-[10px] shadow-2xl transition-all border border-white/20 hover:from-purple-500 hover:to-indigo-600 relative overflow-hidden group"
                >
                    <span className="relative z-10">Suggest Your Own</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                </motion.button>
            </motion.div>
        </div>
    );
};

export default SystemSelection;
