export type PaymentMethod = 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'VOUCHER' | 'OTHER'

export type SalePayment = {
  id: string
  method: PaymentMethod
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
  amount: string
  cashRegisterSessionId?: string | null
  providerReference?: string | null
}

export type Sale = {
  id: string
  orderId: string
  sequence: number
  status: 'COMPLETED' | 'PARTIALLY_REFUNDED' | 'REFUNDED'
  subtotal: string
  additions: string
  discount: string
  fees: string
  total: string
  refundedAmount: string
  createdAt: string
  payments: SalePayment[]
}

export type SaleSummary = Pick<Sale, 'id' | 'sequence' | 'status' | 'total' | 'createdAt' | 'payments'>

export type CheckoutPayment = {
  method: PaymentMethod
  amount: string
  cashRegisterSessionId?: string
  providerReference?: string
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  VOUCHER: 'Voucher',
  OTHER: 'Outro',
}
