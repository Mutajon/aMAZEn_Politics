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
import { getLogsCollection } from '../db/mongodb.mjs';

const router = express.Router();

// Check if data collection is enabled
const DATA_COLLECTION_ENABLED = process.env.ENABLE_DATA_COLLECTION === 'true';
const DEFAULT_TREATMENT = process.env.DEFAULT_TREATMENT || 'control';

// Rate limiting: Track logs per session
const sessionLogCounts = new Map();
const MAX_LOGS_PER_SESSION = 1000;

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
router.post('/batch', async (req, res) => {
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

    // Rate limiting check
    if (sessionId) {
      const currentCount = sessionLogCounts.get(sessionId) || 0;
      if (currentCount + logs.length > MAX_LOGS_PER_SESSION) {
        return res.status(429).json({
          success: false,
          error: `Rate limit exceeded: max ${MAX_LOGS_PER_SESSION} logs per session`
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

      // Update rate limiting counter
      if (sessionId) {
        const currentCount = sessionLogCounts.get(sessionId) || 0;
        sessionLogCounts.set(sessionId, currentCount + insertedCount);
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

    // Initialize rate limiting counter for this session
    sessionLogCounts.set(sessionId, 0);

    // Log session start event with strong write guarantees
    const collection = await getLogsCollection();
    await collection.insertOne({
      timestamp: new Date(),
      userId,
      gameVersion,
      treatment: finalTreatment,
      source: 'system',
      action: 'session_start',
      value: { sessionId },
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

// Clean up old session rate limit counters (every hour)
setInterval(() => {
  const maxAge = 60 * 60 * 1000; // 1 hour
  const now = Date.now();

  for (const [sessionId, _] of sessionLogCounts.entries()) {
    // Extract timestamp from sessionId (format: timestamp-random)
    const timestamp = parseInt(sessionId.split('-')[0]);
    if (now - timestamp > maxAge) {
      sessionLogCounts.delete(sessionId);
    }
  }
}, 60 * 60 * 1000);

export default router;
