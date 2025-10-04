# EventScreen3 Plan - UPDATED with Global State Management

## ✅ Current State Analysis

Everything is centralized in `dilemmaStore.ts`:

### **Global State (Already Exists)**
```typescript
// src/store/dilemmaStore.ts (lines 34-57, 85-118)
{
  day: number;              // Current day (1, 2, 3...)
  totalDays: number;        // Total days (default: 7)
  budget: number;           // Current budget (default: 1500)
  supportPeople: number;    // 0-100 (default: 50)
  supportMiddle: number;    // 0-100 (default: 50)
  supportMom: number;       // 0-100 (default: 50)
  score: number;            // Current score (default: 0)
  
  // Setters (with validation & debug logging)
  nextDay();                // Advances day by 1
  setBudget(n);             // Updates budget
  setSupportPeople(n);      // Updates support (clamped 0-100)
  setSupportMiddle(n);      // Updates support (clamped 0-100)
  setSupportMom(n);         // Updates support (clamped 0-100)
  setScore(n);              // Updates score
}
"Days Left" Calculation
// EventScreen2.tsx line 135
const daysLeft = totalDays - day + 1;
// Example: totalDays=7, day=1 → daysLeft=7
//          totalDays=7, day=2 → daysLeft=6
//          totalDays=7, day=7 → daysLeft=1
Current Implementation Issues
❌ EventScreen2 makes LOCAL copies (lines 123-124):
const [supportItems, setSupportItems] = useState<any[]>([]);
const [supportChanges, setSupportChanges] = useState<any[]>([]);
This creates dual state - both local and global! Causes sync issues. ❌ Budget updates happen OUTSIDE the store (line 500):
const { setBudget } = useDilemmaStore.getState();
setBudget(budget + action.cost);
This is correct but happens in the component, not in a centralized function.
🎯 Updated Plan: Single Source of Truth
Principle: ONLY dilemmaStore manages game state
EventScreen3 will NEVER create local state for:
Days (always read from day, totalDays)
Budget (always read from budget)
Support values (always read from supportPeople, supportMiddle, supportMom)
Components only read from store and call setters to update.
Updated Architecture
EventDataCollector (Revised)
Changes from original plan:
Accepts context from dilemmaStore - no local state
Returns only AI-generated data - doesn't return budget/support (already in store)
Reads day to determine what to collect
type CollectorContext = {
  day: number;              // from dilemmaStore
  totalDays: number;        // from dilemmaStore
  lastChoice: DilemmaAction | null;  // from dilemmaStore
  supportPeople: number;    // from dilemmaStore
  supportMiddle: number;    // from dilemmaStore
  supportMom: number;       // from dilemmaStore
};

type CollectedData = {
  // AI-generated data only (not global state)
  supportEffects: SupportEffect[] | null;  // Support CHANGES (deltas)
  newsItems: NewsItem[];
  dilemma: Dilemma;
  mirrorText: string;
  compassPills: CompassPill[];  // Only on day 2+
  dynamicParams: ParamItem[];   // Only on day 2+
  errors: Record<string, Error>;
};

async function collectEventData(context: CollectorContext): Promise<CollectedData> {
  const { day, lastChoice } = context;
  
  // Phase 1: Independent parallel requests
  const phase1Results = await Promise.allSettled([
    day > 1 && lastChoice ? analyzeSupportChanges(lastChoice, context) : null,
    fetchNewsTicker(context),
    ensureDilemmaLoaded(context),  // May call loadNext() if needed
  ]);
  
  // Phase 2: Dependent requests (need dilemma first)
  const { current: dilemma } = useDilemmaStore.getState();
  const phase2Results = await Promise.allSettled([
    fetchMirrorText(dilemma, context),
    day > 1 && lastChoice ? fetchCompassPills(lastChoice) : null,
    day > 1 && lastChoice ? fetchDynamicParameters(lastChoice, context) : null,
  ]);
  
  return {
    supportEffects: phase1Results[0] || null,
    newsItems: phase2Results[1] || [],
    dilemma: dilemma!,
    mirrorText: phase2Results[0] || "...",
    compassPills: phase2Results[1] || [],
    dynamicParams: phase2Results[2] || [],
    errors: {}
  };
}
Key Change: supportEffects contains DELTAS (changes), not absolute values. Absolute values are in dilemmaStore.
EventDataPresenter (Revised)
Changes from original plan:
Reads budget/support from store - no props needed
Applies support deltas to store during presentation
Calculates daysLeft on the fly
async function presentEventData(
  collectedData: CollectedData,
  setPresentationStep: (n: number) => void
) {
  // Step 0: ResourceBar (always visible)
  // Reads: useDilemmaStore(s => ({ day, totalDays, budget }))
  // Calculates: daysLeft = totalDays - day + 1
  setPresentationStep(0);
  await delay(300);
  
  // Step 1: SupportList
  // Reads: useDilemmaStore(s => ({ supportPeople, supportMiddle, supportMom }))
  setPresentationStep(1);
  await delay(500);
  
  // Step 2: Support Changes Animation (day 2+ only)
  if (collectedData.supportEffects && collectedData.supportEffects.length > 0) {
    // APPLY DELTAS TO STORE HERE
    const { setSupportPeople, setSupportMiddle, setSupportMom } = useDilemmaStore.getState();
    const { supportPeople, supportMiddle, supportMom } = useDilemmaStore.getState();
    
    collectedData.supportEffects.forEach(effect => {
      if (effect.id === 'people') {
        setSupportPeople(supportPeople + effect.delta);
      } else if (effect.id === 'middle') {
        setSupportMiddle(supportMiddle + effect.delta);
      } else if (effect.id === 'mom') {
        setSupportMom(supportMom + effect.delta);
      }
    });
    
    setPresentationStep(2);
    await delay(1200);  // Time to show delta animations
  }
  
  // Step 3: NewsTicker
  setPresentationStep(3);
  await delay(800);
  
  // ... continue with steps 4-7 (PlayerStatusStrip, DilemmaCard, MirrorCard, ActionDeck)
}
Key Change: Support updates happen inside the presenter when we're ready to show them, not in the collector.
EventDataCleaner (Revised)
Changes from original plan:
Updates budget in store immediately
Calls nextDay() on store instead of local state
Saves choice via applyChoice() to store
async function cleanAndAdvance(
  selectedAction: ActionCard,
  triggerCoinFlight: (from: Point, to: Point) => void,
  clearFlights: () => void
): Promise<void> {
  // 1. Save choice to store
  const { applyChoice } = useDilemmaStore.getState();
  applyChoice(selectedAction.id as 'a' | 'b' | 'c');
  
  // 2. Update budget in store immediately
  const { budget, setBudget } = useDilemmaStore.getState();
  setBudget(budget + selectedAction.cost);
  
  // 3. Trigger coin animation
  const from = getActionCardCenter(selectedAction.id);
  const to = getBudgetAnchorRect();
  if (from && to) {
    triggerCoinFlight(from, to);
  }
  
  // 4. Wait for coin animation (1200ms)
  await delay(1200);
  
  // 5. Clean up coin flights
  clearFlights();
  
  // 6. Advance day in store
  const { nextDay } = useDilemmaStore.getState();
  nextDay();
  
  // 7. Return (EventScreen3 will re-trigger collector on next render)
}
Key Change: All store updates use the official setters. nextDay() increments day and resets lastChoice (line 186).
EventScreen3 Component (Revised)
State management:
export default function EventScreen3() {
  // READ ONLY from store - NEVER duplicate in local state
  const { 
    day, 
    totalDays, 
    budget, 
    supportPeople, 
    supportMiddle, 
    supportMom,
    current,
    lastChoice 
  } = useDilemmaStore();
  
  // Local UI state ONLY (not game state)
  const [currentStage, setCurrentStage] = useState<'collecting' | 'presenting' | 'interacting' | 'cleaning'>('collecting');
  const [collectedData, setCollectedData] = useState<CollectedData | null>(null);
  const [presentationStep, setPresentationStep] = useState(-1);
  
  // Coin flight system (UI state, not game state)
  const { flights, triggerCoinFlight, clearFlights } = useCoinFlights();
  
  // Calculate derived values on the fly
  const daysLeft = totalDays - day + 1;
  
  // ... rest of component
}
Effect to run collector when day changes:
useEffect(() => {
  if (currentStage === 'collecting') {
    const context = {
      day,
      totalDays,
      lastChoice,
      supportPeople,
      supportMiddle,
      supportMom
    };
    
    collectEventData(context)
      .then(data => {
        setCollectedData(data);
        setCurrentStage('presenting');
        presentEventData(data, setPresentationStep);
      });
  }
}, [currentStage, day]);  // Triggers when day changes OR when we enter 'collecting' stage
Action confirmation handler:
const handleActionConfirm = async (actionId: string) => {
  const action = current?.actions.find(a => a.id === actionId);
  if (!action) return;
  
  setCurrentStage('cleaning');
  
  await cleanAndAdvance(
    action,
    triggerCoinFlight,
    clearFlights
  );
  
  // After cleaning, day has advanced in store
  // Set stage back to 'collecting' to trigger new cycle
  setCurrentStage('collecting');
  setPresentationStep(-1);
  setCollectedData(null);
};
Updated File Structure
src/
  screens/
    EventScreen3.tsx                 # Main component (~180 lines)
  lib/
    eventDataCollector.ts            # Collects AI data (~220 lines)
    eventDataPresenter.ts            # Presents + applies deltas (~120 lines)
    eventDataCleaner.ts              # Cleans + advances day (~80 lines)
  types/
    eventData.ts                     # TypeScript types (~60 lines)
  store/
    dilemmaStore.ts                  # UNCHANGED (already perfect!)
Key Principles Summary
✅ DO:
Read day, totalDays, budget, support* from useDilemmaStore()
Call setBudget(), setSupportPeople(), etc. to update
Call nextDay() to advance day
Calculate daysLeft = totalDays - day + 1 when needed
Keep only UI state local (presentation step, loading stage, collected AI data)
❌ DON'T:
Create local state for budget (useState<number>)
Create local state for support values
Create local state for day/totalDays
Manually increment day (use nextDay())
Update budget/support outside the store
Data Flow Diagram
[User confirms action]
         ↓
   EventDataCleaner
         ↓
   Updates: budget ─────→ dilemmaStore.setBudget()
            choice ─────→ dilemmaStore.applyChoice()
            day ────────→ dilemmaStore.nextDay()
         ↓
   [Coin animation 1200ms]
         ↓
   Set stage = 'collecting'
         ↓
   EventDataCollector
         ↓
   Reads: day, totalDays, lastChoice, support* from dilemmaStore
         ↓
   Collects AI data (support DELTAS, news, dilemma, mirror, params)
         ↓
   EventDataPresenter
         ↓
   Step 2: Apply support DELTAS ─→ dilemmaStore.setSupport*()
         ↓
   Steps 3-7: Show UI sequentially (reading from dilemmaStore)
         ↓
   Set stage = 'interacting'
         ↓
   [User confirms next action] → Loop
Testing Checklist
✅ Day advances correctly (7 days left → 6 → 5...)
✅ Budget updates immediately on confirm
✅ Support values update during presentation step 2
✅ No duplicate state between local and store
✅ Day 1: No support analysis, no dynamic params
✅ Day 2+: Full analysis with previous choice context
✅ Coin animation completes before cleaning
✅ ResourceBar always shows current budget/daysLeft from store
✅ SupportList always shows current support from store