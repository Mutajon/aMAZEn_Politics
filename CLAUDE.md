# CLAUDE.md

Quick reference guide for AI agents working with this political simulation game codebase.

---

## 📚 Documentation Structure

This project uses **modular documentation** for better maintainability:

- **CLAUDE.md** (this file) - Quick reference & critical instructions
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed system architecture, game mechanics
- **[API_REFERENCE.md](./API_REFERENCE.md)** - All backend endpoints with examples
- **[CONSOLE_COMMANDS.md](./CONSOLE_COMMANDS.md)** - Browser console commands for debugging
- **[LOGGING_SYSTEM.md](./LOGGING_SYSTEM.md)** - Data collection & logging integration
- **[src/i18n/README.md](./src/i18n/README.md)** - Internationalization system guide

---

## ⚠️ CRITICAL: Documentation Maintenance Guide

**When making changes to the codebase, ALWAYS update the relevant documentation:**

### Where to Add New Information

| Change Type | Documentation File | Section |
|-------------|-------------------|---------|
| **New user-facing text** | en.json + he.json | Add i18n keys, integrate with lang() |
| **New console command** | CONSOLE_COMMANDS.md | Appropriate category, add function signature & use case |
| **New API endpoint** | API_REFERENCE.md | Relevant category, include request/response schemas |
| **New game mechanic** | ARCHITECTURE.md | Core Game Systems section |
| **New component pattern** | ARCHITECTURE.md | Component Patterns section |
| **New logging integration** | LOGGING_SYSTEM.md | File-Specific Patterns section |
| **Critical workflow change** | CLAUDE.md (this file) | Update relevant critical section |
| **New Zustand store** | CLAUDE.md + ARCHITECTURE.md | State Management section |
| **New screen in game flow** | ARCHITECTURE.md | Game Flow & Screen Sequence |
| **Dev server changes** | CLAUDE.md (this file) | Critical Instructions section |

### Documentation Update Checklist

When making ANY code change, verify:

- [ ] Does this add user-facing text? → Update en.json + he.json, integrate with lang()
- [ ] Does this add a new console command? → Update CONSOLE_COMMANDS.md
- [ ] Does this add/modify an API endpoint? → Update API_REFERENCE.md
- [ ] Does this change game mechanics or flow? → Update ARCHITECTURE.md
- [ ] Does this add new logging? → Update LOGGING_SYSTEM.md
- [ ] Does this change critical workflows (git, deployment)? → Update CLAUDE.md
- [ ] Does this add a new store or state pattern? → Update both CLAUDE.md and ARCHITECTURE.md

### How to Keep Documentation Organized

1. **Don't duplicate**: If information exists in a detailed doc, reference it from CLAUDE.md (e.g., "→ See ARCHITECTURE.md")
2. **Keep CLAUDE.md concise**: Only critical info stays here (200-300 lines max)
3. **Update cross-references**: If you move content, update all links
4. **Test examples**: Ensure code examples in docs still work
5. **Version stamp**: Add date to major documentation changes

**Example**: When adding a new console command:
```markdown
// 1. Implement in code
// 2. Add to CONSOLE_COMMANDS.md with:
//    - Function signature
//    - Purpose/use case
//    - Parameters & return value
// 3. Test the command works
// 4. Commit documentation with code
```

---

## ⚠️ CRITICAL: "Save All Changes" Means ALL Uncommitted Files

**When the user asks to "save all changes" or "save changes across the project":**

1. **Run `git status`** to see ALL uncommitted files (not just files from current conversation)
2. **Commit ALL modified and untracked files** - the word "all" means everything, not just current conversation changes
3. If user asks to push, push. If not, don't push.
4. If user asks to merge branches, merge them.

**NEVER selectively commit only the files you worked on in the current session when asked to save "all" changes.**

**Distinction**:
- "Save the changes" or "commit this" = only current conversation changes
- "Save ALL changes" or "save changes across the project" = EVERY uncommitted file

---

