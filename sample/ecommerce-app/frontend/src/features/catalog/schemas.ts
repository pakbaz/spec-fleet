import { z } from 'zod';

export const productSchema = z.object({
  productId: z.string(),
  name: z.string(),
  description: z.string(),
  priceMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  categoryId: z.string(),
  imageUrl: z.string(),
  stock: z.number().int().nonnegative(),
});
export type Product = z.infer<typeof productSchema>;

export const productPageSchema = z.object({
  items: z.array(productSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});
export type ProductPage = z.infer<typeof productPageSchema>;

export const categorySchema = z.object({
  categoryId: z.string(),
  name: z.string(),
  region: z.string(),
});
export type Category = z.infer<typeof categorySchema>;

export const categoryPageSchema = z.object({
  items: z.array(categorySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});
