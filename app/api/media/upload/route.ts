import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { verifyJWT } from '@/lib/auth'
import { z } from 'zod'

const uploadSchema = z.object({
  file: z.string().min(1, 'File data is required'),
  fileName: z.string().min(1, 'File name is required'),
  fileType: z.string().min(1, 'File type is required'),
  fileSize: z.number().min(1, 'File size is required')
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
    const { file, fileName, fileType, fileSize } = uploadSchema.parse(body)

    // Validate file type
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || '').split(',')
    if (allowedTypes.length > 0 && !allowedTypes.includes(fileType)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      )
    }

    // Validate file size
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
    if (fileSize > maxSize) {
      return NextResponse.json(
        { error: 'File size too large' },
        { status: 400 }
      )
    }

    // Convert base64 to buffer
    let fileBuffer: Buffer
    try {
      // Remove data URL prefix if present
      const base64Data = file.replace(/^data:[^;]+;base64,/, '')
      fileBuffer = Buffer.from(base64Data, 'base64')
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid file data' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const extension = fileName.split('.').pop()
    const uniqueFileName = `${userId}/${timestamp}_${randomString}.${extension}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('media')
      .upload(uniqueFileName, fileBuffer, {
        contentType: fileType,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin
      .storage
      .from('media')
      .getPublicUrl(uniqueFileName)

    // Calculate file hash for integrity
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')

    // Store media metadata in database
    const { data: mediaRecord, error: dbError } = await supabaseAdmin
      .from('media')
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        file_path: uniqueFileName,
        file_url: urlData.publicUrl,
        file_hash: hash,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Try to cleanup uploaded file
      await supabaseAdmin.storage.from('media').remove([uniqueFileName])
      return NextResponse.json(
        { error: 'Failed to save media metadata' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      media: {
        id: mediaRecord.id,
        fileName: mediaRecord.file_name,
        fileType: mediaRecord.file_type,
        fileSize: mediaRecord.file_size,
        fileUrl: mediaRecord.file_url,
        fileHash: mediaRecord.file_hash,
        createdAt: mediaRecord.created_at
      }
    })

  } catch (error) {
    console.error('Media upload error:', error)
    
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
