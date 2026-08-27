import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { AUTH_SESSION_CHANGED_EVENT, apiRequest, loginRequest, readDefaultEstablishment, readPlatformAdminSession, readSession, saveDefaultEstablishment, savePlatformAdminSession, saveSession, type AuthSession } from '../../lib/api'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(() => readSession())
  useEffect(() => {
    const synchronizeSession = (event: Event) => {
      setSession((event as CustomEvent<AuthSession | null>).detail)
    }
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, synchronizeSession)
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, synchronizeSession)
  }, [])
  const currentEstablishment = session?.establishments.find((item) => item.id === session.activeEstablishmentId) ?? session?.establishments[0] ?? null
  const value = useMemo<AuthContextValue>(() => ({
    session,
    currentEstablishment,
    switchEstablishment: (establishmentId, makeDefault = false) => setSession((current) => {
      if (!current?.establishments.some((item) => item.id === establishmentId)) return current
      const updated = { ...current, activeEstablishmentId: establishmentId }
      if (makeDefault && current.company) saveDefaultEstablishment(current.user.id, current.company.id, establishmentId)
      saveSession(updated)
      return updated
    }),
    login: async (input) => {
      const authenticated = await loginRequest(input)
      const defaultId = authenticated.company
        ? readDefaultEstablishment(authenticated.user.id, authenticated.company.id)
        : null
      const hasDefault = Boolean(defaultId && authenticated.establishments.some(item => item.id === defaultId))
      if (defaultId && !hasDefault && authenticated.company) {
        saveDefaultEstablishment(authenticated.user.id, authenticated.company.id, null)
      }
      const resolved = hasDefault ? { ...authenticated, activeEstablishmentId: defaultId! } : authenticated
      saveSession(resolved)
      setSession(resolved)
      return resolved
    },
    connectAs: async (companyId, userId) => {
      if (!session || session.role !== 'PLATFORM_ADMIN') throw new Error('Acesso restrito ao administrador da plataforma.')
      const connected = await apiRequest<AuthSession>('/v1/auth/connect-as', {
        method: 'POST',
        headers: { companyId },
        body: JSON.stringify({ userId }),
      })
      savePlatformAdminSession(session)
      saveSession(connected)
      setSession(connected)
    },
    exitImpersonation: async () => {
      const platformSession = readPlatformAdminSession()
      if (!platformSession) return
      try {
        const tokens = await apiRequest<Pick<AuthSession, 'accessToken'>>('/v1/auth/impersonation/exit', { method: 'POST' })
        const restored = { ...platformSession, ...tokens }
        saveSession(restored)
        savePlatformAdminSession(null)
        setSession(restored)
      } catch (error) {
        saveSession(null)
        savePlatformAdminSession(null)
        setSession(null)
        throw error
      }
    },
    logout: async () => {
      try { await apiRequest<void>('/v1/auth/logout', { method: 'POST' }) } finally {
        saveSession(null)
        savePlatformAdminSession(null)
        setSession(null)
      }
    },
  }), [session, currentEstablishment])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
