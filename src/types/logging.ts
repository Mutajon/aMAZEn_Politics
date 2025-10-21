// src/types/logging.ts
// TypeScript types for data logging system

/**
 * Log entry structure
 * Sent to backend and stored in MongoDB
 */
export interface LogEntry {
  timestamp: Date | string;      // When the event occurred
  userId: string;                // Anonymous user UUID
  gameVersion: string;           // From package.json
  treatment: string;             // Treatment condition (e.g., "control", "experimental_a")
  source: 'player' | 'system';   // Who triggered the event
  action: string;                // Action name (e.g., "button_click_start_game")
  currentScreen?: string;        // Current screen/route (e.g., "/role", "/event")
  value: any;                    // Action-specific data (flexible schema)
  comments?: string;             // Optional human-readable description
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
