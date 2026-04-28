import { useState } from 'react';
import { useProductSearch } from './api';
import { ProductCard } from './ProductCard';
import { SearchBar } from './SearchBar';
import { Paginator } from './Paginator';
import { Spinner } from '@/ui/Spinner';

const PAGE_SIZE = 12;

export function ProductGrid() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useProductSearch({ ...(q ? { q } : {}), page, pageSize: PAGE_SIZE });

  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold">Catalog</h1>
      <SearchBar
        value={q}
        onChange={(v) => {
          setQ(v);
          setPage(1);
        }}
      />
      {search.isLoading ? <Spinner label="Loading products" /> : null}
      {search.isError ? (
        <p role="alert" className="text-sm text-red-600">
          Failed to load products.
        </p>
      ) : null}
      {search.data ? (
        <>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {search.data.items.map((p) => (
              <li key={p.productId}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
          {search.data.items.length === 0 ? (
            <p className="mt-6 text-sm text-novimart-gray">No products match your search.</p>
          ) : null}
          <Paginator
            page={page}
            pageSize={PAGE_SIZE}
            total={search.data.total}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </section>
  );
}
