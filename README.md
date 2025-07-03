# SocketChat Backend

A robust, production-ready backend for SocketChat application featuring real-time messaging, end-to-end encryption, and blockchain integration.

## Tech Stack

- **Framework**: Next.js 15 with TypeScript
- **Real-time**: Socket.io
- **Database**: Supabase (PostgreSQL)
- **Blockchain**: Solana (Rust SDK)
- **Deployment**: Vercel
- **Authentication**: NextAuth.js
- **Encryption**: Web Crypto API

## Features

- Real-time messaging with Socket.io
- End-to-end encryption for messages and media
- Blockchain integration for message verification
- Media upload and sharing
- User presence and typing indicators
- Message reactions and read receipts
- Room-based chat system
- Wallet-based authentication

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/elicharlese/SocketChat.git
   cd SocketChat
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Setup**
   - Copy `.env.local` to your project root
   - Fill in all required environment variables (see `ENV_SETUP.md`)

4. **Database Setup**
   - Create a Supabase project
   - Run the SQL migrations in `docs/database/`
   - Configure RLS policies

5. **Run Development Server**
   ```bash
   pnpm dev
   ```

6. **Build for Production**
   ```bash
   pnpm build
   ```

## API Endpoints

- `GET /api/socket` - Socket.io health check
- `POST /api/auth/wallet` - Wallet authentication
- `GET /api/rooms` - List user rooms
- `POST /api/rooms` - Create new room
- `GET /api/messages/:roomId` - Get room messages
- `POST /api/media/upload` - Upload media files
- `POST /api/blockchain/verify` - Verify message on blockchain

## Socket.io Events

### Client → Server
- `join-room` - Join a chat room
- `send-message` - Send encrypted message
- `edit-message` - Edit existing message
- `delete-message` - Delete message
- `message-reaction` - Add/remove reaction
- `user-typing` - Typing indicator
- `exchange-keys` - Public key exchange

### Server → Client
- `receive-message` - New message received
- `message-edit` - Message was edited
- `message-delete` - Message was deleted
- `message-reaction` - Reaction added/removed
- `user-typing` - User is typing
- `user-connected` - User joined room

## Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Backend implementation"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Connect GitHub repository to Vercel
   - Set environment variables in Vercel dashboard
   - Deploy automatically on push

3. **Configure Domain**
   - Set up custom domain in Vercel
   - Update `NEXTAUTH_URL` environment variable

## Security

- All messages are end-to-end encrypted
- Rate limiting on all endpoints
- Input validation and sanitization
- CORS configuration
- Secure headers middleware
- Environment variable protection

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create pull request

## License

MIT License - see `LICENSE` file for details
