Goals System Implementation Plan - Complete Documentation
Table of Contents
Overview
Feasibility Analysis
Architecture Design
Implementation Tasks
Goal Types Specification
Technical Implementation Details
User Experience Flow
File Changes Required
Testing Strategy
Overview
Feature Description
Implement a game goals system where:
At game start, player is presented with 3 randomly-selected goals
Player selects exactly 2 goals to pursue during the game
Goals are visible throughout gameplay with real-time status (met/unmet)
Goals can permanently fail if conditions are violated (e.g., "never drop below X")
At game end, bonus score is awarded for completed goals
Final score and goal completion status are displayed in highscore entry
User-Requested Goal Examples
End game with over 60% support in all three categories (people, middle, mom)
End game with budget above 500
End game with people support over 85%
End game with mom support over 90%
Do not drop below X% support of [entity]
Do not drop below budget of X
Finish a game without using 'choose your own' option
Finish a game using only 'choose your own' option
Feasibility Analysis
✅ Available Data (from stores)
dilemmaStore (persistent):
budget: number - Current budget (starts at 1500, modified by difficulty)
supportPeople: number - Public support (0-100)
supportMiddle: number - Main power holder support (0-100)
supportMom: number - Personal allies support (0-100)
score: number - Current game score
day: number - Current day (1-7 default)
totalDays: number - Total game days (7 default)
difficulty: string - Difficulty level
history: Dilemma[] - Past dilemmas
roleStore (persistent):
selectedRole: string - Player's political role
analysis: AnalysisResult - Political system analysis
character: Character - Player character data
compassStore (persistent):
values: CompassValues - Political compass values
settingsStore (persistent):
enableModifiers: boolean - Whether difficulty modifiers are active
❌ Missing Data (needs implementation)
Custom Action Counter: No tracking of "choose your own" usage
Need: customActionCount: number in dilemmaStore
Increment when player uses "Suggest Your Own" option
Minimum Value Tracking: For "never drop below" goals
Need: minBudget: number, minSupportPeople: number, etc.
Updated after each action confirmation
Goal Storage: No persistence of selected goals
Need: selectedGoals: Goal[] in dilemmaStore
Persisted throughout game session
Game Completion Logic: No hook when day > totalDays
Currently no navigation to highscores after final day
Need completion detection in EventScreen3
Architecture Design
Data Model
// src/data/goals.ts

export type GoalStatus = 'met' | 'unmet' | 'failed';

export type GoalCategory = 
  | 'end-state-support'    // Check final support values
  | 'end-state-budget'     // Check final budget value
  | 'continuous-support'   // Track minimum support throughout
  | 'continuous-budget'    // Track minimum budget throughout
  | 'behavioral';          // Track player behavior patterns

export interface Goal {
  id: string;
  category: GoalCategory;
  title: string;                           // Short title (e.g., "Popular Leader")
  description: string;                     // Full description for selection screen
  shortDescription: string;                // Compact description for in-game panel
  
  // Evaluation function - called after each day
  evaluate: (state: GoalEvaluationState) => GoalStatus;
  
  // Scoring
  scoreBonusOnCompletion: number;         // Bonus points if completed
  
  // Visual
  icon: string;                            // Icon name for display
  color: string;                           // Color theme for the goal
}

export interface GoalEvaluationState {
  // Current values
  day: number;
  totalDays: number;
  budget: number;
  supportPeople: number;
  supportMiddle: number;
  supportMom: number;
  customActionCount: number;
  
  // Minimum values (for "never drop below" goals)
  minBudget: number;
  minSupportPeople: number;
  minSupportMiddle: number;
  minSupportMom: number;
  
  // Context
  difficulty: string | null;
  isGameComplete: boolean;
}

export interface SelectedGoal extends Goal {
  status: GoalStatus;           // Current status
  lastEvaluatedDay: number;     // When last evaluated
}
Store Extensions
// src/store/dilemmaStore.ts - NEW FIELDS

