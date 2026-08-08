import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Building2, Plus, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listAdminCompanies } from '../../features/admin/admin.api'

export function AdminCompaniesPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const companies = useQuery({ queryKey: ['admin-companies', status], queryFn: () => listAdminCompanies({ status: status || undefined }) })
  const term = search.trim().toLowerCase()
  const filtered = (companies.data ?? []).filter(item => !term || item.tradeName.toLowerCase().includes(term) || item.legalName.toLowerCase().includes(term) || item.document.includes(term))
  return <div className="admin-page page-enter"><div className="admin-page-heading"><div><span className="eyebrow">Gestão de tenants</span><h1>Empresas</h1><p>Cadastre empresas e gerencie suas estruturas e equipes.</p></div><Link className="admin-primary" to="/admin/empresas/nova"><Plus size={18}/> Nova empresa</Link></div><div className="admin-filters"><label><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar empresa ou documento"/></label><select value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos os status</option><option value="ACTIVE">Ativas</option><option value="INACTIVE">Inativas</option><option value="SUSPENDED">Suspensas</option></select><button onClick={() => void companies.refetch()}><RefreshCw size={17} className={companies.isFetching ? 'spin' : ''}/></button></div><div className="admin-companies-grid">{filtered.map(company => <Link to={`/admin/empresas/${company.id}`} className="admin-company-card" key={company.id}><header><span>{company.tradeName.slice(0, 2).toUpperCase()}</span><i className={company.status.toLowerCase()}>{company.status === 'ACTIVE' ? 'Ativa' : company.status === 'SUSPENDED' ? 'Suspensa' : 'Inativa'}</i></header><h2>{company.tradeName}</h2><p>{company.legalName}</p><dl><div><dt>Documento</dt><dd>{company.document}</dd></div><div><dt>Contato</dt><dd>{company.email}</dd></div></dl><footer><small>Cadastrada em {new Intl.DateTimeFormat('pt-BR').format(new Date(company.createdAt))}</small><ArrowRight size={17}/></footer></Link>)}</div>{companies.isLoading && <div className="admin-empty"><RefreshCw className="spin"/></div>}{!companies.isLoading && !filtered.length && <div className="admin-empty"><Building2 size={30}/><strong>Nenhuma empresa encontrada</strong><span>Ajuste os filtros ou faça um novo cadastro.</span></div>}</div>
}
