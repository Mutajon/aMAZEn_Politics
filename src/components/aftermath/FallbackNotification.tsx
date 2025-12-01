// src/components/aftermath/FallbackNotification.tsx
// Dismissable notification banner shown when aftermath generation failed and fallback was used
//
// Connects to:
// - src/screens/AftermathScreen.tsx: renders this when data.isFallback is true

import { AlertTriangle, X } from "lucide-react";
import { useLang } from "../../i18n/lang";

type Props = {
  onDismiss: () => void;
};

export default function FallbackNotification({ onDismiss }: Props) {
  const lang = useLang();

  return (
    <div className="bg-amber-900/30 border border-amber-500/50 rounded-lg p-4 mb-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-amber-200 text-sm">
          {lang("AFTERMATH_FALLBACK_MESSAGE")}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-amber-400 hover:text-amber-300 transition-colors p-1"
        aria-label={lang("DISMISS")}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