type DilemmaState = {
  // ... existing fields ...
  
  // Goals system
  selectedGoals: SelectedGoal[];
  customActionCount: number;
  
  // Minimum tracking (for continuous goals)
  minBudget: number;
  minSupportPeople: number;
  minSupportMiddle: number;
  minSupportMom: number;
  
  // Goal management
  setGoals: (goals: Goal[]) => void;
  evaluateGoals: () => void;
  incrementCustomActions: () => void;
  updateMinimumValues: () => void;
};
Implementation Tasks
Phase 1: Data Layer (Foundation)
Task 1.1: Create Goals Data (src/data/goals.ts)
Define Goal types and interfaces
Create goal pool with all 15-20 possible goals
Implement evaluation functions for each goal
Create getRandomGoals(count: number): Goal[] utility
Create evaluateGoal(goal: Goal, state: GoalEvaluationState): GoalStatus
Task 1.2: Extend dilemmaStore (src/store/dilemmaStore.ts)
Add new state fields:
selectedGoals: SelectedGoal[]
customActionCount: number
minBudget: number
minSupportPeople: number
minSupportMiddle: number
minSupportMom: number
Add new actions:
setGoals(goals: Goal[])
evaluateGoals()
incrementCustomActions()
updateMinimumValues()
Update reset() to initialize new fields
Update persist middleware to include new fields
Phase 2: UI Components
Task 2.1: Create GoalsSelectionScreen (src/screens/GoalsSelectionScreen.tsx)
Responsibilities:
Display 3 randomly-selected goals from pool
Allow player to select exactly 2 goals
Show current game state for context (budget, support levels)
Validate selection (exactly 2)
Save selected goals to store
Navigate to /event3 on confirmation
UI Layout:
┌─────────────────────────────────────────┐
│  Select Your Goals (2 of 3)             │
│                                         │
│  Current State:                         │
│  Budget: 1500 | Support: 50/50/50       │
│                                         │
│  ┌───────────────────────────────┐     │
│  │ ☐ Goal 1: Popular Leader      │     │
│  │   End with 85%+ people support│     │
│  │   Bonus: +300 points           │     │
│  └───────────────────────────────┘     │
│                                         │
│  ┌───────────────────────────────┐     │
│  │ ☑ Goal 2: Budget Master       │     │
│  │   End with 500+ budget         │     │
│  │   Bonus: +200 points           │     │
│  └───────────────────────────────┘     │
│                                         │
│  ┌───────────────────────────────┐     │
│  │ ☑ Goal 3: Pure Strategist     │     │
│  │   Never use custom actions     │     │
│  │   Bonus: +400 points           │     │
│  └───────────────────────────────┘     │
│                                         │
│         [Confirm Selection]            │
└─────────────────────────────────────────┘
Task 2.2: Create GoalsPanel Component (src/components/event/GoalsPanel.tsx)
Responsibilities:
Display 2 selected goals compactly
Show real-time status (✅ met / ⚠️ at risk / ❌ failed)
Collapsible/expandable for space efficiency
Update after each day
UI Layout (Collapsed):
┌────────────────────────────────────┐
│ Goals [▼]                          │
│ ✅ Budget Master  ❌ Popular Leader│
└────────────────────────────────────┘
UI Layout (Expanded):
┌────────────────────────────────────┐
│ Goals [▲]                          │
│                                    │
│ ✅ Budget Master                   │
│    End with 500+ budget            │
│    Current: 1200 ✓                 │
│                                    │
│ ❌ Popular Leader                  │
│    End with 85%+ people support    │
│    Current: 62% (need 23% more)    │
└────────────────────────────────────┘
Placement: Above DilemmaCard, below ResourceBar
Task 2.3: Create GameCompletionScreen (src/screens/GameCompletionScreen.tsx) [OPTIONAL]
Alternative: Show modal overlay in EventScreen3 Responsibilities:
Display final score
Show goal completion status with animations
Calculate and display bonuses
"View Highscores" button
Auto-navigate after 5 seconds
Phase 3: Game Flow Integration
Task 3.1: Update Navigation Flow
Current flow:
/background-intro → /event3
New flow:
/background-intro → /goals → /event3
Changes needed:
src/screens/BackgroundIntroScreen.tsx: Change push("/event3") to push("/goals")
src/App.tsx: Add route if (route === "/goals") return <GoalsSelectionScreen push={push} />;
Task 3.2: Track Custom Actions
File: src/screens/EventScreen3.tsx Update handleSuggest:
const handleSuggest = (text?: string) => {
  console.log('[EventScreen3] Suggest your own:', text);
  
  // Track custom action usage for goals
  const { incrementCustomActions } = useDilemmaStore.getState();
  incrementCustomActions();
  
  // ActionDeck handles suggestion validation internally
};
Task 3.3: Update Minimum Values After Each Action
File: src/lib/eventDataCleaner.ts Update cleanAndAdvanceDay:
export async function cleanAndAdvanceDay(
  selectedAction: ActionCard,
  clearFlights: () => void
): Promise<void> {
  // ... existing code ...
  
  setBudget(newBudget);
  
  // NEW: Update minimum value tracking for goals
  const { updateMinimumValues } = useDilemmaStore.getState();
  updateMinimumValues();
  
  // ... rest of existing code ...
}
Task 3.4: Evaluate Goals After Each Day
File: src/lib/eventDataCleaner.ts Update cleanAndAdvanceDay (after day advancement):
export async function cleanAndAdvanceDay(
  selectedAction: ActionCard,
  clearFlights: () => void
): Promise<void> {
  // ... existing code ...
  
  nextDay();
  const { day: newDay } = useDilemmaStore.getState();
  console.log(`[Cleaner] Day advanced: ${currentDay} → ${newDay}`);
  
  // NEW: Evaluate goals after day advancement
  const { evaluateGoals } = useDilemmaStore.getState();
  evaluateGoals();
  
  // ... rest of existing code ...
}
Task 3.5: Implement Game Completion Detection
New file: src/lib/gameCompletion.ts
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { useCompassStore } from "../store/compassStore";
import { useHighscoreStore } from "../store/highscoreStore";
import type { HighscoreEntry } from "../data/highscores-default";

