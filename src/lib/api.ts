const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'
const SESSION_KEY = 'nexpdv.session'

export type AuthSession = {
  accessToken: string
  refreshToken: string
  user: { id: string; name: string; email: string }
  company: { id: string; tradeName: string } | null
  establishments: Array<{ id: string; name: string }>
  role: string
}
type ApiEnvelope<T> = { data: T; message?: string }
type ApiErrorBody = { error?: { code?: string; message?: string } }

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

export const readSession = (): AuthSession | null => {
  const value = sessionStorage.getItem(SESSION_KEY)
  if (!value) return null
  try {
    return JSON.parse(value) as AuthSession
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}
export const saveSession = (session: AuthSession | null) => {
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else sessionStorage.removeItem(SESSION_KEY)
}

let refreshing: Promise<AuthSession | null> | null = null
const renewSession = async () => {
  const current = readSession()
  if (!current?.refreshToken) return null
  const response = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  })
  if (!response.ok) {
    saveSession(null)
    return null
  }
  const { data } = (await response.json()) as ApiEnvelope<{ accessToken: string; refreshToken: string }>
  const renewed = { ...current, ...data }
  saveSession(renewed)
  return renewed
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const session = readSession()
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`)
  const response = await fetch(`${API_URL}${path}`, { ...init, headers })
  if (response.status === 401 && retry && session?.refreshToken) {
    refreshing ??= renewSession().finally(() => { refreshing = null })
    if (await refreshing) return apiRequest<T>(path, init, false)
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
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new ApiError(response.status, body.error?.code ?? 'LOGIN_FAILED', body.error?.message ?? 'E-mail ou senha inválidos.')
  }
  const { data } = (await response.json()) as ApiEnvelope<AuthSession>
  saveSession(data)
  return data
}
