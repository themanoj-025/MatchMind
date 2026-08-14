import { useMutation } from '@tanstack/react-query'
import { env } from '../config/env'

export const useAuctionAdvice = () => {
  return useMutation({
    mutationFn: async (params: { roomId: string; draftState: any }) => {
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
