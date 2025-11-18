// server/api/logging.mjs
// Logging API endpoints for data collection
//
// Endpoints:
// - POST /api/log/batch - Batch insert log entries
// - POST /api/log/session/start - Start new session
//
// Security:
// - Validates all log entries before inserting
// - Rate limiting (max 1000 logs per session)
// - Respects ENABLE_DATA_COLLECTION environment variable

import express from 'express';
import rateLimit from 'express-rate-limit';
import { getLogsCollection, getDb } from '../db/mongodb.mjs';

const router = express.Router();

// Check if data collection is enabled
const DATA_COLLECTION_ENABLED = process.env.ENABLE_DATA_COLLECTION === 'true';
const DEFAULT_TREATMENT = process.env.DEFAULT_TREATMENT || 'control';

// Rate limiting constants
const MAX_LOGS_PER_SESSION = 1000;
const MAX_BATCH_SIZE = 50;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 200; // 200 requests per hour per IP

// IP-based rate limiting middleware
const ipRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    error: `Too many requests from this IP, please try again after an hour`
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,  // Disable X-RateLimit-* headers
  handler: (req, res) => {
    console.warn(`[Rate Limit] IP ${req.ip} exceeded rate limit`);
    res.status(429).json({
      success: false,
      error: `Rate limit exceeded: max ${RATE_LIMIT_MAX_REQUESTS} requests per hour per IP`
    });
  }
});

/**
 * Get session log count from MongoDB (persistent across server restarts)
 * @param {string} sessionId - Session ID
 * @returns {Promise<number>} Current log count for session
 */
async function getSessionLogCount(sessionId) {
  try {
    const db = await getDb();
    const rateLimits = db.collection('rateLimits');

    const record = await rateLimits.findOne({ sessionId });
    return record ? record.count : 0;
  } catch (error) {
    console.error('[Rate Limit] Failed to get session count:', error);
    return 0; // Fail open (don't block on DB errors)
  }
}

/**
 * Update session log count in MongoDB
 * @param {string} sessionId - Session ID
 * @param {number} increment - Number to add to count
 */
async function updateSessionLogCount(sessionId, increment) {
  try {
    const db = await getDb();
    const rateLimits = db.collection('rateLimits');

    // Upsert with increment and set TTL
    await rateLimits.updateOne(
      { sessionId },
      {
        $inc: { count: increment },
        $setOnInsert: { createdAt: new Date() },
        $set: { updatedAt: new Date() }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('[Rate Limit] Failed to update session count:', error);
    // Don't throw - rate limiting is secondary to data collection
  }
}

// Create TTL index for automatic cleanup of old rate limit records
(async () => {
  try {
    const db = await getDb();
    const rateLimits = db.collection('rateLimits');

    // Index expires records after 24 hours
    await rateLimits.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 24 * 60 * 60 }
    );

    console.log('[Rate Limit] ✅ TTL index created for rateLimits collection');
  } catch (error) {
    console.error('[Rate Limit] ❌ Failed to create TTL index:', error);
  }
})();

/**
 * Validate a single log entry
 * Ensures required fields are present and have correct types
 */
function validateLogEntry(entry) {
  const errors = [];

  // Required fields
  if (!entry.timestamp) errors.push('Missing timestamp');
  if (!entry.userId) errors.push('Missing userId');
  if (!entry.gameVersion) errors.push('Missing gameVersion');
  if (!entry.treatment) errors.push('Missing treatment');
  if (!entry.source) errors.push('Missing source');
  if (!entry.action) errors.push('Missing action');

  // Type validation
  if (entry.timestamp && !(entry.timestamp instanceof Date) && typeof entry.timestamp !== 'string') {
    errors.push('timestamp must be a Date or ISO string');
  }

  if (entry.source && !['player', 'system'].includes(entry.source)) {
    errors.push('source must be "player" or "system"');
  }

  // Value can be any type (object, string, number, etc.)
  // Comments is optional

  return errors;
}

/**
 * POST /api/log/batch
 * Batch insert log entries
 *
 * Body: {
 *   logs: Array<LogEntry>,
 *   sessionId: string (optional, for rate limiting)
 * }
 *
 * Returns: {
 *   success: boolean,
 *   inserted: number,
 *   errors?: Array<string>
 * }
 */