## ⚠️ CRITICAL: Dev Server Management

**ALWAYS kill the dev server after testing code changes!**

When you run `npm run dev` (or any background server process) to test changes:
1. ✅ Test your changes
2. ✅ Verify compilation succeeds
3. ✅ **IMMEDIATELY kill the server using `KillShell` tool**

**Why**: The user needs to run the server on their side. Leaving it running blocks them from testing.

**Example**:
```bash
# After running npm run dev in background with shell_id 163811
KillShell(shell_id: "163811")
```

**Never forget this step. The user has requested this many times.**

---

## ⚠️ CRITICAL: Persistent Feature Reset Integration

**When adding ANY new persistent feature with a reset function:**

1. **Create individual reset function** (e.g., `resetMirrorDialogue()`)
2. **ALWAYS integrate with `resetAll()` function** in `src/main.tsx`
3. **Update CONSOLE_COMMANDS.md** with new command
4. **Test that `resetAll()` properly resets the new feature**

**Why**: The `resetAll()` command provides a complete first-time experience reset. Any new persistent feature MUST be included or users will have incomplete resets.

**Example Persistent Features**:
- Fragment collection → `clearFragments()`, `resetIntro()`
- Past games → `clearPastGames()`
- Mirror dialogue → `resetMirrorDialogue()`
- Experiment progress → `resetExperimentProgress()`

**resetAll() Integration Checklist**:
- [ ] Add reset call to `resetAll()` function body
- [ ] Add reset confirmation to console output
- [ ] Import store at top of `main.tsx`
- [ ] Document in CONSOLE_COMMANDS.md
- [ ] Test that reset works end-to-end

**What resetAll() Must Call**:
- All individual store reset functions
- Clear relevant localStorage keys
- Reset Zustand stores to initial state
- **Preserve**: audio settings, language preferences, display settings

---

## ⚠️ CRITICAL: Internationalization (i18n) Integration

**When adding ANY user-facing text, ALWAYS integrate with i18n immediately.**

### When to Add i18n Keys

Add translation keys for ALL user-facing text:
- **UI Elements**: Buttons, labels, headings, tooltips, placeholders, error messages
- **Game Content**: Dilemmas, actions, quiz questions/answers, dialogue lines
- **Narratives**: Story text, epilogues, character descriptions
- **System Messages**: Loading states, notifications, warnings

### Where to Add Keys

**BOTH files must be updated simultaneously**:
- `src/i18n/languages/en.json` - English translation
- `src/i18n/languages/he.json` - Hebrew translation

### Key Naming Conventions

Follow these rules for consistent key names:

1. **Format**: SCREAMING_SNAKE_CASE (e.g., `START_GAME`, `LOADING_QUOTE_1`)
2. **Gender Variants**: Add suffixes for character gender
   - Base: `QUIZ_TOWN_STATUE_Q`
   - Male: `QUIZ_TOWN_STATUE_Q_MALE`
   - Female: `QUIZ_TOWN_STATUE_Q_FEMALE`
   - Any: `QUIZ_TOWN_STATUE_Q_ANY`
3. **Sequences**: Use numbered suffixes for grouped text
   - `INTRO_LINE_0`, `INTRO_LINE_1`, `INTRO_LINE_2`, etc.
4. **Categories**: Use prefixes to group related keys
   - Quiz: `QUIZ_[NAME]_Q`, `QUIZ_[NAME]_A1`, `QUIZ_[NAME]_A2`
   - Compass: `COMPASS_VALUE_TRUTH`, `COMPASS_VALUE_LIBERTY`
   - Political: `POLITICAL_SYSTEM_DEMOCRACY`, `POLITICAL_SYSTEM_ANARCHY`
   - Characters: `ATHENS_CHAR_MALE_NAME`, `ATHENS_CHAR_MALE_PROMPT`

### Integration Patterns

**Pattern 1: Direct Import (Recommended for most cases)**
```typescript
import { lang } from '@/i18n/lang';

function MyComponent() {
  return <button>{lang("START_GAME")}</button>;
}
```

