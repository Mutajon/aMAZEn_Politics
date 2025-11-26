# Architecture Overview

Detailed system architecture for the political simulation game.

---

## Table of Contents

1. [State Management (Zustand Stores)](#state-management-zustand-stores)
2. [Game Flow & Screen Sequence](#game-flow--screen-sequence)
3. [EventScreen3 Architecture](#eventscreen3-architecture)
4. [Core Game Systems](#core-game-systems)
5. [Treatment & Experiment System](#treatment--experiment-system)
6. [Component Patterns](#component-patterns)

---

## State Management (Zustand Stores)

10 Zustand stores manage all application state with localStorage persistence.

| Store | Purpose | Key Fields |
|-------|---------|-----------|
| **dilemmaStore** | Game state, progression, resources | `day`, `budget`, `support{People/Middle/Mom}`, `corruptionLevel`, `gameId` |
| **roleStore** | Selected role, character, E-12 analysis | `selectedRole`, `character`, `analysis`, `roleBackgroundImage` |
| **compassStore** | 4D political compass (40 values) | `values` (what/whence/how/whither @ 0-10), `initialSnapshot` |
| **settingsStore** | User preferences | `narrationEnabled`, `musicVolume`, `sfxVolume`, `debugMode`, `treatment` |
| **mirrorQuizStore** | Compass quiz progress | `quizAnswers`, `completedIndexes` |
| **pastGamesStore** | Game history (max 10) | `games[]` with avatar, score, legacy |
| **fragmentsStore** | Fragment collection (max 3) | `fragments[]`, `firstIntro` flag |
| **highscoreStore** | Top 50 scores | `entries[]` (no avatars to save space) |
| **loggingStore** | Data collection metadata | `userId`, `sessionId`, `gameVersion`, `treatment`, `consented` |
| **aftermathStore** | Aftermath prefetching | Cached aftermath data |
| **dilemmaPrefetchStore** | First dilemma prefetch | Cached first dilemma |

### Store Patterns

- **Persist Middleware**: Auto-saves to localStorage
- **Subscriptions**: `useStateChangeLogger()` tracks all changes globally
- **Naming**: Stores use camelCase, actions are imperative verbs

---

## Game Flow & Screen Sequence

### Full Game Journey

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SplashScreen (/)                                             │
│    - Title, settings, language selector                         │
│    - Check game slot availability                               │
│    - Navigate → /intro                                          │
├─────────────────────────────────────────────────────────────────┤
│ 2. IntroScreen (/intro)                                         │
│    - Gatekeeper dialog (first visit: 26 lines)                  │
│    - Fragment collection display (3 slots)                      │
│    - Navigate → /role                                           │
├─────────────────────────────────────────────────────────────────┤
│ 3. RoleSelectionScreen (/role)                                  │
│    - Carousel: 10 predefined roles OR custom creation          │
│    - AI validation: /api/validate-role                          │
│    - Session start: loggingService.startSession()               │
│    - Navigate → /campaign                                       │
├─────────────────────────────────────────────────────────────────┤
│ 4. CampaignScreen (/campaign)                                   │
│    - Display role background & context                          │
│    - Navigate → /power                                          │
├─────────────────────────────────────────────────────────────────┤
│ 5. PowerDistributionScreen (/power)                             │
│    - E-12 power analysis (Author/Eraser badges)                 │
│    - AI analysis: /api/analyze-role (custom roles only)         │
│    - Navigate → /name                                           │
├─────────────────────────────────────────────────────────────────┤
│ 6. NameScreen (/name)                                           │
│    - Character creation (gender, name, description)             │
│    - AI avatar generation: /api/generate-avatar                 │
│    - Navigate → /compass-intro                                  │
├─────────────────────────────────────────────────────────────────┤
│ 7. CompassIntroStart (/compass-intro)                           │
│    - Intro to 4D compass (What/Whence/How/Whither)             │
│    - Navigate → /compass-mirror                                 │
├─────────────────────────────────────────────────────────────────┤
│ 8. MirrorDialogueScreen (/compass-mirror)                       │
│    - Gatekeeper character dialogue                              │
│    - Navigate → /compass-quiz                                   │
├─────────────────────────────────────────────────────────────────┤
│ 9. MirrorQuizScreen (/compass-quiz)                             │
│    - 40-question quiz (40 components)                           │
│    - Records timing via useTimingLogger                         │
│    - AI summary: /api/mirror-quiz-light                         │
│    - Navigate → /background-intro                               │
├─────────────────────────────────────────────────────────────────┤
│ 10. BackgroundIntroScreen (/background-intro)                   │
│     - Narrative scaffold: /api/narrative-seed                   │
│     - Prefetch first dilemma                                    │
│     - Navigate → /event (if enableModifiers: /difficulty first) │
├─────────────────────────────────────────────────────────────────┤
│ [Optional] DifficultyScreen (/difficulty)                       │
│ [Optional] GoalsSelectionScreen (/goals)                        │
├─────────────────────────────────────────────────────────────────┤
│ 11. EventScreen3 (/event) - MAIN GAME LOOP                      │
│     - Days 1-7: AI-generated dilemmas                           │
│     - 4-phase architecture (see below)                          │
│     - API: /api/game-turn-v2 (stateful conversation)            │
│     - Navigate → /aftermath (Day 8)                             │
├─────────────────────────────────────────────────────────────────┤
│ [Optional] DownfallScreen (/downfall)                           │
│     - Game over if support drops to 0                           │
├─────────────────────────────────────────────────────────────────┤
│ 12. AftermathScreen (/aftermath)                                │
│     - Game epilogue: /api/aftermath                             │
│     - Show legacy, events, compass summary                      │
│     - Collect fragment (pastGamesStore)                         │
│     - Session end: loggingService.endSession()                  │
│     - Navigate → /final-score                                   │
├─────────────────────────────────────────────────────────────────┤
│ 13. FinalScoreScreen (/final-score)                             │
│     - Animated score breakdown                                  │
│     - Auto-submit to highscores                                 │
│     - Navigate → /highscores                                    │
├─────────────────────────────────────────────────────────────────┤
│ 14. HighscoreScreen (/highscores)                               │
│     - Top 50 with highlighting                                  │
│     - Navigate → / (new game)                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Optional Routes

- `/achievements` - Book of Achievements (under construction)
- `/backstage` - Development mode (bypasses experiments)
- `/debug-mini` - Mini compass debug
- `/compass-vis` - Compass visualization
- `/capped` - Game limit reached

---

## EventScreen3 Architecture

The core game loop uses a **4-phase state machine**.

### Phase Model

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: COLLECTING                                             │
│ ────────────────────────────────────────────────────────────    │
│ - Parallel API call to /api/game-turn-v2                        │
│ - Fetch: dilemma, support shifts, compass hints, mirror advice  │
│ - Loading overlay with progress indicators                      │
│ - Hook: useEventDataCollector                                   │
│ - Duration: 2-5 seconds (API latency)                           │
├─────────────────────────────────────────────────────────────────┤
│ Phase 2: PRESENTING                                             │
│ ────────────────────────────────────────────────────────────    │
│ - Sequential reveal of collected data:                          │
│   1. Dilemma card appears                                       │
│   2. Dynamic parameters (consequences) animate in               │
│   3. Action deck (3 AI cards + custom button) displayed         │
│   4. Support bars update with projections                       │
│ - Hook: useRevealSequence                                       │
│ - Duration: 1-2 seconds (animation timing)                      │
├─────────────────────────────────────────────────────────────────┤
│ Phase 3: INTERACTING                                            │
│ ────────────────────────────────────────────────────────────    │
│ - Player chooses action (click card)                            │
│ - Immediate UI updates:                                         │
│   • Coin flies to budget counter                                │
│   • Budget updates immediately                                  │
│ - Background API call:                                          │
│   • Support analysis (animated bar updates)                     │
│ - Timing: useTimingLogger tracks decision time                  │
│ - Duration: Variable (player decision time)                     │
├─────────────────────────────────────────────────────────────────┤
│ Phase 4: CLEANING                                               │
│ ────────────────────────────────────────────────────────────    │
│ - Process choice effects:                                       │
│   • Compass pills (change indicators) displayed                 │
│   • Corruption pill updated if applicable                       │
│   • Support bars finalize animation                             │
│ - Advance day counter (day++)                                   │
│ - Check for Day 8 (game end) or continue                        │
│ - Duration: 1-2 seconds (animation cleanup)                     │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

- `src/screens/EventScreen3.tsx` - Main screen component (107 lines after refactor)
- `src/hooks/useEventDataCollector.ts` - API data collection
- `src/hooks/useRevealSequence.ts` - Animation sequencing
- `src/hooks/useEventActions.ts` - Action selection logic
- `src/components/event/ActionDeck.tsx` - Action card display
- `src/components/event/DilemmaCard.tsx` - Dilemma presentation
- `src/components/event/ResourceBar.tsx` - Support/budget display

---

## Core Game Systems

### 1. Political Compass System

**Architecture**: 4 dimensions × 10 components each = 40 values (0-10 scale)

**Dimensions**:
- **What** (6 components): Societal goals (Truth, Liberty, Equality, Care, Beauty, Tradition)
- **Whence** (6 components): Justifications (Evidence, Revelation, Personal Intuition, Collective Wisdom, Ancestors, Nature)
- **How** (9 components): Methods (Law, Markets, Mobilization, Mutual Aid, Hierarchy, Protocol, Expertise, Revelation, Mystery)
- **Whither** (9 components): Recipients (Self, Household, Community, Nation, Humanity, Future, Life, Cosmos, Mystery)

**Quiz System**:
- 40 statements (1-2 per component)
- Answers: +1/-1/-2 adjusts relevant component
- Takes 3-5 minutes to complete
- Results: compassStore.values

**Daily Impact**:
- Actions change compass values (soft guidance by AI)
- Changes shown via "compass pills" (emoji + name + delta)
- Tracked in dilemmaStore.pendingCompassPills
- Used for narrative seeding and AI tension-building

**Data File**: `src/data/compass-data.ts`

---

### 2. Support & Resources System

**Three Support Tracks** (0-100 each):

1. **supportPeople** - General population approval
2. **supportMiddle** - Power holders / institutional opposition
3. **supportMom** - Personal anchors (family, mentors, loyalists)

**Budget** (integer):
- Starting: 500-2000 (varies by difficulty)
- Each action costs/earns budget
- Affects credibility and implementation capacity

**Crisis Mode**:
- Triggered when any support < 20
- Visual warning banner (entity name + icon + value)
- Multiple crises possible simultaneously

**Corruption System** (0-100):
- Tracks ethical compromises
- AI evaluates 0-10 scale, normalized to 0-100
- Rubric: Intent (0-4) + Method (0-3) + Impact (0-3)
- Reduces final score linearly
- History tracked: day, score, reason, level

---

### 3. E-12 Political System Analysis

**Overview**: Power distribution using Exception-12 framework

**11 Polity Types**:
1. Democracy
2. Republican Oligarchy
3. Hard-Power Oligarchy (Plutocracy/Stratocracy)
4. Mental-Might Oligarchy (Theocracy/Technocracy/Telecracy)
5. Autocratizing (Executive/Military)
6. Personalist Monarchy/Autocracy
7. Theocratic Monarchy

**Exception Domains** (3 tiers, 12 total):
- Tier I (Existential): Security, Civil Liberties, Information Order
- Tier II (Constitutive): Diplomacy, Justice, Economy, Appointments
- Tier III (Contextual): Infrastructure, Curricula, Healthcare, Immigration, Environment

**Power Holder Classification**:
- **Author (A)**: Can write/change rules (✍️ blue badge)
- **Eraser (E)**: Can veto/provide oversight (🛑 red badge)
- **Subject-Type**: Author, Eraser, Agent, Actor, Acolyte, Dictator
- **Intensity**: Strong (+), Moderate (•), Weak (-)

**Predefined Roles** (10 historical scenarios):
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

**Data File**: `src/data/predefinedRoles.ts`

---

### 4. Scoring System

| Category | Max Points | Formula |
|----------|-----------|---------|
| **Support** | 1500 | 500 per track: `(value/100) × 500` |
| **Corruption Penalty** | -500 | `-(corruptionLevel/10) × 500` (linear) |
| **TOTAL** | **-500 to 1500** | Sum of support - corruption penalty |

**Hall of Fame**:
- Top 50 scores auto-submitted
- Top 3 highlighted (gold/silver/bronze)
- Queryable: `/highscores?highlight=PlayerName`

---

### 5. Strict Topic Variety System

**Rules**:
- **MAX 2 consecutive dilemmas** on same topic (Military, Economy, Religion, etc.)
- **Immediate Consequences**: AI shows dramatic results, no re-questioning
- **Closure Allowance**: If storyline concludes, AI may show 1 closure dilemma before switching
- **Forced Switching**: After 2 consecutive on same topic, MUST switch

**Implementation**: `/api/game-turn-v2` in `server/index.mjs`

**Goal**: Prevent "wobbling" around same decision, ensure varied gameplay

---

### 6. Custom Action Validation System

**Philosophy**: Highly permissive, pro-player system

**Validation Rules** (`/api/validate-suggestion`):
- ✅ **ACCEPT**: Violent, unethical, manipulative actions (corruption penalties applied later)
- ✅ **ACCEPT**: Risky actions (assassination, poisoning, coups, bribery)
- ✅ **ACCEPT**: Difficult but theoretically possible for role
- ❌ **REJECT**: Only anachronisms, gibberish, total irrelevance, physically impossible

**Authority Boundaries**:
- Physical impossibility = Role cannot access required power/tech/resources
- Examples: Citizen can propose war ✅, attempt assassination ✅, but cannot directly command troops ❌

**Constructive Rejections**: Suggest feasible alternatives

**Corruption Evaluation**:
- ALL actions evaluated 0-10 scale
- Violence NOT automatically corruption (depends on intent/method/impact)
- Examples: Assassination for power = 6-8; Defensive war = 0-1

---

### 7. Fragment Collection System

**Purpose**: Progressive narrative where players collect 3 fragments to "remember who they are"

**Lifecycle**:
1. **First Visit**: Full gatekeeper dialog (26 lines)
2. **Game Completion**: Fragment auto-collected (AftermathScreen)
3. **Return Visits**: Abbreviated message + fragment slots visible
4. **3 Fragments**: "Ready to move on to eternal rest"

**Fragment Data**:
- Links to pastGamesStore via gameId
- Displays: Avatar, name, setting, legacy, snapshot pills
- Click fragment → popup with full game details

**Storage**: localStorage, max 3 fragments

**Files**:
- `src/store/fragmentsStore.ts`
- `src/components/fragments/FragmentSlots.tsx`
- `src/components/fragments/FragmentPopup.tsx`

---

### 8. Dynamic Parameters (Immediate Consequences)

**Format**: Emoji + vivid consequence (3-5 words)

**Examples**:
- "🔥 Royal palace stormed"
- "👥 4 million march"
- "🏛️ Parliament dissolved"

**Purpose**: Show immediate dramatic results of actions

**Display**: Day 2+, appears after action selection

**Component**: `src/components/event/DynamicParameters.tsx`

---

### 9. Goals System (Optional)

Enabled when `settingsStore.enableModifiers` is ON.

**Three Types**:
- **End-State**: "Achieve >70% support from People"
- **Continuous**: "Maintain >40 budget throughout game"
- **Behavioral**: "Inquire about at least 5 dilemmas"

**Display**: Real-time status in ResourceBar (✅ met / ⏳ in progress / ❌ failed)

**Bonus**: +150 pts per completed goal (max 2 goals × 150 = +300 pts)

**Data File**: `src/data/goals.ts`

---

### 10. Prefetching Systems

**Aftermath Prefetch**:
- Starts Day 8
- Loads before player clicks
- 5-minute freshness check with fallback

**First Dilemma Prefetch**:
- Starts during BackgroundIntroScreen "ready" phase
- Reduces wait time for Day 1

**Files**:
- `src/store/aftermathStore.ts`
- `src/store/dilemmaPrefetchStore.ts`

---

## Treatment & Experiment System

**Three Treatment Types** (`src/data/experimentConfig.ts`):

| Treatment | AI Options | Custom Action | API Call | Inquiry Credits |
|-----------|-----------|---------------|----------|-----------------|
| **fullAutonomy** | ❌ Hidden | ✅ Only option | Skipped (saves 40-50% tokens) | 2 per dilemma |
| **semiAutonomy** | ✅ 3 cards | ✅ Button below | Called | 1 per dilemma |
| **noAutonomy** | ✅ 3 cards | ❌ Hidden | Called | 0 |

**Treatment Assignment**:
- Backend: `/api/users/register`
- Adaptive distribution (assigns to under-represented treatments)
- Stored: loggingStore.treatment (persists in localStorage)

**Usage Pattern**:
```typescript
import { getTreatmentConfig } from '@/data/experimentConfig';
import { useSettingsStore } from '@/store/settingsStore';

const treatment = useSettingsStore((state) => state.treatment);
const config = getTreatmentConfig(treatment);

if (config.generateAIOptions) { /* Call API */ }
if (config.showCustomAction) { /* Show button */ }
```

**Adding New Experimental Features**:
1. Add field to `TreatmentConfig` interface in `experimentConfig.ts`
2. Set values for each treatment in `EXPERIMENT_CONFIG`
3. Read config in component/hook and implement conditional logic
4. Update documentation

---

## Component Patterns

### Component Optimization Pattern

Applied to EventScreen3, PowerDistributionScreen, ActionDeck:

1. **Extract State Hooks** - Component state management
2. **Extract Logic Hooks** - Complex operations
3. **Extract Content Components** - UI rendering
4. **Extract Specialized Systems** - Complex features

**Benefits**: Better React optimizations, improved maintainability

### Completed Optimizations

**Component Refactoring**:
- EventScreen: 512 → 107 lines
- PowerDistributionScreen: 597 → 67 lines
- ActionDeck: 673 → 242 lines

**AI Token Optimization**:
- Compass Analysis: 81% reduction (682 → 133 tokens)
- Dilemma Generation: 40-50% reduction (~2,000 → ~1,000 tokens)
- Overall: ~50% token savings with hosted state

**Key Strategies**:
- Compass: Top 3 per dimension only
- History: Last 2 days only
- Mirror: Minimal context
- Conversation state: Incremental updates

---

## Audio System

**Architecture**:
- Singleton: `audioManager` (`src/lib/audioManager.ts`)
- React hook: `useAudioManager()`
- Separate controls: music volume (0-100), SFX volume (0-100)

**Audio Files**:
- `tempBKGmusic.mp3` - Background music (loops, 30% volume)
- `achievementsChimesShort.mp3` - Compass pills
- `coins.mp3` - Coin animation
- `click soft.mp3` - Button clicks

**TTS (Text-to-Speech)**:
- Provider: OpenAI TTS API
- Model: `gpt-4o-mini-tts` (supports instructions)
- Voices: alloy, echo, fable, onyx, nova, shimmer
- Per-screen customization:
  - Dilemmas: "Speak as dramatic political narrator with gravitas"
  - Aftermath: "Speak in solemn, reflective tone"
- Controlled by: sfxEnabled toggle

**Files**:
- `src/hooks/useNarrator.ts` - TTS preparation & playback
- `src/hooks/useEventNarration.ts` - Dilemma narration
- `src/hooks/useAftermathNarration.ts` - Aftermath narration

---

## Internationalization (i18n)

**Supported Languages**: English (en), Hebrew (he)

**System**:
- Context-based: LanguageContext.tsx
- JSON files: `src/i18n/locales/en.json`, `he.json`
- RTL support: Automatic `dir="rtl"` for Hebrew
- Hook: `useLang()` returns string for key lookup

**Coverage**: ~500 keys for game content, UI labels, dilemmas, compass descriptions

---

## Past Games Storage

**Purpose**: Save completed game history for future gallery/comparison screens

**Storage**: localStorage (max 10 games, auto-prunes oldest)

**Stored Data Per Game**:
- Player name, avatar (base64), role title, political system
- Final score, support levels, corruption
- Legacy string ("You will be remembered as...")
- 3-6 snapshot highlights (dramatic events)
- Top 2-3 compass values per dimension
- Democracy/autonomy/liberalism ratings

**Architecture**:
- Store: `src/store/pastGamesStore.ts`
- Types: `src/lib/types/pastGames.ts`
- Service: `src/lib/pastGamesService.ts`
- Integration: `src/screens/AftermathScreen.tsx`

**Auto-Pruning**: Keeps only 10 most recent, sorted by timestamp

---

## Routing System

**Hash-Based Router** (`src/lib/router.ts`):
- Uses `window.location.hash` for client-side routing
- No server-side routing needed (SPA model)
- Normalizes paths (unicode dashes, slashes, trailing slashes)

**Route Mapping**: See Game Flow section above

---

## Key Design Principles

1. **Preserve Functionality**: Never break existing features when refactoring
2. **Optimize for React**: Extract hooks, minimize re-renders
3. **Token Efficiency**: Minimize AI context, incremental updates
4. **Comprehensive Logging**: All user actions and system events logged
5. **Treatment-Aware**: Feature availability controlled by experiment config
6. **Fail Gracefully**: Prefetching failures don't block gameplay
7. **Mobile-First**: Responsive design, touch-friendly UI
