interface Props {
  label?: string;
  className?: string;
}

export function Spinner({ label = 'Loading', className = '' }: Props) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center gap-2 ${className}`}>
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-acme-blue border-t-transparent"
      />
      <span className="text-sm text-acme-gray">{label}</span>
    </div>
  );
}
