import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { audioManager } from "../lib/audioManager";

interface LobbyPlayPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        characterName: string;
        setting: string;
        role: string;
        emphasis: string;
    }) => void;
    isLoading?: boolean;
}

const SETTING_PRESETS = [
    "Ancient Athens",
    "Early North America (Settlers)",
    "Modern United States",
    "Future Mars Colony",
    "Ancient Rome",
];

export default function LobbyPlayPopup({ isOpen, onClose, onSubmit, isLoading }: LobbyPlayPopupProps) {
    const [characterName, setCharacterName] = useState("");
    const [setting, setSetting] = useState("");
    const [role, setRole] = useState("");
    const [emphasis, setEmphasis] = useState("");
    const [showPresets, setShowPresets] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowPresets(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!characterName || !setting || !role || isLoading) return;

        audioManager.playSfx("click-soft");
        onSubmit({ characterName, setting, role, emphasis });
    };

    const isFormValid = characterName.trim() && setting.trim() && role.trim();

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[100] grid place-items-center p-4 bg-black/80 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Backdrop click to close */}
                    <div className="absolute inset-0" onClick={onClose} />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="relative w-full max-w-lg bg-neutral-900/90 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-8 pt-8 pb-4 text-center">
                            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                                Create Your Story
                            </h2>
                            <p className="text-white/60 text-sm mt-1">
                                Define the hero and the world they command
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-8 pt-2 space-y-6">
                            {/* Character Name */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider ml-1">
                                    Character Name
                                </label>
                                <input
                                    type="text"
                                    value={characterName}
                                    onChange={(e) => setCharacterName(e.target.value)}
                                    placeholder="Enter your character's name"
                                    className="w-full h-12 px-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:bg-white/10 transition-all font-medium"
                                />
                            </div>

                            {/* Setting with Dropdown */}
                            <div className="space-y-2 relative" ref={dropdownRef}>
                                <label className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider ml-1">
                                    Setting
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={setting}
                                        onChange={(e) => {
                                            setSetting(e.target.value);
                                            setShowPresets(true);
                                        }}
                                        onFocus={() => setShowPresets(true)}
                                        placeholder="e.g., Ancient Rome"
                                        className="w-full h-12 px-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:bg-white/10 transition-all font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPresets(!showPresets)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                                    >
                                        <svg className={`w-5 h-5 transition-transform ${showPresets ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    <AnimatePresence>
                                        {showPresets && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 4 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute z-10 w-full bg-neutral-800 border border-white/10 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto"
                                            >
                                                {SETTING_PRESETS.map((p) => (
                                                    <button
                                                        key={p}
                                                        type="button"
                                                        onClick={() => {
                                                            setSetting(p);
                                                            setShowPresets(false);
                                                        }}
                                                        className="w-full px-5 py-3 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 last:border-0"
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Role */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider ml-1">
                                    Role
                                </label>
                                <input
                                    type="text"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    placeholder="e.g., The Emperor, High Priest, Rebel Leader"
                                    className="w-full h-12 px-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:bg-white/10 transition-all font-medium"
                                />
                            </div>

                            {/* Emphasis (Optional) */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider ml-1">
                                    Emphasis <span className="text-white/30 lowercase">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={emphasis}
                                    onChange={(e) => setEmphasis(e.target.value)}
                                    placeholder="e.g., focus on military tensions, family honor"
                                    className="w-full h-12 px-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:bg-white/10 transition-all font-medium"
                                />
                            </div>

                            {/* Error/Loading */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={!isFormValid || isLoading}
                                    className={`w-full h-14 rounded-2xl font-bold text-lg shadow-lg shadow-amber-900/20 transition-all active:scale-[0.98] ${isFormValid && !isLoading
                                        ? "bg-gradient-to-r from-amber-400 to-amber-600 text-black hover:scale-[1.01] hover:shadow-amber-400/20"
                                        : "bg-white/5 text-white/20 cursor-not-allowed"
                                        }`}
                                >
                                    {isLoading ? (
                                        <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin mx-auto" />
                                    ) : (
                                        "Begin the Maze"
                                    )}
                                </button>
                            </div>
                        </form>

                        {/* Footer */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-all"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
