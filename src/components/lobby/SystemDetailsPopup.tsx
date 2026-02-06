import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Shield, Info } from 'lucide-react';
import type { FreePlaySystem } from '../../data/freePlaySystems';
import { audioManager } from '../../lib/audioManager';

interface SystemDetailsPopupProps {
    system: FreePlaySystem;
    onClose: () => void;
    onContinue: (data: {
        characterName: string;
        role: string;
        avatar: string;
    }) => void;
}

const AVATARS = [
    "roman_senator", "pharaoh", "medieval_king", "asian_emperor", "african_king",
    "washington", "lincoln_young", "victorian_man", "civil_rights_leader",
    "president_elder", "politician_man", "entrepreneur", "young_professional",
    "elizabethan_queen", "suffragette", "businesswoman", "activist_elder",
    "politician_woman", "elder_woman", "young_activist"
];

const SystemDetailsPopup: React.FC<SystemDetailsPopupProps> = ({ system, onClose, onContinue }) => {
    const [characterName, setCharacterName] = useState("");
    const [avatarIndex, setAvatarIndex] = useState(0);
    const [role, setRole] = useState<'Leader' | 'Commoner'>(() =>
        system.governanceSystem === "Direct Democracy" ? 'Commoner' : 'Leader'
    );

    const nextAvatar = () => {
        audioManager.playSfx("click-soft");
        setAvatarIndex((prev) => (prev + 1) % AVATARS.length);
    };
    const prevAvatar = () => {
        audioManager.playSfx("click-soft");
        setAvatarIndex((prev) => (prev - 1 + AVATARS.length) % AVATARS.length);
    };

    const handleClose = () => {
        audioManager.playSfx("click-soft");
        onClose();
    };

    const handleRoleSelect = (r: 'Leader' | 'Commoner') => {
        audioManager.playSfx("click-soft");
        setRole(r);
    };

    const bkgImage = system.image.replace('Circle', 'BKG');

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 pointer-events-auto"
        >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl pointer-events-auto" onClick={handleClose} />

            <div
                className="relative w-full max-w-4xl bg-[#0f1115] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-auto max-h-[90vh] pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Left Side: Background Preview */}
                <div className="w-full md:w-2/5 relative h-48 md:h-auto overflow-hidden">
                    <motion.img
                        src={bkgImage}
                        alt={system.scenario}
                        className="w-full h-full object-cover opacity-60"
                        animate={{
                            scale: [1.05, 1.15, 1.05],
                        }}
                        transition={{
                            duration: 20,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#0f1115] via-transparent to-transparent md:to-transparent" />

                    <div className="absolute bottom-6 left-6 right-6">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-500/60 font-black mb-1">Example Venue</div>
                        <h3 className="text-2xl font-black text-white leading-tight">
                            {system.scenario} <span className="text-white/30 text-lg ml-1">({system.year})</span>
                        </h3>
                        <p className="mt-3 text-sm text-white/50 leading-relaxed italic border-l-2 border-amber-500/20 pl-4">
                            "{system.intro}"
                        </p>
                    </div>
                </div>

                {/* Right Side: Setup Controls */}
                <div className="flex-1 p-6 md:p-10 flex flex-col overflow-y-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                                <Shield className="w-4 h-4" />
                            </span>
                            <h2 className="text-3xl font-black uppercase tracking-tighter text-amber-400">
                                {system.governanceSystem}
                            </h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="space-y-1 bg-blue-900/20 border border-blue-500/30 p-3 rounded-xl">
                                <span className="text-[9px] uppercase tracking-[0.2em] text-blue-300 font-bold block">Source of Power</span>
                                <span className="text-xs text-blue-100/80 font-medium leading-tight block">{system.sourceOfAuthority}</span>
                            </div>
                            <div className="space-y-1 bg-red-900/20 border border-red-500/30 p-3 rounded-xl">
                                <span className="text-[9px] uppercase tracking-[0.2em] text-red-300 font-bold block">Primary Weakness</span>
                                <span className="text-xs text-red-100/80 font-medium leading-tight block">{system.primaryWeakness}</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-white/5 mb-8" />

                    {/* Setup Form */}
                    <div className="space-y-8 flex-1">

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            {/* Name Input */}
                            <div className="space-y-3">
                                <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold ml-1">
                                    Who would you like to be?
                                </label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Enter your name..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-medium"
                                    value={characterName}
                                    onChange={(e) => setCharacterName(e.target.value)}
                                />
                            </div>

                            {/* Avatar Picker */}
                            <div className="space-y-3">
                                <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold ml-1">
                                    Choose your face
                                </label>
                                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-2 h-[66px]">
                                    <button onClick={prevAvatar} className="p-2 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-colors">
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 bg-black/40">
                                        <img
                                            src={`/assets/images/avatars/${AVATARS[avatarIndex]}.png`}
                                            alt="Avatar"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <button onClick={nextAvatar} className="p-2 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-colors">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Role Selection */}
                        <div className="space-y-4">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold ml-1">
                                Your Status in Society
                            </label>
                            <div className="flex gap-3">
                                {system.governanceSystem !== "Direct Democracy" && (
                                    <button
                                        onClick={() => handleRoleSelect('Leader')}
                                        className={`flex-1 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all border ${role === 'Leader'
                                            ? 'bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-500/20'
                                            : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                                            }`}
                                    >
                                        Leader
                                    </button>
                                )}
                                <button
                                    onClick={() => handleRoleSelect('Commoner')}
                                    className={`flex-1 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all border ${role === 'Commoner'
                                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20'
                                        : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                                        }`}
                                >
                                    Commoner
                                </button>
                            </div>

                            {/* Experience Blurb */}
                            <motion.div
                                key={role}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`rounded-2xl p-5 border flex gap-4 transition-colors duration-300 ${role === 'Leader'
                                    ? 'bg-amber-500/10 border-amber-500/20'
                                    : 'bg-purple-600/10 border-purple-600/20'
                                    }`}
                            >
                                <Info className={`w-5 h-5 shrink-0 mt-0.5 transition-colors ${role === 'Leader' ? 'text-amber-500/40' : 'text-purple-500/40'}`} />
                                <p className={`text-xs leading-relaxed transition-colors ${role === 'Leader' ? 'text-amber-100/70' : 'text-purple-100/70'}`}>
                                    {role === 'Leader' ? system.leaderExperience : system.citizenExperience}
                                </p>
                            </motion.div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-10 flex justify-center w-full">
                        <button
                            disabled={!characterName.trim()}
                            onClick={() => {
                                audioManager.playSfx("click-soft");
                                onContinue({ characterName, role: role.toLowerCase(), avatar: AVATARS[avatarIndex] });
                            }}
                            className={`w-full max-w-sm py-4 rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] transition-all shadow-xl ${characterName.trim()
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-[1.02] shadow-purple-500/20'
                                : 'bg-white/5 text-white/10 cursor-not-allowed'
                                }`}
                        >
                            Continue
                        </button>
                    </div>
                </div>

                {/* Close X Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-white/20 hover:text-white transition-all z-20"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </motion.div>
    );
};

export default SystemDetailsPopup;
