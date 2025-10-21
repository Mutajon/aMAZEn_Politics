// src/dev/loggingDebug.ts
// Debug tools for logging system
// Provides browser console commands for testing and debugging

import { useLoggingStore, resetLoggingStore } from '../store/loggingStore';
import { loggingService } from '../lib/loggingService';

/**
 * Enable logging (for testing)
 */
function enableLogging() {
  const { setEnabled, setConsented } = useLoggingStore.getState();
  setEnabled(true);
  setConsented(true);

  // Initialize if not already initialized
  loggingService.init();

  console.log('[Logging Debug] ✅ Logging enabled');
  console.log('State:', useLoggingStore.getState());
}

/**
 * Disable logging (for testing)
 */
function disableLogging() {
  const { setEnabled } = useLoggingStore.getState();
  setEnabled(false);

  console.log('[Logging Debug] ❌ Logging disabled');
  console.log('State:', useLoggingStore.getState());
}

/**
 * Show current queue (for debugging)
 */
function showLogs() {
  const queue = loggingService.getQueue();
  console.log('[Logging Debug] 📋 Current queue:');
  console.table(queue);
  console.log(`Total: ${queue.length} logs`);
  return queue;
}

/**
 * Force flush logs to backend (for testing)
 */
async function flushLogs() {
  console.log('[Logging Debug] 🚀 Forcing flush...');
  await loggingService.flush(true);
  console.log('[Logging Debug] ✅ Flush complete');
  console.log('Remaining in queue:', loggingService.getQueue().length);
}

/**
 * Clear local queue (for testing)
 */
function clearQueue() {
  loggingService.clearQueue();
  console.log('[Logging Debug] 🗑️ Queue cleared');
}

/**
 * Start a new session (for testing)
 */
async function startSession() {
  console.log('[Logging Debug] 🎮 Starting session...');
  const sessionId = await loggingService.startSession();
  console.log('[Logging Debug] ✅ Session started:', sessionId);
  console.log('State:', useLoggingStore.getState());
  return sessionId;
}

/**
 * End current session (for testing)
 */
async function endSession() {
  console.log('[Logging Debug] 🛑 Ending session...');
  await loggingService.endSession();
  console.log('[Logging Debug] ✅ Session ended');
  console.log('State:', useLoggingStore.getState());
}

/**
 * Test logging with a sample event (for testing)
 */
function testLog() {
  loggingService.log(
    'test_event',
    { testData: 'Hello, World!', timestamp: Date.now() },
    'This is a test log entry from the debug console'
  );
  console.log('[Logging Debug] ✅ Test log added to queue');
  console.log('Queue length:', loggingService.getQueue().length);
}

/**
 * Show current logging state (for debugging)
 */
function showState() {
  const state = useLoggingStore.getState();
  console.log('[Logging Debug] 📊 Current state:');
  console.table({
    enabled: state.enabled,
    consented: state.consented,
    userId: state.userId,
    sessionId: state.sessionId,
    gameVersion: state.gameVersion,
    treatment: state.treatment,
    isInitialized: state.isInitialized,
  });
  return state;
}

/**
 * Reset logging store (for testing)
 * WARNING: This will clear userId and all state
 */
function resetState() {
  resetLoggingStore();
  console.log('[Logging Debug] ♻️ State reset');
  console.log('State:', useLoggingStore.getState());
}

/**
 * Set treatment (for testing)
 */
function setTreatment(treatment: string) {
  loggingService.setTreatment(treatment);
  console.log('[Logging Debug] 🧪 Treatment set to:', treatment);
  console.log('State:', useLoggingStore.getState());
}

/**
 * Generate test session with sample logs (for testing)
 */
async function generateTestSession() {
  console.log('[Logging Debug] 🧪 Generating test session...');

  // Enable logging
  enableLogging();

  // Start session
  await startSession();

  // Generate sample logs
  const actions = [
    { action: 'button_click_start_game', value: { screen: 'splash' }, comments: 'User clicked start' },
    { action: 'role_selected', value: { role: 'Dictator' }, comments: 'User selected role' },
    { action: 'name_entered', value: { name: 'Test User' }, comments: 'User entered name' },
    { action: 'difficulty_selected', value: { difficulty: 'normal' }, comments: 'User selected difficulty' },
    { action: 'action_confirmed', value: { actionId: 1, day: 1 }, comments: 'User confirmed action' },
  ];

  for (const log of actions) {
    loggingService.log(log.action, log.value, log.comments);
  }

  console.log(`[Logging Debug] ✅ Generated ${actions.length} test logs`);
  console.log('Queue:', showLogs());

  // Flush logs
  await flushLogs();

  // End session
  await endSession();

  console.log('[Logging Debug] ✅ Test session complete');
}

// Attach to window for browser console access
export function attachLoggingDebug() {
  if (typeof window !== 'undefined') {
    (window as any).enableLogging = enableLogging;
    (window as any).disableLogging = disableLogging;
    (window as any).showLogs = showLogs;
    (window as any).flushLogs = flushLogs;
    (window as any).clearQueue = clearQueue;
    (window as any).startSession = startSession;
    (window as any).endSession = endSession;
    (window as any).testLog = testLog;
    (window as any).showState = showState;
    (window as any).resetState = resetState;
    (window as any).setTreatment = setTreatment;
    (window as any).generateTestSession = generateTestSession;

    console.log('[Logging Debug] 🛠️ Debug tools attached to window');
    console.log('Available commands:');
    console.log('  enableLogging()        - Enable data collection');
    console.log('  disableLogging()       - Disable data collection');
    console.log('  showLogs()             - Show queued logs');
    console.log('  flushLogs()            - Force send logs to backend');
    console.log('  clearQueue()           - Clear local queue');
    console.log('  startSession()         - Start new session');
    console.log('  endSession()           - End current session');
    console.log('  testLog()              - Add a test log entry');
    console.log('  showState()            - Show current logging state');
    console.log('  resetState()           - Reset logging state (WARNING: clears userId)');
    console.log('  setTreatment(name)     - Set treatment condition');
    console.log('  generateTestSession()  - Generate complete test session with sample data');
  }
}
