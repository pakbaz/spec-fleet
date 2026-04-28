import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useToast } from '@/ui/Toast';
import {
  cartSchema,
  type AddCartItemInput,
  type Cart,
  type UpdateCartItemInput,
} from './schemas';

export const cartKeys = {
  all: ['cart'] as const,
  detail: () => ['cart', 'detail'] as const,
};

export const ANON_CART_LS_KEY = 'acme.cart.v1';

export function useCart(): UseQueryResult<Cart> {
  return useQuery({
    queryKey: cartKeys.detail(),
    queryFn: async ({ signal }) => {
      const res = await api.get('/cart', { signal });
      return cartSchema.parse(res.data);
    },
  });
}

interface OptimisticContext {
  previous: Cart | undefined;
}

function emptyCart(): Cart {
  return { cartId: 'optimistic', items: [], subtotalMinor: 0, currency: 'EUR' };
}

export function useAddCartItem(): UseMutationResult<Cart, Error, AddCartItemInput, OptimisticContext> {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationKey: ['cart', 'add'],
    mutationFn: async (input: AddCartItemInput) => {
      const res = await api.post('/cart/items', input);
      return cartSchema.parse(res.data);
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: cartKeys.detail() });
      const previous = qc.getQueryData<Cart>(cartKeys.detail());
      const base: Cart = previous ?? emptyCart();
      const existing = base.items.find((l) => l.productId === input.productId);
      const items = existing
        ? base.items.map((l) =>
            l.productId === input.productId ? { ...l, quantity: l.quantity + input.quantity } : l,
          )
        : [
            ...base.items,
            {
              productId: input.productId,
              name: input.productId,
              quantity: input.quantity,
              unitPriceMinor: 0,
              currency: base.currency,
            },
          ];
      const optimistic: Cart = {
        ...base,
        items,
        subtotalMinor: items.reduce((s, l) => s + l.unitPriceMinor * l.quantity, 0),
      };
      qc.setQueryData(cartKeys.detail(), optimistic);
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(cartKeys.detail(), ctx.previous);
      else qc.removeQueries({ queryKey: cartKeys.detail() });
      toast.show("Couldn't add — try again", 'error');
    },
    onSuccess: (server) => {
      qc.setQueryData(cartKeys.detail(), server);
    },
  });
}

export function useUpdateCartItem(): UseMutationResult<Cart, Error, UpdateCartItemInput, OptimisticContext> {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationKey: ['cart', 'update'],
    mutationFn: async (input: UpdateCartItemInput) => {
      const res = await api.patch(`/cart/items/${input.productId}`, { quantity: input.quantity });
      return cartSchema.parse(res.data);
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: cartKeys.detail() });
      const previous = qc.getQueryData<Cart>(cartKeys.detail());
      if (!previous) return { previous };
      const items = previous.items.map((l) =>
        l.productId === input.productId ? { ...l, quantity: input.quantity } : l,
      );
      qc.setQueryData(cartKeys.detail(), {
        ...previous,
        items,
        subtotalMinor: items.reduce((s, l) => s + l.unitPriceMinor * l.quantity, 0),
      });
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(cartKeys.detail(), ctx.previous);
      toast.show("Couldn't update — try again", 'error');
    },
    onSuccess: (server) => {
      qc.setQueryData(cartKeys.detail(), server);
    },
  });
}

export function useRemoveCartItem(): UseMutationResult<Cart, Error, { productId: string }, OptimisticContext> {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationKey: ['cart', 'remove'],
    mutationFn: async (input: { productId: string }) => {
      const res = await api.delete(`/cart/items/${input.productId}`);
      return cartSchema.parse(res.data);
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: cartKeys.detail() });
      const previous = qc.getQueryData<Cart>(cartKeys.detail());
      if (!previous) return { previous };
      const items = previous.items.filter((l) => l.productId !== input.productId);
      qc.setQueryData(cartKeys.detail(), {
        ...previous,
        items,
        subtotalMinor: items.reduce((s, l) => s + l.unitPriceMinor * l.quantity, 0),
      });
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(cartKeys.detail(), ctx.previous);
      toast.show("Couldn't remove — try again", 'error');
    },
    onSuccess: (server) => {
      qc.setQueryData(cartKeys.detail(), server);
    },
  });
}

export interface MergeCartInput {
  items: { productId: string; quantity: number }[];
}

export function useMergeAnonCart(): UseMutationResult<Cart, Error, MergeCartInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['cart', 'merge'],
    mutationFn: async (input: MergeCartInput) => {
      const res = await api.post('/cart/merge', input);
      return cartSchema.parse(res.data);
    },
    onSuccess: (server) => {
      qc.setQueryData(cartKeys.detail(), server);
    },
  });
}
