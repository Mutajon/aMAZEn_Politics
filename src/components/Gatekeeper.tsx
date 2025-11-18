/**
 * Gatekeeper Tutorial Component
 *
 * Displays a speech bubble with typewriter-animated text coming from the Gatekeeper character.
 * Used for tutorial hints and guidance throughout the game.
 *
 * Features:
 * - Typewriter effect with click-to-skip
 * - Subtle bobbing animation on speech bubble
 * - Floating animation on Gatekeeper image
 * - User dismissable after typing completes
 * - Fixed position in bottom-right corner
 *
 * Usage:
 * ```tsx
 * <Gatekeeper
 *   text="Welcome to the game! Click on any card to begin."
 *   isVisible={showHint}
 *   onDismiss={() => setShowHint(false)}
 * />
 * ```
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { gatekeeperTheme } from '../theme/gatekeeperTheme';
import { useLogger } from '../hooks/useLogger';

interface GatekeeperProps {
  /** The text to display in the speech bubble */
  text: string;
  /** Controls visibility of the component */
  isVisible: boolean;
  /** Callback when user dismisses the component */
  onDismiss: () => void;
  /** Optional: milliseconds per character (default: 25ms) */
  typingSpeed?: number;
  /** Optional: auto-close after typing completes (in milliseconds, default: no auto-close) */
  autoClose?: number;
  /** Optional: show hint text ("Click to skip" / "Click to dismiss") - default: true */
  showHint?: boolean;
}

