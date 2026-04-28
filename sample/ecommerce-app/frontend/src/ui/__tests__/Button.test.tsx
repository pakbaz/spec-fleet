import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('renders children with default primary variant', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('invokes onClick', async () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>Tap</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Tap' }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects disabled state', () => {
    render(<Button disabled>Wait</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it.each(['secondary', 'ghost', 'danger'] as const)('renders %s variant', (variant) => {
    render(<Button variant={variant}>X</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
