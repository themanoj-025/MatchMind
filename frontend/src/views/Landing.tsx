import * as React from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { 
  Trophy, 
  ArrowRight, 
  Activity, 
  Play, 
  Flame, 
  Coins, 
  Users, 
  ChevronRight,
  Sliders,
  Sparkles,
  Search,
  BookOpen,
  UserCheck
} from 'lucide-react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'

export const Landing: React.FC = () => {
  const navigate = useNavigate()
  const { scrollY } = useScroll()
  const opacity = useTransform(scrollY, [0, 400], [1, 0])
  const scale = useTransform(scrollY, [0, 400], [1, 0.98])
  const y = useTransform(scrollY, [0, 400], [0, 50])

  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'upcoming'>('all')

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as any }
    }
  }

  // Ticker items
  const tickerItems = [
    { type: 'sold', text: '⚡ Haaland — £22.4M — SOLD to Gaffer_07' },
    { type: 'live', text: '🔴 LIVE: Bellingham — £18.9M — 5 bids active' },
    { type: 'time', text: '⏱ closing in 0:12: Saka — £14.1M — current lead Manager_99' },
    { type: 'sold', text: '⚡ Mbappé — £28.5M — SOLD to Gaffer_12' },
    { type: 'live', text: '🔴 LIVE: Palmer — £12.2M — 3 bids active' },
    { type: 'time', text: '⏱ closing in 0:34: Rodri — £16.5M' },
  ]

  // Double up the ticker items for smooth loop
  const doubleTickerItems = [...tickerItems, ...tickerItems]

  // Demo squad for pitch visualization
  const squadPlayers = [
    // Attackers
    { name: 'Vini Jr.', pos: 'LW', rating: '8.8', tier: 'premium', x: '20%', y: '25%' },
    { name: 'Haaland', pos: 'ST', rating: '9.2', tier: 'premium', x: '50%', y: '18%' },
    { name: 'Saka', pos: 'RW', rating: '8.5', tier: 'gold', x: '80%', y: '25%' },
    // Midfielders
    { name: 'Bellingham', pos: 'M', rating: '8.7', tier: 'premium', x: '25%', y: '50%' },
    { name: 'Rodri', pos: 'M', rating: '8.9', tier: 'premium', x: '50%', y: '55%' },
    { name: 'Ødegaard', pos: 'M', rating: '8.4', tier: 'gold', x: '75%', y: '50%' },
    // Defenders
    { name: 'Gvardiol', pos: 'LB', rating: '7.8', tier: 'silver', x: '15%', y: '75%' },
    { name: 'Saliba', pos: 'CB', rating: '8.6', tier: 'gold', x: '38%', y: '78%' },
    { name: 'Van Dijk', pos: 'CB', rating: '8.8', tier: 'premium', x: '62%', y: '78%' },
    { name: 'White', pos: 'RB', rating: '7.6', tier: 'silver', x: '85%', y: '75%' },
    // Goalkeeper
    { name: 'Raya', pos: 'GK', rating: '8.1', tier: 'gold', x: '50%', y: '90%' },
  ]

  // Demo rooms
  const draftRooms = [
    { name: 'Premier League Draft Arena', managers: '9/10', status: 'LIVE', time: 'Active Bid: Palmer', league: 'PL' },
    { name: 'Champions League Elite Pool', managers: '6/8', status: 'UPCOMING', time: 'Starts in 14m', league: 'UCL' },
    { name: 'Serie A Tactical Auction', managers: '10/10', status: 'LIVE', time: 'Active Bid: Kvaratskhelia', league: 'Serie A' },
    { name: 'La Liga Gaffer Room', managers: '4/8', status: 'UPCOMING', time: 'Starts in 1h 22m', league: 'La Liga' },
  ]

  const filteredRooms = draftRooms.filter(room => {
    if (activeTab === 'all') return true
    return room.status.toLowerCase() === activeTab.toLowerCase()
  })

  // Player pool demo data
  const playerPool = [
    { name: 'Erling Haaland', team: 'Manchester City', pos: 'ST', rating: '9.2', tier: 'Icon', value: '£25.0M' },
    { name: 'Jude Bellingham', team: 'Real Madrid', pos: 'CM', rating: '8.9', tier: 'Premium', value: '£22.0M' },
    { name: 'Jermaine Palmer', team: 'Chelsea', pos: 'AM', rating: '8.7', tier: 'Premium', value: '£18.5M' },
    { name: 'Bukayo Saka', team: 'Arsenal', pos: 'RW', rating: '8.6', tier: 'Gold', value: '£16.0M' },
    { name: 'William Saliba', team: 'Arsenal', pos: 'CB', rating: '8.5', tier: 'Gold', value: '£14.0M' },
    { name: 'David Raya', team: 'Arsenal', pos: 'GK', rating: '8.1', tier: 'Silver', value: '£9.0M' },
  ]

  // Leaderboard mock data
  const mockLeaderboard = [
    { rank: 1, name: 'Gaffer_09', pts: '2,890', drafts: '22', winrate: '74%' },
    { rank: 2, name: 'PitchMaster', pts: '2,640', drafts: '18', winrate: '68%' },
    { rank: 3, name: 'StrikerXI', pts: '2,510', drafts: '20', winrate: '60%' },
    { rank: 4, name: 'Pep_Tactics', pts: '2,420', drafts: '17', winrate: '58%' },
    { rank: 5, name: 'Klopp_Gegen', pts: '2,390', drafts: '19', winrate: '55%' },
  ]

  return (
    <div className="min-h-screen bg-[#05060a] relative overflow-hidden text-foreground selection:bg-accent/30 font-sans">
      {/* Stadium floodlight radial overlay */}
      <div className="absolute inset-0 bg-grid-overlay opacity-[0.07] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[700px] bg-gradient-to-b from-[#6366f1]/15 to-transparent blur-[160px] rounded-full pointer-events-none opacity-80 z-0" />
      
      {/* Header & Double Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#05060a]/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => scrollToSection('hero')}>
            {/* Minimalist Football + Data Node Icon */}
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-accent fill-none stroke-current stroke-2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              <path d="M2 12h20" />
              <circle cx="12" cy="12" r="3" className="fill-accent/20" />
            </svg>
            <span className="font-semibold tracking-tight text-lg">MatchMind <span className="text-accent">Drafts</span></span>
          </div>
          
          {/* Secondary Quick Nav Pills */}
          <div className="hidden md:flex items-center gap-1.5">
            <button 
              onClick={() => scrollToSection('live-drafts')}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-white/[0.03] text-foreground border border-white/[0.05] hover:bg-white/[0.06] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-live-red animate-pulse" />
              Live Drafts
            </button>
            <button 
              onClick={() => scrollToSection('leaderboards')}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium text-foreground-muted hover:text-white transition-all cursor-pointer"
            >
              Leaderboards
            </button>
            <button 
              onClick={() => scrollToSection('player-pool')}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium text-foreground-muted hover:text-white transition-all cursor-pointer"
            >
              Player Pool
            </button>
            <button 
              onClick={() => scrollToSection('rules')}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium text-foreground-muted hover:text-white transition-all cursor-pointer"
            >
              Rules
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="px-4 py-1.5 text-xs cursor-pointer font-medium text-foreground-muted hover:text-white" onClick={() => navigate('/login')}>Log in</Button>
            <Button className="px-4 py-1.5 text-xs cursor-pointer font-medium bg-accent hover:bg-accent-bright" onClick={() => navigate('/login')}>Sign up</Button>
          </div>
        </div>

        {/* Live Scrolling Bid Ticker */}
        <div className="border-t border-white/[0.04] bg-[#090b10] py-2 overflow-hidden select-none">
          <div className="flex w-max animate-marquee hover:[animation-play-state:paused] gap-12 text-[10px] font-mono tracking-wider uppercase text-foreground-muted">
            {doubleTickerItems.map((item, index) => (
              <span key={index} className="flex items-center gap-2">
                {item.type === 'sold' && <span className="text-pitch-green">✔</span>}
                {item.type === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-live-red animate-ping" />}
                {item.type === 'time' && <span className="text-card-yellow">⏱</span>}
                <span className={item.type === 'sold' ? 'text-white' : item.type === 'live' ? 'text-live-red' : 'text-card-yellow'}>
                  {item.text}
                </span>
                <span className="text-white/[0.08] ml-10">|</span>
              </span>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="relative z-10 pt-28">
        
        {/* Hero Section with Pitch Line Texture */}
        <motion.section 
          id="hero"
          style={{ opacity, scale, y }}
          className="container mx-auto px-6 py-16 md:py-24 flex flex-col items-center text-center max-w-4xl relative bg-pitch-lines"
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center"
          >
            {/* Match status eyebrow badge */}
            <motion.div 
              variants={itemVariants} 
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-live-red/30 bg-live-red/10 mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-live-red animate-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-widest text-live-red">LIVE • DRAFT ARENA • V2.0</span>
            </motion.div>
            
            <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-bold tracking-[-0.03em] leading-[1.05] mb-6">
              <span className="text-gradient">Real-Time Auctions</span><br/>
              <span className="text-gradient-accent pb-2 block">Built for draft managers.</span>
            </motion.h1>
            
            <motion.p variants={itemVariants} className="text-sm md:text-base text-foreground-muted max-w-2xl mx-auto mb-10 leading-relaxed">
              MatchMind Drafts brings high-concurrency auction bidding, real-time draft updates, and AI-powered roster suggestions together in a premium sports-broadcast interface.
            </motion.p>
            
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row items-center gap-4 justify-center w-full md:w-auto mb-16">
              <Button className="w-full md:w-auto px-8 py-4 text-sm font-medium bg-accent hover:bg-accent-bright cursor-pointer" onClick={() => navigate('/login')}>
                Enter Lobby <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                variant="ghost" 
                className="w-full md:w-auto px-8 py-4 text-sm font-medium border border-white/10 hover:bg-white/[0.02] flex items-center justify-center gap-2 cursor-pointer"
                onClick={() => scrollToSection('live-drafts')}
              >
                <Play className="w-4 h-4 fill-current text-live-red animate-pulse" /> Watch Live Draft
              </Button>
            </motion.div>

            {/* SofaScore style live stat summary bar */}
            <motion.div 
              variants={itemVariants} 
              className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-3xl border border-white/[0.04] bg-[#0c0d13]/40 backdrop-blur-md rounded-xl p-6 text-left"
            >
              <div>
                <span className="text-2xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  <span className="text-lg">⚽</span> 2,483
                </span>
                <span className="text-xs text-foreground-muted block mt-1 uppercase font-semibold tracking-wider">Players in Pool</span>
              </div>
              <div className="border-l border-white/[0.05] pl-6">
                <span className="text-2xl font-bold tracking-tight text-live-red flex items-center gap-1.5">
                  <Flame className="w-5 h-5 fill-current" /> 148
                </span>
                <span className="text-xs text-foreground-muted block mt-1 uppercase font-semibold tracking-wider">Active Bids</span>
              </div>
              <div className="border-l border-white/[0.05] pl-6">
                <span className="text-2xl font-bold tracking-tight text-pitch-green flex items-center gap-1.5">
                  <Coins className="w-5 h-5" /> £1.2B
                </span>
                <span className="text-xs text-foreground-muted block mt-1 uppercase font-semibold tracking-wider">Auction Volume</span>
              </div>
              <div className="border-l border-white/[0.05] pl-6">
                <span className="text-2xl font-bold tracking-tight text-accent-bright flex items-center gap-1.5">
                  <Users className="w-5 h-5" /> 34,902
                </span>
                <span className="text-xs text-foreground-muted block mt-1 uppercase font-semibold tracking-wider">Managers Online</span>
              </div>
            </motion.div>
          </motion.div>
        </motion.section>

        {/* Feature Cards Section */}
        <section className="container mx-auto px-6 py-20 border-t border-white/[0.02]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Real-Time Bids Card */}
            <Card className="p-6 flex flex-col justify-between group hover:border-accent/40 transition-all duration-300">
              <div>
                <div className="w-10 h-10 rounded-lg border border-live-red/20 flex items-center justify-center bg-live-red/5 mb-4 group-hover:scale-105 transition-all">
                  <Activity className="w-5 h-5 text-live-red" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight mb-2 flex items-center justify-between">
                  Real-Time Bids
                  <span className="text-[10px] font-mono bg-live-red/10 text-live-red px-1.5 py-0.5 rounded uppercase">0.1s latency</span>
                </h3>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  Live auction console with sub-second WebSocket sync — watch bids climb, timers tick down, and rivals get outbid in real time.
                </p>
              </div>
              {/* Micro-visual mockup */}
              <div className="mt-6 border border-white/[0.04] bg-[#05060a] rounded-lg p-3 font-mono text-[10px] flex items-center justify-between">
                <span className="text-foreground-muted">Haaland Lead Bid</span>
                <span className="text-pitch-green font-bold animate-pulse">£24.8M</span>
              </div>
            </Card>

            {/* AI Strategy Advisor Card */}
            <Card className="p-6 flex flex-col justify-between group hover:border-accent/40 transition-all duration-300">
              <div>
                <div className="w-10 h-10 rounded-lg border border-accent/20 flex items-center justify-center bg-accent/5 mb-4 group-hover:scale-105 transition-all">
                  <Sliders className="w-5 h-5 text-accent-bright" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight mb-2 flex items-center justify-between">
                  Smart Strategy Advisor
                  <span className="text-[10px] font-mono bg-accent/10 text-accent-bright px-1.5 py-0.5 rounded uppercase">ADVANCED ANALYTICS</span>
                </h3>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  Get formation-aware, budget-optimized recommendations — using analytical models trained on real transfer market and performance data.
                </p>
              </div>
              {/* Micro-visual mockup */}
              <div className="mt-6 border border-white/[0.04] bg-[#05060a] rounded-lg p-3 flex items-center justify-between">
                <span className="text-[10px] text-foreground-muted">Roster Fit Confidence</span>
                <div className="flex items-center gap-1">
                  <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="w-[87%] h-full bg-pitch-green rounded-full" />
                  </div>
                  <span className="text-[10px] text-pitch-green font-mono font-bold">87%</span>
                </div>
              </div>
            </Card>

            {/* Leaderboard Standing Card */}
            <Card className="p-6 flex flex-col justify-between group hover:border-accent/40 transition-all duration-300">
              <div>
                <div className="w-10 h-10 rounded-lg border border-gold/20 flex items-center justify-center bg-gold/5 mb-4 group-hover:scale-105 transition-all">
                  <Trophy className="w-5 h-5 text-gold" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight mb-2 flex items-center justify-between">
                  Leaderboard Standing
                  <span className="text-[10px] font-mono bg-gold/10 text-gold px-1.5 py-0.5 rounded uppercase">GLOBAL RANKS</span>
                </h3>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  Track your rank against a global gaffer pool after every completed draft — climb the table matchday by matchday.
                </p>
              </div>
              {/* Micro-visual mockup */}
              <div className="mt-6 border border-white/[0.04] bg-[#05060a] rounded-lg p-3 flex justify-between items-center text-[10px] font-mono">
                <span className="text-gold">#1 Gaffer_09</span>
                <span className="text-foreground-muted">2,490 pts</span>
              </div>
            </Card>

          </div>
        </section>

        {/* Live Draft Rooms Section */}
        <section id="live-drafts" className="container mx-auto px-6 py-20 border-t border-white/[0.02]">
          <div className="max-w-4xl mx-auto">
            
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-8 gap-4">
              <div>
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-live-red/20 bg-live-red/10 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-live-red animate-pulse" />
                  <span className="text-[10px] font-mono font-bold tracking-wider text-live-red uppercase">Live Arenas</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gradient">
                  Available Draft Arenas
                </h2>
              </div>

              {/* Tab Filters */}
              <div className="flex gap-1.5 bg-white/[0.02] border border-white/[0.04] p-1 rounded-lg self-stretch md:self-auto">
                <button 
                  onClick={() => setActiveTab('all')} 
                  className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${activeTab === 'all' ? 'bg-white/[0.06] text-white' : 'text-foreground-muted hover:text-white'}`}
                >
                  All
                </button>
                <button 
                  onClick={() => setActiveTab('live')} 
                  className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${activeTab === 'live' ? 'bg-white/[0.06] text-white' : 'text-foreground-muted hover:text-white'}`}
                >
                  Live
                </button>
                <button 
                  onClick={() => setActiveTab('upcoming')} 
                  className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${activeTab === 'upcoming' ? 'bg-white/[0.06] text-white' : 'text-foreground-muted hover:text-white'}`}
                >
                  Upcoming
                </button>
              </div>
            </div>

            {/* Flashscore style fixtures list */}
            <div className="border border-white/[0.04] bg-[#0c0d13]/30 backdrop-blur-md rounded-xl overflow-hidden divide-y divide-white/[0.04]">
              {filteredRooms.map((room, index) => (
                <div key={index} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 gap-4 hover:bg-white/[0.01] transition-all">
                  <div className="flex items-center gap-3">
                    {/* Badge */}
                    <span className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center font-bold text-xs text-foreground-muted">
                      {room.league}
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{room.name}</h4>
                      <p className="text-xs text-foreground-muted mt-0.5 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> {room.managers} Managers Joined
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                    <span className="text-xs font-mono text-foreground-muted">{room.time}</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider ${
                        room.status === 'LIVE' ? 'bg-live-red/10 text-live-red border border-live-red/20' : 'bg-accent/10 text-accent-bright border border-accent/20'
                      }`}>
                        {room.status}
                      </span>
                      <button 
                        onClick={() => navigate('/login')} 
                        className="p-1 hover:bg-white/5 rounded-lg text-foreground-subtle hover:text-white cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* Your Squad on the Pitch Section */}
        <section className="container mx-auto px-6 py-20 border-t border-white/[0.02]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-pitch-green/20 bg-pitch-green/10 mb-4">
                <Sparkles className="w-3.5 h-3.5 text-pitch-green" />
                <span className="text-[10px] font-mono font-bold tracking-wider text-pitch-green uppercase">Pitch Showcase</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-gradient">
                Your Squad on the Pitch
              </h2>
              <p className="text-sm text-foreground-muted leading-relaxed mb-6">
                Arrange your auction-acquired gaffer squad directly on our pitch graphic. Toggle between dynamic tactics formations (4-3-3, 3-5-2) and watch your squad rating dynamically adjust based on live player statistics.
              </p>
              <div className="flex gap-4">
                <span className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-accent text-white border border-accent cursor-pointer">
                  4-3-3 Formation
                </span>
                <span className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-white/10 text-foreground-muted hover:text-white hover:bg-white/[0.02] cursor-pointer">
                  Formation 3-5-2
                </span>
              </div>
            </div>

            {/* Pitch Layout Rendering */}
            <div className="relative border border-white/[0.05] rounded-2xl p-4 bg-[#0a0c12]/50 overflow-hidden shadow-2xl h-[420px] md:h-[480px]">
              
              {/* Pitch Grass Texture & Lines */}
              <div className="absolute inset-0 bg-pitch-lines opacity-20 pointer-events-none" />
              <div className="absolute inset-x-8 top-0 bottom-8 border border-white/[0.02] rounded-b-xl pointer-events-none" />
              {/* Goalbox Area top */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 border border-white/[0.02] rounded-b-xl pointer-events-none" />
              {/* Goalbox Area bottom */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-12 border border-white/[0.02] rounded-t-xl pointer-events-none" />

              {/* Pitch Players */}
              {squadPlayers.map((player, index) => (
                <div 
                  key={index} 
                  style={{ left: player.x, top: player.y }} 
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center scale-90 md:scale-100"
                >
                  {/* Player Shirt/Icon */}
                  <div className="w-8 h-8 rounded-full bg-[#12141c] border border-white/20 flex items-center justify-center shadow-lg relative group cursor-pointer hover:border-accent">
                    <span className="text-[10px] font-bold text-white/80">{player.pos}</span>
                    {/* FotMob style rating badge */}
                    <span className={`absolute -bottom-1 -right-2 text-[8px] font-bold px-1 py-0.2 rounded ${
                      parseFloat(player.rating) >= 8.5 ? 'bg-pitch-green text-black' :
                      parseFloat(player.rating) >= 7.5 ? 'bg-gold text-black' : 'bg-foreground-muted text-white'
                    }`}>
                      {player.rating}
                    </span>
                  </div>
                  {/* Player Name */}
                  <span className="text-[9px] font-semibold text-white mt-1 bg-[#05060a]/90 px-1.5 py-0.5 rounded shadow border border-white/[0.04]">
                    {player.name}
                  </span>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* Global Leaderboard Section */}
        <section id="leaderboards" className="container mx-auto px-6 py-20 border-t border-white/[0.02]">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2.5 mb-2">
              <Trophy className="w-6 h-6 text-gold" />
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gradient">Leaderboard Standings</h2>
            </div>
            <p className="text-xs text-foreground-muted mb-8 max-w-xl">
              Track global gaffer rankings computed in real time after every completed draft. Climb the ranks to unlock exclusive badges.
            </p>

            <div className="border border-white/[0.04] bg-[#0c0d13]/30 backdrop-blur-md rounded-xl overflow-hidden divide-y divide-white/[0.04] font-mono text-xs">
              <div className="grid grid-cols-5 p-4 text-foreground-muted font-semibold uppercase tracking-wider text-[10px]">
                <div className="col-span-2">Manager</div>
                <div className="text-center">Drafts</div>
                <div className="text-center">Win Rate</div>
                <div className="text-right">Total Points</div>
              </div>
              
              {mockLeaderboard.map((user) => (
                <div key={user.rank} className="grid grid-cols-5 p-4 items-center hover:bg-white/[0.01] transition-all">
                  <div className="col-span-2 flex items-center gap-3">
                    <span className={`w-5 text-center font-bold ${
                      user.rank === 1 ? 'text-gold' : user.rank === 2 ? 'text-slate-300' : user.rank === 3 ? 'text-amber-600' : 'text-foreground-muted'
                    }`}>
                      #{user.rank}
                    </span>
                    <span className="font-sans font-semibold text-white">{user.name}</span>
                  </div>
                  <div className="text-center text-foreground-muted">{user.drafts}</div>
                  <div className="text-center text-pitch-green">{user.winrate}</div>
                  <div className="text-right font-bold text-accent-bright">{user.pts} pts</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Player Pool Showcase Section */}
        <section id="player-pool" className="container mx-auto px-6 py-20 border-t border-white/[0.02]">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2.5 mb-2">
              <Search className="w-6 h-6 text-accent-bright" />
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gradient">Featured Player Pool</h2>
            </div>
            <p className="text-xs text-foreground-muted mb-8 max-w-xl">
              Preview the current live player pool metrics, baseline draft valuations, and custom gaffer match stats.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {playerPool.map((player, idx) => (
                <Card key={idx} className="p-5 border border-white/[0.04] bg-[#0c0d13]/30 backdrop-blur-md flex flex-col justify-between group hover:border-accent/40 transition-all duration-300">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-semibold text-white group-hover:text-accent-bright transition-colors">{player.name}</h4>
                      <p className="text-[10px] text-foreground-muted mt-0.5">{player.team}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold tracking-wider ${
                      player.tier === 'Icon' ? 'bg-gold/15 text-gold border border-gold/20' :
                      player.tier === 'Premium' ? 'bg-live-red/15 text-live-red border border-live-red/20' :
                      'bg-pitch-green/15 text-pitch-green border border-pitch-green/20'
                    }`}>
                      {player.tier}
                    </span>
                  </div>

                  <div className="flex justify-between items-end border-t border-white/[0.04] pt-4 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-white/[0.03] flex items-center justify-center font-bold text-[10px] text-foreground-muted">
                        {player.pos}
                      </span>
                      <span className="text-[10px] font-mono text-foreground-muted">Rating:</span>
                      <span className="text-[10px] font-mono font-bold text-pitch-green">{player.rating}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-foreground-muted block uppercase tracking-wider font-semibold">Base Val</span>
                      <span className="text-xs font-mono font-bold text-white">{player.value}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Rules & Guidelines Section */}
        <section id="rules" className="container mx-auto px-6 py-20 border-t border-white/[0.02] mb-12">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2.5 mb-2">
              <BookOpen className="w-6 h-6 text-accent-bright" />
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gradient">Rules & Gameplay Guide</h2>
            </div>
            <p className="text-xs text-foreground-muted mb-8 max-w-xl">
              Familiarize yourself with the MatchMind Drafts auction arena mechanics, bidding intervals, and multipliers.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <Card className="p-6 border border-white/[0.04] bg-[#0c0d13]/30 backdrop-blur-md">
                <div className="flex items-center gap-2.5 mb-3">
                  <Coins className="w-5 h-5 text-gold" />
                  <h4 className="font-semibold text-white">1. Draft Tickets & Roster Budget</h4>
                </div>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  Start a draft room session by consuming a ticket. Each manager receives a baseline budget of **£100.0M** to bid on a full squad roster (11 players). All slots must be filled within the budget rules.
                </p>
              </Card>

              <Card className="p-6 border border-white/[0.04] bg-[#0c0d13]/30 backdrop-blur-md">
                <div className="flex items-center gap-2.5 mb-3">
                  <Activity className="w-5 h-5 text-live-red" />
                  <h4 className="font-semibold text-white">2. Bidding increments & Snipe Extension</h4>
                </div>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  The minimum bidding increment adjusts dynamically based on the current price. To prevent sniper bidding, any bid submitted within the final **15 seconds** of a timer resets the clock back to 15 seconds.
                </p>
              </Card>

              <Card className="p-6 border border-white/[0.04] bg-[#0c0d13]/30 backdrop-blur-md">
                <div className="flex items-center gap-2.5 mb-3">
                  <UserCheck className="w-5 h-5 text-pitch-green" />
                  <h4 className="font-semibold text-white">3. Captain Multiplier</h4>
                </div>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  Assign a Captain and Vice-Captain from your drafted roster in the franchise panel. Your Captain earns **2.0x points** and the Vice-Captain earns **1.5x points** based on real matchday stats.
                </p>
              </Card>

              <Card className="p-6 border border-white/[0.04] bg-[#0c0d13]/30 backdrop-blur-md">
                <div className="flex items-center gap-2.5 mb-3">
                  <Sliders className="w-5 h-5 text-accent-bright" />
                  <h4 className="font-semibold text-white">4. AI Auction Advices</h4>
                </div>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  Pro-tier subscribers can activate the AI strategy console during auctions. Get live suggestions detailing roster gaps, budget scaling safety, and recommended maximum bid evaluations.
                </p>
              </Card>

            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#05060a] relative z-10 pt-12 pb-8">
        <div className="container mx-auto px-6 text-center text-xs text-foreground-muted">
          <p>© {new Date().getFullYear()} MatchMind. Built for the beautiful game's sharpest managers.</p>
        </div>
      </footer>
    </div>
  )
}
