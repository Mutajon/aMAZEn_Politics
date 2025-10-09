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
│   │   │   ├── NewsTicker.tsx   # Satirical news reactions (DISABLED - code kept for future)
│   │   │   ├── EventContent.tsx # Main event UI rendering (extracted from EventScreen)
│   │   │   ├── EventSupportManager.tsx # Support analysis logic
│   │   │   ├── CompassPillsOverlay.tsx # Compass pills display with expand/collapse
│   │   │   ├── CollectorLoadingOverlay.tsx # Progressive loading overlay with real-time progress
│   │   │   └── DilemmaLoadError.tsx # Error screen for failed data collection
│   │   ├── PowerDistributionContent.tsx # Power distribution UI rendering (extracted from PowerDistributionScreen)
│   │   ├── PowerDistributionIcons.tsx   # Icon utilities for power holders
│   │   ├── InnerCompass.tsx     # Compass visualization core
│   │   ├── MiniCompass.tsx      # Compact compass display
│   │   ├── LoadingOverlay.tsx   # Legacy loading overlay (not used in EventScreen3)
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
│   │   ├── useEventState.ts     # EventScreen state management (support, budget, etc.)
│   │   ├── useEventEffects.ts   # EventScreen side effects (news, mirror, auto-loading)
│   │   ├── useEventNarration.ts # EventScreen TTS/narration logic
│   │   ├── useEventActions.ts   # EventScreen action handlers (confirm, suggest)
│   │   ├── useEventDataCollector.ts # Data collection with 3-phase progressive loading
│   │   ├── useLoadingProgress.ts # Progressive loading progress (auto-increment, catchup animation)
│   │   ├── usePowerDistributionState.ts # PowerDistributionScreen state management
│   │   ├── usePowerDistributionAnalysis.ts # AI analysis and political system classification
│   │   ├── useActionDeckState.ts # ActionDeck state management and animations
│   │   └── useActionSuggestion.ts # Action suggestion validation logic
│   ├── lib/
│   │   ├── router.ts            # Hash-based routing system
│   │   ├── dilemma.ts           # Dilemma type definitions
│   │   ├── compassMapping.ts    # Text → compass value analysis
│   │   ├── supportAnalysis.ts   # Support change calculations
│   │   ├── eventConfirm.ts      # Action confirmation pipeline
│   │   ├── mirrorDilemma.ts     # Mirror dialogue generation
│   │   └── narration.ts         # TTS text processing
│   ├── screens/
│   │   ├── EventScreen3.tsx     # Main gameplay screen
│   │   ├── RoleSelectionScreen.tsx
│   │   ├── CompassIntroStart.tsx
│   │   ├── MirrorDialogueScreen.tsx
│   │   ├── MirrorQuizScreen.tsx
│   │   ├── NameScreen.tsx       # Character creation
│   │   ├── PowerDistributionScreen.tsx # Power holder analysis and editing (optimized, 67 lines)
│   │   ├── DifficultyScreen.tsx # Difficulty level selection (conditional on enableModifiers)
│   │   └── HighscoreScreen.tsx
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
- `/highscores` → Game results

**State Management**: Zustand stores in `src/store/`:
- `roleStore` - Selected role, political analysis, character data
- `compassStore` - 4-dimensional political compass values (what/whence/how/whither)
- `dilemmaStore` - Current dilemma, choices, resources, support levels, subject streak tracking
- `settingsStore` - Game settings (narration, budget visibility, debug mode, `useLightDilemma` toggle, etc.)
- `mirrorQuizStore` - Compass assessment progress

**Key UI Components**:
- `src/screens/EventScreen3.tsx` - Main gameplay screen with sequential presentation architecture
- `src/screens/PowerDistributionScreen.tsx` - Power holder analysis orchestrator (optimized, 67 lines)
- `src/components/event/EventContent.tsx` - Event UI rendering logic
- `src/components/PowerDistributionContent.tsx` - Power distribution UI rendering (extracted from PowerDistributionScreen)
- `src/components/event/` - Specialized event UI (ActionDeck, ResourceBar, SupportList, NewsTicker)
- `src/components/MiniCompass.tsx` - Political compass visualization
- Political compass system with 40 total components across 4 dimensions

