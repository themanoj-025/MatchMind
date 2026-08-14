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

export const DraftRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useAuthStore()
  const { showToast } = useToastStore()
  const navigate = useNavigate()

  const [socket, setSocket] = useState<Socket | null>(null)
  const [roomName, setRoomName] = useState('Draft Room')
  const [roomStatus, setRoomStatus] = useState('PENDING')
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [currentBid, setCurrentBid] = useState(0)
  const [currentBidderId, setCurrentBidderId] = useState<string | null>(null)
  const [timerEndsAt, setTimerEndsAt] = useState<string | null>(null)  
  const [myBudget, setMyBudget] = useState(0)
  const [roster, setRoster] = useState<RosterItem[]>([])
  const [activeMembers, setActiveMembers] = useState<any[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  
  const [chatInput, setChatInput] = useState('')
  const [bidInput, setBidInput] = useState('')
  const [aiAdvice, setAiAdvice] = useState<any>(null)
  const [aiOpen, setAiOpen] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)



  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Socket Connection setup
  useEffect(() => {
    if (!user || !roomId) {
      navigate('/login')
      return
    }

    const socketUrl = env.API_URL
    const newSocket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket'],
    })

    setSocket(newSocket)

    newSocket.on('connect', () => {
      newSocket.emit('JOIN_ROOM', { roomId })
    })

    newSocket.on('ROOM_STATE', (state: any) => {
      setRoomName(state.name || 'Draft Chamber')
      setRoomStatus(state.status)
      setCurrentPlayer(state.currentPlayer)
      setCurrentBid(state.currentBid || 0)
      setCurrentBidderId(state.currentBidderId)
      setTimerEndsAt(state.timerEndsAt)
      setActiveMembers(state.members || [])
      setRoster(state.roster || [])
      setChatMessages(state.messages || [])

      const self = state.members?.find((m: any) => m.userId === user?.id)
      if (self) setMyBudget(self.remainingBudget)
    })

    newSocket.on('BID_UPDATED', (data: any) => {
      setCurrentBid(data.amount)
      setCurrentBidderId(data.userId)
      setTimerEndsAt(data.timerEndsAt)
      
      // Update local budget state for the bidder
      if (data.userId === user?.id) {
        setMyBudget(data.remainingBudget)
      }
    })

    newSocket.on('BID_REJECTED', (err: any) => {
      showToast(err.message, 'error')
    })

    newSocket.on('PLAYER_SOLD', (data: any) => {
      showToast(`Player sold to ${data.buyerId === user?.id ? 'you' : 'another manager'} for $${data.price}M!`, 'success')
      // Room state updates automatically on server tick, but clear local bids
      setBidInput('')
    })

    newSocket.on('PLAYER_UNSOLD', () => {
      showToast('Player remained unsold.', 'info')
      setBidInput('')
    })

    newSocket.on('AUCTION_FINISHED', () => {
      showToast('The Draft has successfully concluded!', 'success')
      setRoomStatus('COMPLETED')
    })

    newSocket.on('NEW_MESSAGE', (msg: ChatMsg) => {
      setChatMessages((prev) => [...prev, msg])
    })

    newSocket.on('disconnect', () => {
      showToast('Disconnected from server, reconnecting...', 'error')
    })

    return () => {
      newSocket.disconnect()
    }
  }, [roomId, user])

  const handlePlaceBid = (e: React.FormEvent) => {
    e.preventDefault()
    if (!socket || !currentPlayer) return
    const amount = Number(bidInput)
    if (isNaN(amount) || amount <= currentBid) {
      showToast('Bid must exceed the current high bid value', 'error')
      return
    }
    socket.emit('PLACE_BID', { roomId, playerId: currentPlayer.id, amount })
  }

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!socket || !chatInput.trim()) return
    socket.emit('SEND_MESSAGE', { roomId, text: chatInput })
    setChatInput('')
  }

  const aiAdviceMutation = useAuctionAdvice()

  const requestAiAdvice = () => {
    setAiOpen(true)
    aiAdviceMutation.mutate(
      { roomId: roomId as string, draftState: {} }, // Pass draft state if needed
      {
        onSuccess: (data) => {
          setAiAdvice(data.advice)
        },
        onError: (err: any) => {
          showToast(err.message || 'Failed to fetch AI insights', 'error')
        }
      }
    )
  }

  return (
    <div className="min-h-screen bg-[#050506] text-foreground relative flex flex-col">
      <div className="absolute inset-0 bg-grid-overlay opacity-5 pointer-events-none" />

      {/* Header bar */}
      <header className="border-b border-white/5 bg-[#050506]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/lobby')} className="p-2 hover:bg-white/5 rounded-lg text-foreground-muted hover:text-white transition-all cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{roomName}</h1>
            <p className="text-xs text-foreground-muted font-mono uppercase mt-0.5">{roomStatus}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.01]">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold font-mono text-emerald-300">${myBudget}M remaining</span>
          </div>
          <Button variant="ghost" className="flex items-center gap-2 text-accent-bright" onClick={requestAiAdvice}>
            <Sparkles className="w-4 h-4" /> AI Advisor
          </Button>
        </div>
      </header>

      {/* Main Panel Viewport */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 overflow-hidden">
        {/* Left Column: Roster & Members */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card className="flex-1 p-5 border-white/5 bg-white/[0.01] flex flex-col">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-accent" /> Active Roster ({roster.length}/11)
            </h3>
            {roster.length === 0 ? (
              <p className="text-xs text-foreground-muted text-center my-auto">Roster is empty. Place bids to acquire players.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1 max-h-[300px] pr-1">
                {roster.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-2 rounded bg-white/[0.02] border border-white/5 text-xs">
                    <div>
                      <p className="font-semibold">{item.player?.name}</p>
                      <span className="text-[10px] text-foreground-muted uppercase font-mono">{item.player?.position} • {item.player?.club}</span>
                    </div>
                    <span className="font-mono text-emerald-400 font-semibold">${item.soldPrice}M</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5 border-white/5 bg-white/[0.01]">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-accent" /> Draft Managers
            </h3>
            <div className="space-y-3">
              {activeMembers.map((member) => (
                <div key={member.id} className="flex justify-between items-center text-xs">
                  <span className={member.userId === user?.id ? 'text-accent-bright font-semibold' : 'text-foreground'}>
                    {member.user?.username || 'Guest'}
                  </span>
                  <span className="font-mono text-foreground-muted">${member.remainingBudget}M</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Center Grid: Live Bidding Arena */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="flex-1 p-8 border-white/5 bg-white/[0.01] flex flex-col justify-between relative overflow-hidden">
            {currentPlayer ? (
              <>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded">Current Target</span>
                    <h2 className="text-4xl font-bold tracking-tight mt-3">{currentPlayer.name}</h2>
                    <p className="text-sm text-foreground-muted uppercase font-mono mt-1">{currentPlayer.position} • {currentPlayer.club}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-foreground-muted uppercase font-mono">Bidding Ends In</span>
                    <DraftTimer timerEndsAt={timerEndsAt} />
                  </div>
                </div>

                {/* Main Bid Board */}
                <div className="my-auto py-12 flex flex-col items-center justify-center">
                  <span className="text-xs text-foreground-muted uppercase font-mono">High Bid</span>
                  <h3 className="text-6xl font-black font-mono text-gradient-accent mt-2">${currentBid}M</h3>
                  <p className="text-xs text-foreground-muted mt-4">
                    High Bidder: <span className="font-semibold text-foreground">{currentBidderId === user?.id ? 'You' : currentBidderId || 'None'}</span>
                  </p>
                </div>

                {/* Bid Console */}
                <form onSubmit={handlePlaceBid} className="flex gap-4">
                  <Input
                    type="number"
                    placeholder={`Min Bid: $${currentBid + 1}M`}
                    value={bidInput}
                    onChange={(e) => setBidInput(e.target.value)}
                    className="flex-1 text-center font-mono py-6 text-lg"
                  />
                  <Button type="submit" className="px-8 py-6 font-semibold">Place Bid</Button>
                </form>
              </>
            ) : (
              <div className="my-auto text-center space-y-4">
                <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping mx-auto block" />
                <h3 className="text-xl font-semibold">Waiting for Draft Manager to submit next player</h3>
                <p className="text-sm text-foreground-muted">The board will update instantly once the auction commences.</p>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Chat Feed */}
        <div className="lg:col-span-1 flex flex-col border border-white/5 bg-white/[0.01] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 bg-white/[0.01] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">War Room Chat</h3>
          </div>

          {/* Chat Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[400px]">
            {chatMessages.map((msg, i) => (
              <div key={i} className="text-xs">
                <span className="font-semibold text-accent-bright block mb-0.5">
                  {msg.userId === user?.id ? 'You' : msg.user?.username || 'Chamber'}
                </span>
                <p className="text-foreground-subtle bg-white/[0.02] border border-white/5 p-2 rounded inline-block max-w-[90%] break-words">
                  {msg.text}
                </p>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChat} className="p-3 border-t border-white/5 flex gap-2">
            <Input
              placeholder="Send message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 text-xs"
            />
            <Button type="submit" className="px-4 py-3 text-xs">Send</Button>
          </form>
        </div>
      </main>

      {/* AI Strategy Drawer Panel */}
      {aiOpen && (
        <div className="fixed inset-y-0 right-0 w-[400px] z-50 border-l border-white/10 bg-[#070709]/95 backdrop-blur-xl shadow-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-gradient-accent">
                <Sparkles className="w-5 h-5 text-accent" /> AI Advisor Insights
              </h3>
              <button onClick={() => setAiOpen(false)} className="text-foreground-muted hover:text-white cursor-pointer text-sm">Close</button>
            </div>

            {aiAdviceMutation.isPending ? (
              <div className="space-y-4 pt-12 text-center">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-foreground-muted font-mono">Formulating strategy and evaluating roster needs...</p>
              </div>
            ) : aiAdvice ? (
              <div className="space-y-6 text-sm">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">Strategy Summary</h4>
                  <p className="text-foreground-subtle leading-relaxed bg-white/[0.02] border border-white/5 p-3 rounded">{aiAdvice.summary}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">Position Focus</h4>
                  <p className="text-foreground-subtle bg-white/[0.02] border border-white/5 p-3 rounded font-mono">{JSON.stringify(aiAdvice.positionNeeds || aiAdvice.positionFocus)}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">Suggested Targets</h4>
                  <div className="space-y-2">
                    {aiAdvice.targets?.map((target: string, index: number) => (
                      <div key={index} className="p-2 rounded bg-accent/5 border border-accent/20 text-xs font-semibold text-accent-bright">
                        {target}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">Budget Allocation Advice</h4>
                  <p className="text-foreground-subtle leading-relaxed bg-white/[0.02] border border-white/5 p-3 rounded">{aiAdvice.budgetAdvice}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-foreground-muted text-center pt-12">Click below to fetch advisor guidance.</p>
            )}
          </div>

          <Button onClick={requestAiAdvice} className="w-full py-4 text-xs font-semibold" disabled={aiAdviceMutation.isPending}>
            Recalculate Strategy
          </Button>
        </div>
      )}
    </div>
  )
}
