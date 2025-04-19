"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { io, type Socket } from "socket.io-client"
import { EncryptionService } from "@/utils/encryption"

interface MediaData {
  encryptedData: string
  type: string
  hash: string
}

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  userId: string | null
  joinRoom: (roomId: string) => void
  sendMessage: (
    roomId: string,
    message: string,
    recipientId: string,
    media?: MediaData,
    replyTo?: string | null,
  ) => Promise<void>
  currentRoom: string | null
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  userId: null,
  joinRoom: () => {},
  sendMessage: async () => {},
  currentRoom: null,
})

export const useSocket = () => useContext(SocketContext)

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [currentRoom, setCurrentRoom] = useState<string | null>(null)
  const encryptionService = EncryptionService.getInstance()

  useEffect(() => {
    // Initialize socket connection
    const initSocket = async () => {
      // Check if the socket server is running
      await fetch("/api/socket")

      const socketInstance = io({
        path: "/api/socketio",
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })

      socketInstance.on("connect", async () => {
        console.log("Socket connected")
        setIsConnected(true)

        // Generate a unique user ID
        const generatedUserId = socketInstance.id
        setUserId(generatedUserId)

        // Initialize encryption
        await encryptionService.generateKeyPair()
      })

      socketInstance.on("disconnect", () => {
        console.log("Socket disconnected")
        setIsConnected(false)
      })

      socketInstance.on("connect_error", (err) => {
        console.log("Connection error:", err.message)
      })

      setSocket(socketInstance)
    }

    initSocket()

    return () => {
      if (socket) {
        socket.disconnect()
      }
    }
  }, [])

  const joinRoom = (roomId: string) => {
    if (socket && userId) {
      socket.emit("join-room", roomId, userId)
      setCurrentRoom(roomId)
    }
  }

  const sendMessage = async (
    roomId: string,
    message: string,
    recipientId: string,
    media?: MediaData,
    replyTo?: string | null,
  ) => {
    if (socket && userId) {
      try {
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        const encryptedMessage = await encryptionService.encryptMessage(message, recipientId)

        const messageData: any = {
          id: messageId,
          roomId,
          encryptedMessage,
          sender: userId,
          timestamp: new Date().toISOString(),
        }

        // Add media if present
        if (media) {
          messageData.media = media
        }

        // Add reply reference if replying to another message
        if (replyTo) {
          messageData.replyTo = replyTo
        }

        socket.emit("send-message", messageData)
      } catch (error) {
        console.error("Error encrypting message:", error)
      }
    }
  }

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        userId,
        joinRoom,
        sendMessage,
        currentRoom,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

