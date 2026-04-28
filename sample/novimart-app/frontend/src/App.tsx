import { Suspense } from 'react';
import { Link } from 'react-router-dom';
import { AppRoutes } from './app/routes';
import { CartIcon } from './features/cart/CartIcon';
import { Spinner } from './ui/Spinner';

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-novimart-blue">
            NoviMart
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-4">
            <Link to="/" className="text-sm hover:underline">
              Catalog
            </Link>
            <Link to="/account" className="text-sm hover:underline">
              Account
            </Link>
            <CartIcon />
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={<Spinner label="Loading…" />}>
          <AppRoutes />
        </Suspense>
      </main>
      <footer className="border-t border-gray-200 bg-gray-50 py-4 text-center text-xs text-novimart-gray">
        © {new Date().getFullYear()} NoviMart
      </footer>
    </div>
  );
}
