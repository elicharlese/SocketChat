# Blockchain Integration Documentation

## Overview

SocketChat integrates with the Solana blockchain to provide message verification, notarization, and integrity checking. This ensures message authenticity and provides an immutable record of communications.

## Architecture

### Components

1. **Solana Programs (Smart Contracts)** - Rust-based on-chain programs
2. **API Integration** - Next.js API routes for blockchain interactions
3. **Client SDK** - Frontend integration for wallet connections
4. **Verification Service** - Message integrity and authenticity verification

## Solana Program Structure

### Message Notarization Program

```rust
// src/programs/message_notarization/src/lib.rs
use anchor_lang::prelude::*;
use sha2::{Digest, Sha256};

declare_id!("YourProgramIdHere");

#[program]
pub mod message_notarization {
    use super::*;

    pub fn notarize_message(
        ctx: Context<NotarizeMessage>,
        message_id: String,
        message_hash: String,
        timestamp: i64,
        sender: String,
    ) -> Result<()> {
        let message_record = &mut ctx.accounts.message_record;
        
        message_record.message_id = message_id;
        message_record.message_hash = message_hash;
        message_record.timestamp = timestamp;
        message_record.sender = sender;
        message_record.notarized_at = Clock::get()?.unix_timestamp;
        message_record.bump = *ctx.bumps.get("message_record").unwrap();
        
        Ok(())
    }
    
    pub fn verify_message(
        ctx: Context<VerifyMessage>,
        message_id: String,
    ) -> Result<MessageRecord> {
        let message_record = &ctx.accounts.message_record;
        
        require!(
            message_record.message_id == message_id,
            ErrorCode::MessageNotFound
        );
        
        Ok(message_record.clone())
    }
}

#[derive(Accounts)]
#[instruction(message_id: String)]
pub struct NotarizeMessage<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 64 + 64 + 8 + 32 + 8 + 1,
        seeds = [b"message", message_id.as_bytes()],
        bump
    )]
    pub message_record: Account<'info, MessageRecord>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(message_id: String)]
pub struct VerifyMessage<'info> {
    #[account(
        seeds = [b"message", message_id.as_bytes()],
        bump = message_record.bump
    )]
    pub message_record: Account<'info, MessageRecord>,
}

#[account]
#[derive(Clone)]
pub struct MessageRecord {
    pub message_id: String,
    pub message_hash: String,
    pub timestamp: i64,
    pub sender: String,
    pub notarized_at: i64,
    pub bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Message not found")]
    MessageNotFound,
}
```

### User Identity Program

```rust
// src/programs/user_identity/src/lib.rs
use anchor_lang::prelude::*;

declare_id!("YourUserIdentityProgramIdHere");

#[program]
pub mod user_identity {
    use super::*;

    pub fn register_user(
        ctx: Context<RegisterUser>,
        wallet_address: String,
        public_key: String,
    ) -> Result<()> {
        let user_record = &mut ctx.accounts.user_record;
        
        user_record.wallet_address = wallet_address;
        user_record.public_key = public_key;
        user_record.registered_at = Clock::get()?.unix_timestamp;
        user_record.is_verified = false;
        user_record.bump = *ctx.bumps.get("user_record").unwrap();
        
        Ok(())
    }
    
    pub fn verify_user(
        ctx: Context<VerifyUser>,
        wallet_address: String,
    ) -> Result<()> {
        let user_record = &mut ctx.accounts.user_record;
        
        require!(
            user_record.wallet_address == wallet_address,
            ErrorCode::UserNotFound
        );
        
        user_record.is_verified = true;
        user_record.verified_at = Some(Clock::get()?.unix_timestamp);
        
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(wallet_address: String)]
pub struct RegisterUser<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 44 + 44 + 8 + 1 + 8 + 1,
        seeds = [b"user", wallet_address.as_bytes()],
        bump
    )]
    pub user_record: Account<'info, UserRecord>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(wallet_address: String)]
pub struct VerifyUser<'info> {
    #[account(
        mut,
        seeds = [b"user", wallet_address.as_bytes()],
        bump = user_record.bump
    )]
    pub user_record: Account<'info, UserRecord>,
    
    pub authority: Signer<'info>,
}

#[account]
pub struct UserRecord {
    pub wallet_address: String,
    pub public_key: String,
    pub registered_at: i64,
    pub is_verified: bool,
    pub verified_at: Option<i64>,
    pub bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("User not found")]
    UserNotFound,
}
```

## API Integration

### Blockchain Service

