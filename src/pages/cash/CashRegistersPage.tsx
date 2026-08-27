import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { MonitorCog, Plus, RefreshCw, X } from 'lucide-react'
import { useAuth } from '../../features/auth/auth-context'
import { createCashRegister, listCashRegisters } from '../../features/cash/cash.api'
import { ApiError } from '../../lib/api'

const emptyForm = { name: '', code: '', active: true }

export function CashRegistersPage() {
  const { currentEstablishment } = useAuth()
  const establishmentId = currentEstablishment?.id
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const query = useQuery({
    queryKey: ['cash-registers', establishmentId],
    queryFn: () => listCashRegisters(establishmentId!),
    enabled: Boolean(establishmentId),
  })
  const create = useMutation({
    mutationFn: () => createCashRegister({
      establishmentId: establishmentId!,
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      active: form.active,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cash-registers', establishmentId] })
      setForm(emptyForm)
      setModalOpen(false)
    },
  })

  const closeModal = () => {
    if (create.isPending) return
    create.reset()
    setForm(emptyForm)
    setModalOpen(false)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!establishmentId) return
    create.mutate()
  }
  const error = create.error instanceof ApiError
    ? create.error.message
    : create.isError ? 'Não foi possível criar o terminal. Tente novamente.' : ''

  return <>
    <section className="cash-panel">
      <header><div><span className="panel-kicker">Configuração</span><h2>Terminais de caixa</h2></div><button className="panel-action" onClick={() => setModalOpen(true)} disabled={!establishmentId}><Plus size={15}/> Novo terminal</button></header>
      <div className="register-grid">{(query.data ?? []).map(item => <article className="register-card" key={item.id}><span><MonitorCog size={21}/></span><div><strong>{item.name}</strong><small>Código {item.code}</small></div><i className={item.active ? 'active' : 'inactive'}>{item.active ? 'Ativo' : 'Inativo'}</i></article>)}</div>
      {query.isLoading && <div className="orders-empty"><RefreshCw className="spin"/><span>Carregando terminais...</span></div>}
      {query.isError && <div className="orders-empty"><strong>Não foi possível carregar os terminais</strong><button className="inline-action" onClick={() => void query.refetch()}>Tentar novamente</button></div>}
      {!query.isLoading && !query.isError && !query.data?.length && <div className="orders-empty"><MonitorCog size={31}/><strong>Nenhum terminal cadastrado</strong><span>Cadastre o primeiro terminal desta unidade.</span><button className="inline-action" onClick={() => setModalOpen(true)}>Criar terminal</button></div>}
    </section>

    {modalOpen && <div className="cash-modal-backdrop" role="presentation" onMouseDown={closeModal}>
      <div className="cash-modal" role="dialog" aria-modal="true" aria-labelledby="cash-terminal-title" onMouseDown={event => event.stopPropagation()}>
        <header><span><MonitorCog size={20}/></span><div><h2 id="cash-terminal-title">Novo terminal</h2><p>Cadastre um ponto de caixa para {currentEstablishment?.name}.</p></div><button type="button" onClick={closeModal} aria-label="Fechar"><X size={19}/></button></header>
        <form onSubmit={submit}>
          <label className="cash-modal-field"><span>Nome do terminal</span><input autoFocus required minLength={2} maxLength={100} value={form.name} onChange={event => { setForm({ ...form, name: event.target.value }); create.reset() }} placeholder="Ex.: Caixa principal"/></label>
          <label className="cash-modal-field"><span>Código interno</span><input required minLength={1} maxLength={40} value={form.code} onChange={event => { setForm({ ...form, code: event.target.value.toUpperCase() }); create.reset() }} placeholder="Ex.: CX-01"/></label>
          <label className="cash-terminal-active"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })}/><span aria-hidden="true"/><div><strong>Terminal ativo</strong><small>Disponível para abertura de novas sessões de caixa.</small></div></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <footer><button type="button" className="secondary-button" onClick={closeModal} disabled={create.isPending}>Cancelar</button><button className="primary-button" disabled={create.isPending || !establishmentId}>{create.isPending && <RefreshCw size={16} className="spin"/>}{create.isPending ? 'Criando...' : 'Criar terminal'}</button></footer>
        </form>
      </div>
    </div>}
  </>
}
