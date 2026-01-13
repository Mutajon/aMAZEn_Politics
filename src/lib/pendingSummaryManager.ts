
import type { SessionSummary } from "../hooks/useSessionSummary";

const STORAGE_KEY = 'amaze_pending_summaries';

export class PendingSummaryManager {
    /**
     * Add a summary to the pending queue
     */
    static add(summary: SessionSummary): void {
        try {
            const pending = this.getAll();

            // Check if already exists (prevent duplicates)
            const exists = pending.some(s => s.sessionId === summary.sessionId);
            if (exists) {
                console.log('[PendingSummaryManager] Summary already in queue, updating...', summary.sessionId);
                // Update existing entry
                const updated = pending.map(s => s.sessionId === summary.sessionId ? summary : s);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            } else {
                console.log('[PendingSummaryManager] Adding summary to pending queue', summary.sessionId);
                pending.push(summary);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
            }
        } catch (e) {
            console.error('[PendingSummaryManager] Failed to add summary:', e);
        }
    }

    /**
     * Remove a summary from the pending queue
     */
    static remove(sessionId: string): void {
        try {
            const pending = this.getAll();
            const filtered = pending.filter(s => s.sessionId !== sessionId);

            if (pending.length !== filtered.length) {
                console.log('[PendingSummaryManager] Removed summary from queue', sessionId);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
            }
        } catch (e) {
            console.error('[PendingSummaryManager] Failed to remove summary:', e);
        }
    }

    /**
     * Get all pending summaries
     */
    static getAll(): SessionSummary[] {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('[PendingSummaryManager] Failed to get pending summaries:', e);
            return [];
        }
    }

    /**
     * Check if a summary is pending for a specific session
     */
    static hasPending(sessionId: string): boolean {
        const pending = this.getAll();
        return pending.some(s => s.sessionId === sessionId);
    }

    /**
     * Check if a summary has been marked as successfully sent
     * Uses a separate flag to prevent re-sending on reload
     */
    static isSent(sessionId: string): boolean {
        return localStorage.getItem(`amaze_summary_sent_${sessionId}`) === 'true';
    }

    /**
     * Mark a summary as successfully sent
     */
    static markAsSent(sessionId: string): void {
        localStorage.setItem(`amaze_summary_sent_${sessionId}`, 'true');
    }
}
