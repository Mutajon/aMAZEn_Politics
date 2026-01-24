# Console Commands Reference

This file contains all browser console commands available in the game for debugging, testing, and development.

## AI Provider Switching

Switch between AI providers without restarting the application.

```javascript
switchToClaude()     // Switch to Anthropic Claude (requires MODEL_DILEMMA_ANTHROPIC in .env)
switchToGPT()        // Switch to OpenAI GPT (DEFAULT)
switchToXAI()        // Switch to X.AI/Grok (requires MODEL_DILEMMA_XAI in .env)
switchToGemini()     // Switch to Google Gemini (requires MODEL_DILEMMA_GEMINI in .env)
```

**Note**: Provider switching persists in localStorage. Requires corresponding API keys in `.env`.

---

## Debug Mode

Toggle debug features (persists in localStorage).

```javascript
enableDebug()        // Shows "Jump to Final Day" button, extra console logs
disableDebug()       // Disable debug mode
toggleDebug()        // Toggle debug mode on/off
```

**Debug Features**:
- "Jump to Final Day" button in EventScreen
- Verbose console logging for AI responses
- Additional state inspection tools

---

## Context Control

Control AI context for diagnosing Day 2+ behavior.

```javascript
skipPreviousContext()      // Skip sending previous dilemma context to AI on Day 2+
includePreviousContext()   // Include previous context (normal behavior, default)
togglePreviousContext()    // Toggle previous context on/off
```

**Use Case**: Diagnose whether conversation state is causing unexpected AI behavior.

---

## Corruption Tracking

Toggle corruption tracking system.

```javascript
enableCorruption()   // Enable corruption tracking (AI judges power misuse)
disableCorruption()  // Disable corruption tracking
toggleCorruption()   // Toggle corruption tracking on/off
```

**Default**: Enabled. Corruption affects final score and is displayed in UI.

---

## Hidden Ratings Access

Access hidden democracy rating after completing a game.

```javascript
showDemocracy()      // Display hidden democracy rating (not shown in UI)
getDemocracy()       // Alias for showDemocracy()
```

**When Available**: After reaching Aftermath screen. Returns 0-10 scale rating.

---

## Compass Values

View current 4D political compass values with visual bars.

```javascript
getCompass()         // Display all 40 compass values with visual bars
```

**Output Includes**:
- All 4 dimensions: What (Values), Whence (Sources), How (Methods), Whither (Beneficiaries)
- 10 components per dimension with 0-10 scale bars
- Change indicators from initial quiz values (e.g., `+2`, `-1`)
- Total compass points out of 400

**Use Case**: Debug compass changes during gameplay, verify quiz initialization.

---

## Past Games Storage

Manage saved game history (max 10 games, localStorage).

```javascript
getPastGames()       // View all stored past games (formatted table)
clearPastGames()     // Clear all past games from localStorage (with confirmation)
exportPastGames()    // Export games as JSON (auto-copies to clipboard)
```

**Storage Details**:
- Max 10 games (auto-prunes oldest)
- ~50-80KB per game (includes base64 avatars)
- Used by fragment collection system

---

## Fragment Collection

Manage fragment collection progression system.

```javascript
getFragments()       // View fragment collection status (max 3)
clearFragments()     // Clear all collected fragments (with confirmation)
resetIntro()         // Reset first intro flag (show full 26-line dialog again)
```

**Fragment System**:
- Collect 1 fragment per completed game
- Max 3 fragments total
- Links to past games via gameId

---

## Mirror Dialogue

Reset mirror dialogue persistence to show full conversation again.

```javascript
resetMirrorDialogue()  // Reset first mirror dialogue flag (show full conversation again)
```

**Mirror Dialogue System**:
- First visit: Shows full 5-message conversation
- Return visits: Shows abbreviated 2-message dialogue
- Flag persists in localStorage across playthroughs
- Automatically integrated with `resetAll()` command

**Use Case**: Test mirror dialogue variations, debug first-time experience.

---

## Tutorial System

Manage the Day 2 tutorial system that teaches players about avatar pop-ups and compass values.

```javascript
resetDay2Tutorial()  // Reset Day 2 tutorial completion flag
```

