import type { PaymentMethod } from '../sales/sales.types'

export type CashRegisterPaymentMethod={method:PaymentMethod;operationFeePercent?:number|string|null}
export type CashRegister={id:string;establishmentId:string;name:string;code:string;active:boolean;paymentMethods:CashRegisterPaymentMethod[];createdAt:string;updatedAt:string}
export type CashMovementType='OPENING'|'SALE'|'WITHDRAWAL'|'DEPOSIT'|'REFUND'|'CLOSING_ADJUSTMENT'
export type CashMovement={id:string;type:CashMovementType;amount:string;reason?:string|null;referenceId?:string|null;createdAt:string}
export type CashSession={id:string;cashRegisterId:string;status:'OPEN'|'CLOSED';openingAmount:string;expectedAmount?:string|null;closingExpectedAmount?:string|null;closingCountedAmount?:string|null;closingDifference?:string|null;openedAt:string;closedAt?:string|null;cashRegister:Pick<CashRegister,'id'|'name'|'code'|'paymentMethods'>;movements?:CashMovement[]}
export const movementLabels:Record<CashMovementType,string>={OPENING:'Abertura',SALE:'Venda',WITHDRAWAL:'Sangria',DEPOSIT:'Suprimento',REFUND:'Estorno',CLOSING_ADJUSTMENT:'Ajuste de fechamento'}