export function checkGameCompletion(): boolean {
  const { day, totalDays } = useDilemmaStore.getState();
  return day > totalDays;
}

export function calculateFinalScore(): number {
  const { score, selectedGoals } = useDilemmaStore.getState();
  
  let finalScore = score;
  
  // Add bonuses for completed goals
  selectedGoals.forEach(goal => {
    if (goal.status === 'met') {
      finalScore += goal.scoreBonusOnCompletion;
    }
  });
  
  return finalScore;
}

export function createHighscoreEntry(): HighscoreEntry {
  const dilemmaState = useDilemmaStore.getState();
  const roleState = useRoleStore.getState();
  const compassState = useCompassStore.getState();
  
  // Get top compass values for "values" string
  const values = formatCompassValues(compassState.values);
  
  // Calculate democracy and autonomy rankings
  const democracy = calculateDemocracyLevel(compassState.values);
  const autonomy = calculateAutonomyLevel(compassState.values);
  
  return {
    name: roleState.character?.name || "Anonymous Leader",
    about: generateAboutText(dilemmaState, roleState),
    democracy,
    autonomy,
    values,
    score: calculateFinalScore(),
    politicalSystem: roleState.analysis?.systemName || "Unknown System",
  };
}

export function completeGame(push: (path: string) => void): void {
  // Create and save highscore entry
  const entry = createHighscoreEntry();
  const { addEntry } = useHighscoreStore.getState();
  addEntry(entry);
  
  // Navigate to highscores
  push("/highscores");
  
  // Reset game state for new game
  const { reset: resetDilemma } = useDilemmaStore.getState();
  const { reset: resetRole } = useRoleStore.getState();
  const { reset: resetCompass } = useCompassStore.getState();
  
  // Note: Don't reset immediately - let user view highscores first
  // Consider adding a "New Game" button that triggers resets
}
File: src/screens/EventScreen3.tsx Add game completion detection:
import { checkGameCompletion, completeGame } from "../lib/gameCompletion";

// ... in component ...

// Add effect to check for game completion
useEffect(() => {
  if (checkGameCompletion() && phase === 'collecting') {
    console.log('[EventScreen3] Game complete - navigating to highscores');
    completeGame(push);
  }
}, [phase, day, totalDays, push]);
Phase 4: Visual Integration
Task 4.1: Add GoalsPanel to EventScreen3
File: src/screens/EventScreen3.tsx
import GoalsPanel from "../components/event/GoalsPanel";

