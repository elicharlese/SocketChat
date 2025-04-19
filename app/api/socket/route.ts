import { NextResponse } from "next/server"

export async function GET() {
  // This route is just a placeholder to check if the socket server is running
  return NextResponse.json({
    success: true,
    message: "Socket.io server is running. Connect to the WebSocket endpoint at /api/socketio",
  })
}

