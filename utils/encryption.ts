// This is a simplified version of encryption for demonstration
// In production, use a proper encryption library like TweetNaCl or libsodium

export class EncryptionService {
  private static instance: EncryptionService
  private keyPair: CryptoKeyPair | null = null
  private peerPublicKeys: Map<string, CryptoKey> = new Map()

  private constructor() {}

  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService()
    }
    return EncryptionService.instance
  }

  public async generateKeyPair(): Promise<void> {
    this.keyPair = await window.crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      ["deriveKey", "deriveBits"],
    )
  }

  public async getPublicKeyAsString(): Promise<string> {
    if (!this.keyPair) {
      await this.generateKeyPair()
    }
    const publicKeyBuffer = await window.crypto.subtle.exportKey("raw", this.keyPair!.publicKey)
    return this.arrayBufferToBase64(publicKeyBuffer)
  }

  public async addPeerPublicKey(userId: string, publicKeyString: string): Promise<void> {
    const publicKeyBuffer = this.base64ToArrayBuffer(publicKeyString)
    const publicKey = await window.crypto.subtle.importKey(
      "raw",
      publicKeyBuffer,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      [],
    )
    this.peerPublicKeys.set(userId, publicKey)
  }

  public async encryptMessage(message: string, recipientId: string): Promise<string> {
    const recipientPublicKey = this.peerPublicKeys.get(recipientId)
    if (!recipientPublicKey) {
      throw new Error(`No public key found for user ${recipientId}`)
    }

    // Derive shared secret
    const sharedSecret = await window.crypto.subtle.deriveBits(
      {
        name: "ECDH",
        public: recipientPublicKey,
      },
      this.keyPair!.privateKey,
      256,
    )

    // Use shared secret to derive encryption key
    const encryptionKey = await window.crypto.subtle.importKey("raw", sharedSecret, { name: "AES-GCM" }, false, [
      "encrypt",
    ])

    // Generate random IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12))

    // Encrypt the message
    const encoder = new TextEncoder()
    const messageBuffer = encoder.encode(message)
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      encryptionKey,
      messageBuffer,
    )

    // Combine IV and encrypted data
    const result = new Uint8Array(iv.length + encryptedBuffer.byteLength)
    result.set(iv)
    result.set(new Uint8Array(encryptedBuffer), iv.length)

    return this.arrayBufferToBase64(result)
  }

  public async decryptMessage(encryptedMessage: string, senderId: string): Promise<string> {
    const senderPublicKey = this.peerPublicKeys.get(senderId)
    if (!senderPublicKey) {
      throw new Error(`No public key found for user ${senderId}`)
    }

    // Derive shared secret
    const sharedSecret = await window.crypto.subtle.deriveBits(
      {
        name: "ECDH",
        public: senderPublicKey,
      },
      this.keyPair!.privateKey,
      256,
    )

    // Use shared secret to derive decryption key
    const decryptionKey = await window.crypto.subtle.importKey("raw", sharedSecret, { name: "AES-GCM" }, false, [
      "decrypt",
    ])

    // Extract IV and encrypted data
    const encryptedBuffer = this.base64ToArrayBuffer(encryptedMessage)
    const iv = encryptedBuffer.slice(0, 12)
    const data = encryptedBuffer.slice(12)

    // Decrypt the message
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      decryptionKey,
      data,
    )

    const decoder = new TextDecoder()
    return decoder.decode(decryptedBuffer)
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ""
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }
}

