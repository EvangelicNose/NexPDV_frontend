import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Boxes, LoaderCircle, PackagePlus, ReceiptText, RefreshCw, RotateCcw } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/auth-context'
import { listProducts } from '../../features/catalog/catalog.api'
import { createStockEntry, listStock } from '../../features/stock/stock.api'
import { stockEntrySchema, type StockEntryForm } from '../../features/stock/stock-form.schema'
import { ApiError } from '../../lib/api'

const quantity = (value: number | string) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(Number(value))
const entryTypes = {
  INITIAL: { label: 'Saldo inicial', description: 'Primeira contagem do item nesta unidade.', icon: Boxes },
  PURCHASE: { label: 'Compra', description: 'Mercadoria recebida de fornecedor.', icon: ReceiptText },
  RETURN: { label: 'Devolução', description: 'Produto devolvido que retornou ao estoque.', icon: RotateCcw },
} as const

export function StockEntryPage() {
  const { currentEstablishment } = useAuth()
  const establishmentId = currentEstablishment?.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const products = useQuery({ queryKey: ['products', 'stock-entry'], queryFn: () => listProducts({ active: true }) })
  const stock = useQuery({ queryKey: ['stock', establishmentId], queryFn: () => listStock({ establishmentId: establishmentId! }), enabled: Boolean(establishmentId) })
  const { register, control, handleSubmit, setValue, setError, formState: { errors, isSubmitting } } = useForm<StockEntryForm>({
    resolver: zodResolver(stockEntrySchema),
    defaultValues: { productId: '', productVariantId: '', type: 'INITIAL', quantity: '', reason: '', referenceId: '' },
  })
  const productId = useWatch({ control, name: 'productId' })
  const variantId = useWatch({ control, name: 'productVariantId' })
  const entryType = useWatch({ control, name: 'type' })
  const entryQuantity = useWatch({ control, name: 'quantity' })
  const inventoryProducts = (products.data ?? []).filter(product => product.trackInventory)
  const selectedProduct = inventoryProducts.find(product => product.id === productId)
  const selectedVariant = selectedProduct?.variants.find(variant => variant.id === variantId)
  const currentItem = stock.data?.find(item => item.productId === productId && (item.productVariantId ?? '') === variantId)
  const currentBalance = Number(currentItem?.quantity ?? 0)
  const amount = Number((entryQuantity ?? '').replace(',', '.')) || 0
  const projectedBalance = currentBalance + amount

  const submit = handleSubmit(async values => {
    if (!establishmentId) return
    try {
      await createStockEntry({
        establishmentId,
        productId: values.productId,
        ...(values.productVariantId && { productVariantId: values.productVariantId }),
        type: values.type,
        quantity: Number(values.quantity.replace(',', '.')),
        reason: values.reason.trim(),
        ...(values.referenceId.trim() && { referenceId: values.referenceId.trim() }),
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-movements'] }),
      ])
      navigate('/estoque/movimentacoes', { replace: true })
    } catch (reason) {
      setError('root.serverError', { message: reason instanceof ApiError ? reason.message : 'Não foi possível registrar a entrada de estoque.' })
    }
  })

  return <form className="stock-action-page stock-entry-page page-enter" onSubmit={submit} noValidate>
    <Link className="back-link" to="/estoque"><ArrowLeft size={16}/> Voltar ao estoque</Link>
    <div className="order-editor-heading"><span className="eyebrow">Recebimento de mercadoria</span><h1>Entrada de estoque</h1><p>Registre o saldo inicial, compras e devoluções recebidas na unidade.</p></div>
    {errors.root?.serverError && <div className="form-error" role="alert">{errors.root.serverError.message}</div>}
    <div className="stock-entry-grid">
      <div className="stock-entry-main">
        <section className="stock-panel">
          <header><div><span className="panel-kicker">Etapa 1</span><h2>Origem da entrada</h2></div></header>
          <div className="stock-entry-types">{Object.entries(entryTypes).map(([value, item]) => { const Icon = item.icon; return <label className={entryType === value ? 'selected' : ''} key={value}><input type="radio" value={value} {...register('type')}/><span><Icon size={18}/></span><div><strong>{item.label}</strong><small>{item.description}</small></div></label> })}</div>
        </section>
        <section className="stock-panel">
          <header><div><span className="panel-kicker">Etapa 2</span><h2>Produto recebido</h2></div></header>
          {products.isLoading ? <div className="stock-entry-loading"><RefreshCw className="spin"/><span>Carregando produtos...</span></div> : inventoryProducts.length ? <div className="stock-entry-product-fields">
            <label className="stock-form-field">Produto<select {...register('productId')} onChange={event => { setValue('productId', event.target.value, { shouldValidate: true }); setValue('productVariantId', '') }}><option value="">Selecione um produto</option>{inventoryProducts.map(product => <option value={product.id} key={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ''}</option>)}</select>{errors.productId && <small className="field-error">{errors.productId.message}</small>}</label>
            <label className="stock-form-field">Variação <small>Opcional</small><select {...register('productVariantId')} disabled={!selectedProduct?.variants.some(variant => variant.active)}><option value="">Padrão / sem variação</option>{selectedProduct?.variants.filter(variant => variant.active).map(variant => <option value={variant.id} key={variant.id}>{variant.name}{variant.sku ? ` · ${variant.sku}` : ''}</option>)}</select></label>
          </div> : <div className="orders-empty stock-entry-empty"><Boxes size={31}/><strong>Nenhum produto controla estoque</strong><span>Habilite “Controlar estoque” no cadastro do produto.</span><Link className="inline-action" to="/catalogo/novo">Cadastrar produto</Link></div>}
          <div className={`selected-stock-placeholder ${selectedProduct ? 'selected' : ''}`}><PackagePlus size={24}/>{selectedProduct ? <><strong>{selectedProduct.name}{selectedVariant ? ` — ${selectedVariant.name}` : ''}</strong><span>Saldo atual nesta unidade: {quantity(currentBalance)}</span></> : <span>Selecione o produto que está entrando.</span>}</div>
        </section>
        <section className="stock-panel">
          <header><div><span className="panel-kicker">Etapa 3</span><h2>Documento e justificativa</h2></div></header>
          <div className="stock-entry-details"><label className="stock-form-field">Referência <small>Opcional</small><input {...register('referenceId')} placeholder="Ex.: NF-12345 ou pedido de compra"/>{errors.referenceId && <small className="field-error">{errors.referenceId.message}</small>}</label><label className="stock-form-field">Justificativa<textarea {...register('reason')} placeholder="Descreva a origem desta entrada"/>{errors.reason && <small className="field-error">{errors.reason.message}</small>}</label></div>
        </section>
      </div>
      <aside className="stock-panel stock-entry-summary">
        <header><div><span className="panel-kicker">Conferência</span><h2>Quantidade recebida</h2></div></header>
        <label className="stock-form-field">Quantidade<input {...register('quantity')} inputMode="decimal" placeholder="0,000"/>{errors.quantity && <small className="field-error">{errors.quantity.message}</small>}</label>
        <dl><div><dt>Tipo</dt><dd>{entryTypes[entryType]?.label}</dd></div><div><dt>Saldo anterior</dt><dd>{quantity(currentBalance)}</dd></div><div className="stock-entry-projected"><dt>Novo saldo</dt><dd>{quantity(projectedBalance)}</dd></div></dl>
        <div className="stock-entry-hint"><PackagePlus size={17}/><span>A entrada ficará registrada permanentemente no histórico de movimentações.</span></div>
        <button className="primary-button" disabled={isSubmitting || !establishmentId || !selectedProduct}>{isSubmitting ? <><LoaderCircle size={18} className="spin"/> Registrando...</> : <><PackagePlus size={18}/> Confirmar entrada</>}</button>
      </aside>
    </div>
  </form>
}
