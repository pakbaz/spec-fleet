import { lazy, Suspense, useState } from 'react';
import { useCart } from './api';

const CartDrawer = lazy(() => import('./CartDrawer'));

export function CartIcon() {
  const [open, setOpen] = useState(false);
  const cart = useCart();
  const count = cart.data?.items.reduce((s, l) => s + l.quantity, 0) ?? 0;
  return (
    <>
      <button
        type="button"
        aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="relative inline-flex items-center rounded p-1 text-sm hover:bg-gray-100"
        data-testid="cart-icon"
      >
        <span aria-hidden="true">🛒</span>
        <span
          aria-hidden="true"
          className="ml-1 rounded-full bg-novimart-blue px-2 py-0.5 text-xs text-white"
          data-testid="cart-badge"
        >
          {count}
        </span>
      </button>
      {open ? (
        <Suspense fallback={null}>
          <CartDrawer open={open} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
