import React from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useLang } from "../../i18n/lang";
import { FREE_PLAY_SYSTEMS } from '../../data/freePlaySystems';
import type { FreePlaySystem } from '../../data/freePlaySystems';
import { audioManager } from '../../lib/audioManager';
import { usePastGamesStore } from '../../store/pastGamesStore';

interface SystemSelectionProps {
    onSelect: (system: FreePlaySystem) => void;
    onSelectCustom: () => void;
    onLockedClick?: () => void;
    disabled?: boolean;
}

const SystemSelection: React.FC<SystemSelectionProps> = ({ onSelect, onSelectCustom, onLockedClick, disabled }) => {
    const lang = useLang();
    const [hasPlayedLobby, setHasPlayedLobby] = React.useState(false);
    const hasPastGames = usePastGamesStore((s) => s.games.length > 0);

    React.useEffect(() => {
        try {
            const stored = localStorage.getItem('lobby-games-played');
            if (stored && parseInt(stored, 10) > 0) {
                setHasPlayedLobby(true);
            }
        } catch (e) {
            // Ignore storage errors
        }
    }, []);

    const hasPlayed = hasPastGames || hasPlayedLobby;

    return (
        <div className={`fixed inset-0 flex flex-col items-center w-full px-4 pt-[24vh] pb-12 space-y-10 overflow-y-auto scrollbar-hide z-10 transition-all duration-500 opacity-100`}>
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
                        whileHover={disabled ? {} : {
                            boxShadow: "0 0 30px rgba(251, 191, 36, 0.2)",
                            zIndex: 20
                        }}
                        whileTap={disabled ? {} : { scale: 0.98 }}
                        onClick={() => !disabled && onSelect(system)}
                        className={`relative p-[1px] rounded-[24px] overflow-hidden transition-all group ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                        {/* Gradient Border Background */}
                        <div className={`absolute inset-0 bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 opacity-30 group-hover:opacity-100 transition-opacity duration-500`} />

                        {/* Inner Content Container (Navy Background) */}
                        <div className={`relative flex items-center gap-5 bg-gradient-to-br from-[#0c1a33] to-[#050c1a] p-4 sm:p-5 rounded-[23px] h-full w-full backdrop-blur-xl transition-all duration-300 ${disabled ? '' : 'group-hover:bg-gradient-to-br group-hover:from-[#11254a] group-hover:to-[#0a1833]'}`}>

                            {/* Circle Image */}
                            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-amber-400/20 group-hover:border-amber-400/60 transition-all duration-500 shadow-2xl shrink-0 group-hover:scale-110">
                                <img
                                    src={system.image}
                                    alt={system.governanceSystem}
                                    className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500 scale-110"
                                    onError={() => {
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
                                    {lang(system.governanceSystem)}
                                </span>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-white/60 text-[9px] uppercase tracking-widest font-bold">
                                        {lang(system.scenario)}
                                    </span>
                                    <span className="text-white/20 text-[9px] font-bold">•</span>
                                    <span className="text-white/60 text-[9px] uppercase tracking-widest font-bold">
                                        {lang(system.year)}
                                    </span>
                                </div>
                            </div>

                            {/* Arrow hint */}
                            <div className="pr-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0">
                                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
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
                    whileHover={!hasPlayed ? { scale: 1.02 } : { scale: 1.08, boxShadow: "0 0 60px rgba(139, 92, 246, 0.6)" }}
                    whileTap={!hasPlayed ? {} : { scale: 0.95 }}
                    onClick={() => {
                        if (!hasPlayed) {
                            audioManager.playSfx('click-soft');
                            if (onLockedClick) onLockedClick();
                            else alert(lang('LOBBY_SUGGEST_OWN_LOCKED_DESC'));
                            return;
                        }
                        onSelectCustom();
                    }}
                    className={`px-14 py-5 rounded-3xl bg-gradient-to-br transition-all border border-white/20 relative overflow-hidden group flex items-center gap-3 ${hasPlayed
                        ? 'from-purple-600 to-indigo-700 text-white font-black hover:from-purple-500 hover:to-indigo-600 shadow-2xl'
                        : 'from-gray-700 to-gray-800 text-white/40 cursor-default opacity-80'
                        }`}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                    {!hasPlayed && <Lock className="w-4 h-4 text-white/40" />}
                    <span className={`relative z-10 uppercase tracking-[0.3em] text-[10px] ${!hasPlayed ? 'font-bold' : 'font-black'}`}>
                        {lang('SUGGEST_YOUR_OWN')}
                    </span>
                </motion.button>
            </motion.div>
        </div>
    );
};

export default SystemSelection;
