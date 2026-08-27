import { useMutation, useQuery } from '@tanstack/react-query'
import { type FormEvent, useMemo, useState } from 'react'
import { Banknote, CheckCircle2, CircleAlert, CreditCard, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { listCashSessions } from '../cash/cash.api'
import { ApiError } from '../../lib/api'
import { checkoutOrder } from './sales.api'
import { paymentMethodLabels, type PaymentMethod, type Sale } from './sales.types'

type PaymentDraft = {
  key: string
  method: PaymentMethod
  amount: string
  receivedAmount: string
  cashRegisterSessionId: string
  providerReference: string
}

const methods = Object.keys(paymentMethodLabels) as PaymentMethod[]
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const parseMoney = (value: string) => {
  const compact = value.trim().replace(/\s/g, '')
  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(compact) ? compact.replace(/\./g, '') : compact
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}
const formatInput = (value: number) => value.toFixed(2).replace('.', ',')
const newPayment = (amount: number): PaymentDraft => ({
  key: crypto.randomUUID(),
  method: 'PIX',
  amount: formatInput(Math.max(amount, 0)),
  receivedAmount: '',
  cashRegisterSessionId: '',
  providerReference: '',
})

export function CheckoutModal({ orderId, total, onClose, onSuccess }: { orderId: string; total: string; onClose: () => void; onSuccess: (sale: Sale) => void }) {
  const { currentEstablishment } = useAuth()
  const target = Number(total)
  const [payments, setPayments] = useState<PaymentDraft[]>(() => [newPayment(target)])
  const [validationError, setValidationError] = useState('')
  const cashSessions = useQuery({
    queryKey: ['cash-sessions', 'open', currentEstablishment?.id],
    queryFn: () => listCashSessions(currentEstablishment!.id, 'OPEN'),
    enabled: Boolean(currentEstablishment?.id),
  })
  const paid = useMemo(() => payments.reduce((sum, payment) => sum + (parseMoney(payment.amount) ?? 0), 0), [payments])
  const difference = Math.round((target - paid) * 100) / 100
  const mutation = useMutation({ mutationFn: (input: Parameters<typeof checkoutOrder>[1]) => checkoutOrder(orderId, input), onSuccess })

  const update = (key: string, changes: Partial<PaymentDraft>) => {
    setPayments(current => current.map(payment => payment.key === key ? { ...payment, ...changes } : payment))
    setValidationError('')
    mutation.reset()
  }
  const addPayment = () => setPayments(current => [...current, newPayment(Math.max(difference, 0))])
  const removePayment = (key: string) => setPayments(current => current.filter(payment => payment.key !== key))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setValidationError('')
    mutation.reset()
    if (payments.some(payment => parseMoney(payment.amount) === null)) {
      setValidationError('Informe um valor válido e maior que zero em todos os pagamentos.')
      return
    }
    if (Math.abs(difference) >= 0.01) {
      setValidationError('A soma dos pagamentos precisa ser exatamente igual ao total do pedido.')
      return
    }
    if (payments.some(payment => payment.method === 'CASH' && !payment.cashRegisterSessionId)) {
      setValidationError('Selecione um caixa aberto para o pagamento em dinheiro.')
      return
    }
    if (payments.some(payment => payment.method === 'CASH' && (
      parseMoney(payment.receivedAmount) === null ||
      parseMoney(payment.receivedAmount)! < parseMoney(payment.amount)!
    ))) {
      setValidationError('O valor recebido em dinheiro deve ser igual ou maior que o valor a cobrar.')
      return
    }
    mutation.mutate(payments.map(payment => ({
      method: payment.method,
      amount: parseMoney(payment.amount)!.toFixed(2),
      ...(payment.method === 'CASH' && { cashRegisterSessionId: payment.cashRegisterSessionId }),
      ...(payment.providerReference.trim() && { providerReference: payment.providerReference.trim() }),
    })))
  }
  const serverError = mutation.error instanceof ApiError
    ? mutation.error.message
    : mutation.isError ? 'Não foi possível concluir a venda. Tente novamente.' : ''

  return <div className="checkout-backdrop" role="presentation" onMouseDown={() => !mutation.isPending && onClose()}>
    <div className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onMouseDown={event => event.stopPropagation()}>
      <header><span><CreditCard size={21}/></span><div><h2 id="checkout-title">Receber e finalizar</h2><p>Informe como o cliente realizou o pagamento.</p></div><button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Fechar"><X size={19}/></button></header>
      <form onSubmit={submit} noValidate>
        <div className="checkout-total"><span>Total do pedido</span><strong>{money(target)}</strong></div>
        <section className="checkout-payments">
          <div className="checkout-section-title"><div><strong>Formas de pagamento</strong><small>Você pode dividir o valor entre vários meios.</small></div><button type="button" onClick={addPayment}><Plus size={15}/> Adicionar</button></div>
          {payments.map((payment, index) => {
            const cashAmount = parseMoney(payment.amount) ?? 0
            const received = parseMoney(payment.receivedAmount)
            const change = received === null ? null : Math.round((received - cashAmount) * 100) / 100
            return <article key={payment.key}>
            <div className="checkout-payment-number"><span>{payment.method === 'CASH' ? <Banknote size={17}/> : <CreditCard size={17}/>}</span><strong>Pagamento {index + 1}</strong>{payments.length > 1 && <button type="button" onClick={() => removePayment(payment.key)} aria-label="Remover pagamento"><Trash2 size={15}/></button>}</div>
            <div className="checkout-fields">
              <label><span>Forma</span><select value={payment.method} onChange={event => { const method = event.target.value as PaymentMethod; update(payment.key, { method, cashRegisterSessionId: '', receivedAmount: method === 'CASH' ? payment.amount : '' }) }}>{methods.map(method => <option value={method} key={method}>{paymentMethodLabels[method]}</option>)}</select></label>
              <label><span>Valor a cobrar</span><div className="checkout-money"><span>R$</span><input inputMode="decimal" value={payment.amount} onChange={event => update(payment.key, { amount: event.target.value })}/></div></label>
              {payment.method === 'CASH' && <div className="checkout-cash-received checkout-wide"><label><span>Valor recebido</span><div className="checkout-money"><span>R$</span><input inputMode="decimal" autoComplete="off" value={payment.receivedAmount} onChange={event => update(payment.key, { receivedAmount: event.target.value })} placeholder="0,00"/></div></label><div className={`checkout-change ${change != null && change >= 0 ? 'valid' : 'invalid'}`}><span>Troco</span><strong>{change == null || change < 0 ? '—' : money(change)}</strong>{change != null && change < 0 && <small>Valor recebido insuficiente</small>}</div></div>}
              {payment.method === 'CASH' && <label className="checkout-wide"><span>Caixa aberto</span><select value={payment.cashRegisterSessionId} onChange={event => update(payment.key, { cashRegisterSessionId: event.target.value })}><option value="">Selecione o caixa</option>{(cashSessions.data ?? []).map(session => <option value={session.id} key={session.id}>{session.cashRegister.name} · {session.cashRegister.code}</option>)}</select>{!cashSessions.isLoading && !cashSessions.data?.length && <small>Nenhum caixa aberto nesta unidade.</small>}</label>}
              {payment.method !== 'CASH' && <label className="checkout-wide"><span>Referência <small>Opcional</small></span><input value={payment.providerReference} onChange={event => update(payment.key, { providerReference: event.target.value })} placeholder="Ex.: NSU, código Pix ou autorização"/></label>}
            </div>
          </article>})}
        </section>
        <div className={`checkout-balance ${Math.abs(difference) < 0.01 ? 'matched' : 'pending'}`}><span>{Math.abs(difference) < 0.01 ? <CheckCircle2 size={17}/> : <CircleAlert size={17}/>} {difference > 0 ? 'Falta receber' : difference < 0 ? 'Valor excedente' : 'Pagamento conferido'}</span><strong>{money(Math.abs(difference))}</strong></div>
        {(validationError || serverError) && <div className="form-error" role="alert">{validationError || serverError}</div>}
        <footer><button type="button" className="secondary-button" onClick={onClose} disabled={mutation.isPending}>Cancelar</button><button className="primary-button" disabled={mutation.isPending || Math.abs(difference) >= 0.01}>{mutation.isPending ? <RefreshCw size={17} className="spin"/> : <CheckCircle2 size={17}/>} {mutation.isPending ? 'Finalizando venda...' : 'Confirmar pagamento'}</button></footer>
      </form>
    </div>
  </div>
}
