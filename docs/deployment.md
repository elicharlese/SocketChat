# Deployment Guide

## Overview
This guide covers deploying the SocketChat backend to production using Vercel for the Next.js application and Supabase for the database.

## Prerequisites

- GitHub account
- Vercel account
- Supabase account
- Solana wallet with SOL for deployment fees
- Domain name (optional)

## Pre-deployment Checklist

### 1. Code Quality
- [ ] All tests pass (`pnpm test`)
- [ ] Build succeeds (`pnpm build`)
- [ ] TypeScript checks pass (`pnpm type-check`)
- [ ] Linting passes (`pnpm lint`)
- [ ] No security vulnerabilities in dependencies

### 2. Environment Configuration
- [ ] All environment variables documented
- [ ] Production environment variables ready
- [ ] Database schema finalized
- [ ] API endpoints tested

### 3. Database Setup
- [ ] Supabase project created
- [ ] Database schema deployed
- [ ] RLS policies configured
- [ ] Storage buckets created
- [ ] Indexes optimized

### 4. Blockchain Setup (if applicable)
- [ ] Solana programs deployed
- [ ] Program IDs configured
- [ ] Wallet keys secured
- [ ] Network endpoints configured

## Step-by-Step Deployment

### 1. Prepare Repository

```bash
# Ensure all changes are committed
git add .
git commit -m "Prepare for production deployment"
git push origin main

# Create production branch (optional)
git checkout -b production
git push origin production
```

### 2. Database Deployment

#### Supabase Setup
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy database schema
supabase db push

# Deploy storage configuration
supabase storage update --project-ref YOUR_PROJECT_REF
```

#### Run SQL Migrations
```sql
-- Execute in Supabase SQL Editor or via CLI
-- Create tables (from docs/database/schema.md)
-- Enable RLS
-- Create policies
-- Create indexes
-- Set up storage buckets
```

### 3. Vercel Deployment

#### Connect GitHub Repository
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Configure build settings:
   - Framework Preset: Next.js
   - Build Command: `pnpm build`
   - Output Directory: `.next`
   - Install Command: `pnpm install`

#### Environment Variables
Configure in Vercel Dashboard under Project Settings > Environment Variables:

```bash
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security
JWT_SECRET=your-production-jwt-secret
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=https://your-domain.vercel.app

# Blockchain (if applicable)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_CLUSTER=mainnet-beta
SOLANA_PRIVATE_KEY=your-solana-private-key
SOLANA_PROGRAM_ID=your-program-id

# API Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGINS=https://your-domain.vercel.app

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,video/mp4

# Feature Flags
NODE_ENV=production
ENABLE_BLOCKCHAIN=true
ENABLE_LOGGING=true
ENABLE_RATE_LIMITING=true
```

### 4. Blockchain Deployment (if applicable)

#### Deploy Solana Programs
```bash
# Build programs
anchor build

# Deploy to mainnet
solana config set --url mainnet-beta
anchor deploy --provider.cluster mainnet

# Verify deployment
solana program show YOUR_PROGRAM_ID
```

#### Update Program IDs
Update environment variables with deployed program IDs:
```bash
SOLANA_MESSAGE_PROGRAM_ID=your-deployed-program-id
SOLANA_USER_PROGRAM_ID=your-deployed-user-program-id
```

### 5. Domain Configuration

#### Custom Domain (Optional)
1. In Vercel Dashboard, go to Project Settings > Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. Update `NEXTAUTH_URL` environment variable

#### SSL Certificate
- Automatic with Vercel
- Forced HTTPS enabled by default

### 6. Performance Optimization

#### Vercel Configuration
```json
// vercel.json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://your-domain.vercel.app"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "X-Requested-With, Content-Type, Authorization"
        }
      ]
    }
  ]
}
```

#### Database Optimization
```sql
-- Optimize frequently used queries
CREATE INDEX CONCURRENTLY idx_messages_room_created 
ON messages(room_id, created_at);

CREATE INDEX CONCURRENTLY idx_room_members_active 
ON room_members(room_id, is_active) WHERE is_active = true;

