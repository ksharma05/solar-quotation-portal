import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as authApi from '@/services/api/authApi'

interface AuthState {
  token: string | null
  /** Epoch ms at which the stored token stops being usable. */
  expiresAt: number | null
  signIn: (pin: string) => Promise<{ ok: boolean; message?: string }>
  signOut: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      expiresAt: null,

      signIn: async (pin) => {
        const result = await authApi.login(pin)
        if (!result.ok) return { ok: false, message: result.message }

        set({ token: result.data.token, expiresAt: Date.now() + result.data.expiresIn })
        return { ok: true }
      },

      signOut: () => {
        const { token } = get()
        // Fire and forget: local state clears regardless of whether the call lands.
        if (token) void authApi.logout(token)
        set({ token: null, expiresAt: null })
      },

      isAuthenticated: () => {
        const { token, expiresAt } = get()
        return Boolean(token && expiresAt && expiresAt > Date.now())
      },
    }),
    {
      name: 'sgt-auth',
      partialize: (state) => ({ token: state.token, expiresAt: state.expiresAt }),
    }
  )
)
