import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Plus, RefreshCw, Search, UserRoundPlus, Users, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../../features/auth/auth-context'
import { inviteTeamMember, listTeamMembers } from '../../features/team/team.api'
import type { TeamRoleCode } from '../../features/team/team.types'

const roleLabels: Record<TeamRoleCode, string> = { COMPANY_OWNER: 'Proprietário', MANAGER: 'Gerente', CASHIER: 'Caixa', WAITER: 'Garçom', KITCHEN: 'Cozinha' }
const statusLabels = { ACTIVE: 'Ativo', INVITED: 'Convite pendente', SUSPENDED: 'Suspenso' }

export function TeamMembersPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'WAITER' as TeamRoleCode, establishmentIds: [] as string[] })
  const members = useQuery({ queryKey: ['team-members', status], queryFn: () => listTeamMembers({ status: status || undefined }) })
  const invite = useMutation({
    mutationFn: inviteTeamMember,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team-members'] })
      setInviteOpen(false)
      setForm({ name: '', email: '', role: 'WAITER', establishmentIds: [] })
    },
  })
  const term = search.trim().toLowerCase()
  const filtered = (members.data ?? []).filter(member => !term || member.name.toLowerCase().includes(term) || member.email.toLowerCase().includes(term))
  const toggleEstablishment = (id: string) => setForm(current => ({ ...current, establishmentIds: current.establishmentIds.includes(id) ? current.establishmentIds.filter(item => item !== id) : [...current.establishmentIds, id] }))
  const submit = (event: FormEvent) => { event.preventDefault(); invite.mutate(form) }

  return <section>
    <div className="team-toolbar">
      <label className="order-search"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome ou e-mail"/></label>
      <select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filtrar por status"><option value="">Todos os status</option><option value="ACTIVE">Ativos</option><option value="INVITED">Convites pendentes</option><option value="SUSPENDED">Suspensos</option></select>
      <button className="refresh-button" onClick={() => void members.refetch()} aria-label="Atualizar"><RefreshCw size={17} className={members.isFetching ? 'spin' : ''}/></button>
      <button className="new-order-button" onClick={() => { setForm(current => ({ ...current, establishmentIds: session?.establishments.map(item => item.id) ?? [] })); setInviteOpen(true) }}><Plus size={18}/> Convidar membro</button>
    </div>
    <div className="team-summary">
      <div><span className="team-summary-icon"><Users size={19}/></span><p><strong>{members.data?.length ?? 0}</strong><small>Membros cadastrados</small></p></div>
      <div><span className="team-summary-icon pending"><Mail size={19}/></span><p><strong>{members.data?.filter(item => item.status === 'INVITED').length ?? 0}</strong><small>Convites pendentes</small></p></div>
    </div>
    <div className="team-table-wrap"><table className="team-table"><thead><tr><th>Membro</th><th>Função</th><th>Unidades</th><th>Status</th><th>Desde</th></tr></thead><tbody>{filtered.map(member => <tr key={member.id}><td><div className="member-cell"><span>{member.name.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span><div><strong>{member.name}</strong><small>{member.email}</small></div></div></td><td>{roleLabels[member.role] ?? member.role}</td><td><div className="unit-chips">{member.establishments.slice(0, 2).map(item => <span key={item.id}>{item.name}</span>)}{member.establishments.length > 2 && <span>+{member.establishments.length - 2}</span>}</div></td><td><i className={`team-status ${member.status.toLowerCase()}`}>{statusLabels[member.status]}</i></td><td>{new Intl.DateTimeFormat('pt-BR').format(new Date(member.createdAt))}</td></tr>)}</tbody></table></div>
    {members.isLoading && <div className="orders-empty"><RefreshCw className="spin"/><span>Carregando equipe...</span></div>}
    {!members.isLoading && !filtered.length && <div className="orders-empty"><Users size={32}/><strong>Nenhum membro encontrado</strong><span>Ajuste os filtros ou convide uma pessoa para a equipe.</span></div>}
    {members.isError && <div className="form-error team-error">Não foi possível carregar a equipe. Verifique se sua conta tem permissão de gestão.</div>}

    {inviteOpen && <div className="team-modal-backdrop" role="presentation" onMouseDown={() => setInviteOpen(false)}><div className="team-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title" onMouseDown={event => event.stopPropagation()}><header><span><UserRoundPlus size={20}/></span><div><h2 id="invite-title">Convidar novo membro</h2><p>O convite será enviado para o e-mail informado.</p></div><button onClick={() => setInviteOpen(false)} aria-label="Fechar"><X size={19}/></button></header><form onSubmit={submit}><label className="team-field"><span>Nome completo</span><input required minLength={2} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Maria Oliveira"/></label><label className="team-field"><span>E-mail</span><input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="maria@empresa.com"/></label><label className="team-field"><span>Função</span><select value={form.role} onChange={event => setForm({ ...form, role: event.target.value as TeamRoleCode })}>{Object.entries(roleLabels).filter(([code]) => code !== 'COMPANY_OWNER').map(([code, label]) => <option value={code} key={code}>{label}</option>)}</select></label><fieldset className="team-establishments"><legend>Unidades de acesso</legend>{session?.establishments.map(item => <label key={item.id}><input type="checkbox" checked={form.establishmentIds.includes(item.id)} onChange={() => toggleEstablishment(item.id)}/><span>{item.name}</span></label>)}</fieldset>{invite.isError && <div className="form-error">Não foi possível enviar o convite. Revise os dados e tente novamente.</div>}<footer><button type="button" className="secondary-button" onClick={() => setInviteOpen(false)}>Cancelar</button><button className="primary-button" disabled={invite.isPending || !form.establishmentIds.length}>{invite.isPending && <RefreshCw size={16} className="spin"/>} Enviar convite</button></footer></form></div></div>}
  </section>
}
