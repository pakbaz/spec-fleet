import { Input } from '@/ui/Input';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  return (
    <form
      role="search"
      onSubmit={(e) => e.preventDefault()}
      className="max-w-md"
    >
      <Input
        label="Search products"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search…"
      />
    </form>
  );
}
