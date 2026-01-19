import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useLang } from '../../i18n/lang';
import { translateCompassValue, translateCompassValueFull } from '../../i18n/translateGameData';

interface ValueExplanationModalProps {
  value: {
    short: string;
    full: string;
    dimension: 'what' | 'whence' | 'how' | 'whither';
  } | null;
  onClose: () => void;
}

const DIMENSION_COLORS = {
  what: 'from-blue-500/20 to-cyan-500/20 ring-blue-400/40',
  whence: 'from-purple-500/20 to-pink-500/20 ring-purple-400/40',
  how: 'from-green-500/20 to-emerald-500/20 ring-green-400/40',
  whither: 'from-orange-500/20 to-yellow-500/20 ring-orange-400/40',
};

export function ValueExplanationModal({ value, onClose }: ValueExplanationModalProps) {
  const lang = useLang();

  if (!value) return null;

  const dimensionLabels = {
    what: lang("VALUE_EXPLANATION_DIMENSION_WHAT"),
    whence: lang("VALUE_EXPLANATION_DIMENSION_WHENCE"),
    how: lang("VALUE_EXPLANATION_DIMENSION_HOW"),
    whither: lang("VALUE_EXPLANATION_DIMENSION_WHITHER"),
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 flex items-center justify-center pointer-events-auto" style={{ zIndex: 9200 }}>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative max-w-md mx-4 pointer-events-auto cursor-pointer"
          onClick={onClose}
        >
          <div
            className={`bg-gradient-to-br ${DIMENSION_COLORS[value.dimension]} bg-gray-900/95 backdrop-blur-xl rounded-2xl p-6 ring-2 shadow-2xl`}
          >
            {/* Dimension label */}
            <div className="text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">
              {dimensionLabels[value.dimension]}
            </div>

            {/* Value name */}
            <h3 className="text-xl font-bold text-white mb-3">{translateCompassValue(value.short, lang)}</h3>

            {/* Explanation */}
            <p className="text-sm leading-relaxed text-white/90">{translateCompassValueFull(value.short, lang)}</p>

            {/* Close hint */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs text-white/50 text-center">{lang("VALUE_EXPLANATION_CLICK_TO_CLOSE")}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
