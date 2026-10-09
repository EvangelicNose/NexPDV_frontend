import { apiRequest } from '../../lib/api'
import type { CheckoutPayment, Sale } from './sales.types'
export const prepareOrderPix = (orderId: string, payments: CheckoutPayment[], key: string) =>
  apiRequest<Sale>(`/v1/orders/${orderId}/pix-sale`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ payments }) })
export const prepareQuickPix = (input: QuickSaleInput, key: string) =>
  apiRequest<Sale>('/v1/sales/quick/pix', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(input) })
export const getSale = (id: string) => apiRequest<Sale>(`/v1/sales/${id}`)
export const finalizeSale = (id: string, key: string) => apiRequest<Sale>(`/v1/sales/${id}/finalize`, {
  method: 'POST', headers: { 'Idempotency-Key': key }, body: '{}',
})

export const cancelSale = (id: string, input: { reason: string; cashRegisterSessionId?: string; pixRefundConfirmed?: true }, idempotencyKey: string) =>
  apiRequest<Sale>(`/v1/sales/${id}/cancel`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  })

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

export const createQuickSale = (input: QuickSaleInput, idempotencyKey: string = crypto.randomUUID()) =>
  apiRequest<Sale>('/v1/sales/quick', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  })
