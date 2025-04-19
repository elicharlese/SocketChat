"use client"

import React from "react"

import { useState, useEffect, useRef, type KeyboardEvent } from "react"
import { useSocket } from "@/contexts/socket-context"
import { EncryptionService } from "@/utils/encryption"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Shield,
  Lock,
  Send,
  Menu,
  Plus,
  Hash,
  X,
  ChevronLeft,
  ChevronRight,
  type File,
  Paperclip,
  Smile,
  Edit,
  Trash2,
  CheckCheck,
  Reply,
  Terminal,
  ExternalLink,
  Maximize2,
  Minimize2,
  Key,
  Database,
  AlertTriangle,
  RefreshCw,
  Code,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { MediaEncryptionService } from "@/utils/media-encryption"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Markdown } from "@/components/markdown"
import data from "@emoji-mart/data"
import Picker from "@emoji-mart/react"

interface Reaction {
  emoji: string
  userId: string
}

interface Media {
  type: string
  data: string
  hash: string
  verified: boolean
}

interface Message {
  id: string
  text: string
  sender: string
  timestamp: string
  isDecrypted: boolean
  editedAt?: string
  reactions?: Reaction[]
  media?: Media
  replyTo?: string
  isDeleted?: boolean
  readBy?: string[]
}

type TypingUser = {
  userId: string
  timestamp: number
}

interface PopoutChatWindow {
  id: string
  roomId: string
  recipientId: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  minimized: boolean
}

// Type guard for ethereum object
const hasEthereumProvider = (): boolean => {
  return typeof window !== "undefined" && typeof window.ethereum !== "undefined" && window.ethereum !== null
}

