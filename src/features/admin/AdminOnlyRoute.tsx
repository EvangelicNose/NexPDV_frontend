import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'

export function AdminOnlyRoute() {
  const { session } = useAuth()
  return session?.role === 'PLATFORM_ADMIN' ? <Outlet /> : <Navigate to="/" replace />
}

export function TenantOnlyRoute() {
  const { session } = useAuth()
  return session?.role === 'PLATFORM_ADMIN' ? <Navigate to="/admin" replace /> : <Outlet />
}
