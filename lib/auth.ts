import { NextRequest } from 'next/server'

export interface JWTPayload {
  userId: string
  walletAddress: string
  iat: number
  exp: number
}

export interface AuthResult {
  success: boolean
  userId?: string
  walletAddress?: string
  error?: string
}

export async function verifyJWT(request: NextRequest): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'No authorization header' }
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    
    if (!token) {
      return { success: false, error: 'No token provided' }
    }

    // Decode JWT (simplified - in production use proper JWT library)
    let payload: JWTPayload
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8')
      payload = JSON.parse(decoded)
    } catch (error) {
      return { success: false, error: 'Invalid token format' }
    }

    // Verify token expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      return { success: false, error: 'Token expired' }
    }

    // Verify token structure
    if (!payload.userId || !payload.walletAddress) {
      return { success: false, error: 'Invalid token payload' }
    }

    return {
      success: true,
      userId: payload.userId,
      walletAddress: payload.walletAddress
    }

  } catch (error) {
    console.error('JWT verification error:', error)
    return { success: false, error: 'Token verification failed' }
  }
}

export function generateJWT(userId: string, walletAddress: string): string {
  const payload: JWTPayload = {
    userId,
    walletAddress,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  }

  // In production, use proper JWT library like jsonwebtoken
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

export function createAuthMiddleware() {
  return async (request: NextRequest): Promise<AuthResult> => {
    return verifyJWT(request)
  }
}
