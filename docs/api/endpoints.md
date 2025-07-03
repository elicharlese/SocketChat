# API Documentation

## Authentication

All API endpoints (except `/api/auth/wallet`) require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <jwt-token>
```

## Rate Limiting

All endpoints are rate-limited to prevent abuse:
- **Limit**: 100 requests per 15 minutes per IP
- **Headers**: Rate limit info included in response headers

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "details": [], // Optional validation errors
  "code": "ERROR_CODE" // Optional error code
}
```

## Authentication Endpoints

### POST /api/auth/wallet

Authenticate user with wallet signature.

**Request:**
```json
{
  "walletAddress": "string",
  "publicKey": "string", 
  "signature": "string",
  "message": "string"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "walletAddress": "string",
    "publicKey": "string"
  },
  "token": "jwt-token"
}
```

## Room Management

### GET /api/rooms

Get all rooms for the authenticated user.

**Response:**
```json
{
  "success": true,
  "rooms": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "createdBy": "uuid",
      "createdAt": "timestamp",
      "updatedAt": "timestamp",
      "isPrivate": boolean,
      "roomType": "direct|group|public",
      "joinedAt": "timestamp",
      "role": "admin|member"
    }
  ]
}
```

### POST /api/rooms

Create a new room.

**Request:**
```json
{
  "name": "string",
  "description": "string", // optional
  "isPrivate": boolean, // optional, default false
  "roomType": "direct|group|public", // optional, default "group"
  "memberIds": ["uuid"] // optional, array of user IDs to add
}
```

**Response:**
```json
{
  "success": true,
  "room": {
    "id": "uuid",
    "name": "string",
    "description": "string",
    "createdBy": "uuid",
    "createdAt": "timestamp",
    "updatedAt": "timestamp",
    "isPrivate": boolean,
    "roomType": "string"
  }
}
```

## Messages

### GET /api/messages/[roomId]

Get messages for a specific room.

**Query Parameters:**
- `limit`: Number of messages to return (default: 50, max: 100)
- `offset`: Offset for pagination (default: 0)
- `before`: Message ID to fetch messages before (for pagination)

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "id": "uuid",
      "roomId": "uuid",
      "senderId": "uuid",
      "encryptedContent": "string",
      "messageType": "text|media|file",
      "createdAt": "timestamp",
      "updatedAt": "timestamp",
      "editedAt": "timestamp|null",
      "isDeleted": boolean,
      "replyTo": "uuid|null",
      "blockchainHash": "string|null",
      "mediaUrl": "string|null",
      "mediaType": "string|null",
      "mediaHash": "string|null",
      "sender": {
        "id": "uuid",
        "walletAddress": "string",
        "publicKey": "string"
      },
      "reactions": [
        {
          "userId": "uuid",
          "emoji": "string"
        }
      ],
      "reads": [
        {
          "userId": "uuid",
          "readAt": "timestamp"
        }
      ]
    }
  ],
  "pagination": {
    "limit": number,
    "offset": number,
    "hasMore": boolean
  }
}
```

## Media Upload

### POST /api/media/upload

Upload media file.

**Request:**
```json
{
  "file": "base64-encoded-file-data",
  "fileName": "string",
  "fileType": "string",
  "fileSize": number
}
```

**Response:**
```json
{
  "success": true,
  "media": {
    "id": "uuid",
    "fileName": "string",
    "fileType": "string",
    "fileSize": number,
    "fileUrl": "string",
    "fileHash": "string",
    "createdAt": "timestamp"
  }
}
```

## Blockchain Integration

### POST /api/blockchain/verify

Verify/notarize a message on blockchain.

**Request:**
```json
{
  "messageId": "uuid",
  "messageHash": "string",
  "signature": "string" // optional
}
```

**Response:**
```json
{
  "success": true,
  "blockchainHash": "string",
  "explorerUrl": "string",
  "verified": true
}
```

### GET /api/blockchain/verify

Verify existing blockchain hash.

**Query Parameters:**
- `messageId`: Message ID to verify
- `blockchainHash`: Blockchain hash to verify

**Response:**
```json
{
  "success": true,
  "verified": true,
  "blockchainHash": "string",
  "explorerUrl": "string",
  "blockTime": number,
  "slot": number
}
```

## WebSocket Events

### Client → Server Events

#### join-room
Join a chat room.
```json
{
  "roomId": "uuid",
  "userId": "uuid"
}
```

#### send-message
Send a message to a room.
```json
{
  "id": "uuid",
  "roomId": "uuid",
  "encryptedMessage": "string",
  "sender": "uuid",
  "timestamp": "string",
  "replyTo": "uuid|null",
  "media": {
    "encryptedData": "string",
    "type": "string",
    "hash": "string"
  }
}
```

#### edit-message
Edit an existing message.
```json
{
  "id": "uuid",
  "roomId": "uuid",
  "encryptedMessage": "string",
  "editedAt": "string"
}
```

#### delete-message
Delete a message.
```json
{
  "id": "uuid",
  "roomId": "uuid"
}
```

#### message-reaction
Add/remove reaction to a message.
```json
{
  "messageId": "uuid",
  "roomId": "uuid",
  "emoji": "string",
  "remove": boolean
}
```

#### message-read
Mark message as read.
```json
{
  "messageId": "uuid",
  "userId": "uuid",
  "roomId": "uuid"
}
```

#### user-typing
Send typing indicator.
```json
{
  "userId": "uuid",
  "roomId": "uuid"
}
```

#### exchange-keys
Exchange encryption keys.
```json
{
  "userId": "uuid",
  "publicKey": "string",
  "recipientId": "uuid"
}
```

### Server → Client Events

#### receive-message
New message received.
```json
{
  "id": "uuid",
  "encryptedMessage": "string",
  "sender": "uuid",
  "timestamp": "string",
  "replyTo": "uuid|null",
  "media": {
    "encryptedData": "string",
    "type": "string",
    "hash": "string"
  }
}
```

#### message-edit
Message was edited.
```json
{
  "id": "uuid",
  "encryptedMessage": "string",
  "sender": "uuid",
  "editedAt": "string"
}
```

#### message-delete
Message was deleted.
```json
{
  "id": "uuid",
  "sender": "uuid"
}
```

#### message-reaction
Reaction added/removed.
```json
{
  "messageId": "uuid",
  "userId": "uuid",
  "emoji": "string",
  "remove": boolean
}
```

#### message-read
Message read receipt.
```json
{
  "messageId": "uuid",
  "userId": "uuid"
}
```

#### user-typing
User typing indicator.
```json
{
  "userId": "uuid",
  "roomId": "uuid"
}
```

#### user-connected
User joined room.
```json
{
  "userId": "uuid"
}
```

#### exchange-keys
Key exchange response.
```json
{
  "userId": "uuid",
  "publicKey": "string"
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Security Headers

All API responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

## CORS Configuration

CORS is configured to allow requests from:
- `http://localhost:3000` (development)
- Your production domain (configured via environment variables)

## Testing

Use the provided Postman collection or curl commands to test the API endpoints. All endpoints require proper authentication and rate limiting will be enforced.
