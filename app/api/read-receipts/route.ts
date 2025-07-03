import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { verifyJWT } from '@/lib/auth'
import { z } from 'zod'

const readReceiptSchema = z.object({
  messageId: z.string().uuid('Invalid message ID')
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
    const { messageId } = readReceiptSchema.parse(body)

    // Verify message exists and user has access
    const { data: message } = await supabaseAdmin
      .from('messages')
      .select(`
        id,
        room_id,
        is_deleted,
        rooms!inner(
          id,
          room_members!inner(
            user_id,
            is_active
          )
        )
      `)
      .eq('id', messageId)
      .eq('is_deleted', false)
      .eq('rooms.room_members.user_id', userId)
      .eq('rooms.room_members.is_active', true)
      .single()

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found or access denied' },
        { status: 404 }
      )
    }

    // Mark message as read (upsert to handle duplicates)
    const { data: readReceipt, error: readError } = await supabaseAdmin
      .from('message_reads')
      .upsert({
        message_id: messageId,
        user_id: userId,
        read_at: new Date().toISOString()
      })
      .select()
      .single()

    if (readError) {
      console.error('Error marking message as read:', readError)
      return NextResponse.json(
        { error: 'Failed to mark message as read' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      readReceipt: {
        id: readReceipt.id,
        messageId: readReceipt.message_id,
        userId: readReceipt.user_id,
        readAt: readReceipt.read_at
      }
    })

  } catch (error) {
    console.error('Read receipt error:', error)
    
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

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const messageId = searchParams.get('messageId')

    if (!roomId && !messageId) {
      return NextResponse.json(
        { error: 'Either roomId or messageId is required' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('message_reads')
      .select(`
        id,
        message_id,
        user_id,
        read_at,
        messages!inner(
          id,
          room_id,
          rooms!inner(
            id,
            room_members!inner(
              user_id,
              is_active
            )
          )
        )
      `)
      .eq('messages.rooms.room_members.user_id', userId)
      .eq('messages.rooms.room_members.is_active', true)

    if (messageId) {
      query = query.eq('message_id', messageId)
    } else if (roomId) {
      query = query.eq('messages.room_id', roomId)
    }

    const { data: reads, error } = await query

    if (error) {
      console.error('Error fetching read receipts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch read receipts' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      reads: reads.map(read => ({
        id: read.id,
        messageId: read.message_id,
        userId: read.user_id,
        readAt: read.read_at
      }))
    })

  } catch (error) {
    console.error('Get read receipts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
