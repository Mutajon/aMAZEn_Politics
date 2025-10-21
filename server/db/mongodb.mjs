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
 * Create recommended indexes for gameLogs collection
 * Improves query performance for common operations
 */
async function createIndexes() {
  try {
    const collection = db.collection('gameLogs');

    // Index for finding user logs sorted by time
    await collection.createIndex(
      { userId: 1, timestamp: -1 },
      { name: 'userId_timestamp', background: true }
    );

    // Index for filtering by treatment
    await collection.createIndex(
      { treatment: 1 },
      { name: 'treatment', background: true }
    );

    // Index for filtering by action type
    await collection.createIndex(
      { action: 1 },
      { name: 'action', background: true }
    );

    console.log('[MongoDB] ✅ Indexes created/verified');
  } catch (error) {
    // Indexes are optional - don't fail if they can't be created
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
