import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Drawer } from '../Drawer';

function Wrap({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = React.useState(initialOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        opener
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Hi">
        <button type="button">first</button>
        <input aria-label="middle" />
        <button type="button">last</button>
      </Drawer>
    </>
  );
}

import React from 'react';

describe('Drawer', () => {
  it('renders dialog with accessible label', () => {
    render(<Wrap />);
    expect(screen.getByRole('dialog', { name: 'Hi' })).toBeInTheDocument();
  });

  it('Esc closes the drawer', async () => {
    const user = userEvent.setup();
    render(<Wrap />);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clicking overlay closes', async () => {
    const user = userEvent.setup();
    render(<Wrap />);
    await user.click(screen.getByRole('button', { name: 'Close drawer overlay' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('close button closes', async () => {
    const user = userEvent.setup();
    render(<Wrap />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('focus trap cycles forward through focusable elements', async () => {
    const user = userEvent.setup();
    render(<Wrap />);
    const last = screen.getByRole('button', { name: 'last' });
    last.focus();
    await user.tab();
    // After tabbing past the last focusable, focus wraps to the first focusable inside the dialog.
    const close = screen.getByRole('button', { name: 'Close' });
    expect(document.activeElement).toBe(close);
  });

  it('focus trap cycles backward with shift+Tab', async () => {
    const user = userEvent.setup();
    render(<Wrap />);
    const close = screen.getByRole('button', { name: 'Close' });
    close.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'last' }));
  });

  it('returns null when closed', () => {
    render(<Drawer open={false} onClose={() => {}} title="Hidden" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
