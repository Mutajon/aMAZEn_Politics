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

### Production Build & Deploy

The game is configured for deployment to Render.com (or similar Node.js hosting platforms).

**Prerequisites:**
- Node.js 20+
- GitHub repository connected to hosting platform
- Environment variables configured on hosting platform

**Build Process:**
```bash
npm install          # Install dependencies
npm run build        # Build production frontend (creates dist/)
npm start            # Start production server (serves static files + API)
```

**Git Workflow:**
- `main` branch → Connected to Render (production deployment)
- `development` branch → Active development work
- **Deployment:** Merge `development` → `main` → push → auto-deploy

**Key Files:**
- `.node-version` - Specifies Node.js v20 for Render
- `server/index.mjs` - Serves static files from `dist/` when `NODE_ENV=production`
- `package.json` - Contains `start` script for production

**Environment Variables (Required on Render):**
```bash
NODE_ENV=production
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key  # Optional, for Claude support
CHAT_MODEL=gpt-5-mini
MODEL_DILEMMA=gpt-5
MODEL_MIRROR=gpt-5
IMAGE_MODEL=gpt-image-1
TTS_MODEL=tts-1
TTS_VOICE=alloy
PORT=3001  # Auto-set by Render, override if needed
```

**Render.com Configuration:**
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Plan:** Starter ($7/month) - No cold starts, instant access
- **Auto-Deploy:** Enabled on `main` branch pushes

**Deployment Workflow:**
1. Work on `development` branch
2. Test locally: `npm run dev`
3. When ready: merge `development` → `main`
4. Push `main` to GitHub
5. Render auto-deploys (2-5 minutes)
6. Test live URL
7. Notify testers

**Rollback:**
- Git: `git revert HEAD && git push`
- Render Dashboard: Click "Redeploy" on previous deployment

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
- **dilemmaStore** - Current game state, resources, support levels, subject streak tracking, selected goals, goal tracking state, **gameId** (hosted state conversation identifier)
- **settingsStore** - User preferences (narration, music, sound effects, debug mode, enableModifiers)
- **mirrorQuizStore** - Compass assessment progress
- **aftermathStore** - Aftermath data prefetching
- **dilemmaPrefetchStore** - First dilemma prefetching

**Hosted State Architecture:**
- `gameId` generated on game start (format: `game-{timestamp}-{random}`)
- Persisted in localStorage for conversation continuity across page refreshes
- Conversation lifecycle managed by `dilemmaStore.initializeGame()` and `dilemmaStore.endConversation()`
- Backend stores message history in-memory with 24hr TTL
- Automatic cleanup via periodic task

**Natural Topic Variety (NEW):**
- AI judges topic repetition using full conversation history (no manual tracking)
- After 3 consecutive dilemmas on same topic: Summarizes in 1 sentence, transitions naturally
- Replaces old hard-coded "Day 3 & 5 forbidden topics" system
- Exception: Urgent follow-ups (vote results, crises) continue even if 3+ same-topic turns
- Policy domains: Economy, Security, Diplomacy, Rights, Infrastructure, Environment, Health, Education, Justice, Culture, Foreign Relations, Technology

**Dynamic Parameters Generation:**
- AI generates 1-3 unique measurable consequences per turn (Day 2+ only)
- Each parameter: 4-6 words max, specific outcome with icon and tone
- Examples: "GDP growth +2.3%", "800K jobs lost", "Approval rating 68%"
- Variety enforced: Economic, social, political aspects shown
- Bug fix (2025-01-27): Prompt now shows 1-3 diverse examples to prevent duplication

### AI Endpoints

