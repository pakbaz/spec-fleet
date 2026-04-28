import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '@/lib/api/client';

export interface CreateCheckoutSessionInput {
  shippingAddress: {
    line1: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

const sessionSchema = z.object({
  sessionId: z.string(),
  providerUrl: z.string().url(),
});
export type CheckoutSession = z.infer<typeof sessionSchema>;

const completionSchema = z.object({
  orderId: z.string(),
  status: z.string(),
  sessionId: z.string(),
});
export type CheckoutCompletion = z.infer<typeof completionSchema>;

export function useCreateCheckoutSession(): UseMutationResult<CheckoutSession, Error, CreateCheckoutSessionInput> {
  return useMutation({
    mutationKey: ['checkout', 'session'],
    mutationFn: async (input: CreateCheckoutSessionInput) => {
      const res = await api.post('/checkout/session', input);
      return sessionSchema.parse(res.data);
    },
  });
}

export function useCheckoutCompletion(sessionId: string | undefined): UseQueryResult<CheckoutCompletion> {
  return useQuery<CheckoutCompletion>({
    queryKey: ['checkout', 'complete', sessionId],
    enabled: Boolean(sessionId),
    refetchInterval: (q) => {
      const data = q.state.data;
      return data?.status === 'paid' ? false : 2000;
    },
    queryFn: async ({ signal }) => {
      const res = await api.get('/checkout/complete', { params: { session_id: sessionId }, signal });
      return completionSchema.parse(res.data);
    },
  });
}
