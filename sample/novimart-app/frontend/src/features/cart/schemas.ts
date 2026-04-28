import { z } from 'zod';

export const cartLineSchema = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number().int().nonnegative(),
  unitPriceMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
});
export type CartLine = z.infer<typeof cartLineSchema>;

export const cartSchema = z.object({
  cartId: z.string(),
  items: z.array(cartLineSchema),
  subtotalMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
});
export type Cart = z.infer<typeof cartSchema>;

export interface AddCartItemInput {
  productId: string;
  quantity: number;
}

export interface UpdateCartItemInput {
  productId: string;
  quantity: number;
}
