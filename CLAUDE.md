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
│   │   └── politicalSystems.ts  # Canonical political system types
│   ├── hooks/
│   │   ├── useNarrator.ts       # Text-to-speech integration
│   │   ├── useCompassFX.ts      # Compass animation effects
│   │   ├── useRotatingText.ts   # Loading text animations
│   │   ├── useEventState.ts     # EventScreen state management (support, budget, etc.)
│   │   ├── useEventEffects.ts   # EventScreen side effects (news, mirror, auto-loading)
│   │   ├── useEventNarration.ts # EventScreen TTS/narration logic
│   │   ├── useEventActions.ts   # EventScreen action handlers (confirm, suggest)
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
│   │   ├── EventScreen.tsx      # Main gameplay screen
│   │   ├── RoleSelectionScreen.tsx
│   │   ├── CompassIntroStart.tsx
│   │   ├── MirrorDialogueScreen.tsx
│   │   ├── MirrorQuizScreen.tsx
│   │   ├── NameScreen.tsx       # Character creation
│   │   ├── PowerDistributionScreen.tsx # Power holder analysis and editing (optimized, 67 lines)
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
- `dilemmaStore` - Current dilemma, choices, resources, support levels
- `settingsStore` - Game settings and preferences
- `mirrorQuizStore` - Compass assessment progress

**Key UI Components**:
- `src/screens/EventScreen.tsx` - Main gameplay orchestrator (optimized, 107 lines)
- `src/screens/PowerDistributionScreen.tsx` - Power holder analysis orchestrator (optimized, 67 lines)
- `src/components/event/EventContent.tsx` - Event UI rendering logic (extracted from EventScreen)
- `src/components/PowerDistributionContent.tsx` - Power distribution UI rendering (extracted from PowerDistributionScreen)
- `src/components/event/` - Specialized event UI (ActionDeck, ResourceBar, SupportList, NewsTicker)
- `src/components/MiniCompass.tsx` - Political compass visualization
- Political compass system with 40 total components across 4 dimensions

**Custom Hooks for Complex Logic**:
- `useEventState` - Event screen state management (support values, budget, middle entity)
- `useEventEffects` - Side effects (news fetching, mirror dialogue, auto-loading)
- `useEventNarration` - TTS preparation and playback logic
- `useEventActions` - Action confirmation pipeline and news updates
- `usePowerDistributionState` - Power distribution state management (holders, political system, UI state)
- `usePowerDistributionAnalysis` - AI role analysis, system classification, and data processing
- `useActionDeckState` - Action deck state management (selection, confirmation flow, animations)
- `useActionSuggestion` - Suggestion validation and AI processing logic

### Backend Architecture (Express + OpenAI)

**AI-Powered Endpoints** (`server/index.mjs`):
- `/api/validate-role` - Validates user role input
- `/api/analyze-role` - Generates political system analysis
- `/api/generate-avatar` - Creates character avatars
- `/api/dilemma` - Generates daily political dilemmas
- `/api/support-analyze` - Analyzes political support changes
- `/api/compass-analyze` - Maps text to political compass values
- `/api/news-ticker` - Generates satirical news reactions
- `/api/mirror-summary` - Creates personality summaries
- `/api/tts` - Text-to-speech generation

**AI Model Configuration**: Uses environment variables for different specialized models:
- `MODEL_VALIDATE` - Role validation
- `MODEL_ANALYZE` - Political analysis
- `MODEL_DILEMMA` - Dilemma generation
- `MODEL_MIRROR` - Mirror dialogue
- `IMAGE_MODEL` - Avatar generation
- `TTS_MODEL` - Text-to-speech

### Game Flow Architecture

1. **Role Selection**: Player defines their political role and setting
2. **Political Analysis**: AI analyzes role to determine power distribution among holders (Executive, Legislature, etc.)
3. **Character Creation**: AI suggests names and generates avatar with background
4. **Compass Assessment**: Mirror dialogue and quiz to map player values across 4 dimensions
5. **Daily Dilemmas**: AI generates political situations with 3 action choices, affecting:
   - Resources (money/budget)
   - Support from three constituencies: "people" (public), "middle" (main power holder), "mom" (personal allies)
   - Political compass values

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