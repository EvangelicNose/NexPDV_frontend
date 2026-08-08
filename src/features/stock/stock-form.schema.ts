import { z } from 'zod'
const quantity=z.string().trim().regex(/^\d{1,11}([.,]\d{1,3})?$/,'Use uma quantidade com até 3 casas decimais')
export const stockAdjustmentSchema=z.object({stockItemId:z.uuid('Selecione um item'),newQuantity:quantity.refine(value=>Number(value.replace(',','.'))>=0,'A quantidade não pode ser negativa'),reason:z.string().trim().min(3,'Explique o motivo do ajuste').max(500)})
export const stockTransferSchema=z.object({stockItemId:z.uuid('Selecione um item'),destinationEstablishmentId:z.uuid('Selecione a unidade de destino'),quantity:quantity.refine(value=>Number(value.replace(',','.'))>0,'A quantidade deve ser maior que zero'),reason:z.string().trim().max(500)})
export type StockAdjustmentForm=z.infer<typeof stockAdjustmentSchema>
export type StockTransferForm=z.infer<typeof stockTransferSchema>
