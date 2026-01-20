// src/i18n/lang.ts
import { useLanguage } from './LanguageContext';

// Global translations store
let globalTranslations: Record<string, string> = {};
let currentLanguage: string = 'he';

// Function to update global translations (called by LanguageProvider)
export function updateGlobalTranslations(translations: Record<string, string>, language: string) {
  globalTranslations = translations;
  currentLanguage = language;
}

// Direct lang function that can be imported
export function lang(key: string): string {
  if (globalTranslations[key]) {
    return globalTranslations[key];
  }
  // Try base key if gender variant not found
  const baseKey = key.replace(/_(MALE|FEMALE|ANY)$/, '');
  if (baseKey !== key && globalTranslations[baseKey]) {
    return globalTranslations[baseKey];
  }
  return key;
}

// Hook version for components that need reactivity
export function useLang() {
  const { lang: contextLang } = useLanguage();
  return contextLang;
}

// Get current language
export function getCurrentLanguage(): string {
  return currentLanguage;
}
