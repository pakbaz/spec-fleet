import { useOrders } from './api';
import { Spinner } from '@/ui/Spinner';
import { format } from 'date-fns';

export function OrdersTab() {
  const orders = useOrders();
  if (orders.isLoading) return <Spinner label="Loading orders" />;
  if (orders.isError || !orders.data) return <p role="alert">Couldn’t load orders.</p>;
  if (orders.data.items.length === 0) {
    return <p className="text-sm text-novimart-gray">You haven’t placed any orders yet.</p>;
  }
  return (
    <ul className="grid gap-2">
      {orders.data.items.map((o) => (
        <li key={o.orderId} className="rounded border border-gray-200 p-3 text-sm">
          <p className="font-medium">{o.orderId}</p>
          <p className="text-novimart-gray">
            {format(new Date(o.placedAt), 'PP')} · {o.total} {o.currency} · {o.status}
          </p>
        </li>
      ))}
    </ul>
  );
}
