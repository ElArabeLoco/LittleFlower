/**
 * FeatureErrorBoundary — catches render crashes within a feature section.
 *
 * Usage: wrap each route's component so a crash in one feature doesn't
 * take down the entire app. The fallback provides a retry button and
 * a compact error message.
 */
import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  /** Optional feature name shown in the fallback UI. */
  feature?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[FeatureErrorBoundary${this.props.feature ? `:${this.props.feature}` : ''}]`, error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const label = this.props.feature ? ` ${this.props.feature}` : '';
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">
            Algo falló{label && ` en ${label}`}. Intenta de nuevo.
          </p>
          <button
            onClick={this.handleRetry}
            className="rounded-md bg-pink-400 px-3 py-1.5 text-sm font-medium text-white hover:bg-pink-500 transition-colors"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
