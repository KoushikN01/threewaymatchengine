import mongoose from 'mongoose'

/**
 * Database connection handler.
 * Establishes connection to MongoDB using the MONGODB_URI environment variable.
 * Includes error handling and connection event logging.
 */

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/reconciliation'

export async function connectDatabase() {
  try {
    if (mongoose.connection.readyState === 1) {
      console.log('[DB] Already connected')
      return mongoose.connection
    }

    console.log('[DB] Connecting to MongoDB...')
    await mongoose.connect(mongoUri)
    console.log('[DB] Connected successfully')

    // Asynchronously attempt to drop legacy unique index if present
    if (mongoose.connection.db) {
      mongoose.connection.db.collection('purchaseorders').dropIndex('poNumber_1').catch(() => {})
    }

    mongoose.connection.on('error', (error) => {
      console.error('[DB] Connection error:', error.message)
    })

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] Disconnected from MongoDB')
    })

    return mongoose.connection
  } catch (error) {
    console.error('[DB] Connection failed:', error instanceof Error ? error.message : String(error))
    throw error
  }
}

export async function closeDatabase() {
  try {
    await mongoose.disconnect()
    console.log('[DB] Disconnected')
  } catch (error) {
    console.error('[DB] Disconnect error:', error instanceof Error ? error.message : String(error))
    throw error
  }
}
