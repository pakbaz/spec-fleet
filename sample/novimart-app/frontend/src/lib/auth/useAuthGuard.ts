import { useEffect } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { loginRequest } from './msalConfig';

/**
 * Redirect-to-login if user is not authenticated. Use on protected routes.
 */
export function useAuthGuard(): { isAuthenticated: boolean } {
  const isAuthenticated = useIsAuthenticated();
  const { instance } = useMsal();

  useEffect(() => {
    if (!isAuthenticated) {
      void instance.loginRedirect(loginRequest).catch(() => {
        /* swallow — redirect failures are surfaced via MSAL events */
      });
    }
  }, [isAuthenticated, instance]);

  return { isAuthenticated };
}
