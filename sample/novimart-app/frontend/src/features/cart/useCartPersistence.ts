import { useEffect, useRef } from 'react';
import { useIsAuthenticated } from '@azure/msal-react';
import { useQueryClient } from '@tanstack/react-query';
import { ANON_CART_LS_KEY, cartKeys, useMergeAnonCart } from './api';
import type { Cart } from './schemas';

interface AnonCartLine {
  productId: string;
  quantity: number;
}

interface AnonCart {
  v: 1;
  lines: AnonCartLine[];
}

function readAnonCart(): AnonCart | null {
  try {
    const raw = localStorage.getItem(ANON_CART_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnonCart;
    if (parsed?.v !== 1 || !Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeAnonCart(cart: AnonCart | null): void {
  if (!cart) {
    localStorage.removeItem(ANON_CART_LS_KEY);
    return;
  }
  localStorage.setItem(ANON_CART_LS_KEY, JSON.stringify(cart));
}

/**
 * For anonymous shoppers: mirrors the cart query into localStorage so it
 * survives reloads. On sign-in: pushes localStorage cart to the server merge
 * endpoint, then clears localStorage.
 */
export function useCartPersistence(): void {
  const qc = useQueryClient();
  const isAuth = useIsAuthenticated();
  const merge = useMergeAnonCart();
  const mergedRef = useRef(false);

  // Mirror anonymous cart -> localStorage
  useEffect(() => {
    if (isAuth) return;
    const unsubscribe = qc.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      if (key.length < 2 || key[0] !== 'cart' || key[1] !== 'detail') return;
      const data = qc.getQueryData<Cart>(cartKeys.detail());
      if (!data) return;
      writeAnonCart({
        v: 1,
        lines: data.items.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      });
    });
    return () => {
      unsubscribe();
    };
  }, [qc, isAuth]);

  // On sign-in, merge any anonymous cart up to the server (idempotent — backend dedupes)
  useEffect(() => {
    if (!isAuth || mergedRef.current) return;
    const anon = readAnonCart();
    if (!anon || anon.lines.length === 0) {
      mergedRef.current = true;
      return;
    }
    mergedRef.current = true;
    merge.mutate(
      { items: anon.lines },
      {
        onSuccess: () => {
          writeAnonCart(null);
          void qc.invalidateQueries({ queryKey: cartKeys.detail() });
        },
      },
    );
  }, [isAuth, merge, qc]);
}
