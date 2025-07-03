import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { verifyJWT } from '@/lib/auth'
import { z } from 'zod'

const reactionSchema = z.object({
  messageId: z.string().uuid('Invalid message ID'),
  emoji: z.string().min(1, 'Emoji is required'),
  remove: z.boolean().default(false)
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
    const { messageId, emoji, remove } = reactionSchema.parse(body)

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

    if (remove) {
      // Remove reaction
      const { error: deleteError } = await supabaseAdmin
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji)

      if (deleteError) {
        console.error('Error removing reaction:', deleteError)
        return NextResponse.json(
          { error: 'Failed to remove reaction' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        action: 'removed',
        messageId,
        emoji
      })
    } else {
      // Add reaction (upsert to handle duplicates)
      const { data: reaction, error: reactionError } = await supabaseAdmin
        .from('message_reactions')
        .upsert({
          message_id: messageId,
          user_id: userId,
          emoji
        })
        .select()
        .single()

      if (reactionError) {
        console.error('Error adding reaction:', reactionError)
        return NextResponse.json(
          { error: 'Failed to add reaction' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        action: 'added',
        reaction: {
          id: reaction.id,
          messageId: reaction.message_id,
          userId: reaction.user_id,
          emoji: reaction.emoji,
          createdAt: reaction.created_at
        }
      })
    }

  } catch (error) {
    console.error('Reaction error:', error)
    
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
