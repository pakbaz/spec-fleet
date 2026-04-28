import { http, HttpResponse } from 'msw';

interface CartLineState {
  productId: string;
  quantity: number;
  name: string;
  unitPrice: number;
}

const productsDb = [
  { productId: 'p1', name: 'Widget', priceMinor: 1299, currency: 'EUR', categoryId: 'c1', description: 'A widget.', imageUrl: '/img/p1.png', stock: 10 },
  { productId: 'p2', name: 'Gadget', priceMinor: 2599, currency: 'EUR', categoryId: 'c1', description: 'A gadget.', imageUrl: '/img/p2.png', stock: 3 },
  { productId: 'p3', name: 'Gizmo', priceMinor: 4999, currency: 'EUR', categoryId: 'c2', description: 'A gizmo.', imageUrl: '/img/p3.png', stock: 0 },
];

const categoriesDb = [
  { categoryId: 'c1', name: 'Tools', region: 'EU' },
  { categoryId: 'c2', name: 'Toys', region: 'EU' },
];

let cartState: CartLineState[] = [];

export function _resetMockState() {
  cartState = [];
}

export function _seedCart(lines: CartLineState[]) {
  cartState = [...lines];
}

export function _getCartState(): CartLineState[] {
  return [...cartState];
}

const base = '/api';

function cartResponse() {
  return {
    cartId: 'cart-1',
    items: cartState.map((l) => ({
      productId: l.productId,
      name: l.name,
      quantity: l.quantity,
      unitPriceMinor: l.unitPrice,
      currency: 'EUR',
    })),
    subtotalMinor: cartState.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    currency: 'EUR',
  };
}

export const handlers = [
  http.get(`${base}/products`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase() ?? '';
    const items = productsDb.filter((p) => !q || p.name.toLowerCase().includes(q));
    return HttpResponse.json({ items, page: 1, pageSize: 20, total: items.length });
  }),
  http.get(`${base}/products/:id`, ({ params }) => {
    const p = productsDb.find((x) => x.productId === params.id);
    if (!p) return HttpResponse.json({ code: 'not_found', message: 'not found' }, { status: 404 });
    return HttpResponse.json(p);
  }),
  http.get(`${base}/categories`, () =>
    HttpResponse.json({ items: categoriesDb, page: 1, pageSize: 50, total: categoriesDb.length }),
  ),
  http.get(`${base}/cart`, () => HttpResponse.json(cartResponse())),
  http.post(`${base}/cart/items`, async ({ request }) => {
    const body = (await request.json()) as { productId: string; quantity: number };
    const product = productsDb.find((p) => p.productId === body.productId);
    if (!product) {
      return HttpResponse.json({ code: 'not_found', message: 'product missing' }, { status: 404 });
    }
    const existing = cartState.find((l) => l.productId === body.productId);
    if (existing) {
      existing.quantity += body.quantity;
    } else {
      cartState.push({
        productId: body.productId,
        quantity: body.quantity,
        name: product.name,
        unitPrice: product.priceMinor,
      });
    }
    return HttpResponse.json(cartResponse(), { status: 201 });
  }),
  http.patch(`${base}/cart/items/:productId`, async ({ params, request }) => {
    const body = (await request.json()) as { quantity: number };
    const line = cartState.find((l) => l.productId === params.productId);
    if (!line) return HttpResponse.json({ code: 'not_found', message: 'line missing' }, { status: 404 });
    line.quantity = body.quantity;
    return HttpResponse.json(cartResponse());
  }),
  http.delete(`${base}/cart/items/:productId`, ({ params }) => {
    cartState = cartState.filter((l) => l.productId !== params.productId);
    return HttpResponse.json(cartResponse());
  }),
  http.post(`${base}/cart/merge`, async ({ request }) => {
    const body = (await request.json()) as { items: { productId: string; quantity: number }[] };
    for (const item of body.items) {
      const product = productsDb.find((p) => p.productId === item.productId);
      if (!product) continue;
      const existing = cartState.find((l) => l.productId === item.productId);
      if (existing) {
        existing.quantity = Math.max(existing.quantity, item.quantity);
      } else {
        cartState.push({
          productId: item.productId,
          quantity: item.quantity,
          name: product.name,
          unitPrice: product.priceMinor,
        });
      }
    }
    return HttpResponse.json(cartResponse());
  }),
  http.post(`${base}/checkout/session`, () =>
    HttpResponse.json({
      sessionId: 'sess-123',
      providerUrl: 'https://payments.example.com/checkout/sess-123',
    }),
  ),
  http.get(`${base}/checkout/complete`, ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({
      orderId: 'ord-1',
      status: 'paid',
      sessionId: url.searchParams.get('session_id') ?? 'sess-123',
    });
  }),
  http.get(`${base}/me/profile`, () =>
    HttpResponse.json({
      customerId: 'cust-1',
      displayName: 'Sample User',
      email: 'sample@example.com',
      marketingOptIn: false,
    }),
  ),
  http.patch(`${base}/me/profile`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ customerId: 'cust-1', ...body });
  }),
  http.get(`${base}/me/orders`, () =>
    HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 }),
  ),
  http.get(`${base}/me/data-export`, () => HttpResponse.json({ downloadUrl: 'https://export.example.com/me.zip' })),
  http.post(`${base}/me/erasure-request`, () => HttpResponse.json({ ticketId: 'erasure-1', status: 'pending' })),
  http.post(`${base}/me/preferences/marketing`, async ({ request }) => {
    const body = (await request.json()) as { optIn: boolean };
    return HttpResponse.json({ optIn: body.optIn });
  }),
];
