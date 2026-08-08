import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { advanceOrder } from './orders.api'
import { getNextOrderStatus, orderStatus, type Order } from './orders.types'

export function OrderAdvanceButton({ order }: { order: Pick<Order, 'id' | 'status'> }) {
  const queryClient = useQueryClient()
  const next = getNextOrderStatus(order.status)
  const mutation = useMutation({
    mutationFn: () => advanceOrder(order),
    onSuccess: async updated => {
      queryClient.setQueryData(['order', order.id], updated)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders-board'] }),
      ])
    },
  })
  if (!next) return null
  return <div className="advance-order-action"><button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? <RefreshCw size={16} className="spin"/> : <ArrowRight size={16}/>} Avançar para {orderStatus[next].label}</button>{mutation.isError && <small>Não foi possível atualizar. O pedido pode ter sido alterado.</small>}</div>
}
