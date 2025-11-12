// src/types/logging.ts
// TypeScript types for data logging system

/**
 * Log entry structure
 * Sent to backend and stored in MongoDB
 *
 * IMPORTANT: All fields are flat/simple for easy CSV export
 * - value must be string, number, or boolean (objects are stringified before enqueue)
 * - day and role are separate top-level fields
 */
export interface LogEntry {
  timestamp: Date | string;                // When the event occurred
  userId: string;                          // Anonymous user UUID
  gameVersion: string;                     // From package.json
  treatment: string;                       // Treatment condition (e.g., "control", "experimental_a")
  source: 'player' | 'system';             // Who triggered the event
  action: string;                          // Action name (e.g., "button_click", "role_confirm")
  value: string | number | boolean;        // Simple value (objects are JSON-stringified before enqueue)
  currentScreen?: string;                  // Where action occurred (e.g., "/role", "/event")
  day?: number;                            // Game day (if in gameplay)
  role?: string;                           // Player's selected role (if applicable)
  comments?: string;                       // Human-readable description
}

/**
 * Metadata automatically attached to each log entry
 * Captured from application state at time of logging
 */
export interface LogMetadata {
  screen?: string;    // Current route (e.g., "/role")
  day?: number;       // Game day (if applicable)
  role?: string;      // Selected role (if applicable)
}

/**
 * Batched log request sent to backend
 */
export interface BatchLogRequest {
  logs: LogEntry[];
  sessionId?: string;  // For rate limiting
}

/**
 * Response from batch log endpoint
 */
export interface BatchLogResponse {
  success: boolean;
  inserted?: number;
  errors?: string[];
  error?: string;
}

/**
 * Session start request
 */
export interface SessionStartRequest {
  userId: string;
  gameVersion: string;
  treatment?: string;
}

/**
 * Session start response
 */
export interface SessionStartResponse {
  success: boolean;
  sessionId?: string;
  treatment?: string;
  error?: string;
}

/**
 * Logging status response
 */
export interface LoggingStatusResponse {
  enabled: boolean;
  defaultTreatment: string;
}