// ... in render ...

{/* Goals Panel - shows after presentation starts */}
{presentationStep >= 1 && (
  <GoalsPanel />
)}
Task 4.2: Update HighscoreScreen to Show Goal Completion
File: src/screens/HighscoreScreen.tsx Add goal completion indicators in the table and popup:
Column showing "Goals: 2/2 ✅" or "Goals: 1/2 ⚠️"
Popup shows which goals were completed
Note: Requires extending HighscoreEntry type to include goalsCompleted
Goal Types Specification
End-State Goals (Evaluated on Final Day Only)
1. Balanced Leader
{
  id: 'balanced-leader',
  category: 'end-state-support',
  title: 'Balanced Leader',
  description: 'End the game with over 60% support from all three groups (people, middle, mom)',
  shortDescription: 'All support >60%',
  evaluate: (state) => {
    if (!state.isGameComplete) return 'unmet';
    return (
      state.supportPeople > 60 &&
      state.supportMiddle > 60 &&
      state.supportMom > 60
    ) ? 'met' : 'unmet';
  },
  scoreBonusOnCompletion: 500,
  icon: 'Scale',
  color: 'blue'
}
2. Wealthy Leader
{
  id: 'wealthy-leader',
  category: 'end-state-budget',
  title: 'Wealthy Leader',
  description: 'End the game with a budget above 500',
  shortDescription: 'Budget >500',
  evaluate: (state) => {
    if (!state.isGameComplete) return 'unmet';
    return state.budget > 500 ? 'met' : 'unmet';
  },
  scoreBonusOnCompletion: 300,
  icon: 'DollarSign',
  color: 'green'
}
3. Popular Leader
{
  id: 'popular-leader',
  category: 'end-state-support',
  title: 'Popular Leader',
  description: 'End the game with people support over 85%',
  shortDescription: 'People >85%',
  evaluate: (state) => {
    if (!state.isGameComplete) return 'unmet';
    return state.supportPeople > 85 ? 'met' : 'unmet';
  },
  scoreBonusOnCompletion: 400,
  icon: 'Users',
  color: 'purple'
}
4. Loyal Inner Circle
{
  id: 'loyal-inner-circle',
  category: 'end-state-support',
  title: 'Loyal Inner Circle',
  description: 'End the game with mom (personal allies) support over 90%',
  shortDescription: 'Mom >90%',
  evaluate: (state) => {
    if (!state.isGameComplete) return 'unmet';
    return state.supportMom > 90 ? 'met' : 'unmet';
  },
  scoreBonusOnCompletion: 350,
  icon: 'Heart',
  color: 'pink'
}
Continuous Goals (Can Fail During Game)
5. Never Broke
{
  id: 'never-broke',
  category: 'continuous-budget',
  title: 'Never Broke',
  description: 'Never let your budget drop below 500 at any point',
  shortDescription: 'Budget never <500',
  evaluate: (state) => {
    if (state.minBudget < 500) return 'failed';
    if (state.isGameComplete && state.minBudget >= 500) return 'met';
    return 'unmet';
  },
  scoreBonusOnCompletion: 600,
  icon: 'TrendingUp',
  color: 'gold'
}
6. People's Champion
{
  id: 'peoples-champion',
  category: 'continuous-support',
  title: "People's Champion",
  description: 'Never let people support drop below 50%',
  shortDescription: 'People never <50%',
  evaluate: (state) => {
    if (state.minSupportPeople < 50) return 'failed';
    if (state.isGameComplete && state.minSupportPeople >= 50) return 'met';
    return 'unmet';
  },
  scoreBonusOnCompletion: 450,
  icon: 'Shield',
  color: 'blue'
}
7. Power Broker
{
  id: 'power-broker',
  category: 'continuous-support',
  title: 'Power Broker',
  description: 'Never let middle (main power holder) support drop below 40%',
  shortDescription: 'Middle never <40%',
  evaluate: (state) => {
    if (state.minSupportMiddle < 40) return 'failed';
    if (state.isGameComplete && state.minSupportMiddle >= 40) return 'met';
    return 'unmet';
  },
  scoreBonusOnCompletion: 400,
  icon: 'Building2',
  color: 'indigo'
}
Behavioral Goals
8. Pure Strategist
{
  id: 'pure-strategist',
  category: 'behavioral',
  title: 'Pure Strategist',
  description: 'Complete the game without using the "Suggest Your Own" option even once',
  shortDescription: 'No custom actions',
  evaluate: (state) => {
    if (state.customActionCount > 0) return 'failed';
    if (state.isGameComplete && state.customActionCount === 0) return 'met';
    return 'unmet';
  },
  scoreBonusOnCompletion: 700,
  icon: 'Target',
  color: 'red'
}
9. Creative Maverick
{
  id: 'creative-maverick',
  category: 'behavioral',
  title: 'Creative Maverick',
  description: 'Complete the game using ONLY the "Suggest Your Own" option (every single day)',
  shortDescription: 'Only custom actions',
  evaluate: (state) => {
    const expectedActions = state.day - 1; // Day 1 = 0 actions taken
    if (state.customActionCount < expectedActions) return 'failed';
    if (state.isGameComplete && state.customActionCount === state.totalDays) return 'met';
    return 'unmet';
  },
  scoreBonusOnCompletion: 800,
  icon: 'Zap',
  color: 'yellow'
}
Additional Goal Ideas
10. Frugal Leader
{
  id: 'frugal-leader',
  category: 'end-state-budget',
  title: 'Frugal Leader',
  description: 'End with more budget than you started with',
  shortDescription: 'Budget > starting',
  evaluate: (state) => {
    const startingBudget = getStartingBudget(state.difficulty);
    if (!state.isGameComplete) return 'unmet';
    return state.budget > startingBudget ? 'met' : 'unmet';
  },
  scoreBonusOnCompletion: 550,
  icon: 'Award',
  color: 'green'
}
11. Consensus Builder
{
  id: 'consensus-builder',
  category: 'end-state-support',
  title: 'Consensus Builder',
  description: 'End with all three support levels within 15% of each other',
  shortDescription: 'All support ±15%',
  evaluate: (state) => {
    if (!state.isGameComplete) return 'unmet';
    const max = Math.max(state.supportPeople, state.supportMiddle, state.supportMom);
    const min = Math.min(state.supportPeople, state.supportMiddle, state.supportMom);
    return (max - min) <= 15 ? 'met' : 'unmet';
  },
  scoreBonusOnCompletion: 450,
  icon: 'Activity',
  color: 'teal'
}
12. Risk Taker
{
  id: 'risk-taker',
  category: 'continuous-budget',
  title: 'Risk Taker',
  description: 'Have your budget drop below 100 at some point, but recover to end above 800',
  shortDescription: 'Drop <100, end >800',
  evaluate: (state) => {
    if (!state.isGameComplete) {
      return state.minBudget < 100 ? 'unmet' : 'unmet';
    }
    return (state.minBudget < 100 && state.budget > 800) ? 'met' : 'unmet';
  },
  scoreBonusOnCompletion: 900,
  icon: 'Flame',
  color: 'orange'
}
Technical Implementation Details
Goal Evaluation Engine
// src/lib/goalEvaluation.ts

