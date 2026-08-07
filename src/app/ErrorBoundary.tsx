/**
 * Global error boundary (MR-07 "app-shell": "global error boundary").
 *
 * Catches a render-time throw anywhere below it, logs the failure through the
 * injected Logger (never `console`, per MR-18) and renders `ErrorState`
 * instead of a blank red screen. It cannot catch errors from event handlers
 * or async code — those go through `toAppError`/`Result` and are handled at
 * their own call sites.
 */
import {Component, type ErrorInfo, type ReactNode} from 'react';

import type {Logger} from '../core/logging';
import {ErrorState} from '../design-system';

export interface ErrorBoundaryProps {
  readonly logger: Logger;
  readonly children: ReactNode;
  /** Localized copy, injected so this class component needs no i18n hook. */
  readonly title: string;
  readonly effect: string;
  readonly recoveryLabel: string;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {error: null};

  // Not `override`: React recognizes this static lifecycle method by name,
  // but `Component`'s TypeScript definition does not declare it, so `override`
  // would itself be a type error here (TS4113).
  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {error};
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    // MR-07: no content titles or file paths in diagnostics. A component
    // stack can theoretically include a route param in dev; only the message
    // and stack are logged, and never in a release build's verbose logger.
    this.props.logger.error('app.uncaughtRenderError', {
      message: error.message,
      componentStack: info.componentStack ?? '',
    });
  }

  private readonly handleReload = (): void => {
    this.setState({error: null});
  };

  public override render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorState
          title={this.props.title}
          effect={this.props.effect}
          recoveryAction={{label: this.props.recoveryLabel, onPress: this.handleReload}}
        />
      );
    }
    return this.props.children;
  }
}
