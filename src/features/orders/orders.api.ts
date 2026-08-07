import { apiRequest } from '../../lib/api'
import type { Order, OrderStatus, OrderType } from './orders.types'
export const listOrders=(input:{establishmentId:string;status?:OrderStatus;type?:OrderType;limit?:number})=>{const query=new URLSearchParams({establishmentId:input.establishmentId,limit:String(input.limit??100)});if(input.status)query.set('status',input.status);if(input.type)query.set('type',input.type);return apiRequest<Order[]>(`/v1/orders?${query}`)}
export const getOrder=(id:string)=>apiRequest<Order>(`/v1/orders/${id}`)
