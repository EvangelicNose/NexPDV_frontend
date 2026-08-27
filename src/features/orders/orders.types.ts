export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'IN_PREPARATION' | 'READY' | 'DELIVERED' | 'CANCELLED'
export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'COUNTER'
export type OrderItem = { id: string; productNameSnapshot: string; variantNameSnapshot?: string | null; quantity: string; unitPrice: string; total: string; notes?: string | null; options: Array<{ id: string; optionNameSnapshot: string; quantity: number; total: string }> }
export type Order = { id: string; sequence: number; status: OrderStatus; type: OrderType; total: string; subtotal: string; additions: string; discount: string; fees: string; notes?: string | null; customer?: Record<string, unknown> | null; deliveryAddress?: Record<string, unknown> | null; createdAt: string; confirmedAt?: string | null; deliveredAt?: string | null; cancellationReason?: string | null; items: OrderItem[]; sale?: SaleSummary | null }
export type Tab={id:string;label?:string|null;status:'OPEN'|'CLOSED'|'CANCELLED';table?:{id:string;number?:number;name?:string|null}|null;customers?:Array<{id:string;name:string}>}
export const orderStatus = { DRAFT:{label:'Rascunho',className:'neutral'},CONFIRMED:{label:'Confirmado',className:'blue'},IN_PREPARATION:{label:'Em preparo',className:'amber'},READY:{label:'Pronto',className:'green'},DELIVERED:{label:'Entregue',className:'success'},CANCELLED:{label:'Cancelado',className:'coral'} } satisfies Record<OrderStatus,{label:string;className:string}>
export const orderType = { DINE_IN:'Salão',TAKEAWAY:'Retirada',DELIVERY:'Delivery',COUNTER:'Balcão' } satisfies Record<OrderType,string>
export const nextOrderStatus = {
  DRAFT: 'CONFIRMED',
  CONFIRMED: 'IN_PREPARATION',
  IN_PREPARATION: 'READY',
  READY: 'DELIVERED',
  DELIVERED: null,
  CANCELLED: null,
} satisfies Record<OrderStatus, OrderStatus | null>

export const getNextOrderStatus = (status: OrderStatus) => nextOrderStatus[status]
import type { SaleSummary } from '../sales/sales.types'
