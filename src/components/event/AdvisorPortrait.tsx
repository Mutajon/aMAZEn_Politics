import React from 'react';
import { motion } from 'framer-motion';
import { useLang } from '../../i18n/lang';
import { useLanguage } from '../../i18n/LanguageContext';

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
    const { language } = useLanguage();
    const isRTL = language === 'he';

    // Normalize scenario name according to naming convention (e.g., "Ancient Athens" -> "athens")
    const normalizedScenario = React.useMemo(() => {
        const lowerS = scenario.toLowerCase();
        
        // Specific Setting Matches (highest priority)
        if (lowerS.includes("mars") || lowerS.includes("technocracy") || lowerS.includes("colony") || lowerS.includes("space")) return "mars";
        if (lowerS.includes("china") || lowerS.includes("bureaucratic") || lowerS.includes("ming") || lowerS.includes("scribe")) return "china";
        if (lowerS.includes("vatican") || lowerS.includes("theocracy") || lowerS.includes("pope") || lowerS.includes("church")) return "vatican";
        if (lowerS.includes("england") || lowerS.includes("monarchy") || lowerS.includes("medieval") || lowerS.includes("london")) return "england";
        if (lowerS.includes("roman") || lowerS.includes("rome") || lowerS.includes("republic")) return "roman";
        if (lowerS.includes("athens") || lowerS.includes("greece") || lowerS.includes("democracy") || lowerS.includes("direct")) return "athens";
        
        // Final fallback: check first word or default to athens
        const firstWord = lowerS.split(' ')[0];
        const knownS = ["athens", "roman", "england", "vatican", "china", "mars"];
        return knownS.includes(firstWord) ? firstWord : "athens";
    }, [scenario]);

    const toneSuffix = tone === 'satirical' ? 'Comedy' : 'Drama';
    const [hasError, setHasError] = React.useState(false);
    
    // Reset error when scenario/tone changes
    React.useEffect(() => {
        setHasError(false);
    }, [normalizedScenario, tone]);

    const imagePath = hasError 
        ? `/assets/images/advisors/athensDrama.webp` // Robust fallback to athensDrama
        : `/assets/images/advisors/${normalizedScenario}${toneSuffix}.webp`;

    // Translate the messenger name (it may be a localization key like "FREE_PLAY_MESSENGER_SCRIBE")
    const translatedName = lang(name);

    return (
        <motion.div
            className={`relative z-10 select-none pointer-events-none ${className}`}
            initial={{ x: isRTL ? 20 : -20, opacity: 0 }}
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
                    className={`w-24 h-64 md:w-32 object-contain drop-shadow-2xl ${isRTL ? 'scale-x-1' : 'scale-x-[-1]'}`}
                    onError={() => {
                        if (!hasError) setHasError(true);
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
