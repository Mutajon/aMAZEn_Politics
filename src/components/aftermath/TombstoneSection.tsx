// src/components/aftermath/TombstoneSection.tsx
// Tombstone with haiku overlay
//
// Shows:
// - Tombstone image
// - Haiku text overlaid on the tombstone
//
// Connects to:
// - src/components/aftermath/AftermathContent.tsx: main content orchestration

import { motion } from "framer-motion";
import { useRoleStore } from "../../store/roleStore";
import { useLanguage } from "../../i18n/LanguageContext";

type Props = {
  haiku: string;
};

const FADE_DURATION_S = 0.5;

export default function TombstoneSection({ haiku }: Props) {
  const characterName = useRoleStore((state) => state.character?.name);
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  return (
    <motion.div
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: FADE_DURATION_S }}
    >
      <div className="relative max-w-[300px] mx-auto">
        <img
          src="/assets/images/tombStone.png"
          alt="Tombstone"
          className="w-full opacity-80"
        />
        {/* Name and Haiku Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
          {characterName && (
            <p className={`text-gray-900 text-center font-serif font-semibold mb-2 ${
              isHebrew ? 'text-base' : 'text-sm'
            }`}>
              {characterName}
            </p>
          )}
          <p className={`text-gray-900 text-center font-serif italic whitespace-pre-line max-w-[140px] ${
            isHebrew ? 'text-sm' : 'text-xs'
          }`}>
            {haiku}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
