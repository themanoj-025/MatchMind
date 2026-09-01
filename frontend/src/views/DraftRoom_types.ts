/** DraftRoom type definitions. */

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/useAuthStore'
import { useToastStore } from '../store/useToastStore'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Card } from '../components/Card'
import { MessageSquare, Users, DollarSign, Clock, Sparkles, Trophy, ArrowLeft } from 'lucide-react'

import { env } from '../config/env'
import { useAuctionAdvice } from '../hooks/useAuctionAdvice'

const DraftTimer: React.FC<{ timerEndsAt: string | null }> = ({ timerEndsAt }) => {
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (!timerEndsAt) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((new Date(timerEndsAt).getTime() - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) {
        clearInterval(interval)
      }
    }, 500)
    return () => clearInterval(interval)
  }, [timerEndsAt])

  return (
    <div className="flex items-center gap-2 mt-1.5 text-2xl font-bold font-mono text-rose-400">
      <Clock className="w-5 h-5 text-rose-400 animate-pulse" /> {timeLeft}s
    </div>
  )
}

interface Player {
  id: string
  name: string
  position: string
  basePrice: number
  club: string
}

interface RosterItem {
  id: string
  userId: string
  playerId: string
  soldPrice: number
  player: Player
}

interface ChatMsg {
  id?: string
  userId: string
  text: string
  timestamp: string
  user?: {
    username: string
  }
}

interface ActiveMember {
  userId: string
  username?: string
  displayName?: string
  remainingBudget: number
  isReady?: boolean
  role?: string
}

interface RoomState {
  name?: string
  status: string
  currentPlayer?: Player | null
  currentBid?: number
  currentBidderId?: string | null
  timerEndsAt?: string | null
  members?: ActiveMember[]
  roster?: RosterItem[]
  messages?: ChatMsg[]
}

interface BidUpdatedData {
  amount: number
  userId: string
  timerEndsAt?: string | null
  remainingBudget?: number
}

interface PlayerSoldData {
  buyerId: string
  price: number
  playerId: string
}

interface AiAdvice {
  summary: string
  positionNeeds?: Record<string, number>
  targets?: string[]
  budgetAdvice?: string
  warning?: string
}
