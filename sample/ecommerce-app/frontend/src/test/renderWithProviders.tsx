import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { type ReactElement, type ReactNode } from 'react';

interface Options {
  route?: string;
  queryClient?: QueryClient;
  renderOptions?: Omit<RenderOptions, 'wrapper'>;
}

export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', queryClient = makeTestQueryClient(), renderOptions }: Options = {},
): RenderResult & { queryClient: QueryClient } {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  const result = render(ui, { wrapper: Wrapper, ...renderOptions });
  return Object.assign(result, { queryClient });
}
