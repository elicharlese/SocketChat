import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { verifyJWT } from '@/lib/auth'

const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(100, 'Room name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  isPrivate: z.boolean().default(false),
  roomType: z.enum(['direct', 'group', 'public']).default('group'),
  memberIds: z.array(z.string()).optional()
})

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

    // Get user's rooms
    const { data: rooms, error } = await supabaseAdmin
      .from('room_members')
      .select(`
        room_id,
        joined_at,
        role,
        rooms (
          id,
          name,
          description,
          created_by,
          created_at,
          updated_at,
          is_private,
          room_type
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching rooms:', error)
      return NextResponse.json(
        { error: 'Failed to fetch rooms' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      rooms: rooms.map(room => ({
        id: room.rooms.id,
        name: room.rooms.name,
        description: room.rooms.description,
        createdBy: room.rooms.created_by,
        createdAt: room.rooms.created_at,
        updatedAt: room.rooms.updated_at,
        isPrivate: room.rooms.is_private,
        roomType: room.rooms.room_type,
        joinedAt: room.joined_at,
        role: room.role
      }))
    })

  } catch (error) {
    console.error('Get rooms error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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
    const { name, description, isPrivate, roomType, memberIds } = createRoomSchema.parse(body)

    // Create room
    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .insert({
        name,
        description,
        created_by: userId,
        is_private: isPrivate,
        room_type: roomType
      })
      .select()
      .single()

    if (roomError) {
      console.error('Error creating room:', roomError)
      return NextResponse.json(
        { error: 'Failed to create room' },
        { status: 500 }
      )
    }

    // Add creator as admin
    const { error: memberError } = await supabaseAdmin
      .from('room_members')
      .insert({
        room_id: room.id,
        user_id: userId,
        role: 'admin'
      })

    if (memberError) {
      console.error('Error adding room admin:', memberError)
      // Try to cleanup the room
      await supabaseAdmin.from('rooms').delete().eq('id', room.id)
      return NextResponse.json(
        { error: 'Failed to create room' },
        { status: 500 }
      )
    }

    // Add additional members if specified
    if (memberIds && memberIds.length > 0) {
      const memberInserts = memberIds.map(memberId => ({
        room_id: room.id,
        user_id: memberId,
        role: 'member' as const
      }))

      const { error: membersError } = await supabaseAdmin
        .from('room_members')
        .insert(memberInserts)

      if (membersError) {
        console.error('Error adding room members:', membersError)
        // Continue - room is still created successfully
      }
    }

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        createdBy: room.created_by,
        createdAt: room.created_at,
        updatedAt: room.updated_at,
        isPrivate: room.is_private,
        roomType: room.room_type
      }
    })

  } catch (error) {
    console.error('Create room error:', error)
    
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
