import { apiRequest } from '../../lib/api'

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM'
export type PaymentSettingsInput = {
  pixKey: string | null
  pixKeyType: PixKeyType | null
  pixReceiverName: string | null
  pixReceiverCity: string | null
  pixEnabled: boolean
}
export type PaymentSettings = PaymentSettingsInput & { companyId: string; establishmentId: string }
export const getPaymentSettings = (id: string) => apiRequest<PaymentSettings>(`/v1/establishments/${id}/payment-settings`)
export const updatePaymentSettings = (id: string, input: PaymentSettingsInput) =>
  apiRequest<PaymentSettings>(`/v1/establishments/${id}/payment-settings`, { method: 'PUT', body: JSON.stringify(input) })
