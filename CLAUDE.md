# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Primary Development
```bash
npm run dev          # Start concurrent frontend (Vite) + backend (Express) development
npm run build        # Build production frontend
npm run typecheck    # Run TypeScript type checking
npm run lint         # Run ESLint on TypeScript files
npm run format       # Format code with Prettier
```

### Individual Services
```bash
npm run vite         # Frontend only (Vite dev server on port 5173)
npm run server       # Backend only (Express server on port 3001)
npm run server:dev   # Backend with nodemon auto-restart
npm run preview      # Preview production build
```

## Project Structure

```
├── server/
│   └── index.mjs                 # Express server with AI endpoints
├── src/
│   ├── components/
│   │   ├── event/               # Event screen UI components
│   │   │   ├── ActionDeck.tsx   # Action card orchestrator (optimized, 242 lines)
│   │   │   ├── ActionDeckContent.tsx # Action deck UI rendering (extracted from ActionDeck)
│   │   │   ├── CoinFlightSystem.tsx # Coin animation effects and utilities
│   │   │   ├── DilemmaCard.tsx  # Main dilemma presentation
│   │   │   ├── ResourceBar.tsx  # Money/budget display
│   │   │   ├── SupportList.tsx  # Support level tracking
│   │   │   ├── NewsTicker.tsx   # Satirical news reactions
│   │   │   ├── EventContent.tsx # Main event UI rendering (extracted from EventScreen)
│   │   │   └── EventSupportManager.tsx # Support analysis logic
│   │   ├── PowerDistributionContent.tsx # Power distribution UI rendering (extracted from PowerDistributionScreen)
│   │   ├── PowerDistributionIcons.tsx   # Icon utilities for power holders
│   │   ├── InnerCompass.tsx     # Compass visualization core
│   │   ├── MiniCompass.tsx      # Compact compass display
│   │   ├── LoadingOverlay.tsx   # Loading states
│   │   └── MirrorBubble.tsx     # Mirror dialogue UI
│   ├── data/
│   │   ├── compass-data.ts      # 40-component political compass definitions
│   │   ├── mirror-quiz-pool.ts  # Questions for compass assessment
│   │   ├── politicalSystems.ts  # Canonical political system types
│   │   ├── predefinedCharacters.ts # Predefined character names/descriptions (eliminates AI calls)
│   │   └── predefinedPowerDistributions.ts # Predefined power distributions (eliminates AI calls)
│   ├── hooks/
│   │   ├── useNarrator.ts       # Text-to-speech integration
│   │   ├── useCompassFX.ts      # Compass animation effects
│   │   ├── useRotatingText.ts   # Loading text animations
│   │   ├── useEventState.ts     # LEGACY: EventScreen state management (support, budget, etc.)
│   │   ├── useEventEffects.ts   # LEGACY: EventScreen side effects (news, mirror, auto-loading)
│   │   ├── useEventNarration.ts # EventScreen3 TTS/narration logic
│   │   ├── useEventActions.ts   # EventScreen3 action handlers (confirm, suggest)
│   │   ├── useEventDataCollector.ts # EventScreen3 data collection (bundle + legacy modes)
│   │   ├── usePowerDistributionState.ts # PowerDistributionScreen state management
│   │   ├── usePowerDistributionAnalysis.ts # AI analysis and political system classification
│   │   ├── useActionDeckState.ts # ActionDeck state management and animations
│   │   └── useActionSuggestion.ts # Action suggestion validation logic
│   ├── lib/
│   │   ├── router.ts            # Hash-based routing system
│   │   ├── dilemma.ts           # Dilemma type definitions
│   │   ├── compassMapping.ts    # Text → compass value analysis
│   │   ├── supportAnalysis.ts   # LEGACY: Support change calculations
│   │   ├── eventConfirm.ts      # LEGACY: Action confirmation pipeline
│   │   ├── eventDataPresenter.ts # EventScreen3 progressive data revelation
│   │   ├── eventDataCleaner.ts  # EventScreen3 post-action cleanup
│   │   ├── mirrorDilemma.ts     # Mirror dialogue generation
│   │   └── narration.ts         # TTS text processing
│   ├── screens/
│   │   ├── EventScreen3.tsx     # Main gameplay screen (Collector → Presenter → Cleaner)
│   │   ├── RoleSelectionScreen.tsx
│   │   ├── CompassIntroStart.tsx
│   │   ├── MirrorDialogueScreen.tsx
│   │   ├── MirrorQuizScreen.tsx
│   │   ├── NameScreen.tsx       # Character creation
│   │   ├── PowerDistributionScreen.tsx # Power holder analysis and editing (optimized, 67 lines)
│   │   ├── DifficultyScreen.tsx # Difficulty level selection (conditional on enableModifiers)
│   │   ├── HighscoreScreen.tsx # Hall of Fame leaderboard
│   │   └── GameSummaryScreen.tsx # Post-game decision history summary
│   ├── store/
│   │   ├── roleStore.ts         # Role, analysis, character data
│   │   ├── compassStore.ts      # 4D political compass values
│   │   ├── dilemmaStore.ts      # Current game state
│   │   ├── settingsStore.ts     # User preferences
│   │   └── mirrorQuizStore.ts   # Compass assessment progress
│   ├── theme/
│   │   └── mirrorBubbleTheme.ts # Mirror dialogue styling
│   ├── App.tsx                  # Main router component
│   └── main.tsx                 # React app entry point
├── package.json                 # Scripts and dependencies
├── vite.config.ts              # Vite configuration with LAN access
├── tailwind.config.js          # Tailwind CSS configuration
└── tsconfig.*.json             # TypeScript configurations
```

