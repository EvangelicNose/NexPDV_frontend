import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { MonitorCog, Pencil, Plus, RefreshCw, X } from 'lucide-react'
import { useAuth } from '../../features/auth/auth-context'
import { createCashRegister, listCashRegisters, updateCashRegister } from '../../features/cash/cash.api'
import type { CashRegister } from '../../features/cash/cash.types'
import { paymentMethodLabels, type PaymentMethod } from '../../features/sales/sales.types'
import { ApiError } from '../../lib/api'

const methods = Object.keys(paymentMethodLabels) as PaymentMethod[]
const feeMethods = new Set<PaymentMethod>(['CREDIT_CARD', 'CREDIT_CARD_INSTALLMENT', 'DEBIT_CARD'])
type TerminalForm = { name: string; code: string; active: boolean; paymentMethods: Partial<Record<PaymentMethod, string>> }
const emptyForm = (): TerminalForm => ({ name: '', code: '', active: true, paymentMethods: { CASH: '', PIX: '' } })

export function CashRegistersPage() {
  const { currentEstablishment } = useAuth()
  const establishmentId = currentEstablishment?.id
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<CashRegister | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<TerminalForm>(emptyForm)
  const query = useQuery({ queryKey: ['cash-registers', establishmentId], queryFn: () => listCashRegisters(establishmentId!), enabled: Boolean(establishmentId) })
  const save = useMutation({
    mutationFn: () => {
      const paymentMethods = methods.filter(method => method in form.paymentMethods).map(method => ({
        method,
        ...(feeMethods.has(method) && form.paymentMethods[method]?.trim() ? { operationFeePercent: Number(form.paymentMethods[method]!.replace(',', '.')) } : {}),
      }))
      const values = { name: form.name.trim(), code: form.code.trim().toUpperCase(), active: form.active, paymentMethods }
      return editing ? updateCashRegister(editing.id, values) : createCashRegister({ establishmentId: establishmentId!, ...values })
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['cash-registers', establishmentId] }); closeModal(true) },
  })
  const openCreate = () => { setEditing(null); setForm(emptyForm()); save.reset(); setModalOpen(true) }
  const openEdit = (terminal: CashRegister) => {
    setEditing(terminal)
    setForm({ name: terminal.name, code: terminal.code, active: terminal.active, paymentMethods: Object.fromEntries((terminal.paymentMethods ?? []).map(item => [item.method, item.operationFeePercent?.toString() ?? ''])) })
    save.reset(); setModalOpen(true)
  }
  const closeModal = (force = false) => {
    if (save.isPending && !force) return
    save.reset(); setEditing(null); setForm(emptyForm()); setModalOpen(false)
  }
  const submit = (event: FormEvent) => { event.preventDefault(); if (establishmentId && Object.keys(form.paymentMethods).length && !invalidFees) save.mutate() }
  const toggleMethod = (method: PaymentMethod, checked: boolean) => {
    const paymentMethods = { ...form.paymentMethods }
    if (checked) paymentMethods[method] = ''
    else delete paymentMethods[method]
    setForm({ ...form, paymentMethods }); save.reset()
  }
  const error = save.error instanceof ApiError ? save.error.message : save.isError ? `Não foi possível ${editing ? 'editar' : 'criar'} o terminal. Tente novamente.` : ''
  const invalidFees = methods.some(method => {
    const value = form.paymentMethods[method]
    if (!feeMethods.has(method) || value == null || !value.trim()) return false
    const fee = Number(value.replace(',', '.'))
    return !Number.isFinite(fee) || fee < 0 || fee > 100
  })

  return <>
    <section className="cash-panel">
      <header><div><span className="panel-kicker">Configuração</span><h2>Terminais de caixa</h2></div><button className="panel-action" onClick={openCreate} disabled={!establishmentId}><Plus size={15}/> Novo terminal</button></header>
      <div className="register-grid">{(query.data ?? []).map(item => <article className="register-card" key={item.id}><span><MonitorCog size={21}/></span><div><strong>{item.name}</strong><small>Código {item.code} · {(item.paymentMethods ?? []).length} meios</small></div><i className={item.active ? 'active' : 'inactive'}>{item.active ? 'Ativo' : 'Inativo'}</i><button type="button" onClick={() => openEdit(item)} aria-label={`Editar ${item.name}`}><Pencil size={15}/></button></article>)}</div>
      {query.isLoading && <div className="orders-empty"><RefreshCw className="spin"/><span>Carregando terminais...</span></div>}
      {query.isError && <div className="orders-empty"><strong>Não foi possível carregar os terminais</strong><button className="inline-action" onClick={() => void query.refetch()}>Tentar novamente</button></div>}
      {!query.isLoading && !query.isError && !query.data?.length && <div className="orders-empty"><MonitorCog size={31}/><strong>Nenhum terminal cadastrado</strong><span>Cadastre o primeiro terminal desta unidade.</span><button className="inline-action" onClick={openCreate}>Criar terminal</button></div>}
    </section>
    {modalOpen && <div className="cash-modal-backdrop" role="presentation" onMouseDown={() => closeModal()}>
      <div className="cash-modal cash-terminal-modal" role="dialog" aria-modal="true" aria-labelledby="cash-terminal-title" onMouseDown={event => event.stopPropagation()}>
        <header><span><MonitorCog size={20}/></span><div><h2 id="cash-terminal-title">{editing ? 'Editar terminal' : 'Novo terminal'}</h2><p>Configure o ponto de caixa e seus meios de pagamento.</p></div><button type="button" onClick={() => closeModal()} aria-label="Fechar"><X size={19}/></button></header>
        <form onSubmit={submit}>
          <label className="cash-modal-field"><span>Nome do terminal</span><input autoFocus required minLength={2} maxLength={100} value={form.name} onChange={event => { setForm({ ...form, name: event.target.value }); save.reset() }} placeholder="Ex.: Caixa principal"/></label>
          <label className="cash-modal-field"><span>Código interno</span><input required minLength={1} maxLength={40} value={form.code} onChange={event => { setForm({ ...form, code: event.target.value.toUpperCase() }); save.reset() }} placeholder="Ex.: CX-01"/></label>
          <fieldset className="terminal-payment-methods"><legend>Meios de pagamento</legend><small>Marque os meios aceitos neste terminal e informe as taxas quando aplicável.</small><div>{methods.map(method => { const selected = method in form.paymentMethods; return <label key={method} className={selected ? 'selected' : ''}><span><input type="checkbox" checked={selected} onChange={event => toggleMethod(method, event.target.checked)}/><strong>{paymentMethodLabels[method]}</strong></span>{feeMethods.has(method) && selected && <span className="terminal-fee"><input inputMode="decimal" value={form.paymentMethods[method] ?? ''} onChange={event => setForm({ ...form, paymentMethods: { ...form.paymentMethods, [method]: event.target.value } })} placeholder="0,00"/><em>%</em></span>}</label>})}</div>{!Object.keys(form.paymentMethods).length && <span className="field-error">Selecione ao menos um meio de pagamento.</span>}{invalidFees && <span className="field-error">As taxas devem estar entre 0% e 100%.</span>}</fieldset>
          <label className="cash-terminal-active"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })}/><span aria-hidden="true"/><div><strong>Terminal ativo</strong><small>Disponível para abertura de novas sessões de caixa.</small></div></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <footer><button type="button" className="secondary-button" onClick={() => closeModal()} disabled={save.isPending}>Cancelar</button><button className="primary-button" disabled={save.isPending || !establishmentId || !Object.keys(form.paymentMethods).length || invalidFees}>{save.isPending && <RefreshCw size={16} className="spin"/>}{save.isPending ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar terminal'}</button></footer>
        </form>
      </div>
    </div>}
  </>
}
