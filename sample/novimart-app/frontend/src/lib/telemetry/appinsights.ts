/**
 * App Insights telemetry — gated on VITE_APPINSIGHTS_CONNECTION_STRING.
 * No PII is recorded in events. Operational signals only.
 *
 * This is intentionally a thin wrapper. The real `@microsoft/applicationinsights-web`
 * SDK is loaded lazily only when a connection string is provided to keep
 * the initial bundle small.
 */

type TelemetryProps = Record<string, string | number | boolean>;

interface TelemetrySink {
  trackEvent(name: string, props?: TelemetryProps): void;
  trackError(err: Error, props?: TelemetryProps): void;
}

let sink: TelemetrySink | null = null;

export function initTelemetry(): void {
  const cs = import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING;
  if (!cs) {
    sink = null;
    return;
  }
  // Stub sink — production code would dynamically import @microsoft/applicationinsights-web
  // and forward calls. This keeps the sample bundle slim while preserving the contract.
  sink = {
    trackEvent: (name, props) => {
      if (typeof console !== 'undefined') {
        console.info('[telemetry]', name, props ?? {});
      }
    },
    trackError: (err, props) => {
      if (typeof console !== 'undefined') {
        console.warn('[telemetry:error]', err.message, props ?? {});
      }
    },
  };
}

export function trackEvent(name: string, props?: TelemetryProps): void {
  sink?.trackEvent(name, props);
}

export function trackError(err: Error, props?: TelemetryProps): void {
  sink?.trackError(err, props);
}
