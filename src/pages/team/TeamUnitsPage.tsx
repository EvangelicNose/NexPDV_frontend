import { useQuery } from '@tanstack/react-query'
import { Building2, MapPin, RefreshCw, Users } from 'lucide-react'
import { listTeamEstablishments, listTeamMembers } from '../../features/team/team.api'

export function TeamUnitsPage() {
  const units = useQuery({ queryKey: ['team-establishments'], queryFn: listTeamEstablishments })
  const members = useQuery({ queryKey: ['team-members'], queryFn: () => listTeamMembers() })
  return <section className="units-section"><div className="section-intro"><div><h2>Unidades da equipe</h2><p>Acompanhe a distribuição de pessoas entre os estabelecimentos.</p></div><span>{units.data?.length ?? 0} unidades</span></div><div className="units-grid">{(units.data ?? []).map(unit => { const total = (members.data ?? []).filter(member => member.establishments.some(item => item.id === unit.id)).length; return <article className="unit-card" key={unit.id}><header><span><Building2 size={21}/></span><i className={unit.status.toLowerCase()}>{unit.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}</i></header><h3>{unit.name}</h3><p><MapPin size={13}/>{unit.address?.city ? `${unit.address.city}${unit.address.state ? `, ${unit.address.state}` : ''}` : `Código ${unit.code}`}</p><footer><Users size={15}/><strong>{total}</strong><span>{total === 1 ? 'membro com acesso' : 'membros com acesso'}</span></footer></article> })}</div>{units.isLoading && <div className="orders-empty"><RefreshCw className="spin"/><span>Carregando unidades...</span></div>}{units.isError && <div className="form-error team-error">Não foi possível carregar as unidades.</div>}</section>
}
