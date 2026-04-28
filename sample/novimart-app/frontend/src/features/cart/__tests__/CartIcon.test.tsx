import { describe, expect, it, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartIcon } from '../CartIcon';
import { _resetMockState, _seedCart } from '@/test/msw/handlers';

beforeEach(() => _resetMockState());

describe('CartIcon', () => {
  it('renders badge with item count', async () => {
    _seedCart([{ productId: 'p1', quantity: 3, name: 'Widget', unitPrice: 1299 }]);
    renderWithProviders(<CartIcon />);
    await waitFor(() => expect(screen.getByTestId('cart-badge')).toHaveTextContent('3'));
  });

  it('opens the drawer when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CartIcon />);
    await user.click(screen.getByTestId('cart-icon'));
    await waitFor(() => expect(screen.getByRole('dialog', { name: /your cart/i })).toBeInTheDocument());
  });
});
