import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { connectDatabase, closeDatabase } from './db'
import { PurchaseOrder, Grn, Invoice, MatchAudit } from './models/schemas'

async function reset() {
  try {
    console.log('[RESET] Connecting to database...')
    await connectDatabase()

    await Promise.all([
      PurchaseOrder.deleteMany({}),
      Grn.deleteMany({}),
      Invoice.deleteMany({}),
      MatchAudit.deleteMany({}),
    ])

    const uploadDir = path.resolve('backend/uploads')
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir)
      for (const f of files) {
        try {
          fs.unlinkSync(path.join(uploadDir, f))
        } catch (e) {}
      }
    }

    console.log('[RESET] Successfully cleared all documents, audits, and uploaded files!')
  } catch (error) {
    console.error('[RESET] Error during workspace reset:', error)
  } finally {
    await closeDatabase()
  }
}

reset()
