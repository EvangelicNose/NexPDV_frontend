import { ArrowLeftRight, ClipboardPen, History, PackageOpen, PackagePlus } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

export function StockLayout() {
  return <div className="stock-module page-enter">
    <div className="stock-heading"><div><span className="eyebrow">Controle operacional</span><h1>Estoque</h1><p>Acompanhe saldos, entradas, saídas e necessidades de reposição.</p></div><div className="stock-heading-actions"><NavLink className="stock-secondary-action" to="/estoque/ajuste"><ClipboardPen size={17}/> Ajustar</NavLink><NavLink className="new-order-button" to="/estoque/entrada"><PackagePlus size={18}/> Nova entrada</NavLink></div></div>
    <nav className="orders-tabs"><NavLink to="/estoque" end><PackageOpen size={16}/> Posição atual</NavLink><NavLink to="/estoque/movimentacoes"><History size={16}/> Movimentações</NavLink><NavLink to="/estoque/transferencia"><ArrowLeftRight size={16}/> Transferir</NavLink></nav>
    <Outlet/>
  </div>
}
