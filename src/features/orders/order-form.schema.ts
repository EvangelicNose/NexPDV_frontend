import { z } from 'zod'

const optionalUuid = z.string().refine((value) => !value || z.uuid().safeParse(value).success, 'Seleção inválida')
export const orderFormSchema = z.object({
  type: z.enum(['DINE_IN','TAKEAWAY','DELIVERY','COUNTER']),
  tabId: optionalUuid,
  customerName: z.string().trim().max(120,'Use no máximo 120 caracteres'),
  customerPhone: z.string().trim().max(30,'Use no máximo 30 caracteres'),
  street: z.string().trim().max(160), number: z.string().trim().max(20), neighborhood: z.string().trim().max(100), city: z.string().trim().max(100),
  notes: z.string().trim().max(1000,'Use no máximo 1000 caracteres'),
  root: z.object({ serverError: z.object({ type: z.string(), message: z.string() }).optional() }).optional(),
  items: z.array(z.object({ productId:z.uuid('Selecione um produto'),productVariantId:optionalUuid,quantity:z.string().trim().regex(/^\d{1,8}([.,]\d{1,3})?$/,'Informe uma quantidade válida').refine(value=>Number(value.replace(',','.'))>0,'A quantidade deve ser maior que zero'),notes:z.string().trim().max(500) })).min(1,'Adicione ao menos um item').max(100),
}).superRefine((value,ctx)=>{if(value.type==='DINE_IN'&&!value.tabId)ctx.addIssue({code:'custom',path:['tabId'],message:'Selecione uma comanda aberta'});if(value.type==='DELIVERY'){if(!value.street)ctx.addIssue({code:'custom',path:['street'],message:'Informe a rua'});if(!value.number)ctx.addIssue({code:'custom',path:['number'],message:'Informe o número'});if(!value.neighborhood)ctx.addIssue({code:'custom',path:['neighborhood'],message:'Informe o bairro'});if(!value.city)ctx.addIssue({code:'custom',path:['city'],message:'Informe a cidade'})}})
export type OrderForm=z.infer<typeof orderFormSchema>
