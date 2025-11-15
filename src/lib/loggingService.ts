// src/lib/loggingService.ts
// Centralized logging service for data collection
//
// Features:
// - Queue management (batches logs locally)
// - Background sync (auto-flush every 5 seconds or 50 logs)
// - Retry logic with exponential backoff
// - Offline support (queues logs when offline)
// - Non-blocking (never blocks UI)

import { useLoggingStore, ensureUserId } from '../store/loggingStore';
import type { LogEntry, BatchLogRequest, SessionStartRequest, LoggingStatusResponse } from '../types/logging';
import packageJson from '../../package.json';

// Configuration
const BATCH_SIZE = 50;              // Max logs per batch
const FLUSH_INTERVAL_MS = 5000;     // Auto-flush every 5 seconds
const MAX_QUEUE_SIZE = 200;         // Max logs in queue (prevent memory leak)
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000];  // Exponential backoff (up to 16s)
const QUEUE_STORAGE_KEY = 'logging_queue_backup';  // localStorage key for queue backup

class LoggingService {
  private queue: LogEntry[] = [];
  private flushTimer: number | null = null;
  private isFlushing = false;
  private retryCount = 0;
  private isInitialized = false;

  /**
   * Initialize logging service
   * - Checks if backend has data collection enabled
   * - Sets up auto-flush timer
   * - Loads/generates user ID
   * - Sets game version from package.json
   * - Restores any queued logs from localStorage
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.log('[Logging] Already initialized');
      return;
    }

    console.log('[Logging] Initializing...');

    try {
      // Restore queue from localStorage if it exists
      this.restoreQueue();

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

      // If we restored logs, try to flush them
      if (this.queue.length > 0) {
        console.log(`[Logging] Flushing ${this.queue.length} restored logs`);
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
    await this.flush();

    // Clear session ID
    useLoggingStore.setState({ sessionId: null });

    console.log('[Logging] ✅ Session ended');
  }

  /**
   * Log an event
   * Adds log entry to queue and triggers flush if queue is full
   *
   * @param action - Action name (e.g., "button_click", "role_confirm")
   * @param value - Simple value (string, number, or boolean) - e.g., button name, role name
   * @param comments - Optional human-readable description
   * @param metadata - Optional metadata (screen, day, role)
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
   * Similar to log() but marks the source as 'system' instead of 'player'
   * Used for logging game events not directly triggered by player actions
   * (e.g., questions presented, AI-generated content displayed)
   *
   * @param action - Action name (e.g., "mirror_question_1", "mirror_summary_presented")
   * @param value - Simple value (string, number, or boolean)
   * @param comments - Optional human-readable description
   * @param metadata - Optional metadata (screen, day, role)
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
   * Shared by both log() and logSystem()
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
      // Silently skip if no userId (not initialized)
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
      value: entryValue as LogEntry['value'],                          // Simple value (stringified if object)
      currentScreen: metadata?.screen,
      day: metadata?.day,
      role: metadata?.role,
      comments
    };

    // Add to queue
    this.queue.push(entry);

    // Check queue size
    if (this.queue.length >= BATCH_SIZE) {
      // Queue is full - flush immediately
      this.flush();
    } else if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Queue overflow - drop oldest logs
      console.warn('[Logging] Queue overflow - dropping oldest logs');
      this.queue = this.queue.slice(-BATCH_SIZE);
    }
  }

  /**
   * Flush queued logs to backend
   * Sends logs in batches, retries on failure with exponential backoff
   * Persists failed logs to localStorage for recovery
   */
  async flush(force = false): Promise<void> {
    // Skip if already flushing (prevent concurrent flushes)
    if (this.isFlushing && !force) {
      return;
    }

    // Skip if queue is empty
    if (this.queue.length === 0) {
      return;
    }

    const { sessionId } = useLoggingStore.getState();

    this.isFlushing = true;

    try {
      // Take logs from queue (up to BATCH_SIZE)
      const logsToSend = this.queue.splice(0, BATCH_SIZE);

      // Prepare request
      const request: BatchLogRequest = {
        logs: logsToSend,
        sessionId: sessionId || undefined
      };

      // Send to backend
      const response = await fetch('/api/log/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Batch log failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`[Logging] ✅ Flushed ${data.inserted} logs (verified: ${data.allInserted ? 'yes' : 'partial'})`);
        this.retryCount = 0;  // Reset retry counter on success
        this.clearPersistedQueue();  // Clear localStorage backup on success
      } else {
        throw new Error(`Batch log failed: ${data.error || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('[Logging] Flush failed:', error);

      // Put logs back at the front of the queue for retry
      this.queue.unshift(...logsToSend);

      // Persist queue to localStorage for recovery
      this.persistQueue();

      // Retry with exponential backoff (unlimited retries with increasing delays)
      if (this.retryCount < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[this.retryCount];
        this.retryCount++;

        console.log(`[Logging] 🔄 Retrying in ${delay}ms (attempt ${this.retryCount}/${RETRY_DELAYS.length})...`);

        setTimeout(() => {
          this.flush(true);
        }, delay);
      } else {
        // Max specific retries exceeded - continue trying but with maximum delay
        const maxDelay = RETRY_DELAYS[RETRY_DELAYS.length - 1];
        console.log(`[Logging] ⏳ Max retry attempts reached - will retry in ${maxDelay}ms...`);

        setTimeout(() => {
          this.retryCount = RETRY_DELAYS.length - 1;  // Keep at max delay
          this.flush(true);
        }, maxDelay);
      }
    } finally {
      this.isFlushing = false;
    }

    // If queue still has logs, flush again (after current batch succeeds/retries)
    if (this.queue.length > 0 && this.retryCount === 0) {
      this.flush();
    }
  }

  /**
   * Start auto-flush timer
   * Flushes queue every FLUSH_INTERVAL_MS
   */
  private startAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = window.setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, FLUSH_INTERVAL_MS);

    console.log('[Logging] Auto-flush enabled (every 5s)');
  }

  /**
   * Persist queue to localStorage
   * Called when flush fails to ensure logs aren't lost
   */
  private persistQueue(): void {
    try {
      if (this.queue.length === 0) return;

      const queueData = {
        timestamp: Date.now(),
        logs: this.queue
      };

      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queueData));
      console.log(`[Logging] 💾 Persisted ${this.queue.length} logs to localStorage`);
    } catch (error) {
      console.error('[Logging] Failed to persist queue:', error);
    }
  }

  /**
   * Restore queue from localStorage
   * Called on init to recover logs from previous session
   */
  private restoreQueue(): void {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (!stored) return;

      const queueData = JSON.parse(stored);

      // Check if backup is recent (within 24 hours)
      const age = Date.now() - queueData.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (age > maxAge) {
        console.log('[Logging] ⏰ Discarding old queue backup (age:', Math.round(age / 1000 / 60), 'minutes)');
        localStorage.removeItem(QUEUE_STORAGE_KEY);
        return;
      }

      // Restore logs
      this.queue = queueData.logs || [];
      console.log(`[Logging] ♻️ Restored ${this.queue.length} logs from localStorage`);
    } catch (error) {
      console.error('[Logging] Failed to restore queue:', error);
      // Clear corrupted data
      localStorage.removeItem(QUEUE_STORAGE_KEY);
    }
  }

  /**
   * Clear persisted queue from localStorage
   * Called after successful flush
   */
  private clearPersistedQueue(): void {
    try {
      localStorage.removeItem(QUEUE_STORAGE_KEY);
    } catch (error) {
      console.error('[Logging] Failed to clear persisted queue:', error);
    }
  }

  /**
   * Get current queue (for debugging)
   */
  getQueue(): LogEntry[] {
    return [...this.queue];
  }

  /**
   * Clear queue (for debugging)
   */
  clearQueue(): void {
    this.queue = [];
    this.clearPersistedQueue();
    console.log('[Logging] Queue cleared');
  }

  /**
   * Set treatment condition
   * Used for A/B testing
   */
  setTreatment(treatment: string): void {
    useLoggingStore.setState({ treatment });
    console.log('[Logging] Treatment set to:', treatment);
  }

  /**
   * Manual flush trigger (for debugging/testing)
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
    const { sessionId } = useLoggingStore.getState();

    if (loggingService.getQueue().length > 0) {
      const queue = loggingService.getQueue();

      // Prepare batch request
      const request: BatchLogRequest = {
        logs: queue,
        sessionId: sessionId || undefined
      };

      // Use sendBeacon (more reliable than fetch on unload)
      const blob = new Blob([JSON.stringify(request)], { type: 'application/json' });
      navigator.sendBeacon('/api/log/batch', blob);

      console.log('[Logging] Emergency flush via sendBeacon');
    }
  });

  // Expose debug methods to window for testing
  (window as any).loggingService = {
    getQueue: () => loggingService.getQueue(),
    clearQueue: () => loggingService.clearQueue(),
    flush: () => loggingService.forceFlush(),
    getQueueLength: () => loggingService.getQueue().length
  };

  console.log('[Logging] Debug commands available: window.loggingService');
}
