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

// Configuration
const BATCH_SIZE = 50;              // Max logs per batch
const FLUSH_INTERVAL_MS = 5000;     // Auto-flush every 5 seconds
const MAX_QUEUE_SIZE = 200;         // Max logs in queue (prevent memory leak)
const RETRY_DELAYS = [1000, 2000, 4000, 8000];  // Exponential backoff

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
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.log('[Logging] Already initialized');
      return;
    }

    console.log('[Logging] Initializing...');

    try {
      // Check if backend has data collection enabled
      const statusResponse = await fetch('/api/log/status');
      const status: LoggingStatusResponse = await statusResponse.json();

      if (!status.enabled) {
        console.log('[Logging] Data collection is disabled on backend');
        useLoggingStore.setState({ enabled: false });
        return;
      }

      // Ensure user ID exists (generate if needed)
      const userId = ensureUserId();

      // Set default treatment from backend
      const { treatment, setTreatment } = useLoggingStore.getState();
      if (!treatment || treatment === 'control') {
        setTreatment(status.defaultTreatment);
      }

      // Set game version (hardcoded for now, can be fetched from package.json)
      useLoggingStore.setState({ gameVersion: '0.0.0' });

      // Mark as initialized
      useLoggingStore.setState({ isInitialized: true });
      this.isInitialized = true;

      // Start auto-flush timer
      this.startAutoFlush();

      console.log('[Logging] ✅ Initialized (userId:', userId, ')');

    } catch (error) {
      console.error('[Logging] Initialization failed:', error);
      useLoggingStore.setState({ enabled: false });
    }
  }

  /**
   * Start a new game session
   * Generates sessionId and logs session start event
   */
  async startSession(): Promise<string | null> {
    const { enabled, userId, gameVersion, treatment } = useLoggingStore.getState();

    if (!enabled || !userId) {
      console.log('[Logging] Session start skipped (logging disabled or no userId)');
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

    // Log session end event
    this.log('session_end', { sessionId }, 'User completed or abandoned game session');

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
   * @param action - Action name (e.g., "button_click_start_game")
   * @param value - Action-specific data (flexible schema)
   * @param comments - Optional human-readable description
   * @param metadata - Optional metadata (screen, day, role)
   */
  log(
    action: string,
    value: any = {},
    comments?: string,
    metadata?: { screen?: string; day?: number; role?: string }
  ): void {
    const { enabled, userId, gameVersion, treatment } = useLoggingStore.getState();

    if (!enabled || !userId) {
      // Silently skip if logging is disabled
      return;
    }

    // Create log entry
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      userId,
      gameVersion,
      treatment,
      source: 'player',  // Phase 1: only player events
      action,
      value: {
        ...value,
        ...metadata  // Merge metadata into value
      },
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
   * Sends logs in batches, retries on failure
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

    const { enabled, sessionId } = useLoggingStore.getState();

    if (!enabled) {
      // If logging was disabled, clear queue
      this.queue = [];
      return;
    }

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
        throw new Error(`Batch log failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`[Logging] ✅ Flushed ${data.inserted} logs`);
        this.retryCount = 0;  // Reset retry counter on success
      } else {
        throw new Error(`Batch log failed: ${data.error || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('[Logging] Flush failed:', error);

      // Retry with exponential backoff
      if (this.retryCount < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[this.retryCount];
        this.retryCount++;

        console.log(`[Logging] Retrying in ${delay}ms (attempt ${this.retryCount})...`);

        setTimeout(() => {
          this.flush(true);
        }, delay);
      } else {
        console.error('[Logging] Max retries exceeded - dropping logs');
        this.retryCount = 0;
      }
    } finally {
      this.isFlushing = false;
    }

    // If queue still has logs, flush again
    if (this.queue.length > 0) {
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
   * Stop auto-flush timer
   */
  private stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
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
}

// Singleton instance
export const loggingService = new LoggingService();

// Browser close handler - flush logs before page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Use sendBeacon for reliable delivery on page unload
    const { enabled, sessionId, userId, gameVersion, treatment } = useLoggingStore.getState();

    if (enabled && loggingService.getQueue().length > 0) {
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
}
