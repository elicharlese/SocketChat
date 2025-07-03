# Troubleshooting Guide

## Common Issues and Solutions

### Database Issues

#### Connection Problems
**Symptoms:** Database connection timeouts, authentication errors
**Solutions:**
```bash
# Check Supabase credentials
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Test connection
curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/"

# Verify project status in Supabase dashboard
```

#### RLS Policy Issues
**Symptoms:** "Row Level Security" errors, access denied
**Solutions:**
```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Verify policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public';

-- Test policy with specific user
SET row_security = on;
SET ROLE authenticated;
SELECT * FROM messages LIMIT 1;
```

#### Migration Issues
**Symptoms:** Schema out of sync, missing columns
**Solutions:**
```bash
# Reset database to latest schema
supabase db reset

# Apply specific migration
supabase migration up --target 20240101000000

# Check migration status
supabase migration list
```

### API Issues

#### Authentication Failures
**Symptoms:** 401 Unauthorized, invalid token errors
**Solutions:**
```typescript
// Debug JWT token
const token = request.headers.get('authorization')?.replace('Bearer ', '')
const decoded = Buffer.from(token, 'base64').toString('utf8')
console.log('Token payload:', JSON.parse(decoded))

// Check token expiration
const payload = JSON.parse(decoded)
const now = Math.floor(Date.now() / 1000)
console.log('Token expired:', payload.exp < now)
```

#### Rate Limiting Issues
**Symptoms:** 429 Too Many Requests
**Solutions:**
```typescript
// Check rate limit status
const rateLimitInfo = await rateLimit(request)
console.log('Rate limit:', rateLimitInfo)

// Increase limits for specific endpoints
const customLimit = createRateLimitMiddleware(1800000, 200) // 30 min, 200 requests

// Clear rate limit cache
requests.clear()
```

#### CORS Errors
**Symptoms:** CORS policy errors in browser
**Solutions:**
```typescript
// Debug CORS headers
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

// Check environment-specific CORS
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || []
console.log('Allowed origins:', allowedOrigins)
```

### Socket.io Issues

#### Connection Problems
**Symptoms:** Socket disconnect, connection timeout
**Solutions:**
```typescript
// Debug socket connection
socket.on('connect_error', (error) => {
  console.log('Connection error:', error.message)
  console.log('Error type:', error.type)
  console.log('Error description:', error.description)
})

// Check socket server status
const io = SocketService.getIO()
console.log('Socket server running:', !!io)
console.log('Connected clients:', io?.sockets.sockets.size)
```

#### Message Delivery Issues
**Symptoms:** Messages not received, room sync problems
**Solutions:**
```typescript
// Debug room membership
socket.on('join-room', (roomId, userId) => {
  console.log(`User ${userId} joining room ${roomId}`)
  console.log('Room members:', socket.adapter.rooms.get(roomId))
})

// Check message encryption
try {
  const decrypted = await encryptionService.decryptMessage(encryptedMessage, senderId)
  console.log('Message decrypted successfully')
} catch (error) {
  console.error('Decryption failed:', error)
}
```

### Blockchain Issues

#### Transaction Failures
**Symptoms:** Transaction not confirmed, insufficient funds
**Solutions:**
```typescript
// Check wallet balance
const balance = await connection.getBalance(wallet.publicKey)
console.log('Wallet balance:', balance / 1e9, 'SOL')

// Check transaction status
const transaction = await connection.getTransaction(signature)
console.log('Transaction status:', transaction?.meta?.err)

// Retry with higher fee
const transaction = new Transaction()
transaction.feePayer = wallet.publicKey
transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash
// Add higher fee instruction
```

#### Program Deployment Issues
**Symptoms:** Program not found, instruction errors
**Solutions:**
```bash
# Verify program deployment
solana program show $PROGRAM_ID

# Check program account
solana account $PROGRAM_ID

# Redeploy if necessary
anchor deploy --program-id $PROGRAM_ID
```

### Performance Issues

#### Slow API Responses
**Symptoms:** High response times, timeouts
**Solutions:**
```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_messages_room_created 
ON messages(room_id, created_at);

-- Optimize query
EXPLAIN ANALYZE SELECT * FROM messages WHERE room_id = $1 ORDER BY created_at DESC LIMIT 50;
```

#### Memory Leaks
**Symptoms:** Increasing memory usage, crashes
**Solutions:**
```typescript
// Monitor memory usage
const usage = process.memoryUsage()
console.log('Memory usage:', {
  rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
  heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
  heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB'
})

// Clean up resources
socket.on('disconnect', () => {
  // Clear user data
  // Close database connections
  // Remove event listeners
})
```

### Deployment Issues

#### Build Failures
**Symptoms:** Build errors, dependency conflicts
**Solutions:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for conflicting versions
npm list --depth=0

# Update dependencies
npm audit fix
npm update
```

#### Environment Variable Issues
**Symptoms:** Undefined variables, configuration errors
**Solutions:**
```bash
# Verify environment variables
env | grep -E "(SUPABASE|SOLANA|JWT)"

