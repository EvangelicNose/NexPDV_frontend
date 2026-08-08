import { apiRequest } from '../../lib/api'
import { getNextOrderStatus, type Order, type OrderStatus, type OrderType, type Tab } from './orders.types'
export const listOrders=(input:{establishmentId:string;status?:OrderStatus;type?:OrderType;limit?:number})=>{const query=new URLSearchParams({establishmentId:input.establishmentId,limit:String(input.limit??100)});if(input.status)query.set('status',input.status);if(input.type)query.set('type',input.type);return apiRequest<Order[]>(`/v1/orders?${query}`)}
export const getOrder=(id:string)=>apiRequest<Order>(`/v1/orders/${id}`)
export const listOpenTabs=(establishmentId:string)=>apiRequest<Tab[]>(`/v1/tabs?establishmentId=${establishmentId}&status=OPEN&limit=100`)
export const createOrder=(input:{establishmentId:string;tabId?:string;type:OrderType;notes?:string;customer?:Record<string,unknown>;deliveryAddress?:Record<string,unknown>;discount:number;fees:number;items:Array<{productId:string;productVariantId?:string;quantity:number;options:never[];discount:number;notes?:string}>})=>apiRequest<Order>('/v1/orders',{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(input)})

export const transitionOrder = (id: string, status: Exclude<OrderStatus, 'DRAFT' | 'CANCELLED'>) =>
  apiRequest<Order>(`/v1/orders/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })

export const advanceOrder = (order: Pick<Order, 'id' | 'status'>) => {
  const next = getNextOrderStatus(order.status)
  if (!next) {
    return Promise.reject(new Error('Este pedido já está em um status final.'))
  }
  return transitionOrder(order.id, next)
}
