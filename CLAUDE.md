# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Terminal Commands (npm scripts)

#### Primary Development
```bash
npm run dev          # Start concurrent frontend (Vite) + backend (Express) development
npm run build        # Build production frontend
npm run typecheck    # Run TypeScript type checking
npm run lint         # Run ESLint on TypeScript files
npm run format       # Format code with Prettier
```

#### Individual Services
```bash
npm run vite         # Frontend only (Vite dev server on port 5173)
npm run server       # Backend only (Express server on port 3001)
npm run server:dev   # Backend with nodemon auto-restart
npm run preview      # Preview production build
```

### Browser Console Commands (Debug & Testing)

#### AI Provider Switching
```javascript
switchToClaude()     # Switch to Anthropic Claude for dilemmas + mirror dialogue
switchToGPT()        # Switch to OpenAI GPT for dilemmas + mirror dialogue (DEFAULT)
```

**Usage:**
1. Open browser console (F12)
2. Run command: `switchToClaude()` or `switchToGPT()`
3. Setting persists across sessions
4. Next dilemma/mirror will use selected provider

**Note:** Models are configured in `.env` - restart server after changing model versions.

#### Debug Mode Controls
```javascript
enableDebug()        # Enable debug mode (shows "Jump to Final Day" button)
disableDebug()       # Disable debug mode
toggleDebug()        # Toggle debug mode on/off
```

**Usage:**
1. Open browser console (F12)
2. Run command: `enableDebug()`
3. Debug features appear immediately (no refresh needed)
4. Look for "🚀 Jump to Final Day" button in top-right of EventScreen

**Debug Features:**
- **Jump to Final Day Button**: Appears in top-right of EventScreen on days 1-6 (when interacting phase is active)
  - Randomly picks one of the current 3 actions
  - Sets it as the previous choice
  - Jumps directly to day 7 (daysLeft=1, final dilemma with epic mode)
  - Useful for testing epic finale and game conclusion
  - After confirming day 7 choice, advances to day 8 (daysLeft=0, conclusion screen)
- **Extra Console Logs**: Additional logging from various systems

**Note:** Debug mode state persists in Zustand store (persisted to localStorage).

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
│   │   │   ├── EventContent.tsx # LEGACY/UNUSED - Old event UI rendering (candidate for deletion)
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
│   │   ├── useEventEffects.ts   # LEGACY/UNUSED - EventScreen side effects (candidate for deletion)
│   │   ├── useEventNarration.ts # EventScreen TTS/narration logic
│   │   ├── useEventActions.ts   # EventScreen action handlers (confirm, suggest)
│   │   ├── useEventDataCollector.ts # Data collection with 3-phase progressive loading
│   │   ├── useLoadingProgress.ts # Progressive loading progress (auto-increment, catchup animation)
│   │   ├── usePowerDistributionState.ts # PowerDistributionScreen state management
│   │   ├── usePowerDistributionAnalysis.ts # AI analysis and political system classification
│   │   ├── useActionDeckState.ts # ActionDeck state management and animations
│   │   ├── useActionSuggestion.ts # Action suggestion validation logic
│   │   └── useMirrorTop3.ts     # Extract top 3 compass components per dimension
│   ├── lib/
│   │   ├── router.ts            # Hash-based routing system
│   │   ├── dilemma.ts           # Dilemma type definitions
│   │   ├── compassMapping.ts    # Text → compass value analysis
│   │   ├── supportAnalysis.ts   # Support change calculations
│   │   ├── eventConfirm.ts      # Action confirmation pipeline
│   │   ├── mirrorSummary.ts     # Mirror dialogue generation (quiz screen)
│   │   ├── narration.ts         # TTS text processing
│   │   └── eventScreenSnapshot.ts # EventScreen state preservation for navigation
│   ├── screens/
│   │   ├── EventScreen3.tsx     # Main gameplay screen
│   │   ├── RoleSelectionScreen.tsx
│   │   ├── CompassIntroStart.tsx
│   │   ├── MirrorDialogueScreen.tsx
│   │   ├── MirrorQuizScreen.tsx
│   │   ├── NameScreen.tsx       # Character creation
│   │   ├── PowerDistributionScreen.tsx # Power holder analysis and editing (optimized, 67 lines)
│   │   ├── DifficultyScreen.tsx # Difficulty level selection (conditional on enableModifiers)
│   │   ├── MirrorScreen.tsx     # Top 3 compass values per dimension display
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
- `/mirror` → Mirror screen showing top 3 compass values per dimension
- `/compass-vis` → Full compass visualization (interactive)
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
- `/api/mirror-summary` - Creates cynical personality summaries (DEPRECATED - no longer used)
- `/api/mirror-quiz-light` - Creates personality summary (quiz screen, Mushu/Genie personality, 1 sentence) - **NEW**
- `/api/mirror-light` - Creates dramatic sidekick advice (event screen, Mushu/Genie personality, 1 sentence) - **NEW**
- `/api/tts` - Text-to-speech generation

