import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, RefreshCw, WalletCards, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { closeCashSession, createCashMovement, getCashSession } from '../../features/cash/cash.api'
import { movementLabels, type CashMovementType, type CashSession } from '../../features/cash/cash.types'
import { ApiError } from '../../lib/api'

const money = (value?: string | number | null) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))
const date = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const parseMoney = (value: string) => {
  const compact = value.trim().replace(/\s/g, '')
  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(compact) ? compact.replace(/\./g, '') : compact
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount >= 0 ? amount.toFixed(2) : null
}

export function CashSessionDetailsPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const [closeOpen, setCloseOpen] = useState(false)
  const [countedAmount, setCountedAmount] = useState('')
  const [validationError, setValidationError] = useState('')
  const [movementType, setMovementType] = useState<Extract<CashMovementType, 'DEPOSIT' | 'WITHDRAWAL'> | null>(null)
  const [movementAmount, setMovementAmount] = useState('')
  const [movementReason, setMovementReason] = useState('')
  const [movementValidationError, setMovementValidationError] = useState('')
  const query = useQuery({ queryKey: ['cash-session', id], queryFn: () => getCashSession(id), enabled: Boolean(id) })
  const closing = useMutation({
    mutationFn: (amount: string) => closeCashSession(id, amount),
    onSuccess: async session => {
      queryClient.setQueryData<CashSession>(['cash-session', id], session)
      await queryClient.invalidateQueries({ queryKey: ['cash-sessions'] })
      setCloseOpen(false)
      setCountedAmount('')
    },
  })
  const moving = useMutation({
    mutationFn: (input: { type: Extract<CashMovementType, 'DEPOSIT' | 'WITHDRAWAL'>; amount: string; reason: string }) => createCashMovement(id, input),
    onSuccess: async () => {
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: ['cash-sessions'] }),
      ])
      setMovementType(null)
      setMovementAmount('')
      setMovementReason('')
    },
  })

  if (query.isLoading) return <div className="orders-empty"><RefreshCw className="spin"/></div>
  if (!query.data) return <div className="order-not-found"><strong>Sessão não encontrada</strong><Link to="/caixa">Voltar ao caixa</Link></div>
  const item = query.data
  const expected = Number(item.expectedAmount ?? item.closingExpectedAmount ?? 0)
  const parsedCounted = parseMoney(countedAmount)
  const difference = parsedCounted === null ? null : Number(parsedCounted) - expected
  const parsedMovementAmount = parseMoney(movementAmount)
  const projectedBalance = expected + (movementType === 'WITHDRAWAL' ? -Number(parsedMovementAmount ?? 0) : Number(parsedMovementAmount ?? 0))
  const closeError = closing.error instanceof ApiError
    ? closing.error.message
    : closing.isError ? 'Não foi possível fechar o caixa. Tente novamente.' : ''
  const movementError = moving.error instanceof ApiError
    ? moving.error.message
    : moving.isError ? 'Não foi possível registrar a movimentação. Tente novamente.' : ''

  const openCloseModal = () => {
    setCountedAmount(expected.toFixed(2).replace('.', ','))
    setValidationError('')
    closing.reset()
    setCloseOpen(true)
  }
  const dismissCloseModal = () => {
    if (closing.isPending) return
    setCloseOpen(false)
    setValidationError('')
    closing.reset()
  }
  const submitClose = (event: FormEvent) => {
    event.preventDefault()
    setValidationError('')
    closing.reset()
    const amount = parseMoney(countedAmount)
    if (amount === null) {
      setValidationError('Informe um valor contado válido, com no máximo duas casas decimais.')
      return
    }
    closing.mutate(amount)
  }
  const openMovementModal = (type: Extract<CashMovementType, 'DEPOSIT' | 'WITHDRAWAL'>) => {
    setMovementType(type)
    setMovementAmount('')
    setMovementReason('')
    setMovementValidationError('')
    moving.reset()
  }
  const dismissMovementModal = () => {
    if (moving.isPending) return
    setMovementType(null)
    setMovementValidationError('')
    moving.reset()
  }
  const submitMovement = (event: FormEvent) => {
    event.preventDefault()
    setMovementValidationError('')
    moving.reset()
    if (!movementType || parsedMovementAmount === null || Number(parsedMovementAmount) <= 0) {
      setMovementValidationError('Informe um valor maior que zero, com no máximo duas casas decimais.')
      return
    }
    if (movementReason.trim().length < 3) {
      setMovementValidationError('Informe uma justificativa com pelo menos 3 caracteres.')
      return
    }
    if (movementType === 'WITHDRAWAL' && Number(parsedMovementAmount) > expected) {
      setMovementValidationError('O valor da sangria supera o saldo disponível no caixa.')
      return
    }
    moving.mutate({ type: movementType, amount: parsedMovementAmount, reason: movementReason.trim() })
  }

  return <>
    <section className="cash-details page-enter">
      <Link className="back-link" to="/caixa"><ArrowLeft size={16}/> Voltar ao caixa</Link>
      <div className="detail-heading"><div><span className="eyebrow">Sessão de caixa</span><h1>{item.cashRegister.name}</h1><p>Aberto em {date(item.openedAt)}{item.closedAt ? ` · Fechado em ${date(item.closedAt)}` : ''}</p></div><span className={`cash-session-status ${item.status.toLowerCase()}`}>{item.status === 'OPEN' ? 'Caixa aberto' : 'Caixa fechado'}</span></div>
      <div className="cash-metrics detail-cash-metrics">
        <article><span className="cash-metric-icon green"><WalletCards size={19}/></span><div><small>Valor inicial</small><strong>{money(item.openingAmount)}</strong></div></article>
        <article><span className="cash-metric-icon blue"><Clock3 size={19}/></span><div><small>Saldo esperado</small><strong>{money(item.expectedAmount ?? item.closingExpectedAmount)}</strong></div></article>
        <article><span className="cash-metric-icon amber"><ArrowUpRight size={19}/></span><div><small>Valor contado</small><strong>{item.closingCountedAmount != null ? money(item.closingCountedAmount) : 'Em aberto'}</strong></div></article>
        <article><span className="cash-metric-icon coral"><ArrowDownLeft size={19}/></span><div><small>Diferença</small><strong>{item.closingDifference != null ? money(item.closingDifference) : '—'}</strong></div></article>
      </div>
      <section className="cash-panel">
        <header><div><span className="panel-kicker">Livro caixa</span><h2>Movimentações</h2></div>{item.status === 'OPEN' && <div className="cash-actions"><button onClick={() => openMovementModal('DEPOSIT')}>+ Suprimento</button><button onClick={() => openMovementModal('WITHDRAWAL')}>− Sangria</button><button className="close-action" onClick={openCloseModal}>Fechar caixa</button></div>}</header>
        <div className="movement-list">{(item.movements ?? []).map(movement => <article key={movement.id}><span className={Number(movement.amount) >= 0 ? 'in' : 'out'}>{Number(movement.amount) >= 0 ? <ArrowUpRight size={17}/> : <ArrowDownLeft size={17}/>}</span><div><strong>{movementLabels[movement.type]}</strong><small>{movement.reason || date(movement.createdAt)}</small></div><b className={Number(movement.amount) >= 0 ? 'positive' : 'negative'}>{Number(movement.amount) >= 0 ? '+ ' : ''}{money(movement.amount)}</b></article>)}</div>
        {!item.movements?.length && <div className="orders-empty"><WalletCards size={30}/><span>Nenhuma movimentação registrada.</span></div>}
      </section>
    </section>

    {movementType && <div className="cash-modal-backdrop" role="presentation" onMouseDown={dismissMovementModal}>
      <div className={`cash-modal cash-movement-modal ${movementType === 'DEPOSIT' ? 'deposit' : 'withdrawal'}`} role="dialog" aria-modal="true" aria-labelledby="cash-movement-title" onMouseDown={event => event.stopPropagation()}>
        <header><span>{movementType === 'DEPOSIT' ? <ArrowUpRight size={20}/> : <ArrowDownLeft size={20}/>}</span><div><h2 id="cash-movement-title">{movementType === 'DEPOSIT' ? 'Registrar suprimento' : 'Registrar sangria'}</h2><p>{movementType === 'DEPOSIT' ? 'Adicione dinheiro físico ao terminal.' : 'Registre uma retirada de dinheiro do terminal.'}</p></div><button type="button" onClick={dismissMovementModal} aria-label="Fechar"><X size={19}/></button></header>
        <form onSubmit={submitMovement} noValidate>
          <div className="cash-movement-summary"><div><span>Saldo atual</span><strong>{money(expected)}</strong></div><div><span>{movementType === 'DEPOSIT' ? 'Após o suprimento' : 'Após a sangria'}</span><strong className={projectedBalance < 0 ? 'negative' : 'positive'}>{parsedMovementAmount == null ? '—' : money(projectedBalance)}</strong></div></div>
          <label className="cash-modal-field"><span>Valor</span><div className="money-input"><span>R$</span><input autoFocus inputMode="decimal" autoComplete="off" value={movementAmount} onChange={event => { setMovementAmount(event.target.value); setMovementValidationError(''); moving.reset() }} placeholder="0,00"/></div></label>
          <label className="cash-modal-field"><span>Justificativa</span><textarea required minLength={3} maxLength={500} value={movementReason} onChange={event => { setMovementReason(event.target.value); setMovementValidationError(''); moving.reset() }} placeholder={movementType === 'DEPOSIT' ? 'Ex.: reforço para troco' : 'Ex.: retirada para depósito bancário'}/><small>Essa informação ficará registrada no livro caixa.</small></label>
          {(movementValidationError || movementError) && <div className="form-error" role="alert">{movementValidationError || movementError}</div>}
          <footer><button type="button" className="secondary-button" onClick={dismissMovementModal} disabled={moving.isPending}>Cancelar</button><button className={`primary-button cash-movement-confirm ${movementType.toLowerCase()}`} disabled={moving.isPending || parsedMovementAmount == null || !movementReason.trim()}>{moving.isPending ? <RefreshCw size={16} className="spin"/> : movementType === 'DEPOSIT' ? <ArrowUpRight size={16}/> : <ArrowDownLeft size={16}/>} {moving.isPending ? 'Registrando...' : movementType === 'DEPOSIT' ? 'Confirmar suprimento' : 'Confirmar sangria'}</button></footer>
        </form>
      </div>
    </div>}

    {closeOpen && <div className="cash-modal-backdrop" role="presentation" onMouseDown={dismissCloseModal}>
      <div className="cash-modal cash-close-modal" role="dialog" aria-modal="true" aria-labelledby="close-cash-title" onMouseDown={event => event.stopPropagation()}>
        <header><span><WalletCards size={20}/></span><div><h2 id="close-cash-title">Fechar caixa</h2><p>Confira os valores antes de encerrar a sessão.</p></div><button type="button" onClick={dismissCloseModal} aria-label="Fechar"><X size={19}/></button></header>
        <form onSubmit={submitClose} noValidate>
          <div className="cash-close-summary"><div><span>Saldo esperado</span><strong>{money(expected)}</strong></div><div><span>Valor contado</span><strong>{parsedCounted == null ? '—' : money(parsedCounted)}</strong></div><div className={difference == null ? '' : difference === 0 ? 'balanced' : difference > 0 ? 'positive' : 'negative'}><span>Diferença</span><strong>{difference == null ? '—' : money(difference)}</strong></div></div>
          <label className="cash-modal-field"><span>Valor contado no caixa</span><div className="money-input"><span>R$</span><input autoFocus inputMode="decimal" autoComplete="off" value={countedAmount} onChange={event => { setCountedAmount(event.target.value); setValidationError(''); closing.reset() }} placeholder="0,00"/></div><small>Informe o total físico conferido no terminal.</small></label>
          {(validationError || closeError) && <div className="form-error" role="alert">{validationError || closeError}</div>}
          {difference != null && difference !== 0 && <div className="cash-close-warning"><ArrowDownLeft size={17}/><span>Será registrada uma diferença de <strong>{money(Math.abs(difference))}</strong> no fechamento.</span></div>}
          <footer><button type="button" className="secondary-button" onClick={dismissCloseModal} disabled={closing.isPending}>Cancelar</button><button className="primary-button cash-close-confirm" disabled={closing.isPending || parsedCounted == null}>{closing.isPending ? <RefreshCw size={16} className="spin"/> : <CheckCircle2 size={16}/>} {closing.isPending ? 'Fechando...' : 'Confirmar fechamento'}</button></footer>
        </form>
      </div>
    </div>}
  </>
}
