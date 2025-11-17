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
// AI Provider Switching (no restart needed)
switchToClaude()     # Switch to Anthropic Claude (requires MODEL_DILEMMA_ANTHROPIC in .env)
switchToGPT()        # Switch to OpenAI GPT (DEFAULT)
switchToXAI()        # Switch to X.AI/Grok (requires MODEL_DILEMMA_XAI in .env)

// Debug Mode (persists in localStorage)
enableDebug()        # Shows "Jump to Final Day" button, extra console logs
disableDebug()       # Disable debug mode
toggleDebug()        # Toggle debug mode

// Context Control (for diagnosing Day 2+ AI failures)
skipPreviousContext()      # Skip sending previous dilemma context to AI on Day 2+
includePreviousContext()   # Include previous context (normal behavior)
togglePreviousContext()    # Toggle previous context on/off

// Corruption Tracking Toggle
enableCorruption()   # Enable corruption tracking (AI judges power misuse)
disableCorruption()  # Disable corruption tracking
toggleCorruption()   # Toggle corruption tracking

// Hidden Democracy Rating Access (after Aftermath screen)
showDemocracy()      # Display hidden democracy rating (not shown in UI)
getDemocracy()       # Alias for showDemocracy()

// Past Games Storage (saved game history)
getPastGames()       # View all stored past games (max 10)
clearPastGames()     # Clear all past games from localStorage
exportPastGames()    # Export games as JSON (auto-copies to clipboard)

// Fragment Collection (progression system)
getFragments()       # View fragment collection status
clearFragments()     # Clear all collected fragments (with confirmation)
resetIntro()         # Reset first intro flag (show full dialog again)
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
- **pastGamesStore** - Completed game history (max 10 games, localStorage persisted)
- **fragmentsStore** - Fragment collection progression (max 3 fragments, firstIntro flag)
- **highscoreStore** - Top 50 highscores (without avatars to save storage)
- **loggingStore** - User ID, treatment, consent, experiment progress

### Hosted State Architecture

- **gameId** generated on game start (format: `game-{timestamp}-{random}`)
- Persisted in localStorage for conversation continuity
- Backend stores message history in-memory with 24hr TTL
- Lifecycle: `dilemmaStore.initializeGame()` → `dilemmaStore.endConversation()`

### AI Endpoints

**Core Game Engine:**
- `/api/game-turn-v2` - Unified endpoint for all event screen data using stateful conversation
  * Uses hosted conversation state with persistent gameId
  * Returns: dilemma, support shifts, mirror advice, dynamic params, compass hints
  * ~50% token savings after Day 1, ~50% faster than original implementation

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

**Strict Topic Variety System:**
- **MAX 2 consecutive dilemmas** on the same broad topic (Military, Economy, Religion, etc.)
- **Immediate Consequences**: AI shows dramatic results of player actions, no re-questioning decisions
- **Closure Allowance**: If storyline concludes (war ends, treaty signed), AI may show 1 closure dilemma before switching
- **Forced Switching**: After 2 consecutive on same topic, AI MUST switch to different subject area
- **Implementation**: Implemented in `/api/game-turn-v2` endpoint in `server/index.mjs`
- **Goal**: Prevent "wobbling" around same decision, ensure varied gameplay experience

**Dynamic Parameters:**
- AI generates 2-3 dramatic consequences per turn (Day 2+)
- Format: emoji + vivid consequence, 3-5 words total
- Numbers are OPTIONAL — used only when they add dramatic impact
- Examples: "🔥 Royal palace stormed", "👥 4 million march", "🏛️ Parliament dissolved"
- Emoji variety suggested (not enforced programmatically)
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

**Immediate Consequence System:**
- **Goal**: Show immediate, dramatic results of player actions - no re-questioning or hesitation
- **ALL Actions Get Consequences**: Every player decision triggers consequence directive
- **Explicit Examples**: War declared → battles begin; Treaties signed → implementation starts; Arrests → trials begin
- **Specialized Detection**: Backend also detects votes, referendums, negotiations via regex for tailored result directives
- **Implementation**: Implemented in `/api/game-turn-v2` endpoint in `server/index.mjs`
- **Directive Language**: "DO NOT ask them to confirm again - THEY ALREADY DECIDED"
- **System Feel**: Results play differently across political systems (democracies implement, autocracies may override)