import type { Goal, GoalStatus, GoalEvaluationState, SelectedGoal } from "../data/goals";
import { useDilemmaStore } from "../store/dilemmaStore";

/**
 * Build evaluation state from current game state
 */
export function buildEvaluationState(): GoalEvaluationState {
  const state = useDilemmaStore.getState();
  
  return {
    day: state.day,
    totalDays: state.totalDays,
    budget: state.budget,
    supportPeople: state.supportPeople,
    supportMiddle: state.supportMiddle,
    supportMom: state.supportMom,
    customActionCount: state.customActionCount,
    minBudget: state.minBudget,
    minSupportPeople: state.minSupportPeople,
    minSupportMiddle: state.minSupportMiddle,
    minSupportMom: state.minSupportMom,
    difficulty: state.difficulty,
    isGameComplete: state.day > state.totalDays,
  };
}

/**
 * Evaluate a single goal
 */
export function evaluateGoal(goal: Goal, state: GoalEvaluationState): GoalStatus {
  try {
    return goal.evaluate(state);
  } catch (error) {
    console.error(`[GoalEvaluation] Error evaluating goal ${goal.id}:`, error);
    return 'unmet';
  }
}

/**
 * Evaluate all selected goals and update their status
 */
export function evaluateAllGoals(goals: SelectedGoal[]): SelectedGoal[] {
  const state = buildEvaluationState();
  
  return goals.map(goal => ({
    ...goal,
    status: evaluateGoal(goal, state),
    lastEvaluatedDay: state.day,
  }));
}

