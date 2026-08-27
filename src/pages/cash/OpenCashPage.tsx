import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Banknote, CircleAlert, Landmark, RefreshCw, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/auth-context'
import { listCashRegisters, listCashSessions, openCashRegister } from '../../features/cash/cash.api'
import { ApiError } from '../../lib/api'

const parseMoney = (value: string) => {
  const compact = value.trim().replace(/\s/g, '')
  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(compact) ? compact.replace(/\./g, '') : compact
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount >= 0 ? amount.toFixed(2) : null
}

export function OpenCashPage() {
  const { currentEstablishment } = useAuth()
  const establishmentId = currentEstablishment?.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [cashRegisterId, setCashRegisterId] = useState('')
  const [openingAmount, setOpeningAmount] = useState('')
  const [validationError, setValidationError] = useState('')

  const registers = useQuery({
    queryKey: ['cash-registers', establishmentId],
    queryFn: () => listCashRegisters(establishmentId!),
    enabled: Boolean(establishmentId),
  })
  const openSessions = useQuery({
    queryKey: ['cash-sessions', 'open', establishmentId],
    queryFn: () => listCashSessions(establishmentId!, 'OPEN'),
    enabled: Boolean(establishmentId),
  })
  const availableRegisters = useMemo(() => {
    const busyIds = new Set((openSessions.data ?? []).map(item => item.cashRegisterId))
    return (registers.data ?? []).filter(item => item.active && !busyIds.has(item.id))
  }, [openSessions.data, registers.data])

  useEffect(() => {
    if (!availableRegisters.some(item => item.id === cashRegisterId)) {
      setCashRegisterId(availableRegisters[0]?.id ?? '')
    }
  }, [availableRegisters, cashRegisterId])

  const opening = useMutation({
    mutationFn: ({ registerId, amount }: { registerId: string; amount: string }) => openCashRegister(registerId, amount),
    onSuccess: async session => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cash-sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['cash-registers'] }),
      ])
      navigate(`/caixa/sessoes/${session.id}`, { replace: true })
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setValidationError('')
    opening.reset()
    if (!cashRegisterId) {
      setValidationError('Selecione um terminal disponível.')
      return
    }
    const amount = parseMoney(openingAmount || '0')
    if (amount === null) {
      setValidationError('Informe um valor válido, com no máximo duas casas decimais.')
      return
    }
    opening.mutate({ registerId: cashRegisterId, amount })
  }

  const loading = registers.isLoading || openSessions.isLoading
  const loadError = registers.error ?? openSessions.error
  const submitError = opening.error instanceof ApiError
    ? opening.error.message
    : opening.isError ? 'Não foi possível abrir o terminal. Tente novamente.' : ''

  return <form className="open-cash page-enter" onSubmit={submit} noValidate>
    <Link className="back-link" to="/caixa"><ArrowLeft size={16}/> Voltar ao caixa</Link>
    <div className="order-editor-heading"><span className="eyebrow">Início de turno</span><h1>Abrir caixa</h1><p>Selecione o terminal e informe o fundo de troco.</p></div>
    {(validationError || submitError) && <div className="form-error" role="alert"><CircleAlert size={17}/><span>{validationError || submitError}</span></div>}
    <div className="open-cash-grid">
      <section className="cash-panel">
        <header><div><span className="panel-kicker">Etapa 1</span><h2>Escolha o terminal</h2></div></header>
        {loading && <div className="orders-empty"><RefreshCw className="spin"/><span>Buscando terminais...</span></div>}
        {!loading && loadError && <div className="orders-empty"><CircleAlert size={30}/><strong>Não foi possível carregar os terminais</strong><span>{loadError instanceof ApiError ? loadError.message : 'Tente novamente em instantes.'}</span><button type="button" className="inline-action" onClick={() => { void registers.refetch(); void openSessions.refetch() }}>Tentar novamente</button></div>}
        {!loading && !loadError && availableRegisters.length === 0 && <div className="orders-empty"><Landmark size={31}/><strong>Nenhum terminal disponível</strong><span>Todos os terminais ativos já estão abertos ou ainda não há um terminal cadastrado.</span><Link className="inline-action" to="/caixa/terminais">Ver terminais</Link></div>}
        {!loading && !loadError && availableRegisters.length > 0 && <div className="open-register-list">{availableRegisters.map(item => <label key={item.id}><input type="radio" name="register" value={item.id} checked={cashRegisterId === item.id} onChange={() => { setCashRegisterId(item.id); setValidationError(''); opening.reset() }}/><span><Landmark size={19}/><div><strong>{item.name}</strong><small>Código {item.code}</small></div></span></label>)}</div>}
      </section>
      <aside className="cash-panel opening-values">
        <header><div><span className="panel-kicker">Etapa 2</span><h2>Valor de abertura</h2></div></header>
        <label>Fundo de troco<div className="money-input"><span>R$</span><input aria-label="Fundo de troco" inputMode="decimal" autoComplete="off" value={openingAmount} onChange={event => { setOpeningAmount(event.target.value); setValidationError(''); opening.reset() }} placeholder="0,00"/></div></label>
        <div className="opening-info"><ShieldCheck size={17}/><span>O valor será registrado como movimento de abertura e ficará disponível para conferência.</span></div>
        <button className="primary-button" disabled={opening.isPending || !cashRegisterId || loading}>{opening.isPending ? <RefreshCw size={18} className="spin"/> : <Banknote size={18}/>} {opening.isPending ? 'Abrindo terminal...' : 'Confirmar abertura'}</button>
        <small className="structure-note">Você pode abrir o terminal com saldo inicial de R$ 0,00.</small>
      </aside>
    </div>
  </form>
}
