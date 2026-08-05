import { createContext, useContext } from 'react'
import type { AuthSession } from '../../lib/api'

export type AuthContextValue = {
  session: AuthSession | null
  login: (input: { email: string; password: string; companyId?: string }) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return context
}