router.post('/batch', ipRateLimiter, async (req, res) => {
  try {
    // Check if data collection is enabled
    if (!DATA_COLLECTION_ENABLED) {
      return res.status(400).json({
        success: false,
        error: 'Data collection is not enabled on this server'
      });
    }

    const { logs, sessionId } = req.body;

    // Validate request
    if (!Array.isArray(logs)) {
      return res.status(400).json({
        success: false,
        error: 'logs must be an array'
      });
    }

    if (logs.length === 0) {
      return res.json({ success: true, inserted: 0 });
    }

    // Batch size validation
    if (logs.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        success: false,
        error: `Batch size too large: max ${MAX_BATCH_SIZE} logs per request, received ${logs.length}`
      });
    }

    // Session-based rate limiting check (MongoDB-persisted)
    if (sessionId) {
      const currentCount = await getSessionLogCount(sessionId);
      if (currentCount + logs.length > MAX_LOGS_PER_SESSION) {
        console.warn(`[Rate Limit] Session ${sessionId} exceeded limit: ${currentCount + logs.length}/${MAX_LOGS_PER_SESSION}`);
        return res.status(429).json({
          success: false,
          error: `Rate limit exceeded: max ${MAX_LOGS_PER_SESSION} logs per session`,
          currentCount,
          maxLogs: MAX_LOGS_PER_SESSION
        });
      }
    }

    // Validate all log entries
    const validationErrors = [];
    const validLogs = [];

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const errors = validateLogEntry(log);

      if (errors.length > 0) {
        validationErrors.push(`Log ${i}: ${errors.join(', ')}`);
      } else {
        // Convert timestamp to Date if it's a string
        if (typeof log.timestamp === 'string') {
          log.timestamp = new Date(log.timestamp);
        }
        validLogs.push(log);
      }
    }

    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: validationErrors
      });
    }

    // Insert valid logs into MongoDB with strong write guarantees
    const collection = await getLogsCollection();

    try {
      const result = await collection.insertMany(validLogs, {
        ordered: false,
        writeConcern: { w: 'majority', j: true, wtimeout: 10000 }
      });

      // Verify actual insertions match expected
      const insertedCount = result.insertedCount || Object.keys(result.insertedIds || {}).length;

      if (insertedCount !== validLogs.length) {
        console.warn(`[Logging] ⚠️ Partial insert: ${insertedCount}/${validLogs.length} logs inserted`);
      }

      // Update rate limiting counter in MongoDB
      if (sessionId) {
        await updateSessionLogCount(sessionId, insertedCount);
      }

      console.log(`[Logging] ✅ Inserted ${insertedCount} log entries (verified)`);

      res.json({
        success: true,
        inserted: insertedCount,
        expected: validLogs.length,
        allInserted: insertedCount === validLogs.length
      });
    } catch (insertError) {
      // If insert fails, provide detailed error information
      console.error('[Logging] ❌ Insert failed:', insertError.message);

      // Check if it's a connection error
      if (insertError.message.includes('connection') ||
          insertError.message.includes('timeout') ||
          insertError.message.includes('ECONNREFUSED')) {
        console.log('[Logging] 🔄 Connection error detected - client should retry');
        return res.status(503).json({
          success: false,
          error: 'Database connection error - please retry',
          retryable: true,
          details: insertError.message
        });
      }

      throw insertError;
    }

  } catch (error) {
    console.error('[Logging] ❌ Batch insert failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to insert logs',
      details: error.message
    });
  }
});

/**
 * POST /api/log/session/start
 * Start a new session
 *
 * Body: {
 *   userId: string,
 *   gameVersion: string,
 *   treatment?: string (defaults to DEFAULT_TREATMENT)
 * }
 *
 * Returns: {
 *   success: boolean,
 *   sessionId: string,
 *   treatment: string
 * }
 */
