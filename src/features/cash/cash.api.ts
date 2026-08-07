import { apiRequest } from '../../lib/api'
import type { CashRegister,CashSession } from './cash.types'
const params=(establishmentId:string,extra:Record<string,string>={})=>new URLSearchParams({establishmentId,limit:'100',...extra})
export const listCashRegisters=(establishmentId:string)=>apiRequest<CashRegister[]>(`/v1/cash-registers?${params(establishmentId)}`)
export const listCashSessions=(establishmentId:string,status?:'OPEN'|'CLOSED')=>apiRequest<CashSession[]>(`/v1/cash-registers/sessions?${params(establishmentId,status?{status}:{})}`)
export const getCashSession=(id:string)=>apiRequest<CashSession>(`/v1/cash-registers/sessions/${id}`)
