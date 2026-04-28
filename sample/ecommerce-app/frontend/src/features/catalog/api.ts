import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  productSchema,
  productPageSchema,
  categoryPageSchema,
  type Product,
  type ProductPage,
  type Category,
} from './schemas';

export interface ProductSearchParams {
  q?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}

export const catalogKeys = {
  all: ['catalog'] as const,
  products: (p: ProductSearchParams) => ['catalog', 'products', p] as const,
  product: (id: string) => ['catalog', 'product', id] as const,
  categories: () => ['catalog', 'categories'] as const,
};

export function useProductSearch(params: ProductSearchParams = {}): UseQueryResult<ProductPage> {
  return useQuery({
    queryKey: catalogKeys.products(params),
    queryFn: async ({ signal }) => {
      const res = await api.get('/products', { params, signal });
      return productPageSchema.parse(res.data);
    },
  });
}

export function useProduct(productId: string | undefined): UseQueryResult<Product> {
  return useQuery({
    queryKey: catalogKeys.product(productId ?? ''),
    enabled: Boolean(productId),
    queryFn: async ({ signal }) => {
      const res = await api.get(`/products/${productId}`, { signal });
      return productSchema.parse(res.data);
    },
  });
}

export function useCategories(): UseQueryResult<Category[]> {
  return useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: async ({ signal }) => {
      const res = await api.get('/categories', { signal });
      return categoryPageSchema.parse(res.data).items;
    },
  });
}
