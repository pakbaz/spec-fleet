import { Button } from '@/ui/Button';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}

export function Paginator({ page, pageSize, total, onPageChange }: Props) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (last <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <span className="text-sm">
        Page {page} of {last}
      </span>
      <Button
        variant="secondary"
        disabled={page >= last}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
