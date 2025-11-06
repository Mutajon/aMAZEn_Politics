// src/hooks/useInquiring.ts
// Hook for managing inquiry modal state and API integration (treatment-based feature)
//
// Features:
// - Modal open/close state management
// - API call to /api/inquire endpoint
// - Integration with dilemmaStore for credit and history tracking
// - Error handling with user-friendly messages
// - Loading state management
//
// Connected to:
// - src/store/dilemmaStore.ts: Credit tracking and inquiry history
// - src/components/event/InquiringModal.tsx: UI component
// - server/index.mjs /api/inquire: Backend endpoint

import { useState, useCallback } from "react";
import { useDilemmaStore } from "../store/dilemmaStore";

type InquiryEntry = {
  question: string;
  answer: string;
  timestamp: number;
};

export function useInquiring() {
  const [isOpen, setIsOpen] = useState(false);
  const [latestAnswer, setLatestAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    gameId,
    day,
    current: currentDilemma,
    inquiryCreditsRemaining,
    getInquiriesForCurrentDay,
    addInquiry,
    canInquire
  } = useDilemmaStore();

  /**
   * Open inquiry modal
   * Resets latest answer and error state
   */
  const openModal = useCallback(() => {
    setIsOpen(true);
    setLatestAnswer("");
    setError("");
  }, []);

  /**
   * Close inquiry modal
   * Clears all transient state
   */
  const closeModal = useCallback(() => {
    setIsOpen(false);
    setLatestAnswer("");
    setError("");
  }, []);

  /**
   * Submit inquiry to API
   * - Validates inputs
   * - Calls /api/inquire endpoint
   * - Updates dilemmaStore with Q&A pair
   * - Handles errors gracefully
   */
  const submitInquiry = useCallback(
    async (question: string) => {
      // Validation
      if (!gameId) {
        setError("No active game session. Please restart the game.");
        return;
      }

      if (!currentDilemma) {
        setError("No dilemma available to inquire about.");
        return;
      }

      if (!canInquire()) {
        setError("No inquiry credits remaining.");
        return;
      }

      const trimmedQuestion = question.trim();
      if (trimmedQuestion.length < 5) {
        setError("Question must be at least 5 characters.");
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        console.log("[useInquiring] Submitting inquiry:", trimmedQuestion.substring(0, 50));

        const response = await fetch("/api/inquire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId,
            question: trimmedQuestion,
            currentDilemma: {
              title: currentDilemma.title,
              description: currentDilemma.description
            },
            day
          })
        });

        if (!response.ok) {
          // Try to extract error message from response
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.answer) {
          throw new Error("No answer received from server");
        }

        console.log("[useInquiring] Received answer:", data.answer.substring(0, 50));

        // Update dilemmaStore with Q&A pair
        addInquiry(trimmedQuestion, data.answer);

        // Update UI with latest answer
        setLatestAnswer(data.answer);
        setError("");

      } catch (err) {
        console.error("[useInquiring] Error submitting inquiry:", err);

        const errorMessage = err instanceof Error
          ? err.message
          : "Unknown error occurred";

        // User-friendly error messages
        if (errorMessage.includes("expired") || errorMessage.includes("404")) {
          setError("Your game session has expired. Please restart the game.");
        } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
          setError("Connection lost. Please check your network and try again.");
        } else {
          setError("The advisor is unavailable right now. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [gameId, day, currentDilemma, addInquiry, canInquire]
  );

  /**
   * Get previous inquiries for current day
   */
  const previousInquiries: InquiryEntry[] = getInquiriesForCurrentDay();

  /**
   * Check if feature is available based on treatment config
   */
  const isFeatureAvailable = canInquire();

  return {
    // Modal state
    isOpen,
    openModal,
    closeModal,

    // Inquiry submission
    submitInquiry,
    isLoading,
    error,

    // Answer display
    latestAnswer,

    // History and credits
    previousInquiries,
    remainingCredits: inquiryCreditsRemaining,

    // Feature availability
    isFeatureAvailable,

    // Current context
    dilemmaTitle: currentDilemma?.title || "",
    dilemmaDescription: currentDilemma?.description || ""
  };
}
