import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../app'
import { supabaseAdmin } from '@/lib/supabase'

describe('API Integration Tests', () => {
  let testUser: any
  let testRoom: any
  let testMessage: any
  let authToken: string

  beforeEach(async () => {
    // Create test user
    const { data: user } = await supabaseAdmin
      .from('users')
      .insert({
        wallet_address: 'test-wallet-' + Date.now(),
        public_key: 'test-public-key'
      })
      .select()
      .single()

    testUser = user
    
    // Generate test token
    authToken = Buffer.from(JSON.stringify({
      userId: user.id,
      walletAddress: user.wallet_address,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64')

    // Create test room
    const { data: room } = await supabaseAdmin
      .from('rooms')
      .insert({
        name: 'Test Room',
        description: 'Test room for integration tests',
        created_by: user.id
      })
      .select()
      .single()

    testRoom = room

    // Add user to room
    await supabaseAdmin
      .from('room_members')
      .insert({
        room_id: room.id,
        user_id: user.id,
        role: 'admin'
      })
  })

  afterEach(async () => {
    // Cleanup test data
    if (testMessage) {
      await supabaseAdmin
        .from('messages')
        .delete()
        .eq('id', testMessage.id)
    }

    if (testRoom) {
      await supabaseAdmin
        .from('room_members')
        .delete()
        .eq('room_id', testRoom.id)
      
      await supabaseAdmin
        .from('rooms')
        .delete()
        .eq('id', testRoom.id)
    }

    if (testUser) {
      await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', testUser.id)
    }
  })

  describe('Authentication', () => {
    it('should authenticate with valid token', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Token verification failed')
    })
  })

  describe('Rooms', () => {
    it('should get user rooms', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.rooms).toHaveLength(1)
      expect(response.body.rooms[0].id).toBe(testRoom.id)
    })

    it('should create new room', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Test Room',
          description: 'A new test room',
          isPrivate: false,
          roomType: 'group'
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.room.name).toBe('New Test Room')
    })
  })

  describe('Messages', () => {
    it('should send message', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          roomId: testRoom.id,
          encryptedContent: 'encrypted-test-message',
          messageType: 'text'
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.message.encryptedContent).toBe('encrypted-test-message')
      
      testMessage = response.body.message
    })

    it('should get room messages', async () => {
      // First send a message
      const sendResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          roomId: testRoom.id,
          encryptedContent: 'encrypted-test-message',
          messageType: 'text'
        })

      testMessage = sendResponse.body.message

      const response = await request(app)
        .get(`/api/messages/${testRoom.id}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.messages).toHaveLength(1)
      expect(response.body.messages[0].encryptedContent).toBe('encrypted-test-message')
    })

    it('should edit message', async () => {
      // First send a message
      const sendResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          roomId: testRoom.id,
          encryptedContent: 'original-message',
          messageType: 'text'
        })

      testMessage = sendResponse.body.message

      const response = await request(app)
        .put(`/api/messages/${testMessage.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          encryptedContent: 'edited-message'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message.encryptedContent).toBe('edited-message')
      expect(response.body.message.editedAt).toBeTruthy()
    })

    it('should delete message', async () => {
      // First send a message
      const sendResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          roomId: testRoom.id,
          encryptedContent: 'message-to-delete',
          messageType: 'text'
        })

      testMessage = sendResponse.body.message

      const response = await request(app)
        .delete(`/api/messages/${testMessage.id}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('Reactions', () => {
    beforeEach(async () => {
      // Send a test message
      const sendResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          roomId: testRoom.id,
          encryptedContent: 'message-for-reaction',
          messageType: 'text'
        })

      testMessage = sendResponse.body.message
    })

    it('should add reaction', async () => {
      const response = await request(app)
        .post('/api/reactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          messageId: testMessage.id,
          emoji: '👍'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.action).toBe('added')
      expect(response.body.reaction.emoji).toBe('👍')
    })

    it('should remove reaction', async () => {
      // First add a reaction
      await request(app)
        .post('/api/reactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          messageId: testMessage.id,
          emoji: '👍'
        })

      const response = await request(app)
        .post('/api/reactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          messageId: testMessage.id,
          emoji: '👍',
          remove: true
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.action).toBe('removed')
    })
  })

  describe('Read Receipts', () => {
    beforeEach(async () => {
      // Send a test message
      const sendResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          roomId: testRoom.id,
          encryptedContent: 'message-for-read-receipt',
          messageType: 'text'
        })

      testMessage = sendResponse.body.message
    })

    it('should mark message as read', async () => {
      const response = await request(app)
        .post('/api/read-receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          messageId: testMessage.id
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.readReceipt.messageId).toBe(testMessage.id)
    })

    it('should get read receipts', async () => {
      // First mark message as read
      await request(app)
        .post('/api/read-receipts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          messageId: testMessage.id
        })

      const response = await request(app)
        .get(`/api/read-receipts?messageId=${testMessage.id}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.reads).toHaveLength(1)
      expect(response.body.reads[0].messageId).toBe(testMessage.id)
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple requests to exceed rate limit
      const requests = Array(101).fill(null).map(() =>
        request(app)
          .get('/api/rooms')
          .set('Authorization', `Bearer ${authToken}`)
      )

      const responses = await Promise.all(requests)
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing parameters', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Invalid request data')
    })

    it('should handle resource not found', async () => {
      const response = await request(app)
        .get('/api/messages/non-existent-room-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(403)
      expect(response.body.error).toBe('Access denied')
    })
  })
})
