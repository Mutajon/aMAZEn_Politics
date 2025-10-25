import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { updateGlobalTranslations } from './lang';

// Language types
export type Language = 'en' | 'he';

// Language context type
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  lang: (key: string) => string;
  isLoading: boolean;
}

// Create context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Language provider props
interface LanguageProviderProps {
  children: ReactNode;
}

// Language provider component
export function LanguageProvider({ children }: LanguageProviderProps) {
  // Load language from localStorage or default to Hebrew
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('game-language');
    return (saved as Language) || 'he';
  });
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Enhanced setLanguage with persistence
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('game-language', lang);
  };

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      setIsLoading(true);
      try {
        const translationsModule = await import(`./languages/${language}.json`);
        setTranslations(translationsModule.default);
        // Update global translations for direct import
        updateGlobalTranslations(translationsModule.default, language);
      } catch (error) {
        console.error(`Failed to load translations for language: ${language}`, error);
        // Fallback to Hebrew if loading fails
        if (language !== 'he') {
          const fallbackModule = await import('./languages/he.json');
          setTranslations(fallbackModule.default);
          updateGlobalTranslations(fallbackModule.default, 'he');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadTranslations();
  }, [language]);

  // Translation function
  const lang = (key: string): string => {
    return translations[key] || key; // Return key if translation not found
  };

  const value: LanguageContextType = {
    language,
    setLanguage,
    lang,
    isLoading,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// Hook to use language context
export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Convenience hook for translations
export function useTranslation() {
  const { lang } = useLanguage();
  return lang;
}