**Pattern 2: Reactive Hook (For components that need to re-render on language change)**
```typescript
import { useLang } from '@/i18n/lang';

function MyComponent() {
  const lang = useLang();
  return <h1>{lang("GAME_TITLE")}</h1>;
}
```

**Pattern 3: Translated Constants (For complex objects)**
```typescript
import { useTranslatedConst, createTranslatedConst } from '@/i18n/useTranslatedConst';

const LOADING_QUOTES = createTranslatedConst((lang) => [
  lang("LOADING_QUOTE_1"),
  lang("LOADING_QUOTE_2"),
  lang("LOADING_QUOTE_3")
]);

function MyComponent() {
  const quotes = useTranslatedConst(LOADING_QUOTES);
  return <div>{quotes[0]}</div>;
}
```

### i18n Integration Checklist

When adding new text:

- [ ] Add key to `src/i18n/languages/en.json`
- [ ] Add key to `src/i18n/languages/he.json`
- [ ] Use descriptive, semantic key name (not `BTN_1` or `TEXT_123`)
- [ ] Add gender variants (`_MALE`, `_FEMALE`, `_ANY`) if text differs by character
- [ ] Import `lang()` function in component (`import { lang } from '@/i18n/lang'`)
- [ ] Replace hardcoded text with `lang("KEY_NAME")`
- [ ] Test in both English and Hebrew languages
- [ ] Verify RTL layout works correctly for Hebrew

### Translation Helpers

Use built-in helpers for game data (`src/i18n/translateGameData.ts`):

```typescript
import { translateCompassValue, translatePoliticalSystem } from '@/i18n/translateGameData';

// Translate compass values
const translated = translateCompassValue("Liberty/Agency", lang);

// Translate political systems
const system = translatePoliticalSystem("Democracy", lang);
```

**Available Helpers**:
- `translateDemocracyLevel(level, lang)` - Democracy level names
- `translatePoliticalSystem(systemName, lang)` - Political system names
- `translateCompassValue(value, lang)` - Compass axis values
- `translateLeaderDescription(name, desc, lang)` - Leader descriptions
- `translateQuizQuestion(quizId, question, lang, gender?)` - Quiz questions (gender-aware)
- `translateQuizAnswer(quizId, index, answer, lang)` - Quiz answers

### Reference Documentation

**→ See [src/i18n/README.md](./src/i18n/README.md)** for:
- Comprehensive i18n system guide
- Language switching implementation
- RTL (right-to-left) support details
- Advanced usage patterns

---

## Project Overview

**Amaze Politics** is a political simulation game where players navigate 7-day scenarios as historical/fictional political figures, making decisions that affect support levels, budget, and a 4D political compass.

**Tech Stack**:
- **Frontend**: React 19 + TypeScript + Vite, Zustand state, Framer Motion, Tailwind CSS
- **Backend**: Express.js (Node.js), OpenAI/Anthropic AI APIs
- **Routing**: Hash-based custom router (`src/lib/router.ts`)
- **Deployment**: Render.com (Node.js hosting)

---

## Development Commands

### Terminal Commands
```bash
# Primary Development
npm run dev          # Start concurrent frontend (Vite) + backend (Express)
npm run build        # Build production frontend
npm run typecheck    # Run TypeScript type checking
npm run lint         # Run ESLint
npm run format       # Format code with Prettier

# Individual Services
npm run vite         # Frontend only (port 5173)
npm run server       # Backend only (port 3001)
npm run server:dev   # Backend with nodemon auto-restart
```

### Browser Console Commands

**Quick Reference** - Full details in [CONSOLE_COMMANDS.md](./CONSOLE_COMMANDS.md):

```javascript
// AI Provider Switching
switchToClaude()     // Switch to Anthropic Claude
switchToGPT()        // Switch to OpenAI GPT (default)
switchToXAI()        // Switch to X.AI/Grok

// Debug & Testing
enableDebug()        // Show debug features
toggleDebug()        // Toggle debug mode

// Data Management
getPastGames()       // View game history
getFragments()       // View fragment collection
resetAll()           // Full reset to first-time experience
```

