"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { setCookie } from "cookies-next"
import {
  Shield,
  Lock,
  MessageSquare,
  Users,
  Zap,
  Wallet,
  Code,
  Key,
  Layers,
  Globe,
  ArrowRight,
  CheckCircle2,
  Github,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type WalletInfo = {
  address: string
  balance: string
  chainId: string
}

export function LandingPage() {
  const router = useRouter()
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [networkName, setNetworkName] = useState<string>("")

  // Check if wallet is already connected on component mount
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (typeof window.ethereum !== "undefined") {
        try {
          // Check if already connected
          const accounts = await window.ethereum.request({ method: "eth_accounts" })
          if (accounts.length > 0) {
            const chainId = await window.ethereum.request({ method: "eth_chainId" })
            const balance = await window.ethereum.request({
              method: "eth_getBalance",
              params: [accounts[0], "latest"],
            })

            setWalletInfo({
              address: accounts[0],
              balance: (Number.parseInt(balance, 16) / 1e18).toFixed(4),
              chainId,
            })
            setNetworkName(getNetworkName(chainId))
            setWalletConnected(true)
          }
        } catch (err) {
          console.error("Error checking wallet connection:", err)
        }
      }
    }

    checkWalletConnection()
  }, [])

  // Get network name from chain ID
  const getNetworkName = (chainId: string): string => {
    const networks: Record<string, string> = {
      "0x1": "Ethereum",
      "0x5": "Goerli",
      "0x89": "Polygon",
      "0x13881": "Mumbai",
      "0xa86a": "Avalanche",
      "0xa": "Optimism",
      "0xaa36a7": "Sepolia",
    }
    return networks[chainId] || `Chain ${Number.parseInt(chainId, 16)}`
  }

  // Handle wallet connection
  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      setError("No Ethereum wallet detected. Please install MetaMask or another wallet.")
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
      const chainId = await window.ethereum.request({ method: "eth_chainId" })
      const balance = await window.ethereum.request({
        method: "eth_getBalance",
        params: [accounts[0], "latest"],
      })

      setWalletInfo({
        address: accounts[0],
        balance: (Number.parseInt(balance, 16) / 1e18).toFixed(4),
        chainId,
      })
      setNetworkName(getNetworkName(chainId))
      setWalletConnected(true)

      // Set a cookie to remember the wallet connection
      setCookie("wallet_connected", "true", {
        maxAge: 60 * 60 * 24, // 1 day
        path: "/",
      })

      // Also store the wallet address
      setCookie("wallet_address", accounts[0], {
        maxAge: 60 * 60 * 24,
        path: "/",
      })
    } catch (err: any) {
      console.error("Error connecting wallet:", err)
      setError(err.message || "Failed to connect wallet")
    } finally {
      setIsConnecting(false)
    }
  }

  // Navigate to app after successful connection
  const enterApp = () => {
    router.push("/app")
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-[30%] -right-[10%] w-[70%] h-[70%] bg-gradient-to-br from-indigo-600/20 to-cyan-600/20 rounded-full blur-3xl" />
        <div className="absolute top-[40%] left-[60%] w-[40%] h-[40%] bg-gradient-to-br from-violet-600/20 to-blue-600/20 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center relative z-10">
        <div className="flex items-center">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-2 rounded-lg mr-3">
            <Shield className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
            SocketChat
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {walletConnected ? (
            <div className="flex items-center gap-3">
              <div className="hidden md:block">
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-green-400"></div>
                  <span className="text-gray-300">
                    {walletInfo?.address.substring(0, 6)}...{walletInfo?.address.substring(38)}
                  </span>
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="text-blue-400">{networkName}</span> • {walletInfo?.balance} ETH
                </div>
              </div>
              <Button
                onClick={enterApp}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
              >
                Launch App <ArrowRight size={16} className="ml-2" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={connectWallet}
              disabled={isConnecting}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
            >
              {isConnecting ? (
                <>
                  <div className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin mr-2"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet size={16} className="mr-2" />
                  Connect Wallet
                </>
              )}
            </Button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block px-4 py-1 rounded-full bg-blue-900/30 border border-blue-700/30 text-blue-400 text-sm font-medium mb-6">
              Secure Web3 Messaging Protocol
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500">
                Decentralized
              </span>{" "}
              End-to-End Encrypted Messaging
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-xl">
              SocketChat combines WebSockets with blockchain authentication and cryptographic security for truly
              private, decentralized conversations.
            </p>
            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-6">{error}</div>
            )}
            <div className="flex flex-col sm:flex-row gap-4">
              {walletConnected ? (
                <Button
                  size="lg"
                  onClick={enterApp}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
                >
                  Launch App <ArrowRight size={18} className="ml-2" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
                >
                  {isConnecting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin mr-2"></div>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet size={18} className="mr-2" />
                      Connect Wallet
                    </>
                  )}
                </Button>
              )}
              <Button variant="outline" size="lg" className="border-blue-700 text-blue-400 hover:bg-blue-900/20">
                <Github size={18} className="mr-2" />
                View on GitHub
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-6 mt-10">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 size={16} className="text-green-500" />
                </div>
                <span className="text-sm text-gray-300">Audited Protocol</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 size={16} className="text-green-500" />
                </div>
                <span className="text-sm text-gray-300">Open Source</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 size={16} className="text-green-500" />
                </div>
                <span className="text-sm text-gray-300">Zero Knowledge</span>
              </div>
            </div>
          </div>

          {/* 3D Chat Interface Mockup */}
          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-30"></div>
            <div className="relative bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-800">
              <div className="bg-gray-800 p-4 border-b border-gray-700 flex items-center">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-3 py-1 rounded-full bg-gray-700 text-xs flex items-center">
                    <Lock size={10} className="mr-1 text-green-400" />
                    <span>End-to-End Encrypted</span>
                  </div>
                </div>
              </div>

              <div className="p-6 h-[400px] flex flex-col">
                <div className="flex-1 space-y-4 overflow-hidden">
                  {/* Message bubbles */}
                  <div className="flex justify-start">
                    <div className="bg-gray-800 rounded-lg p-3 max-w-[80%]">
                      <p className="text-sm">Hey! I just deployed the new smart contract. Can you check it out?</p>
                      <p className="text-xs text-gray-400 mt-1">10:24 AM</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="bg-blue-600 rounded-lg p-3 max-w-[80%]">
                      <p className="text-sm">Send me the address and I'll review it right away.</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <p className="text-xs text-blue-200">10:26 AM</p>
                        <CheckCircle2 size={12} className="text-blue-200" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="bg-gray-800 rounded-lg p-3 max-w-[80%]">
                      <div className="bg-gray-700 p-2 rounded mb-2 border-l-2 border-blue-500">
                        <p className="text-xs text-gray-400">0x7a16ff8270133f063aab6c9977183d9e72835428</p>
                      </div>
                      <p className="text-sm">Here it is! I used the ERC-4337 standard.</p>
                      <p className="text-xs text-gray-400 mt-1">10:27 AM</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="bg-blue-600 rounded-lg p-3 max-w-[80%]">
                      <p className="text-sm">Got it! I'll check the implementation and get back to you.</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <p className="text-xs text-blue-200">10:29 AM</p>
                        <CheckCircle2 size={12} className="text-blue-200" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Input area */}
                <div className="mt-4 flex gap-2">
                  <div className="flex-1 bg-gray-800 rounded-lg px-4 py-2 border border-gray-700">
                    <p className="text-gray-400 text-sm">Type a message...</p>
                  </div>
                  <button className="bg-blue-600 p-2 rounded-lg">
                    <ArrowRight size={20} />
                  </button>
                </div>
              </div>

              {/* Animated encryption overlay */}
              {/* Overlay removed for cleaner UI */}
            </div>

            {/* Decorative elements */}
            <div className="absolute -bottom-6 -right-6 h-12 w-12 bg-blue-600 rounded-full blur-xl opacity-70"></div>
            <div className="absolute -top-6 -left-6 h-12 w-12 bg-indigo-600 rounded-full blur-xl opacity-70"></div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section className="py-20 relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              SocketChat combines blockchain authentication with end-to-end encryption for secure messaging
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 relative overflow-hidden group hover:bg-gray-800/70 transition-all duration-300">
              <div className="absolute -right-6 -top-6 h-24 w-24 bg-blue-600/10 rounded-full blur-xl group-hover:bg-blue-600/20 transition-all duration-300"></div>
              <div className="relative">
                <div className="bg-blue-600/20 h-12 w-12 rounded-xl flex items-center justify-center mb-6">
                  <Wallet className="text-blue-400" size={24} />
                </div>
                <div className="absolute top-0 right-0 bg-blue-900/30 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <h3 className="text-xl font-bold mb-3">Connect Wallet</h3>
                <p className="text-gray-300">
                  Authenticate with your Web3 wallet for secure, pseudonymous access without passwords.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 relative overflow-hidden group hover:bg-gray-800/70 transition-all duration-300">
              <div className="absolute -right-6 -top-6 h-24 w-24 bg-indigo-600/10 rounded-full blur-xl group-hover:bg-indigo-600/20 transition-all duration-300"></div>
              <div className="relative">
                <div className="bg-indigo-600/20 h-12 w-12 rounded-xl flex items-center justify-center mb-6">
                  <Key className="text-indigo-400" size={24} />
                </div>
                <div className="absolute top-0 right-0 bg-indigo-900/30 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <h3 className="text-xl font-bold mb-3">Key Exchange</h3>
                <p className="text-gray-300">
                  Cryptographic keys are exchanged securely between peers using ECDH protocol.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 relative overflow-hidden group hover:bg-gray-800/70 transition-all duration-300">
              <div className="absolute -right-6 -top-6 h-24 w-24 bg-purple-600/10 rounded-full blur-xl group-hover:bg-purple-600/20 transition-all duration-300"></div>
              <div className="relative">
                <div className="bg-purple-600/20 h-12 w-12 rounded-xl flex items-center justify-center mb-6">
                  <MessageSquare className="text-purple-400" size={24} />
                </div>
                <div className="absolute top-0 right-0 bg-purple-900/30 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <h3 className="text-xl font-bold mb-3">Secure Messaging</h3>
                <p className="text-gray-300">
                  All messages are encrypted end-to-end with AES-GCM and can only be read by intended recipients.
                </p>
              </div>
            </div>
          </div>

          {/* Connection lines - horizontal for desktop */}
          <div className="hidden md:flex justify-center mt-8">
            <div className="relative w-2/3 h-0.5">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-50 rounded-full"></div>
              {/* Connection dots */}
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-500"></div>
              <div className="absolute left-1/2 top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-indigo-500"></div>
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-purple-500"></div>
            </div>
          </div>

          {/* Connection lines - vertical for mobile */}
          <div className="md:hidden flex flex-col items-center my-8">
            <div className="h-12 w-0.5 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></div>
            <div className="w-3 h-3 rounded-full bg-indigo-500 my-2"></div>
            <div className="h-12 w-0.5 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Key Features</h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Built with modern cryptography and blockchain principles
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:bg-gray-800/50 transition-all duration-300 hover:border-blue-700/50 group">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-xl w-fit mb-4 group-hover:shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300">
                <Lock className="text-white" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors duration-300">
                End-to-End Encryption
              </h3>
              <p className="text-gray-300">
                All messages are encrypted using AES-GCM with ECDH key exchange, ensuring only the intended recipient
                can read them.
              </p>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:bg-gray-800/50 transition-all duration-300 hover:border-indigo-700/50 group">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-3 rounded-xl w-fit mb-4 group-hover:shadow-lg group-hover:shadow-indigo-500/20 transition-all duration-300">
                <Zap className="text-white" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-indigo-400 transition-colors duration-300">
                Real-Time Communication
              </h3>
              <p className="text-gray-300">
                Powered by WebSockets for instant message delivery, typing indicators, and read receipts with minimal
                latency.
              </p>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:bg-gray-800/50 transition-all duration-300 hover:border-purple-700/50 group">
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-3 rounded-xl w-fit mb-4 group-hover:shadow-lg group-hover:shadow-purple-500/20 transition-all duration-300">
                <Layers className="text-white" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-purple-400 transition-colors duration-300">
                Blockchain Verification
              </h3>
              <p className="text-gray-300">
                Media files are verified using blockchain-inspired hash verification to ensure integrity and prevent
                tampering.
              </p>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:bg-gray-800/50 transition-all duration-300 hover:border-cyan-700/50 group">
              <div className="bg-gradient-to-br from-cyan-600 to-blue-600 p-3 rounded-xl w-fit mb-4 group-hover:shadow-lg group-hover:shadow-cyan-500/20 transition-all duration-300">
                <Users className="text-white" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-cyan-400 transition-colors duration-300">
                Web3 Authentication
              </h3>
              <p className="text-gray-300">
                Connect with your Ethereum wallet for secure, pseudonymous authentication without passwords or personal
                data.
              </p>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:bg-gray-800/50 transition-all duration-300 hover:border-blue-700/50 group">
              <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-3 rounded-xl w-fit mb-4 group-hover:shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300">
                <Globe className="text-white" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors duration-300">
                Decentralized Architecture
              </h3>
              <p className="text-gray-300">
                Built with decentralization principles, allowing for future integration with fully decentralized storage
                and messaging.
              </p>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:bg-gray-800/50 transition-all duration-300 hover:border-indigo-700/50 group">
              <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-3 rounded-xl w-fit mb-4 group-hover:shadow-lg group-hover:shadow-indigo-500/20 transition-all duration-300">
                <Code className="text-white" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-indigo-400 transition-colors duration-300">
                Open Source
              </h3>
              <p className="text-gray-300">
                Fully open source codebase that can be audited, verified, and contributed to by the community.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-20 bg-gradient-to-b from-transparent to-gray-900/50 relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Built With Modern Tech</h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Leveraging the latest in Web3 and cryptographic technologies
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Node.js */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 text-center border border-gray-700/50 hover:border-blue-600/50 transition-all duration-300 group">
              <div className="h-16 w-16 mx-auto mb-4 flex items-center justify-center">
                <div className="text-green-500 group-hover:text-green-400 transition-colors duration-300">
                  <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" fill="none">
                    <path
                      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
              </div>
              <div className="text-sm font-medium mt-2 group-hover:text-green-400 transition-colors duration-300">
                Node.js
              </div>
            </div>

            {/* React */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 text-center border border-gray-700/50 hover:border-blue-600/50 transition-all duration-300 group">
              <div className="h-16 w-16 mx-auto mb-4 flex items-center justify-center">
                <div className="text-blue-500 group-hover:text-blue-400 transition-colors duration-300">
                  <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                  </svg>
                </div>
              </div>
              <div className="text-sm font-medium mt-2 group-hover:text-blue-400 transition-colors duration-300">
                React
              </div>
            </div>

            {/* Next.js */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 text-center border border-gray-700/50 hover:border-indigo-600/50 transition-all duration-300 group">
              <div className="h-16 w-16 mx-auto mb-4 flex items-center justify-center">
                <div className="text-white group-hover:text-gray-200 transition-colors duration-300">
                  <svg viewBox="0 0 24 24" width="48" height="48">
                    <path d="M12 2L2 19h20L12 2z" fill="currentColor" />
                  </svg>
                </div>
              </div>
              <div className="text-sm font-medium mt-2 group-hover:text-gray-200 transition-colors duration-300">
                Next.js
              </div>
            </div>

            {/* Socket.io */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 text-center border border-gray-700/50 hover:border-purple-600/50 transition-all duration-300 group">
              <div className="h-16 w-16 mx-auto mb-4 flex items-center justify-center">
                <div className="text-purple-500 group-hover:text-purple-400 transition-colors duration-300">
                  <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" fill="none">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" />
                  </svg>
                </div>
              </div>
              <div className="text-sm font-medium mt-2 group-hover:text-purple-400 transition-colors duration-300">
                Socket.io
              </div>
            </div>

            {/* Web3 */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 text-center border border-gray-700/50 hover:border-orange-600/50 transition-all duration-300 group">
              <div className="h-16 w-16 mx-auto mb-4 flex items-center justify-center">
                <div className="text-orange-500 group-hover:text-orange-400 transition-colors duration-300">
                  <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" fill="none">
                    <rect x="2" y="6" width="20" height="12" rx="2" fill="currentColor" />
                    <path
                      d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
              <div className="text-sm font-medium mt-2 group-hover:text-orange-400 transition-colors duration-300">
                Web3
              </div>
            </div>

            {/* TypeScript */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 text-center border border-gray-700/50 hover:border-blue-600/50 transition-all duration-300 group">
              <div className="h-16 w-16 mx-auto mb-4 flex items-center justify-center">
                <div className="text-blue-500 group-hover:text-blue-400 transition-colors duration-300">
                  <svg viewBox="0 0 24 24" width="48" height="48">
                    <path d="M3 3h18v18H3V3z" fill="currentColor" />
                    <path
                      d="M14 10v2h-4v7h-2v-7H4v-2h10zm1 5h2c0 1.5 1 2 2.5 2 1 0 1.5-.5 1.5-1s-.5-1-1.5-1c-1 0-2.5 0-3.5-1.5-1-1-1-2-1-2.5 0-2 1.5-3 3.5-3 2.5 0 3.5 1.5 3.5 3h-2c0-1-.5-1.5-1.5-1.5s-1.5.5-1.5 1 .5 1 1.5 1c2.5 0 4 1.5 4 3.5 0 1.5-1 3-3.5 3-3 0-4-2-4-3.5z"
                      fill="#fff"
                    />
                  </svg>
                </div>
              </div>
              <div className="text-sm font-medium mt-2 group-hover:text-blue-400 transition-colors duration-300">
                TypeScript
              </div>
            </div>

            {/* Tailwind CSS */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 text-center border border-gray-700/50 hover:border-cyan-600/50 transition-all duration-300 group">
              <div className="h-16 w-16 mx-auto mb-4 flex items-center justify-center">
                <div className="text-cyan-500 group-hover:text-cyan-400 transition-colors duration-300">
                  <svg viewBox="0 0 24 24" width="48" height="48">
                    <path
                      d="M12 6C9.33 6 7.5 7.33 6.5 10c1-1.33 2.17-1.83 3.5-1.5.76.19 1.31.74 1.91 1.35.98 1 2.09 2.15 4.59 2.15 2.67 0 4.5-1.33 5.5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.3-.74-1.91-1.35C15.61 7.15 14.5 6 12 6zm-6 6c-2.67 0-4.5 1.33-5.5 4 1-1.33 2.17-1.83 3.5-1.5.76.19 1.3.74 1.91 1.35C6.89 16.85 8 18 10.5 18c2.67 0 4.5-1.33 5.5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.3-.74-1.91-1.35C9.61 13.15 8.5 12 6 12z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
              </div>
              <div className="text-sm font-medium mt-2 group-hover:text-cyan-400 transition-colors duration-300">
                Tailwind CSS
              </div>
            </div>

            {/* Crypto */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 text-center border border-gray-700/50 hover:border-yellow-600/50 transition-all duration-300 group">
              <div className="h-16 w-16 mx-auto mb-4 flex items-center justify-center">
                <div className="text-yellow-500 group-hover:text-yellow-400 transition-colors duration-300">
                  <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" fill="none">
                    <path
                      d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
              <div className="text-sm font-medium mt-2 group-hover:text-yellow-400 transition-colors duration-300">
                Crypto API
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900/80 backdrop-blur-md border-t border-gray-800/50 relative z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-6 md:mb-0">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-2 rounded-lg mr-3">
                <Shield className="text-white" size={20} />
              </div>
              <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
                SocketChat
              </h2>
            </div>

            <div className="text-gray-400 text-sm">
              &copy; {new Date().getFullYear()} SocketChat. All rights reserved.
            </div>

            <div className="flex gap-4 mt-6 md:mt-0">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800/50">
                <Github size={20} />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800/50">
                <Globe size={20} />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800/50">
                <Code size={20} />
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

