# Email Notification System

Automatic email alerts when the `games_remaining` counter reaches critical thresholds.

---

## Overview

The email notification system automatically sends alerts when the game counter reaches 50 remaining slots. This provides early warning to administrators so they can take action before the game becomes unavailable to new players.

**Key Features**:
- ✅ Automatic threshold detection (50 games remaining)
- ✅ Gmail SMTP integration using nodemailer
- ✅ Fail-safe design (email failures don't break game functionality)
- ✅ Duplicate prevention (one email per server session)
- ✅ Testing endpoints and console commands
- ✅ HTML-formatted emails with clear formatting

---

## Configuration

### Environment Variables (`.env`)

```bash
# Email Configuration
EMAIL_ENABLED=true                          # Enable/disable email notifications
EMAIL_USER=hujidemocracygame@gmail.com      # Sender email (Gmail account)
EMAIL_PASS=your-app-password                # Gmail app password (NOT regular password)
EMAIL_TO=yoav.schneider2@mail.huji.ac.il    # Recipient email address
```

### Gmail App Password Setup

**Important**: Gmail requires an "App Password" if 2-factor authentication (2FA) is enabled on the account.

**Steps to create an App Password**:
1. Go to Google Account settings: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification**
3. Scroll down to **App passwords**
4. Select **Mail** and **Windows Computer** (or other)
5. Click **Generate**
6. Copy the 16-character password (no spaces)
7. Paste into `.env` as `EMAIL_PASS`

**Without 2FA**: You can use your regular Gmail password, but Google may require enabling "Less secure app access" (not recommended).

---

## How It Works

### Automatic Email Trigger

The email system is integrated into the game slot reservation flow:

```
1. Player starts a new game
2. Backend calls `/api/reserve-game-slot`
3. Counter decrements: games_remaining = 51 → 50
4. System detects threshold reached (50)
5. Email sent automatically via sendThresholdAlert()
6. Game continues normally (email failure doesn't block game)
```

**Code Flow**:
```javascript
// server/controllers/gameController.mjs
export async function reserveGameSlot(req, res) {
  // Decrement counter
  const result = await countersCollection.findOneAndUpdate(
    { name: 'games_remaining', value: { $gt: 0 } },
    { $inc: { value: -1 } }
  );

  if (result) {
    // Send email alert if threshold reached (50 games remaining)
    sendThresholdAlert(result.value, 50).catch(err => {
      console.error('[Reserve Slot] Email notification failed:', err.message);
    });
    
    res.json({ success: true, gamesRemaining: result.value });
  }
}
```

### Email Content

**Subject**: `🎮 Game Alert: 50 Games Remaining`

**Body** (HTML formatted):
```
⚠️ Game Counter Alert

The game counter has reached the threshold.

50 games remaining

Threshold: 50

This is an automated notification from the aMAZEn Politics game system.
```

### Duplicate Prevention

The system prevents duplicate emails using a session-level flag:

```javascript
// server/services/emailService.mjs
let emailSent = false; // Prevents duplicate emails in the same server session

export async function sendThresholdAlert(gamesRemaining, threshold = 50) {
  if (emailSent) {
    console.log('[Email Service] Threshold email already sent in this session');
    return;
  }
  
  // Only send when exactly at threshold or just passed it
  if (gamesRemaining > threshold || gamesRemaining < threshold - 5) {
    return;
  }
  
  // Send email...
  emailSent = true;
}
```

**Why session-level flag?**
- Prevents spam if multiple requests happen simultaneously
- Resets on server restart (allows re-testing)
- Can be manually reset via API endpoint or console command

---

## Testing

### Console Commands

Open the browser console and use these commands:

```javascript
// Test email configuration (SMTP connection)
testEmailConfig()
// Output: ✅ Email configuration is valid

// Send test threshold email (default: 50 games remaining)
testThresholdEmail()
// Output: ✅ Test email sent successfully

// Send test email for specific value
testThresholdEmail(45)
// Output: ✅ Test email sent successfully

// Reset email sent flag (allows resending)
resetEmailFlag()
// Output: ✅ Email flag reset successfully
```

### API Endpoints

**Test Email Configuration**:
```bash
GET /api/test-email-config
```

Response:
```json
{
  "success": true,
  "message": "Email configuration is valid"
}
```

**Send Test Threshold Email**:
```bash
POST /api/test-threshold-email
Content-Type: application/json

{
  "gamesRemaining": 50
}
```

Response:
```json
{
  "success": true,
  "message": "Test email sent for 50 games remaining"
}
```

**Reset Email Flag**:
```bash
POST /api/reset-email-flag
```

Response:
```json
{
  "success": true,
  "message": "Email flag reset successfully"
}
```

### Testing Workflow

**1. Verify Configuration**:
```javascript
// In browser console
testEmailConfig()
```

Expected output:
```
📧 Testing email configuration...
✅ Email configuration is valid
📨 Ready to send notifications
```

**2. Send Test Email**:
```javascript
// In browser console
testThresholdEmail(50)
```

Expected output:
```
📧 Sending test threshold email for 50 games remaining...
✅ Test email sent successfully
📬 Check the recipient inbox
```

**3. Check Recipient Inbox**:
- Email should arrive within seconds
- Subject: "🎮 Game Alert: 50 Games Remaining"
- Check spam folder if not in inbox

**4. Reset Flag for Re-testing**:
```javascript
// In browser console
resetEmailFlag()
```

Expected output:
```
🔄 Resetting email flag...
✅ Email flag reset successfully
📧 Threshold email can be sent again
```

---

## Troubleshooting

### Email Not Sending

**1. Check Configuration**:
```javascript
testEmailConfig()
```

**Common Issues**:
- ❌ `EMAIL_ENABLED` not set to `"true"` (string, not boolean)
- ❌ `EMAIL_USER` or `EMAIL_PASS` missing or incorrect
- ❌ Gmail App Password not created (using regular password instead)
- ❌ 2FA not enabled on Gmail account (required for App Passwords)

**2. Check Server Logs**:
```bash
# Look for email service logs
[Email Service] ✅ Threshold alert sent successfully. Message ID: <...>
# OR
[Email Service] ❌ Failed to send threshold alert: <error>
```

**3. Gmail Security Issues**:
- Google may block sign-in attempts from "Less secure apps"
- Solution: Enable 2FA and use App Password (see configuration section)
- Check Gmail account for "Blocked sign-in attempt" notifications

**4. Network Issues**:
- Server must have outbound SMTP access (port 587 or 465)
- Check firewall settings if hosted on restricted network
- Verify server can reach `smtp.gmail.com`

### Email Sent But Not Received

**1. Check Spam Folder**:
- Automated emails often land in spam
- Mark as "Not Spam" to whitelist sender

**2. Check Recipient Address**:
- Verify `EMAIL_TO` in `.env` is correct
- Test with a different email address

**3. Gmail Daily Limits**:
- Gmail free accounts: 500 emails/day
- Gmail Workspace: 2,000 emails/day
- Wait 24 hours if limit exceeded

### Duplicate Emails

If receiving duplicate emails:

**1. Check Server Restarts**:
- Email flag resets on server restart
- Multiple server instances will send duplicates

**2. Threshold Range**:
- Email only sent when `45 ≤ games_remaining ≤ 50`
- Won't send for `51+` or `44-` (outside threshold window)

---

## Architecture

### File Structure

```
server/
├── services/
│   └── emailService.mjs          # Core email functionality
├── controllers/
│   └── gameController.mjs        # Integrated with reserveGameSlot()
└── index.mjs                     # API endpoint definitions

src/
└── main.tsx                      # Console command definitions

.env                              # Email configuration
CONSOLE_COMMANDS.md               # Console command documentation
EMAIL_NOTIFICATION_SYSTEM.md      # This file
```

### Dependencies

**Nodemailer** (already installed):
```json
{
  "nodemailer": "^6.10.1"
}
```

No additional dependencies required.

### Email Service API

**`sendThresholdAlert(gamesRemaining, threshold)`**
- Sends email when counter reaches threshold
- Parameters:
  - `gamesRemaining` (number): Current counter value
  - `threshold` (number): Threshold value (default: 50)
- Returns: `Promise<void>`
- Throws: Never (failures logged, not thrown)

**`testEmailConfiguration()`**
- Tests SMTP connection and credentials
- Returns: `Promise<boolean>` (true if valid)

**`resetEmailFlag()`**
- Resets the session-level email sent flag
- Allows sending threshold email again
- Returns: `void`

---

## Security Considerations

### Credentials Storage

**Never commit `.env` to version control**:
```bash
# .gitignore
.env
```

**Production Deployment**:
- Use environment variables (Render, Heroku, etc.)
- Store credentials in secure secrets management
- Rotate App Passwords periodically

### Email Content

**Current email contains**:
- Counter value (public information)
- Threshold value (configuration detail)
- Game name (public)

**Does NOT contain**:
- User data
- API keys
- Database credentials
- Sensitive game state

### Rate Limiting

**Built-in protection**:
- One email per threshold crossing per session
- Threshold window: 45-50 games remaining (5-game buffer)
- Session flag prevents spam

**Gmail Limits**:
- 500 emails/day (free account)
- 2,000 emails/day (Workspace)
- Rate limited by Google if exceeded

---

## Future Enhancements

**Potential Improvements**:

1. **Multiple Thresholds**:
   - Email at 100, 50, 25, 10 games remaining
   - Different recipients for each threshold

2. **Email Templates**:
   - More detailed statistics
   - Graphs/charts of usage over time
   - Recommendations for next steps

3. **Alternative Providers**:
   - SendGrid for higher reliability
   - AWS SES for better deliverability
   - Twilio for SMS notifications

4. **Webhook Integration**:
   - Slack notifications
   - Discord alerts
   - PagerDuty integration

5. **Database Flag**:
   - Store email sent status in MongoDB
   - Persist across server restarts
   - Track email history

---

## Maintenance

### Updating Threshold

To change the threshold from 50 to a different value:

**1. Update Controller**:
```javascript
// server/controllers/gameController.mjs
sendThresholdAlert(result.value, 100); // Change 50 → 100
```

**2. Update Documentation**:
- Update `CONSOLE_COMMANDS.md`
- Update this file (`EMAIL_NOTIFICATION_SYSTEM.md`)

### Changing Email Provider

To switch from Gmail to another provider:

**1. Update Transporter**:
```javascript
// server/services/emailService.mjs
function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}
```

**2. Update `.env`**:
```bash
EMAIL_USER=alerts@yourdomain.com
EMAIL_PASS=your-smtp-password
```

### Disabling Email Notifications

**Temporary Disable**:
```bash
# .env
EMAIL_ENABLED=false
```

**Permanent Disable**:
Remove the `sendThresholdAlert()` call from `gameController.mjs`.

---

## Support

**Documentation**:
- `CONSOLE_COMMANDS.md` - Console command reference
- `API_REFERENCE.md` - Backend API documentation
- `CLAUDE.md` - Project quick reference

**Contact**:
- Email: yoav.schneider2@mail.huji.ac.il
- Project: aMAZEn Politics (Hebrew University)

---

**Last Updated**: January 2026
