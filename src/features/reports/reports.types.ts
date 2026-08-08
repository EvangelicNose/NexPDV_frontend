export type ReportOverview = {
  period: { from: string; to: string; timezone: string }
  establishment: { id: string; name: string }
  sales: { count: number; gross: string; refunded: string; net: string; averageTicket: string }
  salesByPeriod: Array<{ date: string; count: number; gross: string; refunded: string; net: string }>
  salesByPaymentMethod: Array<{ method: string; count: number; amount: string }>
  topProducts: Array<{ productId: string; name: string; quantity: string; total: string }>
  salesByOperator: Array<{ userId: string; name: string; count: number; total: string }>
  cancellations: { count: number; total: string; items: Array<{ id: string; total: string; cancellationReason?: string | null; cancelledAt: string }> }
  cashDifferences: Array<{ sessionId: string; cashRegister: string; closedAt: string; expected: string; counted: string; difference: string }>
  lowStock: Array<{ stockItemId: string; product: string; variant?: string | null; quantity: string; minimumQuantity: string }>
  stockMovements: Array<{ type: string; count: number; quantity: string }>
}

export type ReportFilters = { establishmentId: string; from: string; to: string; topProductsLimit?: number }
export type ReportExport = { jobId: string; status: string; result?: ReportOverview; error?: string }