**🎮 HOSTED STATE GAME ENGINE (NEW):**
- `/api/game-turn` - **Unified endpoint for all event screen data using conversation state**
  * Replaces: `/api/dilemma-light`, `/api/compass-analyze`, `/api/dynamic-parameters`, `/api/mirror-light`
  * Benefits: AI maintains full 7-day context, ~50% token savings after Day 1, ~50% faster
  * Architecture: Uses OpenAI Chat Completions API with persistent message history
  * Day 1: Sends full game context (role, system, compass, power holders)
  * Days 2-7: Sends minimal updates (player choice + compass delta)
  * Returns: Unified JSON with dilemma, support shifts, mirror advice, dynamic params, compass hints
  * Conversation lifecycle: Created on game start, cleaned up on game end
  * Storage: In-memory conversation store with 24hr TTL

**Mirror Dialogue:**
- `/api/mirror-quiz-light` - Personality summary after quiz (1 sentence, Mushu/Genie personality)

**Other Endpoints:**
- `/api/validate-role`, `/api/analyze-role` - Role validation and political system analysis
- `/api/generate-avatar`, `/api/tts` - Avatar and text-to-speech generation
- `/api/aftermath` - Game epilogue generation
- `/api/news-ticker` - **DISABLED** - Satirical news (code kept for future)

**Legacy Endpoints (Deprecated):**
- `/api/dilemma-light` - Stateless dilemma generation (replaced by `/api/game-turn`)
- `/api/compass-analyze` - Standalone compass analysis (now integrated in `/api/game-turn`)
- `/api/dynamic-parameters` - Standalone dynamic params (now integrated in `/api/game-turn`)
- `/api/mirror-light` - Standalone mirror advice (now integrated in `/api/game-turn`)

**Multi-Provider Support:**
- Default: OpenAI GPT (requires `OPENAI_API_KEY`)
- Optional: Anthropic Claude (requires `MODEL_DILEMMA_ANTHROPIC` and `MODEL_MIRROR_ANTHROPIC` in `.env`)
- Switch via browser console: `switchToClaude()` / `switchToGPT()`
- Note: Hosted state currently uses OpenAI only (Anthropic support planned)

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

## Political System Analysis (E-12 Framework)

**Overview:**
The power distribution analysis uses the Exception-12 (E-12) framework to classify political systems based on who decides exceptions across 12 critical policy domains. This replaced the previous 25-system taxonomy with a more rigorous 11-polity classification.

**Implementation Date:** 2025-10-22 (Sessions 1-4)

### The 11 Polity Types

Polities are classified based on Author/Eraser control patterns across three tiers of exception domains:

1. **Democracy**
   - Demos (the people) hold decisive authority in core domains through direct mechanisms
   - Example: Classical Athens, modern referendums

2. **Republican Oligarchy**
   - Formal offices (Executive, Legislative, Judicial) divide power
   - No single seat holds both pen and eraser across domains
   - Examples: US Congress, German Bundestag, EU institutions

3. **Hard-Power Oligarchy — Plutocracy**
   - Wealth-holders control key exception domains
   - Economic power translates to political veto

4. **Hard-Power Oligarchy — Stratocracy**
   - Military/security apparatus holds decisive seats
   - Coercive force shapes policy exceptions
   - Examples: Military juntas, praetorian systems

5. **Mental-Might Oligarchy — Theocracy**
   - Religious authorities control exception domains
   - Sacred texts/clergy determine legitimacy

6. **Mental-Might Oligarchy — Technocracy**
   - Technical experts hold decisive authority
   - Epistemic credentials gate power

7. **Mental-Might Oligarchy — Telecracy**
   - Media/information controllers shape exceptions
   - Narrative power translates to political control

8. **Autocratizing (Executive)**
   - Executive accumulates both pen and eraser across multiple domains
   - Institutional checks weakening but not yet eliminated
   - Triggers Stop-rule B

9. **Autocratizing (Military)**
   - Coercive force launches/escalates conflict without effective checks
   - Security apparatus expanding exception control
   - Triggers Stop-rule A

10. **Personalist Monarchy / Autocracy**
    - Single individual holds decisive authority across domains
    - Personal loyalty supersedes institutional rules

11. **Theocratic Monarchy**
    - Monarch derives authority from sacred sources
    - Religious legitimacy backs personal rule

### E-12 Exception Domains (Three Tiers)