## Architecture Overview

This is a political simulation game with AI-powered content generation, built as a React frontend with an Express backend.

### Frontend Architecture (React + TypeScript + Vite)

**Routing System**: Hash-based routing (`src/lib/router.ts`) with 10+ game screens:
- `/role` → Role selection and political system analysis
- `/compass-intro` → Political compass introduction
- `/compass-mirror` → Mirror dialogue for value assessment
- `/compass-quiz` → Compass questionnaire
- `/name` → Character creation with AI avatar generation
- `/event` → Daily dilemma gameplay screen
- `/highscores` → Hall of Fame leaderboard
- `/summary` → Post-game decision history (all 7 choices)

**State Management**: Zustand stores in `src/store/`:
- `roleStore` - Selected role, political analysis, character data
- `compassStore` - 4-dimensional political compass values (what/whence/how/whither)
- `dilemmaStore` - Current dilemma, choices, resources, support levels
- `settingsStore` - Game settings and preferences
- `mirrorQuizStore` - Compass assessment progress

**Key UI Components**:
- `src/screens/EventScreen3.tsx` - Main gameplay screen (Collector → Presenter → Cleaner architecture)
- `src/screens/PowerDistributionScreen.tsx` - Power holder analysis orchestrator (optimized, 67 lines)
- `src/components/event/EventContent.tsx` - Event UI rendering logic (extracted from EventScreen3)
- `src/components/PowerDistributionContent.tsx` - Power distribution UI rendering (extracted from PowerDistributionScreen)
- `src/components/event/` - Specialized event UI (ActionDeck, ResourceBar, SupportList, NewsTicker)
- `src/components/MiniCompass.tsx` - Political compass visualization
- Political compass system with 40 total components across 4 dimensions

**Custom Hooks for Complex Logic**:
- `useEventDataCollector` - EventScreen3 data collection (supports bundle + legacy API modes)
- `useEventNarration` - TTS preparation and playback logic
- `useEventActions` - Action confirmation pipeline and news updates
- `usePowerDistributionState` - Power distribution state management (holders, political system, UI state)
- `usePowerDistributionAnalysis` - AI role analysis, system classification, and data processing
- `useActionDeckState` - Action deck state management (selection, confirmation flow, animations)
- `useActionSuggestion` - Suggestion validation and AI processing logic
- ~~`useEventState`~~ (LEGACY) - Old state management pattern
- ~~`useEventEffects`~~ (LEGACY) - Old side effects pattern