-- Set up connection pooling in Supabase dashboard
-- Configure read replicas if needed
```

### 7. Monitoring Setup

#### Error Tracking
```bash
# Add to dependencies
npm install @vercel/analytics @vercel/speed-insights
```

#### Logging
```typescript
// lib/logger.ts
export const logger = {
  info: (message: string, meta?: any) => {
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify({ level: 'info', message, meta }))
    }
  },
  error: (message: string, error?: any) => {
    if (process.env.NODE_ENV === 'production') {
      console.error(JSON.stringify({ level: 'error', message, error }))
    }
  }
}
```

#### Health Checks
```typescript
// app/api/health/route.ts
export async function GET() {
  try {
    // Check database connection
    const { data } = await supabaseAdmin.from('users').select('count').limit(1)
    
    // Check external services
    const checks = {
      database: !!data,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    }
    
    return Response.json({ status: 'healthy', checks })
  } catch (error) {
    return Response.json({ status: 'unhealthy', error: error.message }, { status: 500 })
  }
}
```

## Post-Deployment Verification

### 1. Functionality Testing
```bash
# Test critical endpoints
curl https://your-domain.vercel.app/api/health
curl https://your-domain.vercel.app/api/socket

# Test authentication
curl -X POST https://your-domain.vercel.app/api/auth/wallet \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"test","publicKey":"test","signature":"test","message":"test"}'
```

### 2. Performance Testing
- Load testing with k6 or Artillery
- Database query performance monitoring
- API response time monitoring
- Memory usage monitoring

### 3. Security Testing
- Vulnerability scanning
- API endpoint security testing
- Authentication/authorization testing
- Rate limiting verification

## Maintenance

### 1. Regular Updates
```bash
# Weekly dependency updates
npm audit
npm update

# Monthly security updates
npm audit fix

# Quarterly major updates
npm outdated
```

### 2. Database Maintenance
```sql
-- Weekly cleanup
DELETE FROM activity_logs WHERE timestamp < NOW() - INTERVAL '30 days';

-- Monthly optimization
VACUUM ANALYZE;
REINDEX DATABASE;

-- Quarterly backups verification
SELECT * FROM pg_stat_database;
```

### 3. Monitoring & Alerts
- Set up Vercel alerts for errors
- Configure Supabase monitoring
- Set up uptime monitoring
- Configure log aggregation

## Rollback Plan

### 1. Application Rollback
```bash
# Revert to previous deployment in Vercel
# OR redeploy previous Git commit
git revert HEAD
git push origin main
```

### 2. Database Rollback
```bash
# Use Supabase point-in-time recovery
supabase db branch create rollback-$(date +%Y%m%d)
supabase db reset --db-url YOUR_ROLLBACK_URL
```

### 3. Blockchain Rollback
- Redeploy previous program version
- Update program IDs in environment variables
- Verify program functionality

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check dependency compatibility
   - Verify environment variables
   - Review build logs

2. **Database Connection Issues**
   - Verify Supabase credentials
   - Check RLS policies
   - Validate schema migrations

3. **API Errors**
   - Check function logs in Vercel
   - Verify CORS configuration
   - Test rate limiting settings

4. **Performance Issues**
   - Monitor database query performance
   - Check memory usage
   - Optimize API responses

### Emergency Contacts
- DevOps Lead: [contact]
- Database Admin: [contact]
- Security Team: [contact]

## Security Considerations

### 1. Environment Variables
- Never commit secrets to version control
- Use separate credentials for each environment
- Rotate secrets regularly

### 2. Database Security
- Enable RLS on all tables
- Use least-privilege access
- Regular security audits

### 3. API Security
- Rate limiting enabled
- Input validation on all endpoints
- CORS properly configured
- HTTPS enforced

### 4. Blockchain Security
- Private keys stored securely
- Multi-signature wallets for critical operations
- Regular security audits of smart contracts

This deployment guide ensures a secure, scalable, and maintainable production deployment of the SocketChat backend.
