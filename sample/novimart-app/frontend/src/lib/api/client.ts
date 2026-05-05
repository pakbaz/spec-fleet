import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { msalInstance, apiScope } from '@/lib/auth/msalConfig';
import type { ApiError } from './types';

const ANON_PATHS = ['/products', '/categories', '/health'];

function isAnon(url: string | undefined): boolean {
  if (!url) return false;
  return ANON_PATHS.some((p) => url.startsWith(p) || url.startsWith(`/api${p}`));
}

async function attachToken(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
  if (isAnon(config.url)) return config;
  if (!apiScope) return config;
  try {
    const account = msalInstance.getAllAccounts()[0];
    if (!account) return config;
    const result = await msalInstance.acquireTokenSilent({
      scopes: [apiScope],
      account,
    });
    config.headers.set('Authorization', `Bearer ${result.accessToken}`);
  } catch {
    /* fall through — request continues without token; server will 401 if needed */
  }
  return config;
}

function defaultCodeForStatus(status: number): string {
  // Surface auth-class failures explicitly so the SPA can prompt re-sign-in
  // (spec: checkout-hardening). Anything else falls back to `api_error`.
  if (status === 0) return 'network_error';
  if (status === 401) return 'auth_required';
  if (status === 403) return 'forbidden';
  return 'api_error';
}

function normalizeError(err: AxiosError<Partial<ApiError>>): ApiError {
  const status = err.response?.status ?? 0;
  const data = err.response?.data;
  return {
    status,
    code: data?.code ?? defaultCodeForStatus(status),
    message: data?.message ?? err.message,
    ...(data?.details ? { details: data.details } : {}),
  };
}

export function createApiClient(baseURL: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'): AxiosInstance {
  const instance = axios.create({
    baseURL,
    withCredentials: true,
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });

  instance.interceptors.request.use(attachToken);
  instance.interceptors.response.use(
    (r) => r,
    (err: AxiosError<Partial<ApiError>>) => Promise.reject(normalizeError(err)),
  );
  return instance;
}

export const api: AxiosInstance = createApiClient();
