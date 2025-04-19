import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // This is a simplified version - in a real app, you would verify
  // the wallet connection with a server-side session or JWT token

  // For now, we'll just check if the user has visited the app route directly
  // without going through the landing page first
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/app")) {
    // In a real implementation, you would check for a valid session or token
    // For demo purposes, we'll use a cookie to track if they've connected
    const hasConnected = request.cookies.has("wallet_connected")

    if (!hasConnected) {
      // Redirect to the landing page if no wallet connection is detected
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/app/:path*",
}

