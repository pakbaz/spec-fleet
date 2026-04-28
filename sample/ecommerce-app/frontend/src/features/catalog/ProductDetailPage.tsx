import { useParams } from 'react-router-dom';
import { useProduct } from './api';
import { useAddCartItem } from '@/features/cart/api';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/Spinner';
import { formatPrice } from './ProductCard';

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const product = useProduct(productId);
  const add = useAddCartItem();

  if (product.isLoading) return <Spinner label="Loading product" />;
  if (product.isError || !product.data) {
    return (
      <p role="alert" className="text-sm text-red-600">
        Couldn’t load product.
      </p>
    );
  }
  const p = product.data;
  const outOfStock = p.stock <= 0;
  return (
    <article className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="aspect-square rounded bg-gray-100" aria-hidden="true" />
      <div>
        <h1 className="text-3xl font-semibold">{p.name}</h1>
        <p className="mt-2 text-acme-gray">{p.description}</p>
        <p className="mt-4 text-xl font-medium">{formatPrice(p.priceMinor, p.currency)}</p>
        <div className="mt-6">
          <Button
            disabled={outOfStock || add.isPending}
            onClick={() => add.mutate({ productId: p.productId, quantity: 1 })}
          >
            {outOfStock ? 'Out of stock' : 'Add to cart'}
          </Button>
        </div>
      </div>
    </article>
  );
}
