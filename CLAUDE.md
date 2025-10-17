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
│   │   ├── event/          # EventScreen UI (ActionDeck, DilemmaCard, ResourceBar, etc.)
│   │   └── [other components]
│   ├── data/               # Static data (compass definitions, quiz pool, political systems)
│   ├── hooks/              # Custom hooks for complex logic (event state, narration, data collection)
│   ├── lib/                # Utilities (router, scoring, dilemma types, compass mapping)
│   ├── screens/            # Main game screens (EventScreen3, PowerDistributionScreen, etc.)
│   ├── store/              # Zustand stores (roleStore, compassStore, dilemmaStore, etc.)
│   └── theme/              # Styling configurations
```

### State Management (Zustand)

- **roleStore** - Selected role, political analysis, character data
- **compassStore** - 4D political compass values (what/whence/how/whither)
- **dilemmaStore** - Current game state, resources, support levels, subject streak tracking, selected goals, goal tracking state
- **settingsStore** - User preferences (narration, music, sound effects, debug mode, useLightDilemma toggle, enableModifiers)
- **mirrorQuizStore** - Compass assessment progress
- **aftermathStore** - Aftermath data prefetching
- **dilemmaPrefetchStore** - First dilemma prefetching

### AI Endpoints

**Dilemma Generation:**
- `/api/dilemma-light` - **DEFAULT** - Minimal payload, integrated support analysis (~15-20s, 85% token reduction)
- `/api/dilemma` - Heavy version with separate support analysis (legacy, ~60s)

**Mirror Dialogue:**
- `/api/mirror-quiz-light` - Personality summary after quiz (1 sentence, Mushu/Genie personality)
- `/api/mirror-light` - Event screen advice (1 sentence, dramatic sidekick personality)
- `/api/mirror-summary` - **DEPRECATED** - Old cynical personality (no longer used)

**Other Endpoints:**
- `/api/validate-role`, `/api/analyze-role` - Role validation and political system analysis
- `/api/generate-avatar`, `/api/tts` - Avatar and text-to-speech generation
- `/api/compass-analyze` - Maps text to compass values (81% optimized)
- `/api/support-analyze` - Support change analysis (heavy API only)
- `/api/aftermath` - Game epilogue generation
- `/api/news-ticker` - **DISABLED** - Satirical news (code kept for future)

**Multi-Provider Support:**
- Default: OpenAI GPT (requires `OPENAI_API_KEY`)
- Optional: Anthropic Claude (requires `MODEL_DILEMMA_ANTHROPIC` and `MODEL_MIRROR_ANTHROPIC` in `.env`)
- Switch via browser console: `switchToClaude()` / `switchToGPT()`

## Game Flow

1. **Role Selection** → Political system analysis (predefined roles skip AI call)
2. **Character Creation** → Name suggestions + AI avatar (predefined roles use static data)
3. **Power Distribution** → Define support levels for three factions
4. **Difficulty Selection** (if `enableModifiers` setting is ON) → Choose difficulty level affecting starting resources
5. **Goals Selection** (if `enableModifiers` setting is ON) → Choose 2 out of 3 randomly-presented goals to pursue
6. **Compass Assessment** → Mirror dialogue + quiz to map 4D values
7. **Background Intro** → Sleep transition with personalized wake-up narrative
8. **Daily Dilemmas (7 days)** → AI-generated political situations affecting budget, support, compass values
9. **Aftermath Screen** → AI epilogue with narrative summary, decision breakdown, ratings
10. **Final Score Screen** → Animated score breakdown with goal bonuses and Hall of Fame integration
11. **Hall of Fame** → Top 50 highscores with player highlighting

### Key Game Mechanics

**Day 1 Personalization:**
- First dilemma tailored to player's top 2 "what" compass values (e.g., Liberty + Care)
- Sent only on Day 1 request (~40 tokens added)

**Thematic Guidance:**
- **Custom Subject Mode**: User-defined topic (e.g., "Environmental policy")
- **Default Axes Mode**: Autonomy vs Heteronomy, Liberalism vs Totalism
- Setting: `dilemmasSubjectEnabled` + `dilemmasSubject` in settingsStore

**Subject Streak Tracking:**
- Automatically varies topics after 3+ consecutive same-subject dilemmas
- Prevents repetitive content

**Vote Outcome Continuity:**
- If player's previous action involved calling a vote, referendum, or public consultation, the next dilemma MUST present the results
- Results include: outcome percentage/margin, immediate reactions, and implications
- New dilemma framed around how player responds to the vote results
- Applies SYSTEM FEEL: outcomes play differently across political systems (e.g., direct democracies implement immediately, autocracies may face resistance if ignored)
- Implementation: `server/index.mjs:1469-1473` in CONTINUITY section of `buildLightSystemPrompt()`

**Action Confirmation Pipeline:**
1. Immediate UI: Card animation, coin flight, budget update (synchronous)
2. Support analysis: Background API call, animated bar updates
3. Compass analysis: **DEFERRED to next day** (appears as "compass pills", eliminates double-application bug)

**Prefetching Systems:**
- **Aftermath Prefetch**: Starts when game ends (Day 8), loads data before player clicks "View Aftermath"
- **First Dilemma Prefetch**: Starts in BackgroundIntroScreen "ready" phase, loads Day 1 while player reads intro
- Both use 5-minute freshness check with fallback to normal loading

**Progressive Loading:**
- Auto-increments 0→99% at 1%/second
- Server response triggers smooth catchup animation to 100%
- Single unified overlay for all loading cycles

**Compass Pills:**
- Visual feedback showing how previous action affected compass values
- Appears on Day 2+ at presentation Step 4A
- Auto-collapse after 2s, user-expandable with "+" button

**Goals System:**
- Only enabled when `enableModifiers` setting is ON
- Player selects 2 out of 3 randomly-presented goals after difficulty selection
- Goals displayed in ResourceBar (compact pill format, left of avatar picture) during gameplay
- Three goal categories:
  - **End-State Goals**: Evaluated only on final day (e.g., "End with 85%+ public support")
  - **Continuous Goals**: Can permanently fail if threshold violated (e.g., "Never drop below 50% support")
  - **Behavioral Goals**: Track player actions (e.g., "Never use custom actions")
- Minimum value tracking: Budget, support levels tracked throughout game for continuous goals
- Custom action tracking: Incremented when player uses "Suggest Your Own" option
- Goal evaluation: Runs after each day advancement (in eventDataCleaner.ts)
- Real-time status updates via GoalsCompact component with status icons (✅/⏳/❌) and hover tooltips
- Final scoring: Bonus points awarded only for completed goals (0-300 total)
- Data centralized in `src/data/goals.ts` for easy editing

## Audio System

**Architecture:**
- Centralized audio management via `audioManager` singleton (`src/lib/audioManager.ts`)
- React hook wrapper: `useAudioManager()` for component integration
- Separate volume controls for music and sound effects
- All audio files preloaded on initialization

**Audio Files:**
- `tempBKGmusic.mp3` - Background music (loops, 30% volume default)
- `achievementsChimesShort.mp3` - Compass pills achievement sound
- `coins.mp3` - Coin animation sound
- `click soft.mp3` - Button click feedback

**UI Controls:**
- `AudioControls` component - Vertical stack at top-left
- Music button (top): Music note icon (amber when enabled, gray when muted)
- SFX button (bottom): Speaker icon (cyan when enabled, gray when muted)
- Semi-transparent backdrop, visible on all screens

**Settings Integration:**
- `musicEnabled` / `sfxEnabled` - Toggle mute state
- `musicVolume` / `sfxVolume` - Volume levels (0.0 - 1.0)
- Persisted in localStorage via Zustand (settings-v11)

**Sound Triggers:**
- **Background Music**: Auto-starts in App.tsx on mount
- **Achievement Chime**: CompassPillsOverlay when pills appear
- **Coins**: CoinFlightSystem when animation starts
- **Click**: ActionDeckContent on button interactions (select, confirm, cancel)

**Narration Integration:**
- Narration (TTS voiceover) is controlled by SFX toggle
- When SFX is muted, narration is also disabled (prevents TTS API requests)
- TTS API requests are automatically prevented when disabled (no token waste)
- Prevention check occurs in useNarrator.ts:85-92 before fetch to /api/tts
- Used in EventScreen (dilemma narration) and AftermathScreen (remembrance narration)

## Political Compass System

Four dimensions with 10 components each (40 total):
- **What** (Ultimate goals): Truth, Liberty, Equality, Care, etc.
- **Whence** (Justification): Evidence, Tradition, Personal intuition, etc.
- **How** (Means): Law, Markets, Mobilization, Mutual Aid, etc.
- **Whither** (Recipients): Individual, Community, Nation, Global, etc.

## Scoring System

Score calculated in FinalScoreScreen only (stays at 0 during gameplay).

| Category | Max Points | Formula |
|----------|-----------|---------|
| **Support** | 1800 | 600 per track: `(value/100) × 600` |
| **Budget** | 400 | `min(400, (budget/1000) × 400)` |
| **Ideology** | 600 | 300 per axis (5-tier from Aftermath API) |
| **Goals** | 0-300 | Sum of completed goal bonuses (max 2 goals × 150 pts each) |
| **Difficulty** | ±500 | -200/0/+200/+500 flat modifier |
| **TOTAL** | ~3600 | No cap (theoretical max ~3600) |

**Ideology Rating → Points:**
- very-low: 60, low: 134, medium: 210, high: 254, very-high: 300

**Goals System:**
- Only available when `enableModifiers` setting is ON
- Players select 2 out of 3 randomly-presented goals after difficulty selection
- Goal types: End-State (final values), Continuous (never drop below), Behavioral (action tracking)
- Real-time status tracking (✅ met / ⏳ in progress / ❌ failed) displayed in ResourceBar
- Bonus points awarded only for completed goals
- Goal pool contains 12 different goals with bonuses ranging from 100-150 points each

**Hall of Fame Integration:**
- All players auto-submitted to highscore table after animation
- Top 20 = celebration banner, others = acknowledgment
- Highlighting + auto-scroll via URL param: `/highscores?highlight=PlayerName`

## Code Patterns & Architecture

### Component Optimization Pattern
Used in EventScreen3, PowerDistributionScreen, ActionDeck:
1. **Extract State Hooks** - Manage component state (e.g., `useEventState`, `useActionDeckState`)
2. **Extract Logic Hooks** - Handle complex operations (e.g., `usePowerDistributionAnalysis`, `useActionSuggestion`)
3. **Extract Content Components** - Separate UI rendering (e.g., `ActionDeckContent`, `PowerDistributionContent`)
4. **Extract Specialized Systems** - Isolate complex features (e.g., `CoinFlightSystem`, `CompassPillsOverlay`)

Benefits: Better React optimizations (memoization, selective re-renders), improved maintainability.

### Completed Optimizations

**Component Refactoring:**
- EventScreen: 512 → 107 lines
- PowerDistributionScreen: 597 → 67 lines
- ActionDeck: 673 → 242 lines

**AI Token Optimization:**
- Compass Analysis: 81% reduction (682 → 133 tokens)
- API Payload: 43.5% reduction (5,400 → 3,050 tokens/day)
- Dilemma Generation: 40-50% reduction (~2,000 → ~1,000 tokens)
- Light Dilemma API: 85%+ reduction + 3-4x faster (60s → 15-20s)

**Key Optimizations:**
- Compass values: Top 3 per dimension only (not all 40)
- Dilemma history: Last 2 days only (not full 7 days)
- Mirror payload: Minimal context (top 2 values + current dilemma)
- NewsTicker: Disabled by default (~800 tokens saved)

### Remaining Optimization Opportunities

**Component Refactoring:**
- RoleSelectionScreen.tsx - Extract role validation and selection logic
- MirrorDialogueScreen.tsx - Extract mirror conversation handling

**React Performance:**
- Add `React.memo()` to frequently re-rendering components
- Implement `useMemo()` for expensive calculations
- Add `useCallback()` for event handlers

**Code Organization:**
- Create barrel exports (`index.ts` files)
- Move components into logical sub-folders
- Extract shared utilities

**Bundle Optimization:**
- Implement code splitting for game screens
- Lazy load heavy components

## Known Issues & Disabled Features

**EventScreen ↔ MirrorScreen Navigation (DISABLED 2025-10-10):**
- "?" button temporarily removed from MirrorCard
- Issues: Error on return, narration re-trigger, possible duplicate API request
- Navigation system exists (`eventScreenSnapshot.ts`) but has timing/effect issues
- Will be restored after debugging effect dependencies and restoration lifecycle

## Code Cleanup

**Legacy Files (Safe to Delete):**
- `src/hooks/useEventEffects.ts` - Replaced by EventScreen3 architecture
- `src/components/event/EventContent.tsx` - Not imported anywhere

**Verification:**
```bash
grep -r "useEventEffects" src/
grep -r "EventContent" src/screens/
```

## Development Guidelines

- **Preserve existing design and functionality** when making changes
- **Ask for confirmation** before making additional changes beyond the task
- **Use optimization patterns** from EventScreen3, PowerDistributionScreen, ActionDeck as models
- **Annotate new code** with clear descriptions and file relationships
- **Update CLAUDE.md** whenever making significant changes
- **Keep dependencies clean** - Review `useEffect` cleanup functions to prevent memory leaks