**Tier I: Existential** (typically determines polity type)
- Security (war/peace declarations)
- Civil Liberties (speech, assembly, movement)
- Information Order (media, education content control)

**Tier II: Constitutive** (shapes political order)
- Diplomacy (foreign relations, treaties)
- Justice (courts, enforcement, punishment)
- Economy (fiscal/monetary policy)
- Appointments (who fills key offices)

**Tier III: Contextual** (refines polity subtype)
- Infrastructure (roads, utilities, networks)
- Curricula (what is taught)
- Healthcare (access, standards)
- Immigration (borders, citizenship)
- Environment (pollution, conservation)

### Author/Eraser Roles

Power holders are classified by their relationship to rules and exceptions:

**Author (A)**: Can write or change rules and facts
- Creates new policies
- Alters existing frameworks
- Badge: ✍️ (blue)

**Eraser (E)**: Can credibly veto or provide oversight
- Blocks proposals
- Reverses decisions
- Checks other seats
- Badge: 🛑 (red)

Many seats have both roles (e.g., Legislature authors laws + erases executive overreach).

### Subject-Type Classifications

Power holders are further classified by their relationship to political authority:

| Type | Description | Intensity |
|------|-------------|-----------|
| **Author** | Writes/changes rules across domains | - (weak), • (moderate), + (strong) |
| **Eraser** | Credible veto/oversight power | - (weak), • (moderate), + (strong) |
| **Agent** | Executes decisions made elsewhere | - (weak), • (moderate), + (strong) |
| **Actor** | Autonomous but within constraints | - (weak), • (moderate), + (strong) |
| **Acolyte** | Follower bound by doctrine/ideology | - (weak), • (moderate), + (strong) |
| **Dictator** | Unconstrained personal rule | - (weak), • (moderate), + (strong) |

**Visual Indicators:**
- Strong (+): Purple badge
- Moderate (•): Indigo badge
- Weak (-): Gray badge

### Stop Rules

Automatic classification triggers when power concentration reaches critical thresholds:

**Stop-rule A**: Coercive force launches/escalates war at will without effective checks
→ Classification: **Stratocracy** or **Autocratizing (Military)**

**Stop-rule B**: Executive routinely authors exceptions across multiple domains AND neutralizes erasers
→ Classification: **Autocratizing (Executive)**

### Grounding Context

Analysis includes historical/fictional grounding:

**Setting Type:**
- `real`: Historical or current real-world context
- `fictional`: Fantasy, sci-fi, alternate history
- `unclear`: Ambiguous or insufficient information

**Era**: Time period description (e.g., "Classical Athens, 5th century BCE")

### API Implementation

**Endpoint**: `/api/analyze-role`
**File**: `server/index.mjs` (lines 75-563)
**Model**: `MODEL_ANALYZE` (typically gpt-4o)
**Temperature**: 0.2 (lowered from 0.4 for consistency)

**Request:**
```json
{
  "role": "Emperor of Tang China"
}
```

**Response:**
```json
{
  "systemName": "Theocratic Monarchy",
  "systemDesc": "Monarch derives authority from sacred Mandate of Heaven...",
  "flavor": "Absolute power wrapped in celestial legitimacy.",
  "holders": [
    {
      "name": "Emperor",
      "percent": 70,
      "icon": "👑",
      "note": "Holds Mandate of Heaven; ultimate authority",
      "role": { "A": true, "E": true },
      "stype": { "t": "Dictator", "i": "+" }
    }
    // ... 3-4 more seats
  ],
  "playerIndex": 0,
  "e12": {
    "tierI": ["Security", "CivilLib", "InfoOrder"],
    "tierII": ["Diplomacy", "Justice", "Appointments", "Economy"],
    "tierIII": ["Infrastructure", "Curricula"],
    "stopA": false,
    "stopB": false,
    "decisive": ["Emperor", "Imperial Court"]
  },
  "grounding": {
    "settingType": "real",
    "era": "Tang Dynasty, 8th century CE"
  }
}
```