router.post('/session/start', async (req, res) => {
  try {
    // Check if data collection is enabled
    if (!DATA_COLLECTION_ENABLED) {
      return res.status(400).json({
        success: false,
        error: 'Data collection is not enabled on this server'
      });
    }

    const { userId, gameVersion, treatment } = req.body;

    // Validate request
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    if (!gameVersion) {
      return res.status(400).json({
        success: false,
        error: 'gameVersion is required'
      });
    }

    // Generate session ID (timestamp + random)
    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Use provided treatment or default
    const finalTreatment = treatment || DEFAULT_TREATMENT;

    // Initialize rate limiting counter in MongoDB for this session
    await updateSessionLogCount(sessionId, 0);

    // Log session start event with strong write guarantees
    const collection = await getLogsCollection();
    await collection.insertOne({
      timestamp: new Date(),
      userId,
      gameVersion,
      treatment: finalTreatment,
      source: 'system',
      action: 'session_start',
      value: sessionId,  // sessionId value (no need for object wrapper)
      comments: 'User started new game session'
    }, {
      writeConcern: { w: 'majority', j: true, wtimeout: 10000 }
    });

    console.log(`[Logging] ✅ Session started: ${sessionId} (user: ${userId}, treatment: ${finalTreatment})`);

    res.json({
      success: true,
      sessionId,
      treatment: finalTreatment
    });

  } catch (error) {
    console.error('[Logging] ❌ Session start failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start session',
      details: error.message
    });
  }
});

/**
 * POST /api/log/summary
 * Insert session summary into MongoDB summary collection
 *
 * Body: SessionSummary object (see useSessionSummary.ts for structure)
 *
 * Returns: {
 *   success: boolean,
 *   error?: string
 * }
 */
router.post('/summary', ipRateLimiter, async (req, res) => {
  try {
    // Check if data collection is enabled
    if (!DATA_COLLECTION_ENABLED) {
      console.error('[Logging] ❌ Summary rejected: Data collection not enabled');
      return res.status(400).json({
        success: false,
        error: 'Data collection is not enabled on this server'
      });
    }

    const summary = req.body;

    // Basic validation - ensure required fields exist
    if (!summary.userId || !summary.sessionId || !summary.gameVersion) {
      const missing = [];
      if (!summary.userId) missing.push('userId');
      if (!summary.sessionId) missing.push('sessionId');
      if (!summary.gameVersion) missing.push('gameVersion');

      console.error('[Logging] ❌ Summary validation failed: Missing fields:', missing.join(', '));
      console.error('[Logging] Received summary:', {
        hasUserId: !!summary.userId,
        hasSessionId: !!summary.sessionId,
        hasGameVersion: !!summary.gameVersion,
        role: summary.role,
        incomplete: summary.incomplete
      });

      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }

    // Convert timestamp to Date if it's a string
    if (typeof summary.timestamp === 'string') {
      summary.timestamp = new Date(summary.timestamp);
    }

    // Insert into summary collection (separate from gameLogs)
    const db = await getDb();
    const summaryCollection = db.collection('summary');

    await summaryCollection.insertOne(summary, {
      writeConcern: { w: 'majority', j: true, wtimeout: 10000 }
    });

    console.log(`[Logging] ✅ Session summary inserted: ${summary.sessionId} (user: ${summary.userId}, role: ${summary.role}, incomplete: ${summary.incomplete})`);

    // Return success
    res.json({
      success: true
    });

  } catch (error) {
    console.error('[Logging] ❌ Summary insert failed:', error);
    console.error('[Logging] Error details:', {
      message: error.message,
      stack: error.stack
    });

    // Return 200 OK even on error (don't block user experience)
    // But log the error for debugging
    res.json({
      success: false,
      error: 'Failed to insert summary (non-blocking)',
      details: error.message
    });
  }
});

/**
 * GET /api/log/status
 * Check if data collection is enabled
 *
 * Returns: {
 *   enabled: boolean,
 *   defaultTreatment: string
 * }
 */
router.get('/status', (req, res) => {
  res.json({
    enabled: DATA_COLLECTION_ENABLED,
    defaultTreatment: DEFAULT_TREATMENT
  });
});

// Note: Rate limit cleanup now handled by MongoDB TTL index (24 hour expiration)

export default router;