**Custom Hooks for Complex Logic**:
- `useEventState` - Event screen state management (support values, budget, middle entity)
- `useEventEffects` - Side effects (news fetching, mirror dialogue, auto-loading)
- `useEventNarration` - TTS preparation and playback logic
- `useEventActions` - Action confirmation pipeline and news updates
- `useLoadingProgress` - Progressive loading progress (auto-increment, smooth catchup animation)
- `usePowerDistributionState` - Power distribution state management (holders, political system, UI state)
- `usePowerDistributionAnalysis` - AI role analysis, system classification, and data processing
- `useActionDeckState` - Action deck state management (selection, confirmation flow, animations)
- `useActionSuggestion` - Suggestion validation and AI processing logic

### Backend Architecture (Express + OpenAI)

**AI-Powered Endpoints** (`server/index.mjs`):
- `/api/validate-role` - Validates user role input
- `/api/analyze-role` - Generates political system analysis
- `/api/generate-avatar` - Creates character avatars
- `/api/dilemma` - Generates daily political dilemmas (enhanced with NewDilemmaLogic.md rules) - HEAVY VERSION
- `/api/dilemma-light` - Generates dilemmas with integrated support analysis (fast, minimal payload) - **DEFAULT**
- `/api/support-analyze` - Analyzes political support changes (used by heavy API only)
- `/api/compass-analyze` - Maps text to political compass values (OPTIMIZED: 81% token reduction)
- `/api/news-ticker` - Generates satirical news reactions (DISABLED by default)
- `/api/mirror-summary` - Creates personality summaries
- `/api/tts` - Text-to-speech generation

**AI Model Configuration**: Uses environment variables for different specialized models:
- `MODEL_VALIDATE` - Role validation
- `MODEL_ANALYZE` - Political analysis
- `MODEL_DILEMMA` - Dilemma generation (OpenAI)
- `MODEL_DILEMMA_ANTHROPIC` - Dilemma generation (Anthropic Claude)
- `MODEL_MIRROR` - Mirror dialogue (OpenAI)
- `MODEL_MIRROR_ANTHROPIC` - Mirror dialogue (Anthropic Claude)
- `IMAGE_MODEL` - Avatar generation
- `TTS_MODEL` - Text-to-speech

**Multi-Provider Support**: Both dilemma-light and mirror-summary APIs support OpenAI and Anthropic:
- Toggle via `useLightDilemmaAnthropic` setting in `settingsStore`
- Default: OpenAI (GPT-5 for both dilemmas and mirror dialogue)
- Switch models using browser console commands:
  - `switchToClaude()` - Use Anthropic Claude (model from `.env`) for **both** dilemmas and mirror dialogue
  - `switchToGPT()` - Use OpenAI GPT (model from `.env`) for **both** dilemmas and mirror dialogue
- Server routes to correct API based on `useAnthropic` flag in request
- Affected endpoints: `/api/dilemma-light`, `/api/mirror-summary`
- **Model Configuration**: Models are read from `.env` at server startup
  - Change `.env` values and restart server (`npm run dev`) to use different models
  - Example: Change `MODEL_DILEMMA_ANTHROPIC=claude-3-5-sonnet-20241022` for a different Claude model

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
6. **Daily Dilemmas**: AI generates political situations with 3 action choices, affecting:
   - Resources (money/budget)
   - Support from three constituencies: "people" (public), "middle" (main power holder), "mom" (personal allies)
   - Political compass values

**AI Call Optimization**: Predefined roles eliminate **2 AI calls** per playthrough (role analysis + name generation), providing instant loading and consistent experience.

### Action Confirmation Pipeline

When a player confirms a choice in the EventScreen, the following sequence occurs:

#### 1. Immediate UI Changes
- **Card Animation**: Chosen card collapses while others animate downward and fade out
- **Coin Flight**: Animated coins fly between action card and budget counter based on cost direction
- **Budget Update**: Budget counter updates immediately and synchronously via `setBudget()`

#### 2. Parallel AI Analysis (via `runConfirmPipeline`)
The system runs two AI analyses simultaneously using `Promise.allSettled()`:

**A. Compass Analysis** (`/api/compass-analyze`):
- Combines action text: `"${title}. ${summary}"`
- AI analyzes against 40 compass components across 4 dimensions:
  - **What** (goals): Truth, Liberty, Equality, Care, etc. (10 components)
  - **Whence** (justification): Evidence, Tradition, Personal intuition, etc. (10 components)
  - **How** (means): Law, Markets, Mobilization, Mutual Aid, etc. (10 components)
  - **Whither** (recipients): Individual, Community, Nation, Global, etc. (10 components)
