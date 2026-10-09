import { apiRequest } from '../../lib/api'

export type PixPayment = {
  id: string; saleId: string; companyId: string; establishmentId: string; method: 'PIX'
  status: 'PENDING' | 'PAID' | 'CANCELLED'; txid: string; payload: string; amount: string
  operationFee: string; netAmount: string; createdAt: string; confirmedAt: string | null
  confirmedByUserId: string | null; cancelledAt: string | null; cancellationReason: string | null
}
export const listPixPayments = (saleId: string) => apiRequest<PixPayment[]>(`/v1/sales/${saleId}/payments/pix`)
export const createPixPayment = (saleId: string, key: string) => apiRequest<PixPayment>(`/v1/sales/${saleId}/payments/pix`, {
  method: 'POST', headers: { 'Idempotency-Key': key }, body: '{}',
})
export const confirmPixPayment = (id: string, cashRegisterSessionId: string, key: string) => apiRequest<PixPayment>(`/v1/payments/${id}/confirm`, {
  method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ received: true, cashRegisterSessionId }),
})
export const cancelPixPayment = (id: string, reason: string, key: string) => apiRequest<PixPayment>(`/v1/payments/${id}/cancel`, {
  method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ reason }),
})
