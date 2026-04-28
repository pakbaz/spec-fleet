import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductGrid } from '../ProductGrid';
import { ProductCard, formatPrice } from '../ProductCard';
import { CategoryList } from '../CategoryList';

describe('catalog formatPrice', () => {
  it('formats minor units to currency string', () => {
    expect(formatPrice(1299, 'EUR')).toBe('12.99 EUR');
  });
});

describe('ProductGrid', () => {
  it('renders products from the API', async () => {
    renderWithProviders(<ProductGrid />);
    await waitFor(() => expect(screen.getByText('Widget')).toBeInTheDocument());
    expect(screen.getByText('Gadget')).toBeInTheDocument();
  });

  it('filters via search', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductGrid />);
    await waitFor(() => expect(screen.getByText('Widget')).toBeInTheDocument());
    await user.type(screen.getByLabelText('Search products'), 'gad');
    await waitFor(() => expect(screen.queryByText('Widget')).not.toBeInTheDocument());
    expect(screen.getByText('Gadget')).toBeInTheDocument();
  });
});

describe('ProductCard', () => {
  it('disables button when out of stock', () => {
    renderWithProviders(
      <ProductCard
        product={{
          productId: 'x',
          name: 'X',
          description: 'd',
          priceMinor: 100,
          currency: 'EUR',
          categoryId: 'c1',
          imageUrl: '/img.png',
          stock: 0,
        }}
      />,
    );
    expect(screen.getByRole('button', { name: /add x to cart/i })).toBeDisabled();
  });
});

describe('CategoryList', () => {
  it('renders categories', async () => {
    renderWithProviders(<CategoryList />);
    await waitFor(() => expect(screen.getByText('Tools')).toBeInTheDocument());
  });
});
