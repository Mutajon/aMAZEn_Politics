// DilemmaCard.tsx
// Compact text card for the current dilemma/event.
// - Title + short description (2–3 sentences).
// - Inquiry button (treatment-based feature) at bottom
// - Matches your glassy card aesthetic (rounded + subtle ring).
// - Small entrance animation (fade+slide) for polish.
//
// Connected to:
// - src/hooks/useInquiring.ts: Inquiry modal state and API
// - src/components/event/InquiringModal.tsx: Modal UI
// - src/data/experimentConfig.ts: Treatment-based feature gating
//
// 🔧 Easy knobs (edit these first - Mobile-first responsive):
const TITLE_CLASS = "text-sm md:text-base font-semibold text-white/95";
const DESC_CLASS  = "text-[13px] md:text-[14px] leading-snug text-white/85";
const CARD_PAD    = "px-3 py-2 md:px-4 md:py-3"; // uniform padding
const CARD_TONE   = "border-slate-700/50 bg-black/60 backdrop-blur-sm ring-1 ring-amber-400/40 rounded-2xl shadow-sm";

import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useInquiring } from "../../hooks/useInquiring";
import InquiringModal from "./InquiringModal";
import { getTreatmentConfig } from "../../data/experimentConfig";
import { useSettingsStore } from "../../store/settingsStore";
import { useDilemmaStore } from "../../store/dilemmaStore";
import type { TreatmentType } from "../../data/experimentConfig";
import { useLang } from "../../i18n/lang";

export type DilemmaProps = {
  title: string;
  description: string; // keep it ~2–3 sentences
  speaker?: string; // Speaker name from AI or predefined (unused, kept for API compatibility)
  speakerDescription?: string; // AI-generated description (unused, kept for API compatibility)
};

export default function DilemmaCard({ title, description }: DilemmaProps) {
  const lang = useLang();
  const treatment = useSettingsStore(state => state.treatment) as TreatmentType;
  const config = getTreatmentConfig(treatment);
  const inquiryCreditsRemaining = useDilemmaStore(state => state.inquiryCreditsRemaining);

  const {
    isOpen,
    openModal,
    closeModal,
    submitInquiry,
    isLoading,
    error,
    latestAnswer,
    previousInquiries,
    remainingCredits,
    dilemmaTitle,
    dilemmaDescription
  } = useInquiring();

  // Only show inquiry button if treatment allows it
  const showInquiryButton = config.inquiryTokensPerDilemma > 0;
  const hasCredits = inquiryCreditsRemaining > 0;

  return (
    <>
      <motion.div
        className={`relative ${CARD_TONE} ${CARD_PAD}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "tween", duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Current dilemma"
      >
        <div className={TITLE_CLASS}>{title}</div>
        <p className={`mt-1 ${DESC_CLASS}`}>{description}</p>

        {/* Inquiry Button - positioned at bottom of card */}
        {showInquiryButton && (
          <motion.button
            onClick={openModal}
            disabled={!hasCredits}
            className={`
              mt-3 w-full px-4 py-2 rounded-lg font-semibold text-sm
              transition-all duration-200 flex items-center justify-center gap-2
              ${hasCredits
                ? 'bg-yellow-500/90 hover:bg-yellow-400 text-gray-900 hover:shadow-lg'
                : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'}
            `}
            whileHover={hasCredits ? { scale: 1.02 } : {}}
            whileTap={hasCredits ? { scale: 0.98 } : {}}
          >
            <MessageCircle className="w-4 h-4" />
            <span>
              {lang("INQUIRE_MORE")} {hasCredits && `(${inquiryCreditsRemaining})`}
            </span>
          </motion.button>
        )}
      </motion.div>

      {/* Inquiry Modal */}
      <InquiringModal
        isOpen={isOpen}
        onClose={closeModal}
        dilemmaTitle={dilemmaTitle}
        dilemmaDescription={dilemmaDescription}
        onSubmitInquiry={submitInquiry}
        previousInquiries={previousInquiries}
        remainingCredits={remainingCredits}
        isLoading={isLoading}
        latestAnswer={latestAnswer}
        error={error}
      />
    </>
  );
}

/* ------------ Demo helper for quick testing ------------- */
// You can replace this with real data later.
export function demoDilemma(): DilemmaProps {
  return {
    title: "Midnight March at the Capitol",
    description:
      "Overnight, thousands gathered outside the legislature demanding swift action. Advisors warn that any move could escalate tensions; doing nothing might look weak. Cameras are rolling, and your next decision will set the tone for the week.",
  };
}
