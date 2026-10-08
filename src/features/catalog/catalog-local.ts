import { apiRequest, readSession } from '../../lib/api'
import type { Product } from './catalog.types'

export type ProductFilters = { search?: string; sku?: string; barcode?: string; categoryId?: string; active?: boolean }
type Snapshot = { scope: string; products: Product[]; syncedAt: number; lastSyncedAt?: number }
export const CATALOG_UPDATED = 'nexpdv:catalog-updated'
export const CATALOG_CLEARED = 'nexpdv:catalog-cleared'
const memory = new Map<string, Snapshot>()
const pending = new Map<string, Promise<Snapshot>>()
const revisions = new Map<string, number>()
const clearing = new Set<string>()
let database: Promise<IDBDatabase | null> | undefined

export function catalogScope() {
  const session = readSession()
  if (!session?.company) return null
  return JSON.stringify([session.company.id, session.activeEstablishmentId ?? session.establishments[0]?.id ?? '', session.user.id, session.role, [...(session.permissions ?? [])].sort()])
}

function openDatabase() {
  database ??= new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return }
    try {
      const request = indexedDB.open('nexpdv-catalog', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('catalogs', { keyPath: 'scope' })
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); database = undefined }
        resolve(request.result)
      }
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch { resolve(null) }
  })
  return database
}

async function readSnapshot(scope: string): Promise<Snapshot | undefined> {
  const cached = memory.get(scope)
  if (cached) return cached
  const db = await openDatabase()
  if (!db) return undefined
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction('catalogs', 'readonly')
      const request = transaction.objectStore('catalogs').get(scope)
      request.onsuccess = () => {
        const snapshot = memory.get(scope) ?? request.result as Snapshot | undefined
        if (snapshot) memory.set(scope, snapshot)
        resolve(snapshot)
      }
      request.onerror = () => resolve(undefined)
      transaction.onabort = () => resolve(undefined)
    } catch { resolve(undefined) }
  })
}

async function persist(snapshot: Snapshot) {
  memory.set(snapshot.scope, snapshot)
  const db = await openDatabase()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction('catalogs', 'readwrite')
      transaction.objectStore('catalogs').put(snapshot)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
      transaction.onabort = () => resolve()
    } catch { resolve() }
  })
}

export function filterProducts(products: Product[], input: ProductFilters): Product[] {
  const normalize = (value?: string | null) => value?.toLocaleLowerCase('pt-BR') ?? ''
  const term = normalize(input.search?.trim())
  return products.filter((product) => {
    const variants = product.variants.filter((variant) => variant.active)
    if (input.active !== undefined && product.active !== input.active) return false
    if (input.categoryId && product.category?.id !== input.categoryId) return false
    if (input.sku && ![product.sku, ...variants.map((variant) => variant.sku)].some((sku) => normalize(sku) === normalize(input.sku))) return false
    if (input.barcode && ![product.barcode, ...variants.map((variant) => variant.barcode)].includes(input.barcode)) return false
    return !term || [product.name, product.sku, product.barcode, product.category?.name, ...variants.flatMap((variant) => [variant.name, variant.sku, variant.barcode])].some((value) => normalize(value).includes(term))
  })
}

function synchronize(scope: string): Promise<Snapshot> {
  const existing = pending.get(scope)
  if (existing) return existing
  const revision = revisions.get(scope) ?? 0
  const request = (async () => {
    const products: Product[] = []
    for (let page = 1; ; page++) {
      if (catalogScope() !== scope) throw new Error('A sessão do catálogo mudou.')
      const batch = await apiRequest<Product[]>(`/v1/products?limit=100&page=${page}`)
      if (catalogScope() !== scope) throw new Error('A sessão do catálogo mudou.')
      products.push(...batch)
      if (batch.length < 100) break
    }
    // A mutation during pagination makes this result obsolete.
    if ((revisions.get(scope) ?? 0) !== revision) {
      const current = memory.get(scope)
      if (current) return current
      throw new Error('O catálogo mudou durante a atualização. Tente novamente.')
    }
    const syncedAt = Date.now()
    const snapshot = { scope, products: [...new Map(products.map((product) => [product.id, product])).values()], syncedAt, lastSyncedAt: syncedAt }
    await persist(snapshot)
    window.dispatchEvent(new CustomEvent(CATALOG_UPDATED, { detail: scope }))
    return snapshot
  })().finally(() => pending.delete(scope))
  pending.set(scope, request)
  return request
}

export async function localProducts(input: ProductFilters = {}, force = false) {
  const scope = catalogScope()
  if (!scope) throw new Error('Selecione uma empresa para consultar o catálogo.')
  if (clearing.has(scope)) throw new Error('O catálogo local está sendo limpo.')
  const snapshot = await readSnapshot(scope)
  if (catalogScope() !== scope) throw new Error('A sessão do catálogo mudou.')
  if (snapshot && !force) {
    if (Date.now() - snapshot.syncedAt >= 60_000) void synchronize(scope).catch(() => undefined)
    return filterProducts(snapshot.products, input)
  }
  return filterProducts((await synchronize(scope)).products, input)
}

export async function updateLocalProduct(scope: string | null, product: Product) {
  if (!scope) return
  revisions.set(scope, (revisions.get(scope) ?? 0) + 1)
  const snapshot = await readSnapshot(scope)
  if (snapshot) {
    const products = snapshot.products.some((entry) => entry.id === product.id)
      ? snapshot.products.map((entry) => entry.id === product.id ? product : entry)
      : [product, ...snapshot.products]
    await persist({ ...snapshot, products, lastSyncedAt: snapshot.lastSyncedAt ?? snapshot.syncedAt, syncedAt: 0 })
  }
  window.dispatchEvent(new CustomEvent(CATALOG_UPDATED, { detail: scope }))
}

export async function expireLocalCatalog(scope: string | null) {
  if (!scope) return
  revisions.set(scope, (revisions.get(scope) ?? 0) + 1)
  const snapshot = await readSnapshot(scope)
  if (snapshot) await persist({ ...snapshot, lastSyncedAt: snapshot.lastSyncedAt ?? snapshot.syncedAt, syncedAt: 0 })
}

export async function localCatalogStats(scope: string) {
  const snapshot = await readSnapshot(scope)
  return {
    products: snapshot?.products.length ?? 0,
    variants: snapshot?.products.reduce((sum, product) => sum + product.variants.length, 0) ?? 0,
    bytes: snapshot ? new Blob([JSON.stringify(snapshot)]).size : 0,
    lastSyncedAt: snapshot?.lastSyncedAt ?? snapshot?.syncedAt ?? 0,
    persistent: Boolean(await openDatabase()),
    hasCatalog: Boolean(snapshot),
  }
}

export async function clearLocalCatalog(scope: string) {
  clearing.add(scope)
  revisions.set(scope, (revisions.get(scope) ?? 0) + 1)
  try {
    // Wait for an existing download so it cannot recreate the cleared snapshot.
    await pending.get(scope)?.catch(() => undefined)
    const db = await openDatabase()
    if (db) await new Promise<void>((resolve, reject) => {
      try {
        const transaction = db.transaction('catalogs', 'readwrite')
        transaction.objectStore('catalogs').delete(scope)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(new Error('Não foi possível limpar os dados locais.'))
        transaction.onabort = () => reject(new Error('Não foi possível limpar os dados locais.'))
      } catch { reject(new Error('Não foi possível limpar os dados locais.')) }
    })
    memory.delete(scope)
    window.dispatchEvent(new CustomEvent(CATALOG_CLEARED, { detail: scope }))
  } finally { clearing.delete(scope) }
}