- Results appear as animated "compass pills" showing political value shifts
- Updates player's position in `compassStore`

**B. Support Analysis** (`/api/support-analyze`):
- Analyzes impact on three constituencies using political context:
  - **"people"** - General public support
  - **"middle"** - Main power holder (from power distribution analysis)
  - **"mom"** - Personal allies/inner circle
- Uses context: political system, power holders, current game day
- Returns support deltas with explanations
- Updates support tracking with animated changes

#### 3. State Management
- **Immediate**: Budget updates synchronously for responsive UI
- **Parallel**: Compass and support analyses run independently
- **Resilient**: Failed analyses don't block successful ones
- **Responsive**: UI remains interactive during background processing

#### 4. Visual Feedback System
- Compass pills animate in showing political shifts
- Support bars animate to new levels with delta indicators
- Coin flight effects provide immediate cost feedback
- Loading states show analysis progress independently
- News ticker updates with satirical reactions

This architecture ensures **immediate visual feedback** while **rich AI analysis happens in the background**, maintaining game responsiveness while providing deep political simulation.

### Progressive Loading System

The EventScreen uses a **unified progressive loading overlay** that provides real-time feedback during data collection:

**Architecture:**
- **useLoadingProgress hook** - Auto-increments progress from 0→100% at 1%/second
- **CollectorLoadingOverlay component** - Displays real-time progress with smooth animations
- **useEventDataCollector hook** - Emits ready notification when dilemma data arrives
- **EventScreen3** - Wires everything together for seamless UX

**Loading Flow:**

1. **Day 1 Initial Load:**
   ```
   EventScreen mounts → Phase='collecting' → startProgress() →
   Progress auto-increments (1%, 2%, 3%...) →
   Server responds (~15-20s) → notifyReady() →
   Progress animates current% → 100% over 1 second →
   Overlay fades → Dilemma presents sequentially
   ```

2. **After Action Confirmation:**
   ```
   Player confirms action → Coin animation → Phase='cleaning' →
   cleanAndAdvanceDay() → Phase='collecting' → resetProgress() →
   startProgress() → Auto-increment starts →
   Server responds → notifyReady() → Smooth catchup → Overlay fades
   ```

**Key Features:**
- ✅ **Single unified overlay** - Same component reused across all loading cycles
- ✅ **Real-time progress** - Visible feedback every second
- ✅ **Smooth catchup animation** - When server responds, animates remaining distance over 1 second using ease-out cubic
- ✅ **Server-aware** - Waits for actual API response, not just time estimate
- ✅ **Reset-friendly** - Cleanly resets for Day 1, Day 2, Day 3, etc.

**Technical Details:**
- Progress never reaches 100% via auto-increment (caps at 99%)
- Only reaches 100% when `notifyReady()` triggers catchup animation
- Uses `requestAnimationFrame` for smooth 60fps animations
- Cleanup on unmount prevents memory leaks

### Compass Pills Visual Feedback System

EventScreen3 displays **compass pills** to show how player actions affect their political values:

**Architecture:**
- **Data Collection** - `useEventDataCollector` fetches compass analysis via `/api/compass-analyze` in Phase 2 (Day 2+ only)
- **Visual Component** - `CompassPillsOverlay` displays animated pills with expand/collapse functionality
- **Presentation Timing** - Pills appear at Step 4A (after dilemma shown, during mirror reveal)

**Display Flow (Day 2+):**
```
Player confirms action (Day 1) → cleanAndAdvanceDay() →
Phase 2: fetchCompassPills(lastChoice) → compassPills collected →
Step 4: DilemmaCard shown →
Step 4A: Compass deltas applied to store + Pills appear (2.5s) →
Step 5: MirrorCard revealed (pills still visible) →
Pills auto-collapse to "+" button after 2s →
User can click "+" to re-expand pills
```

**Key Features:**
- ✅ **Day-aware** - Only shows on Day 2+ (no previous action on Day 1)
- ✅ **Positioned above MirrorCard** - Overlays with absolute positioning
- ✅ **Auto-collapse** - Pills show for 2s, then collapse to small "+" button
- ✅ **User-expandable** - Clicking "+" re-expands, clicking pill collapses
- ✅ **Color-coded** - Each dimension (what/whence/how/whither) has unique color
- ✅ **Delta display** - Shows "+2 Liberty", "-1 Evidence", etc.