**Faction Identity Mapping:**
- **Challenge**: AI doesn't inherently know power holder names = faction profiles (e.g., "Coercive Force" = "Challenger")
- **Solution**: Explicit identity mapping injected in Day 2+ prompts
- **Implementation**: Implemented in `/api/game-turn-v2` endpoint via `buildGameMasterUserPrompt()`
- **Effect**: AI understands when player engages respectfully with a power holder, that faction should respond positively
- **Example**: Athens scenario - negotiating with Spartans makes Coercive Force (the Spartans) respond positively

**Action Confirmation Pipeline:**
1. Immediate UI: Card animation, coin flight, budget update
2. Support analysis: Background API call, animated bar updates
3. Compass analysis: Deferred to next day (appears as "compass pills")

**Custom Action Validation & Consequence System:**
- **Philosophy**: Highly permissive, pro-player system - default to accepting player creativity
- **Validation Endpoint**: `POST /api/validate-suggestion` in `server/index.mjs`
- **Validation Rules**:
  - ✅ **ACCEPT**: Violent, unethical, immoral, manipulative, coercive suggestions (corruption penalties applied later)
  - ✅ **ACCEPT**: Risky actions with low probability (assassination, poisoning, coups, bribery)
  - ✅ **ACCEPT**: Actions that are difficult/unlikely but theoretically possible for the role
  - ❌ **REJECT**: Only for anachronisms, gibberish, total irrelevance, or physically impossible actions
- **Authority Boundaries**:
  - Physical impossibility = Role categorically cannot access required power/technology/resources
  - Examples: Citizen can propose war ✅, attempt assassination ✅, bribe officials ✅
  - Examples: Citizen cannot directly command troops ❌ (no command authority)
  - Examples: King can issue any decree ✅, but cannot use internet in 1600 ❌ (anachronism)
- **Constructive Rejections**: When rejecting, suggest feasible alternatives
  - Example: "Try 'Propose to Assembly that we declare war' or 'Attempt to assassinate the enemy commander'"
- **Probability-Aware Consequences**:
  - Risky actions get realistic success/failure outcomes based on:
    * Historical context (surveillance tech, loyalty systems, security apparatus)
    * Role resources (budget, connections, authority)
    * Faction support (allies who could help)
    * Action complexity (poisoning one person vs. overthrowing government)
  - Outcome types: High-risk failure, partial success, success with consequences, clean success (rare)
  - Historical realism: Ancient/Medieval (easier covert action, brutal if caught) vs. Modern (higher surveillance)
- **Corruption Evaluation**:
  - ALL actions evaluated on 0-10 scale (including violent/unethical choices)
  - Rubric: Intent (0-4) + Method (0-3) + Impact (0-3)
  - Violence NOT automatically corruption - depends on intent/method/impact
  - Examples: Assassination for power = 6-8; Assassination for strategy = 3-5; Defensive war = 0-1
  - Examples: Coup for self-enrichment = 7-9; Coup to end tyranny = 2-4
  - Most normal governance scores 0-2 even if controversial
- **Integration**: Custom actions flow through same pipeline as AI-generated options
  - Frontend converts custom text to ActionCard
  - Sent to `/api/game-turn-v2` as `playerChoice` parameter
  - Authority-filtered consequence generation (democracies vote, autocracies decree)
  - Support shifts, corruption penalties, compass changes all apply identically

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
When treatment is `fullAutonomy`, the `/api/game-turn-v2` endpoint skips generating AI action options, saving ~40-50% of dilemma generation tokens. The `generateActions` flag is passed from frontend to backend automatically.

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

### Past Games Storage
- **Purpose**: Save completed game history for future gallery/comparison screens
- **Storage**: localStorage (max 10 games, auto-prunes oldest)
- **Size**: ~50-80KB per game (includes full base64 avatars)

**Stored Data Per Game:**
- Player name, avatar (base64), role title, political system
- Final score, support levels (people/middle/mom), corruption
- Legacy string ("You will be remembered as...")
- 3-6 snapshot highlights (dramatic aftermath events)
- Top 2-3 compass values per dimension (8-12 total)
- Democracy/autonomy/liberalism ratings

