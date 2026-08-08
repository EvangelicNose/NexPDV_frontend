import { Building2, CircleHelp, Gauge, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../features/auth/auth-context'
import { Logo } from '../brand/Logo'

const navigation = [
  { to: '/admin', label: 'Visão geral', icon: Gauge, end: true },
  { to: '/admin/empresas', label: 'Empresas', icon: Building2 },
]

export function AdminLayout() {
  const { session, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  return <div className={`admin-shell ${collapsed ? 'is-collapsed' : ''}`}>
    <aside className={`admin-sidebar ${mobileOpen ? 'is-open' : ''}`}><div className="sidebar-head"><Logo compact={collapsed}/><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)}><X size={20}/></button></div><div className="admin-badge"><ShieldCheck size={15}/><span>Console da plataforma</span></div><nav className="navigation">{navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)}><Icon size={19}/><span>{label}</span></NavLink>)}</nav><div className="sidebar-bottom"><a href="http://localhost:3333/docs" target="_blank" rel="noreferrer"><CircleHelp size={19}/><span>Documentação da API</span></a><button onClick={() => void logout()}><LogOut size={19}/><span>Sair da conta</span></button></div></aside>
    {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)}/>}<div className="admin-column"><header className="admin-topbar"><div><button className="icon-button desktop-menu" onClick={() => setCollapsed(value => !value)}>{collapsed ? <PanelLeftOpen size={20}/> : <PanelLeftClose size={20}/>}</button><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={21}/></button><span className="admin-context"><ShieldCheck size={16}/><span><small>Ambiente</small>Administração global</span></span></div><div className="admin-user"><span><strong>{session?.user.name}</strong><small>Administrador da plataforma</small></span><i>{session?.user.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</i></div></header><main className="admin-content"><Outlet/></main></div>
  </div>
}
