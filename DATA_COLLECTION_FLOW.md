# Data Collection Flow Diagram

Last Updated: 2025-10-22 (Fixed MirrorQuizScreen duplicate logging & added compass pills tracking)

## Overview

This document tracks which screens have data collection (logging) implemented and what data is being collected. Screens marked with ✅ have logging, screens marked with ⬜ need logging implementation.

---

## Main Gameplay Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                       MAIN GAME FLOW                            │
└─────────────────────────────────────────────────────────────────┘

1. SplashScreen                           ✅ DONE
   Route: /
   Logs: button_click_start_game, button_click_hall_of_fame, button_click_achievements
   ↓

2. RoleSelectionScreen                    ✅ DONE
   Route: /role
   Logs: role_click, role_confirm, role_validation_failed, custom_role_input, button clicks
   ↓

3. NameScreen (CharacterCreationScreen)   ✅ DONE
   Route: /name
   Logs: character_gender, character_name, character_description, button clicks
   ↓

4. PowerDistributionScreen                ✅ DONE
   Route: /power
   Logs: power_holder_name_change, power_holder_percent_change, button clicks (reset, looks good, political system modal)
   ↓

5. IntroScreen                            ✅ DONE
   Route: /intro
   Logs: button_click (Free Play)
   ↓

6. DifficultyScreen                       ✅ DONE
   Route: /difficulty
   Logs: difficulty_selection, button_click_difficulty_confirm
   Note: Only shown if enableModifiers setting is ON
   ↓

7. GoalsSelectionScreen                   ✅ DONE
   Route: /goals
   Logs: goal_selected, goal_deselected, button_click_confirm_goals
   Note: Only shown if enableModifiers setting is ON
   ↓

8. CompassIntroStart                      ✅ DONE
   Route: /compass-intro
   Logs: button_click_look_in_mirror
   ↓

9. MirrorDialogueScreen                   ✅ DONE
   Route: /mirror-dialogue
   Logs: button_click_mirror_dialogue_continue
   ↓

10. MirrorQuizScreen                      ✅ DONE
    Route: /mirror-quiz
    Logs (System): mirror_question_1/2/3, compass_pills_shown_question_1/2/3, mirror_summary_presented
    Logs (Player): player_answer_mirror_question_1/2/3, button_click_go_to_sleep, button_click_examine_mirror
    Note: Fixed duplicate logging issue; added compass value changes (pills) tracking
    ↓

11. BackgroundIntroScreen                 ✅ DONE
    Route: /background-intro
    Logs (Player): button_click_wake_up, button_click_begin
    Logs (System): background_intro_generated
    ↓

12. EventScreen3 (Days 1-7)               ✅ PARTIAL
    Route: /event
    Logs: [ActionDeck DONE, EventScreen main NEEDS MORE]

    ActionDeck logging ✅:
    - action_card_selected
    - action_card_confirmed
    - action_selection_cancelled
    - button_click_suggest_own_action
    - suggest_modal_cancelled
    - custom_action_submitted

    EventScreen needs ⬜:
    - day_start
    - dilemma_presented
    - narration_triggered
    - compass_pills_viewed
    - mirror_card_interactions
    - resource_changes
    ↓

13. AftermathScreen                       ⬜ TODO
    Route: /aftermath
    Logs: [NEEDS IMPLEMENTATION]
    Target data: button clicks (next to final score), narration interactions
    ↓

14. FinalScoreScreen                      ✅ DONE
    Route: /final-score
    Logs: game_completed, button_click_back_to_aftermath, button_click_play_again, button_click_visit_hall_of_fame
    ↓

15. HighscoreScreen                       ⬜ TODO (Meta Screen)
    Route: /highscores
    Logs: [NEEDS IMPLEMENTATION]
    Target data: button clicks (back), scroll interactions
```

---

## Meta Screens (Accessible from Splash)

```
┌─────────────────────────────────────────────────────────────────┐
│                    META SCREENS (NON-GAMEPLAY)                  │
└─────────────────────────────────────────────────────────────────┘

