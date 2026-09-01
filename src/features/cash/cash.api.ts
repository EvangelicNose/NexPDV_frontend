import { apiRequest } from '../../lib/api'
import type { CashMovement,CashMovementType,CashRegister,CashRegisterPaymentMethod,CashSession } from './cash.types'
const params=(establishmentId:string,extra:Record<string,string>={})=>new URLSearchParams({establishmentId,limit:'100',...extra})
export const listCashRegisters=(establishmentId:string)=>apiRequest<CashRegister[]>(`/v1/cash-registers?${params(establishmentId)}`)
export const listCashSessions=(establishmentId:string,status?:'OPEN'|'CLOSED')=>apiRequest<CashSession[]>(`/v1/cash-registers/sessions?${params(establishmentId,status?{status}:{})}`)
export const getCashSession=(id:string)=>apiRequest<CashSession>(`/v1/cash-registers/sessions/${id}`)
export const createCashRegister=(input:{establishmentId:string;name:string;code:string;active:boolean;paymentMethods:CashRegisterPaymentMethod[]})=>apiRequest<CashRegister>('/v1/cash-registers',{
  method:'POST',
  body:JSON.stringify(input),
})
export const updateCashRegister=(id:string,input:{name?:string;code?:string;active?:boolean;paymentMethods?:CashRegisterPaymentMethod[]})=>apiRequest<CashRegister>(`/v1/cash-registers/${id}`,{
  method:'PATCH',
  body:JSON.stringify(input),
})
export const openCashRegister=(cashRegisterId:string,openingAmount:string)=>apiRequest<CashSession>(`/v1/cash-registers/${cashRegisterId}/open`,{
  method:'POST',
  headers:{'Idempotency-Key':crypto.randomUUID()},
  body:JSON.stringify({openingAmount}),
})
export const closeCashSession=(sessionId:string,countedAmount:string)=>apiRequest<CashSession>(`/v1/cash-registers/sessions/${sessionId}/close`,{
  method:'POST',
  headers:{'Idempotency-Key':crypto.randomUUID()},
  body:JSON.stringify({countedAmount}),
})
export const createCashMovement=(sessionId:string,input:{type:Extract<CashMovementType,'DEPOSIT'|'WITHDRAWAL'>;amount:string;reason:string})=>apiRequest<CashMovement>(`/v1/cash-registers/sessions/${sessionId}/movements`,{
  method:'POST',
  headers:{'Idempotency-Key':crypto.randomUUID()},
  body:JSON.stringify(input),
})
