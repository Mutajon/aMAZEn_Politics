import React from 'react';
import { motion } from 'framer-motion';
import { useLang } from '../../i18n/lang';

interface AdvisorPortraitProps {
    scenario: string;
    tone: 'serious' | 'satirical';
    name: string;
    className?: string;
}

export const AdvisorPortrait: React.FC<AdvisorPortraitProps> = ({
    scenario,
    tone,
    name,
    className = ""
}) => {
    const lang = useLang();

    // Normalize scenario name according to naming convention (e.g., "Ancient Athens" -> "athens")
    const getNormalizedScenario = (s: string) => {
        const lowerS = s.toLowerCase();
        if (lowerS.includes("athens") || lowerS.includes("democracy")) return "athens";
        if (lowerS.includes("roman") || lowerS.includes("republic")) return "roman";
        if (lowerS.includes("england") || lowerS.includes("monarchy") || lowerS.includes("medieval")) return "england";
        if (lowerS.includes("vatican") || lowerS.includes("theocracy")) return "vatican";
        if (lowerS.includes("china") || lowerS.includes("bureaucratic")) return "china";
        if (lowerS.includes("mars") || lowerS.includes("technocracy")) return "mars";
        return lowerS.split(' ')[0];
    };

    const normalizedScenario = getNormalizedScenario(scenario);
    const toneSuffix = tone === 'satirical' ? 'Comedy' : 'Drama';
    const imagePath = `/assets/images/advisors/${normalizedScenario}${toneSuffix}.webp`;

    // Translate the messenger name (it may be a localization key like "FREE_PLAY_MESSENGER_SCRIBE")
    const translatedName = lang(name);

    return (
        <motion.div
            className={`relative z-10 select-none pointer-events-none ${className}`}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
        >
            <motion.div
                animate={{
                    y: [0, -8, 0],
                }}
                transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            >
                <img
                    src={imagePath}
                    alt={translatedName}
                    className="w-24 h-auto md:w-32 drop-shadow-2xl scale-x-[-1]"
                    onError={(e) => {
                        // Fallback if image not found
                        (e.target as HTMLImageElement).src = "/assets/images/characters/advisor_placeholder.png";
                    }}
                />
            </motion.div>

            {/* Blinking name overlay (subtle) */}
            <motion.div
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
                <span className="text-[10px] md:text-xs font-black text-white/40 tracking-[0.3em] uppercase">
                    {translatedName}
                </span>
            </motion.div>
        </motion.div>
    );
};
