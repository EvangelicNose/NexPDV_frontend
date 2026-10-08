import { Database, QrCode } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export function SettingsTabs() {
  return <nav className="orders-tabs" aria-label="Áreas de configurações">
    <NavLink to="/configuracoes/dados-locais"><Database size={16}/> Dados locais</NavLink>
    <NavLink to="/configuracoes/pix"><QrCode size={16}/> Pix</NavLink>
  </nav>
}