```typescript
// lib/blockchain-service.ts
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'
import { Program, AnchorProvider, web3, BN } from '@project-serum/anchor'
import { IDL as MessageNotarizationIDL } from './idl/message_notarization'
import { IDL as UserIdentityIDL } from './idl/user_identity'

export class BlockchainService {
  private connection: Connection
  private messageProgram: Program
  private userProgram: Program
  private provider: AnchorProvider

  constructor() {
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    )
    
    // Initialize programs
    this.initializePrograms()
  }

  private initializePrograms() {
    const wallet = {
      publicKey: new PublicKey(process.env.SOLANA_WALLET_PUBLIC_KEY!),
      signTransaction: async (tx: Transaction) => tx,
      signAllTransactions: async (txs: Transaction[]) => txs,
    }

    this.provider = new AnchorProvider(this.connection, wallet, {
      commitment: 'confirmed',
    })

    this.messageProgram = new Program(
      MessageNotarizationIDL,
      new PublicKey(process.env.SOLANA_MESSAGE_PROGRAM_ID!),
      this.provider
    )

    this.userProgram = new Program(
      UserIdentityIDL,
      new PublicKey(process.env.SOLANA_USER_PROGRAM_ID!),
      this.provider
    )
  }

  async notarizeMessage(
    messageId: string,
    messageHash: string,
    sender: string
  ): Promise<string> {
    try {
      const [messageRecordPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('message'), Buffer.from(messageId)],
        this.messageProgram.programId
      )

      const tx = await this.messageProgram.methods
        .notarizeMessage(
          messageId,
          messageHash,
          new BN(Date.now()),
          sender
        )
        .accounts({
          messageRecord: messageRecordPDA,
          payer: this.provider.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc()

      return tx
    } catch (error) {
      console.error('Error notarizing message:', error)
      throw error
    }
  }

  async verifyMessage(messageId: string): Promise<any> {
    try {
      const [messageRecordPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('message'), Buffer.from(messageId)],
        this.messageProgram.programId
      )

      const messageRecord = await this.messageProgram.account.messageRecord.fetch(
        messageRecordPDA
      )

      return messageRecord
    } catch (error) {
      console.error('Error verifying message:', error)
      throw error
    }
  }

  async registerUser(walletAddress: string, publicKey: string): Promise<string> {
    try {
      const [userRecordPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('user'), Buffer.from(walletAddress)],
        this.userProgram.programId
      )

      const tx = await this.userProgram.methods
        .registerUser(walletAddress, publicKey)
        .accounts({
          userRecord: userRecordPDA,
          payer: this.provider.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc()

      return tx
    } catch (error) {
      console.error('Error registering user:', error)
      throw error
    }
  }

  async verifyUser(walletAddress: string): Promise<string> {
    try {
      const [userRecordPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('user'), Buffer.from(walletAddress)],
        this.userProgram.programId
      )

      const tx = await this.userProgram.methods
        .verifyUser(walletAddress)
        .accounts({
          userRecord: userRecordPDA,
          authority: this.provider.wallet.publicKey,
        })
        .rpc()

      return tx
    } catch (error) {
      console.error('Error verifying user:', error)
      throw error
    }
  }

  async getTransactionDetails(signature: string): Promise<any> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
      })

      return transaction
    } catch (error) {
      console.error('Error getting transaction details:', error)
      throw error
    }
  }
}
```

## Frontend Integration

### Wallet Connection

```typescript
// hooks/use-wallet.ts
import { useEffect, useState } from 'react'
import { Connection, PublicKey } from '@solana/web3.js'

interface WalletState {
  connected: boolean
  publicKey: PublicKey | null
  address: string | null
  connect: () => Promise<void>
  disconnect: () => void
  signMessage: (message: string) => Promise<string>
}

export function useWallet(): WalletState {
  const [connected, setConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null)
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    checkIfWalletConnected()
  }, [])

  const checkIfWalletConnected = async () => {
    try {
      const { solana } = window as any
      
      if (solana?.isPhantom) {
        const response = await solana.connect({ onlyIfTrusted: true })
        setPublicKey(response.publicKey)
        setAddress(response.publicKey.toString())
        setConnected(true)
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error)
    }
  }

  const connect = async () => {
    try {
      const { solana } = window as any
      
      if (!solana?.isPhantom) {
        alert('Please install Phantom wallet')
        return
      }

      const response = await solana.connect()
      setPublicKey(response.publicKey)
      setAddress(response.publicKey.toString())
      setConnected(true)
    } catch (error) {
      console.error('Error connecting wallet:', error)
    }
  }

  const disconnect = async () => {
    try {
      const { solana } = window as any
      
      if (solana?.isPhantom) {
        await solana.disconnect()
      }
      
      setPublicKey(null)
      setAddress(null)
      setConnected(false)
    } catch (error) {
      console.error('Error disconnecting wallet:', error)
    }
  }

  const signMessage = async (message: string): Promise<string> => {
    try {
      const { solana } = window as any
      
      if (!solana?.isPhantom) {
        throw new Error('Phantom wallet not found')
      }

      const encodedMessage = new TextEncoder().encode(message)
      const signedMessage = await solana.signMessage(encodedMessage, 'utf8')
      
      return Buffer.from(signedMessage.signature).toString('hex')
    } catch (error) {
      console.error('Error signing message:', error)
      throw error
    }
  }

  return {
    connected,
    publicKey,
    address,
    connect,
    disconnect,
    signMessage,
  }
}
```

