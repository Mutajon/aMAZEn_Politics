import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { audioManager } from "../lib/audioManager";
import { useLang } from "../i18n/lang";

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
    { key: "LOBBY_SETTING_ATHENS", icon: "🏛️" },
    { key: "LOBBY_SETTING_NORTH_AMERICA", icon: "🌲" },
    { key: "LOBBY_SETTING_USA", icon: "🗽" },
    { key: "LOBBY_SETTING_MARS", icon: "🚀" },
];

const NAME_PRESETS = [
    "LOBBY_NAME_ALEX",
    "LOBBY_NAME_CASEY",
    "LOBBY_NAME_JORDAN",
    "LOBBY_NAME_TAYLOR",
];

const ROLE_PRESETS = [
    "LOBBY_ROLE_LEADER",
    "LOBBY_ROLE_COMMONER",
];

export default function LobbyPlayPopup({ isOpen, onClose, onSubmit, isLoading }: LobbyPlayPopupProps) {
    const lang = useLang();

    const [characterName, setCharacterName] = useState("");
    const [setting, setSetting] = useState("");
    const [role, setRole] = useState("");
    const [emphasis, setEmphasis] = useState("");

    const [showNamePresets, setShowNamePresets] = useState(false);
    const [showSettingPresets, setShowSettingPresets] = useState(false);
    const [showRolePresets, setShowRolePresets] = useState(false);

    const nameDropdownRef = useRef<HTMLDivElement>(null);
    const settingDropdownRef = useRef<HTMLDivElement>(null);
    const roleDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (nameDropdownRef.current && !nameDropdownRef.current.contains(event.target as Node)) {
                setShowNamePresets(false);
            }
            if (settingDropdownRef.current && !settingDropdownRef.current.contains(event.target as Node)) {
                setShowSettingPresets(false);
            }
            if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
                setShowRolePresets(false);
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
                            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-200 via-purple-300 to-purple-500 bg-clip-text text-transparent">
                                {lang("CREATE_YOUR_STORY")}
                            </h2>
                            <p className="text-white/60 text-sm mt-1">
                                {lang("LOBBY_PLAY_SUBTITLE")}
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-8 pt-2 space-y-5 overflow-y-auto max-h-[70vh]">
                            {/* Character Name */}
                            <div className="space-y-2 relative" ref={nameDropdownRef}>
                                <label className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider ml-1">
                                    {lang("LOBBY_NAME_LABEL")}
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={characterName}
                                        onChange={(e) => {
                                            setCharacterName(e.target.value);
                                            setShowNamePresets(false);
                                        }}
                                        onFocus={() => setShowNamePresets(true)}
                                        placeholder={lang("NAME_PLACEHOLDER")}
                                        className="w-full h-12 px-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:bg-white/10 transition-all font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNamePresets(!showNamePresets)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                                    >
                                        <svg className={`w-5 h-5 transition-transform ${showNamePresets ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    <AnimatePresence>
                                        {showNamePresets && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 4 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute z-20 w-full bg-neutral-800 border border-white/10 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto"
                                            >
                                                {NAME_PRESETS.map((key) => (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => {
                                                            setCharacterName(lang(key));
                                                            setShowNamePresets(false);
                                                        }}
                                                        className="w-full px-5 py-3 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 last:border-0"
                                                    >
                                                        {lang(key)}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Setting with Dropdown */}
                            <div className="space-y-2 relative" ref={settingDropdownRef}>
                                <label className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider ml-1">
                                    {lang("LOBBY_SETTING_LABEL")}
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={setting}
                                        onChange={(e) => {
                                            setSetting(e.target.value);
                                        }}
                                        onFocus={() => setShowSettingPresets(true)}
                                        placeholder={lang("LOBBY_PLACEHOLDER_SETTING")}
                                        className="w-full h-12 px-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:bg-white/10 transition-all font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowSettingPresets(!showSettingPresets)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                                    >
                                        <svg className={`w-5 h-5 transition-transform ${showSettingPresets ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    <AnimatePresence>
                                        {showSettingPresets && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 4 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute z-20 w-full bg-neutral-800 border border-white/10 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto"
                                            >
                                                {SETTING_PRESETS.map((p) => (
                                                    <button
                                                        key={p.key}
                                                        type="button"
                                                        onClick={() => {
                                                            setSetting(lang(p.key));
                                                            setShowSettingPresets(false);
                                                        }}
                                                        className="w-full px-5 py-3 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 last:border-0 flex items-center gap-3"
                                                    >
                                                        <span>{p.icon}</span>
                                                        <span>{lang(p.key)}</span>
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Role */}
                            <div className="space-y-2 relative" ref={roleDropdownRef}>
                                <label className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider ml-1">
                                    {lang("LOBBY_ROLE_LABEL")}
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={role}
                                        onChange={(e) => {
                                            setRole(e.target.value);
                                        }}
                                        onFocus={() => setShowRolePresets(true)}
                                        placeholder={lang("LOBBY_PLACEHOLDER_ROLE")}
                                        className="w-full h-12 px-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:bg-white/10 transition-all font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowRolePresets(!showRolePresets)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                                    >
                                        <svg className={`w-5 h-5 transition-transform ${showRolePresets ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    <AnimatePresence>
                                        {showRolePresets && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 4 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute z-20 w-full bg-neutral-800 border border-white/10 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto"
                                            >
                                                {ROLE_PRESETS.map((key) => (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => {
                                                            setRole(lang(key));
                                                            setShowRolePresets(false);
                                                        }}
                                                        className="w-full px-5 py-3 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 last:border-0"
                                                    >
                                                        {lang(key)}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Emphasis (Optional) */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider ml-1">
                                    {lang("LOBBY_EMPHASIS_LABEL")} <span className="text-white/30 lowercase">({lang("LOBBY_OPTIONAL")})</span>
                                </label>
                                <input
                                    type="text"
                                    value={emphasis}
                                    onChange={(e) => setEmphasis(e.target.value)}
                                    placeholder={lang("LOBBY_PLACEHOLDER_EMPHASIS")}
                                    className="w-full h-12 px-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:bg-white/10 transition-all font-medium"
                                />
                            </div>

                            {/* Submit Button */}
                            <div className="pt-4 pb-2">
                                <button
                                    type="submit"
                                    disabled={!isFormValid || isLoading}
                                    className={`w-full h-14 rounded-2xl font-bold text-lg shadow-lg transition-all active:scale-[0.98] ${isFormValid && !isLoading
                                        ? "bg-gradient-to-r from-purple-500 via-indigo-600 to-purple-700 text-white hover:scale-[1.01] shadow-purple-900/40"
                                        : "bg-white/5 text-white/20 cursor-not-allowed"
                                        }`}
                                >
                                    {isLoading ? (
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                                    ) : (
                                        lang("LOBBY_BEGIN_GAME")
                                    )}
                                </button>
                            </div>
                        </form>

                        {/* Close Button */}
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
