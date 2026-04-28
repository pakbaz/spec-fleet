import { Component, type ErrorInfo, type ReactNode } from 'react';
import { trackError } from '@/lib/telemetry/appinsights';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string | undefined;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    trackError(error, { componentStack: info.componentStack ?? '' });
  }

  public reset = (): void => {
    this.setState({ hasError: false, message: undefined });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert" className="m-8 rounded border border-red-300 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900">Something went wrong.</h2>
          <p className="mt-2 text-sm text-red-800">
            Please reload the page. If the problem persists, contact support.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-4 rounded bg-acme-blue px-4 py-2 text-sm text-white"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
