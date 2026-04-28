import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutPage } from '../CheckoutPage';
import { OrderSuccessPage } from '../OrderSuccessPage';

describe('CheckoutPage', () => {
  it('submits address and redirects to provider URL', async () => {
    const assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: assignSpy },
    });
    const user = userEvent.setup();
    renderWithProviders(<CheckoutPage />);
    await user.type(screen.getByLabelText('Address line 1'), '1 Test St');
    await user.type(screen.getByLabelText('City'), 'Berlin');
    await user.type(screen.getByLabelText('Postal code'), '10115');
    await user.click(screen.getByRole('button', { name: /continue to payment/i }));
    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith(expect.stringContaining('payments.example.com')));
  });
});

describe('OrderSuccessPage', () => {
  it('shows order info when session_id is present', async () => {
    renderWithProviders(<OrderSuccessPage />, { route: '/checkout/success?session_id=sess-123' });
    await waitFor(() => expect(screen.getByText(/Thanks for your order/i)).toBeInTheDocument());
    expect(screen.getByText(/ord-1/)).toBeInTheDocument();
  });

  it('shows alert when session_id missing', () => {
    renderWithProviders(<OrderSuccessPage />, { route: '/checkout/success' });
    expect(screen.getByRole('alert')).toHaveTextContent(/missing/i);
  });
});