**AI Model Configuration**: Uses environment variables for different specialized models:

**OpenAI Models (DEFAULT):**
- `MODEL_VALIDATE` - Role validation
- `MODEL_ANALYZE` - Political analysis
- `MODEL_DILEMMA` - Dilemma generation (default: `gpt-5`)
- `MODEL_MIRROR` - Mirror dialogue (default: `gpt-5`)
- `IMAGE_MODEL` - Avatar generation
- `TTS_MODEL` - Text-to-speech

**Anthropic Models (OPTIONAL):**
- `MODEL_DILEMMA_ANTHROPIC` - Dilemma generation (Claude, no default - must set in `.env`)
- `MODEL_MIRROR_ANTHROPIC` - Mirror dialogue (Claude, no default - must set in `.env`)

### Multi-Provider AI Support

The `/api/dilemma-light`, `/api/mirror-quiz-light`, and `/api/mirror-light` endpoints support **dual providers**:

**Default Provider: OpenAI GPT** ✅
- Used automatically on first launch
- No additional configuration needed (beyond `OPENAI_API_KEY`)
- Models: `MODEL_DILEMMA` and `MODEL_MIRROR` from `.env`

**Alternative Provider: Anthropic Claude** (opt-in)
- Requires setup in `.env`:
  ```bash
  MODEL_DILEMMA_ANTHROPIC=claude-3-5-haiku-latest
  MODEL_MIRROR_ANTHROPIC=claude-3-5-haiku-latest
  ```
- Switch via browser console: `switchToClaude()`
- Available Claude models:
  - `claude-3-5-haiku-latest` - Fast, cost-effective
  - `claude-3-5-sonnet-20241022` - Balanced quality/speed
  - `claude-3-opus-20240229` - Most capable, expensive

**Switching Between Providers:**

Open browser console (F12) and run:
```javascript
switchToClaude()  // Switch to Anthropic Claude
switchToGPT()     // Switch back to OpenAI GPT (default)
```

- Setting persists across browser sessions
- Affects **both** dilemma generation and mirror dialogue
- Next dilemma/mirror will use selected provider
- No page reload needed

**Configuration Details:**
- Models read from `.env` at server startup (no hardcoded fallbacks)
- Restart server (`npm run dev`) after changing `.env` model values
- See `.env.example` for complete configuration template
- Server logs show which provider is being used per request

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

### EventScreen ↔ MirrorScreen Navigation

The game supports seamless navigation between EventScreen and MirrorScreen with state preservation.

**Intended User Flow:**
1. Player is on EventScreen viewing a dilemma
2. Clicks "?" button on MirrorCard → navigates to MirrorScreen
3. Explores compass values (top 3 per dimension)
4. Clicks "Back to Event" → returns to exact same EventScreen state