### Backend Architecture (Express + OpenAI)

**AI-Powered Endpoints** (`server/index.mjs`):
- `/api/day-bundle` - **[NEW PRIMARY]** Unified endpoint returning:
  - **Days 1-7**: dilemma + news + mirror + support + dynamic + compass (1 call)
  - **Day 8** (post-game): reactionSummary + news + mirror + support + dynamic + compass (no dilemma)
- `/api/validate-role` - Validates user role input
- `/api/analyze-role` - Generates political system analysis
- `/api/generate-avatar` - Creates character avatars
- `/api/compass-analyze` - Maps text to political compass values (OPTIMIZED: 81% token reduction) - Integrated into bundle
- `/api/dilemma` - [LEGACY] Generates daily political dilemmas (enhanced with NewDilemmaLogic.md rules)
- `/api/support-analyze` - [LEGACY] Analyzes political support changes
- `/api/news-ticker` - [LEGACY] Generates satirical news reactions
- `/api/mirror-summary` - [LEGACY] Creates personality summaries
- `/api/dynamic-parameters` - [LEGACY] Generates player status parameters
- `/api/tts` - Text-to-speech generation

**AI Model Configuration**: Uses environment variables for different specialized models:
- `MODEL_VALIDATE` - Role validation
- `MODEL_ANALYZE` - Political analysis
- `MODEL_DILEMMA` - Dilemma generation
- `MODEL_MIRROR` - Mirror dialogue
- `IMAGE_MODEL` - Avatar generation
- `TTS_MODEL` - Text-to-speech

### Day Bundle API (Unified Endpoint)

**Overview**: The `/api/day-bundle` endpoint consolidates 5-6 separate API calls into a single unified request, improving performance and AI context quality.

**Default Mode**: Bundle API is **ON by default** (as of implementation). Legacy sequential mode available as fallback.

**What it Returns** (single JSON response):

**Days 1-7** (Normal gameplay):
```json
{
  "dilemma": { "title": "...", "description": "...", "actions": [...], "topic": "..." },
  "news": [ {"id": "...", "kind": "news|social", "tone": "up|down|neutral", "text": "..."} ],
  "mirror": { "summary": "..." },
  "supportEffects": [ {"id": "people|middle|mom", "delta": 0, "explain": "..."} ],  // Day 2+ only
  "dynamic": [ {"id": "...", "icon": "...", "text": "...", "tone": "..."} ],  // Day 2+ only, 1-5 params
  "compassPills": [ {"prop": "what|whence|how|whither", "idx": 0-9, "polarity": "positive|negative", "strength": "mild|strong"} ]  // Day 2+ only
}
```

**Day 8** (Post-game):
```json
{
  "type": "post-game",
  "reactionSummary": "2-3 sentences describing immediate consequences of final choice",
  "news": [ {"id": "...", "kind": "news|social", "tone": "up|down|neutral", "text": "..."} ],
  "mirror": { "summary": "Reflection on player's value consistency across all 7 days" },
  "supportEffects": [ {"id": "people|middle|mom", "delta": 0, "explain": "..."} ],
  "dynamic": [ {"id": "...", "icon": "...", "text": "...", "tone": "..."} ],
  "compassPills": [ {"prop": "...", "idx": 0-9, "polarity": "...", "strength": "..."} ]
}
```
Note: Day 8 has NO dilemma field - game is over, showing only reactions and summary button.

**Full Game History Context**: The bundle API receives complete game history from Day 1 to current day, including:
- All previous decisions (title, summary, cost)
- Support values after each choice
- Automatic governing pattern analysis (care, liberty, security themes)
- Support trends across entire game
- Topic diversity tracking

**Benefits**:
- **Performance**: ~60-70% faster (1 API call vs 5-6)
- **Better Coherence**: Dilemma, news, mirror, and support generated together with shared context
- **Token Efficiency**: ~50% reduction in total tokens per day
- **True Memory**: AI sees entire game narrative, not just last action
- **Narrative Quality**: Better continuity and callbacks to earlier decisions