---

## Key Directories

```
├── server/
│   └── index.mjs           # Express server with 20+ AI endpoints
├── src/
│   ├── components/
│   │   ├── event/          # EventScreen UI components (33 components)
│   │   ├── aftermath/      # Aftermath/epilogue components
│   │   └── fragments/      # Fragment collection UI
│   ├── data/               # Static data (compass, roles, goals, quiz)
│   ├── hooks/              # 35 custom hooks (data, logging, state)
│   ├── lib/                # Utilities (router, scoring, types)
│   ├── screens/            # 23 game flow screens
│   ├── store/              # 10 Zustand stores
│   └── theme/              # Styling configurations
```

---

## State Management (Zustand Stores)

10 stores manage all application state with localStorage persistence:

| Store | Purpose | Key Fields |
|-------|---------|-----------|
| **dilemmaStore** | Game state, progression, resources | `day`, `budget`, `support{People/Middle/Mom}`, `corruptionLevel`, `gameId` |
| **roleStore** | Selected role, character, E-12 analysis | `selectedRole`, `character`, `analysis` |
| **compassStore** | 4D political compass (40 values) | `values` (what/whence/how/whither @ 0-10) |
| **settingsStore** | User preferences | `narrationEnabled`, `musicVolume`, `debugMode`, `treatment` |
| **mirrorQuizStore** | Compass quiz progress | `quizAnswers`, `completedIndexes` |
| **pastGamesStore** | Game history (max 10) | `games[]` with avatar, score, legacy |
| **fragmentsStore** | Fragment collection (max 3) | `fragments[]`, `firstIntro` flag |
| **highscoreStore** | Top 50 scores | `entries[]` |
| **loggingStore** | Data collection metadata | `userId`, `sessionId`, `treatment` |
| **aftermathStore** | Aftermath prefetching | Cached aftermath data |

**→ See [ARCHITECTURE.md](./ARCHITECTURE.md)** for detailed store patterns and usage.

---

## Game Flow (Simplified)

```
1. SplashScreen (/) → Settings, language
2. IntroScreen (/intro) → Gatekeeper, fragments
3. RoleSelectionScreen (/role) → Choose role, session starts
4. CampaignScreen (/campaign) → Role context
5. PowerDistributionScreen (/power) → E-12 analysis
6. NameScreen (/name) → Character creation, AI avatar
7. CompassIntroStart (/compass-intro) → Compass intro
8. MirrorDialogueScreen (/compass-mirror) → Gatekeeper dialogue
9. MirrorQuizScreen (/compass-quiz) → 40-question quiz
10. BackgroundIntroScreen (/background-intro) → Narrative seed
11. [Optional] DifficultyScreen, GoalsSelectionScreen
12. EventScreen3 (/event) → MAIN GAME LOOP (Days 1-7)
13. AftermathScreen (/aftermath) → Epilogue, fragment collection
14. FinalScoreScreen (/final-score) → Score breakdown
15. HighscoreScreen (/highscores) → Top 50 hall of fame
```

**→ See [ARCHITECTURE.md](./ARCHITECTURE.md)** for detailed screen sequence with API calls.

---

## EventScreen3 (Core Game Loop)

**4-Phase Architecture**:

1. **COLLECTING** - Parallel API call to `/api/game-turn-v2`, fetch all event data
2. **PRESENTING** - Sequential reveal (dilemma → params → actions → support bars)
3. **INTERACTING** - Player chooses action, coin animation, support updates
4. **CLEANING** - Process effects, compass pills, advance day

**Key Files**:
- `src/screens/EventScreen3.tsx` - Main screen (107 lines)
- `src/hooks/useEventDataCollector.ts` - API data collection
- `src/hooks/useRevealSequence.ts` - Animation sequencing
- `src/components/event/ActionDeck.tsx` - Action card display

