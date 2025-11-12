// server/db/mongodb.mjs
// MongoDB connection manager for data logging system
//
// Handles:
// - Connection pooling
// - Automatic reconnection
// - Graceful error handling
// - Collection access

import { MongoClient } from 'mongodb';

let client = null;
let db = null;
let isConnecting = false;
let lastHealthCheck = null;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Connect to MongoDB
 * Uses connection pooling - subsequent calls return cached connection
 *
 * @returns {Promise<Db>} MongoDB database instance
 * @throws {Error} If MONGODB_URI is not set or connection fails
 */
export async function connectDB() {
  // Return existing connection if available
  if (db) return db;

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    // Wait for existing connection attempt
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (db) return db;
  }

  isConnecting = true;

  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    console.log('[MongoDB] Connecting to database...');

    // Create new client with recommended options
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000, // Check connection health every 10s
      retryWrites: true,
      retryReads: true,
    });

    // Connect to MongoDB
    await client.connect();

    // Get database instance
    db = client.db('amaze-politics');

    console.log('[MongoDB] ✅ Connected successfully');

    // Set up connection event handlers
    setupConnectionHandlers();

    // Create indexes if they don't exist
    await createIndexes();

    // Mark last health check
    lastHealthCheck = Date.now();

    isConnecting = false;
    return db;

  } catch (error) {
    isConnecting = false;
    console.error('[MongoDB] ❌ Connection failed:', error.message);
    throw error;
  }
}

/**
 * Set up connection event handlers for automatic reconnection
 */
function setupConnectionHandlers() {
  if (!client) return;

  client.on('close', () => {
    console.warn('[MongoDB] ⚠️ Connection closed - will reconnect on next operation');
    db = null;
    client = null;
    lastHealthCheck = null;
  });

  client.on('error', (error) => {
    console.error('[MongoDB] ❌ Connection error:', error.message);
    db = null;
    client = null;
    lastHealthCheck = null;
  });

  client.on('timeout', () => {
    console.warn('[MongoDB] ⚠️ Connection timeout - will reconnect on next operation');
    db = null;
    client = null;
    lastHealthCheck = null;
  });
}

/**
 * Check if MongoDB connection is healthy
 * Performs periodic ping to ensure connection is alive
 *
 * @returns {Promise<boolean>} True if connection is healthy
 */
async function isConnectionHealthy() {
  if (!db || !client) return false;

  // If health check was recent, assume healthy
  const now = Date.now();
  if (lastHealthCheck && (now - lastHealthCheck) < HEALTH_CHECK_INTERVAL) {
    return true;
  }

  try {
    // Ping database to verify connection
    await db.admin().ping();
    lastHealthCheck = now;
    return true;
  } catch (error) {
    console.warn('[MongoDB] ⚠️ Health check failed:', error.message);
    // Clear stale connection
    db = null;
    client = null;
    lastHealthCheck = null;
    return false;
  }
}

/**
 * Ensure MongoDB connection is healthy, reconnect if needed
 *
 * @returns {Promise<Db>} MongoDB database instance
 */
async function ensureConnection() {
  const isHealthy = await isConnectionHealthy();

  if (!isHealthy) {
    console.log('[MongoDB] Reconnecting due to unhealthy connection...');
    return await connectDB();
  }

  return db;
}

/**
 * Create recommended indexes for collections
 * Improves query performance for common operations
 */
async function createIndexes() {
  try {
    // gameLogs collection
    const logsCollection = db.collection('gameLogs');
    await logsCollection.createIndex({ userId: 1, timestamp: -1 }, { name: 'userId_timestamp', background: true });
    await logsCollection.createIndex({ treatment: 1 }, { name: 'treatment', background: true });
    await logsCollection.createIndex({ action: 1 }, { name: 'action', background: true });

    // counters collection
    const countersCollection = db.collection('counters');
    await countersCollection.createIndex({ name: 1 }, { name: 'name', unique: true, background: true });

    // users collection
    const usersCollection = db.collection('users');
    await usersCollection.createIndex({ userId: 1 }, { name: 'userId_unique', unique: true, background: true });
    await usersCollection.createIndex({ treatment: 1 }, { name: 'treatment', background: true });
    await usersCollection.createIndex({ createdAt: -1 }, { name: 'createdAt', background: true });

    console.log('[MongoDB] ✅ Indexes created/verified');
  } catch (error) {
    console.warn('[MongoDB] ⚠️ Index creation failed (non-critical):', error.message);
  }
}

/**
 * Get gameLogs collection
 * Automatically connects to database if not connected
 * Ensures connection is healthy before returning collection
 *
 * @returns {Promise<Collection>} MongoDB collection instance
 */
export async function getLogsCollection() {
  const database = await ensureConnection();
  return database.collection('gameLogs');
}

/**
 * Get counters collection
 * Automatically connects to database if not connected
 * Ensures connection is healthy before returning collection
 *
 * @returns {Promise<Collection>} MongoDB collection instance
 */
export async function getCountersCollection() {
  const database = await ensureConnection();
  return database.collection('counters');
}

/**
 * Get users collection
 * Automatically connects to database if not connected
 * Ensures connection is healthy before returning collection
 *
 * @returns {Promise<Collection>} MongoDB collection instance
 */
export async function getUsersCollection() {
  const database = await ensureConnection();
  return database.collection('users');
}

/**
 * Atomically increment a named counter by 1
 *
 * @param {string} name - The name of the counter to increment
 * @returns {Promise<number>} The new value of the counter
 */
export async function incrementCounter(name) {
  try {
    const collection = await getCountersCollection();
    const result = await collection.findOneAndUpdate(
      { name },
      { $inc: { value: 1 } },
      { returnDocument: 'after', upsert: true }
    );
    return result.value;
  } catch (error) {
    console.error(`[MongoDB] ❌ Failed to increment counter "${name}":`, error.message);
    throw error;
  }
}

/**
 * Close MongoDB connection
 * Should be called on server shutdown
 */
export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[MongoDB] Connection closed');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await closeDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDB();
  process.exit(0);
});