### Predefined Role Optimization

**Critical**: Predefined roles bypass the API entirely using hardcoded power distributions. This optimization is preserved to avoid unnecessary API calls.

**Implementation**: `src/data/predefinedPowerDistributions.ts`

**Predefined Roles:**
1. Citizen of the Assembly in Classical Athens → Democracy
2. Senator of the Roman Republic → Republican Oligarchy
3. Emperor of Tang China → Theocratic Monarchy
4. Chancellor of Modern Germany → Republican Oligarchy

Each predefined role includes complete E-12 analysis data (role, stype, e12, grounding fields).

### Type System

**PowerHolder Type** (`src/store/roleStore.ts`):
```typescript
export type PowerHolder = {
  name: string;
  percent: number;
  icon?: string;
  note?: string;
  role?: { A: boolean; E: boolean }; // Author/Eraser flags
  stype?: { // Subject-Type classification
    t: "Author" | "Eraser" | "Agent" | "Actor" | "Acolyte" | "Dictator";
    i: "-" | "•" | "+"; // intensity
  };
};
```

**AnalysisResult Type** (`src/store/roleStore.ts`):
```typescript
export type AnalysisResult = {
  systemName: string;
  systemDesc: string;
  flavor: string;
  holders: PowerHolder[];
  playerIndex: number | null;
  e12?: { // Exception-12 analysis
    tierI: string[];
    tierII: string[];
    tierIII: string[];
    stopA: boolean;
    stopB: boolean;
    decisive: string[];
  };
  grounding?: { // Setting context
    settingType: "real" | "fictional" | "unclear";
    era: string;
  };
};
```

### UI Components

**PowerDistributionContent** (`src/components/PowerDistributionContent.tsx`):
- Displays Author/Eraser badges inline with power holder names
- Shows Subject-Type indicators with color-coded intensity
- "View Analysis" button appears when e12Data exists

**E12AnalysisModal** (`src/components/E12AnalysisModal.tsx`):
- Modal overlay showing full E-12 analysis
- Sections: Historical grounding, decisive seats, stop rules, tier breakdown
- Triggered by "View Analysis" button in PowerDistributionContent

**Visual Elements:**
- Author badge: ✍️ (blue background)
- Eraser badge: 🛑 (red background)
- Subject-Type intensity colors: Purple (+), Indigo (•), Gray (-)
- Political system button with HelpCircle icon
- E-12 analysis button with Cog icon (purple theme)

### Migration Notes (2025-10-22)

**Changes from Previous System:**
- Old: 25 political systems with simple classification
- New: 11 polity types based on E-12 framework
- Token cost for custom roles: ~2.7x increase (justified by analytical depth)
- Predefined roles: No change in behavior (still skip API)

**System Name Mappings:**
- "Direct Democracy" → "Democracy"
- "Representative Democracy" → "Republican Oligarchy"
- "Early Republicanism" → "Republican Oligarchy"
- "Absolute Monarchy" → "Personalist Monarchy / Autocracy"
- "Military Dictatorship" → "Hard-Power Oligarchy — Stratocracy"
- "Single-Party State" → "Autocratizing (Executive)"
- etc.

**Backward Compatibility:**
- New fields (role, stype, e12, grounding) are optional in types
- Old saved games without these fields display normally
- UI components check for field existence before rendering badges

**Files Modified:**
- `server/index.mjs` - Complete /api/analyze-role rewrite
- `src/store/roleStore.ts` - Extended PowerHolder and AnalysisResult types
- `src/data/politicalSystems.ts` - Replaced with 11 polities
- `src/data/predefinedPowerDistributions.ts` - Enriched all 4 roles with E-12 data
- `src/components/PowerDistributionContent.tsx` - Added badges and analysis button
- `src/components/E12AnalysisModal.tsx` - New component for detailed analysis
- `src/screens/PowerDistributionScreen.tsx` - Pass e12Data and groundingData props
- `src/screens/RoleSelectionScreen.tsx` - Updated system names
- `src/data/highscores-default.ts` - Updated all 20 entries with new polity names

