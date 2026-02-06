import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame, Zap, Target, ArrowLeft, Sparkles } from 'lucide-react';
import { audioManager } from '../../lib/audioManager';

interface GameSettingsPopupProps {
    onClose: () => void;
    onStart: (settings: {
        difficulty: string;
        tone: string;
        emphasis: string;
        useBonusObjective: boolean;
    }) => void;
    bonusObjective: string;
}

const GameSettingsPopup: React.FC<GameSettingsPopupProps> = ({ onClose, onStart, bonusObjective }) => {
    const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
    const [tone, setTone] = useState<'drama' | 'comedy'>('drama');
    const [emphasis, setEmphasis] = useState("");
    const [useBonusObjective, setUseBonusObjective] = useState(false);
    const [isComedyFlipped, setIsComedyFlipped] = useState(false);

    // Handle Comedy Flip animation
    useEffect(() => {
        if (tone === 'comedy') {
            const timer = setTimeout(() => {
                setIsComedyFlipped(true);
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setIsComedyFlipped(false);
        }
    }, [tone]);

    const handleStart = () => {
        audioManager.playSfx("click-soft");
        onStart({
            difficulty,
            tone,
            emphasis: useBonusObjective ? "" : emphasis,
            useBonusObjective
        });
    };

    const handleSelectTone = (selectedTone: 'drama' | 'comedy') => {
        audioManager.playSfx("click-soft");
        if (selectedTone === 'comedy') {
            audioManager.playSfx("laugh-cartoon" as any);
        }
        setTone(selectedTone);
    };

    const handleDifficultySelect = (diff: 'easy' | 'normal' | 'hard') => {
        audioManager.playSfx("click-soft");
        setDifficulty(diff);
    };

    const isEmphasisDisabled = useBonusObjective;
    const isBonusDisabled = emphasis.trim().length > 0;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-6 pointer-events-none"
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-auto" onClick={onClose} />

            <div
                className="relative w-full max-w-2xl bg-[#0f1115]/95 border border-white/10 rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Section */}
                <div className="p-8 pb-4 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-center gap-3 mb-2"
                    >
                        <Flame className="w-5 h-5 text-amber-500" />
                        <h2 className="text-2xl font-black uppercase tracking-widest text-white italic">
                            Would you like to add some <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">spice?</span>
                        </h2>
                    </motion.div>
                </div>

                <div className="px-8 pb-8 space-y-8 overflow-y-auto max-h-[70vh] scrollbar-hide">

                    {/* 1. Difficulty Setting */}
                    <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold ml-1 flex items-center gap-2">
                            Difficulty Level
                        </label>
                        <div className="flex gap-2">
                            {(['easy', 'normal', 'hard'] as const).map((level) => {
                                const isSelected = difficulty === level;
                                const hues = {
                                    easy: isSelected ? 'bg-green-500 text-white border-green-400' : 'bg-green-500/10 text-green-400/60 border-green-500/20 hover:border-green-500/40',
                                    normal: isSelected ? 'bg-blue-500 text-white border-blue-400' : 'bg-blue-500/10 text-blue-400/60 border-blue-500/20 hover:border-blue-500/40',
                                    hard: isSelected ? 'bg-red-500 text-white border-red-400' : 'bg-red-500/10 text-red-400/60 border-red-500/20 hover:border-red-500/40'
                                };
                                return (
                                    <button
                                        key={level}
                                        onClick={() => handleDifficultySelect(level)}
                                        className={`flex-1 py-3 rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all border ${hues[level]} ${isSelected ? 'shadow-lg scale-[1.02]' : ''}`}
                                    >
                                        {level}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. Tone Selection */}
                    <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold ml-1">
                            Narrative Tone
                        </label>
                        <div className="grid grid-cols-2 gap-8 px-4">
                            {/* Drama Card */}
                            <button
                                onClick={() => handleSelectTone('drama')}
                                className={`group relative aspect-square transition-all duration-500 ${tone === 'drama'
                                    ? 'scale-[1.05]'
                                    : 'opacity-30 grayscale blur-[1px] hover:opacity-60 hover:grayscale-0 hover:blur-0'
                                    }`}
                            >
                                <img src="/assets/images/freePlay/drama.webp" className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110" alt="Drama" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white text-center px-4 shadow-black drop-shadow-md">Political Drama</span>
                                </div>
                                {tone === 'drama' && <div className="absolute top-1/4 right-1/4"><Sparkles className="w-4 h-4 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" /></div>}
                            </button>

                            {/* Comedy Card */}
                            <motion.button
                                onClick={() => handleSelectTone('comedy')}
                                animate={{ rotate: isComedyFlipped ? 180 : 0 }}
                                transition={{ type: "spring", damping: 15, stiffness: 100 }}
                                className={`group relative aspect-square transition-all duration-500 ${tone === 'comedy'
                                    ? 'scale-[1.05]'
                                    : 'opacity-30 grayscale blur-[1px] hover:opacity-60 hover:grayscale-0 hover:blur-0'
                                    }`}
                            >
                                <img src="/assets/images/freePlay/comedy.webp" className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110" alt="Comedy" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white text-center px-4 shadow-black drop-shadow-md">Political Comedy</span>
                                </div>
                                {tone === 'comedy' && <div className="absolute top-1/4 right-1/4"><Zap className="w-4 h-4 text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]" /></div>}
                            </motion.button>
                        </div>
                    </div>

                    {/* 3. Customization: Emphasis OR Bonus Objective */}
                    <div className="space-y-6 pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between gap-4">
                            {/* Option A: Emphasis */}
                            <div className={`flex-1 space-y-3 transition-opacity duration-300 ${isEmphasisDisabled ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                                <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold ml-1">
                                    Add Theme Emphasis
                                </label>
                                <textarea
                                    value={emphasis}
                                    onChange={(e) => setEmphasis(e.target.value)}
                                    placeholder="e.g. Focus on economic decay..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/30 transition-all resize-none h-24"
                                />
                            </div>

                            <div className="flex flex-col items-center gap-2">
                                <div className="h-10 w-px bg-white/10" />
                                <span className="text-[10px] font-black text-white/20 uppercase">OR</span>
                                <div className="h-10 w-px bg-white/10" />
                            </div>

                            {/* Option B: Bonus Objective */}
                            <div className={`flex-1 flex flex-col gap-3 transition-opacity duration-300 ${isBonusDisabled ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                                <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold ml-1">
                                    Apply Bonus Objective
                                </label>
                                <button
                                    onClick={() => {
                                        audioManager.playSfx("click-soft");
                                        setUseBonusObjective(!useBonusObjective);
                                    }}
                                    className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all min-h-[6rem] text-left ${useBonusObjective
                                        ? 'bg-purple-600/20 border-purple-500/50'
                                        : 'bg-white/5 border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <div className={`p-2 rounded-xl transition-colors ${useBonusObjective ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/20'}`}>
                                        <Target className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <span className={`block text-[8px] uppercase tracking-widest font-black mb-1 ${useBonusObjective ? 'text-purple-400' : 'text-white/20'}`}>
                                            Enabled
                                        </span>
                                        <p className={`text-[10px] leading-snug ${useBonusObjective ? 'text-white/90' : 'text-white/40'}`}>
                                            {bonusObjective || "N/A for this path"}
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 pt-4 flex justify-center">
                    <button
                        onClick={handleStart}
                        className="flex-1 max-w-sm py-4 rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] bg-gradient-to-r from-amber-500 to-orange-600 text-black hover:scale-[1.02] shadow-xl shadow-amber-950/20 transition-all flex items-center justify-center gap-2 group"
                    >
                        Start Your Story
                        <Zap className="w-4 h-4 fill-current transition-transform group-hover:scale-125" />
                    </button>
                </div>

                {/* Top Back Arrow */}
                <button
                    onClick={onClose}
                    className="absolute top-6 left-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all shadow-lg z-50"
                    title="Go Back"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
};

export default GameSettingsPopup;
