import { useMemo, useState, type PropsWithChildren } from 'react'
import { apiRequest, loginRequest, readSession, saveSession, type AuthSession } from '../../lib/api'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(() => readSession())
  const value = useMemo<AuthContextValue>(() => ({
    session,
    login: async (input) => setSession(await loginRequest(input)),
    logout: async () => {
      try { await apiRequest<void>('/v1/auth/logout', { method: 'POST' }) } finally {
        saveSession(null)
        setSession(null)
      }
    },
  }), [session])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
