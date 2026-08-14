import { create } from 'zustand'
import { env } from '../config/env'

export interface User {
  id: string
  username: string
  email: string
  isPro: boolean
}

interface AuthState {
  user: User | null
  isLoading: boolean
  setUser: (user: User | null) => void
  fetchUser: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  fetchUser: async () => {
    try {
      const response = await fetch(`${env.API_URL}/api/v1/auth/me`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        set({ user: data.user, isLoading: false })
      } else {
        const refreshRes = await fetch(`${env.API_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })
        if (refreshRes.ok) {
          const retryRes = await fetch(`${env.API_URL}/api/v1/auth/me`, {
            credentials: 'include',
          })
          if (retryRes.ok) {
            const retryData = await retryRes.json()
            set({ user: retryData.user, isLoading: false })
            return
          }
        }
        set({ user: null, isLoading: false })
      }
    } catch (err) {
      console.error('Failed to hydrate session:', err)
      set({ user: null, isLoading: false })
    }
  },
  logout: async () => {
    try {
      await fetch(`${env.API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (e) {
      console.error(e)
    }
    set({ user: null })
  },
}))