**Architecture:**
- **Store**: `src/store/pastGamesStore.ts` - Zustand store with localStorage persistence
- **Types**: `src/lib/types/pastGames.ts` - TypeScript interfaces
- **Service**: `src/lib/pastGamesService.ts` - Data collection helpers
- **Integration**: `src/screens/AftermathScreen.tsx` - Saves after session summary

**Console Commands:**
```javascript
getPastGames()      // View all stored games (formatted table)
clearPastGames()    // Clear all stored games (with confirmation)
exportPastGames()   // Export as JSON (auto-copies to clipboard)
```

**Key Functions:**
- `buildPastGameEntry(aftermathData)` - Collects data from all stores
- `getTopCompassValues(compassValues, topN)` - Extracts top compass values
- `selectSnapshotHighlights(snapshot, maxCount)` - Prioritizes dramatic events
- `addGame(entry)` - Saves game with duplicate detection & auto-pruning

**Auto-Pruning:**
- Keeps only 10 most recent games
- Sorted by timestamp (newest first)
- Oldest games automatically removed when limit exceeded

**Logging:**
- Logs `past_game_saved` event with game metadata
- Integrates with existing logging system
- Saved only on first aftermath visit (not on snapshot restoration)

**Future Use Cases:**
- Gallery screen displaying all past games
- Side-by-side comparison of playthroughs
- Personal statistics across games
- Export/share game summaries

### Fragment Collection System
- **Purpose**: Progressive narrative system where players collect 3 fragments to "remember who they are"
- **Storage**: localStorage (max 3 fragments, firstIntro flag)
- **Integration**: Intro screen adapts based on fragment collection progress

**Fragment Lifecycle:**
1. **First Visit**: Full gatekeeper dialog (26 lines), fragments appear at line 20
2. **Game Completion**: Fragment automatically collected when reaching aftermath screen
3. **Return Visits**: Abbreviated gatekeeper message, fragment slots immediately visible
4. **3 Fragments**: Special completion message from gatekeeper

**Fragment Data:**
- Links to `pastGamesStore` via `gameId`
- Displays: Player avatar, name, setting, legacy, snapshot pills
- Click fragment → popup with full game details

**First Intro Flag:**
- `firstIntro: true` → Show full 26-line dialog
- `firstIntro: false` → Show abbreviated message + fragment slots
- Automatically set to `false` after first "I'm ready" click

**Gatekeeper Messages:**
- **First visit**: Original 26-line narrative
- **Returning (< 3 fragments)**: "Are you ready for another trip to the world of the living?"
- **Returning (3 fragments)**: "You've collected all the required fragments. You're ready to move on to your eternal rest."

**Architecture:**
- **Store**: `src/store/fragmentsStore.ts` - Tracks fragments and firstIntro flag
- **Components**:
  - `src/components/fragments/FragmentSlots.tsx` - Visual display (3 slots)
  - `src/components/fragments/FragmentPopup.tsx` - Details modal
- **Integration Points**:
  - `src/screens/IntroScreen.tsx` - Conditional dialog + fragment display
  - `src/screens/AftermathScreen.tsx` - Fragment collection (lines 223-250)
  - `src/screens/FinalScoreScreen.tsx` - Routes to `/intro` (not `/role`)

**Visual Design:**
- Empty slots: Puzzle icon (Lucide React), 50% opacity
- Filled slots: Player avatar, clickable
- Sizes: 50x50px (desktop), 35x35px (mobile)
- Layout: Horizontal row at top center of intro screen
- Animation: Fade-in, scale transitions (Framer Motion)

**Console Commands:**
```javascript
getFragments()       // View collection status
clearFragments()     // Reset for testing
resetIntro()         // Reset first intro flag
```

**Logging Events:**
- `intro_first_visit_completed` - First intro dialog completed
- `intro_return_visit` - Subsequent visits
- `fragment_collected` - Fragment added (includes index, player name, role)
- `fragments_all_collected` - All 3 fragments collected
- `fragment_popup_opened` - User clicked fragment for details

**localStorage Key:**
- `amaze-politics-fragments-v1`

