import nodemailer from 'nodemailer';

/**
 * Email Service for Game Notifications
 * Sends alerts when game counters reach specific thresholds
 */

let emailSent = false; // Prevent duplicate emails in the same server session

/**
 * Create a nodemailer transporter
 */
function createTransporter() {
    const { EMAIL_USER, EMAIL_PASS } = process.env;

    if (!EMAIL_USER || !EMAIL_PASS) {
        console.error('[Email Service] EMAIL_USER or EMAIL_PASS not configured in .env');
        return null;
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS
        }
    });
}

/**
 * Send email notification when games_remaining reaches threshold
 * @param {number} gamesRemaining - Current number of games remaining
 * @param {number} threshold - Threshold value (default: 50)
 */
export async function sendThresholdAlert(gamesRemaining, threshold = 50) {
    const { EMAIL_ENABLED, EMAIL_TO, EMAIL_USER } = process.env;

    // Check if email notifications are enabled
    if (EMAIL_ENABLED !== 'true') {
        console.log('[Email Service] Email notifications disabled in .env');
        return;
    }

    // Check if we've already sent the email this session
    if (emailSent) {
        console.log('[Email Service] Threshold email already sent in this session');
        return;
    }

    // Only send when exactly at threshold or just passed it (within 10 range for testing)
    if (gamesRemaining > threshold || gamesRemaining < threshold - 10) {
        return;
    }

    try {
        const transporter = createTransporter();
        if (!transporter) {
            console.error('[Email Service] Failed to create email transporter');
            return;
        }

        const mailOptions = {
            from: EMAIL_USER,
            to: EMAIL_TO,
            subject: `🎮 Game Alert: ${gamesRemaining} Games Remaining`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #d32f2f;">⚠️ Game Counter Alert</h2>
                    <p>The game counter has reached the threshold:</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="font-size: 24px; font-weight: bold; margin: 0; color: #d32f2f;">
                            ${gamesRemaining} games remaining
                        </p>
                    </div>
                    <p>Threshold: <strong>${threshold}</strong></p>
                    <p style="color: #666; font-size: 12px; margin-top: 30px;">
                        This is an automated notification from the aMAZEn Politics game system.
                    </p>
                </div>
            `,
            text: `
Game Counter Alert

The game counter has reached the threshold.

Games Remaining: ${gamesRemaining}
Threshold: ${threshold}

This is an automated notification from the aMAZEn Politics game system.
            `
        };

        const info = await transporter.sendMail(mailOptions);
        emailSent = true;
        console.log(`[Email Service] ✅ Threshold alert sent successfully. Message ID: ${info.messageId}`);
        console.log(`[Email Service] Email sent to: ${EMAIL_TO}`);
        
    } catch (error) {
        console.error('[Email Service] ❌ Failed to send threshold alert:', error.message);
        // Don't throw - we don't want email failures to break the game
    }
}

/**
 * Reset the email sent flag (useful for testing or server restart)
 */
export function resetEmailFlag() {
    emailSent = false;
    console.log('[Email Service] Email flag reset');
}

/**
 * Test email configuration
 */
export async function testEmailConfiguration() {
    const { EMAIL_ENABLED, EMAIL_TO, EMAIL_USER } = process.env;

    console.log('[Email Service] Testing email configuration...');
    console.log(`  - EMAIL_ENABLED: ${EMAIL_ENABLED}`);
    console.log(`  - EMAIL_USER: ${EMAIL_USER ? '✓ Set' : '✗ Not set'}`);
    console.log(`  - EMAIL_TO: ${EMAIL_TO || '✗ Not set'}`);

    if (EMAIL_ENABLED !== 'true') {
        console.log('[Email Service] Email notifications are disabled');
        return false;
    }

    try {
        const transporter = createTransporter();
        if (!transporter) {
            return false;
        }

        await transporter.verify();
        console.log('[Email Service] ✅ Email configuration is valid');
        return true;
    } catch (error) {
        console.error('[Email Service] ❌ Email configuration test failed:', error.message);
        return false;
    }
}
