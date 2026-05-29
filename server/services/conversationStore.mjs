// server/services/conversationStore.mjs
// Persistent conversation store for OpenAI/Gemini Responses API in MongoDB
// Maps gameId → conversation metadata
//
// Optimized for stateless serverless deployment (Vercel)

import { getDb } from "../db/mongodb.mjs";

// Auto-cleanup is handled by MongoDB TTL index, but we keep a safety check
const CONVERSATION_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * @typedef {Object} ConversationMetadata
 * @property {string} gameId - Unique game identifier
 * @property {string} conversationId - API conversation ID
 * @property {string} provider - 'openai', 'anthropic', or 'gemini'
 * @property {Date} createdAt - Timestamp
 * @property {Date} lastUsedAt - Timestamp
 * @property {number} turnCount - Number of turns in this conversation
 * @property {object} meta - Additional game metadata (challengerSeat, supportProfiles, etc.)
 */

/**
 * Store a new conversation
 * @param {string} gameId - Unique game identifier
 * @param {string} conversationId - OpenAI Responses API conversation ID
 * @param {string} provider - AI provider ('openai', 'anthropic', or 'gemini')
 * @param {object} customMeta - Optional custom metadata
 */
export async function storeConversation(gameId, conversationId, provider = 'openai', customMeta = null) {
  try {
    const db = await getDb();
    const collection = db.collection('conversations');

    const existing = await collection.findOne({ gameId });

    const metadata = {
      gameId,
      conversationId,
      provider,
      createdAt: existing ? existing.createdAt : new Date(),
      lastUsedAt: new Date(),
      turnCount: (existing ? existing.turnCount : 0) + 1,
      meta: customMeta || (existing ? existing.meta : {})
    };

    await collection.replaceOne({ gameId }, metadata, { upsert: true });
    console.log(`[conversationStore] Stored conversation in MongoDB for gameId=${gameId}, provider=${provider}`);
  } catch (error) {
    console.error(`[conversationStore] ❌ Error storing conversation for gameId=${gameId}:`, error.message);
  }
}

/**
 * Get conversation metadata for a game
 * @param {string} gameId - Unique game identifier
 * @returns {Promise<ConversationMetadata | null>}
 */
export async function getConversation(gameId) {
  try {
    const db = await getDb();
    const collection = db.collection('conversations');
    const metadata = await collection.findOne({ gameId });

    if (!metadata) {
      return null;
    }

    // Double check expiration safety limit
    const age = Date.now() - new Date(metadata.createdAt).getTime();
    if (age > CONVERSATION_TTL) {
      console.log(`[conversationStore] Conversation expired for gameId=${gameId} (age=${Math.round(age / 1000 / 60)}min)`);
      await collection.deleteOne({ gameId });
      return null;
    }

    return metadata;
  } catch (error) {
    console.error(`[conversationStore] ❌ Error getting conversation for gameId=${gameId}:`, error.message);
    return null;
  }
}

/**
 * Update last used timestamp and increment turn count
 * @param {string} gameId - Unique game identifier
 */
export async function touchConversation(gameId) {
  try {
    const db = await getDb();
    const collection = db.collection('conversations');
    await collection.updateOne(
      { gameId },
      {
        $set: { lastUsedAt: new Date() },
        $inc: { turnCount: 1 }
      }
    );
  } catch (error) {
    console.error(`[conversationStore] ❌ Error touching conversation for gameId=${gameId}:`, error.message);
  }
}

/**
 * Update conversation metadata (partial update)
 * @param {string} gameId
 * @param {object} partialMeta 
 */
export async function updateConversation(gameId, partialMeta) {
  try {
    const db = await getDb();
    const collection = db.collection('conversations');
    const existing = await collection.findOne({ gameId });
    if (existing) {
      const updatedMeta = { ...(existing.meta || {}), ...partialMeta };
      await collection.updateOne(
        { gameId },
        {
          $set: {
            lastUsedAt: new Date(),
            meta: updatedMeta
          }
        }
      );
    }
  } catch (error) {
    console.error(`[conversationStore] ❌ Error updating conversation for gameId=${gameId}:`, error.message);
  }
}

/**
 * Delete a conversation (cleanup on game end)
 * @param {string} gameId - Unique game identifier
 */
export async function deleteConversation(gameId) {
  try {
    const db = await getDb();
    const collection = db.collection('conversations');
    const result = await collection.deleteOne({ gameId });
    if (result.deletedCount > 0) {
      console.log(`[conversationStore] Deleted conversation for gameId=${gameId} from MongoDB`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[conversationStore] ❌ Error deleting conversation for gameId=${gameId}:`, error.message);
    return false;
  }
}

/**
 * Get conversation statistics (for monitoring)
 * @returns {Promise<{total: number, byProvider: object}>}
 */
export async function getStats() {
  try {
    const db = await getDb();
    const collection = db.collection('conversations');
    const total = await collection.countDocuments();
    
    // Simple count of providers
    const openai = await collection.countDocuments({ provider: 'openai' });
    const anthropic = await collection.countDocuments({ provider: 'anthropic' });
    const gemini = await collection.countDocuments({ provider: 'gemini' });
    
    return {
      total,
      byProvider: { openai, anthropic, gemini }
    };
  } catch (error) {
    console.error('[conversationStore] ❌ Error getting stats:', error.message);
    return { total: 0, byProvider: { openai: 0, anthropic: 0, gemini: 0 } };
  }
}

/**
 * Periodic cleanup of expired conversations (no-op on Vercel)
 * MongoDB TTL index handles deletion automatically.
 */
export function startCleanupTask() {
  console.log('[conversationStore] Vercel mode: Cleanup task managed by MongoDB TTL index (24h)');
}
