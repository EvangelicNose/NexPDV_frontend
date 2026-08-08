import { z } from 'zod'

const optionalUuid = z.string().refine((value) => !value || z.uuid().safeParse(value).success, 'Categoria inválida')
const money = z.string().trim()
  .min(1, 'Informe o valor')
  .regex(/^\d{1,10}([.,]\d{1,2})?$/, 'Use um valor com até 2 casas decimais')

export const productFormSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do produto').max(160, 'Use no máximo 160 caracteres'),
  categoryId: optionalUuid,
  type: z.enum(['STANDARD', 'COMBO']),
  description: z.string().trim().max(1000, 'Use no máximo 1000 caracteres'),
  sku: z.string().trim().max(80, 'Use no máximo 80 caracteres'),
  barcode: z.string().trim().max(80, 'Use no máximo 80 caracteres'),
  basePrice: money,
  costPrice: z.string().trim().refine(
    (value) => !value || /^\d{1,10}([.,]\d{1,2})?$/.test(value),
    'Use um valor com até 2 casas decimais',
  ),
  active: z.boolean(),
  trackInventory: z.boolean(),
})

export type ProductForm = z.infer<typeof productFormSchema>