1. HighscoreScreen                        ⬜ TODO
   Route: /highscores
   Access: "Hall of Fame" button on SplashScreen
   Logs: [NEEDS IMPLEMENTATION]
   Target data: button clicks (back), viewing time

2. AchievementsScreen                     ⬜ TODO
   Route: /achievements
   Access: "Book of Achievements" button on SplashScreen
   Logs: [NEEDS IMPLEMENTATION]
   Target data: button clicks (back), viewing time
   Note: Achievement tracking not yet implemented (display only)
```

---

## Implementation Status Summary

### ✅ DONE (13 screens)
1. **SplashScreen** - Button clicks (start, hall of fame, achievements)
2. **RoleSelectionScreen** - Role selection, validation, custom input
3. **NameScreen** - Character creation (gender, name, description)
4. **PowerDistributionScreen** - Power distribution changes, modal interactions
5. **IntroScreen** - Basic button clicks
6. **DifficultyScreen** - Difficulty selection
7. **GoalsSelectionScreen** - Goal selection/deselection, confirmation
8. **CompassIntroStart** - Look in mirror button
9. **MirrorDialogueScreen** - Continue to compass quiz button
10. **MirrorQuizScreen** - Quiz questions (system), player answers, compass pills/value changes (system), mirror summary (system), button clicks
11. **BackgroundIntroScreen** - Wake up button, AI-generated intro (system), begin button
12. **ActionDeck (EventScreen3)** - Action selection and confirmation
13. **FinalScoreScreen** - Game completion, button clicks

### ⬜ TODO (2 screens)
1. **EventScreen3 (main)** - Day progression, dilemma presentation
2. **AftermathScreen** - Epilogue interactions

### 🔶 META SCREENS (2 screens)
1. **HighscoreScreen** - Viewing interactions
2. **AchievementsScreen** - Viewing interactions

---

## Logging Infrastructure

### Core Components
- **loggingService** (`src/lib/loggingService.ts`) - Centralized logging service with batching, retry, and offline support
- **useLogger hook** (`src/hooks/useLogger.ts`) - React hook for logging with automatic metadata
- **loggingStore** (`src/store/loggingStore.ts`) - Zustand store for logging state
- **Types** (`src/types/logging.ts`) - TypeScript types for log entries

### How to Add Logging to a Screen

```typescript
// 1. Import the hook
import { useLogger } from '../hooks/useLogger';

// 2. Instantiate in your component
const logger = useLogger();

// 3. Log events
logger.log(
  'action_name',           // Action identifier
  'value',                 // Simple value (string, number, boolean)
  'Human description'      // Optional comment
);

// Example: Button click
logger.log('button_click_continue', 'Continue Button', 'User clicked Continue to next screen');

// Example: Selection
logger.log('goal_selected', goalId, `User selected goal: ${goalName}`);

// Example: Input
logger.log('quiz_answer', answerValue, `User answered quiz question ${questionId}`);
```

### Automatic Metadata
The `useLogger` hook automatically attaches:
- **screen**: Current route (e.g., `/role`, `/event`)
- **day**: Game day (if in gameplay phase)
- **role**: Selected role (if applicable)

---

## Next Steps

Work through TODO screens in order of gameplay flow:
1. **EventScreen3** - Day progression and dilemma presentation
2. **AftermathScreen** - Epilogue interactions
3. **HighscoreScreen** - Meta screen interactions
4. **AchievementsScreen** - Meta screen interactions

---

## Notes

- Logging is controlled by `loggingStore.enabled` (default: false until user consents)
- All logs are batched and sent to MongoDB via `/api/log/batch` endpoint
- Queue auto-flushes every 5 seconds or when 50 logs accumulate
- Logs include anonymous userId (UUID) for session tracking
- Treatment field supports A/B testing (default: 'control')
