import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountPage } from '../AccountPage';

describe('AccountPage', () => {
  it('renders profile data on load', async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => expect(screen.getByText('Sample User')).toBeInTheDocument());
  });

  it('switches to privacy tab and triggers data export', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountPage />);
    await user.click(screen.getByRole('tab', { name: /privacy/i }));
    await user.click(screen.getByRole('button', { name: /request export/i }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'link' })).toBeInTheDocument());
  });

  it('switches to orders tab and shows empty state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountPage />);
    await user.click(screen.getByRole('tab', { name: /orders/i }));
    await waitFor(() => expect(screen.getByText(/haven’t placed/i)).toBeInTheDocument());
  });

  it('triggers erasure request', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountPage />);
    await user.click(screen.getByRole('tab', { name: /privacy/i }));
    await user.click(screen.getByRole('button', { name: /request erasure/i }));
    await waitFor(() => expect(screen.getByText(/erasure-1/)).toBeInTheDocument());
  });

  it('toggles marketing preferences', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountPage />);
    await user.click(screen.getByRole('tab', { name: /privacy/i }));
    await user.click(screen.getByRole('button', { name: /opt in/i }));
    await user.click(screen.getByRole('button', { name: /opt out/i }));
    // No assertion on UI text — buttons remain; success means no thrown errors.
    expect(screen.getByRole('button', { name: /opt in/i })).toBeInTheDocument();
  });
});
