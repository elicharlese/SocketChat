"use client"

import type React from "react"
import { createContext, useState } from "react"

interface LayoutContextType {
  sidebarOpen: boolean
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export const LayoutContext = createContext<LayoutContextType>({
  sidebarOpen: false,
  setSidebarOpen: () => {},
})

export const LayoutContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const value = {
    sidebarOpen,
    setSidebarOpen,
  }

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

