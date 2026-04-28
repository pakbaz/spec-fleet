import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../Toast';

function Trigger({ message, tone }: { message: string; tone?: 'info' | 'error' | 'success' }) {
  const t = useToast();
  return (
    <button type="button" onClick={() => t.show(message, tone)}>
      go
    </button>
  );
}

describe('Toast', () => {
  it('shows then auto-dismisses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Trigger message="Hello" tone="info" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByText('Hello')).toBeInTheDocument();
    vi.advanceTimersByTime(4500);
    await waitFor(() => expect(screen.queryByText('Hello')).not.toBeInTheDocument());
    vi.useRealTimers();
  });

  it('renders error tone with role=alert', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger message="Boom" tone="error" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
  });

  it('renders success tone', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger message="Yay" tone="success" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByText('Yay')).toBeInTheDocument();
  });

  it('useToast outside provider is a no-op', () => {
    function Bare() {
      const t = useToast();
      t.show('nothing');
      return <p>ok</p>;
    }
    render(<Bare />);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});