**Technical Details:**
- Pills converted from `CompassPill[]` to `CompassEffectPing[]` format with unique IDs
- Visibility controlled by: `presentationStep >= 4 && presentationStep < 6 && day > 1`
- Store updates happen before visual display (via `eventDataPresenter.applyCompassDeltas`)
- Component shared with MiniCompass (same visual language across app)

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

- ~~API Payload Optimization~~ ✅ **COMPLETED** - 43.5% token reduction (5,400 → 3,050 tokens per day)
  - **Compass values**: Top 3 per dimension only (40 values → 12 values) = ~300 tokens saved
  - **Dilemma history**: Last 2 days only (not full 7 days) = ~400 tokens saved
  - **lastChoice trimmed**: Only title + summary (no cost/iconHint) = ~50 tokens saved
  - **Mirror payload optimized**: Top 3 compass values, last 2 days history, no action costs = ~550 tokens saved
  - **NewsTicker disabled**: Code kept for future, removed from network = ~800 tokens saved
  - Total savings: **~2,350 tokens per day (43.5% reduction)**

- ~~Dynamic Parameters Validation~~ ✅ **COMPLETED** - Enhanced restrictions to avoid redundancy
  - NEVER mention support levels (shown in SupportList)
  - NEVER mention budget changes (shown in ResourceBar)
  - NEVER mention trivial events ("3 coalition MPs appeased", "1 judicial review filed")

- ~~Dilemma Generation API~~ ✅ **COMPLETED** - 40-50% token reduction + quality improvements
  - **Token optimization**: Reduced from ~2000-2500 tokens to ~1000-1200 tokens per request
  - **SPECIFICITY ENFORCER**: Forces concrete details (numbers, names, levers) instead of vague placeholders
  - **Modular prompt architecture**: 6 helper functions in `server/index.mjs`:
    - `buildCoreStylePrompt()` - Static writing rules (cached, ~250 tokens)
    - `buildDynamicContextPrompt()` - Compact context builder (only last 2 history, top 3 topics, top 5 compass)
    - `buildOutputSchemaPrompt()` - Minimal JSON schema (~100 tokens)
    - `validateDilemmaResponse()` - Quality validation (structure, lengths, sentence counts)
    - `hasGenericPhrasing()` - Detects vague terms like "controversial bill", "major reform"
    - `safeParseJSON()` - Safe JSON parsing with fallback
  - **Quality validation**: Two-pass system with focused repair instructions
  - **Premium model**: Uses temperature 0.7 (balanced creativity) instead of 0.9
  - **Result**: Better specificity, fewer generic outputs, lower costs
  - Focus on engaging, game-changing consequences only (casualties, international reactions, resignations, protests)

- ~~Light Dilemma API~~ ✅ **COMPLETED** - 85%+ token reduction + faster response times
  - **New `/api/dilemma-light` endpoint**: Ultra-minimal payload (~200 tokens vs ~3000+ tokens)
  - **Single-call architecture**: Dilemma + support analysis in ONE API call (not 2+)
  - **Integrated support shifts**: AI returns support deltas with explanations directly
  - **Subject streak tracking**: Automatically varies topics after 3+ consecutive same-subject dilemmas
  - **Minimal context**: Only sends role, system, subject streak, and previous choice
  - **"Holders → Middle" mapping**: Server uses generic "holders" term, client maps to "middle" entity
  - **Default mode**: Light API is now default (toggle via `useLightDilemma` setting)
  - **Backwards compatible**: Heavy API (`/api/dilemma`) remains available for comparison
  - **Types**: New `LightDilemmaRequest`, `LightDilemmaResponse`, `SubjectStreak` types in `dilemma.ts`
  - **Store changes**: Added subject streak tracking and `loadNextLight()` in `dilemmaStore.ts`
  - **Result**: ~60 seconds → ~15-20 seconds per dilemma load (3-4x faster)

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
- The EventScreen, PowerDistributionScreen, and ActionDeck optimizations serve as models for refactoring other large components
- Use the extracted hook patterns for similar complex components (RoleSelectionScreen, etc.)
- when you write new code, make sure to make it well annotated. each file should also start with a short description of what it does and how does it connect to other files in the project (which other files use it and how)
- whenever you change things, go over the claude.md file and check if it needs to be updated. if so, update it