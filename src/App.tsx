import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { DashboardPage } from './pages/DashboardPage'
import { CompanyRegistrationPage } from './pages/CompanyRegistrationPage'
import { LoginPage } from './pages/LoginPage'
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
import { CatalogLayout } from './features/catalog/CatalogLayout'
import { CategoriesPage } from './pages/catalog/CategoriesPage'
import { NewProductPage } from './pages/catalog/NewProductPage'
import { OptionGroupsPage } from './pages/catalog/OptionGroupsPage'
import { ProductDetailsPage } from './pages/catalog/ProductDetailsPage'
import { ProductsPage } from './pages/catalog/ProductsPage'
import { StockLayout } from './features/stock/StockLayout'
import { StockAdjustmentPage } from './pages/stock/StockAdjustmentPage'
import { StockMovementsPage } from './pages/stock/StockMovementsPage'
import { StockOverviewPage } from './pages/stock/StockOverviewPage'
import { StockTransferPage } from './pages/stock/StockTransferPage'
import { TeamLayout } from './features/team/TeamLayout'
import { TeamMembersPage } from './pages/team/TeamMembersPage'
import { TeamRolesPage } from './pages/team/TeamRolesPage'
import { TeamUnitsPage } from './pages/team/TeamUnitsPage'
import { AdminLayout } from './components/layout/AdminLayout'
import { AdminOnlyRoute, TenantOnlyRoute } from './features/admin/AdminOnlyRoute'
import { AdminCompaniesPage } from './pages/admin/AdminCompaniesPage'
import { AdminCompanyDetailsPage } from './pages/admin/AdminCompanyDetailsPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { NewAdminCompanyPage } from './pages/admin/NewAdminCompanyPage'
import { EstablishmentSelectionPage } from './pages/EstablishmentSelectionPage'
import { ReportsPage } from './pages/reports/ReportsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<CompanyRegistrationPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="selecionar-unidade" element={<EstablishmentSelectionPage />} />
        <Route element={<TenantOnlyRoute />}><Route element={<AppLayout />}>
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
          <Route path="catalogo" element={<CatalogLayout />}>
            <Route index element={<ProductsPage />} />
            <Route path="categorias" element={<CategoriesPage />} />
            <Route path="adicionais" element={<OptionGroupsPage />} />
          </Route>
          <Route path="catalogo/novo" element={<NewProductPage />} />
          <Route path="catalogo/produtos/:id" element={<ProductDetailsPage />} />
          <Route path="estoque" element={<StockLayout />}>
            <Route index element={<StockOverviewPage />} />
            <Route path="movimentacoes" element={<StockMovementsPage />} />
            <Route path="transferencia" element={<StockTransferPage />} />
          </Route>
          <Route path="estoque/ajuste" element={<StockAdjustmentPage />} />
          <Route path="relatorios" element={<ReportsPage />} />
          <Route path="equipe" element={<TeamLayout />}>
            <Route index element={<TeamMembersPage />} />
            <Route path="papeis" element={<TeamRolesPage />} />
            <Route path="unidades" element={<TeamUnitsPage />} />
          </Route>
        </Route></Route>
        <Route element={<AdminOnlyRoute />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="empresas" element={<AdminCompaniesPage />} />
            <Route path="empresas/nova" element={<NewAdminCompanyPage />} />
            <Route path="empresas/:companyId" element={<AdminCompanyDetailsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