### Message Verification Hook

```typescript
// hooks/use-blockchain-verification.ts
import { useState } from 'react'
import { useWallet } from './use-wallet'

interface VerificationState {
  isVerifying: boolean
  verifyMessage: (messageId: string, messageHash: string) => Promise<boolean>
  getVerificationStatus: (messageId: string) => Promise<any>
}

export function useBlockchainVerification(): VerificationState {
  const [isVerifying, setIsVerifying] = useState(false)
  const { connected } = useWallet()

  const verifyMessage = async (messageId: string, messageHash: string): Promise<boolean> => {
    if (!connected) {
      throw new Error('Wallet not connected')
    }

    setIsVerifying(true)
    
    try {
      const response = await fetch('/api/blockchain/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          messageId,
          messageHash,
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Verification failed')
      }

      return data.verified
    } catch (error) {
      console.error('Error verifying message:', error)
      throw error
    } finally {
      setIsVerifying(false)
    }
  }

  const getVerificationStatus = async (messageId: string): Promise<any> => {
    try {
      const response = await fetch(`/api/blockchain/verify?messageId=${messageId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get verification status')
      }

      return data
    } catch (error) {
      console.error('Error getting verification status:', error)
      throw error
    }
  }

  return {
    isVerifying,
    verifyMessage,
    getVerificationStatus,
  }
}
```

## Deployment Instructions

### 1. Build and Deploy Solana Programs

```bash
# Install Solana CLI
curl -sSf https://raw.githubusercontent.com/solana-labs/solana/v1.16.0/install/solana-install-init.sh | sh

# Install Anchor CLI
npm install -g @project-serum/anchor-cli

# Build programs
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Deploy to mainnet
anchor deploy --provider.cluster mainnet
```

### 2. Configure Environment Variables

```bash
# Add to .env.local
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_CLUSTER=mainnet-beta
SOLANA_PRIVATE_KEY=your-private-key-hex
SOLANA_WALLET_PUBLIC_KEY=your-wallet-public-key
SOLANA_MESSAGE_PROGRAM_ID=your-message-program-id
SOLANA_USER_PROGRAM_ID=your-user-program-id
```

### 3. Frontend Configuration

```typescript
// Configure wallet adapter
const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
  new TorusWalletAdapter(),
]

const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
```

## Security Considerations

1. **Private Key Management**: Never expose private keys in client-side code
2. **Transaction Validation**: Always validate transactions on the server
3. **Rate Limiting**: Implement rate limiting for blockchain operations
4. **Error Handling**: Properly handle blockchain errors and network issues
5. **Audit**: Regular security audits of smart contracts

## Testing

### Unit Tests

```typescript
// tests/blockchain.test.ts
import { BlockchainService } from '../lib/blockchain-service'

describe('Blockchain Service', () => {
  let service: BlockchainService

  beforeEach(() => {
    service = new BlockchainService()
  })

  it('should notarize message', async () => {
    const signature = await service.notarizeMessage(
      'test-message-id',
      'test-hash',
      'test-sender'
    )
    
    expect(signature).toBeDefined()
  })

  it('should verify message', async () => {
    const record = await service.verifyMessage('test-message-id')
    
    expect(record.messageId).toBe('test-message-id')
  })
})
```

### Integration Tests

```typescript
// tests/integration/blockchain.test.ts
import request from 'supertest'
import { app } from '../app'

describe('Blockchain API', () => {
  it('should verify message via API', async () => {
    const response = await request(app)
      .post('/api/blockchain/verify')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        messageId: 'test-id',
        messageHash: 'test-hash',
      })

    expect(response.status).toBe(200)
    expect(response.body.verified).toBe(true)
  })
})
```

## Monitoring and Analytics

1. **Transaction Monitoring**: Track all blockchain transactions
2. **Error Tracking**: Monitor failed transactions and errors
3. **Performance Metrics**: Track transaction confirmation times
4. **Cost Analysis**: Monitor transaction costs and optimize

## Future Enhancements

1. **Cross-chain Support**: Support for multiple blockchains
2. **Advanced Verification**: More sophisticated verification algorithms
3. **Batch Processing**: Batch multiple messages for efficiency
4. **Layer 2 Solutions**: Integration with Layer 2 scaling solutions
