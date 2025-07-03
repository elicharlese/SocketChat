import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { generateJWT } from '@/lib/auth'
import { z } from 'zod'

const walletAuthSchema = z.object({
  walletAddress: z.string().min(1, 'Wallet address is required'),
  publicKey: z.string().min(1, 'Public key is required'),
  signature: z.string().min(1, 'Signature is required'),
  message: z.string().min(1, 'Message is required')
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request)
    if (rateLimitResult.success === false) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { walletAddress, publicKey, signature, message } = walletAuthSchema.parse(body)

    // Verify signature (simplified - in production, use proper cryptographic verification)
    const isValidSignature = await verifyWalletSignature(
      walletAddress,
      message,
      signature
    )

    if (!isValidSignature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Check if user exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single()

    let user = existingUser

    // Create user if doesn't exist
    if (!user) {
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          wallet_address: walletAddress,
          public_key: publicKey,
          is_online: true,
          last_seen: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating user:', createError)
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        )
      }

      user = newUser
    } else {
      // Update user status
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          is_online: true,
          last_seen: new Date().toISOString(),
          public_key: publicKey
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('Error updating user:', updateError)
      }
    }

    // Generate JWT token
    const token = generateJWT(user.id, walletAddress)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        publicKey: user.public_key
      },
      token
    })

  } catch (error) {
    console.error('Wallet auth error:', error)
    
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

async function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signature: string
): Promise<boolean> {
  // Simplified signature verification
  // In production, implement proper cryptographic verification
  // using the appropriate wallet SDK (e.g., @solana/web3.js for Solana)
  try {
    // This is a placeholder - implement actual signature verification
    return signature.length > 0 && message.includes(walletAddress)
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}
