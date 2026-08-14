import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { env } from '../config/env'

export interface Room {
  id: string
  name: string
  status: string
  type: string
  totalBudget: number
  _count?: {
    members: number
  }
}

export const useRooms = () => {
  return useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: async () => {
      const response = await fetch(`${env.API_URL}/api/v1/rooms`, {
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error('Failed to fetch rooms')
      }
      return response.json()
    },
  })
}

export const useCreateRoom = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newRoom: {
      name: string
      type: string
      totalBudget: number
      rosterRules: any
    }) => {
      const response = await fetch(`${env.API_URL}/api/v1/rooms`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRoom),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create room')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}