**API Call Pattern**:
- **Bundle Mode (Default)**: 1 call per day → `/api/day-bundle` (includes compass analysis)
- **Legacy Mode**: 5-6 calls per day → `/api/dilemma`, `/api/news-ticker`, `/api/mirror-summary`, `/api/support-analyze`, `/api/dynamic-parameters`, `/api/compass-analyze`

**Toggling Modes** (in browser console):
```javascript
useBundleMode()   // ✅ Enable bundle API (default)
useLegacyMode()   // 🔧 Switch to legacy sequential calls
```

**Console Log Markers**:
- Bundle mode: `[Collector] 🎯 BUNDLE MODE ENABLED`
- Legacy mode: `[Collector] 🔧 LEGACY MODE`

### Game Flow Architecture

1. **Role Selection**: Player defines their political role and setting
   - **Predefined roles** (4 preset options): Use static data from `predefinedPowerDistributions.ts` - no AI call
   - **Custom roles**: Validated via `/api/validate-role`, then analyzed in next step
2. **Political Analysis**: Determines power distribution among holders (Executive, Legislature, etc.)
   - **Predefined roles**: Instantly load from static data - no AI call needed
   - **Custom roles**: AI analyzes via `/api/analyze-role`
3. **Character Creation**: Suggests names and generates avatar with background
   - **Predefined roles**: Use static data from `predefinedCharacters.ts` - no AI call for names
   - **Custom roles**: AI generates names via `/api/name-suggestions`
   - Avatar generation: AI call via `/api/generate-avatar` (both predefined and custom)
4. **Difficulty Selection** (optional, if enableModifiers setting is ON): Choose difficulty level that affects initial budget, support, and score
5. **Compass Assessment**: Mirror dialogue and quiz to map player values across 4 dimensions
6. **Daily Dilemmas** (Days 1-7): AI generates political situations with 3 action choices, affecting:
   - Resources (money/budget)
   - Support from three constituencies: "people" (public), "middle" (main power holder), "mom" (personal allies)
   - Political compass values
7. **Post-Game Reaction** (Day 8): After final choice on Day 7, shows:
   - Reaction summary describing immediate consequences of final choice
   - Final support changes and compass effects
   - News ticker with satirical reactions to the end of term
   - Mirror summary analyzing player's value consistency across all 7 days
   - "View Game Summary" button (no new dilemma)
8. **Game Summary Screen**: Lists all 7 choices made during the game:
   - Character info and final stats (budget, support levels)
   - Full decision history with dilemma context
   - Navigation to Hall of Fame or new game

**AI Call Optimization**: Predefined roles eliminate **2 AI calls** per playthrough (role analysis + name generation), providing instant loading and consistent experience.

### EventScreen3 Architecture: Collector → Presenter → Cleaner

EventScreen3 uses a clean three-phase architecture for gameplay flow:

#### Phase 1: COLLECTING (useEventDataCollector)
Gathers all data needed for a dilemma screen with loading overlay.

**Bundle Mode (Default)**:
1. Fetch `/api/day-bundle` → Returns dilemma + news + mirror + support + dynamic (1 call)
2. Fetch `/api/compass-analyze` separately → Compass pills (Day 2+ only)
3. Build `CollectedData` structure → Ready for presentation

**Legacy Mode** (if enabled via `useLegacyMode()`):
1. Phase 1 (Parallel): dilemma, news, compass, dynamic params
2. Phase 2 (Sequential): mirror dialogue (needs dilemma context)
3. Build `CollectedData` structure → Ready for presentation

#### Phase 2: PRESENTING (eventDataPresenter)
Sequentially reveals collected data with proper timing and animations.

