# CLAUDE.md

This file provides guidance to Claude Code when working with this political simulation game codebase.

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

```javascript
// AI Provider Switching (restart server after changing .env models)
switchToClaude()     # Switch to Anthropic Claude (requires MODEL_DILEMMA_ANTHROPIC in .env)
switchToGPT()        # Switch to OpenAI GPT (DEFAULT)

// Debug Mode (persists in localStorage)
enableDebug()        # Shows "Jump to Final Day" button in EventScreen
disableDebug()       # Disable debug mode
toggleDebug()        # Toggle debug mode
```

## Deployment

**Platform:** Render.com (Node.js hosting)

**Git Workflow:**
- `main` branch → Production deployment (auto-deploys on push)
- `development` branch → Active development work
- **Deploy:** Merge `development` → `main` → push

**Key Files:**
- `.node-version` - Specifies Node.js v20
- `server/index.mjs` - Serves static files from `dist/` in production
- `package.json` - Contains `start` script

**Environment Variables:**
```bash
NODE_ENV=production
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key  # Optional
CHAT_MODEL=gpt-5-mini
MODEL_DILEMMA=gpt-5
MODEL_MIRROR=gpt-5
IMAGE_MODEL=gpt-image-1
TTS_MODEL=tts-1
TTS_VOICE=alloy
```

**Render Configuration:**
- Build: `npm install && npm run build`
- Start: `npm start`
- Auto-deploy enabled on `main` pushes

## Project Architecture

### Tech Stack
- **Frontend**: React + TypeScript + Vite, Zustand state management, Framer Motion animations, Tailwind CSS
- **Backend**: Express.js with OpenAI/Anthropic API integration
- **Routing**: Hash-based custom router (`src/lib/router.ts`)

### Key Directories

```
├── server/
│   └── index.mjs           # Express server with AI endpoints
├── src/
│   ├── components/
│   │   ├── event/          # EventScreen UI components
│   │   └── [other components]
│   ├── data/               # Static data (compass, quiz, political systems, roles)
│   ├── hooks/              # Custom hooks for complex logic
│   ├── lib/                # Utilities (router, scoring, types)
│   ├── screens/            # Main game screens
│   ├── store/              # Zustand stores
│   └── theme/              # Styling configurations
```

### State Management (Zustand)

- **roleStore** - Selected role, political analysis, character data
- **compassStore** - 4D political compass values (what/whence/how/whither)
- **dilemmaStore** - Game state, resources, support, goals, **gameId** (conversation identifier)
- **settingsStore** - User preferences (narration, music, sound effects, debug, enableModifiers)
- **mirrorQuizStore** - Compass assessment progress
- **aftermathStore** - Aftermath data prefetching
- **dilemmaPrefetchStore** - First dilemma prefetching

### Hosted State Architecture

- **gameId** generated on game start (format: `game-{timestamp}-{random}`)
- Persisted in localStorage for conversation continuity
- Backend stores message history in-memory with 24hr TTL
- Lifecycle: `dilemmaStore.initializeGame()` → `dilemmaStore.endConversation()`

### AI Endpoints

**Core Game Engine:**
- `/api/game-turn` - Unified endpoint for all event screen data using conversation state
  * Replaces legacy stateless endpoints
  * Returns: dilemma, support shifts, mirror advice, dynamic params, compass hints
  * ~50% token savings after Day 1, ~50% faster

**Story System:**
- `/api/narrative-seed` - One-time narrative scaffold generation (2-3 dramatic threads, climax candidates)
  * Called once in BackgroundIntroScreen after compass assessment
  * Enables coherent 7-day story arc with escalating stakes

**Role & Character:**
- `/api/validate-role`, `/api/analyze-role` - Role validation and E-12 political system analysis
- `/api/generate-avatar` - AI avatar generation

**Mirror System:**
- `/api/mirror-quiz-light` - Personality summary after quiz

**End Game:**
- `/api/aftermath` - Game epilogue generation
- `/api/tts` - Text-to-speech narration (when SFX enabled)