**Anti-Jargon Rules:**
The E-12 prompt enforces plain modern English:
- Avoid: "ancien régime", "Rechtsstaat", "vanguard party", "corporatism"
- Use: "old order", "rule of law", "elite party", "state-business alliance"
- Target: Readable by modern English speakers without specialized knowledge

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

## Meta Screens (Accessible from Splash Screen)

### Hall of Fame
**Route**: `/highscores`
**Access**: "Hall of Fame" button on SplashScreen
**Features**:
- Displays top 50 highscores in sorted order
- Shows leader avatar, name, political system, compass axes, and score
- Top 3 ranks have special colors (gold, silver, copper)
- Auto-scroll and highlight support via URL parameter
- Back button returns to previous screen

### Book of Achievements
**Route**: `/achievements`
**Access**: "Book of Achievements" button on SplashScreen
**Status**: 🚧 **Under Construction** - Display only, no tracking yet

**Current Implementation** (2025-10-17):
- Achievement database: `src/data/achievements.ts` (7 achievements defined)
- Display screen: `src/screens/AchievementsScreen.tsx`
- Grid layout with animated cards showing icon, title, and description
- Lock icons on all achievements (placeholder for future functionality)
- Info banner indicating feature is under construction

**Defined Achievements**:
- **Dictator's Dilemma**: Complete a full game as a dictator
- **Role Completionist**: Complete the game with all pre-existing roles
- **Unicorn Ruler**: Complete a game as the unicorn king
- **Warmonger**: Trigger a world war during your rule
- **Revolutionary**: Trigger a political system change in your game
- **Fallen Leader**: Get assassinated during your rule
- **Peacemaker**: Sign a peace treaty during your rule

**Future Functionality** (Not Yet Implemented):
- Achievement tracking store
- Unlock logic based on game events
- Locked/unlocked visual states
- Achievement notifications during gameplay
- Persistence across sessions

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

**Recent Cleanup (2025-10-20):**

Completed major cleanup after first prototype completion:

**Deleted Files:**
- `src/screens/AftermathScreen.backup.tsx` - Backup file
- `src/screens/FinalScoreScreen.backup.tsx` - Backup file
- `src/hooks/useEventEffects.ts` - Replaced by EventScreen3 architecture
- `src/components/event/EventContent.tsx` - Not imported anywhere
- `src/components/event/ProgressiveLoadingCard.tsx` - Only used by deleted EventContent
- `src/hooks/useProgressiveLoading.ts` - Legacy loading system
- `src/hooks/useDynamicParameters.ts` - Legacy parameters system
- `src/hooks/useDayProgression.ts` - Legacy progression system

**Removed Server Endpoints:**
- `/api/dilemma` - Heavy dilemma API (~465 lines)
- `/api/support-analyze` - Support analysis for heavy API (~98 lines)
- `/api/mirror-summary` - Old mirror summary with game history (~232 lines)
- Commented `/api/name-suggestions` code (~28 lines)

**Simplified Code:**
- `dilemmaStore.ts` - Removed `buildSnapshot()`, `analyzeEnhancedContext()`, `flattenCompass()`, `flattenCompassOptimized()` (~228 lines)
- `settingsStore.ts` - Removed `useLightDilemma` toggle (light API now only option)
- `useEventDataCollector.ts` - Removed `fetchSupportAnalysis()`, `fetchNews()`, heavy API branch (~68 lines)

**Total Cleanup:** ~1,100+ lines of dead code removed

## Development Guidelines

- **Preserve existing design and functionality** when making changes
- **Ask for confirmation** before making additional changes beyond the task
- **Use optimization patterns** from EventScreen3, PowerDistributionScreen, ActionDeck as models
- **Annotate new code** with clear descriptions and file relationships
- **Update CLAUDE.md** whenever making significant changes
- **Keep dependencies clean** - Review `useEffect` cleanup functions to prevent memory leaks