/**
 * Get display info for a goal status
 */
export function getStatusDisplay(status: GoalStatus): {
  icon: string;
  color: string;
  label: string;
} {
  switch (status) {
    case 'met':
      return { icon: '✅', color: 'text-green-500', label: 'Met' };
    case 'failed':
      return { icon: '❌', color: 'text-red-500', label: 'Failed' };
    case 'unmet':
    default:
      return { icon: '⚠️', color: 'text-yellow-500', label: 'In Progress' };
  }
}
Store Implementation Details
// src/store/dilemmaStore.ts - Implementation details for new fields

// In the store creation:
export const useDilemmaStore = create<DilemmaState>()(
  persist(
    (set, get) => ({
      // ... existing fields ...
      
      // Goals system - NEW
      selectedGoals: [],
      customActionCount: 0,
      minBudget: 1500,
      minSupportPeople: 50,
      minSupportMiddle: 50,
      minSupportMom: 50,
      
      // ... existing methods ...
      
      setGoals(goals) {
        const selectedGoals = goals.map(g => ({
          ...g,
          status: 'unmet' as GoalStatus,
          lastEvaluatedDay: 0,
        }));
        set({ selectedGoals });
        dlog("setGoals ->", goals.map(g => g.id));
      },
      
      evaluateGoals() {
        const { selectedGoals } = get();
        if (selectedGoals.length === 0) return;
        
        const updatedGoals = evaluateAllGoals(selectedGoals);
        set({ selectedGoals: updatedGoals });
        dlog("evaluateGoals ->", updatedGoals.map(g => `${g.id}: ${g.status}`));
      },
      
      incrementCustomActions() {
        const { customActionCount } = get();
        const newCount = customActionCount + 1;
        set({ customActionCount: newCount });
        dlog("incrementCustomActions ->", newCount);
      },
      
      updateMinimumValues() {
        const state = get();
        set({
          minBudget: Math.min(state.minBudget, state.budget),
          minSupportPeople: Math.min(state.minSupportPeople, state.supportPeople),
          minSupportMiddle: Math.min(state.minSupportMiddle, state.supportMiddle),
          minSupportMom: Math.min(state.minSupportMom, state.supportMom),
        });
        dlog("updateMinimumValues -> budget:", state.minBudget, "people:", state.minSupportPeople);
      },
      
      reset() {
        // ... existing reset code ...
        set({
          // ... existing resets ...
          selectedGoals: [],
          customActionCount: 0,
          minBudget: 1500,
          minSupportPeople: 50,
          minSupportMiddle: 50,
          minSupportMom: 50,
        });
      },
    }),
    {
      name: "amaze-politics-dilemma-store",
      // Persist goals and tracking data
      partialize: (s) => ({
        // ... existing persisted fields ...
        selectedGoals: s.selectedGoals,
        customActionCount: s.customActionCount,
        minBudget: s.minBudget,
        minSupportPeople: s.minSupportPeople,
        minSupportMiddle: s.minSupportMiddle,
        minSupportMom: s.minSupportMom,
      }),
    }
  )
);
Difficulty-Aware Starting Values
// src/lib/goalHelpers.ts

export function getStartingBudget(difficulty: string | null): number {
  const modifiers = {
    "baby-boss": 1750,    // 1500 + 250
    "freshman": 1500,      // 1500 + 0
    "tactician": 1250,     // 1500 - 250
    "old-fox": 1000,       // 1500 - 500
  };
  
  return modifiers[difficulty as keyof typeof modifiers] || 1500;
}

