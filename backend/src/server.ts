import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { connectDatabase } from './db'
import routes from './routes'

const app = express()
const port = Number(process.env.BACKEND_PORT || 4000)

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use('/api', routes)

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API] Unhandled error:', error instanceof Error ? error.message : String(error))
  res.status(500).json({ error: 'Unexpected server error' })
})

async function start() {
  await connectDatabase()
  const server = app.listen(port, '0.0.0.0', () => console.log(`[API] Reconciliation API listening on port ${port}`))
  server.setTimeout(120000)
}

if (process.env.NODE_ENV !== 'test') {
  start().catch((error) => {
    console.error('[API] Startup failed:', error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

export default app
