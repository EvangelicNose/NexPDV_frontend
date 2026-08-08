import { ArrowRight, Building2, Check, LogOut, MapPin, ShieldCheck, Star, Store } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/brand/Logo'
import { useAuth } from '../features/auth/auth-context'
import { readDefaultEstablishment, saveDefaultEstablishment } from '../lib/api'

export function EstablishmentSelectionPage() {
  const { session, switchEstablishment, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const initialDefault = session?.company ? readDefaultEstablishment(session.user.id, session.company.id) : null
  const [defaultId, setDefaultId] = useState<string | null>(initialDefault)
  if (!session) return <Navigate to="/login" replace/>
  if (session.role === 'PLATFORM_ADMIN') return <Navigate to="/admin" replace/>
  const destination = (location.state as { from?: string } | null)?.from || '/'
  const toggleDefault = (establishmentId: string) => {
    if (!session.company) return
    const next = defaultId === establishmentId ? null : establishmentId
    setDefaultId(next)
    saveDefaultEstablishment(session.user.id, session.company.id, next)
  }
  const connect = (establishmentId: string) => {
    switchEstablishment(establishmentId, defaultId === establishmentId)
    navigate(destination === '/selecionar-unidade' ? '/' : destination, { replace: true })
  }
  return <main className="unit-selection-page"><div className="unit-selection-orb one"/><div className="unit-selection-orb two"/><header><Logo/><button onClick={() => void logout()}><LogOut size={16}/> Sair</button></header><section className="unit-selection-content"><div className="unit-selection-heading"><span><Building2 size={20}/></span><small>{session.company?.tradeName}</small><h1>Em qual unidade você vai trabalhar?</h1><p>Escolha um estabelecimento para acessar a operação. Você poderá trocar de unidade depois.</p></div><div className="unit-selection-grid">{session.establishments.map((unit, index) => <article className="unit-choice-card" key={unit.id}><div className="unit-choice-top"><span><Store size={23}/></span><i>{String(index + 1).padStart(2, '0')}</i></div><h2>{unit.name}</h2><p><MapPin size={13}/> Unidade operacional</p><label className={defaultId === unit.id ? 'selected' : ''}><input type="checkbox" checked={defaultId === unit.id} onChange={() => toggleDefault(unit.id)}/><span><Check size={12}/></span><div><strong><Star size={12}/> Definir como padrão</strong><small>Entrar automaticamente nos próximos acessos</small></div></label><button onClick={() => connect(unit.id)}>Conectar nesta unidade <ArrowRight size={16}/></button></article>)}</div>{!session.establishments.length && <div className="unit-selection-empty"><ShieldCheck size={30}/><strong>Nenhuma unidade disponível</strong><p>Seu usuário ainda não possui acesso a um estabelecimento. Solicite acesso ao administrador da empresa.</p></div>}</section><footer>NexPDV · Ambiente seguro e monitorado</footer></main>
}
