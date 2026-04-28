import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { _resetMockState, _getCartState, _seedCart } from '@/test/msw/handlers';
import { ANON_CART_LS_KEY, useCart } from '../api';
import { useCartPersistence } from '../useCartPersistence';

const useIsAuthenticatedMock = vi.hoisted(() => vi.fn(() => false));
vi.mock('@azure/msal-react', async () => {
  const actual = await vi.importActual<typeof import('@azure/msal-react')>('@azure/msal-react');
  return {
    ...actual,
    useIsAuthenticated: useIsAuthenticatedMock,
  };
});

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function Wrapper(qc: QueryClient) {
  return function W({ children }: PropsWithChildren) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  _resetMockState();
  localStorage.clear();
  useIsAuthenticatedMock.mockReturnValue(false);
});

describe('useCartPersistence', () => {
  it('mirrors anonymous cart query data into localStorage', async () => {
    _seedCart([{ productId: 'p1', quantity: 1, name: 'Widget', unitPrice: 1299 }]);
    const qc = makeClient();
    renderHook(
      () => {
        useCartPersistence();
        return useCart();
      },
      { wrapper: Wrapper(qc) },
    );
    await waitFor(() => {
      const raw = localStorage.getItem(ANON_CART_LS_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw ?? '{}');
      expect(parsed.lines).toEqual([{ productId: 'p1', quantity: 1 }]);
    });
  });

  it('on sign-in, merges localStorage cart into server then clears it', async () => {
    localStorage.setItem(
      ANON_CART_LS_KEY,
      JSON.stringify({ v: 1, lines: [{ productId: 'p1', quantity: 2 }] }),
    );
    useIsAuthenticatedMock.mockReturnValue(true);
    const qc = makeClient();
    renderHook(() => useCartPersistence(), { wrapper: Wrapper(qc) });
    await waitFor(() => {
      expect(localStorage.getItem(ANON_CART_LS_KEY)).toBeNull();
    });
    expect(_getCartState().some((l) => l.productId === 'p1')).toBe(true);
  });

  it('handles a malformed localStorage payload gracefully', async () => {
    localStorage.setItem(ANON_CART_LS_KEY, '{not-json');
    useIsAuthenticatedMock.mockReturnValue(true);
    const qc = makeClient();
    await act(async () => {
      renderHook(() => useCartPersistence(), { wrapper: Wrapper(qc) });
    });
    // No throw, no merge
    expect(_getCartState()).toEqual([]);
  });
});
