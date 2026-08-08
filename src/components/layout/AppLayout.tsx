import { useState } from 'react'
import { BarChart3, Boxes, ChevronDown, CircleHelp, ClipboardList, LayoutDashboard, LogOut, Menu, PackageSearch, PanelLeftClose, PanelLeftOpen, RotateCcw, Search, ShieldCheck, Users, WalletCards, X } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../features/auth/auth-context'
import { Logo } from '../brand/Logo'

const navigation = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { to: '/caixa', label: 'Caixa', icon: WalletCards },
  { to: '/catalogo', label: 'Catálogo', icon: PackageSearch },
  { to: '/estoque', label: 'Estoque', icon: Boxes },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/equipe', label: 'Equipe', icon: Users },
]

export function AppLayout() {
  const { session, currentEstablishment, switchEstablishment, exitImpersonation, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  return <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
    <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <div className="sidebar-head"><Logo compact={collapsed} /><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={20} /></button></div>
      <nav className="navigation" aria-label="Navegação principal">
        {navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined}><Icon size={19} /><span>{label}</span></NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <a href="http://localhost:3333/docs" target="_blank" rel="noreferrer"><CircleHelp size={19} /><span>Central de ajuda</span></a>
        <button onClick={() => void logout()}><LogOut size={19} /><span>Sair da conta</span></button>
      </div>
    </aside>
    {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />}
    <div className="app-column">
      <header className="topbar">
        <div className="topbar-start">
          <button className="icon-button desktop-menu" onClick={() => setCollapsed((value) => !value)} aria-label="Alternar menu">{collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}</button>
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={21} /></button>
          <label className="establishment-switcher"><span className="store-indicator" /><span><small>Unidade atual</small><select aria-label="Trocar estabelecimento" value={currentEstablishment?.id ?? ''} onChange={(event) => switchEstablishment(event.target.value)} disabled={!session || session.establishments.length < 2}>{session?.establishments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></span><ChevronDown size={16} /></label>
        </div>
        <div className="topbar-end">
          {session?.impersonation?.active && <button className="return-admin-button" onClick={() => void exitImpersonation()}><ShieldCheck size={15}/><span>Modo de acesso</span><strong>Voltar ao console</strong><RotateCcw size={14}/></button>}
          <button className="search-button"><Search size={18} /><span>Buscar</span><kbd>⌘ K</kbd></button>
          <div className="user-avatar" title={session?.user.name}>{session?.user.name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div>
        </div>
      </header>
      <main className="main-content"><Outlet /></main>
    </div>
  </div>
}
