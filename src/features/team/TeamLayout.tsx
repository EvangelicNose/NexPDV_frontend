import { Building2, ShieldCheck, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

export function TeamLayout() {
  return <div className="team-module page-enter">
    <div className="team-heading">
      <div><span className="eyebrow">Pessoas e acessos</span><h1>Equipe</h1><p>Gerencie membros, funções e unidades de trabalho.</p></div>
    </div>
    <nav className="orders-tabs" aria-label="Seções da equipe">
      <NavLink to="/equipe" end><Users size={16}/> Membros</NavLink>
      <NavLink to="/equipe/papeis"><ShieldCheck size={16}/> Papéis e permissões</NavLink>
      <NavLink to="/equipe/unidades"><Building2 size={16}/> Unidades</NavLink>
    </nav>
    <Outlet />
  </div>
}
