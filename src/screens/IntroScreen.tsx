// src/screens/IntroScreen.tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { PushFn } from "../lib/router";
import { useLogger } from "../hooks/useLogger";
import Gatekeeper from "../components/Gatekeeper";
import FragmentSlots from "../components/fragments/FragmentSlots";
import FragmentPopup from "../components/fragments/FragmentPopup";
import EmptyFragmentPopup from "../components/fragments/EmptyFragmentPopup";
import { useFragmentsStore } from "../store/fragmentsStore";
import type { PastGameEntry } from "../lib/types/pastGames";
import { audioManager, type VoKey } from "../lib/audioManager";
import { useLang } from "../i18n/lang";

// Background style using etherplace.jpg
const etherPlaceBackground = {
  backgroundImage: "url('/assets/images/BKGs/etherPlace.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};

export default function IntroScreen({ push }: { push: PushFn }) {
  const logger = useLogger();
  const lang = useLang();

  const [showGatekeeper, setShowGatekeeper] = useState(false);

  // Fragment state
  const firstIntro = useFragmentsStore((s) => s.firstIntro);
  const fragmentCount = useFragmentsStore((s) => s.getFragmentCount());
  const hasAllFragments = useFragmentsStore((s) => s.hasCompletedThreeFragments());
  const markIntroCompleted = useFragmentsStore((s) => s.markIntroCompleted);
  const setPreferredFragment = useFragmentsStore((s) => s.setPreferredFragment);
  const hasSelectedPreferred = useFragmentsStore((s) => s.hasSelectedPreferred());
  const [selectedFragment, setSelectedFragment] = useState<PastGameEntry | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isEmptySlotPopupOpen, setIsEmptySlotPopupOpen] = useState(false);

  // Final fragment selection flow state (return visits with all fragments)
  const [showWhichVersionMessage, setShowWhichVersionMessage] = useState(false);
  const [showFinalRestMessage, setShowFinalRestMessage] = useState(hasSelectedPreferred);

  // Determine gatekeeper message based on first visit and fragment count
  const getGatekeeperMessage = () => {
    // First visit - simple message
    if (firstIntro) {
      return lang("INTRO_COLLECT_FRAGMENTS");
    }

    // Returning visit with all fragments - special flow
    if (hasAllFragments) {
      // Already selected preferred → final rest message
      if (showFinalRestMessage) {
        return "Thank you! You can now go to rest, finally knowing who you are.";
      }
      // Clicked once → show "which version" message
      if (showWhichVersionMessage) {
        return "Now explore your fragments by clicking on them. Which version of yourself do you like the most?";
      }
      // Initial message
      return lang("INTRO_RETURN_ALL_FRAGMENTS");
    }

    // Returning visit without all fragments
    return lang("INTRO_RETURN_MESSAGE");
  };

  // Show gatekeeper after 1 second delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowGatekeeper(true);

      // Only play voiceover on return visits (no audio for first visit for now)
      if (!firstIntro) {
        const voKey: VoKey = hasAllFragments
          ? 'gatekeeper-return-complete'
          : 'gatekeeper-return-incomplete';
        audioManager.playVoiceover(voKey);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [firstIntro, hasAllFragments]);

  // Handle gatekeeper dismissal (click)
  const handleGatekeeperClick = () => {
    // Returning visit with all fragments - special flow
    if (!firstIntro && hasAllFragments) {
      // Already showing final rest message - do nothing
      if (showFinalRestMessage) {
        return;
      }
      // First click - transition to "which version" message
      if (!showWhichVersionMessage) {
        setShowWhichVersionMessage(true);
        audioManager.playVoiceover('gatekeeper-which-version');
        logger.log(
          "intro_which_version_shown",
          { fragmentCount },
          "Showing 'which version' message - waiting for fragment selection"
        );
        return;
      }
      // Already in "which version" mode - do nothing (wait for selection)
      return;
    }

    // First visit or return visit without all fragments - gatekeeper click does nothing special
    // The "I'm ready" button handles navigation
  };

  // Handle "I'm ready" button
  const handleReady = () => {
    // Play click sound
    audioManager.playSfx('click-soft');

    // Mark intro as completed on first visit
    if (firstIntro) {
      markIntroCompleted();
      logger.log(
        "intro_first_visit_completed",
        { screen: "/intro" },
        "User completed first intro visit"
      );
    }

    logger.log(
      "button_click_im_ready",
      { screen: "/intro", firstIntro, fragmentCount },
      "User clicked 'I'm ready' button to proceed to role selection"
    );
    push("/role");
  };

  // Handle fragment click
  const handleFragmentClick = (fragment: PastGameEntry, index: number) => {
    setSelectedFragment(fragment);
    setIsPopupOpen(true);
    logger.log(
      "fragment_popup_opened",
      { gameId: fragment.gameId, index, playerName: fragment.playerName },
      `Opened fragment popup for ${fragment.playerName}`
    );
  };

  // Handle popup close
  const handlePopupClose = () => {
    setIsPopupOpen(false);
    setSelectedFragment(null);
  };

  // Handle preferred fragment selection
  const handleSelectPreferred = (gameId: string) => {
    const roleTitle = selectedFragment?.roleTitle || "Unknown";
    setPreferredFragment(gameId);
    setIsPopupOpen(false);
    setSelectedFragment(null);
    setShowFinalRestMessage(true);
    audioManager.playVoiceover('gatekeeper-rest');
    logger.log(
      "preferred_fragment_selected",
      { roleTitle, gameId, fragmentCount },
      `User selected preferred fragment: ${roleTitle}`
    );
  };

  // Handle empty slot click
  const handleEmptySlotClick = () => {
    setIsEmptySlotPopupOpen(true);
    logger.log(
      "empty_fragment_clicked",
      { fragmentCount, hasAllFragments },
      "User clicked empty fragment slot"
    );
  };

  // Handle empty slot popup close
  const handleEmptySlotPopupClose = () => {
    setIsEmptySlotPopupOpen(false);
    logger.log(
      "empty_fragment_popup_closed",
      {},
      "User closed empty fragment popup"
    );
  };

  // Cleanup: Stop voiceover on unmount
  useEffect(() => {
    return () => {
      audioManager.stopVoiceover();
      console.log('🎤 IntroScreen unmounted - voiceover stopped');
    };
  }, []);

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center px-5 relative"
      style={etherPlaceBackground}
    >
      {/* Fragment Slots - always shown when gatekeeper is visible */}
      {showGatekeeper && (
        <FragmentSlots
          onFragmentClick={handleFragmentClick}
          onEmptySlotClick={handleEmptySlotClick}
          onAnimationComplete={() => {}}
          playAppearSound={firstIntro}
        />
      )}

      {/* Fragment Popup */}
      <FragmentPopup
        isOpen={isPopupOpen}
        fragment={selectedFragment}
        onClose={handlePopupClose}
        showSelectionButton={hasAllFragments && !hasSelectedPreferred && showWhichVersionMessage}
        onSelectPreferred={handleSelectPreferred}
      />

      {/* Empty Fragment Popup */}
      <EmptyFragmentPopup
        isOpen={isEmptySlotPopupOpen}
        onClose={handleEmptySlotPopupClose}
      />

      {/* Gatekeeper with message */}
      {showGatekeeper && (
        <Gatekeeper
          text={getGatekeeperMessage()}
          isVisible={true}
          onDismiss={handleGatekeeperClick}
          showHint={false}
        />
      )}

      {/* "I'm ready" button - shown when gatekeeper visible, but NOT when all fragments collected */}
      {showGatekeeper && !hasAllFragments && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleReady();
          }}
          className="fixed bottom-8 left-8 rounded-full px-8 py-3 font-bold text-lg bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg"
          style={{ zIndex: 150 }}
        >
          {lang("INTRO_READY_BUTTON")}
        </motion.button>
      )}
    </div>
  );
}