**→ See [ARCHITECTURE.md](./ARCHITECTURE.md)** for detailed phase breakdown.

---

## Core API Endpoints

**Quick Reference** - Full details in [API_REFERENCE.md](./API_REFERENCE.md):

| Endpoint | Purpose | When Called |
|----------|---------|-------------|
| `/api/game-turn-v2` | Main dilemma generation | Every day (1-7) |
| `/api/narrative-seed` | Story scaffold | BackgroundIntroScreen (once) |
| `/api/analyze-role` | E-12 political analysis | PowerDistributionScreen (custom roles) |
| `/api/generate-avatar` | AI character portrait | NameScreen |
| `/api/aftermath` | Game epilogue | Day 8 (AftermathScreen) |
| `/api/validate-suggestion` | Custom action validation | When player types custom action |
| `/api/tts` | Text-to-speech narration | EventScreen, AftermathScreen |

**Conversation State**: `/api/game-turn-v2` uses persistent `gameId` for stateful conversation (24hr TTL)

**Token Optimization**: ~50% savings after Day 1 via incremental context updates

---

## Treatment & Experiment System

**Three Treatment Types** (`src/data/experimentConfig.ts`):

| Treatment | AI Options | Custom Action | Inquiry Credits |
|-----------|-----------|---------------|-----------------|
| **fullAutonomy** | ❌ Hidden | ✅ Only option | 2 per dilemma |
| **semiAutonomy** | ✅ 3 cards shown | ✅ Button below | 1 per dilemma |
| **noAutonomy** | ✅ 3 cards shown | ❌ Hidden | 0 |

**Usage**:
```typescript
import { getTreatmentConfig } from '@/data/experimentConfig';
const treatment = useSettingsStore((state) => state.treatment);
const config = getTreatmentConfig(treatment);

if (config.generateAIOptions) { /* Call API */ }
if (config.showCustomAction) { /* Show button */ }
```

**→ See [ARCHITECTURE.md](./ARCHITECTURE.md)** for adding new experimental features.

---

## Data Logging (MANDATORY)

**When adding ANY feature, ALWAYS integrate logging.**

**Core Hooks**:
- `useLogger()` - Player actions (clicks, inputs, submissions)
- `useTimingLogger()` - Timing measurements (decision time, typing duration)
- `useAIOutputLogger()` - AI-generated content (dilemmas, support shifts)
- `useSessionLogger()` - Session lifecycle (start, end, screen changes)
- `useStateChangeLogger()` - Automatic Zustand store tracking (global, in App.tsx)

**Integration Checklist**:
- [ ] All button clicks logged
- [ ] All text inputs logged (with character counts)
- [ ] All timing tracked (decision time, typing duration)
- [ ] All AI outputs logged
- [ ] All navigation logged

**→ See [LOGGING_SYSTEM.md](./LOGGING_SYSTEM.md)** for detailed integration patterns and examples.

---

## Development Guidelines

1. **Preserve Functionality**: Never break existing features when refactoring
2. **Ask Before Extra Changes**: Confirm before making changes beyond the task
3. **Follow Component Patterns**: Extract state hooks → logic hooks → content components
4. **Update Documentation**: Update relevant .md files when making changes (see maintenance guide above)
5. **Integrate i18n**: ALWAYS add user-facing text to en.json + he.json, use lang() function
6. **Integrate Logging**: ALWAYS add logging for new features (see LOGGING_SYSTEM.md)
7. **Use Optimization Patterns**: Follow EventScreen3, ActionDeck refactoring patterns
8. **Test Dev Server**: Run `npm run dev` to test, then KILL the server with KillShell

---

## Deployment

**Platform**: Render.com (Node.js hosting)

**Git Workflow**:
- `main` branch → Production (auto-deploys on push)
- `development` branch → Active development
- **Deploy**: Merge `development` → `main` → push

**Key Files**:
- `.node-version` - Node.js v20
- `server/index.mjs` - Serves static files from `dist/` in production
- `package.json` - Contains `start` script

