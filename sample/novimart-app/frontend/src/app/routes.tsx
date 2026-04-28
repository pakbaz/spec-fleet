import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import NotFound from './NotFound';

const ProductGrid = lazy(() =>
  import('@/features/catalog/ProductGrid').then((m) => ({ default: m.ProductGrid })),
);
const ProductDetailPage = lazy(() =>
  import('@/features/catalog/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })),
);
const CheckoutPage = lazy(() =>
  import('@/features/checkout/CheckoutPage').then((m) => ({ default: m.CheckoutPage })),
);
const OrderSuccessPage = lazy(() =>
  import('@/features/checkout/OrderSuccessPage').then((m) => ({ default: m.OrderSuccessPage })),
);
const AccountPage = lazy(() =>
  import('@/features/account/AccountPage').then((m) => ({ default: m.AccountPage })),
);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ProductGrid />} />
      <Route path="/products/:productId" element={<ProductDetailPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/checkout/success" element={<OrderSuccessPage />} />
      <Route path="/account/*" element={<AccountPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
