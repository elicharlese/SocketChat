# Environment Variables Documentation

This document outlines all environment variables required for the SocketChat application.

## Database Configuration
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key for client-side operations
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for server-side operations

## Authentication
- `NEXTAUTH_URL`: The canonical URL of your application
- `NEXTAUTH_SECRET`: Secret key for NextAuth.js session encryption

## Socket.io Configuration
- `SOCKET_IO_PATH`: Path for Socket.io server endpoint (default: `/api/socketio`)

## Blockchain Configuration
- `SOLANA_RPC_URL`: Solana RPC endpoint URL
- `SOLANA_PRIVATE_KEY`: Private key for Solana transactions (keep secure!)
- `SOLANA_PROGRAM_ID`: Your deployed Solana program ID

## Security
- `ENCRYPTION_KEY`: Key for encrypting sensitive data
- `JWT_SECRET`: Secret for JWT token signing

## Rate Limiting
- `RATE_LIMIT_WINDOW_MS`: Time window for rate limiting in milliseconds
- `RATE_LIMIT_MAX_REQUESTS`: Maximum requests per window

## Media Upload
- `MAX_FILE_SIZE`: Maximum file size in bytes (default: 10MB)
- `ALLOWED_FILE_TYPES`: Comma-separated list of allowed MIME types

## Development/Production
- `NODE_ENV`: Environment mode (development/production)
- `DEBUG`: Enable debug logging (true/false)

## Setup Instructions

1. Copy `.env.local` to your project root
2. Fill in all required values
3. For production, ensure all secrets are properly generated and secure
4. Never commit environment files to version control
