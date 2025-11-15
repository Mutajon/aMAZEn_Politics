import { motion } from 'framer-motion';

/**
 * TutorialTooltip Component
 *
 * Animated tooltip that appears near tutorial target elements.
 * Shows tutorial message with pointer arrow and optional "Got it" button.
 *
 * @param message - Tutorial text to display
 * @param position - Positioning data for tooltip placement
 * @param onDismiss - Optional callback when "Got it" clicked (redundant with click-anywhere)
 */

interface TutorialTooltipProps {
  message: string;
  position: {
    /** Tooltip X position (pixels from left) */
    x: number;
    /** Tooltip Y position (pixels from top) */
    y: number;
    /** Arrow direction: 'up' points upward toward target above */
    arrowDirection: 'up' | 'down' | 'left' | 'right';
  };
  onDismiss?: () => void;
}

export function TutorialTooltip({ message, position, onDismiss }: TutorialTooltipProps) {
  // Arrow SVG paths for each direction
  const arrowPaths = {
    up: 'M12 0 L24 12 L0 12 Z', // Points upward
    down: 'M12 12 L24 0 L0 0 Z', // Points downward
    left: 'M0 12 L12 24 L12 0 Z', // Points left
    right: 'M12 12 L0 24 L0 0 Z', // Points right
  };

  // Arrow positioning offsets
  const arrowStyles = {
    up: { top: '-12px', left: '50%', transform: 'translateX(-50%)' },
    down: { bottom: '-12px', left: '50%', transform: 'translateX(-50%)' },
    left: { left: '-12px', top: '50%', transform: 'translateY(-50%)' },
    right: { right: '-12px', top: '50%', transform: 'translateY(-50%)' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: position.arrowDirection === 'up' ? 10 : -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute pointer-events-auto"
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()} // Prevent click from bubbling to backdrop
    >
      {/* Main tooltip card */}
      <div className="relative max-w-sm px-6 py-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-white/30 shadow-2xl">
        {/* Arrow pointer */}
        <svg
          width="24"
          height="12"
          className="absolute fill-slate-800"
          style={arrowStyles[position.arrowDirection]}
        >
          <path d={arrowPaths[position.arrowDirection]} />
        </svg>

        {/* Message text */}
        <p className="text-white text-base leading-relaxed text-center">
          {message}
        </p>

        {/* Optional "Got it" button (redundant with click-anywhere, but helpful UX) */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="mt-3 w-full px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors duration-200 text-sm font-medium"
          >
            Got it
          </button>
        )}
      </div>

      {/* Subtle pulsing glow effect */}
      <div className="absolute inset-0 -z-10 blur-xl opacity-50 bg-blue-500/30 rounded-xl animate-pulse" />
    </motion.div>
  );
}
