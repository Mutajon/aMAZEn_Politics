// src/components/LanguageSelector.tsx
import { useLanguage } from '../i18n/LanguageContext';
import type { Language } from '../i18n/LanguageContext';

interface LanguageSelectorProps {
  variant?: 'compact' | 'full' | 'lobby';
  className?: string;
  onLanguageChange?: (lang: Language) => void;
}

export default function LanguageSelector({
  variant = 'compact',
  className = '',
  onLanguageChange
}: LanguageSelectorProps) {
  const { language, setLanguage } = useLanguage();

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    onLanguageChange?.(newLang);
  };

  if (variant === 'lobby') {
    const newLang = language === 'he' ? 'en' : 'he';
    return (
      <button
        onClick={() => handleLanguageChange(newLang)}
        className={`flex items-center justify-center px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all hover:scale-105 active:scale-95 ${className}`}
        aria-label={`Switch to ${language === 'he' ? 'English' : 'Hebrew'}`}
      >
        <span className="text-sm font-medium tracking-wide">
          {language === 'he' ? 'English' : 'עברית'}
        </span>
      </button>
    );
  }

  if (variant === 'compact') {
    const newLang = language === 'he' ? 'en' : 'he';
    return (
      <button
        onClick={() => handleLanguageChange(newLang)}
        className={`flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 backdrop-blur shadow-sm transition-colors ${className}`}
        aria-label={`Switch to ${language === 'he' ? 'English' : 'Hebrew'}`}
        title={`Switch to ${language === 'he' ? 'English' : 'Hebrew'}`}
      >
        <span aria-hidden className="text-lg leading-none font-bold">
          {language === 'he' ? 'EN' : 'עב'}
        </span>
      </button>
    );
  }

  // Full variant for settings panels
  return (
    <div className={`flex items-center justify-between gap-3 py-2 ${className}`}>
      <div>
        <div className="text-sm font-medium">
          {language === 'he' ? 'שפה' : 'Language'}
        </div>
        <div className="text-xs text-white/60">
          {language === 'he' ? 'בחר את השפה המועדפת עליך' : 'Choose your preferred language'}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handleLanguageChange('he')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${language === 'he'
            ? 'bg-emerald-500/70 text-white'
            : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
        >
          עברית
        </button>
        <button
          onClick={() => handleLanguageChange('en')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${language === 'en'
            ? 'bg-emerald-500/70 text-white'
            : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
        >
          English
        </button>
      </div>
    </div>
  );
}
