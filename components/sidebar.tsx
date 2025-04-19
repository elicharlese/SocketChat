"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface SidebarProps {
  children: React.ReactNode
}

const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-gray-200 hover:text-white hover:bg-gray-800/50"
        onClick={() => setIsOpen(true)}
        aria-label="Open sidebar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </Button>

      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-background border-r border-border transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0`}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-xl font-bold">Conversations</h2>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-gray-200 hover:text-white hover:bg-gray-800/50"
              onClick={() => setIsOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {children}
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 md:hidden" onClick={() => setIsOpen(false)} aria-hidden="true" />
      )}
    </>
  )
}

export default Sidebar

