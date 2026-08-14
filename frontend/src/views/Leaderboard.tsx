import React from 'react'
import { useNavigate } from 'react-router-dom'


import { Card } from '../components/Card'
import { Trophy, ArrowLeft, Users } from 'lucide-react'


import { useLeaderboard } from '../hooks/useLeaderboard'

export const Leaderboard: React.FC = () => {
  
  const navigate = useNavigate()

  const { data: entries = [] } = useLeaderboard()

  return (
    <div className="min-h-screen bg-[#050506] text-foreground relative px-6 py-12">
      <div className="absolute inset-0 bg-grid-overlay opacity-10 pointer-events-none" />

      {/* Header */}
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/lobby')} className="p-2 hover:bg-white/5 rounded-lg text-foreground-muted hover:text-white transition-all cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-accent" />
            <h1 className="text-2xl font-semibold tracking-tight text-gradient">Leaderboard</h1>
          </div>
        </div>
      </div>

      {/* Ranks list */}
      <div className="max-w-4xl mx-auto">
        <Card className="border-white/5 bg-white/[0.01]">
          <div className="p-6 border-b border-white/5 flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Global Standings</h3>
          </div>

          <div className="divide-y divide-white/5">
            {entries.length === 0 ? (
              <div className="p-12 text-center text-foreground-muted text-sm">
                No rankings available yet. Join a draft room and earn points!
              </div>
            ) : (
              entries.map((entry, index) => (
                <div key={index} className="flex justify-between items-center p-4 text-sm">
                  <div className="flex items-center gap-4">
                    <span className={`w-6 text-center font-mono font-bold ${
                      index === 0 ? 'text-amber-400' :
                      index === 1 ? 'text-slate-300' :
                      index === 2 ? 'text-amber-600' :
                      'text-foreground-muted'
                    }`}>
                      #{index + 1}
                    </span>
                    <span className="font-semibold">{entry.username}</span>
                  </div>
                  <div className="flex gap-8 font-mono">
                    <div>
                      <span className="text-xs text-foreground-muted block">Drafts Cleared</span>
                      <span className="text-right block font-semibold">{entry.draftsCleared || 0}</span>
                    </div>
                    <div>
                      <span className="text-xs text-foreground-muted block">Total Points</span>
                      <span className="text-emerald-400 font-bold block">{entry.points} pts</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
