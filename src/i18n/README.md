# Internationalization (i18n) System

This project includes a complete internationalization system that allows switching between Hebrew and English languages.

## 🚀 Quick Start

### Using translations in components:

```tsx
// Method 1: Direct import (recommended)
import { lang } from '../i18n/lang';

function MyComponent() {
  return (
    <div>
      <h1>{lang("GAME_TITLE")}</h1>
      <button>{lang("START_GAME")}</button>
    </div>
  );
}

// Method 2: Hook (for reactive components)
import { useLang } from '../i18n/lang';

function MyComponent() {
  const lang = useLang();
  
  return (
    <div>
      <h1>{lang("GAME_TITLE")}</h1>
      <button>{lang("START_GAME")}</button>
    </div>
  );
}
```

### Adding language selector:

```tsx
import LanguageSelector from '../components/LanguageSelector';

// Full version (for settings panels only)
<LanguageSelector variant="full" />
```

## 📁 File Structure

```
src/i18n/
├── LanguageContext.tsx     # Main context and hooks
└── languages/
    ├── en.json            # English translations
    └── he.json            # Hebrew translations

src/components/
├── LanguageSelector.tsx   # Smart language selector component
└── LanguageToggle.tsx     # Simple toggle button
```

## 🔧 Features

- ✅ **Persistent language selection** - Saved to localStorage
- ✅ **Dynamic language switching** - No page reload required
- ✅ **Fallback system** - Shows key if translation missing
- ✅ **TypeScript support** - Full type safety
- ✅ **Reusable components** - LanguageSelector and LanguageToggle
- ✅ **Smart defaults** - Defaults to Hebrew, falls back gracefully

## 📝 Adding New Translations

1. **Add to both language files:**

```json
// en.json
{
  "NEW_FEATURE": "New Feature"
}

// he.json
{
  "NEW_FEATURE": "תכונה חדשה"
}
```

2. **Use in components:**

```tsx
// Direct import (recommended)
import { lang } from '../i18n/lang';
return <div>{lang("NEW_FEATURE")}</div>;

// Or with hook
import { useLang } from '../i18n/lang';
const lang = useLang();
return <div>{lang("NEW_FEATURE")}</div>;
```

## 🎯 Best Practices

- **Use descriptive keys**: `START_GAME` instead of `START`
- **Group related keys**: `SETTINGS_*`, `GAME_*`, etc.
- **Keep keys consistent**: Same naming convention across all files
- **Test both languages**: Always verify Hebrew and English work
- **Use LanguageSelector**: Don't create custom language switchers

## 🔄 Language Management

The system automatically:
- Loads saved language from localStorage on startup
- Falls back to Hebrew if no saved preference
- Persists language changes to localStorage
- Updates all components when language changes

## 🎨 Available Components

### LanguageSelector
- `variant="full"` - Full settings panel with descriptions (recommended for settings)

### LanguageToggle
- Simple button showing current language name
- Good for headers or navigation bars

## 🚨 Important Notes

- **Prefer direct import**: `import { lang } from '../i18n/lang'` is cleaner
- **Use hooks for reactive components**: `useLang()` when you need reactivity
- Always use `lang()` function, not hardcoded strings
- Test language switching in all screens
- Keep translations synchronized between languages
- Use semantic keys that describe the content, not the UI element
