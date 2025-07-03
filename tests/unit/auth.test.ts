import { describe, it, expect } from 'jest'
import { rateLimit } from '@/lib/rate-limit'
import { validateInput, sanitizeInput } from '@/lib/api-utils'
import { generateJWT, verifyJWT } from '@/lib/auth'

// Mock NextRequest
const mockRequest = (headers: Record<string, string> = {}) => ({
  headers: {
    get: (name: string) => headers[name] || null,
  },
}) as any

describe('Rate Limiting', () => {
  it('should allow requests within limit', async () => {
    const request = mockRequest({ 'x-forwarded-for': '127.0.0.1' })
    const result = await rateLimit(request)
    
    expect(result.success).toBe(true)
    expect(result.remaining).toBeGreaterThan(0)
  })

  it('should block requests exceeding limit', async () => {
    const request = mockRequest({ 'x-forwarded-for': '192.168.1.1' })
    
    // Make requests to exceed limit
    const results = []
    for (let i = 0; i < 102; i++) {
      results.push(await rateLimit(request))
    }
    
    const blockedRequests = results.filter(r => !r.success)
    expect(blockedRequests.length).toBeGreaterThan(0)
  })
})

describe('Input Validation', () => {
  it('should validate required fields', () => {
    const schema = {
      name: { required: true, type: 'string' },
      age: { required: true, type: 'number' }
    }
    
    const { isValid, errors } = validateInput(schema, {
      name: 'John'
      // missing age
    })
    
    expect(isValid).toBe(false)
    expect(errors).toContain('age is required')
  })

  it('should validate field types', () => {
    const schema = {
      name: { required: true, type: 'string' },
      age: { required: true, type: 'number' }
    }
    
    const { isValid, errors } = validateInput(schema, {
      name: 'John',
      age: 'not a number'
    })
    
    expect(isValid).toBe(false)
    expect(errors).toContain('age must be of type number')
  })

  it('should validate field length', () => {
    const schema = {
      name: { required: true, type: 'string', maxLength: 5 }
    }
    
    const { isValid, errors } = validateInput(schema, {
      name: 'Very long name'
    })
    
    expect(isValid).toBe(false)
    expect(errors).toContain('name must be less than 5 characters')
  })

  it('should pass valid input', () => {
    const schema = {
      name: { required: true, type: 'string', maxLength: 10 },
      age: { required: true, type: 'number' }
    }
    
    const { isValid, errors } = validateInput(schema, {
      name: 'John',
      age: 25
    })
    
    expect(isValid).toBe(true)
    expect(errors).toBeUndefined()
  })
})

describe('Input Sanitization', () => {
  it('should remove HTML tags', () => {
    const input = '<script>alert("xss")</script>Hello'
    const sanitized = sanitizeInput(input)
    
    expect(sanitized).toBe('alert("xss")Hello')
  })

  it('should remove javascript protocol', () => {
    const input = 'javascript:alert("xss")'
    const sanitized = sanitizeInput(input)
    
    expect(sanitized).toBe('alert("xss")')
  })

  it('should remove event handlers', () => {
    const input = 'onclick=alert("xss") Hello'
    const sanitized = sanitizeInput(input)
    
    expect(sanitized).toBe(' Hello')
  })

  it('should trim whitespace', () => {
    const input = '  Hello World  '
    const sanitized = sanitizeInput(input)
    
    expect(sanitized).toBe('Hello World')
  })
})

describe('JWT Authentication', () => {
  it('should generate valid JWT', () => {
    const userId = 'test-user-id'
    const walletAddress = 'test-wallet-address'
    
    const token = generateJWT(userId, walletAddress)
    
    expect(token).toBeDefined()
    expect(typeof token).toBe('string')
  })

  it('should verify valid JWT', async () => {
    const userId = 'test-user-id'
    const walletAddress = 'test-wallet-address'
    
    const token = generateJWT(userId, walletAddress)
    const request = mockRequest({ authorization: `Bearer ${token}` })
    
    const result = await verifyJWT(request)
    
    expect(result.success).toBe(true)
    expect(result.userId).toBe(userId)
    expect(result.walletAddress).toBe(walletAddress)
  })

  it('should reject invalid JWT', async () => {
    const request = mockRequest({ authorization: 'Bearer invalid-token' })
    
    const result = await verifyJWT(request)
    
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('should reject expired JWT', async () => {
    const expiredPayload = {
      userId: 'test-user-id',
      walletAddress: 'test-wallet-address',
      iat: Math.floor(Date.now() / 1000) - 3600,
      exp: Math.floor(Date.now() / 1000) - 1800 // Expired 30 minutes ago
    }
    
    const expiredToken = Buffer.from(JSON.stringify(expiredPayload)).toString('base64')
    const request = mockRequest({ authorization: `Bearer ${expiredToken}` })
    
    const result = await verifyJWT(request)
    
    expect(result.success).toBe(false)
    expect(result.error).toBe('Token expired')
  })

  it('should require authorization header', async () => {
    const request = mockRequest({})
    
    const result = await verifyJWT(request)
    
    expect(result.success).toBe(false)
    expect(result.error).toBe('No authorization header')
  })
})
