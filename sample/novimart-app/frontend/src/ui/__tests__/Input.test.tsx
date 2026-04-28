import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../Input';

describe('Input', () => {
  it('associates label and input via htmlFor/id', () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInTheDocument();
  });

  it('accepts user input and forwards onChange', async () => {
    const fn = vi.fn();
    render(<Input label="Name" onChange={fn} />);
    await userEvent.type(screen.getByLabelText('Name'), 'a');
    expect(fn).toHaveBeenCalled();
  });

  it('shows error and sets aria-invalid', () => {
    render(<Input label="Email" error="Required" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });
});