# Check Vercel environment variables
vercel env ls

# Test with local environment
cp .env.example .env.local
# Fill in values and test locally
```

## Debugging Tools

### Database Debugging
```sql
-- Check table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Monitor active connections
SELECT pid, usename, application_name, client_addr, state, query_start, query
FROM pg_stat_activity
WHERE state = 'active';
```

### API Debugging
```typescript
// Request logging middleware
export function withLogging(handler: Function) {
  return async (req: NextRequest, res: NextResponse) => {
    const start = Date.now()
    console.log(`${req.method} ${req.url} - Start`)
    
    try {
      const result = await handler(req, res)
      console.log(`${req.method} ${req.url} - ${Date.now() - start}ms - Success`)
      return result
    } catch (error) {
      console.error(`${req.method} ${req.url} - ${Date.now() - start}ms - Error:`, error)
      throw error
    }
  }
}
```

### Socket.io Debugging
```typescript
// Socket event debugging
const originalEmit = socket.emit
socket.emit = function(...args) {
  console.log('Socket emit:', args[0], args.slice(1))
  return originalEmit.apply(this, args)
}

// Room debugging
console.log('All rooms:', Array.from(io.sockets.adapter.rooms.keys()))
console.log('Room members:', io.sockets.adapter.rooms.get(roomId))
```

### Blockchain Debugging
```typescript
// Transaction debugging
const transaction = await connection.getTransaction(signature, {
  commitment: 'confirmed',
  maxSupportedTransactionVersion: 0
})

console.log('Transaction logs:', transaction?.meta?.logMessages)
console.log('Instruction errors:', transaction?.meta?.err)
```

## Performance Monitoring

### API Performance
```typescript
// Response time monitoring
const responseTimeHistogram = new Map()

export function trackResponseTime(endpoint: string, duration: number) {
  if (!responseTimeHistogram.has(endpoint)) {
    responseTimeHistogram.set(endpoint, [])
  }
  responseTimeHistogram.get(endpoint).push(duration)
  
  // Log slow responses
  if (duration > 1000) {
    console.warn(`Slow response: ${endpoint} took ${duration}ms`)
  }
}
```

### Database Performance
```sql
-- Query performance monitoring
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  stddev_time,
  rows
FROM pg_stat_statements
WHERE calls > 100
ORDER BY mean_time DESC;
```

### Memory Monitoring
```typescript
// Memory leak detection
setInterval(() => {
  const usage = process.memoryUsage()
  if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB
    console.warn('High memory usage detected:', usage)
  }
}, 60000) // Check every minute
```

## Error Recovery

### Automatic Recovery
```typescript
// Database connection recovery
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      
      console.log(`Operation failed, retrying in ${delay}ms...`, error.message)
      await new Promise(resolve => setTimeout(resolve, delay))
      delay *= 2 // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded')
}
```

### Circuit Breaker Pattern
```typescript
class CircuitBreaker {
  private failures = 0
  private state = 'CLOSED' // CLOSED, OPEN, HALF_OPEN
  private threshold = 5
  private timeout = 30000

  async call<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN')
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure() {
    this.failures++
    if (this.failures >= this.threshold) {
      this.state = 'OPEN'
      setTimeout(() => {
        this.state = 'HALF_OPEN'
      }, this.timeout)
    }
  }
}
```

## Monitoring and Alerting

### Health Checks
```typescript
// Comprehensive health check
export async function healthCheck() {
  const checks = {
    database: false,
    socket: false,
    blockchain: false,
    memory: false
  }

  try {
    // Database check
    const { data } = await supabaseAdmin.from('users').select('count').limit(1)
    checks.database = !!data

    // Socket check
    const io = SocketService.getIO()
    checks.socket = !!io

    // Blockchain check (if enabled)
    if (process.env.ENABLE_BLOCKCHAIN === 'true') {
      const connection = new Connection(process.env.SOLANA_RPC_URL!)
      const slot = await connection.getSlot()
      checks.blockchain = slot > 0
    }

    // Memory check
    const usage = process.memoryUsage()
    checks.memory = usage.heapUsed < 1024 * 1024 * 1024 // 1GB limit

    return {
      status: Object.values(checks).every(Boolean) ? 'healthy' : 'unhealthy',
      checks,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}
```

### Alerting
```typescript
// Simple alerting system
export async function sendAlert(message: string, severity: 'low' | 'medium' | 'high') {
  if (process.env.NODE_ENV === 'production') {
    // Send to monitoring service (e.g., PagerDuty, Slack)
    console.error(`ALERT [${severity.toUpperCase()}]: ${message}`)
    
    // You can integrate with services like:
    // - Sentry for error tracking
    // - DataDog for metrics
    // - Slack for notifications
  }
}
```

This troubleshooting guide provides comprehensive solutions for common issues and debugging tools for the SocketChat backend.
