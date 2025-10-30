// server/conversationStore.mjs
// In-memory conversation store for OpenAI Responses API
// Maps gameId → conversation metadata
//
// For production: Consider moving to Redis/database for persistence
// across server restarts and horizontal scaling

/**
 * @typedef {Object} ConversationMetadata
 * @property {string} conversationId - OpenAI Responses API conversation ID
 * @property {string} provider - 'openai' or 'anthropic'
 * @property {number} createdAt - Unix timestamp
 * @property {number} lastUsedAt - Unix timestamp
 * @property {number} turnCount - Number of turns in this conversation
 * @property {object} meta - Additional game metadata (challengerSeat, supportProfiles, etc.)
 */

// In-memory store
const conversations = new Map();

// Auto-cleanup: Remove conversations older than 24 hours
const CONVERSATION_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Store a new conversation
 * @param {string} gameId - Unique game identifier
 * @param {string} conversationId - OpenAI Responses API conversation ID
 * @param {string} provider - AI provider ('openai' or 'anthropic')
 * @param {object} customMeta - Optional custom metadata (e.g., challengerSeat info)
 */
export function storeConversation(gameId, conversationId, provider = 'openai', customMeta = null) {
  const metadata = {
    conversationId,
    provider,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    turnCount: 0,
    meta: customMeta || {} // Store custom metadata (e.g., challengerSeat)
  };

  conversations.set(gameId, metadata);
  console.log(`[conversationStore] Stored conversation for gameId=${gameId}, provider=${provider}`);
}

/**
 * Get conversation metadata for a game
 * @param {string} gameId - Unique game identifier
 * @returns {ConversationMetadata | null}
 */
export function getConversation(gameId) {
  const metadata = conversations.get(gameId);

  if (!metadata) {
    return null;
  }

  // Check if expired
  const age = Date.now() - metadata.createdAt;
  if (age > CONVERSATION_TTL) {
    console.log(`[conversationStore] Conversation expired for gameId=${gameId} (age=${Math.round(age / 1000 / 60)}min)`);
    conversations.delete(gameId);
    return null;
  }

  return metadata;
}

/**
 * Update last used timestamp and increment turn count
 * @param {string} gameId - Unique game identifier
 */
export function touchConversation(gameId) {
  const metadata = conversations.get(gameId);
  if (metadata) {
    metadata.lastUsedAt = Date.now();
    metadata.turnCount++;
  }
}

/**
 * Delete a conversation (cleanup on game end)
 * @param {string} gameId - Unique game identifier
 */
export function deleteConversation(gameId) {
  const deleted = conversations.delete(gameId);
  if (deleted) {
    console.log(`[conversationStore] Deleted conversation for gameId=${gameId}`);
  }
  return deleted;
}

/**
 * Get conversation statistics (for monitoring)
 * @returns {{total: number, byProvider: object, oldestAge: number}}
 */
export function getStats() {
  const now = Date.now();
  const stats = {
    total: conversations.size,
    byProvider: { openai: 0, anthropic: 0 },
    oldestAge: 0
  };

  for (const [gameId, metadata] of conversations.entries()) {
    stats.byProvider[metadata.provider]++;

    const age = now - metadata.createdAt;
    if (age > stats.oldestAge) {
      stats.oldestAge = age;
    }
  }

  return stats;
}

/**
 * Periodic cleanup of expired conversations (call from server startup)
 */
export function startCleanupTask() {
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [gameId, metadata] of conversations.entries()) {
      const age = now - metadata.createdAt;
      if (age > CONVERSATION_TTL) {
        conversations.delete(gameId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[conversationStore] Cleanup: removed ${cleaned} expired conversations`);
    }
  }, CLEANUP_INTERVAL);

  console.log(`[conversationStore] Cleanup task started (interval=${CLEANUP_INTERVAL / 1000 / 60}min, TTL=${CONVERSATION_TTL / 1000 / 60 / 60}hr)`);
}
