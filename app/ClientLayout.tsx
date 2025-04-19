"use client"

import type React from "react"
import { useState } from "react"

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    // Pass the sidebar state to children or the appropriate components
    <>{children}</>
  )
}

