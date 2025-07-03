import { NextRequest } from 'next/server'

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

const requests = new Map<string, { count: number; reset: number }>()

export async function rateLimit(request: NextRequest): Promise<RateLimitResult> {
  const ip = request.headers.get('x-forwarded-for') || 
            request.headers.get('x-real-ip') || 
            'anonymous'
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') // 15 minutes
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
  
  const now = Date.now()
  const windowStart = now - windowMs
  
  // Clean up old entries
  for (const [key, value] of requests.entries()) {
    if (value.reset < windowStart) {
      requests.delete(key)
    }
  }
  
  const current = requests.get(ip)
  
  if (!current) {
    requests.set(ip, { count: 1, reset: now + windowMs })
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: now + windowMs
    }
  }
  
  if (current.reset < now) {
    // Reset window
    requests.set(ip, { count: 1, reset: now + windowMs })
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: now + windowMs
    }
  }
  
  if (current.count >= maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: current.reset
    }
  }
  
  current.count++
  requests.set(ip, current)
  
  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - current.count,
    reset: current.reset
  }
}

export function createRateLimitMiddleware(windowMs: number, maxRequests: number) {
  return async (request: NextRequest): Promise<RateLimitResult> => {
    const ip = request.headers.get('x-forwarded-for') || 
              request.headers.get('x-real-ip') || 
              'anonymous'
    const now = Date.now()
    const windowStart = now - windowMs
    
    // Clean up old entries
    for (const [key, value] of requests.entries()) {
      if (value.reset < windowStart) {
        requests.delete(key)
      }
    }
    
    const current = requests.get(ip)
    
    if (!current) {
      requests.set(ip, { count: 1, reset: now + windowMs })
      return {
        success: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        reset: now + windowMs
      }
    }
    
    if (current.reset < now) {
      // Reset window
      requests.set(ip, { count: 1, reset: now + windowMs })
      return {
        success: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        reset: now + windowMs
      }
    }
    
    if (current.count >= maxRequests) {
      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        reset: current.reset
      }
    }
    
    current.count++
    requests.set(ip, current)
    
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - current.count,
      reset: current.reset
    }
  }
}
