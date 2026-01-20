import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useState, useLayoutEffect } from 'react';
import type { TutorialStep } from '../../hooks/useDay2Tutorial';
import { useLang } from '../../i18n/lang';

interface TutorialOverlayProps {
  step: TutorialStep;
  targetElement?: HTMLElement | null;
}

export function TutorialOverlay({ step, targetElement }: TutorialOverlayProps) {
  // Don't render for inactive/complete steps
  if (step === 'inactive' || step === 'complete') return null;

  // Messages for each step
  const getStepMessageKey = (step: string): string | null => {
    switch (step) {
      case 'awaiting-avatar': return "TUTORIAL_TIP_AVATAR";
      case 'awaiting-value': return "TUTORIAL_TIP_VALUE";
      case 'awaiting-compass-pills': return "TUTORIAL_TIP_COMPASS_PILLS";
      default: return null;
    }
  };
  const lang = useLang();
  const messageKey = getStepMessageKey(step);
  const message = messageKey ? lang(messageKey) : null;

  if (!message) return null;

  return createPortal(
    <div className="tutorial-overlay-container">
      <AnimatePresence mode="wait">
        {/* Target-aware backdrop with 4 pieces creating a click-through hole */}
        {targetElement ? (
          <TutorialBackdrop key={`backdrop-${step}`} targetElement={targetElement} />
        ) : (
          /* Full screen fallback if no target */
          <motion.div
            key="tutorial-backdrop-fallback"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60"
            style={{ zIndex: 9000, pointerEvents: 'auto' }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* Highlight ring around the target */}
        {targetElement && (
          <HighlightRing key={`ring-${step}`} targetElement={targetElement} />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* Fixed position message box */}
        {true && (
          <motion.div
            key={`tooltip-${step}`}
            initial={{ opacity: 0, y: step === 'awaiting-value' ? -20 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: step === 'awaiting-value' ? -20 : 20 }}
            transition={{ duration: 0.3 }}
            className={`fixed left-1/2 -translate-x-1/2 ${step === 'awaiting-value' ? 'top-24' : 'bottom-24'} bg-gray-900/95 text-white rounded-xl p-4 ring-2 ring-amber-400/60 shadow-2xl max-w-[300px]`}
            style={{ zIndex: 9500, pointerEvents: 'auto' }}
          >
            <p className="text-sm text-center leading-relaxed font-medium">{message}</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                {lang("TUTORIAL_REQUIRED_ACTION")}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}

// Target-aware backdrop creating a "hole" around the target element
function TutorialBackdrop({ targetElement }: { targetElement: HTMLElement }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const padding = 12;

  useLayoutEffect(() => {
    const updateRect = () => {
      setRect(targetElement.getBoundingClientRect());
    };
    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [targetElement]);

  if (!rect) return null;

  const backdropClass = "fixed bg-black/60 transition-all duration-300";
  const z = 9000; // Very high z-index, but elements with z-[9100] can be above

  return (
    <div key="backdrop-pieces-container" className="fixed inset-0 pointer-events-none" style={{ zIndex: z }}>
      {/* Top piece */}
      <div
        key="piece-top"
        className={backdropClass}
        style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - padding), pointerEvents: 'auto' }}
      />
      {/* Bottom piece */}
      <div
        key="piece-bottom"
        className={backdropClass}
        style={{ bottom: 0, left: 0, right: 0, top: rect.bottom + padding, pointerEvents: 'auto' }}
      />
      {/* Left piece */}
      <div
        key="piece-left"
        className={backdropClass}
        style={{
          top: rect.top - padding,
          bottom: window.innerHeight - (rect.bottom + padding),
          left: 0,
          width: Math.max(0, rect.left - padding),
          pointerEvents: 'auto'
        }}
      />
      {/* Right piece */}
      <div
        key="piece-right"
        className={backdropClass}
        style={{
          top: rect.top - padding,
          bottom: window.innerHeight - (rect.bottom + padding),
          right: 0,
          left: rect.right + padding,
          pointerEvents: 'auto'
        }}
      />
    </div>
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
      exit={{ opacity: 0 }}
      className="fixed rounded-xl"
      style={{
        left: rect.left - padding,
        top: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        zIndex: 9010, // Just above backdrop, but below highlighted elements (9100)
        pointerEvents: 'none', // Allow clicks through to the target element
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
