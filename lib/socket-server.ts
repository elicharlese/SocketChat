import { Server as SocketIOServer } from "socket.io"
import type { Server as NetServer } from "http"

export type NextApiResponseServerIO = {
  socket: {
    server: NetServer & {
      io: SocketIOServer
    }
  }
}

export class SocketService {
  private static io: SocketIOServer | null = null

  static getIO(): SocketIOServer | null {
    return SocketService.io
  }

  static initIO(httpServer: NetServer): SocketIOServer {
    if (SocketService.io) {
      console.log("Socket.io already initialized")
      return SocketService.io
    }

    const io = new SocketIOServer(httpServer, {
      path: "/api/socketio",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      maxHttpBufferSize: 10e6, // 10MB max file size
    })

    // Socket.io event handlers
    io.on("connection", (socket) => {
      console.log(`Socket connected: ${socket.id}`)

      // Handle joining a room
      socket.on("join-room", (roomId: string, userId: string) => {
        socket.join(roomId)
        socket.to(roomId).emit("user-connected", userId)
      })

      // Handle encrypted messages
      socket.on(
        "send-message",
        (data: {
          id: string
          roomId: string
          encryptedMessage: string
          sender: string
          timestamp: string
          replyTo?: string
          media?: {
            encryptedData: string
            type: string
            hash: string
          }
        }) => {
          socket.to(data.roomId).emit("receive-message", {
            id: data.id,
            encryptedMessage: data.encryptedMessage,
            sender: data.sender,
            timestamp: data.timestamp,
            replyTo: data.replyTo,
            media: data.media,
          })
        },
      )

      // Handle message edits
      socket.on(
        "edit-message",
        (data: {
          id: string
          roomId: string
          encryptedMessage: string
          editedAt: string
        }) => {
          socket.to(data.roomId).emit("message-edit", {
            id: data.id,
            encryptedMessage: data.encryptedMessage,
            sender: socket.id,
            editedAt: data.editedAt,
          })
        },
      )

      // Handle message deletions
      socket.on(
        "delete-message",
        (data: {
          id: string
          roomId: string
        }) => {
          socket.to(data.roomId).emit("message-delete", {
            id: data.id,
            sender: socket.id,
          })
        },
      )

      // Handle reactions
      socket.on(
        "message-reaction",
        (data: {
          messageId: string
          roomId: string
          emoji: string
          remove?: boolean
        }) => {
          socket.to(data.roomId).emit("message-reaction", {
            messageId: data.messageId,
            userId: socket.id,
            emoji: data.emoji,
            remove: data.remove,
          })
        },
      )

      // Handle read receipts
      socket.on(
        "message-read",
        (data: {
          messageId: string
          userId: string
          roomId: string
        }) => {
          socket.to(data.roomId).emit("message-read", {
            messageId: data.messageId,
            userId: data.userId,
          })
        },
      )

      // Handle typing indicators
      socket.on(
        "user-typing",
        (data: {
          userId: string
          roomId: string
        }) => {
          socket.to(data.roomId).emit("user-typing", data)
        },
      )

      // Handle key exchange
      socket.on("exchange-keys", (data: { userId: string; publicKey: string; recipientId: string }) => {
        socket.to(data.recipientId).emit("exchange-keys", {
          userId: data.userId,
          publicKey: data.publicKey,
        })
      })

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`)
      })
    })

    SocketService.io = io
    console.log("Socket.io initialized")
    return io
  }
}

