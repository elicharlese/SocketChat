import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { verifyJWT } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
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
    const { roomId } = params

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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const before = searchParams.get('before') // message ID for pagination

    let query = supabaseAdmin
      .from('messages')
      .select(`
        id,
        room_id,
        sender_id,
        encrypted_content,
        message_type,
        created_at,
        updated_at,
        edited_at,
        is_deleted,
        reply_to,
        blockchain_hash,
        media_url,
        media_type,
        media_hash
      `)
      .eq('room_id', roomId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) {
      // Get messages before a specific message ID
      const { data: beforeMessage } = await supabaseAdmin
        .from('messages')
        .select('created_at')
        .eq('id', before)
        .single()

      if (beforeMessage) {
        query = query.lt('created_at', beforeMessage.created_at)
      }
    }

    if (offset > 0) {
      query = query.range(offset, offset + limit - 1)
    }

    const { data: messages, error } = await query

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    // Get reactions for these messages
    const messageIds = messages.map(m => m.id)
    const { data: reactions } = await supabaseAdmin
      .from('message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', messageIds)

    // Get read receipts for these messages
    const { data: reads } = await supabaseAdmin
      .from('message_reads')
      .select('message_id, user_id, read_at')
      .in('message_id', messageIds)

    // Get user information for message senders
    const senderIds = [...new Set(messages.map(m => m.sender_id))]
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, wallet_address, public_key')
      .in('id', senderIds)

    // Create user lookup map
    const userMap = new Map<string, { id: string; walletAddress: string; publicKey: string }>()
    users?.forEach(user => {
      userMap.set(user.id, {
        id: user.id,
        walletAddress: user.wallet_address,
        publicKey: user.public_key
      })
    })

    // Group reactions and reads by message
    const messageReactions = new Map<string, Array<{ userId: string; emoji: string }>>()
    const messageReads = new Map<string, Array<{ userId: string; readAt: string }>>()

    reactions?.forEach(reaction => {
      if (!messageReactions.has(reaction.message_id)) {
        messageReactions.set(reaction.message_id, [])
      }
      messageReactions.get(reaction.message_id)!.push({
        userId: reaction.user_id,
        emoji: reaction.emoji
      })
    })

    reads?.forEach(read => {
      if (!messageReads.has(read.message_id)) {
        messageReads.set(read.message_id, [])
      }
      messageReads.get(read.message_id)!.push({
        userId: read.user_id,
        readAt: read.read_at
      })
    })

    // Format messages
    const formattedMessages = messages.map(message => ({
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
      mediaHash: message.media_hash,
      sender: userMap.get(message.sender_id) || {
        id: message.sender_id,
        walletAddress: 'unknown',
        publicKey: 'unknown'
      },
      reactions: messageReactions.get(message.id) || [],
      reads: messageReads.get(message.id) || []
    }))

    return NextResponse.json({
      success: true,
      messages: formattedMessages,
      pagination: {
        limit,
        offset,
        hasMore: messages.length === limit
      }
    })

  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
