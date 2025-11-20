# Data Logging System

Comprehensive data logging system for research analysis.

**⚠️ MANDATORY**: When adding or modifying ANY feature, ALWAYS integrate logging.

---

## Table of Contents

1. [Logging Architecture](#logging-architecture)
2. [Logging Hooks](#logging-hooks)
3. [Integration Guidelines](#integration-guidelines)
4. [File-Specific Patterns](#file-specific-patterns)
5. [Testing & Debugging](#testing--debugging)
6. [Recent Improvements](#recent-improvements-nov-2024)

---

## Logging Architecture

### Core Components

| Component | Purpose | File |
|-----------|---------|------|
| **useLogger** | Player actions | `src/hooks/useLogger.ts` |
| **useTimingLogger** | Timing measurements | `src/hooks/useTimingLogger.ts` |
| **useAIOutputLogger** | AI-generated content | `src/hooks/useAIOutputLogger.ts` |
| **useSessionLogger** | Session lifecycle | `src/hooks/useSessionLogger.ts` |
| **useStateChangeLogger** | Automatic state tracking | `src/hooks/useStateChangeLogger.ts` |
| **loggingService** | Core service | `src/lib/loggingService.ts` |
| **loggingStore** | Zustand store | `src/store/loggingStore.ts` |
| **Backend** | MongoDB storage | `server/api/logging.mjs` |

---

### Log Structure

Every log entry follows this schema:

```typescript
{
  timestamp: Date;
  userId: string;                  // Anonymous UUID
  sessionId: string;               // Per-game session
  gameVersion: string;             // From package.json
  treatment: string;               // Experiment treatment (fullAutonomy/semiAutonomy/noAutonomy)
  source: 'player' | 'system';     // Who initiated the event
  action: string;                  // Event name (e.g., "button_click_start")
  value: any;                      // Event data (string/number/boolean/object)
  currentScreen: string;           // Route (e.g., "/event")
  day: number;                     // Game day (1-7, or 0 if N/A)
  role: string;                    // Selected role title
  comments: string;                // Human-readable description
}
```

---

### Storage & Transmission

**Client-Side**:
- Queue in memory + localStorage backup
- Auto-flush: Every 5 seconds OR 50 logs
- Retry logic: Exponential backoff (1s → 2s → 4s → 8s → 16s max)

**Server-Side**:
- MongoDB (if `ENABLE_DATA_COLLECTION=true`)
- Batch endpoint: `/api/log/batch` (max 50 logs per request)
- Session endpoint: `/api/log/session/start`

**Environment Variable**:
```bash
ENABLE_DATA_COLLECTION=true
MONGODB_URI=mongodb://...
```

---

## Logging Hooks

### 1. useLogger

**Purpose**: Log player interactions and system events

**Usage**:
```typescript
import { useLogger } from '@/hooks/useLogger';

const logger = useLogger();

// Player action
logger.log('button_click_start',
  { buttonId: 'start', screen: '/splash' },
  'User clicked start button'
);

// System event
logger.logSystem('dilemma_generated',
  { title: dilemma.title, actionCount: 3 },
  `Dilemma generated: ${dilemma.title}`
);
```

**Methods**:
- `log(action, value, comments)` - Player events (source: 'player')
- `logSystem(action, value, comments)` - System events (source: 'system')

**Required Logging**:
- All button clicks
- All text inputs (with character counts)
- All form submissions
- All modal open/close events
- All navigation events

---

### 2. useTimingLogger

**Purpose**: Track timing measurements

**Usage**:
```typescript
import { useTimingLogger } from '@/hooks/useTimingLogger';

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

**Required Timing**:
- Decision time (dilemma presented → action confirmed)
- Typing duration (input focused → text submitted)
- Session duration (game start → game end)
- Screen time (screen entered → screen exited)

---

### 3. useAIOutputLogger

**Purpose**: Log all AI-generated content

**Usage**:
```typescript
import { useAIOutputLogger } from '@/hooks/useAIOutputLogger';

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

// Log compass hints
aiLogger.logCompassHints(compassHints);

// Log dynamic parameters
aiLogger.logDynamicParams(dynamicParams);

// Log corruption shift
aiLogger.logCorruptionShift(delta, reason);
```

**Required AI Logging**:
- Dilemma generation (title, description, actions, topic, scope)
- Mirror advice (text, length)
- Support shifts (deltas, explanations)
- Compass hints (value changes)
- Dynamic parameters (consequences)
- Corruption shifts (delta, reason)
- Narrative seeds (story threads)
- Inquiry responses (questions, answers)
- Custom action validation (approval/rejection)

---

### 4. useSessionLogger

**Purpose**: Track session lifecycle

**Usage**:
```typescript
import { useSessionLogger } from '@/hooks/useSessionLogger';

const sessionLogger = useSessionLogger();

// Start session
sessionLogger.start({
  role: 'Athens Citizen',
  treatment: 'semiAutonomy'
});

// End session
sessionLogger.end({
  duration: 1234567,
  finalScore: 850,
  totalInquiries: 5,
  totalCustomActions: 12
});

// Log screen change
sessionLogger.logScreenChange('/event', '/aftermath');
```

**Global Setup**:
```typescript
// In App.tsx
useSessionLogger(); // Automatically tracks tab visibility
```

---

### 5. useStateChangeLogger

**Purpose**: Automatically log all Zustand store changes

**Tracked Changes**:
- Support values (people, middle, mom)
- Budget changes
- Corruption level changes
- Compass value changes (logs component names, not indices)
- Score changes
- Day progression
- Goal status changes
- Crisis mode changes
- Treatment changes

**Global Setup**:
```typescript
// In App.tsx
useStateChangeLogger(); // That's it! No manual logging needed
```

**Note**: Logs component names (e.g., "Care +2") instead of indices (e.g., "what[6]: +2")

---

## Integration Guidelines

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

---

### Common Patterns

#### Button Click
```typescript
const logger = useLogger();

<button onClick={() => {
  logger.log('button_click_start',
    { buttonId: 'start' },
    'User clicked start button'
  );
  handleStart();
}}>
  Start
</button>
```

#### Text Input Submission
```typescript
const logger = useLogger();
const timingLogger = useTimingLogger();

// On focus
const timingId = useRef<string>();
const handleFocus = () => {
  timingId.current = timingLogger.start('typing_duration', {});
};

// On submit
const handleSubmit = (text: string) => {
  const duration = timingLogger.end(timingId.current!, {
    charCount: text.length
  });

  logger.log('custom_action_submitted', {
    text,
    charCount: text.length,
    typingDuration: duration
  }, `Custom action submitted (${text.length} chars, ${duration}ms)`);
};
```

#### Modal Open/Close
```typescript
const logger = useLogger();

const handleOpen = () => {
  logger.log('inquiry_modal_opened', {
    remainingCredits,
    dilemmaTitle
  }, 'User opened inquiry modal');
  setIsOpen(true);
};

const handleClose = () => {
  logger.log('inquiry_modal_closed', {}, 'User closed inquiry modal');
  setIsOpen(false);
};
```

#### AI Output
```typescript
const aiLogger = useAIOutputLogger();

// In useEffect or callback after API response
useEffect(() => {
  if (dilemma) {
    aiLogger.logDilemma(dilemma, {
      topic: dilemma.topic,
      scope: dilemma.scope,
      crisisMode: currentCrisis
    });
  }
}, [dilemma]);
```

---

## File-Specific Patterns

### App.tsx

**Setup**:
```typescript
import { useStateChangeLogger } from '@/hooks/useStateChangeLogger';
import { useSessionLogger } from '@/hooks/useSessionLogger';

function App() {
  useStateChangeLogger(); // Global state tracking
  useSessionLogger();     // Global session tracking

  return (
    <ErrorBoundary> {/* Catches and logs all React errors */}
      {/* App content */}
    </ErrorBoundary>
  );
}
```

**Pattern**: Global hooks run once at app level for comprehensive coverage

---

### EventScreen3

**Pattern**: Track decision time and log all AI outputs

```typescript
import { useTimingLogger } from '@/hooks/useTimingLogger';
import { useAIOutputLogger } from '@/hooks/useAIOutputLogger';

const timingLogger = useTimingLogger();
const aiLogger = useAIOutputLogger();

// Start timing when phase becomes 'interacting'
useEffect(() => {
  if (phase === 'interacting') {
    const timingId = timingLogger.start('decision_time', {
      day,
      dilemmaTitle: collectedData.dilemma.title
    });
    setDecisionTimingId(timingId);
  }
}, [phase]);

// End timing when action confirmed
const handleActionConfirm = (actionId: string) => {
  timingLogger.end(decisionTimingId, {
    actionId,
    actionTitle: selectedAction.title
  });
  // ... rest of logic
};

// Log all AI outputs when collected
useEffect(() => {
  if (collectedData) {
    aiLogger.logDilemma(collectedData.dilemma, {...});
    aiLogger.logSupportShifts(collectedData.supportEffects);
    aiLogger.logCompassHints(collectedData.compassHints);
    aiLogger.logMirrorAdvice(collectedData.mirrorAdvice);
    // ... etc
  }
}, [collectedData]);
```

---

### InquiringModal

**Pattern**: Track typing duration for questions

```typescript
const logger = useLogger();
const timingLogger = useTimingLogger();
const timingIdRef = useRef<string>();

// On modal open
useEffect(() => {
  if (isOpen) {
    logger.log('inquiry_modal_opened', {...}, 'Inquiry modal opened');
    timingIdRef.current = timingLogger.start('inquiry_typing_duration', {});
  }
}, [isOpen]);

// On submit
const handleSubmit = async () => {
  const duration = timingLogger.end(timingIdRef.current!, {
    charCount: question.length
  });

  logger.log('inquiry_submitted', {
    question,
    charCount: question.length,
    typingDuration: duration
  }, `Inquiry submitted (${question.length} chars)`);

  // ... API call

  logger.logSystem('inquiry_answer_received', {
    answer,
    answerLength: answer.length
  }, 'Inquiry answer received');
};
```

---

### AftermathScreen

**Pattern**: End session with comprehensive summary

```typescript
const sessionLogger = useSessionLogger();

useEffect(() => {
  if (aftermathData && !hasLoggedSession) {
    sessionLogger.end({
      duration: Date.now() - sessionStartTime,
      finalScore: calculateFinalScore(),
      totalInquiries: dilemmaStore.totalInquiries,
      totalCustomActions: dilemmaStore.totalCustomActions,
      role: roleStore.selectedRole,
      treatment: settingsStore.treatment
    });
    setHasLoggedSession(true);
  }
}, [aftermathData]);
```

**Note**: Only log on first visit (not on snapshot restoration)

---

### ErrorBoundary

**Pattern**: Catch and log all React errors

```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Force immediate flush (don't wait for auto-flush)
    loggingService.log({
      source: 'system',
      action: 'fatal_error',
      value: {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      },
      comments: 'Uncaught React error'
    });

    loggingService.flush(); // Immediate flush
  }
}
```

---

### MirrorQuizScreen

**Pattern**: Log per-question timing

```typescript
const logger = useLogger();
const timingLogger = useTimingLogger();

// On question presented
useEffect(() => {
  logger.logSystem('quiz_question_presented', {
    questionIndex,
    component: currentQuestion.component
  }, `Quiz question ${questionIndex + 1} presented`);

  const timingId = timingLogger.start('quiz_answer_time', {
    questionIndex
  });
  setQuestionTimingId(timingId);
}, [questionIndex]);

// On answer selected
const handleAnswer = (answer: number) => {
  timingLogger.end(questionTimingId, {
    answer,
    component: currentQuestion.component
  });

  logger.log('quiz_answer_selected', {
    questionIndex,
    answer,
    component: currentQuestion.component
  }, `Quiz answer selected: ${answer}`);
};
```

---

### CompassPillsOverlay

**Pattern**: Track UI engagement

```typescript
const logger = useLogger();

const handleExpand = () => {
  logger.log('compass_pills_opened', {
    pillCount: pills.length
  }, `Compass pills expanded (${pills.length} pills)`);
  setIsExpanded(true);
};

const handleCollapse = () => {
  logger.log('compass_pills_closed', {
    pillCount: pills.length
  }, 'Compass pills collapsed');
  setIsExpanded(false);
};
```

---

## Testing & Debugging

### Enable Data Collection

```bash
# .env file
ENABLE_DATA_COLLECTION=true
MONGODB_URI=mongodb://localhost:27017/amaze-politics
```

### Check Logs in Console

All log events appear in browser console with `[Logging]` prefix:

```
[Logging] Player event: button_click_start
[Logging] System event: dilemma_generated
[Logging] Timing: decision_time = 12345ms
```

### Debug Commands

```javascript
// View queued logs (not yet sent to backend)
loggingService.getQueue();

// Clear log queue
loggingService.clearQueue();

// Force flush logs to backend immediately
loggingService.flush();
```

### Verify MongoDB Storage

```bash
# Connect to MongoDB
mongo amaze-politics

# Query logs
db.logs.find().limit(10).pretty()

# Count logs by action
db.logs.aggregate([
  { $group: { _id: "$action", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

---

## Recent Improvements (Nov 2024)

### Critical Bug Fixes

#### 1. Debug Mode Logic Inversions (FIXED)

**Files**: `useSessionLogger.ts`, `useStateChangeLogger.ts`

**Issue**: Debug mode checks were inverted (`if (!debugMode)` instead of `if (debugMode)`)

**Impact**: Logging only worked in debug mode, completely broken in production

**Fix**: Inverted logic to skip logging when debugMode is true

**Lines**:
- `useSessionLogger.ts`: Lines 44, 74, 109
- `useStateChangeLogger.ts`: Line 30

---

#### 2. Massive Duplication Bug (FIXED)

**File**: `EventScreen3.tsx` → `useEventDataCollector.ts`

**Issue**: AI output logging in EventScreen3 useEffect fired every time collectedData changed

**Impact**: 10-30 duplicate logs per dilemma (750 dilemma_generated logs instead of ~21)

**Fix**: Moved logging to `useEventDataCollector.ts` collectData() function (logs once at source)

**Reduction**: ~90% reduction in AI output logs

---

#### 3. Visibility Event Noise (FIXED)

**File**: `useSessionLogger.ts`

**Issue**: 4 overlapping events per tab switch (window_blur, window_focus, player_left, player_returned)

**Impact**: ~58 noise events per playthrough with low research value

**Fix**: Removed entire visibility tracking useEffect (lines 148-217)

**Justification**: Events overlapped, provided no gameplay insight

---

### Feature Improvements

#### 4. Session Lifecycle (FIXED)

**Files**: `RoleSelectionScreen.tsx`, `AftermathScreen.tsx`, `SplashScreen.tsx`

**Changes**:
- Session starts when role is confirmed (not on splash screen)
- Session ends when aftermath screen loads
- Added splash_screen_loaded event

**Impact**: More accurate session timing, cleaner event sequence

---

#### 5. Compass Logging Enhancement (FIXED)

**File**: `useStateChangeLogger.ts`

**Issue**: Logged compass changes as dimension[index] (e.g., "what[6]: +2")

**Fix**: Now logs component names from compass-data.ts (e.g., "Care +2")

**Impact**: Human-readable compass logs, easier analysis

---

#### 6. Support Shift Redundancy (FIXED)

**File**: `useAIOutputLogger.ts`

**Issue**: Logged both individual support_shift_generated AND support_shifts_summary

**Impact**: 1,540 redundant individual logs + 513 summary logs

**Fix**: Removed individual logs, kept only summary with explanations

**Reduction**: ~75% reduction in support shift logs

---

#### 7. Player Interaction Logging (IMPROVED)

**File**: `CompassPillsOverlay.tsx`

**Added**: compass_pills_opened, compass_pills_closed events

**Impact**: Track user engagement with compass feedback UI

---

### Data Quality Summary

| Issue | Before | After | Reduction |
|-------|--------|-------|-----------|
| AI Output Duplicates | ~2,277 logs | ~75 logs | 90% |
| Visibility Noise | 58 events | 0 events | 100% |
| Support Redundancy | 2,053 logs | 513 logs | 75% |
| Debug Mode Bug | Broken in prod | Fixed | N/A |
| Compass Readability | "what[6]" | "Care" | N/A |

**Total Impact**: ~3,000 fewer logs per playthrough, cleaner data, human-readable output

---

## Common Mistakes to Avoid

❌ **DON'T**:
- Skip logging because "it's just a small change"
- Log only some user interactions in a screen
- Forget to log character counts for text inputs
- Forget to track timing for decisions/typing
- Log state changes manually (use `useStateChangeLogger`)
- Mix up `logger.log()` (player) and `logger.logSystem()` (system)

✅ **DO**:
- Log every user interaction, no exceptions
- Log all AI-generated content
- Include timing measurements for all decisions
- Use appropriate hook for the logging type
- Include descriptive comments in logs
- Test that logs appear in console during development

---

## Adding Logging to New Features

**Steps**:

1. **Identify event types** (player actions, system events, timing)
2. **Choose appropriate hook** (useLogger, useTimingLogger, useAIOutputLogger)
3. **Add logging calls** at key interaction points
4. **Include character counts** for text inputs
5. **Track timing** for decisions and typing
6. **Test in console** (verify logs appear with correct data)
7. **Update this documentation** if new patterns emerge

**Example Workflow**:
```typescript
// 1. Import hooks
import { useLogger } from '@/hooks/useLogger';
import { useTimingLogger } from '@/hooks/useTimingLogger';

// 2. Initialize in component
const logger = useLogger();
const timingLogger = useTimingLogger();

// 3. Add logging
const handleClick = () => {
  logger.log('my_button_clicked', { buttonId: 'myButton' }, 'My button clicked');
  // ... rest of logic
};

// 4. Test
// Check browser console for: [Logging] Player event: my_button_clicked
```

---

## Future Enhancements

**Potential Improvements**:
- Client-side analytics dashboard (view logs in-app)
- Export logs to CSV from browser
- Real-time log streaming (WebSocket)
- Log aggregation by session/user
- Automated data quality checks
- Privacy-preserving differential privacy

**Not Implemented**:
- Server-side analytics (currently MongoDB only)
- Log retention policies (infinite storage)
- GDPR compliance tools (manual deletion required)
