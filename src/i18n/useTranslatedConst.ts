// src/i18n/useTranslatedConst.ts
// Hook for using translated constants in React components
//
// This hook allows you to create translated constants that can be used
// in React components without moving all variables into components.
//
// Usage:
// 1. Create a translated const creator function
// 2. Use the hook in your component
// 3. The hook will return the translated values
//
// Example:
// const GENERIC_CHARACTERS = createTranslatedConst((lang) => ({
//   male: { name: lang("GENERIC_MALE_NAME"), prompt: lang("GENERIC_MALE_PROMPT") }
// }));
//
// In component:
// const genericCharacters = useTranslatedConst(GENERIC_CHARACTERS);

import { useLang } from './lang';

// Type for translated const creator function
export type TranslatedConstCreator<T> = (lang: (key: string) => string) => T;

// Hook to use translated consts
export function useTranslatedConst<T>(creator: TranslatedConstCreator<T>): T {
  const lang = useLang();
  return creator(lang);
}

// Helper to create translated consts (for documentation/type safety)
export function createTranslatedConst<T>(creator: TranslatedConstCreator<T>): TranslatedConstCreator<T> {
  return creator;
}
