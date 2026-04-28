import { useEffect, useRef, useState } from 'react';
import { Drawer } from '@/ui/Drawer';
import { Spinner } from '@/ui/Spinner';
import { useCart, useRemoveCartItem, useUpdateCartItem } from './api';
import { CartLineItem } from './CartLineItem';
import { CartSummary } from './CartSummary';
import { useCartPersistence } from './useCartPersistence';

interface Props {
  open: boolean;
  onClose: () => void;
}

const DEBOUNCE_MS = 300;

export function CartDrawer({ open, onClose }: Props) {
  useCartPersistence();
  const cart = useCart();
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const [pending, setPending] = useState<Record<string, number>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const ref = timers.current;
    return () => {
      for (const key of Object.keys(ref)) {
        const t = ref[key];
        if (t) clearTimeout(t);
      }
    };
  }, []);

  function scheduleQuantity(productId: string, quantity: number) {
    setPending((p) => ({ ...p, [productId]: quantity }));
    const existing = timers.current[productId];
    if (existing) clearTimeout(existing);
    timers.current[productId] = setTimeout(() => {
      update.mutate({ productId, quantity });
      delete timers.current[productId];
    }, DEBOUNCE_MS);
  }

  return (
    <Drawer open={open} onClose={onClose} title="Your cart" headingId="cart-heading">
      {cart.isLoading ? <Spinner label="Loading cart" /> : null}
      {cart.isError ? (
        <p role="alert" className="text-sm text-red-600">
          Couldn’t load your cart.
        </p>
      ) : null}
      {cart.data ? (
        cart.data.items.length === 0 ? (
          <p className="text-sm text-novimart-gray">Your cart is empty.</p>
        ) : (
          <>
            <ul aria-label="Cart items" className="mb-4">
              {cart.data.items.map((line) => (
                <CartLineItem
                  key={line.productId}
                  line={{ ...line, quantity: pending[line.productId] ?? line.quantity }}
                  onQuantityChange={scheduleQuantity}
                  onRemove={(id) => remove.mutate({ productId: id })}
                />
              ))}
            </ul>
            <CartSummary cart={cart.data} />
          </>
        )
      ) : null}
    </Drawer>
  );
}

export default CartDrawer;
