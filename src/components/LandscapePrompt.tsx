import { useState, useEffect } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useSettingsStore } from "../store/settingsStore";
import { motion, AnimatePresence } from "framer-motion";

export function LandscapePrompt() {
    const { lang } = useLanguage();
    const isMobileDevice = useSettingsStore((s) => s.isMobileDevice);
    const [isLandscape, setIsLandscape] = useState(false);

    useEffect(() => {
        const checkOrientation = () => {
            // enhanced check for landscape: width > height
            setIsLandscape(window.innerWidth > window.innerHeight);
        };

        // Initial check
        checkOrientation();

        // Listen for resize/orientation changes
        window.addEventListener("resize", checkOrientation);
        window.addEventListener("orientationchange", checkOrientation);

        return () => {
            window.removeEventListener("resize", checkOrientation);
            window.removeEventListener("orientationchange", checkOrientation);
        };
    }, []);

    // Only show if it's a mobile device and in landscape orientation
    const showPrompt = isMobileDevice && isLandscape;

    return (
        <AnimatePresence>
            {showPrompt && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-8 text-center"
                >
                    {/* Content container with glassmorphism effect */}
                    <div className="flex flex-col items-center gap-8 max-w-sm p-8 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl">

                        {/* Animated Phone Icon */}
                        <motion.div
                            className="relative w-24 h-24 flex items-center justify-center"
                            initial={{ rotate: 90 }}
                            animate={{ rotate: 0 }}
                            transition={{
                                repeat: Infinity,
                                duration: 2.5,
                                repeatDelay: 1,
                                ease: "easeInOut"
                            }}
                        >
                            <svg
                                width="64"
                                height="64"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]"
                            >
                                <rect x="5" y="2" width="14" height="20" rx="3" ry="3" />
                                <path d="M12 18h.01" />
                            </svg>
                        </motion.div>

                        {/* Text Content */}
                        <div className="space-y-3">
                            <h2 className="text-2xl font-bold font-serif tracking-wide text-amber-100">
                                {lang("PLEASE_ROTATE_TO_PORTRAIT")}
                            </h2>
                            <p className="text-sm text-white/50 font-sans">
                                {lang("PORTRAIT_MODE_OPTIMIZED")}
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
