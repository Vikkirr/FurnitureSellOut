import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error?: Error };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: '#e6e6e6', fontFamily: 'system-ui, sans-serif', maxWidth: '600px' }}>
          <h1 style={{ marginTop: 0 }}>Something went wrong</h1>
          <p>Try refreshing the page. If the problem continues, check the browser console.</p>
          {this.state.error && (
            <pre style={{ overflow: 'auto', fontSize: '0.875rem', color: '#a8a8a8' }}>
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