**Multi-Provider Support:**
- Default: OpenAI GPT
- Optional: Anthropic Claude (configure in .env)
- Switch via console: `switchToClaude()` / `switchToGPT()`

## Game Flow

1. **Role Selection** → Political system analysis (predefined roles skip AI)
2. **Character Creation** → Name + AI avatar
3. **Power Distribution** → Define support levels for factions
4. **Difficulty Selection** (if `enableModifiers` ON) → Affects starting resources
5. **Goals Selection** (if `enableModifiers` ON) → Choose 2 of 3 goals
6. **Compass Assessment** → Mirror dialogue + quiz (4D values)
7. **Background Intro** → Narrative transition + Day 1 prefetch
8. **Daily Dilemmas (7 days)** → AI-generated political situations
9. **Aftermath Screen** → AI epilogue with decision breakdown
10. **Final Score Screen** → Animated score + goal bonuses
11. **Hall of Fame** → Top 50 highscores

## Key Game Mechanics

**Natural Topic Variety:**
- AI tracks conversation history to avoid repetition
- After 3 consecutive same-topic dilemmas: transitions naturally
- Exception: Urgent follow-ups (vote results, crises)

**Dynamic Parameters:**
- AI generates 1-3 measurable consequences per turn (Day 2+)
- Format: 3-5 words with emoji (e.g., "GDP +2.3%", "47 buildings burned")
- Variety enforced: economic → social → political → cultural rotation
- Component: `DynamicParameters.tsx`

**Compass Values Integration:**
- Player's top compass values sent to AI for optional tension-building
- Soft guidance only - historical authenticity prioritized
- Injected across narrative seeding and all dilemma prompts

**Dynamic Story Spine:**
- One-time narrative seeding creates 2-3 dramatic threads
- AI weaves threads throughout 7-day arc
- Turn 7: Climax directive brings threads to decisive conclusion
- Graceful degradation if seeding fails

**Vote Outcome Continuity:**
- If previous action called a vote/referendum, next dilemma MUST present results
- System-specific outcomes (e.g., direct democracies implement immediately)

**Action Confirmation Pipeline:**
1. Immediate UI: Card animation, coin flight, budget update
2. Support analysis: Background API call, animated bar updates
3. Compass analysis: Deferred to next day (appears as "compass pills")

**Prefetching Systems:**
- **Aftermath**: Starts Day 8, loads before player clicks
- **First Dilemma**: Starts during BackgroundIntroScreen "ready" phase
- 5-minute freshness check with fallback

**Compass Pills:**
- Visual feedback showing compass changes from previous action
- Appears Day 2+ with 2s auto-collapse, expandable via "+" button

**Goals System:**
- Enabled when `enableModifiers` ON
- Three types: End-State, Continuous, Behavioral
- Real-time status: ✅ met / ⏳ in progress / ❌ failed
- Displayed in ResourceBar during gameplay
- Data: `src/data/goals.ts`

**Experiment Configuration System:**
- Centralized configuration for A/B testing and research experiments
- File: `src/data/experimentConfig.ts`
- Controls feature availability based on treatment assignment

**Treatment Types:**

| Treatment | AI Options | Custom Action | API Call |
|-----------|-----------|---------------|----------|
| **fullAutonomy** | ❌ Hidden | ✅ Only option shown | Skipped (token savings) |
| **semiAutonomy** | ✅ 3 cards shown | ✅ Button below cards | Called (default) |
| **noAutonomy** | ✅ 3 cards shown | ❌ Hidden | Called |

**Usage Pattern:**
```typescript
import { getTreatmentConfig } from '@/data/experimentConfig';
import { useSettingsStore } from '@/store/settingsStore';

const treatment = useSettingsStore((state) => state.treatment);
const config = getTreatmentConfig(treatment);

// Check feature availability
if (config.generateAIOptions) { /* Call API */ }
if (config.showCustomAction) { /* Show button */ }
if (config.inquiryTokensPerDilemma > 0) { /* Future feature */ }
```

