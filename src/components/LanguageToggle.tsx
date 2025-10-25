// src/components/LanguageToggle.tsx
import { useLanguage } from '../i18n/LanguageContext';

interface LanguageToggleProps {
  className?: string;
}

/**
 * A simple language toggle button that can be used anywhere in the app
 * Shows current language and toggles to the other language on click
 */
export default function LanguageToggle({ className = '' }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <button
      onClick={() => setLanguage(language === 'he' ? 'en' : 'he')}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 backdrop-blur shadow-sm transition-colors ${className}`}
      aria-label={`Switch to ${language === 'he' ? 'English' : 'Hebrew'}`}
      title={`Switch to ${language === 'he' ? 'English' : 'Hebrew'}`}
    >
      <span className="text-sm font-medium">
        {language === 'he' ? 'עברית' : 'English'}
      </span>
      <span className="text-xs opacity-70">
        {language === 'he' ? 'EN' : 'עב'}
      </span>
    </button>
  );
}
