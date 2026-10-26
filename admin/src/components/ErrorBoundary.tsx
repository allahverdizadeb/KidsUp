import { Component } from 'react';
import type { ReactNode } from 'react';

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { hasError: boolean };

/**
 * Last line of defence: a screen that fails to draw (an answer of the API in a shape nobody expected, a mistake in
 * the code) must not leave a blank page, and must show nothing of the failure. The whole panel is replaced by one
 * fixed message: no error text, and nothing of the families that was on the screen.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main style={{ maxWidth: 520, margin: '20vh auto', padding: '0 24px', textAlign: 'center' }}>
        <div role="alert">
          <h1 style={{ fontSize: 30, letterSpacing: '-0.03em', margin: '0 0 16px' }}>
            Kids<span style={{ color: '#FF0083' }}>Up</span> Admin
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: '#4A4A4A' }}>
            Paneli göstərmək mümkün olmadı. Səhifəni yeniləyin. Problem təkrarlanarsa, administratora
            bildirin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            height: 44,
            padding: '0 22px',
            border: 'none',
            borderRadius: 10,
            background: '#1A1A1A',
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: 800,
          }}
        >
          Səhifəni yenilə
        </button>
      </main>
    );
  }
}
