import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dices, Target, Trophy } from "lucide-react";
import { audioManager } from "../lib/audioManager";
import { useLang } from "../i18n/lang";
import { useLanguage } from "../i18n/LanguageContext";
import { MirrorReflection } from "./MirrorWithReflection";

interface LobbyPlayPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        characterName: string;
        setting: string;
        role: string;
        emphasis: string;
        gender: string;
        difficulty: string; // NEW: Difficulty level
        avatar: string | null;
        introText?: string;
        supportEntities?: Array<{ name: string; icon: string; type: string }>;
    }) => void;
    isLoading?: boolean;
}

const SETTING_PRESETS = [
    { key: "LOBBY_SETTING_ATHENS", icon: "🏛️" },
    { key: "LOBBY_SETTING_NORTH_AMERICA", icon: "🌲" },
    { key: "LOBBY_SETTING_PARIS_1789", icon: "🇫🇷" },
    { key: "LOBBY_SETTING_MING_DYNASTY", icon: "🐉" },
    { key: "LOBBY_SETTING_SPANISH_REVOLUTION", icon: "⚖️" },
    { key: "LOBBY_SETTING_USA", icon: "🗽" },
    { key: "LOBBY_SETTING_SILICON_VALLEY_2045", icon: "💻" },
    { key: "LOBBY_SETTING_BUNKER", icon: "☢️" },
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

// Avatar options - corresponds to sliced images in /public/assets/images/avatars/
const AVATAR_LIST = [
    "roman_senator", "pharaoh", "medieval_king", "asian_emperor", "african_king",
    "elizabethan_queen", "washington", "lincoln_young", "suffragette", "victorian_man",
    "civil_rights_leader", "president_elder", "businesswoman", "activist_elder", "entrepreneur",
    "politician_woman", "politician_man", "young_professional", "elder_woman", "young_activist"
];

export default function LobbyPlayPopup({ isOpen, onClose, onSubmit, isLoading }: LobbyPlayPopupProps) {
    const lang = useLang();
    const { language } = useLanguage();
    const isRTL = language === 'he';

    const [characterName, setCharacterName] = useState("");
    const [setting, setSetting] = useState("");
    const [role, setRole] = useState("");
    const [emphasis, setEmphasis] = useState("");
    const [gender, setGender] = useState("male");
    const [difficulty, setDifficulty] = useState("easy");
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
    const [showDiceOverlay, setShowDiceOverlay] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('hasSeenLobbyDiceOverlay') !== 'true';
        }
        return false;
    });

    // New state for Intro flow
    const [step, setStep] = useState<'form' | 'intro'>('form');
    const [introData, setIntroData] = useState<{ intro: string, mirrorMsg: string, supportEntities?: any[] } | null>(null);
    const [isGeneratingIntro, setIsGeneratingIntro] = useState(false);

    const [showNamePresets, setShowNamePresets] = useState(false);
    const [showSettingPresets, setShowSettingPresets] = useState(false);
    const [showRolePresets, setShowRolePresets] = useState(false);

    const nameDropdownRef = useRef<HTMLDivElement>(null);
    const settingDropdownRef = useRef<HTMLDivElement>(null);
    const roleDropdownRef = useRef<HTMLDivElement>(null);
    const avatarScrollRef = useRef<HTMLDivElement>(null);

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

    // Show informational overlay on first open
    useEffect(() => {
        console.log('[LobbyPlayPopup] isOpen check:', { isOpen });
        if (isOpen) {
            const hasSeenOverlay = localStorage.getItem('hasSeenLobbyDiceOverlay');
            console.log('[LobbyPlayPopup] hasSeenOverlay:', hasSeenOverlay);
            if (hasSeenOverlay !== 'true') {
                console.log('[LobbyPlayPopup] Setting showDiceOverlay to true');
                setShowDiceOverlay(true);
            }
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!characterName || !setting || !role || isLoading || isGeneratingIntro) return;

        // Step 1: Generate Intro (Free Play mode flow)
        if (step === 'form') {
            audioManager.playSfx("click-soft");
            setIsGeneratingIntro(true);
            try {
                const res = await fetch("/api/free-play/intro", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        role,
                        setting,
                        playerName: characterName,
                        emphasis,
                        gender,
                        difficulty
                    })
                });
                const data = await res.json();
                if (data.intro) {
                    setIntroData(data);
                    setStep('intro');
                } else {
                    // Fallback if failed - just start game
                    onSubmit({ characterName, setting, role, emphasis, gender, difficulty, avatar: selectedAvatar });
                }
            } catch (err) {
                console.error("Failed to generate intro:", err);
                onSubmit({ characterName, setting, role, emphasis, gender, difficulty, avatar: selectedAvatar });
            } finally {
                setIsGeneratingIntro(false);
            }
        } else {
            // Step 2: Start Game
            audioManager.playSfx("click-soft");
            onSubmit({
                characterName,
                setting,
                role,
                emphasis,
                gender,
                difficulty,
                avatar: selectedAvatar,
                introText: introData?.intro,
                supportEntities: introData?.supportEntities
            });
        }
    };

    const handleAvatarSelect = (avatar: string) => {
        audioManager.playSfx("click-soft");
        setSelectedAvatar(avatar);
    };

    const isFormValid = characterName.trim() && setting.trim() && role.trim();

    const handleRandomize = () => {
        audioManager.playSfx("click-soft");

        // Random Avatar
        const randomIndex = Math.floor(Math.random() * AVATAR_LIST.length);
        const randomAvatar = AVATAR_LIST[randomIndex];
        setSelectedAvatar(randomAvatar);

        // Scroll to selected avatar
        if (avatarScrollRef.current) {
            const container = avatarScrollRef.current;
            const itemWidth = 80; // w-20
            const gap = 12; // gap-3
            const scrollLeft = randomIndex * (itemWidth + gap) - (container.offsetWidth / 2) + (itemWidth / 2);
            container.scrollTo({
                left: scrollLeft,
                behavior: 'smooth'
            });
        }

        // Random Gender
        const genders = ['male', 'female', 'other'];
        setGender(genders[Math.floor(Math.random() * genders.length)]);

        // Random Difficulty
        const difficulties = ['easy', 'normal', 'hard'];
        setDifficulty(difficulties[Math.floor(Math.random() * difficulties.length)]);

        // Random Setting
        const randomSetting = SETTING_PRESETS[Math.floor(Math.random() * SETTING_PRESETS.length)];
        setSetting(lang(randomSetting.key));

        // Random Role
        const randomRole = ROLE_PRESETS[Math.floor(Math.random() * ROLE_PRESETS.length)];
        setRole(lang(randomRole));

        // Random Name
        const randomNameKey = NAME_PRESETS[Math.floor(Math.random() * NAME_PRESETS.length)];
        setCharacterName(lang(randomNameKey));
    };

    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                showDiceOverlay ? (
                    <motion.div
                        key="lobby-dice-instruction"
                        className="fixed inset-0 z-[150] grid place-items-center p-6 bg-black/80 backdrop-blur-md"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <motion.div
                            className="w-full max-w-sm bg-neutral-900 border border-amber-500/30 rounded-[32px] p-8 shadow-2xl text-center space-y-6"
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                                <Dices className="w-8 h-8 text-amber-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white">
                                {lang("LOBBY_OVERLAY_TITLE")}
                            </h3>
                            <p className="text-white/70 text-sm leading-relaxed">
                                {lang("LOBBY_OVERLAY_TEXT")}
                            </p>
                            <button
                                onClick={() => {
                                    console.log('[LobbyPlayPopup] Got it clicked');
                                    localStorage.setItem('hasSeenLobbyDiceOverlay', 'true');
                                    setShowDiceOverlay(false);
                                    audioManager.playSfx("click-soft");
                                }}
                                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-2xl transition-colors shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                            >
                                {lang("LOBBY_OVERLAY_GOT_IT")}
                            </button>
                        </motion.div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="lobby-popup-main"
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

                            {/* Form or Intro View */}
                            <form onSubmit={handleSubmit} className="p-8 pt-2 space-y-5 overflow-y-auto max-h-[70vh]">

                                {isGeneratingIntro ? (
                                    <div className="py-20 flex flex-col items-center justify-center space-y-6">
                                        <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                                        <p className="text-purple-200/70 font-medium animate-pulse">
                                            {lang("LOBBY_GENERATING_STORY") || "Weaving your tale..."}
                                        </p>
                                        <div className="w-full max-w-xs h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                                                initial={{ width: "0%" }}
                                                animate={{ width: "100%" }}
                                                transition={{ duration: 15, ease: "linear" }}
                                            />
                                        </div>
                                    </div>
                                ) : step === 'form' ? (
                                    <>
                                        {/* Avatar Selection */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider ml-1">
                                                {lang("LOBBY_AVATAR_LABEL")}
                                            </label>
                                            <div
                                                ref={avatarScrollRef}
                                                className="flex gap-3 overflow-x-auto pb-2 px-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                                                style={{ scrollbarWidth: 'thin' }}
                                            >
                                                {AVATAR_LIST.map((avatar) => (
                                                    <button
                                                        key={avatar}
                                                        type="button"
                                                        onClick={() => handleAvatarSelect(avatar)}
                                                        className={`flex-shrink-0 w-20 h-20 rounded-full overflow-hidden border-2 transition-all duration-200 ${selectedAvatar === avatar
                                                            ? 'border-amber-400 ring-2 ring-amber-400/50 scale-110 shadow-lg shadow-amber-400/20'
                                                            : 'border-white/10 hover:border-white/30 hover:scale-105'
                                                            }`}
                                                    >
                                                        <img
                                                            src={`/assets/images/avatars/${avatar}.png`}
                                                            alt={avatar.replace(/_/g, ' ')}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

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
                                                    className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors`}
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

                                        {/* Gender Selection */}
                                        <div className="space-y-2 relative">
                                            <label className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider ml-1">
                                                {lang("LOBBY_GENDER_LABEL") || "Character Gender"}
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={gender}
                                                    onChange={(e) => setGender(e.target.value)}
                                                    className="w-full h-12 px-5 bg-white/5 border border-white/10 rounded-2xl text-white appearance-none focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:bg-white/10 transition-all font-medium"
                                                >
                                                    <option value="male" className="bg-neutral-900">{lang("LOBBY_GENDER_MALE") || "Male"}</option>
                                                    <option value="female" className="bg-neutral-900">{lang("LOBBY_GENDER_FEMALE") || "Female"}</option>
                                                    <option value="other" className="bg-neutral-900">{lang("LOBBY_GENDER_OTHER") || "Other"}</option>
                                                </select>
                                                <div className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 pointer-events-none text-white/40`}>
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Difficulty Selection */}
                                        <div className="space-y-2 relative">
                                            <label className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider ml-1">
                                                {lang("LOBBY_DIFFICULTY_LABEL") || "Difficulty"}
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { id: 'easy', label: 'LOBBY_DIFFICULTY_EASY', default: 'Easy', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/30' },
                                                    { id: 'normal', label: 'LOBBY_DIFFICULTY_NORMAL', default: 'Normal', color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/30' },
                                                    { id: 'hard', label: 'LOBBY_DIFFICULTY_HARD', default: 'Hard', color: 'text-rose-300', bg: 'bg-rose-500/10 border-rose-500/30' }
                                                ].map((level) => (
                                                    <button
                                                        key={level.id}
                                                        type="button"
                                                        onClick={() => setDifficulty(level.id)}
                                                        className={`h-12 rounded-2xl border font-medium transition-all ${difficulty === level.id
                                                            ? `${level.bg} ${level.color} ring-1 ring-offset-0 ring-${level.bg.split(' ')[0].replace('bg-', '')}`
                                                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                                                            }`}
                                                    >
                                                        {lang(level.label) || level.default}
                                                    </button>
                                                ))}
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
                                                    className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors`}
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
                                                    className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors`}
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
                                    </>
                                ) : (
                                    <div className="space-y-6">
                                        {/* INTRO TEXT */}
                                        <div className={`relative p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-inner group ${isRTL ? 'text-right' : 'text-left'}`}>
                                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/40 rounded-full" />
                                            <p className="text-xl leading-relaxed text-indigo-100 italic font-serif opacity-90 group-hover:opacity-100 transition-opacity">
                                                "{introData?.intro}"
                                            </p>
                                        </div>

                                        {/* GAME PARAMETERS PILLS */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {/* JUDGES */}
                                            <div className="space-y-2.5">
                                                <div className={`text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold px-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                                                    {lang("LOBBY_JUDGES_LABEL") || "The Observers"}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {(introData?.supportEntities || [
                                                        { name: lang("LOBBY_ENTITY_PEOPLE"), icon: "👥" },
                                                        { name: lang("LOBBY_ENTITY_ESTABLISHMENT"), icon: "🏛️" }
                                                    ]).map((entity, i) => (
                                                        <motion.div
                                                            key={i}
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            transition={{ delay: 0.2 + i * 0.1 }}
                                                            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 shadow-lg hover:bg-white/10 transition-all cursor-default group"
                                                        >
                                                            <span className="text-xl group-hover:scale-110 transition-transform">{entity.icon}</span>
                                                            <span className="text-xs font-bold text-white/80 group-hover:text-white transition-colors">{entity.name}</span>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* GOAL */}
                                            <div className="space-y-2.5">
                                                <div className={`text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold px-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                                                    {lang("LOBBY_GOAL_LABEL") || "The Objective"}
                                                </div>
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: 0.4 }}
                                                    className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 shadow-lg group hover:border-amber-500/50 transition-all"
                                                >
                                                    <div className="p-2 rounded-lg bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors">
                                                        <Target className="w-5 h-5 text-amber-500" />
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] text-amber-500/60 leading-none mb-1.5 font-bold uppercase tracking-wider">{lang("LOBBY_TARGET_SCORE_SHORT") || "Score Target"}</div>
                                                        <div className="text-xl font-black text-amber-500 leading-none tracking-tight">
                                                            {difficulty === 'easy' ? 950 : difficulty === 'hard' ? 1300 : 1150}
                                                        </div>
                                                    </div>
                                                    <Trophy className="w-4 h-4 text-amber-500/30 ml-auto group-hover:text-amber-500/50 transition-colors" />
                                                </motion.div>
                                            </div>
                                        </div>

                                        {/* MIRROR CONTAINER */}
                                        <div className="relative p-6 rounded-2xl bg-neutral-900/80 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)] overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-amber-500/5 to-transparent pointer-events-none" />

                                            <div className="flex flex-col items-center gap-5 text-center relative z-10">
                                                {/* Mirror Icon/Title */}
                                                <div className="w-24 h-28 relative">
                                                    <img
                                                        src="/assets/images/mirror.png"
                                                        alt="Mirror"
                                                        className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                                                    />
                                                    <MirrorReflection
                                                        mirrorSize={90}
                                                        avatarUrl={selectedAvatar ? `/assets/images/avatars/${selectedAvatar}.png` : undefined}
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <div className="text-[10px] uppercase tracking-[0.3em] text-amber-500/40 font-black">Reflections</div>
                                                    <p className="text-amber-200/90 italic font-serif text-xl leading-relaxed max-w-md">
                                                        "{lang(introData?.mirrorMsg || "LOBBY_MIRROR_FREEPLAY_MSG")}"
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Submit Button */}
                                {!isGeneratingIntro && (
                                    <div className="pt-4 pb-2">
                                        <button
                                            type="submit"
                                            disabled={!isFormValid || isLoading || isGeneratingIntro}
                                            className={`w-full h-14 rounded-2xl font-bold text-lg shadow-lg transition-all active:scale-[0.98] ${isFormValid && !isLoading && !isGeneratingIntro
                                                ? "bg-gradient-to-r from-purple-500 via-indigo-600 to-purple-700 text-white hover:scale-[1.01] shadow-purple-900/40"
                                                : "bg-white/5 text-white/20 cursor-not-allowed"
                                                }`}
                                        >
                                            {isLoading || isGeneratingIntro ? (
                                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                                            ) : (
                                                step === 'form' ? lang("LOBBY_BEGIN_GAME_INTRO") : lang("LOBBY_BEGIN_GAME")
                                            )}
                                        </button>
                                    </div>
                                )}
                            </form>

                            {/* Randomize Button */}
                            {(step === 'form' && !isGeneratingIntro) && (
                                <button
                                    onClick={handleRandomize}
                                    type="button"
                                    className="absolute top-6 left-6 p-2 rounded-full hover:bg-white/5 text-amber-500/80 hover:text-amber-400 transition-all group shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                    title={lang("LOBBY_RANDOMIZE") || "Randomize"}
                                >
                                    <Dices className="w-6 h-6 transition-transform group-hover:rotate-180 duration-500" />
                                </button>
                            )}

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
                )
            )}
        </AnimatePresence>
    );
}
