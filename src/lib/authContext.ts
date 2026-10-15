import type { User } from 'firebase/auth'
import { createContext, useContext } from 'react'

export interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export const AuthContext = createContext<AuthState>({ user: null, loading: true, error: null })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
