import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '../auth/auth-context'
import { CATALOG_CLEARED, CATALOG_UPDATED, catalogScope, localProducts } from './catalog-local'

export function CatalogSync() {
  const client = useQueryClient()
  const { session, currentEstablishment } = useAuth()
  const scope = session?.company ? catalogScope() : null
  useEffect(() => {
    if (!scope) return
    const update = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== scope || catalogScope() !== scope) return
      void client.invalidateQueries({ queryKey: ['products'] })
    }
    const refresh = () => {
      if (document.visibilityState === 'visible' && catalogScope() === scope) void localProducts().catch(() => undefined)
    }
    const cleared = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== scope) return
      void client.cancelQueries({ queryKey: ['products', scope] }).then(() => {
        client.setQueriesData({ queryKey: ['products', scope] }, [])
      })
    }
    window.addEventListener(CATALOG_UPDATED, update)
    window.addEventListener(CATALOG_CLEARED, cleared)
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)
    const interval = window.setInterval(refresh, 60_000)
    refresh()
    return () => {
      window.removeEventListener(CATALOG_UPDATED, update)
      window.removeEventListener(CATALOG_CLEARED, cleared)
      window.removeEventListener('online', refresh)
      window.removeEventListener('focus', refresh)
      window.clearInterval(interval)
    }
  }, [client, scope, currentEstablishment?.id])
  return null
}
