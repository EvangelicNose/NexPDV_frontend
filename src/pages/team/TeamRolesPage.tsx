import { useQuery } from '@tanstack/react-query'
import { Check, RefreshCw, ShieldCheck } from 'lucide-react'
import { listTeamRoles } from '../../features/team/team.api'
import type { TeamRoleCode } from '../../features/team/team.types'

const names: Record<TeamRoleCode, string> = { COMPANY_OWNER: 'Proprietário', MANAGER: 'Gerente', CASHIER: 'Caixa', WAITER: 'Garçom', KITCHEN: 'Cozinha' }
const descriptions: Record<TeamRoleCode, string> = { COMPANY_OWNER: 'Acesso total à empresa e configurações.', MANAGER: 'Gerencia a operação, equipe e cadastros.', CASHIER: 'Opera caixa, pagamentos e vendas.', WAITER: 'Cria e acompanha pedidos e comandas.', KITCHEN: 'Acompanha e atualiza o preparo dos pedidos.' }

export function TeamRolesPage() {
  const roles = useQuery({ queryKey: ['team-roles'], queryFn: listTeamRoles })
  return <section className="roles-section"><div className="section-intro"><div><h2>Papéis de acesso</h2><p>Visualize o que cada função pode acessar no sistema.</p></div><span>{roles.data?.length ?? 0} papéis</span></div><div className="roles-grid">{(roles.data ?? []).map(role => <article className="role-card" key={role.id}><header><span><ShieldCheck size={20}/></span><div><h3>{names[role.code] ?? role.name}</h3><small>{role.system ? 'Papel padrão do sistema' : 'Papel personalizado'}</small></div></header><p>{descriptions[role.code] ?? role.description}</p><div className="permission-preview"><strong>{role.permissions.length} permissões</strong>{role.permissions.slice(0, 4).map(permission => <span key={permission}><Check size={12}/>{permission.replaceAll('.', ' · ')}</span>)}{role.permissions.length > 4 && <small>e mais {role.permissions.length - 4} permissões</small>}</div></article>)}</div>{roles.isLoading && <div className="orders-empty"><RefreshCw className="spin"/><span>Carregando papéis...</span></div>}{roles.isError && <div className="form-error team-error">Não foi possível carregar os papéis de acesso.</div>}</section>
}
