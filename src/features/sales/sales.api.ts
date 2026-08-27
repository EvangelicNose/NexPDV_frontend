import { apiRequest } from '../../lib/api'
import type { CheckoutPayment, Sale } from './sales.types'

export const checkoutOrder = (orderId: string, payments: CheckoutPayment[]) =>
  apiRequest<Sale>(`/v1/orders/${orderId}/checkout`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ payments }),
  })
