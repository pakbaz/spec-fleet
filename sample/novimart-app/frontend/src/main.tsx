import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './lib/auth/msalConfig';
import { QueryProvider } from './app/QueryProvider';
import { ErrorBoundary } from './app/ErrorBoundary';
import { initTelemetry } from './lib/telemetry/appinsights';
import App from './App';
import './index.css';

initTelemetry();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found in DOM.');

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <MsalProvider instance={msalInstance}>
        <QueryProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryProvider>
      </MsalProvider>
    </ErrorBoundary>
  </StrictMode>,
);
