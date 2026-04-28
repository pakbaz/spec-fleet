import { Link } from 'react-router-dom';
import { Button } from '@/ui/Button';
import type { Cart } from './schemas';

interface Props {
  cart: Cart;
}

export function CartSummary({ cart }: Props) {
  const total = (cart.subtotalMinor / 100).toFixed(2);
  return (
    <div className="border-t border-gray-200 pt-3">
      <p className="flex items-center justify-between text-sm font-medium">
        <span>Subtotal</span>
        <span>
          {total} {cart.currency}
        </span>
      </p>
      <Link to="/checkout" className="mt-3 block">
        <Button variant="primary" disabled={cart.items.length === 0} className="w-full">
          Checkout
        </Button>
      </Link>
    </div>
  );
}
