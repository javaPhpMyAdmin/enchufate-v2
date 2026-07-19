/**
 * ErrorBoundary — class-based render-error catch for the whole app.
 *
 * Why a class component? React error boundaries can only be implemented
 * via the legacy class lifecycle (`componentDidCatch` / `getDerivedStateFromError`)
 * because the equivalent hooks APIs do not exist as of React 19. Every
 * functional component below this boundary is therefore protected; a
 * thrown render error surfaces as a friendly `<ErrorState />` instead
 * of crashing the whole app.
 *
 * **Scope**: one boundary at the root (`app/_layout.tsx`) covers every
 * screen. Per-screen boundaries are overkill for the MVP — Phase 8 only
 * needs the user to see a recovery affordance rather than a white screen
 * of death.
 *
 * **Recovery**: the "Reintentar" `Button` clears the captured error,
 * which remounts the children. The whole tree rebuilds from `useState`'s
 * `INITIAL` so any transient state in feature hooks restarts.
 *
 * **Telemetry**: `console.error` is the only sink for v2 (no Sentry
 * integration in the MVP — the `AppError` normalizer in `src/lib/error.ts`
 * already routes Supabase / network errors to a typed shape; Sentry hooks
 * land in v2.1 alongside push notifications and the rest of the deferred
 * observability work).
 */
import React, { type ErrorInfo, type ReactNode } from 'react';

import { ErrorState } from './ErrorState';

export interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Wraps a subtree and surfaces render failures via `<ErrorState />`.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <RootStack />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Uncaught render error', { error, info });
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <ErrorState
          body={error.message || 'Ocurrió un error inesperado al renderizar la pantalla.'}
          onRetry={this.handleReset}
          retryLabel="Reintentar"
        />
      );
    }
    return this.props.children;
  }
}
