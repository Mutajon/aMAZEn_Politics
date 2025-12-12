// src/screens/ThankYouScreen.tsx
// Final screen shown after experiment completion
// No navigation - experiment is complete

import { useLang } from "../i18n/lang";
import { useLanguage } from "../i18n/LanguageContext";

export default function ThankYouScreen() {
  const lang = useLang();
  const { language } = useLanguage();
  const isRTL = language === "he";

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="text-center p-8 bg-slate-800/50 rounded-2xl shadow-2xl max-w-lg border border-white/10">
        {/* Checkmark icon */}
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h1
          className="text-3xl font-bold mb-4"
          style={{ fontFamily: "Georgia, serif" }}
        >
          {lang("THANK_YOU_TITLE")}
        </h1>

        <p className="text-lg text-slate-200 mb-6 leading-relaxed">
          {lang("THANK_YOU_MESSAGE")}
        </p>

        <p className="text-sm text-slate-400">
          {lang("THANK_YOU_SUBTITLE")}
        </p>
      </div>
    </div>
  );
}
