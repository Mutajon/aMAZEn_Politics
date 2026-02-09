import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dices, Target, Trophy } from "lucide-react";
import { audioManager } from "../lib/audioManager";
import { useLang } from "../i18n/lang";
import { useLanguage } from "../i18n/LanguageContext";
import { useDilemmaStore } from "../store/dilemmaStore";
import { MirrorReflection } from "./MirrorWithReflection";
import { useSettingsStore } from "../store/settingsStore";
import { useNarrator } from "../hooks/useNarrator";
import SystemSelection from "./lobby/SystemSelection";
import { useLogger } from "../hooks/useLogger";
import SystemDetailsPopup from "./lobby/SystemDetailsPopup";
import SuggestOwnPopup from "./lobby/SuggestOwnPopup";
import GameSettingsPopup from "./lobby/GameSettingsPopup";
import LobbyLockedPopup from "./lobby/LobbyLockedPopup";
import type { FreePlaySystem } from "../data/freePlaySystems";
import { bgStyleSplash } from "../lib/ui";

const MODEL_OPTIONS = [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-flash-preview-09-2025", label: "Gemini 2.5 Flash Preview" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
    { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview" },
];

interface LobbyPlayPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        characterName: string;
        setting: string;
        role: string;
        emphasis: string;
        gender: string;
        difficulty: string;
        tone: "serious" | "satirical";
        avatar: string | null;
        introText?: string;
        supportEntities?: Array<{ name: string; icon: string; type: string }>;
        systemName: string;
        year: string;
        roleExperience?: string;
        bonusObjective?: string;
        messenger?: string;
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
const MALE_AVATARS = [
    "roman_senator", "pharaoh", "medieval_king", "asian_emperor", "african_king",
    "washington", "lincoln_young", "victorian_man", "civil_rights_leader",
    "president_elder", "politician_man", "entrepreneur", "young_professional"
];

const FEMALE_AVATARS = [
    "elizabethan_queen", "suffragette", "businesswoman", "activist_elder",
    "politician_woman", "elder_woman", "young_activist"
];

const AVATAR_LIST = [
    ...MALE_AVATARS,
    ...FEMALE_AVATARS
];

export default function LobbyPlayPopup({ isOpen, onClose, onSubmit, isLoading }: LobbyPlayPopupProps) {
    const lang = useLang();
    const { language } = useLanguage();
    const isRTL = language === 'he';
    const debugMode = useSettingsStore(s => s.debugMode);
    const logger = useLogger();
    const { aiModelOverride, setAiModelOverride } = useDilemmaStore();
    const narrator = useNarrator();

    const [characterName, setCharacterName] = useState("");
    const [setting, setSetting] = useState("");
    const [role, setRole] = useState("");
    const [emphasis, setEmphasis] = useState("");
    const [gender, setGender] = useState("male");
    const [difficulty, setDifficulty] = useState("easy");
    const [tone, setTone] = useState<"serious" | "satirical">("serious");
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);

    // New state for Intro flow
    const [step, setStep] = useState<'selection' | 'form' | 'intro' | 'spice' | 'custom'>('selection');
    const [bonusObjective, setBonusObjective] = useState("");
    const [introData, setIntroData] = useState<{ intro: string, mirrorMsg: string, supportEntities?: any[] } | null>(null);
    const [isGeneratingIntro, setIsGeneratingIntro] = useState(false);
    const [selectedSystem, setSelectedSystem] = useState<FreePlaySystem | null>(null);
    const [useBonusObjective, setUseBonusObjective] = useState(false);
    const [messenger, setMessenger] = useState("");
    const [roleCategory, setRoleCategory] = useState<"leader" | "commoner" | null>(null);
    const [inferredYear, setInferredYear] = useState("");
    const [inferredExperience, setInferredExperience] = useState("");

    const [showNamePresets, setShowNamePresets] = useState(false);
    const [showSettingPresets, setShowSettingPresets] = useState(false);
    const [showRolePresets, setShowRolePresets] = useState(false);
    const [showLockedPopup, setShowLockedPopup] = useState(false);

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

    const isIntroReady = step === 'intro' && !isGeneratingIntro;
    const isFullScreenStep = ['selection', 'spice', 'custom'].includes(step) || isIntroReady;


    // Narration for intro
    useEffect(() => {
        if (step === 'intro' && introData?.intro) {
            console.log("[LobbyPlayPopup] Triggering narration for intro");
            narrator.speak(introData.intro);
        }
        return () => narrator.stop();
    }, [step, introData?.intro, tone]);

    const handleSystemSelect = (system: FreePlaySystem) => {
        audioManager.playSfx("click-soft");
        logger.log('freeplay_system_selected', { system: system.governanceSystem, scenario: system.scenario }, 'User selected a political system');
        setSelectedSystem(system);
    };

    const handleDetailsConfirm = (data: { characterName: string, role: string, avatar: string }) => {
        if (!selectedSystem) return;

        audioManager.playSfx("click-soft");
        setCharacterName(data.characterName);
        const isLeader = data.role === 'leader';
        logger.log('freeplay_details_confirmed', { characterName: data.characterName, role: data.role, avatar: data.avatar }, 'User confirmed character details');
        setRole(isLeader ? 'Leader' : 'Commoner');
        setRoleCategory(isLeader ? 'leader' : 'commoner');
        setSetting(selectedSystem.scenario);
        setSelectedAvatar(data.avatar);

        const objective = data.role === 'leader'
            ? selectedSystem.bonusObjectiveLeader
            : selectedSystem.bonusObjectiveCitizen;
        setBonusObjective(objective);

        // Pull the correct messenger based on role
        const msg = data.role === 'leader'
            ? selectedSystem.messengerLeader
            : selectedSystem.messengerCommoner;
        setMessenger(msg);

        // Move to spice step
        setStep('spice');
    };

    const handleCustomConfirm = (data: {
        characterName: string,
        setting: string,
        role: string,
        avatar: string,
        year: string,
        roleExperience: string
    }) => {
        audioManager.playSfx("click-soft");
        setCharacterName(data.characterName);
        setSetting(data.setting);
        setRole(data.role);
        setSelectedAvatar(data.avatar);
        setInferredYear(data.year);
        setInferredExperience(data.roleExperience);
        setRoleCategory(null);
        setMessenger(""); // Custom roles default to no specific messenger (will fallback to "Mom" in system prompt)
        setStep('spice');
    };

    const handleSpiceConfirm = (settings: {
        difficulty: string,
        tone: string,
        emphasis: string,
        useBonusObjective: boolean
    }) => {
        audioManager.playSfx("click-soft");
        logger.log('freeplay_spice_confirmed', settings, 'User confirmed spice settings');
        setDifficulty(settings.difficulty as any);
        setTone(settings.tone === 'comedy' ? 'satirical' : 'serious');
        setUseBonusObjective(settings.useBonusObjective);

        // If bonus objective is enabled, use it as the emphasis
        const finalEmphasis = settings.useBonusObjective ? bonusObjective : settings.emphasis;
        setEmphasis(finalEmphasis || selectedSystem?.intro || "");

        // Finally trigger generation
        generateIntroFromSettings(setting, role);
    };

    const generateIntroWithRetry = async (selectedSetting: string, selectedRole: string, attempts = 3) => {
        let lastError: any;
        for (let i = 0; i < attempts; i++) {
            try {
                // Determine persistent fields
                const systemName = selectedSystem?.governanceSystem || "Custom Scenario";
                const year = inferredYear || selectedSystem?.year || "Present Day";
                const roleExperience = inferredExperience || (roleCategory === 'leader' ? selectedSystem?.leaderExperience : selectedSystem?.citizenExperience);

                // Final emphasis (either user choice or bonus objective)
                const finalEmphasis = useBonusObjective ? bonusObjective : (emphasis || selectedSystem?.intro || "A new era begins.");

                const res = await fetch("/api/free-play/intro", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        role: selectedRole,
                        setting: selectedSetting,
                        playerName: characterName || "Leader",
                        emphasis: finalEmphasis,
                        gender,
                        difficulty,
                        tone,
                        systemName,
                        year,
                        roleExperience,
                        messenger,
                        model: useDilemmaStore.getState().aiModelOverride
                    })
                });

                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                const data = await res.json();
                if (data.intro) return data;
                throw new Error("Missing intro in response");
            } catch (err) {
                console.warn(`Attempt ${i + 1} failed:`, err);
                lastError = err;
                // Wait a bit before retry (exponential backoff)
                if (i < attempts - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            }
        }
        throw lastError;
    };

    const generateIntroFromSettings = async (selectedSetting: string, selectedRole: string) => {
        setIsGeneratingIntro(true);
        setStep('intro');
        try {
            const data = await generateIntroWithRetry(selectedSetting, selectedRole);
            setIntroData(data);
        } catch (err) {
            console.error("All attempts to generate intro failed:", err);
            // Fallback: Proceed without custom intro if all retries fail
            const systemName = selectedSystem?.governanceSystem || "Custom System";
            const year = selectedSystem?.year || "Present Day";
            const roleExperience = roleCategory === 'leader' ? selectedSystem?.leaderExperience : selectedSystem?.citizenExperience;
            const finalEmphasis = useBonusObjective ? bonusObjective : (emphasis || selectedSystem?.intro || "A new era begins.");

            onSubmit({
                characterName,
                setting: selectedSetting,
                role: selectedRole,
                emphasis: finalEmphasis,
                gender,
                difficulty,
                tone,
                avatar: selectedAvatar,
                systemName,
                year,
                roleExperience,
                bonusObjective: useBonusObjective ? bonusObjective : undefined
            });
        } finally {
            setIsGeneratingIntro(false);
        }
    };

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
                        difficulty,
                        tone,
                        model: useDilemmaStore.getState().aiModelOverride
                    })
                });
                const data = await res.json();
                if (data.intro) {
                    setIntroData(data);
                    setStep('intro');
                } else {
                    // Fallback if failed - just start game
                    const systemName = selectedSystem?.governanceSystem || "Custom System";
                    const year = selectedSystem?.year || "Present Day";
                    const roleExperience = roleCategory === 'leader' ? selectedSystem?.leaderExperience : selectedSystem?.citizenExperience;
                    const finalEmphasis = useBonusObjective ? bonusObjective : (emphasis || selectedSystem?.intro || "A new era begins.");

                    onSubmit({
                        characterName,
                        setting,
                        role,
                        emphasis: finalEmphasis,
                        gender,
                        difficulty,
                        tone,
                        avatar: selectedAvatar,
                        systemName,
                        year,
                        roleExperience,
                        bonusObjective: useBonusObjective ? bonusObjective : undefined
                    });
                }
            } catch (err) {
                console.error("Failed to generate intro:", err);
                const systemName = selectedSystem?.governanceSystem || "Custom System";
                const year = selectedSystem?.year || "Present Day";
                const roleExperience = roleCategory === 'leader' ? selectedSystem?.leaderExperience : selectedSystem?.citizenExperience;
                const finalEmphasis = useBonusObjective ? bonusObjective : (emphasis || selectedSystem?.intro || "A new era begins.");

                onSubmit({
                    characterName,
                    setting,
                    role,
                    emphasis: finalEmphasis,
                    gender,
                    difficulty,
                    tone,
                    avatar: selectedAvatar,
                    systemName,
                    year,
                    roleExperience,
                    bonusObjective: useBonusObjective ? bonusObjective : undefined,
                    messenger
                });
            } finally {
                setIsGeneratingIntro(false);
            }
        } else {
            // Step 2: Start Game
            audioManager.playSfx("click-soft");

            const systemName = selectedSystem?.governanceSystem || "Custom System";
            const year = selectedSystem?.year || "Present Day";
            const roleExperience = roleCategory === 'leader' ? selectedSystem?.leaderExperience : selectedSystem?.citizenExperience;
            const finalEmphasis = useBonusObjective ? bonusObjective : (emphasis || selectedSystem?.intro || "A new era begins.");

            onSubmit({
                characterName,
                setting: selectedSystem?.scenario || setting,
                role: role,
                emphasis: finalEmphasis,
                gender,
                difficulty,
                tone,
                avatar: selectedAvatar,
                introText: introData?.intro,
                supportEntities: introData?.supportEntities,
                systemName,
                year,
                roleExperience,
                bonusObjective: useBonusObjective ? bonusObjective : undefined,
                messenger
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

        // 1. Random Gender
        const genders = ['male', 'female', 'other'];
        const newGender = genders[Math.floor(Math.random() * genders.length)];
        setGender(newGender);

        // 2. Filter Avatars based on Gender
        let availableAvatars = AVATAR_LIST;
        if (newGender === 'male') availableAvatars = MALE_AVATARS;
        if (newGender === 'female') availableAvatars = FEMALE_AVATARS;

        // 3. Random Avatar from filtered list
        const randomAvatar = availableAvatars[Math.floor(Math.random() * availableAvatars.length)];
        setSelectedAvatar(randomAvatar);

        // Scroll to selected avatar in the main list
        const mainIndex = AVATAR_LIST.indexOf(randomAvatar);
        if (avatarScrollRef.current && mainIndex !== -1) {
            const container = avatarScrollRef.current;
            const itemWidth = 80; // w-20
            const gap = 12; // gap-3
            const scrollLeft = mainIndex * (itemWidth + gap) - (container.offsetWidth / 2) + (itemWidth / 2);
            container.scrollTo({
                left: scrollLeft,
                behavior: 'smooth'
            });
        }

        // Random Difficulty
        const difficulties = ['easy', 'normal', 'hard'];
        const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
        setDifficulty(randomDifficulty as any);

        // Random Tone
        const tones: Array<"serious" | "satirical"> = ['serious', 'satirical'];
        const randomTone = tones[Math.floor(Math.random() * tones.length)];
        setTone(randomTone);

        // Random Setting
        const randomSetting = SETTING_PRESETS[Math.floor(Math.random() * SETTING_PRESETS.length)];
        const settingName = lang(randomSetting.key);
        setSetting(settingName);

        // Random Role
        const randomRoleKey = ROLE_PRESETS[Math.floor(Math.random() * ROLE_PRESETS.length)];
        const roleName = lang(randomRoleKey);
        setRole(roleName);
        setRoleCategory(randomRoleKey === "LOBBY_ROLE_LEADER" ? "leader" : "commoner");

        // Random Name
        const randomNameKey = NAME_PRESETS[Math.floor(Math.random() * NAME_PRESETS.length)];
        const name = lang(randomNameKey);
        setCharacterName(name);

        logger.log('freeplay_randomized', {
            gender: newGender,
            avatar: randomAvatar,
            difficulty: randomDifficulty,
            tone: randomTone,
            setting: settingName,
            role: roleName,
            characterName: name
        }, 'User clicked randomize in Free Play setup');
    };

    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                <motion.div
                    key="lobby-popup-main"
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md"
                    style={isFullScreenStep ? bgStyleSplash : { backgroundColor: 'rgba(0,0,0,0.84)', backdropFilter: 'blur(12px)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Backdrop click to close */}
                    <div className="absolute inset-0" onClick={onClose} />

                    {isFullScreenStep ? (
                        <div className="relative z-10 w-full h-full flex flex-col items-center pointer-events-none">
                            {/* Screen Title (Selection only) */}
                            {step === 'selection' && (
                                <motion.div
                                    initial={{ opacity: 0, y: -40 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="absolute top-[12%] text-center pointer-events-auto"
                                >
                                    <h1 className="text-3xl sm:text-6xl font-black text-white drop-shadow-[0_0_30px_rgba(168,85,247,0.4)] tracking-tighter uppercase leading-none">
                                        {lang("LOBBY_EXPERIENCE_PROMPT_PRE")}<br />
                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">{lang("LOBBY_EXPERIENCE_PROMPT_HIGHLIGHT")}</span> {lang("LOBBY_EXPERIENCE_PROMPT_POST")}
                                    </h1>
                                </motion.div>
                            )}

                            <div className="w-full h-full overflow-y-auto overflow-x-hidden pointer-events-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
                                {!isIntroReady && (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <SystemSelection
                                            key="system-selection"
                                            onSelect={handleSystemSelect}
                                            onSelectCustom={() => {
                                                audioManager.playSfx("click-soft");
                                                setStep('custom');
                                            }}
                                            onLockedClick={() => setShowLockedPopup(true)}
                                            disabled={!!selectedSystem}
                                        />
                                    </div>
                                )}

                                {isIntroReady && (
                                    <motion.div
                                        key="intro-content"
                                        initial={{ opacity: 0, y: 40 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center space-y-8 sm:space-y-12 min-h-full"
                                    >
                                        {/* Intro Header */}
                                        <div className="text-center space-y-4">
                                            <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-white uppercase tracking-tighter drop-shadow-lg">
                                                {lang("YOUR_STORY_TITLE") || "Your Story"}
                                            </h2>
                                            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-purple-300/80">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white/40">{lang("LOBBY_THE_PLACE")}</span>
                                                    <span>{setting}</span>
                                                </div>
                                                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white/40">{lang("LOBBY_YOUR_ROLE_LABEL")}</span>
                                                    <span>
                                                        {selectedSystem && roleCategory
                                                            ? (roleCategory === 'leader' ? lang("LOBBY_ROLE_LEADER") : lang("LOBBY_ROLE_COMMONER"))
                                                            : role
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Main Intro Text */}
                                        <div className={`relative w-full max-w-3xl p-6 sm:p-10 rounded-[24px] sm:rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl ${isRTL ? 'text-right' : 'text-left'}`}>
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-purple-500 to-indigo-600 rounded-full" />
                                            <p className="text-lg sm:text-2xl md:text-3xl leading-relaxed text-slate-100 font-serif italic opacity-95">
                                                "{introData?.intro}"
                                            </p>
                                        </div>

                                        {/* Parameters Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                                            {/* Judges & Observers */}
                                            <div className="space-y-4">
                                                <div className={`text-xs uppercase tracking-[0.3em] text-white/40 font-black px-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                                                    {lang("LOBBY_JUDGES_LABEL") || "The Observers"}
                                                </div>
                                                <div className="flex flex-wrap gap-3">
                                                    {(introData?.supportEntities || [
                                                        { name: lang("LOBBY_ENTITY_PEOPLE"), icon: "👥" },
                                                        { name: lang("LOBBY_ENTITY_ESTABLISHMENT"), icon: "🏛️" }
                                                    ]).map((entity, i) => (
                                                        <motion.div
                                                            key={i}
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            transition={{ delay: 0.2 + i * 0.1 }}
                                                            className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 shadow-xl hover:bg-white/10 transition-all cursor-default group"
                                                        >
                                                            <span className="text-2xl group-hover:scale-110 transition-transform">{entity.icon}</span>
                                                            <span className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors uppercase tracking-wider">{entity.name}</span>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Objective & Target */}
                                            <div className="space-y-4">
                                                <div className={`text-xs uppercase tracking-[0.3em] text-white/40 font-black px-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                                                    {lang("LOBBY_GOAL_LABEL") || "The Objective"}
                                                </div>
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: 0.4 }}
                                                    className="flex items-center gap-5 px-6 py-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 shadow-2xl group hover:border-amber-500/50 transition-all"
                                                >
                                                    <div className="p-3 rounded-2xl bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors">
                                                        <Target className="w-8 h-8 text-amber-500" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-amber-500/70 font-black uppercase tracking-widest mb-1">{lang("LOBBY_TARGET_SCORE_SHORT") || "Score Target"}</div>
                                                        <div className="text-3xl font-black text-amber-500 leading-none tracking-tighter">
                                                            {difficulty === 'easy' ? 200 : difficulty === 'hard' ? 250 : 225}
                                                        </div>
                                                    </div>
                                                    <Trophy className="w-6 h-6 text-amber-500/30 ml-auto group-hover:text-amber-500/60 transition-colors" />
                                                </motion.div>
                                            </div>
                                        </div>

                                        {/* Mirror / Reflections Section */}
                                        <div className="w-full max-w-2xl px-8 py-8 rounded-[40px] bg-neutral-900/60 border border-amber-500/20 shadow-2xl relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 via-transparent to-amber-500/5 pointer-events-none" />
                                            <div className="flex flex-col sm:flex-row items-center gap-8 relative z-10">
                                                <div className="w-28 h-32 relative flex-shrink-0">
                                                    <img
                                                        src="/assets/images/mirror.png"
                                                        alt="Mirror"
                                                        className="w-full h-full object-contain filter drop-shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-transform group-hover:scale-105 duration-700"
                                                    />
                                                    <MirrorReflection
                                                        mirrorSize={100}
                                                        avatarUrl={selectedAvatar ? `/assets/images/avatars/${selectedAvatar}.png` : undefined}
                                                    />
                                                </div>
                                                <div className="flex-1 text-center sm:text-left">
                                                    <div className="text-[10px] uppercase tracking-[0.4em] text-amber-500/50 font-black mb-3">{lang("LOBBY_REFLECTIONS")}</div>
                                                    <p className="text-2xl text-amber-100/90 italic font-serif leading-relaxed">
                                                        "{lang(introData?.mirrorMsg || "LOBBY_MIRROR_FREEPLAY_MSG")}"
                                                    </p>
                                                </div>
                                            </div>
                                        </div>


                                        {/* Start Game Action */}
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleSubmit as any}
                                            className="w-full max-w-sm h-14 sm:h-16 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-800 text-white font-black text-lg sm:text-xl uppercase tracking-widest shadow-[0_20px_50px_rgba(79,70,229,0.3)] hover:shadow-[0_20px_60px_rgba(79,70,229,0.5)] transition-all mb-4"
                                        >
                                            {lang("LOBBY_BEGIN_GAME")}
                                        </motion.button>
                                    </motion.div>
                                )}
                            </div>

                            {/* Overlays for selection/spice steps */}
                            <AnimatePresence>
                                {!isIntroReady && selectedSystem && step !== 'spice' && (
                                    <SystemDetailsPopup
                                        key="details-popup"
                                        system={selectedSystem}
                                        onClose={() => setSelectedSystem(null)}
                                        onContinue={handleDetailsConfirm}
                                    />
                                )}

                                {!isIntroReady && step === 'custom' && (
                                    <SuggestOwnPopup
                                        key="custom-popup"
                                        onClose={() => setStep('selection')}
                                        onContinue={handleCustomConfirm}
                                    />
                                )}

                                {!isIntroReady && step === 'spice' && (
                                    <GameSettingsPopup
                                        key="spice-popup"
                                        isCustom={!selectedSystem}
                                        bonusObjective={bonusObjective}
                                        onClose={() => setStep('selection')}
                                        onStart={handleSpiceConfirm}
                                    />
                                )}

                                {showLockedPopup && (
                                    <LobbyLockedPopup key="locked-popup" onClose={() => setShowLockedPopup(false)} />
                                )}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="relative w-full max-w-lg bg-neutral-900/90 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header (form only) */}
                            <div className="px-8 pt-8 pb-4 text-center border-b border-white/5 bg-white/5">
                                <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-purple-200 via-blue-200 to-purple-400 bg-clip-text text-transparent uppercase tracking-tight">
                                    {lang("CREATE_YOUR_STORY")}
                                </h2>
                                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">
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

                                        {/* Tone Selection */}
                                        <div className="space-y-2 relative">
                                            <label className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider ml-1">
                                                {lang("LOBBY_TONE_LABEL") || "Tone"}
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { id: 'serious', label: 'LOBBY_TONE_SERIOUS', default: 'Serious Drama', icon: '🎭', bg: 'bg-indigo-500/10 border-indigo-500/30', color: 'text-indigo-300' },
                                                    { id: 'satirical', label: 'LOBBY_TONE_SATIRICAL', default: 'Satirical Comedy', icon: '🃏', bg: 'bg-orange-500/10 border-orange-500/30', color: 'text-orange-300' }
                                                ].map((t) => (
                                                    <button
                                                        key={t.id}
                                                        type="button"
                                                        onClick={() => setTone(t.id as "serious" | "satirical")}
                                                        className={`h-12 rounded-2xl border font-medium transition-all flex items-center justify-center gap-2 ${tone === t.id
                                                            ? `${t.bg} ${t.color} ring-1 ring-offset-0 ring-${t.bg.split(' ')[0].replace('bg-', '')}`
                                                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                                                            }`}
                                                    >
                                                        <span>{t.icon}</span>
                                                        <span>{lang(t.label) || t.default}</span>
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
                                                                        setRoleCategory(key === "LOBBY_ROLE_LEADER" ? "leader" : "commoner");
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

                                        {/* DEBUG: AI Model Selector */}
                                        {debugMode && (
                                            <div className="space-y-2 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                                                <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest ml-1">
                                                    DEBUG: AI Model Override
                                                </label>
                                                <select
                                                    value={aiModelOverride || "gemini-3-flash-preview"}
                                                    onChange={(e) => setAiModelOverride(e.target.value)}
                                                    className="w-full h-11 px-4 bg-slate-900/50 border border-amber-500/30 rounded-xl text-amber-200 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                                                >
                                                    {MODEL_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value} className="bg-slate-900">
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-[9px] text-amber-500/60 mt-1 italic">
                                                    Visible only in debug mode. Affects this session's Free Play calls.
                                                </p>
                                            </div>
                                        )}
                                    </>
                                ) : null}

                                {/* Submit Button (Form only) */}
                                {!isGeneratingIntro && step === 'form' && (
                                    <div className="pt-4 pb-2 px-1">
                                        <button
                                            type="submit"
                                            disabled={!isFormValid || isLoading || isGeneratingIntro}
                                            className={`w-full h-14 rounded-2xl font-black text-lg uppercase tracking-widest shadow-lg transition-all active:scale-[0.98] ${isFormValid && !isLoading && !isGeneratingIntro
                                                ? "bg-gradient-to-r from-purple-500 via-indigo-600 to-purple-700 text-white hover:scale-[1.01] shadow-purple-900/40"
                                                : "bg-white/5 text-white/20 cursor-not-allowed"
                                                }`}
                                        >
                                            {isLoading || isGeneratingIntro ? (
                                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                                            ) : (
                                                lang("LOBBY_BEGIN_GAME_INTRO")
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
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
