import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TutorialTooltip } from './TutorialTooltip';
import { useLogger } from '../../hooks/useLogger';

/**
 * TutorialOverlay Component
 *
 * Creates a full-screen tutorial overlay with:
 * - Subtle gray backdrop with blur (50% opacity)
 * - Spotlight effect highlighting the target element
 * - Tooltip with tutorial message
 * - Click-anywhere to dismiss
 *
 * @param target - Element selector ("avatar" | "support")
 * @param message - Tutorial text to display
 * @param onDismiss - Callback when user dismisses tutorial
 */

interface TutorialOverlayProps {
  target: 'avatar' | 'support';
  message: string;
  onDismiss: () => void;
}

export function TutorialOverlay({ target, message, onDismiss }: TutorialOverlayProps) {
  const logger = useLogger();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const showTimeRef = useRef<number>(Date.now());

  // Find target element and get its position
  useEffect(() => {
    const targetSelector = target === 'avatar'
      ? '[data-tutorial-target="avatar"]'
      : '[data-tutorial-target="support-list"]';

    const element = document.querySelector(targetSelector);

    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      console.warn(`Tutorial target element not found: ${targetSelector}`);
    }

    // Log tutorial shown
    logger.logSystem('tutorial_tip_shown', {
      targetElement: target,
      tipNumber: target === 'avatar' ? 1 : 2,
    }, `Tutorial tip displayed: ${target}`);

    // Store show time for duration tracking
    showTimeRef.current = Date.now();
  }, [target, logger]);

  // Handle dismiss
  const handleDismiss = () => {
    const duration = Date.now() - showTimeRef.current;

    logger.log('tutorial_tip_dismissed', {
      targetElement: target,
      tipNumber: target === 'avatar' ? 1 : 2,
      timeVisible: duration,
    }, `User dismissed tutorial tip: ${target} (visible ${duration}ms)`);

    onDismiss();
  };

  // Calculate tooltip position based on target rect
  const getTooltipPosition = () => {
    if (!targetRect) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2, arrowDirection: 'up' as const };
    }

    // For avatar (top-right): position tooltip below and slightly left
    if (target === 'avatar') {
      return {
        x: targetRect.left + targetRect.width / 2 - 180, // Center tooltip, offset left
        y: targetRect.bottom + 20, // 20px below avatar
        arrowDirection: 'up' as const, // Arrow points up to avatar
      };
    }

    // For support (top-center): position tooltip below support bar
    return {
      x: targetRect.left + targetRect.width / 2 - 200, // Center tooltip
      y: targetRect.bottom + 20, // 20px below support bar
      arrowDirection: 'up' as const, // Arrow points up to support bar
    };
  };

  const tooltipPosition = getTooltipPosition();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-60 pointer-events-auto"
        style={{ zIndex: 60 }}
        onClick={handleDismiss} // Click anywhere to dismiss
      >
        {/* Subtle gray backdrop with blur */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        {/* Spotlight effect - glowing ring around target */}
        {targetRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute rounded-xl pointer-events-none"
            style={{
              left: targetRect.left - 8, // 8px padding around element
              top: targetRect.top - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.6), 0 0 40px 10px rgba(59, 130, 246, 0.3)', // Blue glow
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          />
        )}

        {/* Tooltip with tutorial message */}
        <TutorialTooltip
          message={message}
          position={tooltipPosition}
          onDismiss={handleDismiss}
        />
      </motion.div>
    </AnimatePresence>
  );
}
