import { apiRequest } from '../../lib/api'
import type { CheckoutPayment, Sale } from './sales.types'

export type QuickSaleInput = {
  establishmentId: string
  items: Array<{ productId: string; productVariantId?: string; quantity: number; options: never[]; discount: number }>
  payments: CheckoutPayment[]
  discount: number
  fees: number
}

export const checkoutOrder = (orderId: string, payments: CheckoutPayment[]) =>
  apiRequest<Sale>(`/v1/orders/${orderId}/checkout`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ payments }),
  })

export const createQuickSale = (input: QuickSaleInput) =>
  apiRequest<Sale>('/v1/sales/quick', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(input),
  })
