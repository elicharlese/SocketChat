import type React from "react"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="overflow-hidden h-screen">{children}</div>
}

