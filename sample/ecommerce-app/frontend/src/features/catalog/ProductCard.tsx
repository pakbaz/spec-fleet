import { Link } from 'react-router-dom';
import { useAddCartItem } from '@/features/cart/api';
import { Button } from '@/ui/Button';
import type { Product } from './schemas';

interface Props {
  product: Product;
}

export function formatPrice(minor: number, currency: string): string {
  const major = (minor / 100).toFixed(2);
  return `${major} ${currency}`;
}

export function ProductCard({ product }: Props) {
  const add = useAddCartItem();
  const outOfStock = product.stock <= 0;

  return (
    <article className="flex flex-col rounded border border-gray-200 p-4">
      <Link to={`/products/${product.productId}`} className="text-base font-semibold text-acme-blue">
        {product.name}
      </Link>
      <p className="mt-1 line-clamp-2 text-sm text-acme-gray">{product.description}</p>
      <p className="mt-2 text-sm font-medium">{formatPrice(product.priceMinor, product.currency)}</p>
      <div className="mt-3">
        <Button
          variant="primary"
          disabled={outOfStock || add.isPending}
          onClick={() => add.mutate({ productId: product.productId, quantity: 1 })}
          aria-label={`Add ${product.name} to cart`}
        >
          {outOfStock ? 'Out of stock' : 'Add to cart'}
        </Button>
      </div>
    </article>
  );
}
