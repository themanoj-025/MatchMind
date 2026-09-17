/** DraftRoom type definitions. */

export interface Player {
  id: string
  name: string
  position: string
  basePrice: number
  club: string
}

export interface RosterItem {
  id: string
  userId: string
  playerId: string
  soldPrice: number
  player: Player
}

export interface ChatMsg {
  id?: string
  userId: string
  text: string
  timestamp: string
  user?: {
    username: string
  }
}

export interface ActiveMember {
  id: string
  userId: string
  username?: string
  displayName?: string
  remainingBudget: number
  isReady?: boolean
  role?: string
  user?: {
    username: string
  }
}

export interface RoomState {
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

export interface BidUpdatedData {
  amount: number
  userId: string
  timerEndsAt?: string | null
  remainingBudget?: number
}

export interface PlayerSoldData {
  buyerId: string
  price: number
  playerId: string
}

export interface AiAdvice {
  summary: string
  positionNeeds?: Record<string, number>
  positionFocus?: Record<string, number>
  targets?: string[]
  budgetAdvice?: string
  warning?: string
}
