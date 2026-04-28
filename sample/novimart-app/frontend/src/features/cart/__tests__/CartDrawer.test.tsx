import { describe, expect, it, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { _resetMockState, _seedCart } from '@/test/msw/handlers';
import { renderWithProviders } from '@/test/renderWithProviders';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartDrawer } from '../CartDrawer';
import { ToastProvider } from '@/ui/Toast';

beforeEach(() => {
  _resetMockState();
});

function renderDrawer() {
  return renderWithProviders(
    <ToastProvider>
      <CartDrawer open onClose={() => {}} />
    </ToastProvider>,
  );
}

describe('CartDrawer', () => {
  it('opens with empty state', async () => {
    renderDrawer();
    await waitFor(() => expect(screen.getByText(/empty/i)).toBeInTheDocument());
  });

  it('displays line items', async () => {
    _seedCart([{ productId: 'p1', quantity: 2, name: 'Widget', unitPrice: 1299 }]);
    renderDrawer();
    await waitFor(() => expect(screen.getByText('Widget')).toBeInTheDocument());
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('removes a line on click', async () => {
    _seedCart([{ productId: 'p1', quantity: 1, name: 'Widget', unitPrice: 1299 }]);
    const user = userEvent.setup();
    renderDrawer();
    await waitFor(() => expect(screen.getByText('Widget')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /remove widget/i }));
    await waitFor(() => expect(screen.queryByText('Widget')).not.toBeInTheDocument());
  });

  it('rolls back on remove failure and surfaces a toast', async () => {
    _seedCart([{ productId: 'p1', quantity: 1, name: 'Widget', unitPrice: 1299 }]);
    server.use(http.delete('/api/cart/items/:id', () => HttpResponse.json({}, { status: 500 })));
    const user = userEvent.setup();
    renderDrawer();
    await waitFor(() => expect(screen.getByText('Widget')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /remove widget/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/couldn't remove/i),
    );
    expect(screen.getByText('Widget')).toBeInTheDocument();
  });

  it('debounces quantity updates by 300ms', async () => {
    _seedCart([{ productId: 'p1', quantity: 1, name: 'Widget', unitPrice: 1299 }]);
    let patchCount = 0;
    server.use(
      http.patch('/api/cart/items/:id', async ({ request, params }) => {
        patchCount += 1;
        const body = (await request.json()) as { quantity: number };
        return HttpResponse.json({
          cartId: 'c',
          items: [
            { productId: String(params.id), name: 'Widget', quantity: body.quantity, unitPriceMinor: 1299, currency: 'EUR' },
          ],
          subtotalMinor: 1299 * body.quantity,
          currency: 'EUR',
        });
      }),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDrawer();
    await waitFor(() => expect(screen.getByText('Widget')).toBeInTheDocument());
    const input = screen.getByLabelText(/quantity for widget/i);
    await user.clear(input);
    await user.type(input, '5');
    expect(patchCount).toBe(0);
    vi.advanceTimersByTime(350);
    await waitFor(() => expect(patchCount).toBeGreaterThanOrEqual(1));
    vi.useRealTimers();
  });

  it('Esc closes the drawer (calls onClose)', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <ToastProvider>
        <CartDrawer open onClose={onClose} />
      </ToastProvider>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
