import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useState, useLayoutEffect } from 'react';
import type { TutorialStep } from '../../hooks/useDay2Tutorial';

interface TutorialOverlayProps {
  step: TutorialStep;
  targetElement?: HTMLElement | null;
}

// Tutorial messages for each step
const STEP_MESSAGES: Partial<Record<TutorialStep, string>> = {
  'awaiting-avatar':
    'Click on your avatar to see the current top values exhibited by your actions',
  'awaiting-value': 'Click on a value for further details',
  'awaiting-compass-pills': 'Click here to see the most recent change to your values',
};

export function TutorialOverlay({ step, targetElement }: TutorialOverlayProps) {
  // Don't render for inactive/complete steps
  if (step === 'inactive' || step === 'complete') return null;

  const message = STEP_MESSAGES[step];
  if (!message) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 80 }}>
        {/* Semi-transparent overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        />

        {/* Highlight ring around target element */}
        {targetElement && <HighlightRing targetElement={targetElement} />}

        {/* Fixed bottom-center tooltip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="fixed left-1/2 -translate-x-1/2 bottom-24 bg-gray-900/95 text-white rounded-xl p-4 ring-2 ring-amber-400/60 shadow-2xl max-w-[300px]"
          style={{ zIndex: 90 }}
        >
          <p className="text-sm text-center leading-relaxed">{message}</p>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}

// Pulsing highlight ring component
function HighlightRing({ targetElement }: { targetElement: HTMLElement }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const updateRect = () => {
      setRect(targetElement.getBoundingClientRect());
    };

    // Initial position
    updateRect();

    // Scroll element into view
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Update position on scroll/resize
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [targetElement]);

  if (!rect) return null;

  // Add padding around the element for the ring
  const padding = 8;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute pointer-events-none rounded-xl"
      style={{
        left: rect.left - padding,
        top: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        zIndex: 85,
      }}
    >
      {/* Pulsing ring animation */}
      <motion.div
        className="absolute inset-0 rounded-xl"
        animate={{
          boxShadow: [
            '0 0 0 3px rgba(251, 191, 36, 0.9)',
            '0 0 0 6px rgba(251, 191, 36, 0.4)',
            '0 0 0 3px rgba(251, 191, 36, 0.9)',
          ],
        }}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}
