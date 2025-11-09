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
    });

    // Connect to MongoDB
    await client.connect();

    // Get database instance
    db = client.db('amaze-politics');

    console.log('[MongoDB] ✅ Connected successfully');

    // Create indexes if they don't exist
    await createIndexes();

    isConnecting = false;
    return db;

  } catch (error) {
    isConnecting = false;
    console.error('[MongoDB] ❌ Connection failed:', error.message);
    throw error;
  }
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

    console.log('[MongoDB] ✅ Indexes created/verified');
  } catch (error) {
    console.warn('[MongoDB] ⚠️ Index creation failed (non-critical):', error.message);
  }
}

/**
 * Get gameLogs collection
 * Automatically connects to database if not connected
 *
 * @returns {Promise<Collection>} MongoDB collection instance
 */
export async function getLogsCollection() {
  const database = await connectDB();
  return database.collection('gameLogs');
}

/**
 * Get counters collection
 * Automatically connects to database if not connected
 *
 * @returns {Promise<Collection>} MongoDB collection instance
 */
export async function getCountersCollection() {
  const database = await connectDB();
  return database.collection('counters');
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
