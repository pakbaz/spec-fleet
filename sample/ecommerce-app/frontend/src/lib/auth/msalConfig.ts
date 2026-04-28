import { PublicClientApplication, type Configuration, type RedirectRequest } from '@azure/msal-browser';

const env = import.meta.env;

/**
 * MSAL configuration for Acme Retail customer SPA.
 *
 * NOTE on token storage: We use `sessionStorage` here (cleared on tab close)
 * as a documented compromise for the sample. Production SHOULD switch to a
 * BFF cookie pattern: the .NET API exchanges the MSAL token and issues an
 * HttpOnly+Secure+SameSite=strict cookie. See `src/lib/auth/README.md`.
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: env.VITE_AZURE_CLIENT_ID ?? '',
    authority: env.VITE_AZURE_AUTHORITY ?? '',
    redirectUri: env.VITE_AZURE_REDIRECT_URI ?? window.location.origin,
    postLogoutRedirectUri: env.VITE_AZURE_REDIRECT_URI ?? window.location.origin,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    allowNativeBroker: false,
  },
};

export const apiScope: string = env.VITE_AZURE_API_SCOPE ?? '';

export const loginRequest: RedirectRequest = {
  scopes: apiScope ? [apiScope, 'openid', 'profile', 'offline_access'] : ['openid', 'profile'],
};

export const msalInstance = new PublicClientApplication(msalConfig);