export function getStartingSupport(difficulty: string | null): number {
  const modifiers = {
    "baby-boss": 60,      // 50 + 10
    "freshman": 50,       // 50 + 0
    "tactician": 40,      // 50 - 10
    "old-fox": 30,        // 50 - 20
  };
  
  return modifiers[difficulty as keyof typeof modifiers] || 50;
}
User Experience Flow
Complete Game Flow with Goals
1. Splash Screen
   ↓
2. Role Selection
   ↓
3. Power Distribution Analysis
   ↓
4. [If enableModifiers] Difficulty Selection
   ↓
5. Compass Introduction
   ↓
6. Mirror Dialogue
   ↓
7. Compass Quiz
   ↓
8. Name & Avatar
   ↓
9. Background Intro
   ↓
10. 🆕 GOALS SELECTION (new step)
    - Present 3 random goals
    - Player selects exactly 2
    - Show current starting state
    ↓
11. Event Screen (Day 1)
    - Goals panel visible (collapsed by default)
    - Shows goal status
    ↓
12. Event Screens (Days 2-7)
    - Goals evaluated after each action
    - Status updates in real-time
    - "Failed" goals turn red permanently
    ↓
13. 🆕 GAME COMPLETION (after Day 7)
    - Evaluate final goal status
    - Calculate bonuses
    - Create highscore entry
    - Navigate to highscores
    ↓
14. Highscore Screen
    - Show player's entry (highlighted)
    - Display goal completion status
    - "New Game" button
Goals Selection Screen UX
State Context Display:
Your Starting State:
Budget: 1250 💰
Support: People 40% | Middle 40% | Mom 40%
Difficulty: Tactician
Goal Cards:
Large, tappable cards
Checkmark appears on selection
Disabled state when 2 already selected
Hover shows full description
Color-coded by category
Validation:
"Confirm" button disabled until exactly 2 selected
Clear visual feedback on selection count
Toast/message if trying to proceed with wrong count
In-Game Goals Panel UX
Collapsed State (Default):
Single line showing both goals with icons
Quick status glance (✅/⚠️/❌)
Doesn't obstruct main gameplay
Expanded State (On Click):
Full goal descriptions
Current vs. target values
Progress indicators
Helpful tips if close to failing
Status Colors:
🟢 Green (✅): Goal met or on track
🟡 Yellow (⚠️): Goal at risk (within 10% of threshold)
🔴 Red (❌): Goal permanently failed
Game Completion UX
Option A: Modal Overlay
┌─────────────────────────────────────┐
│         Game Complete! 🎉          │
│                                     │
│  Final Score: 2,450 points         │
│                                     │
│  Goals Completed:                   │
│  ✅ Budget Master        (+300)    │
│  ❌ Popular Leader       (+0)      │
│                                     │
│  Total Bonuses: +300               │
│  FINAL SCORE: 2,750                │
│                                     │
│     [View Highscores]              │
│                                     │
│  Auto-redirecting in 5s...         │
└─────────────────────────────────────┘
Option B: Dedicated Screen Similar content but as full screen with more animations and detail.
File Changes Required
New Files to Create
src/data/goals.ts (~300 lines)
Goal type definitions
Complete goal pool (12-15 goals)
Evaluation functions
Utility functions
src/lib/goalEvaluation.ts (~150 lines)
Evaluation engine
State builder
Status helpers
src/lib/goalHelpers.ts (~100 lines)
Difficulty-aware calculations
Starting value getters
Goal filtering/selection logic
src/lib/gameCompletion.ts (~200 lines)
Completion detection
Score calculation
Highscore entry creation
Reset logic
src/screens/GoalsSelectionScreen.tsx (~400 lines)
Goal selection UI
Validation
State display
src/components/event/GoalsPanel.tsx (~250 lines)
Collapsed/expanded states
Real-time status display
Progress indicators
src/components/event/GameCompletionModal.tsx (~200 lines) [OPTIONAL]
Completion celebration
Score breakdown
Auto-redirect
Files to Modify
src/store/dilemmaStore.ts
Add new state fields (6 fields)
Add new methods (4 methods)
Update reset()
Update persist config
src/screens/BackgroundIntroScreen.tsx
Change navigation target from /event3 to /goals
src/App.tsx
Add route for /goals
src/screens/EventScreen3.tsx
Add GoalsPanel component
Add game completion detection
Update handleSuggest to track custom actions
src/lib/eventDataCleaner.ts
Add updateMinimumValues() call
Add evaluateGoals() call
src/screens/HighscoreScreen.tsx [OPTIONAL]
Add goal completion column
Update popup to show goals
src/data/highscores-default.ts [OPTIONAL]
Extend HighscoreEntry type with goalsCompleted field
CLAUDE.md
Document goals system
Update screen flow diagram
Add new store fields
Testing Strategy
Unit Tests (if implementing)
Goal Evaluation Tests
Each goal's evaluate function
Edge cases (exactly at threshold, boundary conditions)
Different difficulty levels
State Management Tests
setGoals() updates correctly
incrementCustomActions() increments
updateMinimumValues() tracks minimums
evaluateGoals() updates status
Score Calculation Tests
Bonuses applied correctly
Multiple goal completion
Partial completion
Manual Testing Checklist
Goal Selection Flow
 Can select exactly 2 goals
 Cannot select 1 or 3
 Confirm button disabled until 2 selected
 Navigation proceeds to /event3
 Selected goals persist in store
