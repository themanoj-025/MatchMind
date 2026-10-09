import { useQuery } from '@tanstack/react-query'
import { env } from '../config/env'

export interface LeaderboardEntry {
  rank: number
  username: string
  points: number
  draftsCleared: number
}

export const useLeaderboard = () => {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const response = await fetch(`${env.API_URL}/api/v1/leaderboard`, {
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard')
      }
      const data = await response.json()
      return data.rankings || data || []
    },
  })
}
