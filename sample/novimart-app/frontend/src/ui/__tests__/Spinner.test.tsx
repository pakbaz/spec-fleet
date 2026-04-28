import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from '../Spinner';
import { VisuallyHidden } from '../VisuallyHidden';

describe('Spinner', () => {
  it('exposes accessible status with default label', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });
  it('uses custom label', () => {
    render(<Spinner label="Fetching" />);
    expect(screen.getByRole('status')).toHaveTextContent('Fetching');
  });
});

describe('VisuallyHidden', () => {
  it('renders content for screen readers', () => {
    render(<VisuallyHidden>secret</VisuallyHidden>);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});
