import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Clock3, CreditCard, RefreshCw, UserRound, XCircle } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getOrder } from '../../features/orders/orders.api'
import { OrderAdvanceButton } from '../../features/orders/OrderAdvanceButton'
import { CancelOrderModal } from '../../features/orders/CancelOrderModal'
import { useAuth } from '../../features/auth/auth-context'
import { orderStatus, orderType, type Order } from '../../features/orders/orders.types'
import { CheckoutModal } from '../../features/sales/CheckoutModal'
import { paymentMethodLabels, type Sale } from '../../features/sales/sales.types'

const money = (value: string) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
const date = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function OrderDetailsPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const { session } = useAuth()
  const query = useQuery({ queryKey: ['order', id], queryFn: () => getOrder(id), enabled: Boolean(id) })

  if (query.isLoading) return <div className="orders-empty"><RefreshCw className="spin"/><span>Carregando pedido...</span></div>
  if (!query.data) return <div className="order-not-found"><strong>Pedido não encontrado</strong><Link to="/pedidos">Voltar aos pedidos</Link></div>
  const order = query.data
  const status = orderStatus[order.status]
  const pendingPix = order.sale && ['PENDING_PAYMENT', 'PARTIALLY_PAID'].includes(order.sale.status)
  const canResumePix = Boolean(order.sale && !order.sale.finalizedAt && order.status !== 'CANCELLED' && (pendingPix || order.sale.payments.some(payment => payment.method === 'PIX')))
  const receivedPayments = order.sale?.payments.filter(payment => ['APPROVED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status)) ?? []
  const canCheckout = !order.sale && (order.status === 'READY' || order.status === 'DELIVERED')
  const cancelPermission = order.sale ? 'sale.refund' : 'order.cancel'
  const canCancel = !pendingPix && order.status !== 'CANCELLED' && (Boolean(order.sale) || order.status !== 'DELIVERED')
    && (session?.role === 'PLATFORM_ADMIN' || Boolean(session?.permissions?.includes(cancelPermission)))

  const checkoutSuccess = (sale: Sale) => {
    queryClient.setQueryData<Order>(['order', id], current => current ? {
      ...current,
      status: 'DELIVERED',
      deliveredAt: current.deliveredAt ?? new Date().toISOString(),
      sale: { id: sale.id, sequence: sale.sequence, status: sale.status, total: sale.total, createdAt: sale.createdAt, payments: sale.payments, finalizedAt: sale.finalizedAt, finalizedByUserId: sale.finalizedByUserId },
    } : current)
    void queryClient.invalidateQueries({ queryKey: ['orders'] })
    void queryClient.invalidateQueries({ queryKey: ['cash-sessions'] })
    void queryClient.invalidateQueries({ queryKey: ['stock'] })
    setCheckoutOpen(false)
  }

  return <>
    <section className="order-details page-enter">
      <Link className="back-link" to="/pedidos"><ArrowLeft size={16}/> Voltar aos pedidos</Link>
      <div className="detail-heading">
        <div><span className="eyebrow">Detalhes do pedido</span><h1>Pedido #{String(order.sequence).padStart(4, '0')}</h1><p>{orderType[order.type]} · criado em {date(order.createdAt)}</p></div>
        <div className="detail-heading-actions">{canCancel && <button type="button" className="cancel-order-button" onClick={() => setCancelOpen(true)}><XCircle size={17}/> Cancelar pedido</button>}<span className={`order-status ${status.className}`}>{status.label}</span>{canResumePix ? <button className="checkout-open-button" onClick={() => setCheckoutOpen(true)}><CreditCard size={17}/> {pendingPix ? 'Retomar pagamento Pix' : 'Ver pagamento Pix'}</button> : canCheckout ? <button className="checkout-open-button" onClick={() => setCheckoutOpen(true)}><CreditCard size={17}/> Receber e finalizar</button> : !order.sale && order.status !== 'DELIVERED' ? <OrderAdvanceButton order={order}/> : null}</div>
      </div>
      <div className="detail-grid">
        <div className="detail-main panel">
          <h2>Itens do pedido</h2>
          <div className="detail-items">{order.items.map(item => <div className="detail-item" key={item.id}><span>{Number(item.quantity)}×</span><div><strong>{item.productNameSnapshot}</strong>{item.variantNameSnapshot && <small>{item.variantNameSnapshot}</small>}{item.options.map(option => <small key={option.id}>+ {option.quantity}× {option.optionNameSnapshot}</small>)}</div><strong>{money(item.total)}</strong></div>)}</div>
          {order.notes && <div className="order-notes"><strong>Observações</strong><p>{order.notes}</p></div>}
          {order.status === 'CANCELLED' && <div className="order-notes"><strong>Motivo do cancelamento</strong><p>{order.cancellationReason ?? 'Não informado'}</p></div>}
        </div>
        <aside className="detail-side">
          <section className="panel"><h2><UserRound size={17}/> Cliente</h2><p>{String(order.customer?.name ?? 'Não informado')}</p></section>
          <section className="panel totals-panel"><h2>Valores</h2><dl><div><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div><div><dt>Adicionais</dt><dd>{money(order.additions)}</dd></div><div><dt>Descontos</dt><dd>- {money(order.discount)}</dd></div><div><dt>Taxas</dt><dd>{money(order.fees)}</dd></div><div className="summary-total"><dt>Total</dt><dd>{money(order.total)}</dd></div></dl></section>
          {order.sale ? <section className="panel sale-completed-card"><header><span><CheckCircle2 size={18}/></span><div><strong>Venda #{String(order.sale.sequence).padStart(4, '0')}</strong><small>{order.status === 'CANCELLED' ? 'Venda estornada' : pendingPix ? 'Pagamento pendente' : !order.sale.finalizedAt ? 'Pagamento confirmado · pedido pronto para finalização' : `Concluída em ${date(order.sale.createdAt)}`}</small></div></header><div>{receivedPayments.map(payment => <p key={payment.id}><span>{paymentMethodLabels[payment.method]}</span><strong>{money(payment.netAmount)}</strong></p>)}</div><footer><span>{order.status === 'CANCELLED' ? 'Total estornado' : 'Total líquido recebido'}</span><strong>{money(order.status === 'CANCELLED' ? order.sale.total : String(receivedPayments.reduce((sum, payment) => sum + Number(payment.netAmount), 0)))}</strong></footer></section> : <section className="panel detail-time"><Clock3 size={17}/><span><strong>Status atual</strong><small>{status.label}</small></span></section>}
        </aside>
      </div>
    </section>
    {checkoutOpen && <CheckoutModal orderId={order.id} total={order.total} establishmentId={order.establishmentId} saleId={order.sale?.id} onClose={() => setCheckoutOpen(false)} onSuccess={checkoutSuccess}/>}
    {cancelOpen && <CancelOrderModal order={order} onClose={() => setCancelOpen(false)}/>}
  </>
}