In-Game Goal Tracking
 Goals panel displays correctly
 Collapse/expand works
 Status updates after each action
 Failed goals turn red and stay red
 Met goals turn green
Continuous Goal Failure
 "Never drop below" goals fail when violated
 Once failed, stay failed
 Other goal can still be met
Behavioral Goals
 Pure Strategist fails on first custom action
 Creative Maverick requires all days custom
 Custom action counter increments correctly
Game Completion
 Completion detected after final day
 Final evaluation runs correctly
 Score bonuses applied
 Highscore entry created
 Navigation to /highscores works
Persistence
 Goals survive page refresh
 Custom action count persists
 Minimum values persist
 Goal status persists
Difficulty Integration
 Starting values reflect difficulty
 Goal thresholds make sense per difficulty
 Baby Boss goals easier to achieve
 Old Fox goals very challenging
Additional Considerations
Balancing
Score Bonuses:
Easy goals (e.g., "Budget >500"): 200-300 points
Medium goals (e.g., "All support >60%"): 400-500 points
Hard goals (e.g., "Pure Strategist"): 600-800 points
Very hard goals (e.g., "Creative Maverick"): 800-1000 points
Difficulty Scaling: Goals should be:
Very achievable on Baby Boss (80% success rate)
Challenging on Freshman (50% success rate)
Difficult on Tactician (30% success rate)
Very hard on Old Fox (15% success rate)
Accessibility
Clear visual indicators (not just color)
Screen reader friendly status text
Keyboard navigation in goal selection
Touch-friendly tap targets (min 44x44px)
Performance
Goals evaluation is synchronous (not async)
Evaluation runs once per day (not per render)
Use React.memo for GoalsPanel to prevent unnecessary re-renders
Persist only necessary goal data (not full evaluation history)
Future Enhancements
More Goals: Expand pool to 20-30 goals
Achievement System: Track all-time goal completions
Dynamic Goals: Goals that change based on player's political system
Secret Goals: Hidden goals that reveal when met
Difficulty-Specific Goals: Some goals only available at certain difficulties
Combo Goals: Bonus for completing complementary goals together
Summary
This implementation plan provides a complete roadmap for adding a robust, engaging goals system to Amaze Politics. The system: ✅ Is fully feasible with existing store architecture ✅ Requires minimal refactoring of existing code ✅ Enhances replayability significantly ✅ Integrates cleanly into current game flow ✅ Adds strategic depth to player decisions ✅ Provides clear progression and achievement tracking Estimated Implementation Time:
Phase 1 (Data Layer): 4-6 hours
Phase 2 (UI Components): 6-8 hours
Phase 3 (Integration): 4-6 hours
Phase 4 (Polish & Testing): 3-4 hours
Total: 17-24 hours (2-3 days of focused development)
Recommended Implementation Order:
Data layer (goals.ts, goalEvaluation.ts, store updates)
GoalsSelectionScreen (to test goal selection)
Store tracking (custom actions, minimums)
GoalsPanel (to see real-time updates)
Game completion logic
Polish and testing
This plan is ready for immediate implementation! 🚀