**Tutorial System**:
- Triggers once per player on Day 2 after dilemma narration completes
- Shows interactive tutorial for:
  1. Clicking avatar to view compass values
  2. Clicking compass values to see explanations
- Completion flag persists in localStorage (`tutorial_day2_completed`)
- Automatically integrated with `resetAll()` command

**Use Case**:
- Test tutorial flow during development
- Re-experience tutorial after completing it once
- Debug tutorial timing and interactions

**Tutorial Flow**:
1. Day 2 loads → Narration plays
2. Narration ends → Tutorial overlay appears
3. Player clicks avatar → Modal opens
4. Arrow points to random value → Player clicks value
5. Explanation modal appears → Player closes → Tutorial complete

---

## Experiment Mode Management

View and reset experiment progress.

```javascript
getExperimentProgress()    // View completed roles and progress
resetExperimentProgress()  // Reset experiment progress + clear past games/fragments
clearExperimentProgress()  // Alias for resetExperimentProgress()
skipToTelAviv()            // Mark Railroad Strike complete, unlock Tel Aviv
skipToMars()               // Mark Railroad Strike + Tel Aviv complete, unlock Mars
```

**Warning**: Resets all progression data, useful for testing.

---

## Complete Reset

Full reset to first-time player experience.

```javascript
resetAll()                 // FULL RESET: All data except user preferences
```

**Resets**:
- Game state and progression
- Past games and fragments
- Mirror dialogue first-time flag
- Intro screen first-time flag
- Scores and highscores
- User ID and treatment assignment
- Experiment progress

**Preserves**:
- Audio settings (music/SFX volume)
- Language preference
- Display preferences

---

## Logging System Debug

Debug data collection system (developer only).

```javascript
loggingService.getQueue()     // View queued logs (not yet sent to backend)
loggingService.clearQueue()   // Clear log queue
loggingService.flush()        // Force flush logs to backend immediately
```

**Auto-Flush**: Logs auto-flush every 5 seconds or when 50 logs accumulate.

---

## Email Notification Testing

Test email configuration and send test threshold alerts.

```javascript
testEmailConfig()                  // Test email configuration (SMTP connection)
testThresholdEmail(gamesRemaining) // Send test threshold email (default: 50)
resetEmailFlag()                   // Reset email sent flag (allows resending)
```

**Email System**:
- Automatically sends email when `games_remaining` counter reaches 50
- Email sent from `EMAIL_USER` to `EMAIL_TO` (configured in `.env`)
- Uses Gmail SMTP with credentials from `.env`
- Threshold email sent only once per server session (flag prevents duplicates)

**Configuration** (in `.env`):
```bash
EMAIL_ENABLED=true                          # Enable/disable email notifications
EMAIL_USER=hujidemocracygame@gmail.com      # Sender email (Gmail)
EMAIL_PASS=your-app-password                # Gmail app password
EMAIL_TO=recipient@mail.huji.ac.il          # Recipient email
```

**Use Cases**:
- `testEmailConfig()` - Verify SMTP settings are correct
- `testThresholdEmail(45)` - Send test email for 45 games remaining
- `resetEmailFlag()` - Reset flag to test threshold logic again

**Important**: 
- Email failures do NOT break game functionality (fail gracefully)
- Gmail requires "App Password" if 2FA is enabled
- Threshold checked every time a game slot is reserved

---

## Adding New Console Commands

**When adding new console commands**:

1. Implement the function in the relevant service/store file
2. Expose it globally via `window` in the service file
3. Add documentation here with:
   - Function signature
   - Purpose/use case
   - Parameters (if any)
   - Return value
   - Side effects

**Example**:
```typescript
// In src/lib/myService.ts
export const myNewCommand = () => {
  // implementation
};

// Expose globally
if (typeof window !== 'undefined') {
  (window as any).myNewCommand = myNewCommand;
}
```

Then document here:
```markdown
## My New Feature

```javascript
myNewCommand()  // Description of what it does
```

**Use Case**: When to use this command
```

---

## Notes

- All commands are exposed via `window` object in browser console
- Commands persist settings in localStorage where applicable
- No commands directly modify database (read-only for most operations)
- Type `help()` in console for quick reference (if implemented)
