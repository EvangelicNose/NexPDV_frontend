import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { RefreshCw, X, XCircle } from 'lucide-react'
import { ApiError } from '../../lib/api'
import { listCashSessions } from '../cash/cash.api'
import { cancelSale } from '../sales/sales.api'
import { cancelOrder } from './orders.api'
import type { Order } from './orders.types'

export function CancelOrderModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const queryClient = useQueryClient()
  const dialog = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [cashRegisterSessionId, setCashRegisterSessionId] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const needsCash = Boolean(order.sale?.payments.some(payment => payment.method === 'CASH' && payment.status !== 'REFUNDED' && Number(payment.amount) > 0))
  const sessions = useQuery({
    queryKey: ['cash-sessions', 'open', order.establishmentId],
    queryFn: () => listCashSessions(order.establishmentId, 'OPEN'),
    enabled: needsCash,
  })
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  const mutation = useMutation({
    mutationFn: async () => {
      if (order.sale) {
        const sale = await cancelSale(order.sale.id, {
          reason: reason.trim(),
          ...(needsCash && { cashRegisterSessionId }),
        }, idempotencyKey)
        return { ...order, status: 'CANCELLED' as const, cancellationReason: reason.trim(), sale }
      }
      return cancelOrder(order.id, reason.trim(), idempotencyKey)
    },
    onSuccess: updated => {
      queryClient.setQueryData(['order', order.id], updated)
      for (const key of ['order', 'orders', 'orders-board', 'cash-sessions', 'cash-session', 'stock', 'stock-movements', 'sales', 'reports-overview', 'tabs']) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
      onClose()
    },
  })
  const valid = reason.trim().length >= 3 && reason.trim().length <= 500 && (!needsCash || Boolean(sessions.data?.some(session => session.id === cashRegisterSessionId)))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (valid && !mutation.isPending) mutation.mutate()
  }
  const changeInput = () => {
    mutation.reset()
    setIdempotencyKey(crypto.randomUUID())
  }
  return <dialog ref={dialog} className="checkout-modal cancel-order-modal" aria-labelledby="cancel-order-title" onCancel={event => { event.preventDefault(); if (!mutation.isPending) onClose() }}>
    <header><span><XCircle size={21}/></span><div><h2 id="cancel-order-title">Cancelar pedido #{String(order.sequence).padStart(4, '0')}</h2><p>{order.sale ? 'O saldo dos pagamentos será estornado e o estoque será devolvido.' : 'Confirme o cancelamento deste pedido.'}</p></div><button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Fechar"><X size={19}/></button></header>
    <form onSubmit={submit}>
      <div className="checkout-fields">
        <label className="checkout-wide" htmlFor="cancel-order-reason">Motivo do cancelamento<textarea id="cancel-order-reason" autoFocus required minLength={3} maxLength={500} rows={4} value={reason} disabled={mutation.isPending} onChange={event => { setReason(event.target.value); changeInput() }}/><small>Informe entre 3 e 500 caracteres.</small></label>
        {needsCash && <label className="checkout-wide" htmlFor="cancel-order-cash">Caixa para devolução em dinheiro<select id="cancel-order-cash" required value={cashRegisterSessionId} disabled={mutation.isPending || sessions.isLoading} onChange={event => { setCashRegisterSessionId(event.target.value); changeInput() }}><option value="">{sessions.isLoading ? 'Carregando caixas...' : 'Selecione um caixa aberto'}</option>{sessions.data?.map(session => <option key={session.id} value={session.id}>{session.cashRegister.name} · {session.cashRegister.code}</option>)}</select>{sessions.isError ? <small role="alert">Não foi possível carregar os caixas. <button type="button" onClick={() => void sessions.refetch()}>Tentar novamente</button></small> : !sessions.isLoading && !sessions.data?.length ? <small role="alert">Abra um caixa neste estabelecimento para devolver o dinheiro.</small> : null}</label>}
      </div>
      {mutation.isError && <div className="form-error" role="alert">{mutation.error instanceof ApiError ? mutation.error.message : 'Não foi possível cancelar o pedido. Tente novamente.'}</div>}
      <footer><button type="button" className="secondary-button" onClick={onClose} disabled={mutation.isPending}>Voltar</button><button type="submit" className="cancel-order-button" disabled={!valid || mutation.isPending}>{mutation.isPending ? <RefreshCw size={16} className="spin"/> : <XCircle size={16}/>} {mutation.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}</button></footer>
    </form>
  </dialog>
}
