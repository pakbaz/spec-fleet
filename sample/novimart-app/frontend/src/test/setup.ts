import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './msw/server';

// jsdom doesn't implement matchMedia; needed for prefers-reduced-motion checks.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// Stub MSAL so tests don't need a real auth tenant or browser APIs.
vi.mock('@azure/msal-react', () => ({
  MsalProvider: ({ children }: { children: unknown }) => children,
  useIsAuthenticated: () => false,
  useMsal: () => ({
    instance: {
      loginRedirect: vi.fn(),
      logoutRedirect: vi.fn(),
      getAllAccounts: () => [],
      acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: 'test-token' }),
    },
    accounts: [],
    inProgress: 'none',
  }),
}));

vi.mock('@/lib/auth/msalConfig', () => ({
  msalConfig: { auth: { clientId: 'test', authority: 'https://localhost' }, cache: { cacheLocation: 'sessionStorage' } },
  apiScope: 'api://test/access_as_user',
  loginRequest: { scopes: ['openid'] },
  msalInstance: {
    getAllAccounts: () => [],
    acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: 'test-token' }),
  },
}));

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
  sessionStorage.clear();
});

afterAll(() => {
  server.close();
});
