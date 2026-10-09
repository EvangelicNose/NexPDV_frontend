export type PaymentMethod = 'CASH' | 'PIX' | 'CREDIT_CARD' | 'CREDIT_CARD_INSTALLMENT' | 'DEBIT_CARD' | 'VOUCHER' | 'OTHER'

export type SalePayment = {
  id: string
  method: PaymentMethod
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED'
  amount: string
  operationFee: string
  netAmount: string
  cashRegisterSessionId: string | null
  providerReference?: string | null
  pixTxid?: string | null
}

export type Sale = {
  id: string
  orderId: string
  sequence: number
  status: 'COMPLETED' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'PENDING_PAYMENT' | 'PARTIALLY_PAID'
  subtotal: string
  additions: string
  discount: string
  fees: string
  total: string
  refundedAmount: string
  finalizedAt: string | null
  finalizedByUserId: string | null
  createdAt: string
  payments: SalePayment[]
}

export type SaleSummary = Pick<Sale, 'id' | 'sequence' | 'status' | 'total' | 'createdAt' | 'payments' | 'finalizedAt' | 'finalizedByUserId'>

export type CheckoutPayment = {
  method: PaymentMethod
  amount: string
  cashRegisterSessionId: string
  providerReference?: string
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  CREDIT_CARD: 'Crédito à vista',
  CREDIT_CARD_INSTALLMENT: 'Crédito parcelado',
  DEBIT_CARD: 'Cartão de débito',
  VOUCHER: 'Voucher',
  OTHER: 'Outro',
}