**Token Optimization:**
When treatment is `fullAutonomy`, the `/api/game-turn` endpoint skips generating AI action options, saving ~40-50% of dilemma generation tokens. The `generateActions` flag is passed from frontend to backend automatically.

**Implementation Points:**
- **Settings Store** (`settingsStore.ts`): Stores treatment assignment
- **API Hook** (`useEventDataCollector.ts`): Sends `generateActions` flag to backend
- **Backend** (`server/index.mjs`): Conditionally generates actions based on flag
- **UI** (`ActionDeckContent.tsx`): Shows/hides AI cards and custom button

**Adding New Experimental Features:**
1. Add field to `TreatmentConfig` interface in `experimentConfig.ts`
2. Set values for each treatment in `EXPERIMENT_CONFIG`
3. Read config in component/hook and implement conditional logic
4. Update this documentation

## Audio System

**Architecture:**
- Singleton: `audioManager` (`src/lib/audioManager.ts`)
- React hook: `useAudioManager()`
- Separate controls for music and SFX

**Audio Files:**
- `tempBKGmusic.mp3` - Background music (loops, 30% volume)
- `achievementsChimesShort.mp3` - Compass pills
- `coins.mp3` - Coin animation
- `click soft.mp3` - Button clicks

**Narration Integration:**
- TTS controlled by SFX toggle
- When SFX muted, narration disabled (prevents API requests)
- Used in EventScreen and AftermathScreen

## Political Compass System

Four dimensions with 10 components each (40 total):
- **What** (Ultimate goals): Truth, Liberty, Equality, Care, etc.
- **Whence** (Justification): Evidence, Tradition, Personal intuition, etc.
- **How** (Means): Law, Markets, Mobilization, Mutual Aid, etc.
- **Whither** (Recipients): Individual, Community, Nation, Global, etc.

## Political System Analysis (E-12 Framework)

**Overview:**
Power distribution analysis using Exception-12 framework - classifies political systems by who decides exceptions across 12 critical policy domains.

**11 Polity Types:**
1. Democracy
2. Republican Oligarchy
3. Hard-Power Oligarchy — Plutocracy
4. Hard-Power Oligarchy — Stratocracy
5. Mental-Might Oligarchy — Theocracy
6. Mental-Might Oligarchy — Technocracy
7. Mental-Might Oligarchy — Telecracy
8. Autocratizing (Executive)
9. Autocratizing (Military)
10. Personalist Monarchy / Autocracy
11. Theocratic Monarchy

**Exception Domains (3 Tiers):**
- **Tier I (Existential)**: Security, Civil Liberties, Information Order
- **Tier II (Constitutive)**: Diplomacy, Justice, Economy, Appointments
- **Tier III (Contextual)**: Infrastructure, Curricula, Healthcare, Immigration, Environment

**Power Holder Classification:**
- **Author (A)**: Can write/change rules (✍️ blue badge)
- **Eraser (E)**: Can veto/provide oversight (🛑 red badge)
- **Subject-Type**: Author, Eraser, Agent, Actor, Acolyte, Dictator
- **Intensity**: Strong (+), Moderate (•), Weak (-)

**API Implementation:**
- Endpoint: `/api/analyze-role`
- Model: `MODEL_ANALYZE` (gpt-4o)
- Temperature: 0.2

**Predefined Roles:**
10 historical scenarios with hardcoded E-12 data (skip API calls):
1. Athens (-404) → Stratocracy
2. Alexandria (-48) → Autocratizing (Military)
3. Florence (1494) → Theocracy
4. North America (1607) → Personalist Monarchy
5. Japan (1600) → Stratocracy
6. Haiti (1791) → Stratocracy
7. Russia (1917) → Personalist Monarchy
8. India (1947) → Stratocracy
9. South Africa (1990) → Autocratizing (Executive)
10. Mars Colony (2179) → Technocracy

**Data Structure:**
- Centralized in `src/data/predefinedRoles.ts`
- Includes: power distributions, characters, images, i18n keys
- Dynamic role count (auto-adjusts to array length)

