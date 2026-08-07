import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { DashboardPage } from './pages/DashboardPage'
import { CompanyRegistrationPage } from './pages/CompanyRegistrationPage'
import { LoginPage } from './pages/LoginPage'
import { ModulePage } from './pages/ModulePage'
import { OrdersLayout } from './features/orders/OrdersLayout'
import { OrderDetailsPage } from './pages/orders/OrderDetailsPage'
import { NewOrderPage } from './pages/orders/NewOrderPage'
import { OrdersBoardPage } from './pages/orders/OrdersBoardPage'
import { OrdersPage } from './pages/orders/OrdersPage'
import { CashLayout } from './features/cash/CashLayout'
import { CashHistoryPage } from './pages/cash/CashHistoryPage'
import { CashOverviewPage } from './pages/cash/CashOverviewPage'
import { CashRegistersPage } from './pages/cash/CashRegistersPage'
import { CashSessionDetailsPage } from './pages/cash/CashSessionDetailsPage'
import { OpenCashPage } from './pages/cash/OpenCashPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<CompanyRegistrationPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="pedidos" element={<OrdersLayout />}>
            <Route index element={<OrdersPage />} />
            <Route path="quadro" element={<OrdersBoardPage />} />
          </Route>
          <Route path="pedidos/novo" element={<NewOrderPage />} />
          <Route path="pedidos/:id" element={<OrderDetailsPage />} />
          <Route path="caixa" element={<CashLayout />}>
            <Route index element={<CashOverviewPage />} />
            <Route path="historico" element={<CashHistoryPage />} />
            <Route path="terminais" element={<CashRegistersPage />} />
          </Route>
          <Route path="caixa/abrir" element={<OpenCashPage />} />
          <Route path="caixa/sessoes/:id" element={<CashSessionDetailsPage />} />
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
