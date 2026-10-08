import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Barcode, Layers, LoaderCircle, Tags } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { createProductVariant, getProduct } from '../../features/catalog/catalog.api'
import { ApiError } from '../../lib/api'
import '../../features/catalog/variant-editor.css'

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da variação').max(100, 'Use no máximo 100 caracteres'),
  sku: z.string().trim().max(80, 'Use no máximo 80 caracteres'),
  barcode: z.string().trim().max(80, 'Use no máximo 80 caracteres'),
  priceAdjustment: z.string().trim().regex(/^-?\d{1,10}([.,]\d{1,2})?$/, 'Informe um valor com até 2 casas decimais'),
  active: z.boolean(),
})
type VariantForm = z.infer<typeof schema>
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export function NewVariantPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const product = useQuery({ queryKey: ['product', id], queryFn: () => getProduct(id), enabled: Boolean(id) })
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<VariantForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', sku: '', barcode: '', priceAdjustment: '0,00', active: true },
  })
  const adjustment = useWatch({ control, name: 'priceAdjustment' })
  const name = useWatch({ control, name: 'name' })
  const validAdjustment = schema.shape.priceAdjustment.safeParse(adjustment).success
  const adjustmentValue = validAdjustment ? Number(adjustment.replace(',', '.')) : 0
  const backTo = `/catalogo/produtos/${id}`
  const submit = handleSubmit(async (values) => {
    if (!product.data) return
    try {
      await createProductVariant(id, {
        name: values.name,
        ...(values.sku && { sku: values.sku }),
        ...(values.barcode && { barcode: values.barcode }),
        priceAdjustment: values.priceAdjustment.replace(',', '.'),
        active: values.active,
      })
    } catch (reason) {
      setError('root.serverError', { message: reason instanceof ApiError ? reason.message : 'Não foi possível salvar a variação. Tente novamente.' })
      return
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['product', id] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['stock'] }),
    ])
    navigate(backTo, { replace: true })
  })

  if (product.isLoading) return <div className="orders-empty" role="status"><LoaderCircle className="spin" /><span>Carregando produto...</span></div>
  if (product.isError) return <div className="order-not-found" role="alert"><strong>{product.error instanceof ApiError && product.error.status === 404 ? 'Produto não encontrado' : 'Não foi possível carregar o produto'}</strong><button type="button" onClick={() => void product.refetch()}>Tentar novamente</button><Link to="/catalogo">Voltar ao catálogo</Link></div>
  if (!product.data) return <div className="order-not-found"><strong>Produto não encontrado</strong><Link to="/catalogo">Voltar ao catálogo</Link></div>

  return <form className="product-editor variant-editor page-enter" onSubmit={submit} noValidate>
    <Link className="back-link" to={backTo}><ArrowLeft size={16} /> Voltar ao produto</Link>
    <div className="order-editor-heading"><span className="eyebrow">Catálogo</span><h1>Nova variação</h1><p>Cadastre uma opção de tamanho, sabor ou apresentação para {product.data.name}.</p></div>
    {errors.root?.serverError && <div className="form-error product-form-error" role="alert">{errors.root.serverError.message}</div>}
    <fieldset disabled={isSubmitting} className="variant-fieldset">
      <div className="product-editor-grid">
        <div className="product-editor-main">
          <section className="catalog-panel"><header><div><span className="panel-kicker">Personalização</span><h2>Dados da variação</h2></div><Layers size={21} /></header>
            <div className="product-form-grid">
              <label className={`product-field field-wide ${errors.name ? 'has-error' : ''}`}><span>Nome da variação</span><input {...register('name')} maxLength={100} placeholder="Ex.: Grande, chocolate ou 500 ml" autoFocus aria-invalid={Boolean(errors.name)} />{errors.name && <small className="field-error">{errors.name.message}</small>}</label>
              <label className={`product-field ${errors.sku ? 'has-error' : ''}`}><span>SKU <small>Opcional</small></span><div className="input-with-icon"><Tags size={16} /><input {...register('sku')} maxLength={80} placeholder="Ex.: PROD-G" aria-invalid={Boolean(errors.sku)} /></div>{errors.sku && <small className="field-error">{errors.sku.message}</small>}</label>
              <label className={`product-field ${errors.barcode ? 'has-error' : ''}`}><span>Código de barras <small>Opcional</small></span><div className="input-with-icon"><Barcode size={16} /><input {...register('barcode')} maxLength={80} placeholder="7890000000000" aria-invalid={Boolean(errors.barcode)} /></div>{errors.barcode && <small className="field-error">{errors.barcode.message}</small>}</label>
              <label className="toggle-row field-wide"><input type="checkbox" {...register('active')} /><span /><div><strong>Variação ativa</strong><small>Disponibilizar esta opção para venda e novos pedidos.</small></div></label>
            </div>
          </section>
          <div className="editor-hint"><Layers size={18} /><span>A variação utiliza as configurações do produto. O ajuste é somado ao preço base; use um valor negativo para aplicar um desconto.</span></div>
        </div>
        <aside className="product-editor-side">
          <section className="catalog-panel"><header><div><span className="panel-kicker">Configuração comercial</span><h2>Preço da variação</h2></div></header>
            <label className={`product-field ${errors.priceAdjustment ? 'has-error' : ''}`}><span>Ajuste de preço</span><div className="price-editor cost-price-editor"><span>R$</span><input {...register('priceAdjustment')} inputMode="decimal" placeholder="0,00" aria-invalid={Boolean(errors.priceAdjustment)} /></div>{errors.priceAdjustment && <small className="field-error">{errors.priceAdjustment.message}</small>}<small>Mantenha 0,00 para usar o preço base.</small></label>
            <div className="variant-price-preview" aria-live="polite"><span>{name.trim() || 'Nova variação'}</span><div><span>Preço base</span><strong>{money(Number(product.data.basePrice))}</strong></div><div><span>Ajuste</span><strong>{validAdjustment ? money(adjustmentValue) : '—'}</strong></div><div className="variant-total"><span>Preço resultante</span><strong>{validAdjustment ? money(Number(product.data.basePrice) + adjustmentValue) : '—'}</strong></div><small>Prévia com o preço base, sem preços específicos por unidade.</small></div>
            <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle size={18} className="spin" /> Salvando variação...</> : <><Layers size={18} /> Salvar variação</>}</button>
            <Link className="back-link variant-cancel" to={backTo}>Cancelar</Link>
          </section>
        </aside>
      </div>
    </fieldset>
  </form>
}