**Adding a New Role:**
1. Add role object to `PREDEFINED_ROLES_ARRAY`
2. Add 3 i18n keys to `en.json` / `he.json`
3. Add 2 images to `/assets/images/BKGs/Roles/`
4. Role automatically appears in UI

**UI Components:**
- `PowerDistributionContent` - Displays badges and analysis button
- `E12AnalysisModal` - Full analysis modal with historical grounding

## Scoring System

| Category | Max Points | Formula |
|----------|-----------|---------|
| **Support** | 1800 | 600 per track: `(value/100) × 600` |
| **Budget** | 400 | `min(400, (budget/1000) × 400)` |
| **Ideology** | 600 | 300 per axis (5-tier from Aftermath API) |
| **Goals** | 0-300 | Completed goal bonuses (max 2 × 150) |
| **Difficulty** | ±500 | -200/0/+200/+500 flat modifier |
| **TOTAL** | ~3600 | No cap (theoretical max ~3600) |

**Hall of Fame Integration:**
- Auto-submit after score animation
- Top 50 displayed, top 3 have special colors
- Highlighting via URL: `/highscores?highlight=PlayerName`

## Meta Screens

### Hall of Fame
- Route: `/highscores`
- Top 50 highscores with avatar, name, system, compass, score
- Auto-scroll and highlight support

### Book of Achievements
- Route: `/achievements`
- Status: 🚧 Under Construction
- 7 achievements defined in `src/data/achievements.ts`
- Display only, no tracking yet

## Code Patterns & Architecture

### Component Optimization Pattern
Applied to EventScreen3, PowerDistributionScreen, ActionDeck:
1. **Extract State Hooks** - Component state management
2. **Extract Logic Hooks** - Complex operations
3. **Extract Content Components** - UI rendering
4. **Extract Specialized Systems** - Complex features

Benefits: Better React optimizations, improved maintainability

### Completed Optimizations

**Component Refactoring:**
- EventScreen: 512 → 107 lines
- PowerDistributionScreen: 597 → 67 lines
- ActionDeck: 673 → 242 lines

**AI Token Optimization:**
- Compass Analysis: 81% reduction (682 → 133 tokens)
- Dilemma Generation: 40-50% reduction (~2,000 → ~1,000 tokens)
- Overall: ~50% token savings with hosted state

**Key Strategies:**
- Compass: Top 3 per dimension only
- History: Last 2 days only
- Mirror: Minimal context
- Conversation state: Incremental updates

## Development Guidelines

- **Preserve existing design and functionality** when making changes
- **Ask for confirmation** before making additional changes beyond the task
- **Use optimization patterns** from EventScreen3, PowerDistributionScreen, ActionDeck as models
- **Annotate new code** with clear descriptions and file relationships
- **Update CLAUDE.md** whenever making significant changes
- **Keep dependencies clean** - Review `useEffect` cleanup functions
- **ALWAYS integrate data logging** (see Data Logging Integration section below)

## Data Logging Integration (MANDATORY)

When adding or modifying ANY feature, ALWAYS integrate logging. The codebase has a comprehensive data logging system for research analysis.

### Logging Architecture

**Core Components:**
- `src/hooks/useLogger.ts` - Main logging hook (player actions)
- `src/hooks/useTimingLogger.ts` - Timing measurements (decision time, typing duration)
- `src/hooks/useAIOutputLogger.ts` - AI-generated content logging
- `src/hooks/useSessionLogger.ts` - Session lifecycle tracking
- `src/hooks/useStateChangeLogger.ts` - Automatic state change tracking
- `src/lib/loggingService.ts` - Core service with queue management, auto-flush, retry logic
- `src/store/loggingStore.ts` - Zustand store for userId, sessionId, treatment
- `server/api/logging.mjs` - Backend endpoints with MongoDB storage

**Log Structure:**
```typescript
{
  timestamp: Date,
  userId: string,          // Anonymous UUID
  sessionId: string,       // Per-game session
  gameVersion: string,     // From package.json
  treatment: string,       // Experiment treatment
  source: 'player' | 'system',
  action: string,          // Event name
  value: string | number | boolean | object,  // Event data
  currentScreen: string,   // Route
  day: number,             // Game day
  role: string,            // Selected role
  comments: string         // Human-readable description
}
```

