import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowLeftRight, Building2, LoaderCircle, PackageSearch, RefreshCw } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/auth-context'
import { listStock, transferStock } from '../../features/stock/stock.api'
import { stockTransferSchema, type StockTransferForm } from '../../features/stock/stock-form.schema'
import { ApiError } from '../../lib/api'

export function StockTransferPage() {
  const { session, currentEstablishment: current } = useAuth(); const navigate = useNavigate(); const queryClient = useQueryClient()
  const stock = useQuery({ queryKey: ['stock', current?.id], queryFn: () => listStock({ establishmentId: current!.id }), enabled: Boolean(current?.id) })
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<StockTransferForm>({ resolver: zodResolver(stockTransferSchema), defaultValues: { stockItemId: '', destinationEstablishmentId: '', quantity: '', reason: '' } })
  const destinationId = useWatch({ control, name: 'destinationEstablishmentId' })
  const submit = handleSubmit(async (values) => {
    const selected = stock.data?.find((item) => item.id === values.stockItemId); if (!current || !selected) return
    const amount = Number(values.quantity.replace(',', '.')); if (amount > Number(selected.quantity)) { setError('quantity', { message: 'A quantidade supera o saldo disponível' }); return }
    try {
      await transferStock({ sourceEstablishmentId: current.id, destinationEstablishmentId: values.destinationEstablishmentId, productId: selected.productId, ...(selected.productVariantId && { productVariantId: selected.productVariantId }), quantity: amount, ...(values.reason.trim() && { reason: values.reason.trim() }) })
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['stock'] }), queryClient.invalidateQueries({ queryKey: ['stock-movements'] })])
      navigate('/estoque/movimentacoes', { replace: true })
    } catch (reason) { setError('root.serverError', { message: reason instanceof ApiError ? reason.message : 'Não foi possível transferir o estoque.' }) }
  })
  return <form className="stock-action-page page-enter" onSubmit={submit} noValidate>
    <Link className="back-link" to="/estoque"><ArrowLeft size={16} /> Voltar ao estoque</Link><div className="order-editor-heading"><span className="eyebrow">Entre unidades</span><h1>Transferir estoque</h1><p>Movimente produtos mantendo a rastreabilidade entre origem e destino.</p></div>
    {errors.root?.serverError && <div className="form-error" role="alert">{errors.root.serverError.message}</div>}
    <div className="transfer-flow"><section className="stock-panel"><span className="transfer-icon"><Building2 size={21} /></span><small>Origem</small><strong>{current?.name ?? 'Unidade atual'}</strong></section><span className="transfer-arrow"><ArrowLeftRight size={21} /></span><section className="stock-panel"><span className="transfer-icon destination"><Building2 size={21} /></span><small>Destino</small><select {...register('destinationEstablishmentId')}><option value="">Selecione a unidade</option>{session?.establishments.filter((item) => item.id !== current?.id).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{errors.destinationEstablishmentId && <small className="field-error">{errors.destinationEstablishmentId.message}</small>}</section></div>
    <section className="stock-panel transfer-product-panel"><header><div><span className="panel-kicker">Item da transferência</span><h2>Produto e quantidade</h2></div></header><div className="transfer-form">
      {stock.isLoading ? <RefreshCw className="spin" /> : <label className="stock-form-field">Produto<select {...register('stockItemId')}><option value="">Selecione um item</option>{(stock.data ?? []).filter((item) => Number(item.quantity) > 0).map((item) => <option value={item.id} key={item.id}>{item.product.name}{item.productVariant ? ` — ${item.productVariant.name}` : ''} · disponível ${item.quantity}</option>)}</select>{errors.stockItemId && <small className="field-error">{errors.stockItemId.message}</small>}</label>}
      <label className="stock-form-field">Quantidade<input {...register('quantity')} inputMode="decimal" placeholder="0,000" />{errors.quantity && <small className="field-error">{errors.quantity.message}</small>}</label><label className="stock-form-field field-wide">Motivo <small>Opcional</small><textarea {...register('reason')} placeholder="Informe uma observação para a transferência" />{errors.reason && <small className="field-error">{errors.reason.message}</small>}</label>
    </div><div className="transfer-footer"><span><PackageSearch size={17} /> O saldo será retirado da origem e acrescentado em {session?.establishments.find((item) => item.id === destinationId)?.name ?? 'outra unidade'} na mesma operação.</span><button className="primary-button" disabled={isSubmitting || !current}>{isSubmitting ? <><LoaderCircle className="spin" size={18} /> Transferindo...</> : <><ArrowLeftRight size={18} /> Confirmar transferência</>}</button></div></section>
  </form>
}
