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
  const lang = useLang();

  // Don't render for inactive/complete steps
  if (step === 'inactive' || step === 'complete') return null;

  // Tutorial messages for each step
  const STEP_MESSAGES: Partial<Record<TutorialStep, string>> = {
    'awaiting-avatar': lang("TUTORIAL_TIP_AVATAR"),
    'awaiting-value': lang("TUTORIAL_TIP_VALUE"),
    'awaiting-compass-pills': lang("TUTORIAL_TIP_COMPASS_PILLS"),
  };

  const message = STEP_MESSAGES[step];
  if (!message) return null;

  return createPortal(
    <AnimatePresence>
      {/* Target-aware backdrop with 4 pieces creating a click-through hole */}
      {targetElement ? (
        <TutorialBackdrop key="tutorial-backdrop" targetElement={targetElement} />
      ) : (
        /* Full screen fallback if no target */
        <motion.div
          key="tutorial-backdrop-fallback"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60"
          style={{ pointerEvents: 'auto', zIndex: 9000 }}
        />
      )}

      {/* Highlight ring around target element */}
      {targetElement && (
        <HighlightRing
          key="tutorial-highlight"
          targetElement={targetElement}
        />
      )}

      {/* Fixed bottom-center tooltip - NON-CLICKABLE now */}
      <motion.div
        key="tutorial-tooltip"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
        className="fixed left-1/2 -translate-x-1/2 bottom-24 bg-gray-900/95 text-white rounded-xl p-4 ring-2 ring-amber-400/60 shadow-2xl max-w-[300px]"
        style={{ zIndex: 9050, pointerEvents: 'auto' }}
      >
        <p className="text-sm text-center leading-relaxed">{message}</p>
        <p className="text-xs text-center text-gray-500 mt-2 font-medium uppercase tracking-wider">
          {lang("TUTORIAL_REQUIRED_ACTION") || "Action Required"}
        </p>
      </motion.div>
    </AnimatePresence>,
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: z }}
    >
      {/* Top piece */}
      <div
        className={backdropClass}
        style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - padding), pointerEvents: 'auto' }}
      />
      {/* Bottom piece */}
      <div
        className={backdropClass}
        style={{ top: rect.bottom + padding, left: 0, right: 0, bottom: 0, pointerEvents: 'auto' }}
      />
      {/* Left piece (spanning between top and bottom pieces) */}
      <div
        className={backdropClass}
        style={{ top: rect.top - padding, height: rect.height + padding * 2, left: 0, width: Math.max(0, rect.left - padding), pointerEvents: 'auto' }}
      />
      {/* Right piece (spanning between top and bottom pieces) */}
      <div
        className={backdropClass}
        style={{ top: rect.top - padding, height: rect.height + padding * 2, left: rect.right + padding, right: 0, pointerEvents: 'auto' }}
      />

      {/* Inner subtle glow for the cutout */}
      <div
        className="fixed rounded-xl border border-amber-400/20 shadow-[0_0_20px_rgba(251,191,36,0.1)]"
        style={{
          left: rect.left - padding,
          top: rect.top - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
          pointerEvents: 'none'
        }}
      />
    </motion.div>
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