export default function Chat() {
  const { socket, isConnected, userId, joinRoom, sendMessage, currentRoom } = useSocket()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [roomId, setRoomId] = useState("")
  const [recipientId, setRecipientId] = useState("")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [rooms, setRooms] = useState<string[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaType, setMediaType] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null)
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null)
  const [popoutWindows, setPopoutWindows] = useState<PopoutChatWindow[]>([])
  const [isDragging, setIsDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const [showEncryptionDetails, setShowEncryptionDetails] = useState(false)
  const [idePreference, setIdePreference] = useState<string>("vscode")
  const [showIdePreferences, setShowIdePreferences] = useState<boolean>(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const encryptionService = EncryptionService.getInstance()
  const mediaEncryptionService = MediaEncryptionService.getInstance()
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const popoutRefs = useRef<{ [key: string]: React.RefObject<HTMLDivElement> }>({})

  useEffect(() => {
    if (!socket) return

    // Clear any previous connection errors when socket is available
    setConnectionError(null)

    const handleReceiveMessage = async (data: {
      id: string
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
      try {
        const decryptedMessage = await encryptionService.decryptMessage(data.encryptedMessage, data.sender)

        let mediaData = null
        let mediaVerified = false

        if (data.media) {
          // Decrypt media
          const decryptedMedia = await mediaEncryptionService.decryptMedia(data.media.encryptedData, data.sender)

          // Verify hash (blockchain-inspired integrity check)
          const calculatedHash = await mediaEncryptionService.calculateHash(decryptedMedia)
          mediaVerified = calculatedHash === data.media.hash

          mediaData = {
            type: data.media.type,
            data: decryptedMedia,
            hash: data.media.hash,
            verified: mediaVerified,
          }
        }

        const newMessage: Message = {
          id: data.id,
          text: decryptedMessage,
          sender: data.sender,
          timestamp: data.timestamp,
          isDecrypted: true,
          media: mediaData,
          reactions: [],
          readBy: [],
          replyTo: data.replyTo,
        }

        setMessages((prev) => [...prev, newMessage])

        // Send read receipt
        if (socket && userId && selectedRoom) {
          socket.emit("message-read", {
            messageId: data.id,
            userId,
            roomId: selectedRoom,
          })
        }
      } catch (error) {
        console.error("Error decrypting message:", error)
        setMessages((prev) => [
          ...prev,
          {
            id: data.id,
            text: "[Encrypted message - unable to decrypt]",
            sender: data.sender,
            timestamp: data.timestamp,
            isDecrypted: false,
            reactions: [],
            readBy: [],
          },
        ])
      }
    }

    const handleMessageEdit = async (data: {
      id: string
      encryptedMessage: string
      sender: string
      editedAt: string
    }) => {
      try {
        const decryptedMessage = await encryptionService.decryptMessage(data.encryptedMessage, data.sender)

        setMessages((prev) =>
          prev.map((msg) => (msg.id === data.id ? { ...msg, text: decryptedMessage, editedAt: data.editedAt } : msg)),
        )
      } catch (error) {
        console.error("Error decrypting edited message:", error)
      }
    }

    const handleMessageDelete = (data: { id: string; sender: string }) => {
      setMessages((prev) => prev.map((msg) => (msg.id === data.id ? { ...msg, isDeleted: true } : msg)))
    }

    const handleMessageReaction = (data: {
      messageId: string
      userId: string
      emoji: string
      remove?: boolean
    }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === data.messageId) {
            let updatedReactions = msg.reactions || []

            if (data.remove) {
              // Remove reaction
              updatedReactions = updatedReactions.filter((r) => !(r.userId === data.userId && r.emoji === data.emoji))
            } else {
              // Add reaction if not already exists
              const exists = updatedReactions.some((r) => r.userId === data.userId && r.emoji === data.emoji)

              if (!exists) {
                updatedReactions = [
                  ...updatedReactions,
                  {
                    userId: data.userId,
                    emoji: data.emoji,
                  },
                ]
              }
            }

            return { ...msg, reactions: updatedReactions }
          }
          return msg
        }),
      )
    }

    const handleMessageRead = (data: { messageId: string; userId: string }) => {
      if (data.userId === userId) return // Don't process own read receipts

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === data.messageId) {
            const readBy = msg.readBy || []
            if (!readBy.includes(data.userId)) {
              return { ...msg, readBy: [...readBy, data.userId] }
            }
          }
          return msg
        }),
      )
    }

    const handleUserTyping = (data: { userId: string; roomId: string }) => {
      if (data.userId === userId || data.roomId !== selectedRoom) return

      const now = Date.now()

      setTypingUsers((prev) => {
        // Remove this user from the array if they're already in it
        const filtered = prev.filter((u) => u.userId !== data.userId)
        // Add the user with the updated timestamp
        return [...filtered, { userId: data.userId, timestamp: now }]
      })
    }

    const handleUserConnected = async (connectedUserId: string) => {
      // Exchange public keys when a new user connects
      if (userId) {
        const myPublicKey = await encryptionService.getPublicKeyAsString()
        socket.emit("exchange-keys", {
          userId,
          publicKey: myPublicKey,
          recipientId: connectedUserId,
        })
      }
    }

    const handleKeyExchange = async (data: { userId: string; publicKey: string }) => {
      await encryptionService.addPeerPublicKey(data.userId, data.publicKey)

      // Send back your public key if you haven't already
      if (userId && data.userId !== userId) {
        const myPublicKey = await encryptionService.getPublicKeyAsString()
        socket.emit("exchange-keys", {
          userId,
          publicKey: myPublicKey,
          recipientId: data.userId,
        })
      }
    }

    socket.on("receive-message", handleReceiveMessage)
    socket.on("message-edit", handleMessageEdit)
    socket.on("message-delete", handleMessageDelete)
    socket.on("message-reaction", handleMessageReaction)
    socket.on("message-read", handleMessageRead)
    socket.on("user-typing", handleUserTyping)
    socket.on("user-connected", handleUserConnected)
    socket.on("exchange-keys", handleKeyExchange)
    socket.on("connect_error", (err) => {
      setConnectionError(err.message || "Failed to connect to the server.")
    })

    return () => {
      socket.off("receive-message", handleReceiveMessage)
      socket.off("message-edit", handleMessageEdit)
      socket.off("message-delete", handleMessageDelete)
      socket.off("message-reaction", handleMessageReaction)
      socket.off("message-read", handleMessageRead)
      socket.off("user-typing", handleUserTyping)
      socket.off("user-connected", handleUserConnected)
      socket.off("exchange-keys", handleKeyExchange)
      socket.off("connect_error", () => {})
    }
  }, [socket, userId, selectedRoom])

  // Check for expired typing indicators every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setTypingUsers(
        (prev) => prev.filter((user) => now - user.timestamp < 3000), // Remove after 3 seconds
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingMessageId])

  // Handle dragging and resizing of popout windows
  useEffect(() => {
    if (!isDragging && !isResizing) return

    let rafId: number | null = null
    let lastX = 0
    let lastY = 0

    const handleMouseMove = (e: MouseEvent) => {
      // Cancel any pending animation frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }

      // Store the current mouse position
      lastX = e.clientX
      lastY = e.clientY

      // Use requestAnimationFrame for smoother updates
      rafId = requestAnimationFrame(() => {
        if (isDragging) {
          // Direct DOM manipulation for smoother dragging
          const windowElement = popoutRefs.current[isDragging]?.current
          if (windowElement) {
            const newX = lastX - dragOffset.x
            const newY = lastY - dragOffset.y

            // Use transform for hardware acceleration
            windowElement.style.transform = `translate3d(${newX - windowElement.offsetLeft}px, ${newY - windowElement.offsetTop}px, 0)`
          }
        } else if (isResizing) {
          const window = popoutWindows.find((w) => w.id === isResizing)
          if (window) {
            const ref = popoutRefs.current[isResizing]
            if (ref && ref.current) {
              const rect = ref.current.getBoundingClientRect()
              setPopoutWindows((prev) =>
                prev.map((w) =>
                  w.id === isResizing
                    ? {
                        ...w,
                        size: {
                          width: Math.max(300, lastX - rect.left),
                          height: Math.max(200, lastY - rect.top),
                        },
                      }
                    : w,
                ),
              )
            }
          }
        }
      })
    }

    const handleMouseUp = () => {
      if (isDragging) {
        // Update the final position in React state
        const windowElement = popoutRefs.current[isDragging]?.current
        if (windowElement) {
          // Get the current transform and reset it
          const transform = windowElement.style.transform
          windowElement.style.transform = ""

          // Calculate the final position
          const match = transform.match(/translate3d\((-?\d+(?:\.\d+)?)px, (-?\d+(?:\.\d+)?)px/)
          if (match) {
            const translateX = Number.parseFloat(match[1])
            const translateY = Number.parseFloat(match[2])

            setPopoutWindows((prev) =>
              prev.map((window) =>
                window.id === isDragging
                  ? {
                      ...window,
                      position: {
                        x: window.position.x + translateX,
                        y: window.position.y + translateY,
                      },
                    }
                  : window,
              ),
            )
          } else {
            // Fallback to mouse position if transform parsing fails
            setPopoutWindows((prev) =>
              prev.map((window) =>
                window.id === isDragging
                  ? {
                      ...window,
                      position: {
                        x: lastX - dragOffset.x,
                        y: lastY - dragOffset.y,
                      },
                    }
                  : window,
              ),
            )
          }
        }
      }

      setIsDragging(null)
      setIsResizing(null)

      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [isDragging, isResizing, dragOffset, popoutWindows])

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      joinRoom(roomId)
      setSelectedRoom(roomId)
      if (!rooms.includes(roomId)) {
        setRooms([...rooms, roomId])
      }
      setDialogOpen(false)
      setMobileSidebarOpen(false) // Close sidebar on mobile after joining
    }
  }

  const handleRoomSelect = (room: string) => {
    joinRoom(room)
    setSelectedRoom(room)
    setMobileSidebarOpen(false)
  }

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !mediaFile) || !selectedRoom || !recipientId) return

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const mediaData = null

    // Handle media upload if present
    if (mediaFile) {
      setIsUploading(true)
      try {
        // Read file as data URL
        const reader = new FileReader()
        const mediaDataPromise = new Promise<string>((resolve) => {
          reader.onload = (e) => {
            const result = e.target?.result as string
            resolve(result)
          }
          reader.readAsDataURL(mediaFile)
        })

        const mediaDataUrl = await mediaDataPromise

        // Calculate hash for verification (blockchain-inspired)
        const hash = await mediaEncryptionService.calculateHash(mediaDataUrl)

        // Encrypt media
        const encryptedMedia = await mediaEncryptionService.encryptMedia(mediaDataUrl, recipientId)

        // Add to local messages immediately
        setMessages((prev) => [
          ...prev,
          {
            id: messageId,
            text: inputMessage,
            sender: userId || "unknown",
            timestamp: new Date().toISOString(),
            isDecrypted: true,
            media: {
              type: mediaFile.type,
              data: mediaDataUrl,
              hash,
              verified: true,
            },
            reactions: [],
            readBy: [userId || "unknown"],
            replyTo: replyToMessageId,
          },
        ])

        // Send encrypted message with media
        await sendMessage(
          selectedRoom,
          inputMessage,
          recipientId,
          {
            encryptedData: encryptedMedia,
            type: mediaFile.type,
            hash,
          },
          replyToMessageId,
        )
      } catch (error) {
        console.error("Error processing media:", error)
      } finally {
        setIsUploading(false)
        setMediaFile(null)
        setMediaPreview(null)
        setMediaType("")
      }
    } else {
      // Text-only message
      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          text: inputMessage,
          sender: userId || "unknown",
          timestamp: new Date().toISOString(),
          isDecrypted: true,
          reactions: [],
          readBy: [userId || "unknown"],
          replyTo: replyToMessageId,
        },
      ])

      // Send encrypted message
      await sendMessage(selectedRoom, inputMessage, recipientId, undefined, replyToMessageId)
    }

    setInputMessage("")
    setReplyToMessageId(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit")
      return
    }

    setMediaFile(file)
    setMediaType(file.type)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setMediaPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleFileUploadClick = () => {
    fileInputRef.current?.click()
  }

  const cancelMediaUpload = () => {
    setMediaFile(null)
    setMediaPreview(null)
    setMediaType("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleEditMessage = (messageId: string, text: string) => {
    setEditingMessageId(messageId)
    setEditText(text)
  }

  const saveEditedMessage = async () => {
    if (!editingMessageId || !editText.trim() || !selectedRoom || !recipientId) {
      cancelEdit()
      return
    }

    try {
      // Encrypt the edited message
      const encryptedMessage = await encryptionService.encryptMessage(editText, recipientId)
      const editedAt = new Date().toISOString()

      // Update local state
      setMessages((prev) =>
        prev.map((msg) => (msg.id === editingMessageId ? { ...msg, text: editText, editedAt } : msg)),
      )

      // Send to server
      socket?.emit("edit-message", {
        id: editingMessageId,
        roomId: selectedRoom,
        encryptedMessage,
        editedAt,
      })

      // Clear edit state
      cancelEdit()
    } catch (error) {
      console.error("Error editing message:", error)
    }
  }

  const cancelEdit = () => {
    setEditingMessageId(null)
    setEditText("")
  }

  const handleDeleteMessage = (messageId: string) => {
    // Update local state
    setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, isDeleted: true } : msg)))

    // Send to server
    socket?.emit("delete-message", {
      id: messageId,
      roomId: selectedRoom,
    })
  }

  const handleReaction = (messageId: string, emoji: string, remove?: boolean) => {
    if (!selectedRoom) return

    // Update local state optimistically
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          let updatedReactions = msg.reactions || []

          if (remove) {
            updatedReactions = updatedReactions.filter((r) => !(r.userId === userId && r.emoji === emoji))
          } else {
            // Check if this reaction already exists
            const existingReaction = updatedReactions.find((r) => r.userId === userId && r.emoji === emoji)

            if (!existingReaction) {
              updatedReactions = [
                ...updatedReactions,
                {
                  userId: userId || "unknown",
                  emoji,
                },
              ]
            }
          }

          return { ...msg, reactions: updatedReactions }
        }
        return msg
      }),
    )

    // Send to server
    socket?.emit("message-reaction", {
      messageId,
      roomId: selectedRoom,
      emoji,
      remove,
    })
  }

  const handleReplyTo = (messageId: string) => {
    setReplyToMessageId(messageId)
    // Focus the input field
    document.getElementById("message-input")?.focus()
  }

  const cancelReply = () => {
    setReplyToMessageId(null)
  }

  const getReplyToMessage = (messageId: string | null) => {
    if (!messageId) return null
    return messages.find((m) => m.id === messageId)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value)

    // Handle typing indicator
    if (socket && userId && selectedRoom) {
      // Clear existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout)
      }

      // Only emit if not already typing
      if (!isTyping) {
        socket.emit("user-typing", {
          userId,
          roomId: selectedRoom,
        })
        setIsTyping(true)
      }

      // Set timeout to stop typing indicator after 3 seconds
      const timeout = setTimeout(() => {
        setIsTyping(false)
      }, 3000)

      setTypingTimeout(timeout)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Send on Enter (but not with Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (editingMessageId) {
        saveEditedMessage()
      } else {
        handleSendMessage()
      }
    }

    // Cancel on Escape
    if (e.key === "Escape") {
      if (editingMessageId) {
        cancelEdit()
      } else if (replyToMessageId) {
        cancelReply()
      }
    }
  }

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(!mobileSidebarOpen)
  }

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const createPopoutWindow = () => {
    if (!selectedRoom || !recipientId) return

    const id = `popout_${Date.now()}`

    // Calculate a better default position based on screen size
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight

    const newWindow: PopoutChatWindow = {
      id,
      roomId: selectedRoom,
      recipientId,
      position: {
        x: Math.max(screenWidth / 2 - 200, 20),
        y: Math.max(screenHeight / 4, 20),
      },
      size: { width: 400, height: 500 },
      minimized: false,
    }

    popoutRefs.current[id] = React.createRef()
    setPopoutWindows((prev) => [...prev, newWindow])
  }

  const closePopoutWindow = (id: string) => {
    setPopoutWindows((prev) => prev.filter((window) => window.id !== id))
    delete popoutRefs.current[id]
  }

  const toggleMinimizePopout = (id: string) => {
    setPopoutWindows((prev) =>
      prev.map((window) => (window.id === id ? { ...window, minimized: !window.minimized } : window)),
    )
  }

  const handlePopoutDragStart = (e: React.MouseEvent, id: string) => {
    const window = popoutWindows.find((w) => w.id === id)
    if (window) {
      setIsDragging(id)
      setDragOffset({
        x: e.clientX - window.position.x,
        y: e.clientY - window.position.y,
      })
    }
  }

  const handlePopoutResizeStart = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(id)
  }

  const filteredMessages = (roomId: string) => {
    return messages.filter(
      (msg) =>
        (msg.sender === userId || currentRoom === roomId) &&
        (selectedRoom === roomId || popoutWindows.some((w) => w.roomId === roomId)),
    )
  }

  const isCodeFile = (text: string): boolean => {
    // Check if the message contains code file references
    const codeFileExtensions = [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".html",
      ".css",
      ".json",
      ".py",
      ".java",
      ".c",
      ".cpp",
      ".go",
      ".rb",
      ".php",
      ".swift",
      ".kt",
      ".rs",
      ".sol",
    ]

    // Check for file extensions in the text
    for (const ext of codeFileExtensions) {
      if (text.includes(ext)) return true
    }

    // Check for common code patterns
    const codePatterns = [
      /```[\s\S]*?```/g, // Markdown code blocks
      /import\s+.*\s+from\s+['"].*['"]/g, // JS/TS imports
      /function\s+\w+\s*\(/g, // Function declarations
      /class\s+\w+/g, // Class declarations
      /<\/?[a-z][\s\S]*>/i, // HTML tags
    ]

    return codePatterns.some((pattern) => pattern.test(text))
  }

  const getPreferredIDE = (): string => {
    // This could be expanded to read from user preferences
    return idePreference
  }

  const openInIDE = (text: string) => {
    // Extract code content or file references
    let codeContent = text

    // If there's a code block, extract it
    const codeBlockMatch = text.match(/```[\s\S]*?```/g)
    if (codeBlockMatch && codeBlockMatch.length > 0) {
      codeContent = codeBlockMatch[0].replace(/```[\s\S]*?\n/, "").replace(/```$/, "")
    }

    // Create a temporary file and open it in the IDE
    // For web security reasons, we'll use a custom URL scheme that needs to be registered on the user's system
    const encodedContent = encodeURIComponent(codeContent)

    // Different URL schemes for different IDEs
    const ideURLs: Record<string, string> = {
      vscode: `vscode://file/temp/socketChat_${Date.now()}.txt?content=${encodedContent}`,
      webstorm: `webstorm://open?file=temp/socketChat_${Date.now()}.txt&content=${encodedContent}`,
      atom: `atom://open?file=temp/socketChat_${Date.now()}.txt?content=${encodedContent}`,
    }

    const ideURL = ideURLs[idePreference] || ideURLs.vscode

    // Open the URL - this requires the user to have the appropriate URL handler registered
    window.open(ideURL, "_blank")
  }

  const IdePreferencesDialog = () => (
    <Dialog open={showIdePreferences} onOpenChange={setShowIdePreferences}>
      <DialogContent className="bg-gray-900/95 backdrop-blur-md border-gray-700/50 text-gray-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-blue-400 flex items-center gap-2">
            <Code size={16} />
            IDE Preferences
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-gray-300">Select your preferred IDE</label>
            <div className="mt-3 space-y-2">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="vscode"
                  name="ide"
                  value="vscode"
                  checked={idePreference === "vscode"}
                  onChange={() => setIdePreference("vscode")}
                  className="mr-2"
                />
                <label htmlFor="vscode" className="text-sm text-gray-300">
                  Visual Studio Code
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="webstorm"
                  name="ide"
                  value="webstorm"
                  checked={idePreference === "webstorm"}
                  onChange={() => setIdePreference("webstorm")}
                  className="mr-2"
                />
                <label htmlFor="webstorm" className="text-sm text-gray-300">
                  WebStorm
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="atom"
                  name="ide"
                  value="atom"
                  checked={idePreference === "atom"}
                  onChange={() => setIdePreference("atom")}
                  className="mr-2"
                />
                <label htmlFor="atom" className="text-sm text-gray-300">
                  Atom
                </label>
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-2">
            <p>
              Note: You need to have the appropriate URL handler configured on your system for this feature to work.
            </p>
          </div>
          <Button
            onClick={() => setShowIdePreferences(false)}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
          >
            Save Preferences
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-gray-100 overflow-hidden">
        {/* Enhanced animated background */}
        <div className="absolute inset-0 overflow-hidden -z-10">
          <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] bg-gradient-to-br from-blue-600/15 to-purple-600/15 rounded-full blur-3xl animate-pulse-slow" />
          <div
            className="absolute -bottom-[30%] -right-[10%] w-[70%] h-[70%] bg-gradient-to-br from-indigo-600/15 to-cyan-600/15 rounded-full blur-3xl animate-pulse-slow"
            style={{ animationDelay: "2s" }}
          />
          <div
            className="absolute top-[40%] left-[60%] w-[40%] h-[40%] bg-gradient-to-br from-violet-600/15 to-blue-600/15 rounded-full blur-3xl animate-pulse-slow"
            style={{ animationDelay: "4s" }}
          />
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden fixed top-4 left-4 z-50 p-2 bg-gray-800/80 backdrop-blur-sm rounded-md border border-gray-700/50"
          onClick={toggleMobileSidebar}
        >
          {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Sidebar - Hacker style */}
        <div
          className={`fixed md:relative z-40 h-full bg-gray-900/60 backdrop-blur-md transition-all duration-300 ease-in-out border-r border-gray-700/30 ${
            sidebarCollapsed ? "md:w-20" : "md:w-72"
          } ${mobileSidebarOpen ? "w-72 left-0" : "w-72 -left-72 md:left-0"}`}
        >
          <div className="flex flex-col h-full">
            {/* Server/App name */}
            <div className="p-4 border-b border-gray-800/80 flex justify-between items-center">
              {!sidebarCollapsed && (
                <h1 className="font-bold flex items-center">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-1.5 rounded-md mr-2">
                    <Shield className="text-white" size={16} />
                  </div>
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
                    SocketChat
                  </span>
                </h1>
              )}
              {sidebarCollapsed && (
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-1.5 rounded-md mx-auto">
                  <Shield className="text-white" size={16} />
                </div>
              )}
              {!sidebarCollapsed && (
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
                  <button onClick={toggleSidebarCollapse} className="text-gray-400 hover:text-white">
                    <ChevronLeft size={16} />
                  </button>
                </div>
              )}
              {sidebarCollapsed && (
                <button
                  onClick={toggleSidebarCollapse}
                  className="absolute right-0 top-4 -mr-3 bg-gray-800/80 rounded-full p-1 text-gray-400 hover:text-white border border-gray-700/50"
                >
                  <ChevronRight size={14} />
                </button>
              )}
            </div>

            {/* Connection status */}
            <div className={`px-4 py-2 border-b border-gray-800/80 ${sidebarCollapsed ? "text-center" : ""}`}>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {!sidebarCollapsed && (
                  <>
                    <Terminal size={14} className="text-blue-400" />
                    <span>Status:</span>
                  </>
                )}
                <div className="flex items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
                  {!sidebarCollapsed ? <span>{isConnected ? "Connected" : "Disconnected"}</span> : null}
                </div>
              </div>
            </div>

            {/* Join Room Button - Top of sidebar */}
            <div className={`p-4 border-b border-gray-800/80 ${sidebarCollapsed ? "flex justify-center" : ""}`}>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  {sidebarCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-10 w-10 bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50 hover:border-blue-600/50 text-gray-200"
                          onClick={() => setDialogOpen(true)}
                        >
                          <Plus size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Join Room</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button
                      className="w-full flex items-center justify-center bg-gradient-to-r from-blue-600/20 to-indigo-600/20 hover:from-blue-600/30 hover:to-indigo-600/30 border border-blue-700/30 text-blue-400"
                      variant="outline"
                      onClick={() => setDialogOpen(true)}
                    >
                      <Plus size={16} className="mr-2" />
                      Join Secure Room
                    </Button>
                  )}
                </DialogTrigger>
                <DialogContent className="bg-gray-900/95 backdrop-blur-md border-gray-700/50 text-gray-100">
                  <DialogHeader>
                    <DialogTitle className="text-blue-400 flex items-center gap-2">
                      <Lock size={16} />
                      Join Secure Room
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <label className="text-sm font-medium text-gray-300">Room ID</label>
                      <Input
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        placeholder="Enter room ID"
                        className="mt-1 bg-gray-800/50 border-gray-700/50 focus:border-blue-600/50 text-gray-200"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-300">Recipient ID</label>
                      <Input
                        value={recipientId}
                        onChange={(e) => setRecipientId(e.target.value)}
                        placeholder="Enter recipient's user ID"
                        className="mt-1 bg-gray-800/50 border-gray-700/50 focus:border-blue-600/50 text-gray-200"
                      />
                    </div>
                    <Button
                      onClick={handleJoinRoom}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
                      disabled={!roomId.trim()}
                    >
                      Join Room
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Rooms list */}
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              {!sidebarCollapsed && (
                <div className="mb-2 px-2 text-xs font-semibold text-blue-400 uppercase flex items-center">
                  <Database size={12} className="mr-1" />
                  Secure Rooms
                </div>
              )}
              {rooms.length === 0
                ? !sidebarCollapsed && (
                    <div className="text-gray-500 text-sm px-2 py-4 text-center border border-dashed border-gray-800/50 rounded-md">
                      No rooms joined yet
                    </div>
                  )
                : rooms.map((room) =>
                    sidebarCollapsed ? (
                      <Tooltip key={room}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleRoomSelect(room)}
                            className={`w-10 h-10 rounded-md flex items-center justify-center mb-2 mx-auto ${
                              selectedRoom === room
                                ? "bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-600/50 text-blue-400"
                                : "text-gray-400 hover:bg-gray-800/50 border border-gray-800/50 hover:border-blue-600/30"
                            }`}
                          >
                            <Hash size={16} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">{room}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <button
                        key={room}
                        onClick={() => handleRoomSelect(room)}
                        className={`w-full text-left px-3 py-2 rounded-md flex items-center mb-2 group ${
                          selectedRoom === room
                            ? "bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-600/50 text-blue-400"
                            : "text-gray-400 hover:bg-gray-800/50 border border-gray-800/50 hover:border-blue-600/30"
                        }`}
                      >
                        <Hash size={16} className="mr-2" />
                        <span className="truncate flex-1">{room}</span>
                        {selectedRoom === room && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation()
                              createPopoutWindow()
                            }}
                          >
                            <ExternalLink size={12} />
                          </Button>
                        )}
                      </button>
                    ),
                  )}
            </div>

            {/* User info */}
            <div
              className={`p-3 bg-gray-800/30 backdrop-blur-sm border-t border-gray-800/80 flex ${sidebarCollapsed ? "justify-center" : "items-center"}`}
            >
              {sidebarCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-8 h-8 rounded-md bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-blue-700/30 flex items-center justify-center">
                      {userId ? userId.substring(0, 2).toUpperCase() : "?"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{userId || "Connecting..."}</TooltipContent>
                </Tooltip>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-md bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-blue-700/30 flex items-center justify-center mr-2">
                    {userId ? userId.substring(0, 2).toUpperCase() : "?"}
                  </div>
                  <div className="flex-1 truncate">
                    <div className="text-sm font-medium text-gray-300">User</div>
                    <div className="text-xs text-gray-400 truncate">
                      {hasEthereumProvider() && "selectedAddress" in window.ethereum && window.ethereum.selectedAddress
                        ? `${window.ethereum.selectedAddress.substring(0, 6)}...${window.ethereum.selectedAddress.substring(38)}`
                        : userId || "Connecting..."}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto text-gray-400 hover:text-blue-400 hover:bg-blue-600/10"
                    onClick={() => setShowEncryptionDetails(!showEncryptionDetails)}
                  >
                    <Key size={16} />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          {connectionError && (
            <div className="bg-red-900/50 border border-red-700/50 text-red-100 p-2 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <AlertTriangle size={16} />
                <p>Connection error: {connectionError}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-1 border-red-700/50 hover:bg-red-800/50 bg-red-900/30 text-red-200 hover:text-white"
                onClick={() => window.location.reload()}
              >
                <RefreshCw size={14} className="mr-1" />
                Retry Connection
              </Button>
            </div>
          )}

          {/* Chat header */}
          <div className="bg-gray-900/60 backdrop-blur-md p-4 shadow-sm flex items-center border-b border-gray-700/30">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-gray-200 hover:text-white"
                onClick={() => setSidebarOpen((prev) => !prev)}
                aria-label="Toggle sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
              {selectedRoom ? (
                <>
                  <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 p-1.5 rounded-md mr-2 border border-blue-700/30">
                    <Hash size={16} className="text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="font-semibold text-gray-200">{selectedRoom}</h2>
                    <div className="flex items-center text-xs text-green-400">
                      <Lock size={12} className="mr-1" />
                      <span>End-to-End Encrypted</span>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 bg-gray-800/50 border-gray-700/50 hover:border-blue-600/50"
                      onClick={() => setShowEncryptionDetails(!showEncryptionDetails)}
                    >
                      <Key size={14} className="mr-1.5 text-blue-400" />
                      Security Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 ml-2 bg-gray-800/50 border-gray-700/50 hover:border-blue-600/50 hover:bg-gray-700/50"
                      onClick={createPopoutWindow}
                    >
                      <ExternalLink size={14} className="mr-1.5 text-blue-400" />
                      Pop Out Chat
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center text-gray-300">
                  <Terminal size={18} className="mr-2 text-blue-400" />
                  <h2 className="font-semibold">Select or join a room to start chatting</h2>
                </div>
              )}
            </div>
          </div>

          {/* Encryption details panel */}
          {showEncryptionDetails && (
            <div className="bg-gray-900/70 backdrop-blur-md border-b border-gray-800/80 p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-blue-400 font-semibold flex items-center gap-2">
                  <Key size={16} />
                  Encryption Details
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-400"
                  onClick={() => setShowEncryptionDetails(false)}
                >
                  <X size={14} />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-gray-800/50 p-3 rounded-md border border-gray-700/50">
                  <div className="text-gray-400 mb-1">Encryption Algorithm</div>
                  <div className="font-mono text-green-400">ECDH + AES-GCM</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-md border border-gray-700/50">
                  <div className="text-gray-400 mb-1">Key Exchange</div>
                  <div className="font-mono text-green-400">P-256 Curve</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-md border border-gray-700/50">
                  <div className="text-gray-400 mb-1">Media Verification</div>
                  <div className="font-mono text-green-400">SHA-256</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-md border border-gray-700/50">
                  <div className="text-gray-400 mb-1">Connection Status</div>
                  <div className="font-mono flex items-center">
                    <div className={`h-2 w-2 rounded-full mr-2 ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
                    <span className={isConnected ? "text-green-400" : "text-red-400"}>
                      {isConnected ? "Secure Connection" : "Connection Error"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-800/20 backdrop-blur-sm scrollbar-thin scrollbar-thumb-gray-600/50 scrollbar-track-transparent">
            {!selectedRoom ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 p-4 rounded-full mb-4 border border-blue-700/30">
                  <Shield size={32} className="text-blue-400" />
                </div>
                <p className="text-gray-300 mb-2 text-lg">Welcome to SocketChat</p>
                <p className="text-gray-500">Join a room to start chatting securely</p>
              </div>
            ) : (
              <>
                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                  <div className="mb-2 text-sm text-gray-400 italic flex items-center">
                    <div className="mr-2 flex items-center">
                      <div
                        className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce mr-0.5"
                        style={{ animationDelay: "0ms" }}
                      ></div>
                      <div
                        className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce mr-0.5"
                        style={{ animationDelay: "200ms" }}
                      ></div>
                      <div
                        className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce"
                        style={{ animationDelay: "400ms" }}
                      ></div>
                    </div>
                    {typingUsers.map((user) => user.userId).join(", ")} is typing...
                  </div>
                )}

                {/* Messages */}
                {filteredMessages(selectedRoom).map((message) => (
                  <div
                    key={message.id}
                    className={`mb-3 p-3 rounded-lg break-words transition-all duration-200 ${
                      message.sender === userId
                        ? "bg-blue-600/20 backdrop-blur-sm border border-blue-500/30 ml-auto text-right shadow-sm hover:shadow-md hover:bg-blue-600/30"
                        : "bg-gray-800/30 backdrop-blur-sm border border-gray-700/30 mr-auto text-left shadow-sm hover:shadow-md hover:bg-gray-800/40"
                    } ${message.isDeleted ? "italic opacity-50" : ""}`}
                  >
                    {/* Reply Preview */}
                    {message.replyTo && getReplyToMessage(message.replyTo) && (
                      <div className="mb-2 p-2 rounded-md bg-gray-600/30 border border-gray-700/50 text-xs">
                        <span className="font-semibold">
                          {getReplyToMessage(message.replyTo)?.sender === userId
                            ? "You"
                            : getReplyToMessage(message.replyTo)?.sender}
                          :
                        </span>{" "}
                        {getReplyToMessage(message.replyTo)?.text}
                      </div>
                    )}

                    {/* Sender and Timestamp */}
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span className="font-semibold">{message.sender === userId ? "You" : message.sender}</span>
                      <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                    </div>

                    {/* Message Content */}
                    {message.isDeleted ? (
                      <div className="text-gray-500">This message was deleted.</div>
                    ) : editingMessageId === message.id ? (
                      <div className="flex items-center">
                        <Input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={handleKeyDown}
                          ref={editInputRef}
                          className="bg-gray-800/50 border-gray-700/50 text-sm flex-1 mr-2"
                        />
                        <Button variant="ghost" size="icon" onClick={saveEditedMessage}>
                          <CheckCheck size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={cancelEdit}>
                          <X size={16} />
                        </Button>
                      </div>
                    ) : (
                      <>
                        {message.media && (
                          <div className="mb-2">
                            {message.media.type.startsWith("image") ? (
                              <img
                                src={message.media.data || "/placeholder.svg"}
                                alt="Uploaded Media"
                                className="rounded-md max-h-48 object-contain"
                              />
                            ) : message.media.type.startsWith("video") ? (
                              <video src={message.media.data} className="rounded-md max-h-48 object-contain" controls />
                            ) : (
                              <a href={message.media.data} target="_blank" rel="noopener noreferrer">
                                View File
                              </a>
                            )}
                            {!message.media.verified && (
                              <div className="text-red-500 text-xs italic">Media integrity could not be verified.</div>
                            )}
                          </div>
                        )}
                        <div className="markdown-content">
                          <Markdown content={message.text} />
                        </div>
                      </>
                    )}

                    {/* Message Actions */}
                    {!message.isDeleted && editingMessageId !== message.id && (
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-blue-400 hover:bg-blue-600/10"
                          onClick={() => handleReplyTo(message.id)}
                        >
                          <Reply size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-blue-400 hover:bg-blue-600/10"
                          onClick={() => handleEditMessage(message.id, message.text)}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-red-400 hover:bg-red-600/10"
                          onClick={() => handleDeleteMessage(message.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400">
                              <Smile size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-56 bg-gray-800/90 backdrop-blur-sm border-gray-700/50 text-gray-100">
                            <Picker
                              data={data}
                              onEmojiSelect={(emoji) => handleReaction(message.id, emoji.native)}
                              theme="dark"
                            />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                    {!message.isDeleted && editingMessageId !== message.id && isCodeFile(message.text) && (
                      <div className="flex items-center justify-end mt-1 mb-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 bg-gray-800/50 border-gray-700/50 hover:border-blue-600/50 hover:bg-blue-900/20"
                            >
                              <Code size={12} className="mr-1.5 text-blue-400" />
                              Open in IDE
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-48 bg-gray-800/90 backdrop-blur-sm border-gray-700/50 text-gray-100">
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-400">Choose IDE</div>
                            <div
                              className="px-2 py-1.5 cursor-pointer hover:bg-blue-600/20"
                              onClick={() => openInIDE(message.text)}
                            >
                              Visual Studio Code
                            </div>
                            <div
                              className="px-2 py-1.5 cursor-pointer hover:bg-blue-600/20"
                              onClick={() => {
                                setIdePreference("webstorm")
                                openInIDE(message.text)
                              }}
                            >
                              WebStorm
                            </div>
                            <div
                              className="px-2 py-1.5 cursor-pointer hover:bg-blue-600/20"
                              onClick={() => {
                                setIdePreference("atom")
                                openInIDE(message.text)
                              }}
                            >
                              Atom
                            </div>
                            <div className="border-t border-gray-700/50 my-1"></div>
                            <div
                              className="px-2 py-1.5 cursor-pointer hover:bg-blue-600/20"
                              onClick={() => setShowIdePreferences(true)}
                            >
                              IDE Preferences...
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}

                    {/* Reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                      <div className="flex items-center mt-2 -ml-1">
                        {message.reactions.map((reaction, index) => (
                          <Button
                            key={index}
                            variant="ghost"
                            size="sm"
                            className="rounded-full px-2 py-1 text-sm bg-gray-700/50 hover:bg-gray-600/50"
                            onClick={() => handleReaction(message.id, reaction.emoji, reaction.userId === userId)}
                          >
                            {reaction.emoji}
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Read Receipts */}
                    {message.readBy && message.readBy.length > 0 && message.sender !== userId && (
                      <div className="flex items-center justify-end text-xs text-gray-500 mt-1">
                        Read by: {message.readBy.length}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Chat input */}
          {selectedRoom && (
            <div className="bg-gray-900/60 backdrop-blur-md p-4 border-t border-gray-700/30">
              {replyToMessageId && getReplyToMessage(replyToMessageId) && (
                <div className="mb-3 p-3 rounded-md bg-gray-800/50 border border-gray-700/50 flex items-center justify-between">
                  <div>
                    Replying to:{" "}
                    <span className="font-semibold">
                      {getReplyToMessage(replyToMessageId)?.sender === userId
                        ? "You"
                        : getReplyToMessage(replyToMessageId)?.sender}
                    </span>
                    : {getReplyToMessage(replyToMessageId)?.text}
                  </div>
                  <Button variant="ghost" size="icon" onClick={cancelReply}>
                    <X size={16} />
                  </Button>
                </div>
              )}

              {mediaPreview && (
                <div className="mb-3 p-3 rounded-md bg-gray-800/50 border border-gray-700/50">
                  {mediaType.startsWith("image") ? (
                    <img
                      src={mediaPreview || "/placeholder.svg"}
                      alt="Media Preview"
                      className="rounded-md max-h-48 object-contain"
                    />
                  ) : mediaType.startsWith("video") ? (
                    <video src={mediaPreview} className="rounded-md max-h-48 object-contain" controls />
                  ) : (
                    <a href={mediaPreview} target="_blank" rel="noopener noreferrer">
                      View File
                    </a>
                  )}
                  <div className="flex justify-end mt-2">
                    <Button variant="ghost" size="sm" className="text-red-400" onClick={cancelMediaUpload}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center">
                <Input
                  type="text"
                  id="message-input"
                  placeholder="Type your secure message here..."
                  value={inputMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-gray-800/30 backdrop-blur-sm border-gray-700/30 focus:border-blue-500/50 focus:ring-blue-500/30 text-sm mr-2 transition-all duration-200 text-gray-200"
                  disabled={isUploading}
                />
                <input
                  type="file"
                  accept="image/*, video/*, application/*"
                  onChange={handleFileChange}
                  className="hidden"
                  ref={fileInputRef}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-blue-400 hover:bg-blue-600/10"
                      onClick={handleFileUploadClick}
                      disabled={isUploading}
                    >
                      <Paperclip size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach File</TooltipContent>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-blue-400 hover:bg-blue-600/20 transition-all duration-200"
                  onClick={handleSendMessage}
                  disabled={isUploading}
                >
                  {isUploading ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Popout Chat Windows */}
      {popoutWindows.map((window) => (
        <div
          key={window.id}
          ref={popoutRefs.current[window.id]}
          className={`fixed z-50 bg-gray-900/70 backdrop-blur-md border border-gray-700/30 text-gray-100 rounded-md shadow-lg transition-all duration-200 ${
            window.minimized ? "h-12 w-64" : ""
          }`}
          style={{
            top: window.position.y,
            left: window.position.x,
            width: window.size.width,
            height: window.size.height,
          }}
        >
          <div
            className="bg-gray-800/40 backdrop-blur-sm p-3 border-b border-gray-700/30 rounded-t-md cursor-move flex items-center justify-between"
            onMouseDown={(e) => handlePopoutDragStart(e, window.id)}
          >
            <div className="flex items-center">
              <Hash size={16} className="mr-2 text-blue-400" />
              <span className="font-semibold truncate">{window.roomId}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-400 hover:text-blue-400 hover:bg-blue-600/10"
                onClick={() => toggleMinimizePopout(window.id)}
              >
                {window.minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-400 hover:text-red-400 hover:bg-red-600/10"
                onClick={() => closePopoutWindow(window.id)}
              >
                <X size={14} />
              </Button>
            </div>
          </div>
          {!window.minimized && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                  <div className="mb-2 text-sm text-gray-400 italic">
                    {typingUsers.map((user) => user.userId).join(", ")} is typing...
                  </div>
                )}

                {/* Messages */}
                {filteredMessages(window.roomId).map((message) => (
                  <div
                    key={message.id}
                    className={`mb-3 p-3 rounded-lg break-words ${
                      message.sender === userId
                        ? "bg-gray-700/50 ml-auto text-right"
                        : "bg-gray-800/50 mr-auto text-left"
                    } ${message.isDeleted ? "italic opacity-50" : ""}`}
                  >
                    {/* Reply Preview */}
                    {message.replyTo && getReplyToMessage(message.replyTo) && (
                      <div className="mb-2 p-2 rounded-md bg-gray-600/30 border border-gray-700/50 text-xs">
                        <span className="font-semibold">
                          {getReplyToMessage(message.replyTo)?.sender === userId
                            ? "You"
                            : getReplyToMessage(message.replyTo)?.sender}
                          :
                        </span>{" "}
                        {getReplyToMessage(message.replyTo)?.text}
                      </div>
                    )}

                    {/* Sender and Timestamp */}
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span className="font-semibold">{message.sender === userId ? "You" : message.sender}</span>
                      <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                    </div>

                    {/* Message Content */}
                    {message.isDeleted ? (
                      <div className="text-gray-500">This message was deleted.</div>
                    ) : editingMessageId === message.id ? (
                      <div className="flex items-center">
                        <Input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={handleKeyDown}
                          ref={editInputRef}
                          className="bg-gray-800/50 border-gray-700/50 text-sm flex-1 mr-2"
                        />
                        <Button variant="ghost" size="icon" onClick={saveEditedMessage}>
                          <CheckCheck size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={cancelEdit}>
                          <X size={16} />
                        </Button>
                      </div>
                    ) : (
                      <>
                        {message.media && (
                          <div className="mb-2">
                            {message.media.type.startsWith("image") ? (
                              <img
                                src={message.media.data || "/placeholder.svg"}
                                alt="Uploaded Media"
                                className="rounded-md max-h-48 object-contain"
                              />
                            ) : message.media.type.startsWith("video") ? (
                              <video src={message.media.data} className="rounded-md max-h-48 object-contain" controls />
                            ) : (
                              <a href={message.media.data} target="_blank" rel="noopener noreferrer">
                                View File
                              </a>
                            )}
                            {!message.media.verified && (
                              <div className="text-red-500 text-xs italic">Media integrity could not be verified.</div>
                            )}
                          </div>
                        )}
                        <div className="markdown-content">
                          <Markdown content={message.text} />
                        </div>
                      </>
                    )}

                    {/* Message Actions */}
                    {!message.isDeleted && editingMessageId !== message.id && (
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-blue-400 hover:bg-blue-600/10"
                          onClick={() => handleReplyTo(message.id)}
                        >
                          <Reply size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-blue-400 hover:bg-blue-600/10"
                          onClick={() => handleEditMessage(message.id, message.text)}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-red-400 hover:bg-red-600/10"
                          onClick={() => handleDeleteMessage(message.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400">
                              <Smile size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-56 bg-gray-800/90 backdrop-blur-sm border-gray-700/50 text-gray-100">
                            <Picker
                              data={data}
                              onEmojiSelect={(emoji) => handleReaction(message.id, emoji.native)}
                              theme="dark"
                            />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                    {!message.isDeleted && editingMessageId !== message.id && isCodeFile(message.text) && (
                      <div className="flex items-center justify-end mt-1 mb-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 bg-gray-800/50 border-gray-700/50 hover:border-blue-600/50 hover:bg-blue-900/20"
                            >
                              <Code size={12} className="mr-1.5 text-blue-400" />
                              Open in IDE
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-48 bg-gray-800/90 backdrop-blur-sm border-gray-700/50 text-gray-100">
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-400">Choose IDE</div>
                            <div
                              className="px-2 py-1.5 cursor-pointer hover:bg-blue-600/20"
                              onClick={() => openInIDE(message.text)}
                            >
                              Visual Studio Code
                            </div>
                            <div
                              className="px-2 py-1.5 cursor-pointer hover:bg-blue-600/20"
                              onClick={() => {
                                setIdePreference("webstorm")
                                openInIDE(message.text)
                              }}
                            >
                              WebStorm
                            </div>
                            <div
                              className="px-2 py-1.5 cursor-pointer hover:bg-blue-600/20"
                              onClick={() => {
                                setIdePreference("atom")
                                openInIDE(message.text)
                              }}
                            >
                              Atom
                            </div>
                            <div className="border-t border-gray-700/50 my-1"></div>
                            <div
                              className="px-2 py-1.5 cursor-pointer hover:bg-blue-600/20"
                              onClick={() => setShowIdePreferences(true)}
                            >
                              IDE Preferences...
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}

                    {/* Reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                      <div className="flex items-center mt-2 -ml-1">
                        {message.reactions.map((reaction, index) => (
                          <Button
                            key={index}
                            variant="ghost"
                            size="sm"
                            className="rounded-full px-2 py-1 text-sm bg-gray-700/50 hover:bg-gray-600/50"
                            onClick={() => handleReaction(message.id, reaction.emoji, reaction.userId === userId)}
                          >
                            {reaction.emoji}
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Read Receipts */}
                    {message.readBy && message.readBy.length > 0 && message.sender !== userId && (
                      <div className="flex items-center justify-end text-xs text-gray-500 mt-1">
                        Read by: {message.readBy.length}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="bg-gray-900/80 backdrop-blur-md p-4 border-t border-gray-800/80">
                <div className="flex items-center">
                  <Input
                    type="text"
                    placeholder="Type your secure message here..."
                    value={inputMessage}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-gray-800/50 border-gray-700/50 text-sm mr-2"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-blue-400 hover:bg-blue-600/10"
                    onClick={handleSendMessage}
                  >
                    <Send size={16} />
                  </Button>
                </div>
              </div>
              <div
                className="absolute bottom-0 right-0 p-1 text-gray-400 cursor-nwse-resize"
                onMouseDown={(e) => handlePopoutResizeStart(e, window.id)}
              >
                <Maximize2 size={12} />
              </div>
            </div>
          )}
        </div>
      ))}
      {IdePreferencesDialog()}
    </TooltipProvider>
  )
}

