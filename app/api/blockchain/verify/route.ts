import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { verifyJWT } from '@/lib/auth'
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'
import { z } from 'zod'

const verifySchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  messageHash: z.string().min(1, 'Message hash is required'),
  signature: z.string().optional()
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
    const { messageId, messageHash, signature } = verifySchema.parse(body)

    // Verify the message exists and user has access
    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .select(`
        id,
        room_id,
        sender_id,
        encrypted_content,
        blockchain_hash,
        rooms!inner(id)
      `)
      .eq('id', messageId)
      .single()

    if (messageError || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    // Check if user has access to this room
    const { data: membership } = await supabaseAdmin
      .from('room_members')
      .select('id')
      .eq('room_id', message.room_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Initialize Solana connection
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    )

    // Create message verification transaction
    const programId = new PublicKey(process.env.SOLANA_PROGRAM_ID || '')
    const payer = Keypair.fromSecretKey(
      Buffer.from(process.env.SOLANA_PRIVATE_KEY || '', 'hex')
    )

    // Create instruction data (simplified - in production, use proper program instructions)
    const instructionData = Buffer.from(JSON.stringify({
      messageId,
      messageHash,
      timestamp: Date.now(),
      sender: userId
    }))

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true }
      ],
      programId,
      data: instructionData
    })

    const transaction = new Transaction().add(instruction)
    const { blockhash } = await connection.getRecentBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = payer.publicKey

    // Sign and send transaction
    transaction.sign(payer)
    const txSignature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    )

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(txSignature, 'confirmed')

    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err)
      return NextResponse.json(
        { error: 'Blockchain verification failed' },
        { status: 500 }
      )
    }

    // Update message with blockchain hash
    const { error: updateError } = await supabaseAdmin
      .from('messages')
      .update({
        blockchain_hash: txSignature,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId)

    if (updateError) {
      console.error('Error updating message:', updateError)
      return NextResponse.json(
        { error: 'Failed to update message' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      blockchainHash: txSignature,
      explorerUrl: `https://explorer.solana.com/tx/${txSignature}`,
      verified: true
    })

  } catch (error) {
    console.error('Blockchain verification error:', error)
    
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

// GET endpoint to verify existing blockchain hash
export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request)
    if (rateLimitResult.success === false) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')
    const blockchainHash = searchParams.get('blockchainHash')

    if (!messageId && !blockchainHash) {
      return NextResponse.json(
        { error: 'messageId or blockchainHash is required' },
        { status: 400 }
      )
    }

    // Initialize Solana connection
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    )

    let txSignature: string
    
    if (blockchainHash) {
      txSignature = blockchainHash
    } else {
      // Get blockchain hash from message
      const { data: message } = await supabaseAdmin
        .from('messages')
        .select('blockchain_hash')
        .eq('id', messageId)
        .single()

      if (!message?.blockchain_hash) {
        return NextResponse.json(
          { error: 'Message not found or not verified on blockchain' },
          { status: 404 }
        )
      }

      txSignature = message.blockchain_hash
    }

    // Verify transaction exists on blockchain
    const transactionInfo = await connection.getTransaction(txSignature, {
      commitment: 'confirmed'
    })

    if (!transactionInfo) {
      return NextResponse.json(
        { error: 'Transaction not found on blockchain' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      verified: true,
      blockchainHash: txSignature,
      explorerUrl: `https://explorer.solana.com/tx/${txSignature}`,
      blockTime: transactionInfo.blockTime,
      slot: transactionInfo.slot
    })

  } catch (error) {
    console.error('Blockchain verification check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