export default function Gatekeeper({
  text,
  isVisible,
  onDismiss,
  typingSpeed = gatekeeperTheme.typingSpeedMs,
  autoClose,
  showHint = true,
}: GatekeeperProps) {
  const logger = useLogger();
  const [shownText, setShownText] = useState('');
  const [typingComplete, setTypingComplete] = useState(false);
  const doneRef = useRef(false);
  const loggedShowRef = useRef(false);

  // Responsive sizing for mobile devices
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Responsive theme values
  const responsiveTheme = {
    bottomOffset: isMobile ? 16 : gatekeeperTheme.bottomOffset,
    rightOffset: isMobile ? 12 : gatekeeperTheme.rightOffset,
    maxWidth: isMobile ? 280 : gatekeeperTheme.maxWidth,
    minWidth: isMobile ? 280 : 380, // Fixed width to prevent position shifting
    fontSizePx: isMobile ? 14 : gatekeeperTheme.fontSizePx,
    paddingX: isMobile ? 16 : gatekeeperTheme.paddingX,
    paddingY: isMobile ? 12 : gatekeeperTheme.paddingY,
    tailWidth: isMobile ? 24 : gatekeeperTheme.tailWidth,
    tailHeight: isMobile ? 28 : gatekeeperTheme.tailHeight,
    imageWidth: isMobile ? 200 : 280, // 200% larger (was 100/140)
  };

  // Reset state when visibility or text changes
  useEffect(() => {
    if (isVisible) {
      setShownText('');
      setTypingComplete(false);
      doneRef.current = false;
      loggedShowRef.current = false;
    }
  }, [isVisible, text]);

  // Typewriter effect
  useEffect(() => {
    if (!isVisible || doneRef.current) return;

    // Log when Gatekeeper is shown (only once per appearance)
    if (!loggedShowRef.current) {
      logger.logSystem(
        'gatekeeper_shown',
        {
          text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          textLength: text.length,
        },
        `Gatekeeper shown with ${text.length} characters`
      );
      loggedShowRef.current = true;
    }

    let i = 0;
    const intervalId = window.setInterval(() => {
      i++;
      setShownText(text.slice(0, i));

      if (i >= text.length) {
        doneRef.current = true;
        setTypingComplete(true);
        window.clearInterval(intervalId);

        // Auto-close if configured
        if (autoClose) {
          setTimeout(() => {
            onDismiss();
          }, autoClose);
        }
      }
    }, typingSpeed);

    return () => window.clearInterval(intervalId);
  }, [isVisible, text, typingSpeed, autoClose, onDismiss, logger]);

  // Click handler - skip typing or dismiss
  const handleClick = () => {
    if (!typingComplete) {
      // Skip typing - instantly show full text
      setShownText(text);
      setTypingComplete(true);
      doneRef.current = true;

      logger.log(
        'gatekeeper_typing_skipped',
        {
          charactersRevealed: shownText.length,
          totalCharacters: text.length,
          percentComplete: Math.round((shownText.length / text.length) * 100),
        },
        `Typing skipped at ${Math.round((shownText.length / text.length) * 100)}%`
      );
    } else {
      // Dismiss
      logger.log(
        'gatekeeper_dismissed',
        {
          textLength: text.length,
        },
        'Gatekeeper dismissed by user'
      );
      onDismiss();
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed z-[100] cursor-pointer select-none"
          style={{
            bottom: `${responsiveTheme.bottomOffset}px`,
            right: `${responsiveTheme.rightOffset}px`,
          }}
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 300 }}
          transition={{
            duration: 0.8,
            ease: [0.4, 0, 0.2, 1],
            opacity: { duration: 0.5 }
          }}
          onClick={handleClick}
        >
          {/* Speech Bubble (static - no bobbing animation) */}
          <motion.div
            className="relative mb-3"
            style={{
              maxWidth: `${responsiveTheme.maxWidth}px`,
              minWidth: `${responsiveTheme.minWidth}px`,
            }}
          >
            {/* Bubble content */}
            <div
              className="relative"
              style={{
                background: gatekeeperTheme.bubbleBackground,
                color: gatekeeperTheme.textColor,
                fontFamily: gatekeeperTheme.fontFamily,
                fontSize: `${responsiveTheme.fontSizePx}px`,
                lineHeight: gatekeeperTheme.lineHeight,
                padding: `${responsiveTheme.paddingY}px ${responsiveTheme.paddingX}px`,
                borderRadius: `${gatekeeperTheme.borderRadius}px`,
                boxShadow: gatekeeperTheme.shadow,
              }}
            >
              {/* Text content */}
              <div className="relative z-10">
                {shownText}
                {!typingComplete && (
                  <motion.span
                    className="inline-block ml-0.5"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    |
                  </motion.span>
                )}
              </div>

              {/* Hint text */}
              {showHint && (
                <div className="mt-2 text-xs opacity-60">
                  {typingComplete ? 'Click to dismiss' : 'Click to skip'}
                </div>
              )}
            </div>

            {/* Speech bubble tail (pointing down-left to Gatekeeper) */}
            <svg
              className="absolute -bottom-6 left-4"
              width={responsiveTheme.tailWidth}
              height={responsiveTheme.tailHeight}
              viewBox="0 0 30 35"
              style={{
                filter: 'drop-shadow(0 4px 8px rgba(76, 29, 149, 0.3))',
              }}
            >
              <defs>
                <linearGradient id="tailGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#4C1D95" />
                  <stop offset="100%" stopColor="#5B21B6" />
                </linearGradient>
              </defs>
              <path d={gatekeeperTheme.tailPath} fill="url(#tailGradient)" />
            </svg>
          </motion.div>

          {/* Gatekeeper Image with floating animation */}
          <motion.div
            className="mx-auto"
            style={{
              width: `${responsiveTheme.imageWidth}px`,
            }}
            animate={{
              y: [0, -gatekeeperTheme.floatDistance, 0],
            }}
            transition={{
              y: {
                repeat: Infinity,
                duration: gatekeeperTheme.floatDuration,
                ease: 'easeInOut',
                times: [0, 0.5, 1],
              },
            }}
          >
            <img
              src="/assets/images/gatekeeper.png"
              alt="Gatekeeper"
              className="w-full h-auto drop-shadow-2xl"
              draggable={false}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
