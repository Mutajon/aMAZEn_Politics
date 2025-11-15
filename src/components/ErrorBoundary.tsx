// src/components/ErrorBoundary.tsx
// Global error boundary that catches and logs React errors
//
// Features:
// - Catches uncaught React errors
// - Logs errors with stack traces
// - Provides user-friendly error UI
// - Automatically integrates with logging system
//
// Usage:
//   <ErrorBoundary>
//     <App />
//   </ErrorBoundary>

import { Component, type ReactNode } from 'react';
import { loggingService } from '../lib/loggingService';
import { useSettingsStore } from '../store/settingsStore';
import { captureError } from '../lib/sentry';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack: string } | null;
  errorCount: number;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // Log error to logging system
    this.logError(error, errorInfo);

    // Update state with error details
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Also log to console for development
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  logError(error: Error, errorInfo: { componentStack: string }) {
    const { debugMode } = useSettingsStore.getState();

    if (debugMode) {
      return;
    }

    // Extract useful error information
    const errorData = {
      name: error.name,
      message: error.message,
      stack: error.stack || 'No stack trace available',
      componentStack: errorInfo.componentStack,
      errorCount: this.state.errorCount + 1,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Log to Sentry error monitoring
    captureError(error, errorData);

    // Log fatal error to research database
    loggingService.log(
      'fatal_error',
      errorData,
      `Fatal React error: ${error.name} - ${error.message}`
    );

    // Force flush logs immediately (don't wait for auto-flush)
    loggingService.flush(true);

    console.log('[ErrorBoundary] Error logged to database and Sentry');
  }

  handleReload = () => {
    // Clear error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    // Reload the page
    window.location.reload();
  };

  handleReset = () => {
    // Clear error state without reloading
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorCount } = this.state;

      return (
        <div className="min-h-screen bg-gradient-to-br from-red-950 via-gray-900 to-black flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-red-900/20 backdrop-blur-sm border border-red-500/50 rounded-xl p-8 shadow-2xl">
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* Error Title */}
            <h1 className="text-3xl font-bold text-red-400 mb-3 text-center">
              Something Went Wrong
            </h1>

            {/* Error Message */}
            <p className="text-white/80 mb-6 text-center">
              We've encountered an unexpected error. The error has been logged and we'll investigate it.
            </p>

            {/* Error Details (Collapsible) */}
            <details className="mb-6 bg-black/30 rounded-lg p-4">
              <summary className="cursor-pointer text-red-300 font-semibold mb-2">
                Technical Details {errorCount > 1 && `(${errorCount} errors)`}
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-red-400 font-mono text-sm mb-1">Error:</p>
                  <p className="text-white/70 text-sm font-mono bg-black/50 p-2 rounded overflow-x-auto">
                    {error?.name}: {error?.message}
                  </p>
                </div>
                {error?.stack && (
                  <div>
                    <p className="text-red-400 font-mono text-sm mb-1">Stack Trace:</p>
                    <pre className="text-white/60 text-xs font-mono bg-black/50 p-2 rounded overflow-x-auto max-h-40">
                      {error.stack}
                    </pre>
                  </div>
                )}
                {errorInfo?.componentStack && (
                  <div>
                    <p className="text-red-400 font-mono text-sm mb-1">Component Stack:</p>
                    <pre className="text-white/60 text-xs font-mono bg-black/50 p-2 rounded overflow-x-auto max-h-40">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors"
              >
                Reload Page
              </button>
            </div>

            {/* Help Text */}
            <p className="text-white/50 text-xs text-center mt-6">
              If this problem persists, try clearing your browser cache or contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
