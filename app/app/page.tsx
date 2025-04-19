import Chat from "@/components/chat"
import { SocketProvider } from "@/contexts/socket-context"

export default function ChatApp() {
  return (
    <SocketProvider>
      <Chat />
    </SocketProvider>
  )
}

