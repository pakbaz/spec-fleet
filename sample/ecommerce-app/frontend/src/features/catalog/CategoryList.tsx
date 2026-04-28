import { useCategories } from './api';

export function CategoryList() {
  const cats = useCategories();
  if (cats.isLoading) return <p className="text-sm text-acme-gray">Loading categories…</p>;
  if (cats.isError || !cats.data) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {cats.data.map((c) => (
        <li key={c.categoryId}>
          <span className="rounded bg-gray-100 px-2 py-1 text-xs">{c.name}</span>
        </li>
      ))}
    </ul>
  );
}
