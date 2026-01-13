
import type { LogEntry } from '../types/logging';

const STORAGE_KEY = 'amaze_logging_queue_v2';
const MAX_QUEUE_SIZE_LIMIT = 500; // Hard limit to prevent localStorage quotas issues

export class PersistentQueue {
    private queue: LogEntry[] = [];
    private isInitialized = false;

    constructor() {
        this.restore();
    }

    /**
     * Restore queue from localStorage
     */
    private restore(): void {
        if (this.isInitialized) return;

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    this.queue = parsed;
                    console.log(`[PersistentQueue] Restored ${this.queue.length} logs`);
                }
            }
        } catch (e) {
            console.error('[PersistentQueue] Failed to restore queue:', e);
            // If corrupted, start fresh
            this.queue = [];
        }

        this.isInitialized = true;
    }

    /**
     * Save current queue to localStorage
     */
    private persist(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
        } catch (e) {
            console.error('[PersistentQueue] Failed to persist queue:', e);
            // Potential storage quota exceeded
            if (this.queue.length > 50) {
                console.warn('[PersistentQueue] Storage error, trimming queue...');
                // Emergency trim to try and save latest data
                this.queue = this.queue.slice(-50);
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
                } catch (retryError) {
                    console.error('[PersistentQueue] Retry persist failed:', retryError);
                }
            }
        }
    }

    /**
     * Add entry to queue and persist immediately (Write-Ahead)
     */
    add(entry: LogEntry): void {
        // Prevent unbounded growth
        if (this.queue.length >= MAX_QUEUE_SIZE_LIMIT) {
            // Drop oldest to make room
            this.queue.shift();
        }

        this.queue.push(entry);
        this.persist();
    }

    /**
     * Get first N entries without removing them
     */
    peek(count: number): LogEntry[] {
        return this.queue.slice(0, count);
    }

    /**
     * Remove first N entries and persist
     */
    remove(count: number): void {
        if (count <= 0) return;

        this.queue = this.queue.slice(count);
        this.persist();
    }

    /**
     * Get current queue length
     */
    get length(): number {
        return this.queue.length;
    }

    /**
     * Get all entries (for debug/migration)
     */
    getAll(): LogEntry[] {
        return [...this.queue];
    }

    /**
     * Import logs (e.g. from legacy migration)
     */
    import(logs: LogEntry[]): void {
        this.queue = [...this.queue, ...logs];
        // Enforce limit
        if (this.queue.length > MAX_QUEUE_SIZE_LIMIT) {
            this.queue = this.queue.slice(-MAX_QUEUE_SIZE_LIMIT);
        }
        this.persist();
    }
}
