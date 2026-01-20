
// src/lib/loggingService.ts
// Centralized logging service for data collection
//
// Features:
// - Write-Ahead Logging (via PersistentQueue) for zero data loss
// - Background sync (auto-flush every 5 seconds or 50 logs)
// - Retry logic with exponential backoff
// - Offline support (queues logs when offline)
// - Non-blocking (never blocks UI)
// - Robust transport (keepalive fetch)

import { useLoggingStore, ensureUserId } from '../store/loggingStore';
import type { LogEntry, BatchLogRequest, SessionStartRequest, LoggingStatusResponse } from '../types/logging';
import packageJson from '../../package.json';
import { PersistentQueue } from './persistentQueue';

// Configuration
const BATCH_SIZE = 50;              // Max logs per batch
const FLUSH_INTERVAL_MS = 5000;     // Auto-flush every 5 seconds
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000];  // Exponential backoff (up to 16s)
const LEGACY_STORAGE_KEY = 'logging_queue_backup';  // For migration only

class LoggingService {
  private persistentQueue: PersistentQueue;
  private flushTimer: number | null = null;
  private isFlushing = false;
  private retryCount = 0;
  private isInitialized = false;

  constructor() {
    this.persistentQueue = new PersistentQueue();
  }

  /**
   * Initialize logging service
   * - Checks if backend has data collection enabled
   * - Sets up auto-flush timer
   * - Loads/generates user ID
   * - Sets game version from package.json
   * - Migrates legacy logs if found
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.log('[Logging] Already initialized');
      return;
    }

    console.log('[Logging] Initializing...');

    try {
      // Migrate legacy queue if exists
      this.migrateLegacyQueue();

      // Check if backend has data collection enabled
      const statusResponse = await fetch('/api/log/status');
      const status: LoggingStatusResponse = await statusResponse.json();

      if (!status.enabled) {
        console.log('[Logging] Data collection is disabled on backend');
        // Note: Frontend always tries to log (unless debug mode), backend controls actual storage
        return;
      }

      // Ensure user ID exists (generate if needed)
      const userId = ensureUserId();

      // Set default treatment from backend
      const { treatment, setTreatment } = useLoggingStore.getState();
      if (!treatment || treatment === 'control') {
        setTreatment(status.defaultTreatment);
      }

      // Set game version from package.json
      useLoggingStore.setState({ gameVersion: packageJson.version });

      // Mark as initialized
      useLoggingStore.setState({ isInitialized: true });
      this.isInitialized = true;

      // Start auto-flush timer
      this.startAutoFlush();

      console.log('[Logging] ✅ Initialized (userId:', userId, ')');

      // If we have logs, try to flush them immediately
      if (this.persistentQueue.length > 0) {
        console.log(`[Logging] Flushing ${this.persistentQueue.length} pending logs`);
        this.flush();
      }

    } catch (error) {
      console.error('[Logging] Initialization failed:', error);
      // Note: Data collection stays enabled even if init fails (backend may be down temporarily)
    }
  }

  /**
   * Start a new game session
   * Generates sessionId and logs session start event
   */
  async startSession(): Promise<string | null> {
    const { userId, gameVersion, treatment } = useLoggingStore.getState();

    if (!userId) {
      console.log('[Logging] Session start skipped (no userId)');
      return null;
    }

    try {
      const request: SessionStartRequest = {
        userId,
        gameVersion,
        treatment
      };

      const response = await fetch('/api/log/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Session start failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.sessionId) {
        useLoggingStore.setState({ sessionId: data.sessionId });
        console.log('[Logging] ✅ Session started:', data.sessionId);
        return data.sessionId;
      } else {
        throw new Error('Session start returned no sessionId');
      }

    } catch (error) {
      console.error('[Logging] Session start failed:', error);
      return null;
    }
  }

  /**
   * End current session
   * Logs session end event and flushes remaining logs
   */
  async endSession(): Promise<void> {
    const { sessionId } = useLoggingStore.getState();

    if (!sessionId) {
      console.log('[Logging] No active session to end');
      return;
    }

    // Log session end event (sessionId already in top-level batch field)
    this.log('session_end', true, 'User completed or abandoned game session');

    // Flush remaining logs
    await this.flush(true);

    // Clear session ID
    useLoggingStore.setState({ sessionId: null });

    console.log('[Logging] ✅ Session ended');
  }

  /**
   * Log an event
   * Adds log entry to queue (persistent) and triggers flush if needed
   */
  log(
    action: string,
    value: string | number | boolean | Record<string, unknown>,
    comments?: string,
    metadata?: { screen?: string; day?: number; role?: string }
  ): void {
    this._logInternal('player', action, value, comments, metadata);
  }

  /**
   * Log a system event
   */
  logSystem(
    action: string,
    value: string | number | boolean | Record<string, unknown>,
    comments?: string,
    metadata?: { screen?: string; day?: number; role?: string }
  ): void {
    this._logInternal('system', action, value, comments, metadata);
  }

  /**
   * Internal logging implementation
   */
  private _logInternal(
    source: 'player' | 'system',
    action: string,
    value: string | number | boolean | Record<string, unknown>,
    comments?: string,
    metadata?: { screen?: string; day?: number; role?: string }
  ): void {
    const { userId, gameVersion, treatment } = useLoggingStore.getState();

    if (!userId) {
      return;
    }

    // Create log entry with flat structure (all fields at top level)
    const entryValue =
      typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : value;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      userId,
      gameVersion,
      treatment,
      source,
      action,
      value: entryValue as LogEntry['value'],
      currentScreen: metadata?.screen,
      day: metadata?.day,
      role: metadata?.role,
      comments
    };

