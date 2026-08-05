import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { ModulePage } from './pages/ModulePage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="pedidos" element={<ModulePage title="Pedidos" description="Acompanhe o salão, balcão, retirada e delivery em um só fluxo." />} />
          <Route path="caixa" element={<ModulePage title="Caixa" description="Sessões, movimentações, sangrias e fechamento operacional." />} />
          <Route path="catalogo" element={<ModulePage title="Catálogo" description="Produtos, variações, adicionais, preços e disponibilidade." />} />
          <Route path="estoque" element={<ModulePage title="Estoque" description="Saldos, movimentações, ajustes e alertas de reposição." />} />
          <Route path="relatorios" element={<ModulePage title="Relatórios" description="Indicadores comerciais e operacionais por período." />} />
          <Route path="equipe" element={<ModulePage title="Equipe" description="Usuários, unidades, papéis e permissões." />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
