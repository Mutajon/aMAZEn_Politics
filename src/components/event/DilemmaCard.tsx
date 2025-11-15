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
// 🔧 Easy knobs (edit these first):
const TITLE_CLASS = "text-base font-semibold text-white/95";
const DESC_CLASS  = "text-[13px] leading-snug text-white/85";
const CARD_PAD    = "px-3 py-3"; // overall padding
const CARD_TONE   = "border-slate-700/50 bg-black/60 backdrop-blur-sm ring-1 ring-amber-400/40 rounded-2xl shadow-sm";

import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useInquiring } from "../../hooks/useInquiring";
import InquiringModal from "./InquiringModal";
import { SpeakerAvatar } from "./SpeakerAvatar";
import { SpeakerDescriptionModal } from "./SpeakerDescriptionModal";
import { getTreatmentConfig } from "../../data/experimentConfig";
import { useSettingsStore } from "../../store/settingsStore";
import { useDilemmaStore } from "../../store/dilemmaStore";
import { useRoleStore } from "../../store/roleStore";
import { getConfidantByLegacyKey } from "../../data/confidants";
import { useLogger } from "../../hooks/useLogger";
import { useState } from "react";
import type { TreatmentType } from "../../data/experimentConfig";

export type DilemmaProps = {
  title: string;
  description: string; // keep it ~2–3 sentences
  speaker?: string; // Speaker name from AI or predefined
  speakerDescription?: string; // AI-generated description for custom roles
};

export default function DilemmaCard({ title, description, speaker, speakerDescription }: DilemmaProps) {
  const treatment = useSettingsStore(state => state.treatment) as TreatmentType;
  const config = getTreatmentConfig(treatment);
  const inquiryCreditsRemaining = useDilemmaStore(state => state.inquiryCreditsRemaining);
  const selectedRole = useRoleStore(state => state.selectedRole);
  const roleTitle = useRoleStore(state => state.roleTitle);
  const logger = useLogger();

  const [isSpeakerModalOpen, setIsSpeakerModalOpen] = useState(false);

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

  // Determine speaker info
  const confidant = selectedRole ? getConfidantByLegacyKey(selectedRole) : undefined;

  // OVERRIDE: Always use "The Gatekeeper" for all roles
  const speakerName = "The Gatekeeper";
  const speakerDescText = "A being made of faint, shifting light. He was trapped here because he had once failed his own final test. Every lost soul that arrived, begging for a name they couldn't remember, was a chance for him to pay his endless debt. He gave them new lives—seven-day threads of existence—because only their success could possibly free him from his own long-dead failure.";
  const speakerImageId = "gatekeeper"; // Use gatekeeper imageId

  // Original implementation (commented out):
  // const speakerName = speaker || confidant?.name || "";
  // const speakerDescText = speakerDescription || confidant?.description || "";
  // const speakerImageId = confidant?.imageId;

  // Show speaker avatar only if we have a speaker name
  const showSpeaker = !!speakerName;

  const handleSpeakerClick = () => {
    logger.log('speaker_avatar_clicked', {
      speakerName,
      hasImage: !!speakerImageId,
      roleTitle: roleTitle || 'custom'
    }, `User clicked speaker avatar for ${speakerName}`);
    setIsSpeakerModalOpen(true);
  };

  return (
    <>
      {/* Speaker Avatar + Dilemma Card Layout - "Breaking the Frame" Design */}
      <motion.div
        className={`relative ${CARD_TONE} ${CARD_PAD}`}
        style={{
          overflow: 'visible', // Allow avatar to extend beyond boundaries
          paddingLeft: showSpeaker ? '100px' : undefined // Space for avatar with ~40px gap
        }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "tween", duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Current dilemma"
      >
        {/* Speaker Avatar - positioned absolutely to jut out of card boundaries */}
        {showSpeaker && (
          <div
            className="absolute"
            style={{
              left: '-60px',  // Juts out 60px to the left (moved 20px more)
              top: '-20px',   // Juts out 20px above the card
              zIndex: 10      // Ensure avatar appears above card background
            }}
          >
            <SpeakerAvatar
              speakerName={speakerName}
              imageId={speakerImageId}
              onClick={handleSpeakerClick}
            />
          </div>
        )}

        {/* Dilemma Content */}
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
              Inquire more {hasCredits && `(${inquiryCreditsRemaining})`}
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

      {/* Speaker Description Modal */}
      {showSpeaker && (
        <SpeakerDescriptionModal
          isOpen={isSpeakerModalOpen}
          onClose={() => setIsSpeakerModalOpen(false)}
          speakerName={speakerName}
          speakerDescription={speakerDescText}
          imageId={speakerImageId}
          roleTitle={roleTitle || undefined}
        />
      )}
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
