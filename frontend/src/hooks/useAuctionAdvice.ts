import { useMutation } from '@tanstack/react-query'
import { env } from '../config/env'

interface DraftState {
  players?: Array<{ id: string; name: string; position: string; soldPrice?: number }>
  budget?: number
  [key: string]: unknown
}

export const useAuctionAdvice = () => {
  return useMutation({
    mutationFn: async (params: { roomId: string; draftState: DraftState }) => {
      const response = await fetch(`${env.API_URL}/api/v1/ai/auction-advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error('AI advice request failed')
      }
      return response.json()
    },
  })
}