**Presentation Steps**:
1. **Step 0**: ResourceBar appears (budget display)
2. **Step 1**: SupportList appears (initial values)
3. **Step 2**: Support changes animate (Day 2+ only) - deltas, trends, explanations
4. **Step 3**: NewsTicker appears with reactions
5. **Step 4**: PlayerStatusStrip appears (dynamic parameters)
6. **Step 5**: DilemmaCard appears + narration starts
7. **Step 5A**: Compass pills overlay (Day 2+ only)
8. **Step 6**: MirrorCard appears
9. **Step 7**: ActionDeck appears - player can now interact

#### Phase 3: INTERACTING
Player chooses an action or suggests custom action.

- **Card Animation**: Chosen card collapses, others fade out
- **Coin Flight**: Animated coins fly to/from budget counter
- **Budget Update**: Immediate synchronous update
- **History Entry**: Records decision in `dilemmaHistory` for next day's context

#### Phase 4: CLEANING (eventDataCleaner)
Post-action cleanup and day advancement.

1. Save player's choice to store
2. Update budget immediately
3. Wait for coin animation (1200ms)
4. Clear coin flights
5. Advance to next day → Returns to COLLECTING phase

**Key Benefits of This Architecture**:
- ✅ **Separation of Concerns**: Collecting, presenting, and cleaning are isolated
- ✅ **Progressive Revelation**: Data loads in background, reveals sequentially
- ✅ **Resilient**: Failed optional data doesn't block required data
- ✅ **Bundle-Ready**: Designed to work with both unified and sequential APIs
- ✅ **Maintainable**: Each phase is a focused, testable module

### Political Compass System

Four-dimensional system defined in `src/data/compass-data.ts`:
- **What** (Ultimate goals): Truth, Liberty, Equality, Care, etc. (10 components)
- **Whence** (Goal justification): Evidence, Tradition, Personal intuition, etc. (10 components)
- **How** (Means): Law, Markets, Mobilization, Mutual Aid, etc. (10 components)
- **Whither** (Recipients): Individual, Community, Nation, Global, etc. (10 components)

### Development Setup Notes

**Concurrent Development**: The `npm run dev` command runs both frontend and backend simultaneously using `concurrently`. Frontend proxies `/api` requests to backend.

**Environment Configuration**: Backend requires `OPENAI_API_KEY`. Optional model overrides available via environment variables.

**TypeScript Configuration**: Strict typing with separate configs for app (`tsconfig.app.json`) and node (`tsconfig.node.json`).

**Network Access**: Vite configured to expose dev server on LAN for mobile testing.

### Key Libraries & Patterns

- **Zustand**: Preferred over Redux for state management
- **Framer Motion**: Used for animations and transitions
- **Lucide React**: Icon system
- **Tailwind CSS**: Styling framework
- **Hash Routing**: Custom router implementation, not React Router
- **AI Integration**: Direct OpenAI API calls, not abstracted libraries
- **Custom Hooks**: Extract complex logic from components for better organization and reusability
- **Component Separation**: Split large components by concern (UI rendering vs. business logic)

### Performance Optimization Patterns

Both EventScreen and PowerDistributionScreen have been optimized using these patterns:

**EventScreen Optimization (512 → 107 lines)**:
- **Hook Extraction**: Complex logic separated into focused custom hooks
- **Component Splitting**: UI rendering separated from business logic
- **State Management**: Related state grouped together in dedicated hooks
- **Effect Isolation**: Side effects organized by purpose (networking, audio, etc.)

**PowerDistributionScreen Optimization (597 → 67 lines)**:
- **State Hook**: `usePowerDistributionState` manages holders, political system, and UI state
- **Analysis Hook**: `usePowerDistributionAnalysis` handles AI role analysis and system classification
- **Icon Component**: `PowerDistributionIcons` provides reusable icon mapping utilities
- **Content Component**: `PowerDistributionContent` handles all UI rendering and interactions

**ActionDeck Optimization (673 → 242 lines)**:
- **State Hook**: `useActionDeckState` manages card selection, confirmation flow, and animation controls
- **Suggestion Hook**: `useActionSuggestion` handles AI validation and suggestion processing
- **Animation System**: `CoinFlightSystem` provides coin flight effects with portal-based overlays
- **Content Component**: `ActionDeckContent` handles all UI rendering, modals, and card interactions

