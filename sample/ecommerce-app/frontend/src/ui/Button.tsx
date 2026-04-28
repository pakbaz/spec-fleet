import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  primary: 'bg-acme-blue text-white hover:bg-blue-700 disabled:bg-blue-300',
  secondary: 'bg-white border border-gray-300 text-acme-gray hover:bg-gray-50',
  ghost: 'bg-transparent text-acme-blue hover:bg-blue-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', className = '', type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium transition-colors ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
