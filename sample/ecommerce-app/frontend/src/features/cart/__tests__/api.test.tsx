import { describe, expect, it, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { _resetMockState, _seedCart } from '@/test/msw/handlers';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { cartKeys, useAddCartItem, useCart, useRemoveCartItem, useUpdateCartItem, useMergeAnonCart } from '../api';
import { ToastProvider } from '@/ui/Toast';

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={qc}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => _resetMockState());

describe('cart api keys', () => {
  it('exposes stable mutation/query keys', () => {
    expect(cartKeys.all).toEqual(['cart']);
    expect(cartKeys.detail()).toEqual(['cart', 'detail']);
  });
});

describe('useAddCartItem', () => {
  it('optimistically adds and resolves with server cart', async () => {
    const qc = makeClient();
    const { result } = renderHook(
      () => ({ cart: useCart(), add: useAddCartItem() }),
      { wrapper: wrapper(qc) },
    );
    await waitFor(() => expect(result.current.cart.data).toBeDefined());
    await act(async () => {
      await result.current.add.mutateAsync({ productId: 'p1', quantity: 2 });
    });
    await waitFor(() => expect(result.current.cart.data?.items).toHaveLength(1));
    expect(result.current.cart.data?.items[0]?.productId).toBe('p1');
    expect(result.current.cart.data?.items[0]?.quantity).toBe(2);
  });

  it('rolls back on server error', async () => {
    server.use(http.post('/api/cart/items', () => HttpResponse.json({}, { status: 500 })));
    const qc = makeClient();
    const { result } = renderHook(
      () => ({ cart: useCart(), add: useAddCartItem() }),
      { wrapper: wrapper(qc) },
    );
    await waitFor(() => expect(result.current.cart.data).toBeDefined());
    await act(async () => {
      await result.current.add.mutateAsync({ productId: 'p1', quantity: 1 }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.add.isError).toBe(true));
    expect(result.current.cart.data?.items).toHaveLength(0);
  });
});

describe('useUpdateCartItem', () => {
  it('updates and rolls back on error', async () => {
    _seedCart([{ productId: 'p1', quantity: 1, name: 'Widget', unitPrice: 1299 }]);
    const qc = makeClient();
    const { result } = renderHook(
      () => ({ cart: useCart(), update: useUpdateCartItem() }),
      { wrapper: wrapper(qc) },
    );
    await waitFor(() => expect(result.current.cart.data?.items).toHaveLength(1));
    await act(async () => {
      await result.current.update.mutateAsync({ productId: 'p1', quantity: 7 });
    });
    await waitFor(() => expect(result.current.cart.data?.items[0]?.quantity).toBe(7));

    server.use(http.patch('/api/cart/items/:id', () => HttpResponse.json({}, { status: 500 })));
    await act(async () => {
      await result.current.update.mutateAsync({ productId: 'p1', quantity: 2 }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.cart.data?.items[0]?.quantity).toBe(7));
  });
});

describe('useRemoveCartItem', () => {
  it('removes optimistically then resolves', async () => {
    _seedCart([{ productId: 'p1', quantity: 1, name: 'Widget', unitPrice: 1299 }]);
    const qc = makeClient();
    const { result } = renderHook(
      () => ({ cart: useCart(), remove: useRemoveCartItem() }),
      { wrapper: wrapper(qc) },
    );
    await waitFor(() => expect(result.current.cart.data?.items).toHaveLength(1));
    await act(async () => {
      await result.current.remove.mutateAsync({ productId: 'p1' });
    });
    await waitFor(() => expect(result.current.cart.data?.items).toHaveLength(0));
  });
});

describe('useMergeAnonCart', () => {
  it('posts the local cart and stores result in the query cache', async () => {
    const qc = makeClient();
    const { result } = renderHook(() => useMergeAnonCart(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ items: [{ productId: 'p1', quantity: 3 }] });
    });
    expect(qc.getQueryData(cartKeys.detail())).toBeDefined();
  });
});
