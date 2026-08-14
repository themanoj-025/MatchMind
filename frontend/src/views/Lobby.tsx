import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { useToastStore } from '../store/useToastStore'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Card } from '../components/Card'
import { Layers, Plus, LogOut, Trophy } from 'lucide-react'
import { useRooms, useCreateRoom } from '../hooks/useRooms'



export const Lobby: React.FC = () => {
  const [newRoomName, setNewRoomName] = useState('')
  const [budget, setBudget] = useState(200)
  const { user, logout } = useAuthStore()
  const { showToast } = useToastStore()
  const navigate = useNavigate()

  const { data: rooms = [] } = useRooms()
  const createRoom = useCreateRoom()

  useEffect(() => {
    if (!user) {
      navigate('/login')
    }
  }, [user, navigate])

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoomName) return

    createRoom.mutate(
      {
        name: newRoomName,
        type: 'room',
        totalBudget: budget,
        rosterRules: { GK: 1, DEF: 4, MID: 3, FWD: 3, total: 11 },
      },
      {
        onSuccess: (data) => {
          showToast('Draft room created!', 'success')
          navigate(`/room/${data.id}`)
        },
        onError: (err: any) => {
          showToast(err.message || 'Failed to create room', 'error')
        },
      }
    )
  }

  return (
    <div className="min-h-screen bg-[#050506] relative px-6 py-12 text-foreground">
      <div className="absolute inset-0 bg-grid-overlay opacity-10 pointer-events-none" />

      {/* Header bar */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <Layers className="w-8 h-8 text-accent animate-pulse-slow" />
          <h1 className="text-3xl font-semibold tracking-tight text-gradient">MatchMind Lobby</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="flex items-center gap-2" onClick={() => navigate('/leaderboard')}>
            <Trophy className="w-4 h-4" /> Leaderboard
          </Button>
          <Button variant="secondary" className="flex items-center gap-2 border-white/5 bg-white/[0.02]" onClick={logout}>
            <LogOut className="w-4 h-4" /> Log Out
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active rooms list */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-semibold tracking-tight text-foreground-muted">Active Draft Chambers</h2>
          {rooms.length === 0 ? (
            <Card className="p-8 text-center border-dashed border-white/10 bg-transparent text-foreground-muted">
              No active draft rooms found. Create one to begin.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rooms.map((room) => (
                <Card key={room.id} className="p-6 border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all duration-300">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{room.name}</h3>
                      <span className={`inline-block text-[10px] uppercase font-mono px-2 py-0.5 rounded-full mt-1.5 ${
                        room.status === 'DRAFTING' ? 'bg-emerald-500/20 text-emerald-300' :
                        room.status === 'COMPLETED' ? 'bg-indigo-500/20 text-indigo-300' :
                        'bg-amber-500/20 text-amber-300'
                      }`}>
                        {room.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-foreground-muted space-y-1 mb-6">
                    <p>Budget Allocation: ${room.totalBudget}M</p>
                    <p>Format: 11-player Draft (4-3-3)</p>
                  </div>
                  <Button className="w-full py-4 text-xs font-semibold" onClick={() => navigate(`/room/${room.id}`)}>
                    Enter Chamber
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Create new room drawer */}
        <div>
          <Card className="p-6 border-white/10 bg-white/[0.02] backdrop-blur-xl">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-accent" /> Instantiate Chamber
            </h3>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground-muted block mb-1">Chamber Name</label>
                <Input
                  placeholder="Premier League Draft #12"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground-muted block mb-1">Budget ($ Millions)</label>
                <Input
                  type="number"
                  placeholder="200"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  required
                />
              </div>
              <Button type="submit" className="w-full py-5 mt-6 font-semibold" disabled={createRoom.isPending}>
                {createRoom.isPending ? 'Creating...' : 'Initialize'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