    // Add into persistent queue (writes to localStorage immediately)
    this.persistentQueue.add(entry);

    // Check if we should flush immediately (batch size)
    // Note: PersistentQueue handles its own size limits
    if (this.persistentQueue.length >= BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Flush queued logs to backend
   * Sends logs in batches, retries on failure with exponential backoff
   * Uses Atomic Flush (remove only on success)
   */
  async flush(force = false): Promise<void> {
    // Skip if already flushing (prevent concurrent flushes)
    if (this.isFlushing && !force) {
      return;
    }

    // Skip if queue is empty
    if (this.persistentQueue.length === 0) {
      return;
    }

    const { sessionId } = useLoggingStore.getState();

    this.isFlushing = true;

    // Peek logs (don't remove yet)
    let logsToSend: LogEntry[] = [];

    try {
      logsToSend = this.persistentQueue.peek(BATCH_SIZE);

      if (logsToSend.length === 0) {
        this.isFlushing = false;
        return;
      }

      // Prepare request
      const request: BatchLogRequest = {
        logs: logsToSend,
        sessionId: sessionId || undefined
      };

      // Send to backend with keepalive
      const response = await fetch('/api/log/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        keepalive: true // CRITICAL: Ensures request survives page unload
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error: any = new Error(`Batch log failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
        error.status = response.status;
        error.errorData = errorData;
        throw error;
      }

      const data = await response.json();

      if (data.success) {
        console.log(`[Logging] ✅ Flushed ${logsToSend.length} logs`);

        // SUCCESS: Remove logs from persistent queue
        this.persistentQueue.remove(logsToSend.length);

        this.retryCount = 0;  // Reset retry counter
      } else {
        throw new Error(`Batch log failed: ${data.error || 'Unknown error'}`);
      }

    } catch (error: any) {
      console.error('[Logging] Flush failed:', error);

      // Handle 429 rate limit errors specifically
      if (error.status === 429) {
        const errorMessage = error.errorData?.error || error.message;

        // Check if it's a session limit error (should stop logging)
        if (errorMessage.includes('session') || errorMessage.includes('Max logs per session')) {
          console.warn('[Logging] ⚠️ Session log limit reached (1000 logs) - stopping further logging');
          this.isFlushing = false;
          return;  // Stop logging for this session
        }

        // Rate limit by IP delay
        if (errorMessage.includes('IP') || errorMessage.includes('Too many requests')) {
          console.warn('[Logging] ⚠️ Rate limited - pausing');
          this.isFlushing = false;
          return;
        }
      }

      // FAILURE: Do NOT remove logs. They stay in PersistentQueue.
      // Retry with exponential backoff
      if (this.retryCount < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[this.retryCount];
        this.retryCount++;

        console.log(`[Logging] 🔄 Retrying in ${delay}ms...`);

        setTimeout(() => {
          this.flush(true);
        }, delay);
      } else {
        const maxDelay = RETRY_DELAYS[RETRY_DELAYS.length - 1];
        console.log(`[Logging] ⏳ Max retry attempts reached - pausing retry for ${maxDelay}ms`);
        setTimeout(() => {
          this.retryCount = RETRY_DELAYS.length - 1;
          this.flush(true);
        }, maxDelay);
      }
    } finally {
      this.isFlushing = false;
    }

    // If queue still has logs, flush again
    if (this.persistentQueue.length > 0 && this.retryCount === 0) {
      this.flush();
    }
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = window.setInterval(() => {
      if (this.persistentQueue.length > 0) {
        this.flush();
      }
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * Migrate legacy queue from old localStorage key
   */
  private migrateLegacyQueue(): void {
    try {
      const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!stored) return;

      const queueData = JSON.parse(stored);
      if (queueData.logs && Array.isArray(queueData.logs) && queueData.logs.length > 0) {
        console.log(`[Logging] Migrating ${queueData.logs.length} legacy logs...`);
        this.persistentQueue.import(queueData.logs);
      }

      // Clear legacy
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      console.log('[Logging] Legacy queue migrated and cleared');
    } catch (e) {
      console.error('[Logging] Migration failed', e);
    }
  }

  /**
   * Get current queue (for debugging)
   */
  getQueue(): LogEntry[] {
    return this.persistentQueue.getAll();
  }

  /**
   * Clear queue (for debugging)
   */
  clearQueue(): void {
    // This isn't directly exposed on persistentQueue for safety, but we can simulate
    // In strict mode we might not want this, but for debug it's fine.
    // For now, let's just log warning.
    console.warn('[Logging] Clear queue not supported in robust mode');
  }

  /**
   * Set treatment condition
   */
  setTreatment(treatment: string): void {
    useLoggingStore.setState({ treatment });
    console.log('[Logging] Treatment set to:', treatment);
  }

  /**
   * Manual flush trigger
   */
  forceFlush(): void {
    console.log('[Logging] Force flushing...');
    this.flush(true);
  }
}

// Singleton instance
export const loggingService = new LoggingService();

// Browser close handler - flush logs before page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Use sendBeacon for reliable delivery on page unload
    // Actually, with keepalive in flush(), we can just call flush()
    // But sendBeacon is still safer for unload in some browsers.
    // However, our plan was to use keepalive. Let's stick to flush(true) with keepalive.
    // Also, flush is async but keepalive fetches run in background.

    // Trigger flush - the fetch inside uses keepalive
    loggingService.forceFlush();
  });

  // Expose debug methods to window for testing
  (window as any).loggingService = {
    getQueue: () => loggingService.getQueue(),
    flush: () => loggingService.forceFlush(),
    getQueueLength: () => loggingService.getQueue().length
  };
}
