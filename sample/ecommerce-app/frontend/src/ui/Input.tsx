import { forwardRef, useId, type InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, id, className = '', ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const errId = `${inputId}-err`;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={inputId} className="font-medium text-acme-gray">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errId : undefined}
        className={`rounded border px-3 py-2 text-sm ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <span id={errId} role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </div>
  );
});