This architecture enables better React performance optimizations (memoization, selective re-renders) and improved maintainability.

### Optimization Roadmap

**Component Optimization (Large Components)**:
- ~~EventScreen.tsx (512 lines)~~ ✅ **COMPLETED** - Reduced to 107 lines
- ~~PowerDistributionScreen.tsx (597 lines)~~ ✅ **COMPLETED** - Reduced to 67 lines
- ~~ActionDeck.tsx (673 lines)~~ ✅ **COMPLETED** - Reduced to 242 lines
- RoleSelectionScreen.tsx - Extract role validation and selection logic
- MirrorDialogueScreen.tsx - Extract mirror conversation handling

**AI Token Optimization**:
- ~~Compass Analysis API~~ ✅ **COMPLETED** - 81% token reduction (682 → 133 tokens per request)
  - Moved component definitions to system prompt (compact format)
  - Removed 2,725-char cues string from every request
  - Saves ~549 tokens per compass analysis
  - Tested: ~90% accuracy maintained across diverse action types
  - Impact: ~11,500 tokens saved per 7-day game

**React Performance Optimizations**:
- Add `React.memo()` to frequently re-rendering components
- Implement `useMemo()` for expensive calculations (compass calculations, support analysis)
- Add `useCallback()` for event handlers passed to child components
- Optimize re-renders in compass and support tracking components

**Code Organization**:
- Create barrel exports (`index.ts` files) for cleaner imports
- Move components into logical sub-folders (compass/, mirror/, etc.)
- Extract shared utilities into dedicated modules

**Memory Leak Fixes**:
- Fix timer cleanup issues in LoadingOverlay
- Ensure proper cleanup in TTS/audio components
- Review useEffect dependencies and cleanup functions

**Bundle Optimization**:
- Implement code splitting for different game screens
- Lazy load heavy components
- Optimize import statements

### Development Notes

- Preserve existing design and functionality when making changes
- If additional changes are recommended, ask for confirmation first
- The EventScreen3, PowerDistributionScreen, and ActionDeck optimizations serve as models for refactoring other large components
- Use the extracted hook patterns for similar complex components (RoleSelectionScreen, etc.)
- When you write new code, make sure to make it well annotated. Each file should also start with a short description of what it does and how it connects to other files in the project
- Whenever you change things, go over the claude.md file and check if it needs to be updated. If so, update it

### Day Bundle API - Developer Reference

**Current Status**: ✅ **LIVE and DEFAULT** (as of implementation)

**Quick Toggle Commands** (browser console):
```javascript
useBundleMode()   // ✅ Default - unified API
useLegacyMode()   // 🔧 Fallback - sequential calls
```

**Implementation Files**:
- Server: `/server/index.mjs` - Line ~1857 (`/api/day-bundle` endpoint)
- Client: `/src/hooks/useEventDataCollector.ts` - Lines 80-194 (`fetchDayBundle()` function)
- Settings: `/src/store/settingsStore.ts` - `useDayBundleAPI` flag (default: `true`)
- Debug: `/src/dev/storesDebug.ts` - `useBundleMode()` and `useLegacyMode()` helpers

**Testing**:
- Test files available: `test-day-bundle-day1.json` and `test-day-bundle-day2.json` (root directory)
- Test command: `curl -X POST http://localhost:8787/api/day-bundle -H "Content-Type: application/json" -d @test-day-bundle-day1.json`

**Documentation**:
- Full implementation plan: `.claude/singledayapibundle.md`
- All features tested and validated ✅

**Legacy Components** (kept for reference, not actively used):
- `useEventState.ts`, `useEventEffects.ts` - Old state management
- `eventConfirm.ts` - Old confirmation pipeline
- `/api/dilemma`, `/api/support-analyze`, `/api/news-ticker`, `/api/mirror-summary`, `/api/dynamic-parameters` - Separate endpoints