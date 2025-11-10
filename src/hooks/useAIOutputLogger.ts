// src/hooks/useAIOutputLogger.ts
// React hook for logging AI-generated content
//
// Features:
// - Log all AI outputs systematically
// - Structured logging for dilemmas, actions, mirror advice, support shifts, etc.
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
//
//   // Log mirror advice
//   aiLogger.logMirrorAdvice("Mirror's advice text");

import { useCallback } from 'react';
import { useLogger } from './useLogger';
import type { Dilemma } from '../lib/dilemma';
import type { SupportEffect, CompassPill, DynamicParam, CorruptionShift } from './useEventDataCollector';

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
   * Log mirror advice generation
   *
   * @param mirrorText - Mirror's advice text
   * @param metadata - Additional context
   */
  const logMirrorAdvice = useCallback(
    (mirrorText: string, metadata?: Record<string, unknown>) => {
      logger.logSystem(
        'mirror_advice_generated',
        {
          text: mirrorText,
          textLength: mirrorText.length,
          ...metadata
        },
        `Mirror advice generated (${mirrorText.length} chars)`
      );
    },
    [logger]
  );

  /**
   * Log support shift analysis
   * Records AI's explanation for support changes
   *
   * @param supportEffects - Array of support shifts with explanations
   */
  const logSupportShifts = useCallback(
    (supportEffects: SupportEffect[]) => {
      // Log aggregate summary only (removed individual logs to reduce redundancy)
      // Individual state changes are already logged by useStateChangeLogger
      logger.logSystem(
        'support_shifts_summary',
        {
          totalShifts: supportEffects.length,
          shifts: supportEffects.map(e => ({
            track: e.id,
            delta: e.delta,
            explanation: e.explain
          }))
        },
        `Support shifts generated for ${supportEffects.length} tracks`
      );
    },
    [logger]
  );

  /**
   * Log compass hints generation
   * Records AI's analysis of action's compass implications
   *
   * @param compassPills - Array of compass pills (value changes)
   */
  const logCompassHints = useCallback(
    (compassPills: CompassPill[]) => {
      logger.logSystem(
        'compass_hints_generated',
        {
          pillCount: compassPills.length,
          pills: compassPills.map(pill => ({
            dimension: pill.prop,
            index: pill.idx,
            delta: pill.delta
          }))
        },
        `Compass hints generated: ${compassPills.length} pills`
      );
    },
    [logger]
  );

  /**
   * Log dynamic parameters generation
   * Records AI-generated consequence metrics
   *
   * @param dynamicParams - Array of dynamic parameters
   */
  const logDynamicParams = useCallback(
    (dynamicParams: DynamicParam[]) => {
      logger.logSystem(
        'dynamic_params_generated',
        {
          paramCount: dynamicParams.length,
          params: dynamicParams.map(param => ({
            id: param.id,
            icon: param.icon,
            text: param.text,
            tone: param.tone
          }))
        },
        `Dynamic parameters generated: ${dynamicParams.length} metrics`
      );
    },
    [logger]
  );

  /**
   * Log corruption shift analysis
   * Records AI's corruption judgment and reasoning
   *
   * @param corruptionShift - Corruption shift data (score + reason)
   * @param delta - Calculated change in corruption level
   * @param newLevel - New corruption level after blending
   */
  const logCorruptionShift = useCallback(
    (corruptionShift: CorruptionShift, delta: number, newLevel: number) => {
      logger.logSystem(
        'corruption_shift_generated',
        {
          score: corruptionShift.score,
          delta,
          newLevel,
          reason: corruptionShift.reason,
          reasonLength: corruptionShift.reason.length
        },
        `Corruption: ${corruptionShift.score}/10 → ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} (${corruptionShift.reason.substring(0, 50)}...)`
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
    logMirrorAdvice,
    logSupportShifts,
    logCompassHints,
    logDynamicParams,
    logCorruptionShift,
    logNarrativeSeed,
    logInquiryResponse,
    logCustomActionValidation
  };
}
