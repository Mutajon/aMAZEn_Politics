// src/hooks/useAIOutputLogger.ts
// React hook for logging AI-generated content
//
// Features:
// - Log all AI outputs systematically
// - Structured logging for dilemmas, narrative seeds, inquiries, custom actions
// - Consistent format for research analysis
//
// Usage:
//   const aiLogger = useAIOutputLogger();
//
//   // Log dilemma generation
//   aiLogger.logDilemma({
//     title: "...",
//     description: "...",
//     actions: [...],
//     topic: "economy",
//     scope: "district"
//   });

import { useCallback } from 'react';
import { useLogger } from './useLogger';
import type { Dilemma } from '../lib/dilemma';

export function useAIOutputLogger() {
  const logger = useLogger();

  /**
   * Log dilemma generation
   * Captures all AI-generated dilemma data
   *
   * @param dilemma - Dilemma object with title, description, actions
   * @param metadata - Additional metadata (topic, scope, isGameEnd, etc.)
   */
  const logDilemma = useCallback(
    (dilemma: Dilemma, metadata?: {
      topic?: string;
      scope?: string;
      isGameEnd?: boolean;
      crisisMode?: string | null;
    }) => {
      logger.logSystem(
        'dilemma_generated',
        {
          title: dilemma.title,
          description: dilemma.description,
          descriptionLength: dilemma.description.length,
          actionCount: dilemma.actions?.length || 0,
          actions: dilemma.actions?.map(a => ({
            id: a.id,
            title: a.title,
            summary: a.summary,
            cost: a.cost
          })),
          isGameEnd: dilemma.isGameEnd || false,
          ...metadata
        },
        `Dilemma generated: ${dilemma.title}`
      );
    },
    [logger]
  );

  /**
   * Log narrative seed generation
   * Records initial story scaffold for 7-day arc
   *
   * @param narrativeMemory - Narrative seed data
   */
  const logNarrativeSeed = useCallback(
    (narrativeMemory: {
      threads?: string[];
      climaxCandidates?: string[];
      thematicEmphasis?: {
        coreConflict?: string;
        emotionalTone?: string;
        stakes?: string;
      };
    }) => {
      logger.logSystem(
        'narrative_seed_generated',
        {
          threadCount: narrativeMemory.threads?.length || 0,
          threads: narrativeMemory.threads,
          climaxCount: narrativeMemory.climaxCandidates?.length || 0,
          climaxCandidates: narrativeMemory.climaxCandidates,
          thematicEmphasis: narrativeMemory.thematicEmphasis
        },
        'Narrative seed generated for story arc'
      );
    },
    [logger]
  );

  /**
   * Log inquiry response
   * Records AI's answer to player's inquiry
   *
   * @param question - Player's question
   * @param answer - AI's answer
   * @param metadata - Additional context
   */
  const logInquiryResponse = useCallback(
    (question: string, answer: string, metadata?: Record<string, unknown>) => {
      logger.logSystem(
        'inquiry_response_generated',
        {
          question,
          questionLength: question.length,
          answer,
          answerLength: answer.length,
          ...metadata
        },
        `Inquiry answered (Q: ${question.length} chars, A: ${answer.length} chars)`
      );
    },
    [logger]
  );

  /**
   * Log custom action validation
   * Records AI's validation of player's custom action
   *
   * @param customAction - Player's custom action text
   * @param isValid - Validation result
   * @param feedback - AI's feedback/rejection reason (if any)
   */
  const logCustomActionValidation = useCallback(
    (customAction: string, isValid: boolean, feedback?: string) => {
      logger.logSystem(
        'custom_action_validated',
        {
          customAction,
          customActionLength: customAction.length,
          isValid,
          feedback,
          feedbackLength: feedback?.length || 0
        },
        `Custom action ${isValid ? 'approved' : 'rejected'}: ${customAction.substring(0, 50)}...`
      );
    },
    [logger]
  );

  return {
    logDilemma,
    logNarrativeSeed,
    logInquiryResponse,
    logCustomActionValidation
  };
}