**Environment Variables**:
```bash
NODE_ENV=production
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key  # Optional
CHAT_MODEL=gpt-5-mini
MODEL_DILEMMA=gpt-5
MODEL_MIRROR=gpt-5
IMAGE_MODEL=gpt-image-1
TTS_MODEL=gemini-2.5-flash-preview-tts
TTS_VOICE=enceladus
VITE_TTS_VOICE=enceladus
ENABLE_DATA_COLLECTION=true
MONGODB_URI=mongodb://...
```

**Render Configuration**:
- Build: `npm install && npm run build`
- Start: `npm start`
- Auto-deploy: Enabled on `main` pushes

---

## Key Design Principles

1. **Token Efficiency**: Minimize AI context, use incremental updates
2. **Treatment-Aware**: Feature availability controlled by experiment config
3. **Comprehensive Logging**: All user actions and system events logged
4. **Internationalization**: All user-facing text in i18n files, support EN + HE with RTL
5. **Component Optimization**: Extract hooks, minimize re-renders
6. **Fail Gracefully**: Prefetching failures don't block gameplay
7. **Mobile-First**: Responsive design, touch-friendly UI
8. **Modular Documentation**: Keep docs organized and up-to-date

---

## 10 Most Important Files to Understand

1. **`server/index.mjs`** - Express server with all API endpoints (~5,100 lines)
2. **`src/screens/EventScreen3.tsx`** - Main game loop (107 lines after refactor)
3. **`src/hooks/useEventDataCollector.ts`** - Fetches `/api/game-turn-v2` data
4. **`src/store/dilemmaStore.ts`** - Game state (day, budget, support, corruption)
5. **`src/store/roleStore.ts`** - Selected role and E-12 analysis
6. **`src/store/compassStore.ts`** - 40 compass values (4D political spectrum)
7. **`src/data/experimentConfig.ts`** - Treatment configuration (fullAutonomy/semi/no)
8. **`src/lib/router.ts`** - Hash-based routing system
9. **`src/lib/loggingService.ts`** - Data collection core service
10. **`src/data/predefinedRoles.ts`** - 10 historical roles with E-12 data

---

## Quick Reference Card

**Need to...**
- **Add user-facing text?** → Update en.json + he.json, use lang() function
- **Add a console command?** → Update CONSOLE_COMMANDS.md
- **Add an API endpoint?** → Update API_REFERENCE.md
- **Understand game mechanics?** → Read ARCHITECTURE.md
- **Integrate logging?** → Read LOGGING_SYSTEM.md
- **Understand i18n?** → Read src/i18n/README.md
- **Find a critical workflow?** → Check CLAUDE.md (this file)

**Testing**:
```bash
npm run dev           # Start dev server
# Test your changes
KillShell(...)        # KILL the server when done
```

**Deployment**:
```bash
git checkout development
# Make changes
git add .
git commit -m "feat: description"
git push origin development
# Merge to main when ready to deploy
```

**Debugging**:
```javascript
enableDebug()         // Show debug UI
getPastGames()        // View game history
loggingService.getQueue()  // View queued logs
```

---

## Getting Help

**If you're stuck**:
1. Check the relevant detailed documentation file first
2. Search codebase for similar patterns (`Grep` tool)
3. Read the component/hook you're working with
4. Check git history for context (`git log`, `git blame`)

**When asking for clarification**:
- Reference specific files and line numbers
- Include error messages if applicable
- Describe what you've already tried

---

## Version History

- **2024-11**: Modular documentation restructure (this version)
- **2024-11**: Logging system improvements (see LOGGING_SYSTEM.md)
- **2024-10**: EventScreen3 refactoring (512 → 107 lines)
- **2024-10**: Treatment system implementation
- **2024-09**: Fragment collection system
- **2024-08**: Initial /api/game-turn-v2 implementation

---

**Last Updated**: November 2024

**For detailed information, see the linked documentation files above.**
