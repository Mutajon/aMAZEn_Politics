import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { TutorialStep } from '../../hooks/useDay2Tutorial';

interface TutorialOverlayProps {
  step: TutorialStep;
  targetElement?: HTMLElement | null;
}

interface ArrowConfig {
  message: string;
  arrowDirection: 'up' | 'down' | 'left' | 'right';
  arrowPosition: { x: number; y: number };
  textPosition: { x: number; y: number };
}

export function TutorialOverlay({ step, targetElement }: TutorialOverlayProps) {
  const [arrowConfig, setArrowConfig] = useState<ArrowConfig | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (step === 'awaiting-avatar') {
        if (!targetElement) return;
        const rect = targetElement.getBoundingClientRect();
        // Avatar is at top-right, point arrow from left side
        setArrowConfig({
          message: 'Click on your avatar to see the current top values exhibited by your actions',
          arrowDirection: 'right',
          arrowPosition: {
            x: rect.left - 60,
            y: rect.top + rect.height / 2,
          },
          textPosition: {
            x: Math.max(20, rect.left - 380),
            y: rect.top + rect.height / 2 - 40,
          },
        });
      } else if (step === 'awaiting-value') {
        if (!targetElement) return;
        const rect = targetElement.getBoundingClientRect();
        // Value is inside modal, point from above or below depending on position
        const isInUpperHalf = rect.top < window.innerHeight / 2;
        setArrowConfig({
          message: 'Click on a value for further details',
          arrowDirection: isInUpperHalf ? 'down' : 'up',
          arrowPosition: {
            x: rect.left + rect.width / 2,
            y: isInUpperHalf ? rect.top - 40 : rect.bottom + 40,
          },
          textPosition: {
            x: Math.max(20, Math.min(window.innerWidth - 320, rect.left + rect.width / 2 - 150)),
            y: isInUpperHalf ? rect.top - 120 : rect.bottom + 60,
          },
        });
      } else if (step === 'showing-explanation') {
        // Show helpful message while explanation modal is open (no target element needed)
        setArrowConfig({
          message: 'Read the value explanation, then click anywhere to close',
          arrowDirection: 'down',
          arrowPosition: {
            x: window.innerWidth / 2,
            y: 100,
          },
          textPosition: {
            x: Math.max(20, window.innerWidth / 2 - 150),
            y: 120,
          },
        });
      } else if (step === 'awaiting-modal-close') {
        // After explanation closed, tell user to close the PlayerCardModal
        setArrowConfig({
          message: 'Now close this modal to continue',
          arrowDirection: 'down',
          arrowPosition: {
            x: window.innerWidth / 2,
            y: 100,
          },
          textPosition: {
            x: Math.max(20, window.innerWidth / 2 - 200),
            y: 120,
          },
        });
      } else if (step === 'awaiting-compass-pills') {
        if (!targetElement) return;
        const rect = targetElement.getBoundingClientRect();
        // Compass pills button is at right edge, point arrow from left side
        setArrowConfig({
          message: 'Click here to see the latest changes to your values',
          arrowDirection: 'right',
          arrowPosition: {
            x: rect.left - 60,
            y: rect.top + rect.height / 2,
          },
          textPosition: {
            x: Math.max(20, rect.left - 380),
            y: rect.top + rect.height / 2 - 40,
          },
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
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
                maxWidth: 300,
                zIndex: 50,
              }}
            >
              <p className="text-sm leading-relaxed">{arrowConfig.message}</p>
            </motion.div>

            {/* Animated arrow */}
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