**Future Enhancements:**
- Special reward/ending when 3 fragments collected
- Fragment-specific achievements
- "True Name" reveal system

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

## Recent Logging System Improvements (Nov 2024)

### Critical Bug Fixes

**1. Debug Mode Logic Inversions (FIXED)**
- **Files**: `useSessionLogger.ts`, `useStateChangeLogger.ts`
- **Issue**: Debug mode checks were inverted (`if (!debugMode)` instead of `if (debugMode)`)
- **Impact**: Logging only worked in debug mode, completely broken in production
- **Fix**: Inverted logic to skip logging when debugMode is true
- **Lines**: useSessionLogger.ts (44, 74, 109), useStateChangeLogger.ts (30)

**2. Massive Duplication Bug (FIXED)**
- **File**: `EventScreen3.tsx` → `useEventDataCollector.ts`
- **Issue**: AI output logging in EventScreen3 useEffect fired every time collectedData changed
- **Impact**: 10-30 duplicate logs per dilemma (750 dilemma_generated logs instead of ~21)
- **Fix**: Moved logging to `useEventDataCollector.ts` collectData() function (logs once at source)
- **Reduction**: ~90% reduction in AI output logs

**3. Visibility Event Noise (FIXED)**
- **File**: `useSessionLogger.ts`
- **Issue**: 4 overlapping events per tab switch (window_blur, window_focus, player_left, player_returned)
- **Impact**: ~58 noise events per playthrough with low research value
- **Fix**: Removed entire visibility tracking useEffect (lines 148-217)
- **Justification**: Events overlapped, provided no gameplay insight

### Feature Improvements

**4. Session Lifecycle (FIXED)**
- **Files**: `RoleSelectionScreen.tsx`, `AftermathScreen.tsx`, `SplashScreen.tsx`
- **Changes**:
  - Session starts when role is confirmed (not on splash screen)
  - Session ends when aftermath screen loads
  - Added splash_screen_loaded event
- **Impact**: More accurate session timing, cleaner event sequence

**5. Compass Logging Enhancement (FIXED)**
- **File**: `useStateChangeLogger.ts`
- **Issue**: Logged compass changes as dimension[index] (e.g., "what[6]: +2")
- **Fix**: Now logs component names from compass-data.ts (e.g., "Care +2")
- **Impact**: Human-readable compass logs, easier analysis

**6. Support Shift Redundancy (FIXED)**
- **File**: `useAIOutputLogger.ts`
- **Issue**: Logged both individual support_shift_generated AND support_shifts_summary
- **Impact**: 1,540 redundant individual logs + 513 summary logs
- **Fix**: Removed individual logs, kept only summary with explanations
- **Reduction**: ~75% reduction in support shift logs

**7. Player Interaction Logging (IMPROVED)**
- **File**: `CompassPillsOverlay.tsx`
- **Added**: compass_pills_opened, compass_pills_closed events
- **Impact**: Track user engagement with compass feedback UI

### Data Quality Improvements Summary

| Issue | Before | After | Reduction |
|-------|--------|-------|-----------|
| AI Output Duplicates | ~2,277 logs | ~75 logs | 90% |
| Visibility Noise | 58 events | 0 events | 100% |
| Support Redundancy | 2,053 logs | 513 logs | 75% |
| Debug Mode Bug | Broken in prod | Fixed | N/A |
| Compass Readability | "what[6]" | "Care" | N/A |

**Total Impact**: ~3,000 fewer logs per playthrough, cleaner data, human-readable output

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

**CompassPillsOverlay** (`src/components/event/CompassPillsOverlay.tsx`):
- ✅ Logs compass pills opened/closed (player events)
- ✅ Logs pill count with each interaction
- Pattern: onClick handlers for expand/collapse buttons

**SplashScreen** (`src/screens/SplashScreen.tsx`):
- ✅ Logs splash_screen_loaded (system event)
- Pattern: useEffect on mount

**RoleSelectionScreen** (`src/screens/RoleSelectionScreen.tsx`):
- ✅ Starts session when role is confirmed (both predefined and custom roles)
- ✅ Logs session_start with role metadata
- Pattern: sessionLogger.start() after role confirmation

**All Other Screens**:
- TODO: Systematic audit needed (6 screens remaining)
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