### User Interactions (Use `useLogger`)

**Required Logging:**
- All button clicks
- All text inputs (with character counts)
- All form submissions (with timing)
- All modal open/close events
- All navigation events

**Examples:**
```typescript
const logger = useLogger();

// Button click
logger.log('button_click_start', { buttonId: 'start', screen: '/splash' }, 'User clicked start button');

// Text input submission
logger.log('custom_action_submitted', {
  text: customText,
  charCount: customText.length,
  typingDuration: duration
}, `Custom action submitted (${customText.length} chars, ${duration}ms)`);

// Modal opened
logger.log('inquiry_modal_opened', {
  remainingCredits,
  dilemmaTitle
}, 'User opened inquiry modal');
```

### System Events (Use `useLogger.logSystem`)

**Required Logging:**
- All AI-generated content (dilemmas, mirror advice, support shifts, compass hints)
- All state changes (support, budget, corruption, compass values)
- All screen transitions
- All errors and failures

**Examples:**
```typescript
const logger = useLogger();

// AI output
logger.logSystem('dilemma_generated', {
  title: dilemma.title,
  description: dilemma.description,
  actionCount: dilemma.actions.length
}, `Dilemma generated: ${dilemma.title}`);

// State change
logger.logSystem('state_support_changed', {
  from: oldValue,
  to: newValue,
  delta: newValue - oldValue
}, `Support changed: ${oldValue} → ${newValue}`);
```

### Timing Measurements (Use `useTimingLogger`)

**Required Timing:**
- Decision time (dilemma presented → action confirmed)
- Typing duration (input focused → text submitted)
- Session duration (game start → game end)
- Screen time (screen entered → screen exited)

**Examples:**
```typescript
const timingLogger = useTimingLogger();

// Start timing
const timingId = timingLogger.start('decision_time', {
  day,
  dilemmaTitle
});

// End timing (automatically logs duration)
const duration = timingLogger.end(timingId, {
  actionId: 'a',
  actionTitle: 'Deploy troops'
});
```

### AI Output Logging (Use `useAIOutputLogger`)

**Required AI Logging:**
- Dilemma generation (title, description, actions, topic, scope)
- Mirror advice (text, length)
- Support shifts (deltas, explanations)
- Compass hints (value changes)
- Dynamic parameters (consequences)
- Corruption shifts (delta, reason)
- Narrative seeds (story threads)
- Inquiry responses (questions, answers)
- Custom action validation (approval/rejection)

**Examples:**
```typescript
const aiLogger = useAIOutputLogger();

// Log dilemma
aiLogger.logDilemma(dilemma, {
  topic: 'economy',
  scope: 'national',
  crisisMode: 'people'
});

// Log mirror advice
aiLogger.logMirrorAdvice(mirrorText);

// Log support shifts
aiLogger.logSupportShifts(supportEffects);
```

### State Change Tracking (Use `useStateChangeLogger`)

**Automatic Tracking:**
The `useStateChangeLogger` hook automatically subscribes to all Zustand store changes and logs:
- Support value changes (people, middle, mom)
- Budget changes
- Corruption level changes
- Compass value changes
- Score changes
- Day progression
- Goal status changes
- Crisis mode changes
- Treatment changes

**Usage:**
```typescript
// In a top-level component (e.g., App.tsx or EventScreen3)
useStateChangeLogger(); // That's it! No manual logging needed
```

### Integration Checklist

When adding or modifying features, verify:

- [ ] **User Interactions**: All clicks, inputs, submissions logged
- [ ] **System Events**: All AI outputs, state changes logged
- [ ] **Timing**: Decision time, typing duration tracked where applicable
- [ ] **Character Counts**: All text inputs log character count
- [ ] **Error Handling**: All errors logged with context
- [ ] **Navigation**: Screen changes logged with timing
- [ ] **Treatment Field**: Experiment treatment included in logs
- [ ] **Comments**: Human-readable descriptions provided

