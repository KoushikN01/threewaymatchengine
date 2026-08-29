import 'dotenv/config'
import { connectDatabase, closeDatabase } from './db'
import { getMatchForPo } from './services/matchEngine'

async function runTest() {
  try {
    await connectDatabase()
    console.log('[TEST] Calculating match for CI4PO05788...')
    const result = await getMatchForPo('CI4PO05788')
    console.log('========== THREE-WAY MATCH EVALUATION RESULT ==========')
    console.log('PO Number:', result.poNumber)
    console.log('Overall Status:', result.status)
    console.log('Reasons Flagged:', result.reasons)
    console.log('Summary:', result.summary)
    console.log('\nTop 10 Line Items Result:')
    console.table(
      result.lineResults.slice(0, 10).map((l) => ({
        Key: l.key,
        Code: l.itemCode,
        Description: l.description,
        Ordered: l.ordered,
        Received: l.received,
        Billed: l.billed,
        Variance: l.variance,
        Reasons: l.reasons.join(', '),
      }))
    )
  } catch (err) {
    console.error('[TEST] Match evaluation error:', err)
  } finally {
    await closeDatabase()
  }
}

runTest()
