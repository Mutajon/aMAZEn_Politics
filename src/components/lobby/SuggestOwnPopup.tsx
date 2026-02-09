import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Wand2, Info, Loader2 } from 'lucide-react';
import { useLang } from "../../i18n/lang";
import { audioManager } from '../../lib/audioManager';

interface SuggestOwnPopupProps {
    onClose: () => void;
    onContinue: (data: {
        characterName: string;
        setting: string;
        role: string;
        avatar: string;
        year: string;
        roleExperience: string;
    }) => void;
}

const AVATARS = [
    "roman_senator", "pharaoh", "medieval_king", "asian_emperor", "african_king",
    "washington", "lincoln_young", "victorian_man", "civil_rights_leader",
    "president_elder", "politician_man", "entrepreneur", "young_professional",
    "elizabethan_queen", "suffragette", "businesswoman", "activist_elder",
    "politician_woman", "elder_woman", "young_activist"
];

const SuggestOwnPopup: React.FC<SuggestOwnPopupProps> = ({ onClose, onContinue }) => {
    const lang = useLang();
    const [characterName, setCharacterName] = useState("");
    const [avatarIndex, setAvatarIndex] = useState(0);
    const [setting, setSetting] = useState("");
    const [role, setRole] = useState("");
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    const handleContinue = async () => {
        if (!characterName.trim() || !setting.trim() || !role.trim()) return;

        setIsValidating(true);
        setError(null);
        audioManager.playSfx("click-soft");

        try {
            const res = await fetch("/api/free-play/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    setting,
                    role,
                    language: document.documentElement.lang === 'he' ? 'he' : 'en'
                })
            });

            const data = await res.json();
            if (data.isValid) {
                onContinue({
                    characterName,
                    setting: data.setting || setting,
                    role: data.role || role,
                    avatar: AVATARS[avatarIndex],
                    year: data.year || "",
                    roleExperience: data.roleExperience || ""
                });
            } else {
                setError(data.message || "Input rejected. Try something more descriptive.");
            }
        } catch (e) {
            console.error(e);
            setError("Connection error. Please try again.");
        } finally {
            setIsValidating(false);
        }
    };

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

                {/* Left Side: Image Preview */}
                <div className="w-full md:w-2/5 relative h-48 md:h-auto overflow-hidden">
                    <motion.img
                        src="/assets/images/freePlay/chooseOwn.webp"
                        alt="Custom Scenario"
                        className="w-full h-full object-cover opacity-60"
                        animate={{
                            scale: [1, 1.05, 1],
                        }}
                        transition={{
                            duration: 15,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#0f1115] via-transparent to-transparent md:to-transparent" />

                    <div className="absolute bottom-6 left-6 right-6">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-500/60 font-black mb-1">UNLIMITED HORIZON</div>
                        <h3 className="text-2xl font-black text-white leading-tight">
                            Suggest Your Own
                        </h3>
                        <p className="mt-3 text-sm text-white/50 leading-relaxed italic border-l-2 border-amber-500/20 pl-4">
                            "The story is limited only by your imagination. Define your era, choose your role, and let the mirror reflect your destiny."
                        </p>
                    </div>
                </div>

                {/* Right Side: Setup Controls */}
                <div className="flex-1 p-6 md:p-10 flex flex-col overflow-y-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                                <Wand2 className="w-4 h-4" />
                            </span>
                            <h2 className="text-3xl font-black uppercase tracking-tighter text-amber-400">
                                CUSTOM SCENARIO
                            </h2>
                        </div>
                    </div>

                    <div className="h-px bg-white/5 mb-8" />

                    {/* Setup Form */}
                    <div className="space-y-6 flex-1">

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Name Input */}
                            <div className="space-y-3">
                                <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold ml-1">
                                    {lang("LOBBY_WHO_WOULD_YOU_LIKE_TO_BE")}
                                </label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder={lang("LOBBY_ENTER_NAME_PLACEHOLDER")}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-medium text-sm"
                                    value={characterName}
                                    onChange={(e) => setCharacterName(e.target.value)}
                                />
                            </div>

                            {/* Avatar Picker */}
                            <div className="space-y-3">
                                <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold ml-1">
                                    {lang("LOBBY_CHOOSE_YOUR_FACE")}
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

                        {/* Setting Input */}
                        <div className="space-y-3">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold ml-1">
                                {lang("LOBBY_SETTING_LABEL")}
                            </label>
                            <input
                                type="text"
                                placeholder={lang("LOBBY_PLACEHOLDER_SETTING")}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-medium text-sm"
                                value={setting}
                                onChange={(e) => setSetting(e.target.value)}
                            />
                        </div>

                        {/* Role Input */}
                        <div className="space-y-3">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold ml-1">
                                {lang("LOBBY_ROLE_LABEL")}
                            </label>
                            <input
                                type="text"
                                placeholder={lang("LOBBY_PLACEHOLDER_ROLE")}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-medium text-sm"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                            />
                        </div>

                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 items-start"
                                >
                                    <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-200/70 italic leading-relaxed">
                                        {error}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-10 flex justify-center w-full">
                        <button
                            disabled={!characterName.trim() || !setting.trim() || !role.trim() || isValidating}
                            onClick={handleContinue}
                            className={`w-full max-w-sm py-4 rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] transition-all shadow-xl flex items-center justify-center gap-3 ${characterName.trim() && setting.trim() && role.trim() && !isValidating
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-[1.02] shadow-purple-500/20'
                                : 'bg-white/5 text-white/10 cursor-not-allowed'
                                }`}
                        >
                            {isValidating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Validating...</span>
                                </>
                            ) : (
                                <span>{lang("LOBBY_CONTINUE_BUTTON")}</span>
                            )}
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

export default SuggestOwnPopup;
