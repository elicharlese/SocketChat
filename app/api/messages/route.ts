import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { verifyJWT } from '@/lib/auth'
import { z } from 'zod'

const sendMessageSchema = z.object({
  roomId: z.string().uuid('Invalid room ID'),
  encryptedContent: z.string().min(1, 'Message content is required'),
  messageType: z.enum(['text', 'media', 'file']).default('text'),
  replyTo: z.string().uuid().optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.string().optional(),
  mediaHash: z.string().optional()
})

const editMessageSchema = z.object({
  encryptedContent: z.string().min(1, 'Message content is required')
})

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request)
    if (rateLimitResult.success === false) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    const authResult = await verifyJWT(request)
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = authResult.userId
    const body = await request.json()
    const { roomId, encryptedContent, messageType, replyTo, mediaUrl, mediaType, mediaHash } = sendMessageSchema.parse(body)

    // Verify user is member of the room
    const { data: membership } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Verify reply-to message exists if specified
    if (replyTo) {
      const { data: replyMessage } = await supabaseAdmin
        .from('messages')
        .select('id')
        .eq('id', replyTo)
        .eq('room_id', roomId)
        .eq('is_deleted', false)
        .single()

      if (!replyMessage) {
        return NextResponse.json(
          { error: 'Reply message not found' },
          { status: 404 }
        )
      }
    }

    // Create message
    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        room_id: roomId,
        sender_id: userId,
        encrypted_content: encryptedContent,
        message_type: messageType,
        reply_to: replyTo,
        media_url: mediaUrl,
        media_type: mediaType,
        media_hash: mediaHash
      })
      .select()
      .single()

    if (messageError) {
      console.error('Error creating message:', messageError)
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      )
    }

    // Update room's updated_at timestamp
    await supabaseAdmin
      .from('rooms')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', roomId)

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        roomId: message.room_id,
        senderId: message.sender_id,
        encryptedContent: message.encrypted_content,
        messageType: message.message_type,
        createdAt: message.created_at,
        updatedAt: message.updated_at,
        editedAt: message.edited_at,
        isDeleted: message.is_deleted,
        replyTo: message.reply_to,
        blockchainHash: message.blockchain_hash,
        mediaUrl: message.media_url,
        mediaType: message.media_type,
        mediaHash: message.media_hash
      }
    })

  } catch (error) {
    console.error('Send message error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const rateLimitResult = await rateLimit(request)
    if (rateLimitResult.success === false) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    const authResult = await verifyJWT(request)
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = authResult.userId
    const { messageId } = params
    const body = await request.json()
    const { encryptedContent } = editMessageSchema.parse(body)

    // Verify message exists and user is the sender
    const { data: message } = await supabaseAdmin
      .from('messages')
      .select('id, sender_id, room_id, is_deleted')
      .eq('id', messageId)
      .eq('sender_id', userId)
      .eq('is_deleted', false)
      .single()

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found or access denied' },
        { status: 404 }
      )
    }

    // Update message
    const { data: updatedMessage, error: updateError } = await supabaseAdmin
      .from('messages')
      .update({
        encrypted_content: encryptedContent,
        edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating message:', updateError)
      return NextResponse.json(
        { error: 'Failed to update message' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: {
        id: updatedMessage.id,
        roomId: updatedMessage.room_id,
        senderId: updatedMessage.sender_id,
        encryptedContent: updatedMessage.encrypted_content,
        messageType: updatedMessage.message_type,
        createdAt: updatedMessage.created_at,
        updatedAt: updatedMessage.updated_at,
        editedAt: updatedMessage.edited_at,
        isDeleted: updatedMessage.is_deleted,
        replyTo: updatedMessage.reply_to,
        blockchainHash: updatedMessage.blockchain_hash,
        mediaUrl: updatedMessage.media_url,
        mediaType: updatedMessage.media_type,
        mediaHash: updatedMessage.media_hash
      }
    })

  } catch (error) {
    console.error('Edit message error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const rateLimitResult = await rateLimit(request)
    if (rateLimitResult.success === false) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    const authResult = await verifyJWT(request)
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = authResult.userId
    const { messageId } = params

    // Verify message exists and user is the sender
    const { data: message } = await supabaseAdmin
      .from('messages')
      .select('id, sender_id, room_id, is_deleted')
      .eq('id', messageId)
      .eq('sender_id', userId)
      .eq('is_deleted', false)
      .single()

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found or access denied' },
        { status: 404 }
      )
    }

    // Soft delete message
    const { error: deleteError } = await supabaseAdmin
      .from('messages')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId)

    if (deleteError) {
      console.error('Error deleting message:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete message' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Message deleted successfully'
    })

  } catch (error) {
    console.error('Delete message error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
