import { useQuery } from '@tanstack/react-query'
import { Clock3, Database, HardDrive, Info, Layers, LoaderCircle, PackageSearch, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SettingsTabs } from './SettingsTabs'
import { useAuth } from '../../features/auth/auth-context'
import { CATALOG_CLEARED, CATALOG_UPDATED, catalogScope, clearLocalCatalog, localCatalogStats, localProducts } from '../../features/catalog/catalog-local'
import './settings.css'

const size = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB` : `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MB`

export function LocalDataPage() {
  const { session, currentEstablishment } = useAuth()
  const scope = catalogScope()
  const [action, setAction] = useState<'sync' | 'clear' | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [feedback, setFeedback] = useState<{ scope: string; error: boolean; text: string } | null>(null)
  const stats = useQuery({ queryKey: ['local-catalog-stats', scope], queryFn: () => localCatalogStats(scope!), enabled: Boolean(scope), refetchInterval: 15_000 })
  const { refetch } = stats
  useEffect(() => {
    setConfirmClear(false)
    const refresh = (event: Event) => {
      if ((event as CustomEvent<string>).detail === scope) void refetch()
    }
    window.addEventListener(CATALOG_UPDATED, refresh)
    window.addEventListener(CATALOG_CLEARED, refresh)
    return () => {
      window.removeEventListener(CATALOG_UPDATED, refresh)
      window.removeEventListener(CATALOG_CLEARED, refresh)
    }
  }, [scope, refetch])

  const run = async (next: 'sync' | 'clear') => {
    if (!scope) return
    setAction(next)
    setFeedback(null)
    try {
      if (next === 'sync') await localProducts({}, true)
      else await clearLocalCatalog(scope)
      setFeedback({ scope, error: false, text: next === 'sync' ? 'Catálogo atualizado com sucesso.' : 'Catálogo local limpo com sucesso.' })
      await stats.refetch()
    } catch {
      setFeedback({ scope, error: true, text: next === 'sync' ? 'Não foi possível sincronizar. Verifique a conexão e tente novamente. O catálogo já salvo continua disponível.' : 'Não foi possível limpar o catálogo local. Tente novamente.' })
    } finally { setAction(null); setConfirmClear(false) }
  }

  const data = stats.data
  return <div className="settings-page page-enter">
    <div className="catalog-heading"><div><span className="eyebrow">Preferências e operação</span><h1>Configurações</h1><p>Gerencie as configurações do seu estabelecimento.</p></div></div>
    <SettingsTabs/>
    <section className="settings-local-panel">
      <header className="settings-local-heading"><span className="settings-icon"><Database size={24} /></span><div><h2>Dados locais</h2><p>Consulte produtos rapidamente com o catálogo salvo neste navegador.</p></div><span className="settings-status">{stats.isLoading ? 'Carregando' : data?.hasCatalog ? 'Catálogo disponível' : 'Sem catálogo local'}</span></header>
      <div className="settings-scope"><strong>{session?.company?.tradeName}</strong><span>{currentEstablishment?.name} · {session?.user.name}</span></div>
      {stats.isError && <div className="form-error" role="alert">Não foi possível consultar os dados locais. <button type="button" onClick={() => void stats.refetch()}>Tentar novamente</button></div>}
      <div className="settings-metrics">
        <article><PackageSearch size={20} /><small>Produtos salvos</small><strong>{data?.products ?? '—'}</strong></article>
        <article><Layers size={20} /><small>Variações salvas</small><strong>{data?.variants ?? '—'}</strong></article>
        <article><HardDrive size={20} /><small>Tamanho estimado</small><strong>{data ? size(data.bytes) : '—'}</strong></article>
        <article><Clock3 size={20} /><small>Última sincronização</small><strong className="settings-date">{data?.lastSyncedAt ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(data.lastSyncedAt) : 'Ainda não sincronizado'}</strong></article>
      </div>
      {feedback?.scope === scope && <div className={`settings-feedback ${feedback.error ? 'error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</div>}
      <div className="settings-data-actions">
        <article><div><h3>Atualizar catálogo</h3><p>Baixe a versão mais recente dos produtos, variações e preços. O catálogo também é atualizado automaticamente em segundo plano.</p></div><button className="primary-button" type="button" disabled={Boolean(action) || !scope} onClick={() => void run('sync')}>{action === 'sync' ? <LoaderCircle size={17} className="spin" /> : <RefreshCw size={17} />}{action === 'sync' ? 'Atualizando...' : 'Atualizar agora'}</button></article>
        <article><div><h3>Limpar catálogo local</h3><p>Remova a cópia desta empresa, unidade e usuário neste navegador. Os dados serão baixados novamente na próxima consulta ou atualização automática.</p></div><button className="settings-danger-button" type="button" disabled={Boolean(action) || !data?.hasCatalog} onClick={() => setConfirmClear(true)}><Trash2 size={17} /> Limpar dados locais</button></article>
        {confirmClear && <div className="settings-clear-confirm" role="group" aria-label="Confirmar limpeza"><p>Limpar a cópia local de {currentEstablishment?.name}? Para consultar os produtos novamente, será necessário acesso à internet.</p><div><button className="secondary-button" type="button" disabled={Boolean(action)} onClick={() => setConfirmClear(false)}>Cancelar</button><button className="settings-danger-button" type="button" disabled={Boolean(action)} onClick={() => void run('clear')}>{action === 'clear' ? <LoaderCircle size={17} className="spin" /> : <Trash2 size={17} />} Confirmar limpeza</button></div></div>}
      </div>
      <div className="settings-info"><Info size={18} /><div><p>A limpeza preserva os produtos, pedidos e vendas do servidor e mantém sua sessão conectada.</p><p>O tamanho exibido estima os dados do catálogo, sem imagens e sem o espaço interno usado pelo banco. A confirmação de pedidos exige conexão.</p>{data && !data.persistent && <p>O armazenamento persistente não está disponível. O catálogo está sendo mantido apenas na memória desta sessão.</p>}</div></div>
    </section>
  </div>
}