**Current Status: TEMPORARILY DISABLED (Known Issues)**

⚠️ **"?" Button Removed (2025-10-10):**
- Question mark button on MirrorCard has been **temporarily removed** from EventScreen
- Players cannot currently navigate EventScreen → MirrorScreen via in-game button
- Removal prevents players from getting stuck due to navigation bugs
- Button will be restored after issues 1-4 below are resolved
- **MirrorQuizScreen → MirrorScreen navigation still works correctly**

⚠️ **Issues Remaining (as of 2025-10-10):**
1. "Unknown phase: interacting" error still appears briefly when returning from MirrorScreen
2. Narration re-triggers and plays dilemma again on restoration
3. Mirror text appears to reload (possible duplicate API request)
4. User reports the screen shows error, plays narration in background, then eventually shows content

**Technical Implementation (Snapshot System):**
- **Core Concept**: Use single boolean flag (`restoredFromSnapshot`) to gate all effects and prevent re-execution
- **Snapshot System** (`src/lib/eventScreenSnapshot.ts`): Saves EventScreen state to sessionStorage
- **State Preserved**: phase, presentationStep, collectedData (dilemma, mirror text, support effects, etc.)
- **Restoration Logic**: EventScreen restores from snapshot on mount (Effect 0A)
- **Boolean Gates Implemented**:
  - ✅ Collection effect (Effect 1) checks `restoredFromSnapshot`
  - ✅ Presentation effect (Effect 3) checks `restoredFromSnapshot`
  - ✅ Loading overlay checks `!restoredFromSnapshot`
  - ✅ Fallback render checks `!restoredFromSnapshot`
  - ✅ Button conditional: `phase === 'interacting' && presentationStep >= 5 && day > 1`

**Problem Analysis:**
- Restoration flag is set correctly
- Snapshot saves and loads correctly
- BUT: Something in the effect dependency chain or render cycle is still triggering re-execution
- Hypothesis: Timing issue where effects run before `restoredFromSnapshot` flag takes effect
- Alternative hypothesis: Missing check in another effect or the narration hook itself

**Next Steps to Fix:**
1. Add more granular logging to trace exact execution order
2. Consider moving restoration EARLIER in component lifecycle (before other effects register)
3. Investigate useEventNarration hook - might need its own restoration check
4. Consider adding restoration flag to narration effect dependencies
5. Review if presentEventData() is being called somehow despite guards
6. Check if phase transitions are triggering unwanted side effects

**Key Files:**
- `src/lib/eventScreenSnapshot.ts` - Snapshot save/load/clear utilities
- `src/screens/EventScreen3.tsx` - Save on navigate, restore on mount, boolean gates
- `src/components/event/MirrorCard.tsx` - "?" explore button (conditional on phase/step/day)
- `src/screens/MirrorScreen.tsx` - Smart back button ("Back to Event" vs "Back")
- `src/hooks/useEventDataCollector.ts` - `restoreCollectedData()` method
- `src/hooks/useEventNarration.ts` - TTS preparation (possible trigger source)

### Action Confirmation Pipeline

When a player confirms a choice in the EventScreen, the following sequence occurs:

#### 1. Immediate UI Changes
- **Card Animation**: Chosen card collapses while others animate downward and fade out
- **Coin Flight**: Animated coins fly between action card and budget counter based on cost direction
- **Budget Update**: Budget counter updates immediately and synchronously via `setBudget()`

#### 2. Support Analysis (via `runConfirmPipeline`)
**Support Analysis** (`/api/support-analyze`):
- Analyzes impact on three constituencies using political context:
  - **"people"** - General public support
  - **"middle"** - Main power holder (from power distribution analysis)
  - **"mom"** - Personal allies/inner circle
- Uses context: political system, power holders, current game day
- Returns support deltas with explanations
- Updates support tracking with animated changes

