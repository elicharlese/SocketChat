import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase'

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Rate limiting configuration
const rateLimitMap = new Map<string, number[]>()

export function rateLimit(req: NextApiRequest, res: NextApiResponse, maxRequests = 100, windowMs = 900000): boolean {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown'
  const now = Date.now()
  const windowStart = now - windowMs
  
  // Get or create request times for this IP
  const requestTimes = rateLimitMap.get(ip as string) || []
  
  // Filter out requests outside the window
  const recentRequests = requestTimes.filter(time => time > windowStart)
  
  // Check if limit exceeded
  if (recentRequests.length >= maxRequests) {
    res.status(429).json({ error: 'Rate limit exceeded' })
    return false
  }
  
  // Add current request
  recentRequests.push(now)
  rateLimitMap.set(ip as string, recentRequests)
  
  return true
}

export function validateInput(schema: any, data: any): { isValid: boolean; errors?: string[] } {
  const errors: string[] = []
  
  // Basic validation - in production, use a proper validation library like Zod
  if (!data || typeof data !== 'object') {
    errors.push('Invalid data format')
    return { isValid: false, errors }
  }
  
  // Validate required fields
  for (const field in schema) {
    if (schema[field].required && !data[field]) {
      errors.push(`${field} is required`)
    }
    
    if (data[field] && schema[field].type && typeof data[field] !== schema[field].type) {
      errors.push(`${field} must be of type ${schema[field].type}`)
    }
    
    if (data[field] && schema[field].maxLength && data[field].length > schema[field].maxLength) {
      errors.push(`${field} must be less than ${schema[field].maxLength} characters`)
    }
  }
  
  return { isValid: errors.length === 0, errors }
}

export function sanitizeInput(input: string): string {
  // Basic sanitization - in production, use a proper sanitization library
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
}

export function authenticateUser(req: NextApiRequest): Promise<{ user: any; error?: string }> {
  return new Promise(async (resolve) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '')
      
      if (!token) {
        resolve({ user: null, error: 'No token provided' })
        return
      }
      
      const { data: { user }, error } = await supabase.auth.getUser(token)
      
      if (error || !user) {
        resolve({ user: null, error: 'Invalid token' })
        return
      }
      
      resolve({ user })
    } catch (error) {
      resolve({ user: null, error: 'Authentication failed' })
    }
  })
}

export async function logActivity(action: string, userId: string, metadata?: any) {
  if (process.env.ENABLE_LOGGING !== 'true') return
  
  try {
    await supabase.from('activity_logs').insert({
      action,
      user_id: userId,
      metadata,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

export function corsHeaders(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000']
  
  if (allowedOrigins.includes(origin || '')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
}

export function handleError(error: any, res: NextApiResponse) {
  console.error('API Error:', error)
  
  if (error.code === 'PGRST301') {
    res.status(404).json({ error: 'Resource not found' })
  } else if (error.code === 'PGRST116') {
    res.status(400).json({ error: 'Invalid request' })
  } else if (error.message?.includes('rate limit')) {
    res.status(429).json({ error: 'Rate limit exceeded' })
  } else {
    res.status(500).json({ error: 'Internal server error' })
  }
}