### File-Specific Guidelines

**App.tsx** (`src/App.tsx`):
- ✅ Wrapped with `ErrorBoundary` for global error catching and logging
- ✅ Uses `useStateChangeLogger` globally (all Zustand store changes auto-logged)
- ✅ Uses `useSessionLogger` globally (tab visibility, window blur/focus auto-logged)
- Pattern: Global hooks run once at app level for comprehensive coverage

**EventScreen3** (`src/screens/EventScreen3.tsx`):
- ✅ Uses `useTimingLogger` for decision time (start when interacting, end when confirmed)
- ✅ Uses `useAIOutputLogger` for all AI outputs when collected data arrives
- ✅ Logs dilemma generation, mirror advice, support shifts, compass hints, dynamic params, corruption
- Pattern: Start timing when phase becomes 'interacting', end when action confirmed

**InquiringModal** (`src/components/event/InquiringModal.tsx`):
- ✅ Uses `useTimingLogger` for typing duration
- ✅ Logs modal open/close, inquiry submission, answer received
- ✅ Logs character counts for questions
- Pattern: Start timing on modal open, end on submission

**AftermathScreen** (`src/screens/AftermathScreen.tsx`):
- ✅ Uses `useSessionLogger.end()` with comprehensive session summary
- ✅ Logs: session duration, total inquiries, total custom actions, final score, role
- ✅ Only logs on first visit (not on snapshot restoration)
- Pattern: Calculate aggregates from stores, log once when data loads

**ErrorBoundary** (`src/components/ErrorBoundary.tsx`):
- ✅ Catches all uncaught React errors
- ✅ Logs fatal errors with stack traces, component stacks, metadata
- ✅ Forces immediate flush (doesn't wait for auto-flush)
- ✅ Provides user-friendly error UI with retry options
- Pattern: Class component with componentDidCatch lifecycle

**MirrorQuizScreen** (`src/screens/MirrorQuizScreen.tsx`):
- ✅ Uses `useTimingLogger` for per-question timing
- ✅ Logs all quiz questions presented (system events)
- ✅ Logs all player answers with timing (player events)
- ✅ Logs compass pills displayed (system events)
- ✅ Logs AI-generated summary (system event)
- ✅ Logs quiz completion
- Pattern: Start timing on question presentation, end on answer selection

**ActionDeck + useActionDeckState** (`src/components/event/`):
- ✅ Uses `useTimingLogger` for custom action typing duration
- ✅ Logs custom action modal open/close
- ✅ Logs custom action submission (text, character count, typing duration)
- Pattern: Start timing on modal open, end on submission

**All Other Screens**:
- TODO: Systematic audit needed (8 screens remaining)
- Use `useLogger` for all user interactions
- Use `useSessionLogger.logScreenChange()` for navigation
- Follow patterns from completed screens above

### Testing Logging

**Verify Logging Works:**
```bash
# 1. Enable data collection in .env
ENABLE_DATA_COLLECTION=true

# 2. Check MongoDB logs collection
# Logs are stored in MongoDB and can be exported to CSV

# 3. Console logging
# All log events appear in browser console with [Logging] prefix
```

**Debug Logging:**
```javascript
// Browser console commands
loggingService.getQueue()     // View queued logs
loggingService.clearQueue()   // Clear queue
loggingService.flush()        // Force flush
```

### Common Mistakes to Avoid

❌ **DON'T:**
- Skip logging because "it's just a small change"
- Log only some user interactions in a screen
- Forget to log character counts for text inputs
- Forget to track timing for decisions/typing
- Log state changes manually (use `useStateChangeLogger`)
- Mix up `logger.log()` (player) and `logger.logSystem()` (system)

✅ **DO:**
- Log every user interaction, no exceptions
- Log all AI-generated content
- Include timing measurements for all decisions
- Use appropriate hook for the logging type
- Include descriptive comments in logs
- Test that logs appear in console during development
