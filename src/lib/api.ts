const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'
const SESSION_KEY = 'nexpdv.session'
const PLATFORM_ADMIN_SESSION_KEY = 'nexpdv.platform-admin-session'
const DEFAULT_ESTABLISHMENT_PREFIX = 'nexpdv.default-establishment'
export const AUTH_SESSION_CHANGED_EVENT = 'nexpdv:auth-session-changed'

export type AuthSession = {
  accessToken: string
  user: { id: string; name: string; email: string }
  company: { id: string; tradeName: string } | null
  establishments: Array<{ id: string; name: string }>
  activeEstablishmentId?: string
  role: string
  permissions?: string[]
  impersonation?: { active: true; platformAdminUserId: string }
}
type ApiEnvelope<T> = { data: T; message?: string }
type ApiErrorBody = { error?: { code?: string; message?: string } }

export type CreateCompanyInput = {
  legalName: string
  tradeName: string
  document: string
  email: string
  phone?: string
  timezone: string
  currency: string
  establishment: { name: string; code: string; document?: string; email?: string; phone?: string }
  owner: { name: string; email: string; password: string }
}

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const withoutRefreshToken = (value: AuthSession & { refreshToken?: unknown }): AuthSession => {
  const { refreshToken: _removed, ...session } = value
  return session
}

export const readSession = (): AuthSession | null => {
  const value = sessionStorage.getItem(SESSION_KEY)
  if (!value) return null
  try {
    const session = withoutRefreshToken(JSON.parse(value) as AuthSession & { refreshToken?: unknown })
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}
export const saveSession = (session: AuthSession | null) => {
  const sanitized = session ? withoutRefreshToken(session) : null
  if (sanitized) sessionStorage.setItem(SESSION_KEY, JSON.stringify(sanitized))
  else sessionStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new CustomEvent<AuthSession | null>(AUTH_SESSION_CHANGED_EVENT, { detail: sanitized }))
}
export const readPlatformAdminSession = (): AuthSession | null => {
  const value = sessionStorage.getItem(PLATFORM_ADMIN_SESSION_KEY)
  if (!value) return null
  try {
    const session = withoutRefreshToken(JSON.parse(value) as AuthSession & { refreshToken?: unknown })
    sessionStorage.setItem(PLATFORM_ADMIN_SESSION_KEY, JSON.stringify(session))
    return session
  } catch {
    sessionStorage.removeItem(PLATFORM_ADMIN_SESSION_KEY)
    return null
  }
}
export const savePlatformAdminSession = (session: AuthSession | null) => {
  if (session) sessionStorage.setItem(PLATFORM_ADMIN_SESSION_KEY, JSON.stringify(withoutRefreshToken(session)))
  else sessionStorage.removeItem(PLATFORM_ADMIN_SESSION_KEY)
}
export const readDefaultEstablishment = (userId: string, companyId: string) =>
  localStorage.getItem(`${DEFAULT_ESTABLISHMENT_PREFIX}:${userId}:${companyId}`)
export const saveDefaultEstablishment = (userId: string, companyId: string, establishmentId: string | null) => {
  const key = `${DEFAULT_ESTABLISHMENT_PREFIX}:${userId}:${companyId}`
  if (establishmentId) localStorage.setItem(key, establishmentId)
  else localStorage.removeItem(key)
}

let refreshing: Promise<AuthSession | null> | null = null
const refreshWithCookie = async () => {
  const current = readSession()
  if (!current) return null
  try {
    const response = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
    if (!response.ok) {
      saveSession(null)
      return null
    }
    const { data } = (await response.json()) as ApiEnvelope<{ accessToken: string }>
    const renewed = { ...current, ...data }
    saveSession(renewed)
    return renewed
  } catch {
    saveSession(null)
    return null
  }
}
const renewSession = () =>
  navigator.locks
    ? navigator.locks.request('nexpdv-refresh-token', refreshWithCookie)
    : refreshWithCookie()

export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const session = readSession()
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`)
  if (session?.company?.id) headers.set('companyId', session.company.id)
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' })
  if (response.status === 401 && retry && session) {
    refreshing ??= renewSession().finally(() => { refreshing = null })
    const renewed = await refreshing
    if (renewed) return apiRequest<T>(path, init, false)
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new ApiError(response.status, body.error?.code ?? 'REQUEST_FAILED', body.error?.message ?? 'Não foi possível concluir a operação.')
  }
  if (response.status === 204) return undefined as T
  return ((await response.json()) as ApiEnvelope<T>).data
}

export async function loginRequest(input: { email: string; password: string; companyId?: string }) {
  const response = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'include',
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new ApiError(response.status, body.error?.code ?? 'LOGIN_FAILED', body.error?.message ?? 'E-mail ou senha inválidos.')
  }
  const { data } = (await response.json()) as ApiEnvelope<AuthSession>
  saveSession(data)
  return data
}

export async function createCompanyRequest(input: CreateCompanyInput) {
  const response = await fetch(`${API_URL}/v1/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'include',
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new ApiError(response.status, body.error?.code ?? 'COMPANY_CREATE_FAILED', body.error?.message ?? 'Não foi possível criar a empresa.')
  }
  return ((await response.json()) as ApiEnvelope<unknown>).data
}
