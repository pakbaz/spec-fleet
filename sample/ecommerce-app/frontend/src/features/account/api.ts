import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '@/lib/api/client';

const profileSchema = z.object({
  customerId: z.string(),
  displayName: z.string(),
  email: z.string().email(),
  marketingOptIn: z.boolean(),
});
export type Profile = z.infer<typeof profileSchema>;

const orderSchema = z.object({
  orderId: z.string(),
  total: z.number(),
  currency: z.string().length(3),
  placedAt: z.string(),
  status: z.string(),
});
const ordersPageSchema = z.object({
  items: z.array(orderSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});

export const accountKeys = {
  profile: () => ['account', 'profile'] as const,
  orders: () => ['account', 'orders'] as const,
};

export function useProfile(): UseQueryResult<Profile> {
  return useQuery({
    queryKey: accountKeys.profile(),
    queryFn: async ({ signal }) => {
      const res = await api.get('/me/profile', { signal });
      return profileSchema.parse(res.data);
    },
  });
}

export function useUpdateProfile(): UseMutationResult<Profile, Error, Partial<Profile>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Profile>) => {
      const res = await api.patch('/me/profile', input);
      return profileSchema.parse(res.data);
    },
    onSuccess: (data) => qc.setQueryData(accountKeys.profile(), data),
  });
}

export function useOrders(): UseQueryResult<z.infer<typeof ordersPageSchema>> {
  return useQuery({
    queryKey: accountKeys.orders(),
    queryFn: async ({ signal }) => {
      const res = await api.get('/me/orders', { signal });
      return ordersPageSchema.parse(res.data);
    },
  });
}

export function useDataExport(): UseMutationResult<{ downloadUrl: string }, Error, void> {
  return useMutation({
    mutationFn: async () => {
      const res = await api.get('/me/data-export');
      return res.data as { downloadUrl: string };
    },
  });
}

export function useErasureRequest(): UseMutationResult<{ ticketId: string; status: string }, Error, void> {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post('/me/erasure-request', {});
      return res.data as { ticketId: string; status: string };
    },
  });
}

export function useMarketingPrefs(): UseMutationResult<{ optIn: boolean }, Error, { optIn: boolean }> {
  return useMutation({
    mutationFn: async (input) => {
      const res = await api.post('/me/preferences/marketing', input);
      return res.data as { optIn: boolean };
    },
  });
}