**Compass Analysis** (DEFERRED to Phase 2):
- **NO LONGER happens during action confirmation** (optimization: eliminates duplicate API calls)
- Compass analysis now happens ONLY in Phase 2 data collection (next day load)
- Results appear as animated "compass pills" on the NEXT day
- Updates player's position in `compassStore` when pills are displayed
- This eliminates the double-application bug (values were being changed twice for the same action)

#### 3. State Management
- **Immediate**: Budget updates synchronously for responsive UI
- **Background**: Support analysis runs independently
- **Deferred**: Compass analysis happens on next day load (Phase 2)
- **Resilient**: Failed analyses don't block UI progression
- **Responsive**: Action confirmation is 2-5 seconds faster (no compass analysis blocking)

#### 4. Visual Feedback System
- Support bars animate to new levels with delta indicators (immediate)
- Coin flight effects provide immediate cost feedback
- Compass pills appear on NEXT day showing "what your last choice did" (contextual timing)
- Loading states show analysis progress independently
- News ticker updates with satirical reactions

This architecture ensures **immediate visual feedback** and **faster action confirmation** while maintaining deep political simulation. Compass analysis is deferred to the next day load, providing better UX timing and eliminating duplicate API calls.

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

### Code Cleanup Candidates

The following files are legacy code from older architectures and are no longer used in production. They are safe to delete:

**Dead Code (Not Used Anywhere):**
- ~~`src/lib/mirrorDilemma.ts`~~ ✅ **DELETED 2025-10-11** - Legacy mirror text generation (replaced by `useEventDataCollector.ts → fetchMirrorText()`)
- `src/hooks/useEventEffects.ts` - Old EventScreen side effects hook (replaced by EventScreen3 architecture)
- `src/components/event/EventContent.tsx` - Old event UI rendering component (not imported by any screen)

**Verification Before Deletion:**
Before deleting the above files, confirm they are not imported anywhere:
```bash
# Check for any imports of these files
grep -r "useEventEffects" src/
grep -r "EventContent" src/screens/
```

**Mirror Text Generation (Current Architecture):**

- **Quiz Screen:** `src/lib/mirrorSummary.ts` → `generateMirrorQuizSummary()` → `/api/mirror-quiz-light` (Mushu/Genie personality, 1 sentence)
  - **Payload:** Top 2 "what" + top 2 "whence" values (4 total)
  - **Purpose:** Personality summary after quiz completion
  - **Style:** Chaotic, dramatic, caring (same as event screen)
  - **Focus:** "Who you are" (goals + justifications blend)
  - **Length:** Strict 1 sentence maximum
  - **Token savings:** 85% reduction vs old mirror-summary (no history, no support data)

- **Event Screen:** `src/hooks/useEventDataCollector.ts` → `fetchMirrorText()` → `/api/mirror-light` (Mushu/Genie sidekick, 1 sentence)
  - **Key feature:** Always sorts "what" values by strength descending before taking top 2
  - **Minimal payload:** Only top 2 "what" values + current dilemma (no history, no support data)
  - **Purpose:** Actionable advice during gameplay
  - **Style:** Chaotic, dramatic, caring (same as quiz screen)
  - **Focus:** "What to do" (values vs situation)
  - **Length:** Strict 1 sentence, 20-25 words maximum
  - **Token savings:** 85% reduction vs old mirror-summary (~650 tokens saved per request)

- **DEPRECATED:** `/api/mirror-summary` (old cynical personality, no longer used anywhere)

### Development Notes

- Preserve existing design and functionality when making changes
- If additional changes are recommended, ask for confirmation first
- The EventScreen, PowerDistributionScreen, and ActionDeck optimizations serve as models for refactoring other large components
- Use the extracted hook patterns for similar complex components (RoleSelectionScreen, etc.)
- when you write new code, make sure to make it well annotated. each file should also start with a short description of what it does and how does it connect to other files in the project (which other files use it and how)
- whenever you change things, go over the claude.md file and check if it needs to be updated. if so, update it