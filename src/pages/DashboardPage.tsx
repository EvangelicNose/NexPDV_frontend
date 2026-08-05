import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CircleDollarSign, ClipboardList, PackageX, RefreshCw, ShoppingBag, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'
import { apiRequest } from '../lib/api'

type Report = {
  period: { from: string; to: string; timezone: string }
  sales: { count: number; gross: string; refunded: string; net: string; averageTicket: string }
  salesByPeriod: Array<{ date: string; count: number; gross: string; net: string }>
  salesByPaymentMethod: Array<{ method: string; count: number; amount: string }>
  topProducts: Array<{ productId: string; name: string; quantity: string; total: string }>
  cancellations: { count: number; total: string }
  lowStock: Array<{ stockItemId: string; product: string; variant?: string; quantity: string; minimumQuantity: string }>
}
const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const currency = (value?: string) => Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const paymentNames: Record<string, string> = { CASH: 'Dinheiro', PIX: 'Pix', CREDIT_CARD: 'Crédito', DEBIT_CARD: 'Débito', VOUCHER: 'Voucher', OTHER: 'Outros' }

export function DashboardPage() {
  const { session } = useAuth()
  const establishment = session?.establishments[0]
  const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 6)
  const query = useQuery({
    queryKey: ['overview', establishment?.id, isoDate(from), isoDate(to)],
    enabled: Boolean(establishment),
    queryFn: () => apiRequest<Report>(`/v1/reports/overview?establishmentId=${establishment!.id}&from=${isoDate(from)}&to=${isoDate(to)}`),
  })
  const report = query.data
  const maxSale = Math.max(...(report?.salesByPeriod.map((item) => Number(item.net)) ?? [1]), 1)
  const firstName = session?.user.name.split(' ')[0]
  return <div className="dashboard page-enter">
    <div className="page-heading"><div><span className="eyebrow">Visão geral</span><h1>Bom trabalho, {firstName}.</h1><p>Acompanhe o pulso da sua operação nos últimos 7 dias.</p></div><button className="date-button"><CalendarDays size={18} /> Últimos 7 dias</button></div>
    {query.isError && <div className="notice error-notice"><div><strong>Não foi possível carregar os indicadores.</strong><span>Confirme se o backend está ativo e tente novamente.</span></div><button onClick={() => void query.refetch()}><RefreshCw size={16} /> Tentar novamente</button></div>}
    <section className="metric-grid">
      <MetricCard label="Vendas líquidas" value={query.isLoading ? '—' : currency(report?.sales.net)} icon={CircleDollarSign} tone="green" note="no período selecionado" />
      <MetricCard label="Pedidos pagos" value={query.isLoading ? '—' : String(report?.sales.count ?? 0)} icon={ClipboardList} tone="blue" note="vendas concluídas" />
      <MetricCard label="Ticket médio" value={query.isLoading ? '—' : currency(report?.sales.averageTicket)} icon={TrendingUp} tone="amber" note="por venda" />
      <MetricCard label="Estoque baixo" value={query.isLoading ? '—' : String(report?.lowStock.length ?? 0)} icon={PackageX} tone="coral" note="itens para revisar" />
    </section>
    <section className="dashboard-grid">
      <article className="panel sales-chart-panel"><div className="panel-head"><div><span className="panel-kicker">Desempenho</span><h2>Vendas por dia</h2></div><div className="chart-total"><small>Total líquido</small><strong>{currency(report?.sales.net)}</strong></div></div>
        <div className="bar-chart" aria-label="Gráfico de vendas por dia">{report?.salesByPeriod.length ? report.salesByPeriod.map((item) => <div className="bar-column" key={item.date}><div className="bar-value">{currency(item.net)}</div><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(Number(item.net) / maxSale * 100, 4)}%` }} /></div><span>{new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span></div>) : <EmptyChart />}</div>
      </article>
      <article className="panel payment-panel"><div className="panel-head"><div><span className="panel-kicker">Recebimentos</span><h2>Formas de pagamento</h2></div><Link to="/relatorios">Detalhes <ArrowRight size={15} /></Link></div><div className="payment-list">{report?.salesByPaymentMethod.length ? report.salesByPaymentMethod.map((payment, index) => { const total = Number(report.sales.gross) || 1; const share = Number(payment.amount) / total * 100; return <div className="payment-row" key={payment.method}><span className={`payment-dot payment-${index % 4}`} /><div><div><strong>{paymentNames[payment.method] ?? payment.method}</strong><span>{currency(payment.amount)}</span></div><div className="progress"><i style={{ width: `${share}%` }} /></div></div><small>{share.toFixed(0)}%</small></div> }) : <EmptyState text="Nenhum recebimento no período." />}</div></article>
      <article className="panel products-panel"><div className="panel-head"><div><span className="panel-kicker">Preferência dos clientes</span><h2>Produtos mais vendidos</h2></div><Link to="/catalogo">Ver catálogo <ArrowRight size={15} /></Link></div><div className="product-list">{report?.topProducts.length ? report.topProducts.slice(0, 5).map((product, index) => <div className="product-row" key={`${product.productId}-${index}`}><span className="product-rank">{String(index + 1).padStart(2, '0')}</span><div className="product-icon"><ShoppingBag size={18} /></div><div className="product-name"><strong>{product.name}</strong><small>{Number(product.quantity).toLocaleString('pt-BR')} unidades</small></div><strong>{currency(product.total)}</strong></div>) : <EmptyState text="As vendas aparecerão aqui." />}</div></article>
      <article className="panel attention-panel"><div className="panel-head"><div><span className="panel-kicker">Atenção</span><h2>Pontos da operação</h2></div></div><div className="attention-list"><div className="attention-item"><span className="attention-icon coral"><ArrowDownRight size={18} /></span><div><strong>{report?.lowStock.length ?? 0} itens com estoque baixo</strong><small>Confira antes do próximo turno</small></div><Link to="/estoque"><ArrowRight size={17} /></Link></div><div className="attention-item"><span className="attention-icon amber"><ArrowUpRight size={18} /></span><div><strong>{report?.cancellations.count ?? 0} cancelamentos</strong><small>{currency(report?.cancellations.total)} no período</small></div><Link to="/relatorios"><ArrowRight size={17} /></Link></div></div></article>
    </section>
  </div>
}

function MetricCard({ label, value, icon: Icon, tone, note }: { label: string; value: string; icon: typeof CircleDollarSign; tone: string; note: string }) { return <article className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={20} /></div><div className="metric-label">{label}</div><strong>{value}</strong><small>{note}</small></article> }
function EmptyState({ text }: { text: string }) { return <div className="empty-state"><ShoppingBag size={22} /><span>{text}</span></div> }
function EmptyChart() { return <div className="empty-chart">{[20,35,28,52,42,68,58].map((height, index) => <div className="bar-column muted" key={index}><div className="bar-track"><div className="bar-fill" style={{ height: `${height}%` }} /></div><span>—</span></div>)}<p>Sem vendas neste período.</p></div> }
