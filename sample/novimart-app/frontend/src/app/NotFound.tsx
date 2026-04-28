import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 text-novimart-gray">The page you’re looking for doesn’t exist.</p>
      <Link to="/" className="mt-6 text-novimart-blue underline">
        Back to catalog
      </Link>
    </div>
  );
}
