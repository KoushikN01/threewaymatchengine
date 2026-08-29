import { Request, Response, NextFunction } from 'express'

/**
 * Static Bearer token for authentication.
 * In production, use a proper auth provider (OAuth, JWT, etc).
 */
const STATIC_TOKEN = process.env.AUTH_TOKEN || 'reconciliation-bearer-token-dev'

/**
 * Extracts and validates Bearer token from Authorization header.
 * Returns token or null if missing/invalid.
 */
function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null
  return parts[1]
}

/**
 * Authentication middleware.
 * Validates Bearer token against static token.
 * Attaches user info to request for downstream handlers.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req.headers.authorization) || (typeof req.query.token === 'string' ? req.query.token : null)

  if (!token) {
    console.warn('[AUTH] Missing token')
    return res.status(401).json({ error: 'Unauthorized: Missing token' })
  }

  if (token !== STATIC_TOKEN) {
    console.warn('[AUTH] Invalid token')
    return res.status(401).json({ error: 'Unauthorized: Invalid token' })
  }

  // Attach user context to request for downstream use
  ;(req as any).user = { authenticated: true, role: 'admin' }
  console.log('[AUTH] Token validated')
  next()
}

/**
 * Login endpoint.
 * Returns static Bearer token for use in subsequent requests.
 */
export async function login(req: Request, res: Response) {
  try {
    const token = STATIC_TOKEN
    console.log('[AUTH] Login successful')
    res.json({ token, expiresIn: 86400 })
  } catch (error) {
    console.error('[AUTH] Login error:', error instanceof Error ? error.message : String(error))
    res.status(500).json({ error: 'Login failed' })
  }
}
