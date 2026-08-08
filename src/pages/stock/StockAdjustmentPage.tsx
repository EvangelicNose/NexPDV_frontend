import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, ClipboardPen, LoaderCircle, PackageSearch, RefreshCw } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/auth-context'
import { adjustStock, listStock } from '../../features/stock/stock.api'
import { stockAdjustmentSchema, type StockAdjustmentForm } from '../../features/stock/stock-form.schema'
import { ApiError } from '../../lib/api'

export function StockAdjustmentPage() {
  const { currentEstablishment } = useAuth()
  const establishmentId = currentEstablishment?.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const stock = useQuery({ queryKey: ['stock', establishmentId], queryFn: () => listStock({ establishmentId: establishmentId! }), enabled: Boolean(establishmentId) })
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<StockAdjustmentForm>({ resolver: zodResolver(stockAdjustmentSchema), defaultValues: { stockItemId: '', newQuantity: '', reason: '' } })
  const selectedId = useWatch({ control, name: 'stockItemId' })
  const selected = stock.data?.find((item) => item.id === selectedId)
  const submit = handleSubmit(async (values) => {
    if (!establishmentId || !selected) return
    try {
      await adjustStock({ establishmentId, productId: selected.productId, ...(selected.productVariantId && { productVariantId: selected.productVariantId }), newQuantity: Number(values.newQuantity.replace(',', '.')), reason: values.reason.trim() })
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['stock'] }), queryClient.invalidateQueries({ queryKey: ['stock-movements'] })])
      navigate('/estoque', { replace: true })
    } catch (reason) { setError('root.serverError', { message: reason instanceof ApiError ? reason.message : 'Não foi possível ajustar o estoque.' }) }
  })
  return <form className="stock-action-page page-enter" onSubmit={submit} noValidate>
    <Link className="back-link" to="/estoque"><ArrowLeft size={16} /> Voltar ao estoque</Link>
    <div className="order-editor-heading"><span className="eyebrow">Correção de saldo</span><h1>Ajustar estoque</h1><p>Informe o saldo físico contado e registre a justificativa.</p></div>
    {errors.root?.serverError && <div className="form-error" role="alert">{errors.root.serverError.message}</div>}
    <div className="stock-action-grid"><section className="stock-panel"><header><div><span className="panel-kicker">Etapa 1</span><h2>Produto e variação</h2></div></header>
      {stock.isLoading ? <div className="orders-empty"><RefreshCw className="spin" /></div> : <label className="stock-form-field">Item<select {...register('stockItemId')}><option value="">Selecione um item do estoque</option>{(stock.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.product.name}{item.productVariant ? ` — ${item.productVariant.name}` : ''} · saldo ${item.quantity}</option>)}</select>{errors.stockItemId && <small className="field-error">{errors.stockItemId.message}</small>}</label>}
      <div className={`selected-stock-placeholder ${selected ? 'selected' : ''}`}><PackageSearch size={24} />{selected ? <><strong>{selected.product.name}{selected.productVariant ? ` — ${selected.productVariant.name}` : ''}</strong><span>Saldo atual: {selected.quantity} · Mínimo: {selected.minimumQuantity ?? 'não definido'}</span></> : <span>Selecione um item para consultar o saldo atual.</span>}</div>
    </section><aside className="stock-panel"><header><div><span className="panel-kicker">Etapa 2</span><h2>Novo saldo</h2></div></header>
      <label className="stock-form-field">Quantidade contada<input {...register('newQuantity')} inputMode="decimal" placeholder="0,000" />{errors.newQuantity && <small className="field-error">{errors.newQuantity.message}</small>}</label>
      <label className="stock-form-field">Motivo do ajuste<textarea {...register('reason')} placeholder="Descreva o motivo da diferença encontrada" />{errors.reason && <small className="field-error">{errors.reason.message}</small>}</label>
      <div className="stock-warning"><AlertTriangle size={17} /><span>O ajuste gera uma movimentação permanente para auditoria.</span></div>
      <button className="primary-button" disabled={isSubmitting || !establishmentId}>{isSubmitting ? <><LoaderCircle className="spin" size={18} /> Ajustando...</> : <><ClipboardPen size={18} /> Confirmar ajuste</>}</button>
    </aside></div>
  </form>
}
