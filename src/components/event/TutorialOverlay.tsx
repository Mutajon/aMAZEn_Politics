import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useEffect, useState, useLayoutEffect } from 'react';
import type { TutorialStep } from '../../hooks/useDay2Tutorial';

interface TutorialOverlayProps {
  step: TutorialStep;
  targetElement?: HTMLElement | null;
}

interface ArrowConfig {
  message: string;
  arrowDirection: 'up' | 'down' | 'left' | 'right' | 'none';
  arrowPosition: { x: number; y: number };
  textPosition: { x: number; y: number };
}

// Message box dimensions
const MESSAGE_WIDTH = 280;
const MESSAGE_HEIGHT = 100;
const MOBILE_BREAKPOINT = 640;
const PADDING = 20;

export function TutorialOverlay({ step, targetElement }: TutorialOverlayProps) {
  const [arrowConfig, setArrowConfig] = useState<ArrowConfig | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);

  // Scroll target element into view when step changes
  useLayoutEffect(() => {
    if (targetElement && (step === 'awaiting-avatar' || step === 'awaiting-compass-pills')) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [step, targetElement]);

  useEffect(() => {
    const updatePosition = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const isMobile = viewportWidth < MOBILE_BREAKPOINT;

      if (step === 'awaiting-avatar') {
        if (!targetElement) return;
        const rect = targetElement.getBoundingClientRect();

        if (isMobile) {
          // Mobile: Center message below avatar, arrow points up toward avatar
          setArrowConfig({
            message: 'Click on your avatar to see the current top values exhibited by your actions',
            arrowDirection: 'up',
            arrowPosition: {
              x: rect.left + rect.width / 2,
              y: rect.bottom + 20,
            },
            textPosition: {
              x: Math.max(PADDING, (viewportWidth - MESSAGE_WIDTH) / 2),
              y: rect.bottom + 70,
            },
          });
        } else {
          // Desktop: Keep existing left-of-avatar positioning
          setArrowConfig({
            message: 'Click on your avatar to see the current top values exhibited by your actions',
            arrowDirection: 'right',
            arrowPosition: {
              x: rect.left - 60,
              y: rect.top + rect.height / 2,
            },
            textPosition: {
              x: Math.max(PADDING, rect.left - 380),
              y: rect.top + rect.height / 2 - 40,
            },
          });
        }
      } else if (step === 'awaiting-value') {
        if (!targetElement) return;
        const rect = targetElement.getBoundingClientRect();
        // Value is inside modal, point from above or below depending on position
        const isInUpperHalf = rect.top < viewportHeight / 2;
        const messageWidth = isMobile ? MESSAGE_WIDTH - 40 : MESSAGE_WIDTH;

        setArrowConfig({
          message: 'Click on a value for further details',
          arrowDirection: isInUpperHalf ? 'down' : 'up',
          arrowPosition: {
            x: rect.left + rect.width / 2,
            y: isInUpperHalf ? rect.top - 40 : rect.bottom + 40,
          },
          textPosition: {
            x: Math.max(PADDING, Math.min(viewportWidth - messageWidth - PADDING, rect.left + rect.width / 2 - messageWidth / 2)),
            y: isInUpperHalf ? rect.top - 120 : rect.bottom + 60,
          },
        });
      } else if (step === 'showing-explanation') {
        // Show helpful message while explanation modal is open (no target element needed)
        const messageWidth = isMobile ? MESSAGE_WIDTH - 40 : MESSAGE_WIDTH;
        setArrowConfig({
          message: 'Read the value explanation, then click anywhere to close',
          arrowDirection: 'down',
          arrowPosition: {
            x: viewportWidth / 2,
            y: 100,
          },
          textPosition: {
            x: Math.max(PADDING, (viewportWidth - messageWidth) / 2),
            y: 120,
          },
        });
      } else if (step === 'awaiting-modal-close') {
        // After explanation closed, tell user to close the PlayerCardModal
        const messageWidth = isMobile ? MESSAGE_WIDTH - 40 : MESSAGE_WIDTH;
        setArrowConfig({
          message: 'Now close this modal to continue',
          arrowDirection: 'down',
          arrowPosition: {
            x: viewportWidth / 2,
            y: 100,
          },
          textPosition: {
            x: Math.max(PADDING, (viewportWidth - messageWidth) / 2),
            y: 120,
          },
        });
      } else if (step === 'awaiting-compass-pills') {
        // Use actual element ref for positioning (no more hardcoded values)
        if (!targetElement) {
          console.warn('[TutorialOverlay] Compass pills ref not available');
          return;
        }

        const rect = targetElement.getBoundingClientRect();
        const messageWidth = isMobile ? MESSAGE_WIDTH - 40 : MESSAGE_WIDTH;

        // Position message to the left of the button, with arrow pointing right
        setArrowConfig({
          message: 'Click here to see the most recent change to your values',
          arrowDirection: 'right',
          arrowPosition: {
            x: rect.left - 50,
            y: rect.top + rect.height / 2,
          },
          textPosition: {
            x: Math.max(PADDING, rect.left - messageWidth - 70),
            y: rect.top + rect.height / 2 - MESSAGE_HEIGHT / 2,
          },
        });
      }
    };

    updatePosition();

    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      updatePosition();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [step, targetElement]);

  if (step === 'inactive' || step === 'complete') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 80 }}>
        {/* Black overlay with 50% opacity - pointer-events-none allows clicks to pass through */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-[1px] pointer-events-none"
        />

        {/* Tutorial content */}
        {arrowConfig && (
          <>
            {/* Text box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="absolute bg-gray-900/95 text-white rounded-xl p-4 ring-2 ring-white/20 shadow-2xl pointer-events-none"
              style={{
                left: arrowConfig.textPosition.x,
                top: arrowConfig.textPosition.y,
                maxWidth: isMobile ? MESSAGE_WIDTH - 40 : MESSAGE_WIDTH + 20,
                zIndex: 50,
              }}
            >
              <p className="text-sm leading-relaxed">{arrowConfig.message}</p>
            </motion.div>

            {/* Animated arrow (hidden when direction is 'none') */}
            {arrowConfig.arrowDirection !== 'none' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="absolute pointer-events-none"
                style={{
                  left: arrowConfig.arrowPosition.x,
                  top: arrowConfig.arrowPosition.y,
                  zIndex: 50,
                }}
              >
                <motion.div
                  animate={
                    arrowConfig.arrowDirection === 'up'
                      ? { y: [0, -8, 0] }
                      : arrowConfig.arrowDirection === 'down'
                      ? { y: [0, 8, 0] }
                      : arrowConfig.arrowDirection === 'left'
                      ? { x: [0, -8, 0] }
                      : { x: [0, 8, 0] }
                  }
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                >
                  <Arrow direction={arrowConfig.arrowDirection} />
                </motion.div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </AnimatePresence>,
    document.body
  );
}

interface ArrowProps {
  direction: 'up' | 'down' | 'left' | 'right';
}

function Arrow({ direction }: ArrowProps) {
  const rotation =
    direction === 'up' ? 0 : direction === 'right' ? 90 : direction === 'down' ? 180 : 270;

  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: `rotate(${rotation}deg)` }}
      className="drop-shadow-lg"
    >
      <path
        d="M16 4L16 28M16 4L9 11M16 4L23 11"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
